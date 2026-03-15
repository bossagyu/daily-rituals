import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Sign in with Google OAuth via Supabase Auth.
 *
 * @param client - Supabase client instance
 * @throws Error if the OAuth sign-in fails
 */
export const signInWithGoogle = async (
  client: SupabaseClient
): Promise<void> => {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
  });

  if (error) {
    throw new Error(error.message);
  }
};

/**
 * Sign out the current user.
 *
 * @param client - Supabase client instance
 * @throws Error if sign-out fails
 */
export const signOut = async (client: SupabaseClient): Promise<void> => {
  const { error } = await client.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
};

/**
 * Get the currently authenticated user.
 *
 * @param client - Supabase client instance
 * @returns The current user, or null if not authenticated
 * @throws Error if the request fails
 */
export const getCurrentUser = async (
  client: SupabaseClient
): Promise<User | null> => {
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  return data.user;
};

/**
 * Subscribe to authentication state changes.
 *
 * @param client - Supabase client instance
 * @param callback - Called with the user (or null) on auth state change
 * @returns Unsubscribe function
 */
export const onAuthStateChange = (
  client: SupabaseClient,
  callback: (user: User | null) => void
): (() => void) => {
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });

  return () => {
    data.subscription.unsubscribe();
  };
};
