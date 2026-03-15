/**
 * habitListService - Pure functions for filtering and organizing habit lists.
 *
 * Used by the HabitListScreen to separate active/archived habits
 * and merge them based on the user's display preference.
 */

import type { Habit } from '../models';

/**
 * Returns only active (non-archived) habits.
 */
export function filterActiveHabits(habits: readonly Habit[]): readonly Habit[] {
  return habits.filter((habit) => habit.archivedAt === null);
}

/**
 * Returns only archived habits.
 */
export function filterArchivedHabits(
  habits: readonly Habit[],
): readonly Habit[] {
  return habits.filter((habit) => habit.archivedAt !== null);
}

/**
 * Merges active and archived habit lists based on display preference.
 *
 * When showArchived is true, archived habits are appended after active habits.
 * When false, only active habits are returned.
 */
export function mergeHabitLists(
  activeHabits: readonly Habit[],
  archivedHabits: readonly Habit[],
  showArchived: boolean,
): readonly Habit[] {
  if (!showArchived) {
    return [...activeHabits];
  }
  return [...activeHabits, ...archivedHabits];
}
