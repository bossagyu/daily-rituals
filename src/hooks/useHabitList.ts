/**
 * useHabitList - Custom hook for the Habit List screen.
 *
 * Manages both active and archived habits, with a toggle to show/hide archived.
 * Wraps useHabits and adds archived habit loading from the repository.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Habit } from '../domain/models';
import type { HabitRepository } from '../data/repositories';
import { useHabits, type UseHabitsReturn } from './useHabits';
import {
  loadArchivedHabits,
  buildDisplayHabits,
  INITIAL_ARCHIVED_STATE,
  type HabitListArchivedState,
} from './habitListOperations';

export type UseHabitListReturn = {
  readonly displayHabits: readonly Habit[];
  readonly showArchived: boolean;
  readonly toggleShowArchived: () => void;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
} & Pick<UseHabitsReturn, 'createHabit' | 'updateHabit' | 'archiveHabit' | 'unarchiveHabit'>;

export function useHabitList(repository: HabitRepository): UseHabitListReturn {
  const habitsReturn = useHabits(repository);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedState, setArchivedState] =
    useState<HabitListArchivedState>(INITIAL_ARCHIVED_STATE);
  const repositoryRef = useRef(repository);

  useEffect(() => {
    repositoryRef.current = repository;
  }, [repository]);

  const loadArchived = useCallback(async () => {
    setArchivedState((prev) => ({
      ...prev,
      archivedLoading: true,
      archivedError: null,
    }));
    const result = await loadArchivedHabits(repositoryRef.current);
    setArchivedState(result);
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
  }, [habitsReturn.refresh, showArchived, loadArchived]);

  const displayHabits = buildDisplayHabits(
    habitsReturn.habits,
    archivedState.archivedHabits,
    showArchived,
  );

  return {
    displayHabits,
    showArchived,
    toggleShowArchived,
    isLoading: habitsReturn.isLoading || archivedState.archivedLoading,
    error: habitsReturn.error ?? archivedState.archivedError,
    refresh,
    createHabit: habitsReturn.createHabit,
    updateHabit: habitsReturn.updateHabit,
    archiveHabit: habitsReturn.archiveHabit,
    unarchiveHabit: habitsReturn.unarchiveHabit,
  };
}
