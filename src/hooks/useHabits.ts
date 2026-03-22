/**
 * useHabits - Custom React hook for habit CRUD operations.
 *
 * Thin React wrapper around HabitsManager.
 * Provides habit list, loading/error state, and mutation functions.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { CreateHabitInput } from '../domain/models';
import type { HabitRepository, UpdateHabitInput } from '../data/repositories';
import { HabitsManager, INITIAL_STATE, type HabitsState } from './habitsManager';

// Re-export for convenience
export { HabitsManager, type HabitsState } from './habitsManager';

export type UseHabitsReturn = {
  readonly habits: HabitsState['habits'];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly createHabit: (input: CreateHabitInput) => Promise<void>;
  readonly updateHabit: (id: string, input: UpdateHabitInput) => Promise<void>;
  readonly archiveHabit: (id: string) => Promise<void>;
  readonly deleteHabit: (id: string) => Promise<void>;
  readonly refresh: () => Promise<void>;
};

/**
 * React hook providing habit CRUD operations and state.
 *
 * @param repository - HabitRepository instance (injected for testability)
 * @returns Habit state and mutation functions
 */
export function useHabits(repository: HabitRepository): UseHabitsReturn {
  const [state, setState] = useState<HabitsState>(INITIAL_STATE);
  const managerRef = useRef<HabitsManager | null>(null);

  if (managerRef.current === null) {
    managerRef.current = new HabitsManager(repository, (newState) => {
      setState(newState);
    });
  }

  const manager = managerRef.current;

  useEffect(() => {
    void manager.loadHabits();
  }, [manager]);

  const createHabit = useCallback(
    (input: CreateHabitInput) => manager.createHabit(input),
    [manager]
  );

  const updateHabit = useCallback(
    (id: string, input: UpdateHabitInput) => manager.updateHabit(id, input),
    [manager]
  );

  const archiveHabit = useCallback(
    (id: string) => manager.archiveHabit(id),
    [manager]
  );

  const deleteHabit = useCallback(
    (id: string) => manager.deleteHabit(id),
    [manager]
  );

  const refresh = useCallback(() => manager.refresh(), [manager]);

  return {
    habits: state.habits,
    isLoading: state.isLoading,
    error: state.error,
    createHabit,
    updateHabit,
    archiveHabit,
    deleteHabit,
    refresh,
  };
}
