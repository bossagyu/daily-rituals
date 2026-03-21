/**
 * Tests for useHabits hook.
 *
 * Since the test environment is Node (no DOM/react-dom),
 * we test the underlying HabitsManager class which contains
 * all the business logic that the hook delegates to.
 */
import type { Mocked } from 'vitest';
import type { Habit, CreateHabitInput } from '../../domain/models';
import type { HabitRepository, UpdateHabitInput } from '../../data/repositories';
import { HabitsManager, type HabitsState } from '../habitsManager';

// --- Test fixtures ---

const SAMPLE_HABIT_1: Habit = {
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

const SAMPLE_HABIT_2: Habit = {
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

// --- Mock repository ---

function createMockRepository(): Mocked<HabitRepository> {
  return {
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(SAMPLE_HABIT_1),
    update: vi.fn().mockResolvedValue(SAMPLE_HABIT_1),
    archive: vi.fn().mockResolvedValue(undefined),
    findArchived: vi.fn().mockResolvedValue([]),
  };
}

// --- Tests ---

describe('HabitsManager', () => {
  let mockRepo: Mocked<HabitRepository>;
  let states: HabitsState[];
  let manager: HabitsManager;

  beforeEach(() => {
    mockRepo = createMockRepository();
    states = [];
    manager = new HabitsManager(mockRepo, (state) => {
      states.push(state);
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = manager.getState();
      expect(state).toEqual({
        habits: [],
        isLoading: false,
        error: null,
      });
    });
  });

  describe('loadHabits', () => {
    it('should load habits and update state', async () => {
      mockRepo.findAll.mockResolvedValue([SAMPLE_HABIT_1, SAMPLE_HABIT_2]);

      await manager.loadHabits();

      const finalState = manager.getState();
      expect(finalState.habits).toEqual([SAMPLE_HABIT_1, SAMPLE_HABIT_2]);
      expect(finalState.isLoading).toBe(false);
      expect(finalState.error).toBeNull();
    });

    it('should set isLoading to true while loading', async () => {
      mockRepo.findAll.mockResolvedValue([]);

      const promise = manager.loadHabits();

      // Check that loading state was emitted
      const loadingState = states.find((s) => s.isLoading);
      expect(loadingState).toBeDefined();
      expect(loadingState!.isLoading).toBe(true);

      await promise;
    });

    it('should set error when loading fails', async () => {
      mockRepo.findAll.mockRejectedValue(new Error('DB connection failed'));

      await manager.loadHabits();

      const finalState = manager.getState();
      expect(finalState.error).toBe('DB connection failed');
      expect(finalState.isLoading).toBe(false);
      expect(finalState.habits).toEqual([]);
    });

    it('should handle non-Error thrown values', async () => {
      mockRepo.findAll.mockRejectedValue('string error');

      await manager.loadHabits();

      const finalState = manager.getState();
      expect(finalState.error).toBe('Failed to load habits');
      expect(finalState.isLoading).toBe(false);
    });
  });

  describe('createHabit', () => {
    it('should create a habit and refresh the list', async () => {
      const input: CreateHabitInput = {
        userId: 'user-abc-123',
        name: 'Meditation',
        frequency: { type: 'daily' },
        color: '#AABBCC',
      };
      const createdHabit: Habit = {
        id: 'new-id',
        userId: 'user-abc-123',
        name: 'Meditation',
        frequency: { type: 'daily' },
        color: '#AABBCC',
        createdAt: '2026-03-15T00:00:00.000Z',
        archivedAt: null,
        reminderTime: null,
        lastNotifiedDate: null,
      };

      mockRepo.create.mockResolvedValue(createdHabit);
      mockRepo.findAll.mockResolvedValue([createdHabit]);

      await manager.createHabit(input);

      expect(mockRepo.create).toHaveBeenCalledWith(input);
      expect(mockRepo.findAll).toHaveBeenCalled();
      expect(manager.getState().habits).toEqual([createdHabit]);
    });

    it('should set error when creation fails', async () => {
      mockRepo.create.mockRejectedValue(new Error('Insert failed'));

      await manager.createHabit({
        userId: 'user-abc-123',
        name: 'Test',
        frequency: { type: 'daily' },
        color: '#000000',
      });

      expect(manager.getState().error).toBe('Insert failed');
      expect(manager.getState().isLoading).toBe(false);
    });
  });

  describe('updateHabit', () => {
    it('should update a habit and refresh the list', async () => {
      const updatedHabit: Habit = {
        ...SAMPLE_HABIT_1,
        name: 'Evening Run',
      };
      mockRepo.update.mockResolvedValue(updatedHabit);
      mockRepo.findAll.mockResolvedValue([updatedHabit]);

      await manager.updateHabit('habit-1', { name: 'Evening Run' });

      expect(mockRepo.update).toHaveBeenCalledWith('habit-1', {
        name: 'Evening Run',
      });
      expect(mockRepo.findAll).toHaveBeenCalled();
      expect(manager.getState().habits).toEqual([updatedHabit]);
    });

    it('should set error when update fails', async () => {
      mockRepo.update.mockRejectedValue(new Error('Update failed'));

      await manager.updateHabit('habit-1', { name: 'Test' });

      expect(manager.getState().error).toBe('Update failed');
    });
  });

  describe('archiveHabit', () => {
    it('should archive a habit and refresh the list', async () => {
      mockRepo.findAll.mockResolvedValue([SAMPLE_HABIT_2]);

      await manager.archiveHabit('habit-1');

      expect(mockRepo.archive).toHaveBeenCalledWith('habit-1');
      expect(mockRepo.findAll).toHaveBeenCalled();
      expect(manager.getState().habits).toEqual([SAMPLE_HABIT_2]);
    });

    it('should set error when archive fails', async () => {
      mockRepo.archive.mockRejectedValue(new Error('Archive failed'));

      await manager.archiveHabit('habit-1');

      expect(manager.getState().error).toBe('Archive failed');
    });
  });

  describe('refresh', () => {
    it('should reload habits from repository', async () => {
      mockRepo.findAll.mockResolvedValue([SAMPLE_HABIT_1]);

      await manager.refresh();

      expect(mockRepo.findAll).toHaveBeenCalled();
      expect(manager.getState().habits).toEqual([SAMPLE_HABIT_1]);
    });
  });

  describe('state immutability', () => {
    it('should return new state objects on each update', async () => {
      mockRepo.findAll.mockResolvedValue([SAMPLE_HABIT_1]);

      const stateBefore = manager.getState();
      await manager.loadHabits();
      const stateAfter = manager.getState();

      expect(stateBefore).not.toBe(stateAfter);
    });

    it('should not mutate the habits array', async () => {
      mockRepo.findAll.mockResolvedValue([SAMPLE_HABIT_1]);
      await manager.loadHabits();

      const habitsRef = manager.getState().habits;
      mockRepo.findAll.mockResolvedValue([SAMPLE_HABIT_1, SAMPLE_HABIT_2]);
      await manager.loadHabits();

      // Original reference should be unchanged
      expect(habitsRef).toEqual([SAMPLE_HABIT_1]);
      expect(manager.getState().habits).toEqual([
        SAMPLE_HABIT_1,
        SAMPLE_HABIT_2,
      ]);
    });
  });

  describe('error clearing', () => {
    it('should clear error on successful operation after failure', async () => {
      mockRepo.findAll.mockRejectedValueOnce(new Error('Temporary error'));
      await manager.loadHabits();
      expect(manager.getState().error).toBe('Temporary error');

      mockRepo.findAll.mockResolvedValue([SAMPLE_HABIT_1]);
      await manager.loadHabits();
      expect(manager.getState().error).toBeNull();
    });
  });

  describe('state notification', () => {
    it('should call onStateChange for each state transition', async () => {
      mockRepo.findAll.mockResolvedValue([SAMPLE_HABIT_1]);

      await manager.loadHabits();

      // Should have at least 2 state changes: loading=true, then loading=false with habits
      expect(states.length).toBeGreaterThanOrEqual(2);
      expect(states[0].isLoading).toBe(true);
      expect(states[states.length - 1].isLoading).toBe(false);
      expect(states[states.length - 1].habits).toEqual([SAMPLE_HABIT_1]);
    });
  });
});
