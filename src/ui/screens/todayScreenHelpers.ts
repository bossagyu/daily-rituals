/**
 * Pure helper functions for TodayScreen.
 *
 * Extracted for testability without React/React Native dependencies.
 */

import type { Habit } from '../../domain/models';
import { isDueToday } from '../../domain/services/frequencyService';

/**
 * Filters habits to only include those due on the given date.
 * Also excludes archived habits.
 */
export function filterTodayHabits(
  habits: readonly Habit[],
  date: Date,
): readonly Habit[] {
  return habits.filter(
    (habit) => habit.archivedAt === null && isDueToday(habit, date),
  );
}

/**
 * Formats a Date object as a YYYY-MM-DD string using local time.
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Completion statistics for today's habits.
 */
export type CompletionStats = {
  readonly total: number;
  readonly completed: number;
  readonly allCompleted: boolean;
};

/**
 * Calculates completion statistics for a list of habits on a given date.
 */
export function getCompletionStats(
  habits: readonly Habit[],
  isCompleted: (habitId: string, date: string) => boolean,
  dateString: string,
): CompletionStats {
  const total = habits.length;
  const completed = habits.filter((habit) =>
    isCompleted(habit.id, dateString),
  ).length;
  return {
    total,
    completed,
    allCompleted: total > 0 && completed === total,
  };
}

/**
 * Formats a frequency description for display.
 */
export function formatFrequencyLabel(habit: Habit): string {
  const { frequency } = habit;

  switch (frequency.type) {
    case 'daily':
      return '毎日';
    case 'weekly_days': {
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const days = frequency.days
        .slice()
        .sort((a, b) => a - b)
        .map((d) => dayNames[d])
        .join('・');
      return `毎週 ${days}`;
    }
    case 'weekly_count':
      return `週${frequency.count}回`;
  }
}
