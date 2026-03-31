/**
 * SettingsPage - App settings page with logout action and version display.
 *
 * Uses useAuthContext to obtain signOut. Logout requires a window.confirm
 * confirmation before proceeding.
 */

import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuthContext } from '@/hooks/useAuthContext';

export function SettingsPage() {
  const { signOut } = useAuthContext();

  const handleSignOut = () => {
    if (window.confirm('ログアウトしますか？')) {
      void signOut();
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-foreground">設定</h1>

      <div className="divide-y divide-border rounded-lg border border-border">
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          onClick={handleSignOut}
        >
          <LogOut className="size-5 text-muted-foreground" />
          <span>ログアウト</span>
        </button>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Daily Rituals v1.0.0
      </p>
    </div>
  );
}
