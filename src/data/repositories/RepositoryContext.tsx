/**
 * RepositoryProvider - React component for dependency injection of repositories.
 *
 * Wraps the app tree with a context that provides HabitRepository
 * and CompletionRepository instances, created from a SQLiteDatabase.
 */

import React, { useMemo } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import { HabitRepositoryImpl } from './habitRepository';
import { CompletionRepositoryImpl } from './completionRepository';
import { RepositoryContext } from './repositoryHook';
import type { RepositoryContextValue } from './repositoryHook';

// --- Types ---

type RepositoryProviderProps = {
  readonly db: SQLiteDatabase;
  readonly children: React.ReactNode;
};

// --- Provider ---

export const RepositoryProvider: React.FC<RepositoryProviderProps> = ({
  db,
  children,
}) => {
  const value = useMemo<RepositoryContextValue>(
    () => ({
      habitRepository: new HabitRepositoryImpl(db),
      completionRepository: new CompletionRepositoryImpl(db),
    }),
    [db],
  );

  return (
    <RepositoryContext.Provider value={value}>
      {children}
    </RepositoryContext.Provider>
  );
};
