/**
 * AuthProvider & useAuthContext - Provides authentication state via React Context.
 *
 * Wraps useAuth to make auth state available throughout the component tree
 * without prop drilling.
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';

export type AuthContextValue = {
  readonly user: User | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly signIn: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly refreshSession: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  readonly client: SupabaseClient;
  readonly children: React.ReactNode;
};

/**
 * Provides authentication state to the component tree.
 */
export function AuthProvider({ client, children }: AuthProviderProps) {
  const auth = useAuth(client);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: auth.user,
      isLoading: auth.isLoading,
      error: auth.error,
      signIn: auth.signIn,
      signOut: auth.signOut,
      refreshSession: auth.refreshSession,
    }),
    [auth.user, auth.isLoading, auth.error, auth.signIn, auth.signOut, auth.refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access authentication state from AuthProvider.
 *
 * @throws Error if used outside of AuthProvider
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
