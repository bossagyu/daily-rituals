/**
 * RepositoryProvider & useRepositories - Provides repository instances via React Context.
 *
 * Creates Supabase-backed repository instances scoped to the authenticated user
 * and makes them available throughout the component tree.
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HabitRepository } from '@/data/repositories/habitRepository';
import type { CompletionRepository } from '@/data/repositories/completionRepository';
import { createSupabaseHabitRepository } from '@/data/repositories/supabaseHabitRepository';
import { createSupabaseCompletionRepository } from '@/data/repositories/supabaseCompletionRepository';

export type RepositoryContextValue = {
  readonly habitRepository: HabitRepository;
  readonly completionRepository: CompletionRepository;
};

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

type RepositoryProviderProps = {
  readonly client: SupabaseClient;
  readonly userId: string;
  readonly children: React.ReactNode;
};

/**
 * Provides repository instances to the component tree.
 * Repositories are memoized and recreated only when client or userId changes.
 */
export function RepositoryProvider({
  client,
  userId,
  children,
}: RepositoryProviderProps) {
  const value = useMemo<RepositoryContextValue>(
    () => ({
      habitRepository: createSupabaseHabitRepository(client, userId),
      completionRepository: createSupabaseCompletionRepository(client, userId),
    }),
    [client, userId],
  );

  return (
    <RepositoryContext.Provider value={value}>
      {children}
    </RepositoryContext.Provider>
  );
}

/**
 * Hook to access repository instances from RepositoryProvider.
 *
 * @throws Error if used outside of RepositoryProvider
 */
export function useRepositories(): RepositoryContextValue {
  const context = useContext(RepositoryContext);
  if (context === null) {
    throw new Error(
      'useRepositories must be used within a RepositoryProvider',
    );
  }
  return context;
}
