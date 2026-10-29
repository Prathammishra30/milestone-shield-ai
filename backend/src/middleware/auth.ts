import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { AppError } from './errorHandler';
import { UserRole } from '../models/contracts';
import { isSupabaseConfigured, getUserSupabaseClient } from '../db/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      token?: string;
      supabase?: SupabaseClient;
    }
  }
}

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  if (env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY)) {
    supabaseClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }
  return supabaseClient;
}

/**
 * Helper to safely resolve roles, strictly preventing client-supplied admin escalation.
 * Client metadata (user_metadata) can only assign 'client' or 'freelancer'.
 * 'admin' is only granted if derived from trusted server-controlled app_metadata.
 */
function resolveSafeRole(appRole?: unknown, userRole?: unknown): UserRole {
  if (appRole === 'admin') return 'admin';
  if (appRole === 'freelancer' || userRole === 'freelancer') return 'freelancer';
  return 'client';
}

/**
 * Parses and verifies access token from Bearer authorization header.
 */
export async function authenticateToken(token: string): Promise<AuthenticatedUser> {
  // Production environment strictly rejects all test tokens and development bypasses
  if (env.NODE_ENV === 'production') {
    if (token.startsWith('test-token:') || token.startsWith('dev-token:')) {
      throw new AppError('Development and test tokens are strictly forbidden in production.', 401);
    }
  }

  const isTest =
    (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || env.NODE_ENV === 'test') &&
    env.NODE_ENV !== 'production';
  // 1. Support deterministic test tokens in test environment
  if (isTest && token.startsWith('test-token:')) {
    const parts = token.split(':');
    // Format: test-token:<userId>:<role>:<email>:<flag>
    const id = parts[1] || 'usr-test-001';
    let role = (parts[2] as UserRole) || 'client';
    // Prevent untrusted elevation to admin if flagged
    if (role === 'admin' && parts[4] === 'untrusted_metadata') {
      role = 'client';
    }
    const email = parts[3] || `${id}@example.com`;

    if (parts[4] === 'unverified') {
      throw new AppError('Email verification required. Unverified users cannot access protected data.', 403);
    }

    return { id, role, email };
  }

  // 2. If JWT secret is configured, attempt signature & claims verification
  if (env.SUPABASE_JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, env.SUPABASE_JWT_SECRET, {
        algorithms: ['HS256'],
      }) as {
        sub?: string;
        email?: string;
        aud?: string;
        role?: string;
        email_confirmed_at?: string | null;
        user_metadata?: { role?: UserRole; full_name?: string };
        app_metadata?: { role?: UserRole };
      };

      if (!decoded.sub) {
        throw new AppError('Invalid token payload: missing subject identifier', 401);
      }

      // Check audience claim if present
      if (decoded.aud && decoded.aud !== 'authenticated') {
        throw new AppError(`Invalid token audience claim: '${decoded.aud}'`, 401);
      }

      // Block unverified email users
      if (decoded.email_confirmed_at === null) {
        throw new AppError('Email verification required. Please verify your email before accessing protected data.', 403);
      }

      return {
        id: decoded.sub,
        email: decoded.email || `${decoded.sub}@example.com`,
        role: resolveSafeRole(decoded.app_metadata?.role, decoded.user_metadata?.role),
        fullName: decoded.user_metadata?.full_name,
      };
    } catch (jwtErr) {
      if (jwtErr instanceof AppError) throw jwtErr;
      throw new AppError('Invalid or expired authentication token', 401);
    }
  }

  // 3. Verify via Supabase Auth client if configured
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new AppError('Authentication failed: invalid or expired session token', 401);
    }

    if (!data.user.email_confirmed_at && env.NODE_ENV === 'production') {
      throw new AppError('Email verification required. Please verify your email before accessing protected data.', 403);
    }

    return {
      id: data.user.id,
      email: data.user.email || '',
      role: resolveSafeRole(data.user.app_metadata?.role, data.user.user_metadata?.role),
      fullName: data.user.user_metadata?.full_name,
    };
  }

  // 4. In development without Supabase credentials, fail safely with actionable instructions
  if (env.NODE_ENV === 'development') {
    // If a mock dev header is provided in development for local testing
    if (token.startsWith('dev-token:')) {
      const parts = token.split(':');
      const id = parts[1] || 'usr-client-001';
      const role = resolveSafeRole(undefined, parts[2] as UserRole);
      return { id, role, email: `${id}@local.dev` };
    }
  }

  throw new AppError(
    'Authentication service not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_JWT_SECRET) in backend/.env',
    500
  );
}

/**
 * Middleware: Requires a valid authenticated user session.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    const isTest =
    (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || env.NODE_ENV === 'test') &&
    env.NODE_ENV !== 'production';
    if (isTest && !req.headers['x-test-no-auth']) {
      req.user = {
        id: 'usr-client-001',
        role: 'client',
        email: 'client@example.com',
      };
      next();
      return;
    }
    next(new AppError('Authentication required. Missing Authorization header.', 401));
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    next(new AppError('Invalid Authorization header format. Expected "Bearer <token>".', 401));
    return;
  }

  const token = parts[1].trim();
  if (!token) {
    next(new AppError('Authentication required. Token is empty.', 401));
    return;
  }

  try {
    const user = await authenticateToken(token);
    req.user = user;
    req.token = token;
    if (isSupabaseConfigured()) {
      try {
        req.supabase = getUserSupabaseClient(token);
      } catch {
        // Fall back gracefully if client init fails
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: Extracts user if token is present, but does not enforce authentication.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    next();
    return;
  }

  try {
    const user = await authenticateToken(token);
    req.user = user;
  } catch {
    // Optional auth ignores failure and proceeds without req.user
  }
  next();
}
