import type { Habit } from '../../../domain/models';
import {
  filterTodayHabits,
  formatDateString,
  getCompletionStats,
  formatFrequencyLabel,
} from '../todayScreenHelpers';

// --- Test fixtures ---

const createHabit = (overrides: Partial<Habit> = {}): Habit => ({
  id: 'habit-1',
  name: 'Test Habit',
  frequency: { type: 'daily' },
  color: '#FF0000',
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
  ...overrides,
});

// --- filterTodayHabits ---

describe('filterTodayHabits', () => {
  it('includes daily habits', () => {
    const habits = [createHabit({ frequency: { type: 'daily' } })];
    const result = filterTodayHabits(habits, new Date(2026, 2, 15)); // Sunday
    expect(result).toHaveLength(1);
  });

  it('includes weekly_days habits when today matches', () => {
    // 2026-03-15 is Sunday (day 0)
    const habits = [
      createHabit({ frequency: { type: 'weekly_days', days: [0, 3] } }),
    ];
    const result = filterTodayHabits(habits, new Date(2026, 2, 15));
    expect(result).toHaveLength(1);
  });

  it('excludes weekly_days habits when today does not match', () => {
    // 2026-03-15 is Sunday (day 0)
    const habits = [
      createHabit({ frequency: { type: 'weekly_days', days: [1, 3] } }),
    ];
    const result = filterTodayHabits(habits, new Date(2026, 2, 15));
    expect(result).toHaveLength(0);
  });

  it('includes weekly_count habits (always due)', () => {
    const habits = [
      createHabit({ frequency: { type: 'weekly_count', count: 3 } }),
    ];
    const result = filterTodayHabits(habits, new Date(2026, 2, 15));
    expect(result).toHaveLength(1);
  });

  it('excludes archived habits', () => {
    const habits = [
      createHabit({ archivedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    const result = filterTodayHabits(habits, new Date(2026, 2, 15));
    expect(result).toHaveLength(0);
  });

  it('returns empty array when no habits provided', () => {
    const result = filterTodayHabits([], new Date(2026, 2, 15));
    expect(result).toHaveLength(0);
  });

  it('filters multiple habits correctly', () => {
    const habits = [
      createHabit({ id: '1', frequency: { type: 'daily' } }),
      createHabit({
        id: '2',
        frequency: { type: 'weekly_days', days: [1] }, // Mon only
      }),
      createHabit({ id: '3', frequency: { type: 'weekly_count', count: 2 } }),
      createHabit({
        id: '4',
        frequency: { type: 'daily' },
        archivedAt: '2026-01-01T00:00:00.000Z',
      }),
    ];
    // Sunday -> daily(1) + weekly_count(3) = 2
    const result = filterTodayHabits(habits, new Date(2026, 2, 15));
    expect(result).toHaveLength(2);
    expect(result.map((h) => h.id)).toEqual(['1', '3']);
  });
});

// --- formatDateString ---

describe('formatDateString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const date = new Date(2026, 2, 15); // March 15, 2026
    expect(formatDateString(date)).toBe('2026-03-15');
  });

  it('pads single-digit month and day', () => {
    const date = new Date(2026, 0, 5); // Jan 5, 2026
    expect(formatDateString(date)).toBe('2026-01-05');
  });

  it('handles December 31', () => {
    const date = new Date(2026, 11, 31);
    expect(formatDateString(date)).toBe('2026-12-31');
  });
});

// --- getCompletionStats ---

describe('getCompletionStats', () => {
  const habits = [
    createHabit({ id: '1' }),
    createHabit({ id: '2' }),
    createHabit({ id: '3' }),
  ];
  const date = '2026-03-15';

  it('counts completions correctly', () => {
    const isCompleted = (habitId: string, d: string): boolean =>
      d === date && (habitId === '1' || habitId === '3');

    const stats = getCompletionStats(habits, isCompleted, date);
    expect(stats.total).toBe(3);
    expect(stats.completed).toBe(2);
    expect(stats.allCompleted).toBe(false);
  });

  it('reports allCompleted when all habits are done', () => {
    const isCompleted = (): boolean => true;

    const stats = getCompletionStats(habits, isCompleted, date);
    expect(stats.total).toBe(3);
    expect(stats.completed).toBe(3);
    expect(stats.allCompleted).toBe(true);
  });

  it('reports allCompleted as false when no habits exist', () => {
    const isCompleted = (): boolean => true;

    const stats = getCompletionStats([], isCompleted, date);
    expect(stats.total).toBe(0);
    expect(stats.completed).toBe(0);
    expect(stats.allCompleted).toBe(false);
  });

  it('reports zero completed when none are done', () => {
    const isCompleted = (): boolean => false;

    const stats = getCompletionStats(habits, isCompleted, date);
    expect(stats.total).toBe(3);
    expect(stats.completed).toBe(0);
    expect(stats.allCompleted).toBe(false);
  });
});

// --- formatFrequencyLabel ---

describe('formatFrequencyLabel', () => {
  it('returns "毎日" for daily frequency', () => {
    const habit = createHabit({ frequency: { type: 'daily' } });
    expect(formatFrequencyLabel(habit)).toBe('毎日');
  });

  it('returns formatted day names for weekly_days', () => {
    const habit = createHabit({
      frequency: { type: 'weekly_days', days: [1, 3, 5] },
    });
    expect(formatFrequencyLabel(habit)).toBe('毎週 月・水・金');
  });

  it('sorts days correctly for weekly_days', () => {
    const habit = createHabit({
      frequency: { type: 'weekly_days', days: [5, 1, 3] },
    });
    expect(formatFrequencyLabel(habit)).toBe('毎週 月・水・金');
  });

  it('includes Sunday for weekly_days', () => {
    const habit = createHabit({
      frequency: { type: 'weekly_days', days: [0, 6] },
    });
    expect(formatFrequencyLabel(habit)).toBe('毎週 日・土');
  });

  it('returns count label for weekly_count', () => {
    const habit = createHabit({
      frequency: { type: 'weekly_count', count: 3 },
    });
    expect(formatFrequencyLabel(habit)).toBe('週3回');
  });
});
