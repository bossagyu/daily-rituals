import { defineConfig, devices } from '@playwright/test';

// Local Supabase credentials. In CI these are injected from the running stack
// via `supabase status -o env` (see .github/workflows/e2e.yml) so they stay in
// sync with whatever Supabase CLI version is used. The hardcoded values are the
// legacy `supabase start` defaults, kept only as a fallback for local runs.
const SUPABASE_LOCAL_URL =
  process.env.SUPABASE_LOCAL_URL ?? 'http://127.0.0.1:54321';
const SUPABASE_LOCAL_ANON_KEY =
  process.env.SUPABASE_LOCAL_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export const SUPABASE_LOCAL_SERVICE_ROLE_KEY =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export { SUPABASE_LOCAL_URL, SUPABASE_LOCAL_ANON_KEY };

export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:5173',
    storageState: 'e2e/.auth/storage-state.json',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'authenticated',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /z-signout\.spec\.ts/,
    },
    {
      name: 'signout',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /z-signout\.spec\.ts/,
      dependencies: ['authenticated'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: SUPABASE_LOCAL_URL,
      VITE_SUPABASE_ANON_KEY: SUPABASE_LOCAL_ANON_KEY,
    },
  },
});
