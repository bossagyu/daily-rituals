/**
 * Pure functions for streak and weekly progress calculations.
 *
 * These functions contain the business logic used by useStreak hook,
 * extracted for testability without React testing dependencies.
 */

import type { Habit, Completion, Streak } from '../domain/models';
import { calculateStreak } from '../domain/services/streakService';
import {
  getWeeklyProgress as domainGetWeeklyProgress,
  type WeeklyProgress,
} from '../domain/services/frequencyService';

export { extractErrorMessage } from './utils';

// --- Constants ---

const MS_PER_DAY = 86400000;
const MONDAY_OFFSET_SUNDAY = -6;

/**
 * Compute streak for a habit given its completions and today's date.
 * Delegates to domain StreakService.
 */
export function computeStreakForHabit(
  habit: Habit,
  completions: readonly Completion[],
  today: string,
): Streak {
  return calculateStreak(habit, completions, today);
}

/**
 * Get the Monday (week start) for a given YYYY-MM-DD date string.
 * Uses local date interpretation (not UTC) to match FrequencyService behavior.
 */
export function getWeekStartDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const offsetToMonday = dayOfWeek === 0 ? MONDAY_OFFSET_SUNDAY : 1 - dayOfWeek;
  return new Date(date.getTime() + offsetToMonday * MS_PER_DAY);
}

/**
 * Compute weekly progress for a habit given its completions and today's date.
 * Delegates to domain FrequencyService.
 */
export function computeWeeklyProgressForHabit(
  habit: Habit,
  completions: readonly Completion[],
  today: string,
): WeeklyProgress {
  const weekStart = getWeekStartDate(today);
  return domainGetWeeklyProgress(habit, completions, weekStart);
}

/**
 * Updates a completions cache immutably with new completions for a habit.
 */
export function updateCompletionsCache(
  cache: ReadonlyMap<string, readonly Completion[]>,
  habitId: string,
  completions: readonly Completion[],
): ReadonlyMap<string, readonly Completion[]> {
  const newCache = new Map(cache);
  newCache.set(habitId, completions);
  return newCache;
}

