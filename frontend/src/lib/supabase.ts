/**
 * Supabase Browser Client Configuration
 *
 * CRITICAL CLIENT BUNDLE SECURITY RULES:
 * 1. ONLY public/anon credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are permitted.
 * 2. NEVER import or expose SUPABASE_SERVICE_ROLE_KEY, PAYPAL_CLIENT_SECRET, ANTHROPIC_API_KEY,
 *    or database admin passwords in client code or VITE_ environment variables.
 * 3. Row-Level Security (RLS) is enforced at the PostgreSQL layer for all public client requests.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Security verification guard: ensure privileged keys are NEVER bundled into frontend
if (
  typeof import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY !== 'undefined' ||
  typeof import.meta.env.SUPABASE_SERVICE_ROLE_KEY !== 'undefined'
) {
  console.error(
    'CRITICAL SECURITY VIOLATION: Supabase service_role key detected in frontend environment variables. Remove immediately from frontend/.env.'
  );
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'milestoneshield_auth_token',
      },
    })
  : null;
