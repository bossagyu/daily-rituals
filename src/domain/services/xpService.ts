import type { Habit } from '@/domain/models/habit';
import type { Completion } from '@/domain/models/completion';
import { isHabitDueOnDate, isHabitActiveOnDate, addDays } from './calendarService';

// --- Types ---

export type LevelInfo = {
  readonly level: number;
  readonly currentXp: number;
  readonly requiredXp: number;
};

export type XpBreakdown = {
  readonly basicXp: number;
  readonly streakBonus: number;
  readonly allCompleteBonus: number;
  readonly totalXp: number;
};

// --- Constants ---

const BASE_XP = 5;
const XP_PER_LEVEL_INCREMENT = 5;
const MAX_REQUIRED_XP = 255;
const LEVEL_CAP_START = 50;
const DAYS_PER_WEEK = 7;
const ALL_COMPLETE_BONUS_PER_DAY = 2;

const STREAK_WEEK_BONUSES: readonly number[] = [2, 3, 4, 5];
const STREAK_BONUS_AFTER_WEEK_4 = 5;

// --- Functions ---

function getRequiredXpForLevel(level: number): number {
  return Math.min(XP_PER_LEVEL_INCREMENT * level + BASE_XP, MAX_REQUIRED_XP);
}

export function calculateLevel(totalXp: number): LevelInfo {
  let level = 1;
  let remaining = totalXp;

  while (remaining >= 0) {
    const required = getRequiredXpForLevel(level);
    if (remaining < required) {
      return Object.freeze({
        level,
        currentXp: remaining,
        requiredXp: required,
      });
    }
    remaining -= required;
    level++;
  }

  // Should not reach here, but satisfy TypeScript
  return Object.freeze({
    level,
    currentXp: 0,
    requiredXp: getRequiredXpForLevel(level),
  });
}

function isConsecutiveDay(dateA: string, dateB: string): boolean {
  return addDays(dateA, 1) === dateB;
}

function calculateBonusForStreak(streakLength: number): number {
  let bonus = 0;
  const fullWeeks = Math.floor(streakLength / DAYS_PER_WEEK);

  for (let week = 0; week < fullWeeks; week++) {
    if (week < STREAK_WEEK_BONUSES.length) {
      bonus += STREAK_WEEK_BONUSES[week];
    } else {
      bonus += STREAK_BONUS_AFTER_WEEK_4;
    }
  }

  return bonus;
}

export function calculateStreakBonuses(
  completionsByHabitId: ReadonlyMap<string, readonly string[]>,
  habits: readonly Habit[],
): number {
  let totalBonus = 0;

  const dailyHabits = habits.filter((h) => h.frequency.type === 'daily');

  for (const habit of dailyHabits) {
    const dates = completionsByHabitId.get(habit.id);
    if (!dates || dates.length === 0) continue;

    const sorted = [...dates].sort();

    // Find all continuous streak segments
    let segmentStart = 0;

    for (let i = 1; i <= sorted.length; i++) {
      const isEnd = i === sorted.length || !isConsecutiveDay(sorted[i - 1], sorted[i]);

      if (isEnd) {
        const segmentLength = i - segmentStart;
        totalBonus += calculateBonusForStreak(segmentLength);
        segmentStart = i;
      }
    }
  }

  return totalBonus;
}

export function calculateAllCompleteBonuses(
  habits: readonly Habit[],
  completions: readonly Completion[],
  startDate: string,
  endDate: string,
): number {
  const completionsByDate = new Map<string, Set<string>>();
  for (const c of completions) {
    const existing = completionsByDate.get(c.completedDate) ?? new Set();
    completionsByDate.set(c.completedDate, new Set([...existing, c.habitId]));
  }

  let allCompleteDays = 0;
  let current = startDate;

  while (current <= endDate) {
    const completedIds = completionsByDate.get(current) ?? new Set<string>();

    // Find habits that are due on this date (daily + weekly_days only)
    const dueHabits = habits.filter(
      (h) => isHabitActiveOnDate(h, current) && isHabitDueOnDate(h, current),
    );

    if (dueHabits.length > 0) {
      const allCompleted = dueHabits.every((h) => completedIds.has(h.id));
      if (allCompleted) {
        allCompleteDays++;
      }
    }

    current = addDays(current, 1);
  }

  return allCompleteDays * ALL_COMPLETE_BONUS_PER_DAY;
}

export function calculateTotalXp(
  habits: readonly Habit[],
  completions: readonly Completion[],
  startDate: string,
  endDate: string,
): XpBreakdown {
  const basicXp = completions.length;

  // Build completions map by habit ID for streak calculation
  const completionsByHabitId = new Map<string, string[]>();
  for (const c of completions) {
    const existing = completionsByHabitId.get(c.habitId) ?? [];
    completionsByHabitId.set(c.habitId, [...existing, c.completedDate]);
  }

  const streakBonus = calculateStreakBonuses(completionsByHabitId, habits);
  const allCompleteBonus = calculateAllCompleteBonuses(habits, completions, startDate, endDate);

  return Object.freeze({
    basicXp,
    streakBonus,
    allCompleteBonus,
    totalXp: basicXp + streakBonus + allCompleteBonus,
  });
}
