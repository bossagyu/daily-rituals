import { getWeeklyProgress } from '../frequencyService';
import type { Habit, Completion } from '../../models';

const BASE_HABIT: Habit = {
  id: 'habit-1',
  userId: 'user-abc-123',
  name: 'Test Habit',
  frequency: { type: 'daily' },
  color: '#FF0000',
  createdAt: '2026-01-01T00:00:00Z',
  archivedAt: null,
  reminderTime: null,
  lastNotifiedDate: null,
};

function makeHabit(overrides: Partial<Habit>): Habit {
  return { ...BASE_HABIT, ...overrides };
}

function makeCompletion(habitId: string, completedDate: string): Completion {
  return {
    id: `completion-${completedDate}`,
    userId: 'user-abc-123',
    habitId,
    completedDate,
    createdAt: `${completedDate}T12:00:00Z`,
  };
}

describe('getWeeklyProgress', () => {
  describe('weekly_count frequency', () => {
    const habit = makeHabit({
      frequency: { type: 'weekly_count', count: 3 },
    });

    it('returns done count and target for completions within the week', () => {
      // Week starting Monday 2026-03-09
      const weekStart = new Date('2026-03-09');
      const completions: readonly Completion[] = [
        makeCompletion('habit-1', '2026-03-09'),
        makeCompletion('habit-1', '2026-03-11'),
      ];
      expect(getWeeklyProgress(habit, completions, weekStart)).toEqual({
        done: 2,
        target: 3,
      });
    });

    it('returns done=0 when no completions exist', () => {
      const weekStart = new Date('2026-03-09');
      expect(getWeeklyProgress(habit, [], weekStart)).toEqual({
        done: 0,
        target: 3,
      });
    });

    it('excludes completions outside the week', () => {
      const weekStart = new Date('2026-03-09');
      const completions: readonly Completion[] = [
        makeCompletion('habit-1', '2026-03-08'), // before week
        makeCompletion('habit-1', '2026-03-09'), // in week
        makeCompletion('habit-1', '2026-03-15'), // end of week (Sunday)
        makeCompletion('habit-1', '2026-03-16'), // after week
      ];
      expect(getWeeklyProgress(habit, completions, weekStart)).toEqual({
        done: 2,
        target: 3,
      });
    });

    it('counts all 7 days when all are completed', () => {
      const weekStart = new Date('2026-03-09');
      const completions: readonly Completion[] = [
        makeCompletion('habit-1', '2026-03-09'),
        makeCompletion('habit-1', '2026-03-10'),
        makeCompletion('habit-1', '2026-03-11'),
        makeCompletion('habit-1', '2026-03-12'),
        makeCompletion('habit-1', '2026-03-13'),
        makeCompletion('habit-1', '2026-03-14'),
        makeCompletion('habit-1', '2026-03-15'),
      ];
      expect(getWeeklyProgress(habit, completions, weekStart)).toEqual({
        done: 7,
        target: 3,
      });
    });
  });

  describe('daily frequency', () => {
    const habit = makeHabit({ frequency: { type: 'daily' } });

    it('returns target=7 for daily habits', () => {
      const weekStart = new Date('2026-03-09');
      const completions: readonly Completion[] = [
        makeCompletion('habit-1', '2026-03-09'),
        makeCompletion('habit-1', '2026-03-10'),
        makeCompletion('habit-1', '2026-03-11'),
      ];
      expect(getWeeklyProgress(habit, completions, weekStart)).toEqual({
        done: 3,
        target: 7,
      });
    });
  });

  describe('weekly_days frequency', () => {
    const habit = makeHabit({
      frequency: { type: 'weekly_days', days: [1, 3, 5] },
    });

    it('returns target equal to number of specified days', () => {
      const weekStart = new Date('2026-03-09');
      const completions: readonly Completion[] = [
        makeCompletion('habit-1', '2026-03-09'), // Monday
        makeCompletion('habit-1', '2026-03-11'), // Wednesday
      ];
      expect(getWeeklyProgress(habit, completions, weekStart)).toEqual({
        done: 2,
        target: 3,
      });
    });
  });

  describe('edge cases', () => {
    const habit = makeHabit({
      frequency: { type: 'weekly_count', count: 5 },
    });

    it('handles empty completions array', () => {
      const weekStart = new Date('2026-03-09');
      expect(getWeeklyProgress(habit, [], weekStart)).toEqual({
        done: 0,
        target: 5,
      });
    });

    it('only counts completions for the given habit', () => {
      const weekStart = new Date('2026-03-09');
      const completions: readonly Completion[] = [
        makeCompletion('habit-1', '2026-03-09'),
        makeCompletion('other-habit', '2026-03-10'),
        makeCompletion('habit-1', '2026-03-11'),
      ];
      expect(getWeeklyProgress(habit, completions, weekStart)).toEqual({
        done: 2,
        target: 5,
      });
    });

    it('handles week boundary precisely (Monday to Sunday)', () => {
      const weekStart = new Date('2026-03-09'); // Monday
      const completions: readonly Completion[] = [
        makeCompletion('habit-1', '2026-03-15'), // Sunday (last day of week)
      ];
      expect(getWeeklyProgress(habit, completions, weekStart)).toEqual({
        done: 1,
        target: 5,
      });
    });
  });
});
