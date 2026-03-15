/**
 * frequencyDisplayService - Formats Frequency objects into human-readable strings.
 *
 * Pure functions with no external dependencies, suitable for display in UI.
 */

import type { Frequency } from '../models';

const DAY_NAMES: readonly string[] = ['日', '月', '火', '水', '木', '金', '土'];

const DAY_SEPARATOR = '・';

/**
 * Formats a Frequency into a full display string.
 *
 * - daily -> "毎日"
 * - weekly_days [1,3,5] -> "月・水・金"
 * - weekly_count 3 -> "週3回"
 */
export function formatFrequency(frequency: Frequency): string {
  switch (frequency.type) {
    case 'daily':
      return '毎日';
    case 'weekly_days': {
      const sortedDays = [...frequency.days].sort((a, b) => a - b);
      return sortedDays.map((day) => DAY_NAMES[day]).join(DAY_SEPARATOR);
    }
    case 'weekly_count':
      return `週${frequency.count}回`;
  }
}

/**
 * Formats a Frequency into a short display string (no separators for days).
 *
 * - daily -> "毎日"
 * - weekly_days [1,3,5] -> "月水金"
 * - weekly_count 3 -> "週3回"
 */
export function formatFrequencyShort(frequency: Frequency): string {
  switch (frequency.type) {
    case 'daily':
      return '毎日';
    case 'weekly_days': {
      const sortedDays = [...frequency.days].sort((a, b) => a - b);
      return sortedDays.map((day) => DAY_NAMES[day]).join('');
    }
    case 'weekly_count':
      return `週${frequency.count}回`;
  }
}
