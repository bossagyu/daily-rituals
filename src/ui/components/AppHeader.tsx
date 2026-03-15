import React from 'react';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';

type AppHeaderProps = {
  readonly user: User;
  readonly onSignOut: () => Promise<void>;
};

/**
 * Application header displaying user info and sign-out button.
 * Shown on all authenticated pages.
 */
export function AppHeader({ user, onSignOut }: AppHeaderProps) {
  const handleSignOut = () => {
    void onSignOut();
  };

  const displayName =
    user.user_metadata?.full_name ?? user.email ?? 'User';

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
      <h1 className="text-lg font-semibold text-foreground">Daily Rituals</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{displayName}</span>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          ログアウト
        </Button>
      </div>
    </header>
  );
}
