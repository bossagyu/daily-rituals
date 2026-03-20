/**
 * useAuth - Custom React hook for authentication state management.
 *
 * Provides user state, loading/error state, and sign-in/sign-out functions.
 * Uses AuthManager for testable business logic separation.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  signInWithGoogle,
  signOut as authSignOut,
  getCurrentUser,
  onAuthStateChange,
} from '@/lib/auth';
import { toUserFriendlyAuthError } from '@/lib/authErrors';

export type AuthState = {
  readonly user: User | null;
  readonly isLoading: boolean;
  readonly error: string | null;
};

export const INITIAL_AUTH_STATE: AuthState = {
  user: null,
  isLoading: true,
  error: null,
};

/**
 * Manages authentication state and operations.
 * Extracted from the hook for testability.
 */
export class AuthManager {
  private readonly client: SupabaseClient;
  private readonly onStateChange: (state: AuthState) => void;
  private state: AuthState = INITIAL_AUTH_STATE;
  private unsubscribe: (() => void) | null = null;

  constructor(
    client: SupabaseClient,
    onStateChange: (state: AuthState) => void
  ) {
    this.client = client;
    this.onStateChange = onStateChange;
  }

  private updateState(partial: Partial<AuthState>): void {
    this.state = { ...this.state, ...partial };
    this.onStateChange(this.state);
  }

  async initialize(): Promise<void> {
    // Register listener first to prevent race condition where
    // component unmounts before getCurrentUser completes
    this.unsubscribe = onAuthStateChange(this.client, (user) => {
      this.updateState({ user, error: null });
    });

    try {
      const user = await getCurrentUser(this.client);
      this.updateState({ user, isLoading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error
          ? toUserFriendlyAuthError(error.message)
          : '認証に失敗しました。もう一度お試しください。';
      this.updateState({ user: null, isLoading: false, error: message });
    }
  }

  async signIn(): Promise<void> {
    try {
      this.updateState({ error: null });
      await signInWithGoogle(this.client);
    } catch (error) {
      const message =
        error instanceof Error
          ? toUserFriendlyAuthError(error.message)
          : '認証に失敗しました。もう一度お試しください。';
      this.updateState({ error: message });
    }
  }

  async refreshSession(): Promise<boolean> {
    try {
      const { error } = await this.client.auth.refreshSession();
      return !error;
    } catch {
      return false;
    }
  }

  async signOut(): Promise<void> {
    try {
      this.updateState({ error: null });
      await authSignOut(this.client);
      this.updateState({ user: null });
    } catch (error) {
      const message =
        error instanceof Error
          ? toUserFriendlyAuthError(error.message)
          : '認証に失敗しました。もう一度お試しください。';
      this.updateState({ error: message });
    }
  }

  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

export type UseAuthReturn = {
  readonly user: User | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly signIn: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly refreshSession: () => Promise<boolean>;
};

/**
 * React hook providing authentication state and operations.
 *
 * @param client - Supabase client instance
 * @returns Auth state and sign-in/sign-out functions
 */
export function useAuth(client: SupabaseClient): UseAuthReturn {
  const [state, setState] = useState<AuthState>(INITIAL_AUTH_STATE);
  const managerRef = useRef<AuthManager | null>(null);

  if (managerRef.current === null) {
    managerRef.current = new AuthManager(client, (newState) => {
      setState(newState);
    });
  }

  const manager = managerRef.current;

  useEffect(() => {
    void manager.initialize();

    return () => {
      manager.dispose();
    };
  }, [manager]);

  const signIn = useCallback(() => manager.signIn(), [manager]);
  const signOut = useCallback(() => manager.signOut(), [manager]);
  const refreshSession = useCallback(() => manager.refreshSession(), [manager]);

  return {
    user: state.user,
    isLoading: state.isLoading,
    error: state.error,
    signIn,
    signOut,
    refreshSession,
  };
}
