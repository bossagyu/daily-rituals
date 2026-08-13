/**
 * AppLayout - Main application layout with responsive navigation.
 *
 * Combines AppHeader, side/bottom navigation, and the main content area.
 * Uses React Router's Outlet to render child routes.
 *
 * Layout structure:
 * - Desktop (md+): Header + [SideNav | Main Content]
 * - Mobile (<md): Header + Main Content + BottomNav
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from '@/ui/components/AppHeader';
import {
  SideNavigation,
  BottomNavigation,
} from '@/ui/components/NavigationBar';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useRepositories } from '@/hooks/useRepositories';
import { usePushSubscriptionReconcile } from '@/hooks/usePushSubscriptionReconcile';
import { useTimezoneSync } from '@/hooks/useTimezoneSync';

export function AppLayout() {
  const { user } = useAuthContext();
  const { pushSubscriptionRepository, profileRepository } = useRepositories();

  // Reconcile the push subscription once per authenticated session,
  // regardless of which route the user lands on first. AppLayout wraps
  // every protected route, so this recovers from iOS silently dropping the
  // subscription without requiring the user to visit a specific page.
  usePushSubscriptionReconcile(pushSubscriptionRepository);

  // Sync the browser's timezone to profiles once per authenticated session.
  // Reminders are judged in the user's local timezone, so travel or a move
  // must be picked up automatically rather than requiring a manual fix.
  useTimezoneSync(profileRepository);

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <SideNavigation />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
}
