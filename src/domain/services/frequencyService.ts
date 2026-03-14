import type { Habit, Completion } from '../models';

const DAYS_IN_WEEK = 7;

/**
 * Determines whether a habit is due on the given date based on its frequency.
 *
 * - daily: always true
 * - weekly_days: true if the date's day of week is in the specified days
 * - weekly_count: always true (the user can complete it on any day)
 */
export function isDueToday(habit: Habit, date: Date): boolean {
  const { frequency } = habit;

  switch (frequency.type) {
    case 'daily':
      return true;
    case 'weekly_days':
      return frequency.days.includes(date.getDay());
    case 'weekly_count':
      return true;
  }
}

/**
 * Represents the weekly progress for a habit.
 */
export type WeeklyProgress = {
  readonly done: number;
  readonly target: number;
};

/**
 * Calculates how many times a habit was completed during a given week
 * and what the target count should be.
 *
 * @param habit - The habit to check
 * @param completions - All completions to filter (may include other habits or other weeks)
 * @param weekStart - The Monday (start) of the week to evaluate
 * @returns The number of completions in the week and the target count
 */
export function getWeeklyProgress(
  habit: Habit,
  completions: readonly Completion[],
  weekStart: Date,
): WeeklyProgress {
  const target = getWeeklyTarget(habit);
  const done = countCompletionsInWeek(habit.id, completions, weekStart);

  return { done, target };
}

function getWeeklyTarget(habit: Habit): number {
  const { frequency } = habit;

  switch (frequency.type) {
    case 'daily':
      return DAYS_IN_WEEK;
    case 'weekly_days':
      return frequency.days.length;
    case 'weekly_count':
      return frequency.count;
  }
}

function countCompletionsInWeek(
  habitId: string,
  completions: readonly Completion[],
  weekStart: Date,
): number {
  const startStr = formatDate(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + DAYS_IN_WEEK - 1);
  const endStr = formatDate(weekEnd);

  return completions.filter(
    (c) =>
      c.habitId === habitId &&
      c.completedDate >= startStr &&
      c.completedDate <= endStr,
  ).length;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
