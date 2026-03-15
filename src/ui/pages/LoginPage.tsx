import React from 'react';
import { Button } from '@/components/ui/button';

type LoginPageProps = {
  readonly onSignIn: () => Promise<void>;
  readonly error: string | null;
  readonly isLoading: boolean;
};

export function LoginPage({ onSignIn, error, isLoading }: LoginPageProps) {
  const handleSignIn = () => {
    void onSignIn();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-8 px-4">
        <div className="text-center">
          <h1 className="mb-2 text-4xl font-bold text-foreground">
            Daily Rituals
          </h1>
          <p className="text-muted-foreground">
            Build better habits, one day at a time.
          </p>
        </div>

        <Button
          onClick={handleSignIn}
          disabled={isLoading}
          size="lg"
          className="w-full"
        >
          {isLoading ? 'Loading...' : 'Sign in with Google'}
        </Button>

        {error && (
          <p className="text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
