/**
 * statsService - Pure functions for weekly/monthly stats aggregation.
 *
 * Used by WeeklyMonthlyStats UI component to compute completion rates over
 * arbitrary date ranges using DayAchievement records produced by calendarService.
 */

import type { DayAchievement } from './calendarService';
import { addDays } from './calendarService';

export type DateRange = {
  readonly start: string;
  readonly end: string;
};

export type AchievementSummary = {
  readonly completedCount: number;
  readonly targetCount: number;
  readonly rate: number; // 0..1
};

const padTwo = (n: number): string => String(n).padStart(2, '0');

const toDateString = (year: number, monthIndex0: number, day: number): string =>
  `${year}-${padTwo(monthIndex0 + 1)}-${padTwo(day)}`;

/**
 * Returns the Sunday-to-Saturday week range that contains the given date.
 *
 * Aligned with the calendar grid which is also Sunday-first.
 */
export function getWeekRange(date: string): DateRange {
  const d = new Date(date + 'T00:00:00');
  const dayOfWeek = d.getDay(); // 0 = Sunday
  const start = addDays(date, -dayOfWeek);
  const end = addDays(start, 6);
  return Object.freeze({ start, end });
}

/**
 * Returns the first-to-last-day range of the month that contains the given date.
 */
export function getMonthRange(date: string): DateRange {
  const d = new Date(date + 'T00:00:00');
  const year = d.getFullYear();
  const monthIndex0 = d.getMonth();
  const start = toDateString(year, monthIndex0, 1);
  // Day 0 of next month = last day of current month
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
  const end = toDateString(year, monthIndex0, lastDay);
  return Object.freeze({ start, end });
}

/**
 * Aggregates DayAchievement records into a single completion summary.
 *
 * Only days within [rangeStart, min(rangeEnd, today)] are counted.
 * Future days are excluded so users are not penalized for incomplete future dates.
 */
export function aggregateAchievements(
  achievements: readonly DayAchievement[],
  rangeStart: string,
  rangeEnd: string,
  today: string,
): AchievementSummary {
  const effectiveEnd = rangeEnd < today ? rangeEnd : today;

  let completedCount = 0;
  let targetCount = 0;

  for (const a of achievements) {
    if (a.date < rangeStart) continue;
    if (a.date > effectiveEnd) continue;
    completedCount += a.completedCount;
    targetCount += a.targetCount;
  }

  const rawRate = targetCount > 0 ? completedCount / targetCount : 0;
  const rate = Math.min(Math.max(rawRate, 0), 1);

  return Object.freeze({ completedCount, targetCount, rate });
}
