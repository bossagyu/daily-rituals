import { describe, it, expect } from 'vitest';
import {
  generateCalendarGrid,
  getHeatmapLevel,
  calculateDailyAchievements,
} from '../calendarService';
import type { Habit } from '../../models/habit';
import type { Completion } from '../../models/completion';

describe('generateCalendarGrid', () => {
  it('generates 42 cells (6 weeks) for any month', () => {
    const grid = generateCalendarGrid(2026, 3); // March 2026
    expect(grid).toHaveLength(42);
  });

  it('marks current month days correctly', () => {
    const grid = generateCalendarGrid(2026, 3);
    const marchDays = grid.filter((d) => d.isCurrentMonth);
    expect(marchDays).toHaveLength(31);
  });

  it('starts with correct day offset (March 2026 starts on Sunday)', () => {
    const grid = generateCalendarGrid(2026, 3);
    expect(grid[0].date).toBe('2026-03-01');
    expect(grid[0].isCurrentMonth).toBe(true);
  });

  it('handles February in leap year', () => {
    const grid = generateCalendarGrid(2028, 2); // Feb 2028 is leap year
    const febDays = grid.filter((d) => d.isCurrentMonth);
    expect(febDays).toHaveLength(29);
  });

  it('handles February in non-leap year', () => {
    const grid = generateCalendarGrid(2026, 2);
    const febDays = grid.filter((d) => d.isCurrentMonth);
    expect(febDays).toHaveLength(28);
  });

  it('includes previous month days as padding', () => {
    // April 2026 starts on Wednesday (day index 3)
    const grid = generateCalendarGrid(2026, 4);
    const prePadding = grid.filter(
      (d) => !d.isCurrentMonth && d.date < '2026-04-01',
    );
    expect(prePadding.length).toBeGreaterThan(0);
  });

  it('includes next month days as padding', () => {
    const grid = generateCalendarGrid(2026, 3);
    const postPadding = grid.filter(
      (d) => !d.isCurrentMonth && d.date > '2026-03-31',
    );
    expect(postPadding.length).toBeGreaterThan(0);
  });

  it('all dates are in YYYY-MM-DD format', () => {
    const grid = generateCalendarGrid(2026, 3);
    for (const day of grid) {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('getHeatmapLevel', () => {
  it('returns 0 for 0%', () => {
    expect(getHeatmapLevel(0)).toBe(0);
  });

  it('returns 1 for 1%', () => {
    expect(getHeatmapLevel(0.01)).toBe(1);
  });

  it('returns 1 for 33%', () => {
    expect(getHeatmapLevel(0.33)).toBe(1);
  });

  it('returns 2 for 34%', () => {
    expect(getHeatmapLevel(0.34)).toBe(2);
  });

  it('returns 2 for 66%', () => {
    expect(getHeatmapLevel(0.66)).toBe(2);
  });

  it('returns 3 for 67%', () => {
    expect(getHeatmapLevel(0.67)).toBe(3);
  });

  it('returns 3 for 99%', () => {
    expect(getHeatmapLevel(0.99)).toBe(3);
  });

  it('returns 4 for 100%', () => {
    expect(getHeatmapLevel(1.0)).toBe(4);
  });
});

const dailyHabit: Habit = {
  id: 'h1',
  userId: 'u1',
  name: '読書',
  frequency: { type: 'daily' },
  color: '#4CAF50',
  createdAt: '2026-03-01T00:00:00Z',
  archivedAt: null,
  reminderTime: null,
  lastNotifiedDate: null,
};

const weeklyDaysHabit: Habit = {
  id: 'h2',
  userId: 'u1',
  name: '運動',
  frequency: { type: 'weekly_days', days: [1, 3, 5] }, // Mon, Wed, Fri
  color: '#2196F3',
  createdAt: '2026-03-01T00:00:00Z',
  archivedAt: null,
  reminderTime: null,
  lastNotifiedDate: null,
};

const weeklyCountHabit: Habit = {
  id: 'h3',
  userId: 'u1',
  name: '瞑想',
  frequency: { type: 'weekly_count', count: 3 },
  color: '#FF9800',
  createdAt: '2026-03-01T00:00:00Z',
  archivedAt: null,
  reminderTime: null,
  lastNotifiedDate: null,
};

describe('calculateDailyAchievements', () => {
  it('calculates daily habit achievement for a single day', () => {
    const completions: Completion[] = [
      {
        id: 'c1',
        userId: 'u1',
        habitId: 'h1',
        completedDate: '2026-03-01',
        createdAt: '2026-03-01T10:00:00Z',
      },
    ];
    const result = calculateDailyAchievements(
      [dailyHabit],
      completions,
      '2026-03-01',
      '2026-03-01',
    );
    expect(result[0].rate).toBe(1.0);
    expect(result[0].completedCount).toBe(1);
    expect(result[0].targetCount).toBe(1);
  });

  it('returns 0 rate when no completions', () => {
    const result = calculateDailyAchievements(
      [dailyHabit],
      [],
      '2026-03-01',
      '2026-03-01',
    );
    expect(result[0].rate).toBe(0);
    expect(result[0].targetCount).toBe(1);
  });

  it('excludes weekly_days habits on non-target days', () => {
    // 2026-03-01 is Sunday (day 0), not in [1,3,5]
    const result = calculateDailyAchievements(
      [weeklyDaysHabit],
      [],
      '2026-03-01',
      '2026-03-01',
    );
    expect(result[0].targetCount).toBe(0);
  });

  it('includes weekly_days habits on target days', () => {
    // 2026-03-02 is Monday (day 1), in [1,3,5]
    const result = calculateDailyAchievements(
      [weeklyDaysHabit],
      [],
      '2026-03-02',
      '2026-03-02',
    );
    expect(result[0].targetCount).toBe(1);
  });

  it('excludes weekly_count habits from targetCount', () => {
    const result = calculateDailyAchievements(
      [weeklyCountHabit],
      [],
      '2026-03-01',
      '2026-03-01',
    );
    expect(result[0].targetCount).toBe(0);
  });

  it('includes weekly_count completions in completedCount', () => {
    const completions: Completion[] = [
      {
        id: 'c1',
        userId: 'u1',
        habitId: 'h3',
        completedDate: '2026-03-01',
        createdAt: '2026-03-01T10:00:00Z',
      },
    ];
    const result = calculateDailyAchievements(
      [weeklyCountHabit],
      completions,
      '2026-03-01',
      '2026-03-01',
    );
    expect(result[0].completedCount).toBe(1);
  });

  it('excludes habits created after the date', () => {
    const laterHabit: Habit = {
      ...dailyHabit,
      createdAt: '2026-03-10T00:00:00Z',
    };
    const result = calculateDailyAchievements(
      [laterHabit],
      [],
      '2026-03-01',
      '2026-03-01',
    );
    expect(result[0].targetCount).toBe(0);
  });

  it('excludes archived habits after archived_at date', () => {
    const archivedHabit: Habit = {
      ...dailyHabit,
      archivedAt: '2026-03-05T00:00:00Z',
    };
    const result = calculateDailyAchievements(
      [archivedHabit],
      [],
      '2026-03-06',
      '2026-03-06',
    );
    expect(result[0].targetCount).toBe(0);
  });

  it('includes archived habits before archived_at date', () => {
    const archivedHabit: Habit = {
      ...dailyHabit,
      archivedAt: '2026-03-05T00:00:00Z',
    };
    const result = calculateDailyAchievements(
      [archivedHabit],
      [],
      '2026-03-04',
      '2026-03-04',
    );
    expect(result[0].targetCount).toBe(1);
  });

  it('includes completedHabitNames in result', () => {
    const completions: Completion[] = [
      {
        id: 'c1',
        userId: 'u1',
        habitId: 'h1',
        completedDate: '2026-03-01',
        createdAt: '2026-03-01T10:00:00Z',
      },
    ];
    const result = calculateDailyAchievements(
      [dailyHabit],
      completions,
      '2026-03-01',
      '2026-03-01',
    );
    expect(result[0].completedHabitNames).toEqual(['読書']);
  });

  it('calculates multiple days correctly', () => {
    const result = calculateDailyAchievements(
      [dailyHabit],
      [],
      '2026-03-01',
      '2026-03-03',
    );
    expect(result).toHaveLength(3);
  });
});
