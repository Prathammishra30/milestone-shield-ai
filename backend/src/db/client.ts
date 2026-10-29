import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

/**
 * Checks whether valid, non-placeholder Supabase configuration exists in the environment.
 */
export function isSupabaseConfigured(): boolean {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;
  const isUrlPlaceholder =
    env.SUPABASE_URL.includes('your-project') ||
    env.SUPABASE_URL.includes('placeholder') ||
    env.SUPABASE_URL.includes('example.com');
  const isKeyPlaceholder =
    env.SUPABASE_ANON_KEY.includes('your-') ||
    env.SUPABASE_ANON_KEY.includes('placeholder');
  return !isUrlPlaceholder && !isKeyPlaceholder;
}

/**
 * Creates an authenticated, user-scoped Supabase client.
 *
 * CRITICAL ARCHITECTURE RULE (Requirement 1):
 * When user-facing queries are executed with this client, the user's JWT is passed
 * in the Authorization header. PostgREST/PostgreSQL receives the caller's JWT,
 * sets auth.uid(), and actively evaluates Row-Level Security (RLS) under the
 * caller's identity!
 */
export function getUserSupabaseClient(token: string): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error('Supabase client cannot be initialized: SUPABASE_URL or SUPABASE_ANON_KEY missing.');
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
    },
  });
}

/**
 * Returns a server-only privileged Supabase client configured with SUPABASE_SERVICE_ROLE_KEY.
 *
 * CRITICAL FINANCIAL SAFETY RULE (Requirement 5):
 * The service-role key BYPASSES Row-Level Security. It is strictly reserved for server-controlled
 * financial settlements (payments, audit events) and must NEVER be exposed to the client browser.
 */
let serviceRoleClient: SupabaseClient | null = null;

export function getServiceSupabaseClient(): SupabaseClient | null {
  if (serviceRoleClient) return serviceRoleClient;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const isKeyPlaceholder =
    env.SUPABASE_SERVICE_ROLE_KEY.includes('your-') ||
    env.SUPABASE_SERVICE_ROLE_KEY.includes('placeholder');
  if (isKeyPlaceholder) return null;

  serviceRoleClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serviceRoleClient;
}

export function resetServiceSupabaseClientForTests(): void {
  serviceRoleClient = null;
}

/**
 * Checks if in-memory store is permitted for the current environment.
 * Strictly forbidden in production.
 */
export function isInMemoryStorePermitted(): boolean {
  if (env.NODE_ENV === 'production') {
    return false;
  }
  return true;
}

/**
 * Asserts database readiness for financial operations.
 * In production, throws error if live Supabase service client is not available.
 */
export function assertDatabaseReadinessForPayments(): void {
  if (env.NODE_ENV === 'production') {
    if (!isSupabaseConfigured() || !getServiceSupabaseClient()) {
      throw new Error(
        'Database configuration missing in production: Cannot process financial operations without live PostgreSQL connection.'
      );
    }
  }
}
