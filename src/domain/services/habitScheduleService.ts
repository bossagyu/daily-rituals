/**
 * habitScheduleService - ある日付に習慣がどう扱われるかを判定する純粋関数群。
 *
 * 3 つの述語は目的が異なる。特に weekly_count の扱いが isListedOnDate と
 * isCountedAsTargetOnDate で逆になる点に注意すること。
 *   - isListedOnDate: 週 N 回の習慣はどの日でも実施できるので、リストには出す
 *   - isCountedAsTargetOnDate: 週 N 回の習慣は特定日の目標を持たないので、
 *     日次の達成率の分母には数えない
 */

import type { Habit } from '../models/habit';

/**
 * 日付文字列の曜日を返す（0=日曜）。
 * タイムゾーンの影響を受けないよう UTC として解釈する。
 */
function getDayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/**
 * その日付の時点で習慣が存在し、まだアーカイブされていないか。
 */
export function isActiveOnDate(habit: Habit, date: string): boolean {
  if (date < habit.createdAt.slice(0, 10)) return false;

  if (habit.archivedAt !== null && date > habit.archivedAt.slice(0, 10)) {
    return false;
  }

  return true;
}

/**
 * Today 画面のリストに表示すべきか。
 */
export function isListedOnDate(habit: Habit, date: string): boolean {
  switch (habit.frequency.type) {
    case 'daily':
      return true;
    case 'weekly_days':
      return habit.frequency.days.includes(getDayOfWeek(date));
    case 'weekly_count':
      return true;
  }
}

/**
 * その日の達成率の分母（目標数）に数えるべきか。
 */
export function isCountedAsTargetOnDate(habit: Habit, date: string): boolean {
  switch (habit.frequency.type) {
    case 'daily':
      return true;
    case 'weekly_days':
      return habit.frequency.days.includes(getDayOfWeek(date));
    case 'weekly_count':
      return false;
  }
}
