/**
 * useHabitList - Custom hook for the Habit List screen.
 *
 * Manages both active and archived habits, with a toggle to show/hide archived.
 * Wraps useHabits and adds archived habit loading from the repository.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Habit } from '../domain/models';
import type { HabitRepository } from '../data/repositories';
import { mergeHabitLists } from '../domain/services/habitListService';
import { useHabits, type UseHabitsReturn } from './useHabits';

export type UseHabitListReturn = {
  readonly displayHabits: readonly Habit[];
  readonly showArchived: boolean;
  readonly toggleShowArchived: () => void;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
} & Pick<UseHabitsReturn, 'createHabit' | 'updateHabit' | 'archiveHabit'>;

const LOAD_ARCHIVED_ERROR = 'Failed to load archived habits';

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function useHabitList(repository: HabitRepository): UseHabitListReturn {
  const habitsReturn = useHabits(repository);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedHabits, setArchivedHabits] = useState<readonly Habit[]>([]);
  const [archivedError, setArchivedError] = useState<string | null>(null);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const repositoryRef = useRef(repository);

  const loadArchived = useCallback(async () => {
    setArchivedLoading(true);
    setArchivedError(null);
    try {
      const habits = await repositoryRef.current.findArchived();
      setArchivedHabits(habits);
    } catch (error: unknown) {
      setArchivedError(extractErrorMessage(error, LOAD_ARCHIVED_ERROR));
    } finally {
      setArchivedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showArchived) {
      void loadArchived();
    }
  }, [showArchived, loadArchived]);

  const toggleShowArchived = useCallback(() => {
    setShowArchived((prev) => !prev);
  }, []);

  const refresh = useCallback(async () => {
    await habitsReturn.refresh();
    if (showArchived) {
      await loadArchived();
    }
  }, [habitsReturn, showArchived, loadArchived]);

  const displayHabits = mergeHabitLists(
    [...habitsReturn.habits],
    [...archivedHabits],
    showArchived,
  );

  return {
    displayHabits,
    showArchived,
    toggleShowArchived,
    isLoading: habitsReturn.isLoading || archivedLoading,
    error: habitsReturn.error ?? archivedError,
    refresh,
    createHabit: habitsReturn.createHabit,
    updateHabit: habitsReturn.updateHabit,
    archiveHabit: habitsReturn.archiveHabit,
  };
}
