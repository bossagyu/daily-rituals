import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

interface SupabaseConfig {
  readonly url: string;
  readonly anonKey: string;
}

const validateEnvVar = (name: string): string => {
  const value = import.meta.env[name] as string | undefined;
  if (!value) {
    throw new Error(
      `${name} is not configured. Please set it in your .env file.`
    );
  }
  return value;
};

export const getSupabaseConfig = (): SupabaseConfig => ({
  url: validateEnvVar('VITE_SUPABASE_URL'),
  anonKey: validateEnvVar('VITE_SUPABASE_ANON_KEY'),
});

export const createSupabaseClient = (): SupabaseClient<Database> => {
  const config = getSupabaseConfig();
  return createClient<Database>(config.url, config.anonKey);
};
