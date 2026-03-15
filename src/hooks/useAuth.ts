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
    try {
      const user = await getCurrentUser(this.client);
      this.updateState({ user, isLoading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to initialize auth';
      this.updateState({ user: null, isLoading: false, error: message });
    }

    this.unsubscribe = onAuthStateChange(this.client, (user) => {
      this.updateState({ user, error: null });
    });
  }

  async signIn(): Promise<void> {
    try {
      this.updateState({ error: null });
      await signInWithGoogle(this.client);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to sign in';
      this.updateState({ error: message });
    }
  }

  async signOut(): Promise<void> {
    try {
      this.updateState({ error: null });
      await authSignOut(this.client);
      this.updateState({ user: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to sign out';
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

  return {
    user: state.user,
    isLoading: state.isLoading,
    error: state.error,
    signIn,
    signOut,
  };
}
