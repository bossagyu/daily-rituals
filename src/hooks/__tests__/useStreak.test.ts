import type { Habit, Completion } from '../../domain/models';
import {
  computeStreakForHabit,
  computeWeeklyProgressForHabit,
  getWeekStartDate,
  updateCompletionsCache,
  extractErrorMessage,
} from '../streakOperations';

// --- Helpers ---

const makeHabit = (
  id: string,
  frequency: Habit['frequency'] = { type: 'daily' },
): Habit => ({
  id,
  name: `Habit ${id}`,
  frequency,
  color: '#FF0000',
  createdAt: '2025-01-01T00:00:00Z',
  archivedAt: null,
});

const makeCompletion = (
  habitId: string,
  completedDate: string,
): Completion => ({
  id: `comp-${habitId}-${completedDate}`,
  habitId,
  completedDate,
  createdAt: `${completedDate}T12:00:00Z`,
});

// --- Tests ---

describe('computeStreakForHabit', () => {
  const TODAY = '2025-03-10';

  describe('daily frequency', () => {
    it('returns zero streak when no completions exist', () => {
      const habit = makeHabit('h1', { type: 'daily' });

      const streak = computeStreakForHabit(habit, [], TODAY);

      expect(streak).toEqual({ current: 0, longest: 0 });
    });

    it('returns streak for consecutive daily completions', () => {
      const habit = makeHabit('h1', { type: 'daily' });
      const completions = [
        makeCompletion('h1', '2025-03-08'),
        makeCompletion('h1', '2025-03-09'),
        makeCompletion('h1', '2025-03-10'),
      ];

      const streak = computeStreakForHabit(habit, completions, TODAY);

      expect(streak).toEqual({ current: 3, longest: 3 });
    });

    it('handles broken streak', () => {
      const habit = makeHabit('h1', { type: 'daily' });
      const completions = [
        makeCompletion('h1', '2025-03-06'),
        makeCompletion('h1', '2025-03-07'),
        // gap on 2025-03-08
        makeCompletion('h1', '2025-03-09'),
        makeCompletion('h1', '2025-03-10'),
      ];

      const streak = computeStreakForHabit(habit, completions, TODAY);

      expect(streak.current).toBe(2);
      expect(streak.longest).toBe(2);
    });

    it('only considers completions matching the habit id', () => {
      const habit = makeHabit('h1', { type: 'daily' });
      const completions = [
        makeCompletion('h2', '2025-03-09'),
        makeCompletion('h2', '2025-03-10'),
        makeCompletion('h1', '2025-03-10'),
      ];

      const streak = computeStreakForHabit(habit, completions, TODAY);

      expect(streak.current).toBe(1);
    });
  });

  describe('weekly_days frequency', () => {
    it('returns streak for weekly_days completions', () => {
      const habit = makeHabit('h1', {
        type: 'weekly_days',
        days: [1, 3, 5], // Mon, Wed, Fri
      });
      // 2025-03-10 is Monday
      const completions = [
        makeCompletion('h1', '2025-03-03'), // Mon
        makeCompletion('h1', '2025-03-05'), // Wed
        makeCompletion('h1', '2025-03-07'), // Fri
        makeCompletion('h1', '2025-03-10'), // Mon
      ];

      const streak = computeStreakForHabit(habit, completions, TODAY);

      expect(streak.current).toBeGreaterThan(0);
      expect(streak.longest).toBeGreaterThanOrEqual(streak.current);
    });

    it('returns zero streak with no completions', () => {
      const habit = makeHabit('h1', {
        type: 'weekly_days',
        days: [1, 3, 5],
      });

      const streak = computeStreakForHabit(habit, [], TODAY);

      expect(streak).toEqual({ current: 0, longest: 0 });
    });
  });

  describe('weekly_count frequency', () => {
    it('returns streak for weekly_count completions', () => {
      const habit = makeHabit('h1', { type: 'weekly_count', count: 3 });
      const completions = [
        makeCompletion('h1', '2025-03-03'),
        makeCompletion('h1', '2025-03-05'),
        makeCompletion('h1', '2025-03-07'),
        makeCompletion('h1', '2025-03-10'),
      ];

      const streak = computeStreakForHabit(habit, completions, TODAY);

      expect(streak.current).toBeGreaterThanOrEqual(1);
    });

    it('returns zero streak with no completions', () => {
      const habit = makeHabit('h1', { type: 'weekly_count', count: 3 });

      const streak = computeStreakForHabit(habit, [], TODAY);

      expect(streak).toEqual({ current: 0, longest: 0 });
    });
  });
});

describe('computeWeeklyProgressForHabit', () => {
  const TODAY = '2025-03-10'; // Monday

  it('counts daily habit completions with target 7', () => {
    const habit = makeHabit('h1', { type: 'daily' });
    const completions = [
      makeCompletion('h1', '2025-03-10'),
      makeCompletion('h1', '2025-03-11'),
      makeCompletion('h1', '2025-03-12'),
    ];

    const progress = computeWeeklyProgressForHabit(habit, completions, TODAY);

    expect(progress).toEqual({ done: 3, target: 7 });
  });

  it('counts weekly_count completions with specified target', () => {
    const habit = makeHabit('h1', { type: 'weekly_count', count: 3 });
    const completions = [
      makeCompletion('h1', '2025-03-10'),
      makeCompletion('h1', '2025-03-12'),
    ];

    const progress = computeWeeklyProgressForHabit(habit, completions, TODAY);

    expect(progress).toEqual({ done: 2, target: 3 });
  });

  it('counts weekly_days completions with days count as target', () => {
    const habit = makeHabit('h1', {
      type: 'weekly_days',
      days: [1, 3, 5],
    });
    const completions = [makeCompletion('h1', '2025-03-10')];

    const progress = computeWeeklyProgressForHabit(habit, completions, TODAY);

    expect(progress).toEqual({ done: 1, target: 3 });
  });

  it('returns zero done when no completions in current week', () => {
    const habit = makeHabit('h1', { type: 'daily' });
    const completions = [makeCompletion('h1', '2025-03-09')]; // Sunday (previous week)

    const progress = computeWeeklyProgressForHabit(habit, completions, TODAY);

    expect(progress).toEqual({ done: 0, target: 7 });
  });

  it('ignores completions from other habits', () => {
    const habit = makeHabit('h1', { type: 'daily' });
    const completions = [
      makeCompletion('h1', '2025-03-10'),
      makeCompletion('h2', '2025-03-10'),
      makeCompletion('h2', '2025-03-11'),
    ];

    const progress = computeWeeklyProgressForHabit(habit, completions, TODAY);

    expect(progress).toEqual({ done: 1, target: 7 });
  });
});

describe('getWeekStartDate', () => {
  it('returns Monday for a Monday date', () => {
    // 2025-03-10 is Monday
    const result = getWeekStartDate('2025-03-10');
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(10);
  });

  it('returns Monday for a Wednesday date', () => {
    // 2025-03-12 is Wednesday
    const result = getWeekStartDate('2025-03-12');
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(10);
  });

  it('returns Monday for a Sunday date', () => {
    // 2025-03-09 is Sunday
    const result = getWeekStartDate('2025-03-09');
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(3);
  });

  it('returns Monday for a Saturday date', () => {
    // 2025-03-15 is Saturday
    const result = getWeekStartDate('2025-03-15');
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(10);
  });
});

describe('updateCompletionsCache', () => {
  it('adds new entry to empty cache', () => {
    const cache = new Map<string, readonly Completion[]>();
    const completions = [makeCompletion('h1', '2025-03-10')];

    const result = updateCompletionsCache(cache, 'h1', completions);

    expect(result.get('h1')).toEqual(completions);
    expect(result.size).toBe(1);
  });

  it('updates existing entry without mutating original cache', () => {
    const original = new Map<string, readonly Completion[]>();
    original.set('h1', [makeCompletion('h1', '2025-03-09')]);

    const newCompletions = [
      makeCompletion('h1', '2025-03-09'),
      makeCompletion('h1', '2025-03-10'),
    ];

    const result = updateCompletionsCache(original, 'h1', newCompletions);

    expect(result.get('h1')).toEqual(newCompletions);
    // Original cache is not mutated
    expect(original.get('h1')).toHaveLength(1);
  });

  it('preserves other entries when updating one', () => {
    const cache = new Map<string, readonly Completion[]>();
    cache.set('h1', [makeCompletion('h1', '2025-03-10')]);
    cache.set('h2', [makeCompletion('h2', '2025-03-10')]);

    const newCompletions = [makeCompletion('h1', '2025-03-11')];
    const result = updateCompletionsCache(cache, 'h1', newCompletions);

    expect(result.get('h1')).toEqual(newCompletions);
    expect(result.get('h2')).toEqual([makeCompletion('h2', '2025-03-10')]);
  });
});

describe('extractErrorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(extractErrorMessage(new Error('test error'))).toBe('test error');
  });

  it('converts non-Error values to string', () => {
    expect(extractErrorMessage('string error')).toBe('string error');
    expect(extractErrorMessage(42)).toBe('42');
    expect(extractErrorMessage(null)).toBe('null');
    expect(extractErrorMessage(undefined)).toBe('undefined');
  });
});
