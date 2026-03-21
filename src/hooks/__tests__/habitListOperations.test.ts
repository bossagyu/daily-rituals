/**
 * Tests for habitListOperations - pure functions extracted from useHabitList.
 */
import type { Mocked } from 'vitest';
import type { Habit } from '../../domain/models';
import type { HabitRepository } from '../../data/repositories';
import {
  loadArchivedHabits,
  buildDisplayHabits,
  LOAD_ARCHIVED_ERROR,
  INITIAL_ARCHIVED_STATE,
} from '../habitListOperations';

// --- Test fixtures ---

const ACTIVE_HABIT_1: Habit = {
  id: 'habit-1',
  userId: 'user-abc-123',
  name: 'Morning Run',
  frequency: { type: 'daily' },
  color: '#FF0000',
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
  reminderTime: null,
  lastNotifiedDate: null,
};

const ACTIVE_HABIT_2: Habit = {
  id: 'habit-2',
  userId: 'user-abc-123',
  name: 'Yoga',
  frequency: { type: 'weekly_days', days: [1, 3, 5] },
  color: '#00FF00',
  createdAt: '2026-01-02T00:00:00.000Z',
  archivedAt: null,
  reminderTime: null,
  lastNotifiedDate: null,
};

const ARCHIVED_HABIT_1: Habit = {
  id: 'habit-3',
  userId: 'user-abc-123',
  name: 'Meditation',
  frequency: { type: 'daily' },
  color: '#0000FF',
  createdAt: '2026-01-03T00:00:00.000Z',
  archivedAt: '2026-02-01T00:00:00.000Z',
  reminderTime: null,
  lastNotifiedDate: null,
};

const ARCHIVED_HABIT_2: Habit = {
  id: 'habit-4',
  userId: 'user-abc-123',
  name: 'Reading',
  frequency: { type: 'weekly_count', count: 3 },
  color: '#FFFF00',
  createdAt: '2026-01-04T00:00:00.000Z',
  archivedAt: '2026-02-15T00:00:00.000Z',
  reminderTime: null,
  lastNotifiedDate: null,
};

// --- Mock repository ---

function createMockRepository(
  overrides?: Partial<Mocked<HabitRepository>>,
): Mocked<HabitRepository> {
  return {
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(ACTIVE_HABIT_1),
    update: vi.fn().mockResolvedValue(ACTIVE_HABIT_1),
    archive: vi.fn().mockResolvedValue(undefined),
    findArchived: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// --- Tests ---

describe('INITIAL_ARCHIVED_STATE', () => {
  it('should have empty archived habits, no error, and not loading', () => {
    expect(INITIAL_ARCHIVED_STATE).toEqual({
      archivedHabits: [],
      archivedError: null,
      archivedLoading: false,
    });
  });
});

describe('loadArchivedHabits', () => {
  it('should return archived habits on success', async () => {
    const mockRepo = createMockRepository({
      findArchived: vi
        .fn()
        .mockResolvedValue([ARCHIVED_HABIT_1, ARCHIVED_HABIT_2]),
    });

    const result = await loadArchivedHabits(mockRepo);

    expect(result.archivedHabits).toEqual([ARCHIVED_HABIT_1, ARCHIVED_HABIT_2]);
    expect(result.archivedError).toBeNull();
    expect(result.archivedLoading).toBe(false);
  });

  it('should return empty array when no archived habits exist', async () => {
    const mockRepo = createMockRepository({
      findArchived: vi.fn().mockResolvedValue([]),
    });

    const result = await loadArchivedHabits(mockRepo);

    expect(result.archivedHabits).toEqual([]);
    expect(result.archivedError).toBeNull();
    expect(result.archivedLoading).toBe(false);
  });

  it('should return error message from Error instance on failure', async () => {
    const mockRepo = createMockRepository({
      findArchived: vi
        .fn()
        .mockRejectedValue(new Error('Database connection lost')),
    });

    const result = await loadArchivedHabits(mockRepo);

    expect(result.archivedHabits).toEqual([]);
    expect(result.archivedError).toBe('Database connection lost');
    expect(result.archivedLoading).toBe(false);
  });

  it('should return fallback error message for non-Error thrown values', async () => {
    const mockRepo = createMockRepository({
      findArchived: vi.fn().mockRejectedValue('string error'),
    });

    const result = await loadArchivedHabits(mockRepo);

    expect(result.archivedHabits).toEqual([]);
    expect(result.archivedError).toBe(LOAD_ARCHIVED_ERROR);
    expect(result.archivedLoading).toBe(false);
  });

  it('should call findArchived on repository', async () => {
    const mockRepo = createMockRepository();

    await loadArchivedHabits(mockRepo);

    expect(mockRepo.findArchived).toHaveBeenCalledTimes(1);
  });
});

describe('buildDisplayHabits', () => {
  it('should return only active habits when showArchived is false', () => {
    const result = buildDisplayHabits(
      [ACTIVE_HABIT_1, ACTIVE_HABIT_2],
      [ARCHIVED_HABIT_1],
      false,
    );

    expect(result).toEqual([ACTIVE_HABIT_1, ACTIVE_HABIT_2]);
  });

  it('should return active and archived habits when showArchived is true', () => {
    const result = buildDisplayHabits(
      [ACTIVE_HABIT_1, ACTIVE_HABIT_2],
      [ARCHIVED_HABIT_1, ARCHIVED_HABIT_2],
      true,
    );

    expect(result).toEqual([
      ACTIVE_HABIT_1,
      ACTIVE_HABIT_2,
      ARCHIVED_HABIT_1,
      ARCHIVED_HABIT_2,
    ]);
  });

  it('should return empty array when no habits and showArchived is false', () => {
    const result = buildDisplayHabits([], [], false);

    expect(result).toEqual([]);
  });

  it('should return only archived habits when active is empty and showArchived is true', () => {
    const result = buildDisplayHabits(
      [],
      [ARCHIVED_HABIT_1],
      true,
    );

    expect(result).toEqual([ARCHIVED_HABIT_1]);
  });

  it('should not mutate input arrays', () => {
    const active = [ACTIVE_HABIT_1];
    const archived = [ARCHIVED_HABIT_1];
    const activeRef = [...active];
    const archivedRef = [...archived];

    buildDisplayHabits(active, archived, true);

    expect(active).toEqual(activeRef);
    expect(archived).toEqual(archivedRef);
  });
});
