import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuthContext } from '@/hooks/useAuthContext';
import { RepositoryProvider } from '@/hooks/useRepositories';
import { LoginPage } from '@/ui/pages/LoginPage';
import { AppLayout } from '@/ui/layouts/AppLayout';
import { TodayPage } from '@/ui/pages/TodayPage';
import { HabitsPage } from '@/ui/pages/HabitsPage';
import { NewHabitPage } from '@/ui/pages/NewHabitPage';
import { HabitDetailPage } from '@/ui/pages/HabitDetailPage';
import { createSupabaseClient } from '@/lib/supabase';

const supabaseClient = createSupabaseClient();

/**
 * Renders a loading screen while auth state is being determined.
 */
function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}

/**
 * ProtectedRoute - Redirects to login page if user is not authenticated.
 * Wraps children with RepositoryProvider when authenticated.
 */
function ProtectedRoute({ children }: { readonly children: React.ReactNode }) {
  const { user, isLoading } = useAuthContext();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <RepositoryProvider client={supabaseClient} userId={user.id}>
      {children}
    </RepositoryProvider>
  );
}

/**
 * LoginRoute - Redirects to home if user is already authenticated.
 */
function LoginRoute() {
  const { user, isLoading, error, signIn } = useAuthContext();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <LoginPage onSignIn={signIn} error={error} isLoading={false} />;
}

export function App() {
  return (
    <AuthProvider client={supabaseClient}>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<TodayPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/habits/new" element={<NewHabitPage />} />
          <Route path="/habits/:id" element={<HabitDetailPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
