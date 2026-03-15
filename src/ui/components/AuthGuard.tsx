import React from 'react';
import type { User } from '@supabase/supabase-js';
import { LoginPage } from '@/ui/pages/LoginPage';

type AuthGuardProps = {
  readonly user: User | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onSignIn: () => Promise<void>;
  readonly children: React.ReactNode;
};

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}

/**
 * AuthGuard wraps content that requires authentication.
 * Shows a loading screen while checking auth state,
 * redirects to LoginPage when not authenticated,
 * and renders children when authenticated.
 */
export function AuthGuard({
  user,
  isLoading,
  error,
  onSignIn,
  children,
}: AuthGuardProps) {
  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginPage onSignIn={onSignIn} error={error} isLoading={false} />;
  }

  return <>{children}</>;
}
