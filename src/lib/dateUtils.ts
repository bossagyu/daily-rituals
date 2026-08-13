/**
 * Date utility functions for date parsing, validation, and formatting.
 *
 * 日付そのものの計算は timeService に委譲し、ここでは「ブラウザのタイムゾーンを
 * 使う」というアプリ固有の判断と、表示用の整形だけを担う。
 */

import {
  getLocalDate,
  getBrowserTimeZone,
  addDays as addDaysToDate,
} from '@/domain/services/timeService';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'] as const;

/**
 * Get today's date as YYYY-MM-DD string, in the browser's timezone.
 */
export function getTodayString(): string {
  return getLocalDate(new Date(), getBrowserTimeZone());
}

/**
 * Parse and validate a date query parameter.
 * Returns today's date string if the parameter is null, empty, or invalid.
 */
export function parseDateParam(param: string | null): string {
  if (!param) {
    return getTodayString();
  }

  if (!DATE_REGEX.test(param)) {
    return getTodayString();
  }

  const parsed = new Date(`${param}T00:00:00`);
  if (isNaN(parsed.getTime())) {
    return getTodayString();
  }

  // Verify the date components match (catches invalid dates like 2026-02-30)
  const [year, month, day] = param.split('-').map(Number);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return getTodayString();
  }

  return param;
}

/**
 * Format a date string for display in Japanese format.
 * Example: "2026年3月20日 (金)"
 */
export function formatDisplayDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = DAY_NAMES[date.getDay()];

  return `${year}年${month}月${day}日 (${dayOfWeek})`;
}

/**
 * Add days to a date string and return a new YYYY-MM-DD string.
 */
export function addDays(dateStr: string, days: number): string {
  return addDaysToDate(dateStr, days);
}

/**
 * Check if a date string represents today's date.
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getTodayString();
}

/**
 * Check if a date string is in the future (strictly after today).
 */
export function isFutureDate(dateStr: string): boolean {
  return dateStr > getTodayString();
}
