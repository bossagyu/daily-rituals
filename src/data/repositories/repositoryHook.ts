/**
 * Repository context definition and hook.
 *
 * Separated from the Provider component (.tsx) to allow
 * testing in a Node environment without JSX parsing.
 */

import { createContext, useContext } from 'react';
import type { HabitRepository } from './habitRepository';
import type { CompletionRepository } from './completionRepository';

// --- Types ---

export type RepositoryContextValue = {
  readonly habitRepository: HabitRepository;
  readonly completionRepository: CompletionRepository;
};

// --- Context ---

export const RepositoryContext = createContext<RepositoryContextValue | null>(
  null,
);

// --- Hook ---

/**
 * Hook to access repository instances from context.
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
