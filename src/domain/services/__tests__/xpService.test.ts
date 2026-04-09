import { describe, it, expect } from 'vitest';
import {
  calculateLevel,
  calculateStreakBonuses,
  calculateAllCompleteBonuses,
  calculateTotalXp,
} from '../xpService';
import type { LevelInfo, XpBreakdown } from '../xpService';
import type { Habit } from '../../models/habit';
import type { Completion } from '../../models/completion';

// --- Helpers ---

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    userId: 'user-1',
    name: 'Test Habit',
    frequency: { type: 'daily' },
    color: '#000000',
    createdAt: '2026-01-01T00:00:00Z',
    archivedAt: null,
    reminderTime: null,
    lastNotifiedDate: null,
    ...overrides,
  };
}

function makeCompletion(overrides: Partial<Completion> = {}): Completion {
  return {
    id: 'comp-1',
    userId: 'user-1',
    habitId: 'habit-1',
    completedDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeDateRange(start: string, days: number): string[] {
  const dates: string[] = [];
  const d = new Date(start + 'T00:00:00');
  for (let i = 0; i < days; i++) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// --- calculateLevel ---

describe('calculateLevel', () => {
  it('returns level 1 with 0 XP', () => {
    const result = calculateLevel(0);
    expect(result).toEqual({ level: 1, currentXp: 0, requiredXp: 10 });
  });

  it('returns level 1 with 9 XP (just under threshold)', () => {
    const result = calculateLevel(9);
    expect(result).toEqual({ level: 1, currentXp: 9, requiredXp: 10 });
  });

  it('returns level 2 with exactly 10 XP', () => {
    // Level 1 requires 10 XP (5*1+5), so 10 XP -> level 2 with 0 currentXp
    const result = calculateLevel(10);
    expect(result).toEqual({ level: 2, currentXp: 0, requiredXp: 15 });
  });

  it('returns level 2 with 14 XP', () => {
    const result = calculateLevel(14);
    expect(result).toEqual({ level: 2, currentXp: 4, requiredXp: 15 });
  });

  it('correctly calculates boundary at level 3', () => {
    // Level 1: 10 XP, Level 2: 15 XP -> 25 total to reach level 3
    const result = calculateLevel(25);
    expect(result).toEqual({ level: 3, currentXp: 0, requiredXp: 20 });
  });

  it('caps requiredXp at 255 for level 50+', () => {
    // Compute total XP needed to reach level 50
    let totalToReach50 = 0;
    for (let lvl = 1; lvl < 50; lvl++) {
      totalToReach50 += Math.min(5 * lvl + 5, 255);
    }
    const result = calculateLevel(totalToReach50);
    expect(result.level).toBe(50);
    expect(result.currentXp).toBe(0);
    expect(result.requiredXp).toBe(255);
  });

  it('caps requiredXp at 255 for levels above 50', () => {
    let totalToReach51 = 0;
    for (let lvl = 1; lvl <= 50; lvl++) {
      totalToReach51 += Math.min(5 * lvl + 5, 255);
    }
    const result = calculateLevel(totalToReach51);
    expect(result.level).toBe(51);
    expect(result.requiredXp).toBe(255);
  });

  it('returns Object.freeze result', () => {
    const result = calculateLevel(0);
    expect(Object.isFrozen(result)).toBe(true);
  });
});

// --- calculateStreakBonuses ---

describe('calculateStreakBonuses', () => {
  it('returns 0 for no completions', () => {
    const habits = [makeHabit()];
    const completions = new Map<string, readonly string[]>();
    expect(calculateStreakBonuses(completions, habits)).toBe(0);
  });

  it('returns 0 for less than 7 days streak', () => {
    const habits = [makeHabit()];
    const dates = makeDateRange('2026-01-01', 6);
    const completions = new Map([['habit-1', dates]]);
    expect(calculateStreakBonuses(completions, habits)).toBe(0);
  });

  it('returns 2 XP for exactly 7 days streak', () => {
    const habits = [makeHabit()];
    const dates = makeDateRange('2026-01-01', 7);
    const completions = new Map([['habit-1', dates]]);
    expect(calculateStreakBonuses(completions, habits)).toBe(2);
  });

  it('returns 5 XP for 14 days streak (2+3)', () => {
    const habits = [makeHabit()];
    const dates = makeDateRange('2026-01-01', 14);
    const completions = new Map([['habit-1', dates]]);
    expect(calculateStreakBonuses(completions, habits)).toBe(5);
  });

  it('returns 9 XP for 21 days streak (2+3+4)', () => {
    const habits = [makeHabit()];
    const dates = makeDateRange('2026-01-01', 21);
    const completions = new Map([['habit-1', dates]]);
    expect(calculateStreakBonuses(completions, habits)).toBe(9);
  });

  it('returns 14 XP for 28 days streak (2+3+4+5)', () => {
    const habits = [makeHabit()];
    const dates = makeDateRange('2026-01-01', 28);
    const completions = new Map([['habit-1', dates]]);
    expect(calculateStreakBonuses(completions, habits)).toBe(14);
  });

  it('returns 19 XP for 35 days streak (2+3+4+5+5)', () => {
    const habits = [makeHabit()];
    const dates = makeDateRange('2026-01-01', 35);
    const completions = new Map([['habit-1', dates]]);
    expect(calculateStreakBonuses(completions, habits)).toBe(19);
  });

  it('handles broken streak with restart', () => {
    const habits = [makeHabit()];
    // 7-day streak, then gap, then 7-day streak -> 2 + 2 = 4
    const firstStreak = makeDateRange('2026-01-01', 7);
    const secondStreak = makeDateRange('2026-01-10', 7);
    const completions = new Map([['habit-1', [...firstStreak, ...secondStreak]]]);
    expect(calculateStreakBonuses(completions, habits)).toBe(4);
  });

  it('excludes non-daily habits', () => {
    const weeklyHabit = makeHabit({
      id: 'weekly-1',
      frequency: { type: 'weekly_days', days: [1, 3, 5] },
    });
    const weeklyCountHabit = makeHabit({
      id: 'weekly-count-1',
      frequency: { type: 'weekly_count', count: 3 },
    });
    const dates = makeDateRange('2026-01-01', 14);
    const completions = new Map<string, readonly string[]>([
      ['weekly-1', dates],
      ['weekly-count-1', dates],
    ]);
    expect(calculateStreakBonuses(completions, [weeklyHabit, weeklyCountHabit])).toBe(0);
  });

  it('calculates bonuses for multiple daily habits independently', () => {
    const habit1 = makeHabit({ id: 'h1' });
    const habit2 = makeHabit({ id: 'h2' });
    const dates = makeDateRange('2026-01-01', 7);
    const completions = new Map([
      ['h1', dates],
      ['h2', dates],
    ]);
    // Each habit gets +2 independently
    expect(calculateStreakBonuses(completions, [habit1, habit2])).toBe(4);
  });
});

// --- calculateAllCompleteBonuses ---

describe('calculateAllCompleteBonuses', () => {
  it('returns bonus when all due habits completed on a day', () => {
    const habit1 = makeHabit({ id: 'h1' });
    const habit2 = makeHabit({ id: 'h2' });
    const completions = [
      makeCompletion({ id: 'c1', habitId: 'h1', completedDate: '2026-01-01' }),
      makeCompletion({ id: 'c2', habitId: 'h2', completedDate: '2026-01-01' }),
    ];
    const result = calculateAllCompleteBonuses(
      [habit1, habit2],
      completions,
      '2026-01-01',
      '2026-01-01',
    );
    expect(result).toBe(2); // 1 day * 2 XP
  });

  it('returns 0 when not all due habits completed', () => {
    const habit1 = makeHabit({ id: 'h1' });
    const habit2 = makeHabit({ id: 'h2' });
    const completions = [
      makeCompletion({ id: 'c1', habitId: 'h1', completedDate: '2026-01-01' }),
    ];
    const result = calculateAllCompleteBonuses(
      [habit1, habit2],
      completions,
      '2026-01-01',
      '2026-01-01',
    );
    expect(result).toBe(0);
  });

  it('excludes weekly_count habits from due judgment', () => {
    const dailyHabit = makeHabit({ id: 'h1' });
    const weeklyCountHabit = makeHabit({
      id: 'h2',
      frequency: { type: 'weekly_count', count: 3 },
    });
    // Only daily habit completion needed for all-complete
    const completions = [
      makeCompletion({ id: 'c1', habitId: 'h1', completedDate: '2026-01-01' }),
    ];
    const result = calculateAllCompleteBonuses(
      [dailyHabit, weeklyCountHabit],
      completions,
      '2026-01-01',
      '2026-01-01',
    );
    expect(result).toBe(2);
  });

  it('counts multiple all-complete days', () => {
    const habit1 = makeHabit({ id: 'h1' });
    const completions = [
      makeCompletion({ id: 'c1', habitId: 'h1', completedDate: '2026-01-01' }),
      makeCompletion({ id: 'c2', habitId: 'h1', completedDate: '2026-01-02' }),
      makeCompletion({ id: 'c3', habitId: 'h1', completedDate: '2026-01-03' }),
    ];
    const result = calculateAllCompleteBonuses(
      [habit1],
      completions,
      '2026-01-01',
      '2026-01-03',
    );
    expect(result).toBe(6); // 3 days * 2 XP
  });

  it('includes weekly_days habits in due judgment', () => {
    // 2026-01-05 is a Monday (day 1)
    const weeklyDaysHabit = makeHabit({
      id: 'h1',
      frequency: { type: 'weekly_days', days: [1] }, // Monday only
    });
    const completions = [
      makeCompletion({ id: 'c1', habitId: 'h1', completedDate: '2026-01-05' }),
    ];
    const result = calculateAllCompleteBonuses(
      [weeklyDaysHabit],
      completions,
      '2026-01-05',
      '2026-01-05',
    );
    expect(result).toBe(2);
  });

  it('returns 0 when no habits are due on a day', () => {
    // 2026-01-06 is Tuesday, habit only due on Monday
    const weeklyDaysHabit = makeHabit({
      id: 'h1',
      frequency: { type: 'weekly_days', days: [1] }, // Monday only
    });
    const result = calculateAllCompleteBonuses(
      [weeklyDaysHabit],
      [],
      '2026-01-06',
      '2026-01-06',
    );
    expect(result).toBe(0);
  });
});

// --- calculateTotalXp ---

describe('calculateTotalXp', () => {
  it('combines basic XP, streak bonuses, and all-complete bonuses', () => {
    const habit = makeHabit({ id: 'h1' });
    // 7 consecutive days of completions
    const dates = makeDateRange('2026-01-01', 7);
    const completions = dates.map((date, i) =>
      makeCompletion({ id: `c${i}`, habitId: 'h1', completedDate: date }),
    );
    const result = calculateTotalXp([habit], completions, '2026-01-01', '2026-01-07');
    expect(result.basicXp).toBe(7);
    expect(result.streakBonus).toBe(2);
    expect(result.allCompleteBonus).toBe(14); // 7 days * 2
    expect(result.totalXp).toBe(23); // 7 + 2 + 14
    expect(result.level).toBe(2);
    expect(result.currentXp).toBe(13); // 23 - 10 (Lv.1->2) = 13 remaining
    expect(result.requiredXp).toBe(15); // Lv.2->3 needs 15
  });

  it('returns Object.freeze result', () => {
    const result = calculateTotalXp([], [], '2026-01-01', '2026-01-01');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('returns zero breakdown when no completions', () => {
    const habit = makeHabit({ id: 'h1' });
    const result = calculateTotalXp([habit], [], '2026-01-01', '2026-01-07');
    expect(result.basicXp).toBe(0);
    expect(result.streakBonus).toBe(0);
    expect(result.allCompleteBonus).toBe(0);
    expect(result.totalXp).toBe(0);
    expect(result.level).toBe(1);
  });

  it('counts all completions for basic XP including weekly_count', () => {
    const dailyHabit = makeHabit({ id: 'h1' });
    const weeklyCountHabit = makeHabit({
      id: 'h2',
      frequency: { type: 'weekly_count', count: 3 },
    });
    const completions = [
      makeCompletion({ id: 'c1', habitId: 'h1', completedDate: '2026-01-01' }),
      makeCompletion({ id: 'c2', habitId: 'h2', completedDate: '2026-01-01' }),
    ];
    const result = calculateTotalXp(
      [dailyHabit, weeklyCountHabit],
      completions,
      '2026-01-01',
      '2026-01-01',
    );
    // Basic XP counts ALL completions
    expect(result.basicXp).toBe(2);
    // All-complete bonus only considers daily habit (weekly_count excluded from due check)
    expect(result.allCompleteBonus).toBe(2);
  });
});
