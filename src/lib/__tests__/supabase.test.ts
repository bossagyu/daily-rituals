import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('createSupabaseClient', () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    Object.keys(import.meta.env).forEach((key) => {
      if (key.startsWith('VITE_SUPABASE_')) {
        delete (import.meta.env as Record<string, string>)[key];
      }
    });
    Object.assign(import.meta.env, originalEnv);
  });

  it('should throw an error when VITE_SUPABASE_URL is not set', async () => {
    (import.meta.env as Record<string, string>).VITE_SUPABASE_ANON_KEY =
      'test-anon-key';

    const { createSupabaseClient } = await import('../supabase');
    expect(() => createSupabaseClient()).toThrow(
      'VITE_SUPABASE_URL is not configured'
    );
  });

  it('should throw an error when VITE_SUPABASE_ANON_KEY is not set', async () => {
    (import.meta.env as Record<string, string>).VITE_SUPABASE_URL =
      'https://test.supabase.co';

    const { createSupabaseClient } = await import('../supabase');
    expect(() => createSupabaseClient()).toThrow(
      'VITE_SUPABASE_ANON_KEY is not configured'
    );
  });

  it('should throw when both environment variables are empty strings', async () => {
    (import.meta.env as Record<string, string>).VITE_SUPABASE_URL = '';
    (import.meta.env as Record<string, string>).VITE_SUPABASE_ANON_KEY = '';

    const { createSupabaseClient } = await import('../supabase');
    expect(() => createSupabaseClient()).toThrow(
      'VITE_SUPABASE_URL is not configured'
    );
  });

  it('should create a Supabase client when environment variables are set', async () => {
    (import.meta.env as Record<string, string>).VITE_SUPABASE_URL =
      'https://test.supabase.co';
    (import.meta.env as Record<string, string>).VITE_SUPABASE_ANON_KEY =
      'test-anon-key';

    const { createSupabaseClient } = await import('../supabase');
    const client = createSupabaseClient();
    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
    expect(typeof client.auth).toBe('object');
  });
});

describe('getSupabaseConfig', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    Object.keys(import.meta.env).forEach((key) => {
      if (key.startsWith('VITE_SUPABASE_')) {
        delete (import.meta.env as Record<string, string>)[key];
      }
    });
  });

  it('should return the Supabase configuration', async () => {
    (import.meta.env as Record<string, string>).VITE_SUPABASE_URL =
      'https://test.supabase.co';
    (import.meta.env as Record<string, string>).VITE_SUPABASE_ANON_KEY =
      'test-anon-key';

    const { getSupabaseConfig } = await import('../supabase');
    const config = getSupabaseConfig();
    expect(config).toEqual({
      url: 'https://test.supabase.co',
      anonKey: 'test-anon-key',
    });
  });

  it('should throw when URL is missing', async () => {
    (import.meta.env as Record<string, string>).VITE_SUPABASE_ANON_KEY =
      'test-anon-key';

    const { getSupabaseConfig } = await import('../supabase');
    expect(() => getSupabaseConfig()).toThrow(
      'VITE_SUPABASE_URL is not configured'
    );
  });
});
