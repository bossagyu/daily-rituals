/**
 * Tests for useCalendarData hook utilities.
 *
 * Since the test environment is Node (no DOM/react-dom),
 * we test the exported utility functions that contain
 * the hook's core logic.
 */
import type { Habit } from '../../domain/models';
import type { CalendarFilter } from '../useCalendarData';
import {
  getInitialYearMonth,
  getDateRange,
  canNavigateNext,
  navigatePreviousMonth,
  navigateNextMonth,
  filterHabitsForCalculation,
} from '../useCalendarData';

// --- Helpers ---

const makeHabit = (id: string, archived = false): Habit => ({
  id,
  userId: 'user-abc-123',
  name: `Habit ${id}`,
  frequency: { type: 'daily' },
  color: '#FF0000',
  createdAt: '2026-01-01T00:00:00Z',
  archivedAt: archived ? '2026-02-01T00:00:00Z' : null,
  reminderTime: null,
  lastNotifiedDate: null,
});

// --- Tests ---

describe('getInitialYearMonth', () => {
  it('returns the current year and month', () => {
    const now = new Date();
    const result = getInitialYearMonth();

    expect(result.year).toBe(now.getFullYear());
    expect(result.month).toBe(now.getMonth() + 1);
  });
});

describe('getDateRange', () => {
  it('returns startDate and endDate from a calendar grid', () => {
    const grid = [
      { date: '2026-02-23', dayOfMonth: 23, isCurrentMonth: false },
      { date: '2026-02-24', dayOfMonth: 24, isCurrentMonth: false },
      { date: '2026-03-31', dayOfMonth: 31, isCurrentMonth: true },
      { date: '2026-04-05', dayOfMonth: 5, isCurrentMonth: false },
    ] as const;

    const result = getDateRange(grid);

    expect(result.startDate).toBe('2026-02-23');
    expect(result.endDate).toBe('2026-04-05');
  });
});

describe('canNavigateNext', () => {
  it('returns true for a past month', () => {
    expect(canNavigateNext(2025, 1)).toBe(true);
  });

  it('returns false for the current month', () => {
    const now = new Date();
    expect(canNavigateNext(now.getFullYear(), now.getMonth() + 1)).toBe(false);
  });

  it('returns false for a future month', () => {
    expect(canNavigateNext(2099, 12)).toBe(false);
  });

  it('returns true for previous month in current year', () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    if (currentMonth > 1) {
      expect(canNavigateNext(now.getFullYear(), currentMonth - 1)).toBe(true);
    }
  });
});

describe('navigatePreviousMonth', () => {
  it('decrements month within the same year', () => {
    expect(navigatePreviousMonth(2026, 6)).toEqual({ year: 2026, month: 5 });
  });

  it('wraps to December of previous year from January', () => {
    expect(navigatePreviousMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });
});

describe('navigateNextMonth', () => {
  it('increments month within the same year', () => {
    expect(navigateNextMonth(2025, 3)).toEqual({ year: 2025, month: 4 });
  });

  it('wraps to January of next year from December', () => {
    expect(navigateNextMonth(2025, 12)).toEqual({ year: 2026, month: 1 });
  });

  it('does not navigate past the current month', () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const result = navigateNextMonth(currentYear, currentMonth);

    expect(result).toEqual({ year: currentYear, month: currentMonth });
  });

  it('does not navigate when year is in the future', () => {
    const result = navigateNextMonth(2099, 6);

    expect(result).toEqual({ year: 2099, month: 6 });
  });
});

describe('filterHabitsForCalculation', () => {
  const habits = [makeHabit('h1'), makeHabit('h2'), makeHabit('h3', true)];

  it('returns all habits when filter mode is "all"', () => {
    const filter: CalendarFilter = { mode: 'all' };
    const result = filterHabitsForCalculation(habits, filter);

    expect(result).toEqual(habits);
  });

  it('returns only the matching habit when filter mode is "habit"', () => {
    const filter: CalendarFilter = { mode: 'habit', habitId: 'h2' };
    const result = filterHabitsForCalculation(habits, filter);

    expect(result).toEqual([habits[1]]);
  });

  it('returns empty array when habit id does not match', () => {
    const filter: CalendarFilter = { mode: 'habit', habitId: 'h999' };
    const result = filterHabitsForCalculation(habits, filter);

    expect(result).toEqual([]);
  });
});
