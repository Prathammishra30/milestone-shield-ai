import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Deterministically discover and load environment configuration.
 * Searches canonical `backend/.env` first, then falls back to repository root `.env`.
 */
function loadDotenvFiles(): void {
  // Candidate paths in order of preference
  const candidatePaths = [
    // 1. backend/.env relative to this file (both in src/config and dist/config)
    path.resolve(__dirname, '../../.env'),
    // 2. backend/.env relative to current working directory
    path.resolve(process.cwd(), 'backend/.env'),
    // 3. .env in current working directory
    path.resolve(process.cwd(), '.env'),
    // 4. .env in repository root relative to this file
    path.resolve(__dirname, '../../../.env'),
  ];

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: true });
      break;
    }
  }
}

loadDotenvFiles();

export const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // PayPal Sandbox configuration
  PAYPAL_CLIENT_ID: z
    .string()
    .default('')
    .transform((s) => s.trim().replace(/^["']|["']$/g, '')),
  PAYPAL_CLIENT_SECRET: z
    .string()
    .default('')
    .transform((s) => s.trim().replace(/^["']|["']$/g, '')),
  PAYPAL_BASE_URL: z
    .string()
    .default('https://api-m.sandbox.paypal.com')
    .transform((s) => s.trim().replace(/^["']|["']$/g, ''))
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          // Strictly allow ONLY PayPal Sandbox hosts; reject live production hosts
          return (
            parsed.hostname === 'api-m.sandbox.paypal.com' ||
            parsed.hostname === 'api.sandbox.paypal.com'
          );
        } catch {
          return false;
        }
      },
      {
        message:
          'PAYPAL_BASE_URL must target PayPal Sandbox (e.g. https://api-m.sandbox.paypal.com). Production PayPal endpoints are rejected in Milestone 2A.',
      },
    ),
  PAYPAL_WEBHOOK_ID: z.string().optional(),

  // Supabase Auth and Database
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),

  // Operational & Caching
  TRUST_PROXY: z.coerce.boolean().default(false),
  REDIS_URL: z.string().url().optional(),
  ALLOW_IN_MEMORY_STORES: z.coerce.boolean().default(false),

  // Future: Anthropic
  ANTHROPIC_API_KEY: z.string().optional(),

  // Future: PostgreSQL direct connection
  DATABASE_URL: z.string().optional(),
}).superRefine((data, ctx) => {
  // Production security constraints
  if (data.NODE_ENV === 'production') {
    // 1. Reject local or wildcard CORS in production
    if (
      data.CORS_ORIGIN.includes('localhost') ||
      data.CORS_ORIGIN.includes('127.0.0.1') ||
      data.CORS_ORIGIN === '*'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message: 'CORS_ORIGIN must target a valid production domain (HTTPS). Localhost, 127.0.0.1 and wildcard origins are rejected in production.',
      });
    }

    // 2. Strict fail-closed Supabase database configuration in production
    if (!data.SUPABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_URL'],
        message: 'SUPABASE_URL is required in production and must target your live Supabase project.',
      });
    } else if (
      data.SUPABASE_URL.includes('your-project') ||
      data.SUPABASE_URL.includes('placeholder') ||
      data.SUPABASE_URL.includes('localhost') ||
      data.SUPABASE_URL.includes('127.0.0.1')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_URL'],
        message: 'SUPABASE_URL cannot contain template placeholders or local addresses in production.',
      });
    }

    if (!data.SUPABASE_ANON_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_ANON_KEY'],
        message: 'SUPABASE_ANON_KEY is required in production for authenticated user-scoped database access.',
      });
    } else if (
      data.SUPABASE_ANON_KEY.includes('your-') ||
      data.SUPABASE_ANON_KEY.includes('placeholder')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_ANON_KEY'],
        message: 'SUPABASE_ANON_KEY contains template placeholders which are rejected in production.',
      });
    }

    if (!data.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
        message: 'SUPABASE_SERVICE_ROLE_KEY is required in production for server-controlled financial settlements.',
      });
    } else if (
      data.SUPABASE_SERVICE_ROLE_KEY.includes('your-') ||
      data.SUPABASE_SERVICE_ROLE_KEY.includes('placeholder')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
        message: 'SUPABASE_SERVICE_ROLE_KEY contains template placeholders which are rejected in production.',
      });
    }

    if (!data.SUPABASE_JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_JWT_SECRET'],
        message: 'SUPABASE_JWT_SECRET is required in production for cryptographically verifying authentication tokens.',
      });
    } else if (data.SUPABASE_JWT_SECRET.includes('your-') || data.SUPABASE_JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_JWT_SECRET'],
        message: 'SUPABASE_JWT_SECRET must be a cryptographically secure key of at least 32 characters and cannot contain template placeholders in production.',
      });
    }

    if (data.ALLOW_IN_MEMORY_STORES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ALLOW_IN_MEMORY_STORES'],
        message: 'ALLOW_IN_MEMORY_STORES must be false in production. In-memory storage is strictly forbidden in production.',
      });
    }

    if (data.PAYPAL_CLIENT_ID && data.PAYPAL_CLIENT_ID.startsWith('YOUR_')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYPAL_CLIENT_ID'],
        message: 'PAYPAL_CLIENT_ID contains template placeholder ("YOUR_...") which is rejected in production.',
      });
    }

    if (data.PAYPAL_CLIENT_SECRET && data.PAYPAL_CLIENT_SECRET.startsWith('YOUR_')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYPAL_CLIENT_SECRET'],
        message: 'PAYPAL_CLIENT_SECRET contains template placeholder ("YOUR_...") which is rejected in production.',
      });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(sourceEnv: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(sourceEnv);
  if (!parsed.success) {
    if (sourceEnv.NODE_ENV !== 'test') {
      console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    }
    throw new Error(`Invalid environment variables: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }
  return parsed.data;
}

export let env = loadEnv();

export function reloadEnv(): Env {
  loadDotenvFiles();
  env = loadEnv();
  return env;
}
