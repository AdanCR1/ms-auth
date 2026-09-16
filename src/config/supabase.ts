import { createClient } from '@supabase/supabase-js';
import type { Env } from '../types';

export const getSupabaseClient = (env: Env) => {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error(`Variables faltantes: SUPABASE_URL=${Boolean(env.SUPABASE_URL)}, SUPABASE_ANON_KEY=${Boolean(env.SUPABASE_ANON_KEY)}`);
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
};

export const getSupabaseAdmin = (env: Env) => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(`Variables faltantes: SUPABASE_URL=${Boolean(env.SUPABASE_URL)}, SUPABASE_SERVICE_ROLE_KEY=${Boolean(env.SUPABASE_SERVICE_ROLE_KEY)}`);
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};