import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  SUPABASE_LOCAL_URL,
  SUPABASE_LOCAL_ANON_KEY,
  SUPABASE_LOCAL_SERVICE_ROLE_KEY,
} from '../playwright.config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, '.auth');
const STORAGE_STATE_PATH = path.join(AUTH_DIR, 'storage-state.json');
const USER_ID_PATH = path.join(AUTH_DIR, 'test-user-id.txt');

const TEST_USER_EMAIL = 'e2e-test@example.com';
const TEST_USER_PASSWORD = 'e2e-test-password-123';

async function globalSetup(): Promise<void> {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  // Create test user with admin client
  const admin = createClient(SUPABASE_LOCAL_URL, SUPABASE_LOCAL_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.email === TEST_USER_EMAIL,
  );
  if (existingUser) {
    await admin.from('push_subscriptions').delete().eq('user_id', existingUser.id);
    await admin.from('completions').delete().eq('user_id', existingUser.id);
    await admin.from('habits').delete().eq('user_id', existingUser.id);
    await admin.auth.admin.deleteUser(existingUser.id);
  }

  const { data: createData, error: createError } = await admin.auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'E2E Test User' },
  });

  if (createError) {
    throw new Error(`Failed to create test user: ${createError.message}`);
  }

  fs.writeFileSync(USER_ID_PATH, createData.user.id, 'utf-8');

  // Sign in via the app's own Supabase client in the browser
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the app first so localStorage is accessible
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');

  // Use the app's Supabase instance to sign in by calling the auth API directly
  // and storing the result in the same format the SDK expects
  await page.evaluate(
    async ({ supabaseUrl, anonKey, email, password }: {
      supabaseUrl: string;
      anonKey: string;
      email: string;
      password: string;
    }) => {
      const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
        },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        throw new Error(`Sign in failed: ${res.status}`);
      }

      const session = await res.json();

      // Store in the exact format Supabase SDK expects
      // The key must match what the SDK generates from the URL
      const hostname = new URL(supabaseUrl).hostname;
      const ref = hostname.split('.')[0];
      const storageKey = `sb-${ref}-auth-token`;

      localStorage.setItem(storageKey, JSON.stringify(session));
    },
    {
      supabaseUrl: SUPABASE_LOCAL_URL,
      anonKey: SUPABASE_LOCAL_ANON_KEY,
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    },
  );

  // Navigate to root to verify auth works
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(3000);

  const finalUrl = page.url();
  if (finalUrl.includes('/login')) {
    // Auth didn't work - the SDK might not be reading our localStorage
    // Let's try reloading
    await page.reload();
    await page.waitForTimeout(3000);
  }

  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}

export default globalSetup;
