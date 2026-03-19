import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_LOCAL_URL,
  SUPABASE_LOCAL_ANON_KEY,
} from '../../playwright.config';
import { createAdminClient } from './test-data';

const TEST_USER_EMAIL = 'e2e-test@example.com';
const TEST_USER_PASSWORD = 'e2e-test-password-123';

export { TEST_USER_EMAIL, TEST_USER_PASSWORD };

export async function createTestUser(): Promise<string> {
  const admin = createAdminClient();

  // Delete existing test user if present
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.email === TEST_USER_EMAIL,
  );
  if (existingUser) {
    await admin.from('completions').delete().eq('user_id', existingUser.id);
    await admin.from('habits').delete().eq('user_id', existingUser.id);
    await admin.auth.admin.deleteUser(existingUser.id);
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'E2E Test User' },
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  return data.user.id;
}

export async function getTestSession(): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}> {
  const anonClient = createClient(SUPABASE_LOCAL_URL, SUPABASE_LOCAL_ANON_KEY);

  const { data, error } = await anonClient.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });

  if (error) {
    throw new Error(`Failed to sign in test user: ${error.message}`);
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    userId: data.user.id,
  };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from('completions').delete().eq('user_id', userId);
  await admin.from('habits').delete().eq('user_id', userId);
  await admin.auth.admin.deleteUser(userId);
}

export function buildSupabaseSessionPayload(session: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}): string {
  return JSON.stringify({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    expires_at: session.expiresAt,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: session.userId,
      email: TEST_USER_EMAIL,
      user_metadata: { full_name: 'E2E Test User' },
      aud: 'authenticated',
      role: 'authenticated',
    },
  });
}

export function getStorageKey(): string {
  // Supabase uses the hostname from the URL as part of the storage key
  return 'sb-127-auth-token';
}
