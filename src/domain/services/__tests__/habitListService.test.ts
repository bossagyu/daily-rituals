import {
  filterActiveHabits,
  filterArchivedHabits,
  mergeHabitLists,
} from '../habitListService';
import type { Habit } from '../../models';

const ACTIVE_HABIT_1: Habit = {
  id: 'h1',
  userId: 'user-abc-123',
  name: 'Running',
  frequency: { type: 'daily' },
  color: '#FF0000',
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
};

const ACTIVE_HABIT_2: Habit = {
  id: 'h2',
  userId: 'user-abc-123',
  name: 'Yoga',
  frequency: { type: 'weekly_days', days: [1, 3, 5] },
  color: '#00FF00',
  createdAt: '2026-01-02T00:00:00.000Z',
  archivedAt: null,
};

const ARCHIVED_HABIT: Habit = {
  id: 'h3',
  userId: 'user-abc-123',
  name: 'Meditation',
  frequency: { type: 'weekly_count', count: 3 },
  color: '#0000FF',
  createdAt: '2026-01-03T00:00:00.000Z',
  archivedAt: '2026-02-01T00:00:00.000Z',
};

const ALL_HABITS = [ACTIVE_HABIT_1, ACTIVE_HABIT_2, ARCHIVED_HABIT];

describe('habitListService', () => {
  describe('filterActiveHabits', () => {
    it('returns only habits without archivedAt', () => {
      const result = filterActiveHabits(ALL_HABITS);
      expect(result).toEqual([ACTIVE_HABIT_1, ACTIVE_HABIT_2]);
    });

    it('returns empty array when all habits are archived', () => {
      const result = filterActiveHabits([ARCHIVED_HABIT]);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty input', () => {
      const result = filterActiveHabits([]);
      expect(result).toEqual([]);
    });

    it('does not mutate the input array', () => {
      const input = [...ALL_HABITS];
      filterActiveHabits(input);
      expect(input).toEqual(ALL_HABITS);
    });
  });

  describe('filterArchivedHabits', () => {
    it('returns only habits with archivedAt', () => {
      const result = filterArchivedHabits(ALL_HABITS);
      expect(result).toEqual([ARCHIVED_HABIT]);
    });

    it('returns empty array when no habits are archived', () => {
      const result = filterArchivedHabits([ACTIVE_HABIT_1, ACTIVE_HABIT_2]);
      expect(result).toEqual([]);
    });
  });

  describe('mergeHabitLists', () => {
    it('returns active habits when showArchived is false', () => {
      const result = mergeHabitLists(
        [ACTIVE_HABIT_1, ACTIVE_HABIT_2],
        [ARCHIVED_HABIT],
        false,
      );
      expect(result).toEqual([ACTIVE_HABIT_1, ACTIVE_HABIT_2]);
    });

    it('returns active + archived habits when showArchived is true', () => {
      const result = mergeHabitLists(
        [ACTIVE_HABIT_1, ACTIVE_HABIT_2],
        [ARCHIVED_HABIT],
        true,
      );
      expect(result).toEqual([ACTIVE_HABIT_1, ACTIVE_HABIT_2, ARCHIVED_HABIT]);
    });

    it('does not mutate input arrays', () => {
      const active = [ACTIVE_HABIT_1];
      const archived = [ARCHIVED_HABIT];
      mergeHabitLists(active, archived, true);
      expect(active).toEqual([ACTIVE_HABIT_1]);
      expect(archived).toEqual([ARCHIVED_HABIT]);
    });
  });
});
