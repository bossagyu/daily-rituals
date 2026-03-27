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

export function AppLayout() {
  const { user, signOut } = useAuthContext();

  if (!user) {
    return null;
  }

  const handleSignOut = () => {
    void signOut();
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <AppHeader user={user} onSignOut={signOut} />
      <div className="flex min-h-0 flex-1">
        <SideNavigation onSignOut={handleSignOut} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <BottomNavigation onSignOut={handleSignOut} />
    </div>
  );
}
