/**
 * useStreak hook - provides streak and weekly progress calculations for habits.
 *
 * Uses StreakService and FrequencyService from the domain layer.
 * Caches completions per habit for efficient recalculation.
 * Business logic is in streakOperations.ts for testability.
 */

import { useCallback, useRef, useState } from 'react';
import type { CompletionRepository } from '../data/repositories';
import type { Habit, Completion, Streak } from '../domain/models';
import type { WeeklyProgress } from '../domain/services/frequencyService';
import {
  computeStreakForHabit,
  computeWeeklyProgressForHabit,
  updateCompletionsCache,
  extractErrorMessage,
} from './streakOperations';

// --- State type ---

type StreakState = {
  readonly completionsCache: ReadonlyMap<string, readonly Completion[]>;
  readonly loading: boolean;
  readonly error: string | null;
};

const INITIAL_STATE: StreakState = {
  completionsCache: new Map(),
  loading: false,
  error: null,
};

// --- React Hook ---

export type UseStreakResult = {
  readonly loading: boolean;
  readonly error: string | null;
  readonly getStreak: (habit: Habit) => Streak;
  readonly getWeeklyProgress: (habit: Habit) => WeeklyProgress;
  readonly refreshStreak: (habitId: string) => Promise<void>;
};

const EMPTY_STREAK: Streak = Object.freeze({ current: 0, longest: 0 });
const EMPTY_PROGRESS: WeeklyProgress = Object.freeze({ done: 0, target: 0 });

export function useStreak(
  repository: CompletionRepository,
  today: string,
): UseStreakResult {
  const [state, setState] = useState<StreakState>(INITIAL_STATE);
  const cacheRef = useRef<Map<string, readonly Completion[]>>(new Map());

  const fetchCompletions = useCallback(
    async (habitId: string): Promise<readonly Completion[]> => {
      const completions = await repository.findByHabitId(habitId);
      const newCache = new Map(cacheRef.current);
      newCache.set(habitId, completions);
      cacheRef.current = newCache;
      setState((prev) => ({
        ...prev,
        completionsCache: newCache,
        loading: false,
        error: null,
      }));
      return completions;
    },
    [repository],
  );

  const ensureCompletions = useCallback(
    async (habitId: string): Promise<readonly Completion[]> => {
      const cached = cacheRef.current.get(habitId);
      if (cached !== undefined) {
        return cached;
      }
      setState((prev) => ({ ...prev, loading: true }));
      try {
        return await fetchCompletions(habitId);
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: extractErrorMessage(err),
        }));
        return [];
      }
    },
    [fetchCompletions],
  );

  const getStreak = useCallback(
    (habit: Habit): Streak => {
      const cached = cacheRef.current.get(habit.id);
      if (cached === undefined) {
        ensureCompletions(habit.id);
        return EMPTY_STREAK;
      }
      return computeStreakForHabit(habit, cached, today);
    },
    [today, ensureCompletions],
  );

  const getWeeklyProgressFn = useCallback(
    (habit: Habit): WeeklyProgress => {
      const cached = cacheRef.current.get(habit.id);
      if (cached === undefined) {
        ensureCompletions(habit.id);
        return EMPTY_PROGRESS;
      }
      return computeWeeklyProgressForHabit(habit, cached, today);
    },
    [today, ensureCompletions],
  );

  const refreshStreak = useCallback(
    async (habitId: string): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        await fetchCompletions(habitId);
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: extractErrorMessage(err),
        }));
      }
    },
    [fetchCompletions],
  );

  return {
    loading: state.loading,
    error: state.error,
    getStreak,
    getWeeklyProgress: getWeeklyProgressFn,
    refreshStreak,
  };
}
