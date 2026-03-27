/**
 * Tests for useTasks hook.
 *
 * Since the test environment is Node (no DOM/react-dom),
 * we test the underlying TasksManager class which contains
 * all the business logic that the hook delegates to.
 */
import type { Mocked } from 'vitest';
import type { Task, CreateTaskInput, UpdateTaskInput } from '../../domain/models/task';
import type { TaskRepository } from '../../data/repositories/taskRepository';
import { TasksManager, type TasksState } from '../tasksManager';

// --- Test fixtures ---

const SAMPLE_TASK_1: Task = {
  id: 'task-1',
  userId: 'user-abc-123',
  name: 'Buy groceries',
  dueDate: '2026-03-27',
  completedAt: null,
  createdAt: '2026-03-25T00:00:00.000Z',
  updatedAt: '2026-03-25T00:00:00.000Z',
};

const SAMPLE_TASK_2: Task = {
  id: 'task-2',
  userId: 'user-abc-123',
  name: 'Write report',
  dueDate: null,
  completedAt: null,
  createdAt: '2026-03-26T00:00:00.000Z',
  updatedAt: '2026-03-26T00:00:00.000Z',
};

const TEST_DATE = '2026-03-27';

// --- Mock repository ---

function createMockRepository(): Mocked<TaskRepository> {
  return {
    findByDate: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(SAMPLE_TASK_1),
    update: vi.fn().mockResolvedValue(SAMPLE_TASK_1),
    remove: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(SAMPLE_TASK_1),
    uncomplete: vi.fn().mockResolvedValue(SAMPLE_TASK_1),
  };
}

// --- Tests ---

describe('TasksManager', () => {
  let mockRepo: Mocked<TaskRepository>;
  let states: TasksState[];
  let manager: TasksManager;

  beforeEach(() => {
    mockRepo = createMockRepository();
    states = [];
    manager = new TasksManager(mockRepo, (state) => {
      states.push(state);
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = manager.getState();
      expect(state).toEqual({
        tasks: [],
        isLoading: false,
        error: null,
      });
    });
  });

  describe('loadTasks', () => {
    it('should load tasks for a date and update state', async () => {
      mockRepo.findByDate.mockResolvedValue([SAMPLE_TASK_1, SAMPLE_TASK_2]);

      await manager.loadTasks(TEST_DATE);

      const finalState = manager.getState();
      expect(finalState.tasks).toEqual([SAMPLE_TASK_1, SAMPLE_TASK_2]);
      expect(finalState.isLoading).toBe(false);
      expect(finalState.error).toBeNull();
      expect(mockRepo.findByDate).toHaveBeenCalledWith(TEST_DATE);
    });

    it('should set isLoading to true while loading', async () => {
      mockRepo.findByDate.mockResolvedValue([]);

      const promise = manager.loadTasks(TEST_DATE);

      const loadingState = states.find((s) => s.isLoading);
      expect(loadingState).toBeDefined();
      expect(loadingState!.isLoading).toBe(true);

      await promise;
    });

    it('should set error when loading fails', async () => {
      mockRepo.findByDate.mockRejectedValue(new Error('DB connection failed'));

      await manager.loadTasks(TEST_DATE);

      const finalState = manager.getState();
      expect(finalState.error).toBe('DB connection failed');
      expect(finalState.isLoading).toBe(false);
      expect(finalState.tasks).toEqual([]);
    });

    it('should handle non-Error thrown values', async () => {
      mockRepo.findByDate.mockRejectedValue('string error');

      await manager.loadTasks(TEST_DATE);

      const finalState = manager.getState();
      expect(finalState.error).toBe('Failed to load tasks');
      expect(finalState.isLoading).toBe(false);
    });
  });

  describe('createTask', () => {
    it('should create a task and reload the list', async () => {
      const input: CreateTaskInput = {
        name: 'New task',
        dueDate: '2026-03-28',
      };
      const createdTask: Task = {
        id: 'new-id',
        userId: 'user-abc-123',
        name: 'New task',
        dueDate: '2026-03-28',
        completedAt: null,
        createdAt: '2026-03-27T00:00:00.000Z',
        updatedAt: '2026-03-27T00:00:00.000Z',
      };

      mockRepo.create.mockResolvedValue(createdTask);
      mockRepo.findByDate.mockResolvedValue([createdTask]);

      // Must loadTasks first to set currentDate
      await manager.loadTasks(TEST_DATE);
      mockRepo.findByDate.mockResolvedValue([createdTask]);

      await manager.createTask(input);

      expect(mockRepo.create).toHaveBeenCalledWith(input);
      expect(mockRepo.findByDate).toHaveBeenCalledWith(TEST_DATE);
      expect(manager.getState().tasks).toEqual([createdTask]);
    });

    it('should set error when creation fails', async () => {
      mockRepo.create.mockRejectedValue(new Error('Insert failed'));

      await manager.loadTasks(TEST_DATE);
      await manager.createTask({ name: 'Test', dueDate: null });

      expect(manager.getState().error).toBe('Insert failed');
      expect(manager.getState().isLoading).toBe(false);
    });
  });

  describe('updateTask', () => {
    it('should update a task and reload the list', async () => {
      const updatedTask: Task = {
        ...SAMPLE_TASK_1,
        name: 'Updated task',
      };
      mockRepo.update.mockResolvedValue(updatedTask);
      mockRepo.findByDate.mockResolvedValue([updatedTask]);

      await manager.loadTasks(TEST_DATE);
      mockRepo.findByDate.mockResolvedValue([updatedTask]);

      await manager.updateTask('task-1', { name: 'Updated task' });

      expect(mockRepo.update).toHaveBeenCalledWith('task-1', { name: 'Updated task' });
      expect(mockRepo.findByDate).toHaveBeenCalledWith(TEST_DATE);
      expect(manager.getState().tasks).toEqual([updatedTask]);
    });

    it('should set error when update fails', async () => {
      mockRepo.update.mockRejectedValue(new Error('Update failed'));

      await manager.loadTasks(TEST_DATE);
      await manager.updateTask('task-1', { name: 'Test' });

      expect(manager.getState().error).toBe('Update failed');
    });
  });

  describe('removeTask', () => {
    it('should remove a task and reload the list', async () => {
      mockRepo.findByDate.mockResolvedValue([SAMPLE_TASK_2]);

      await manager.loadTasks(TEST_DATE);
      mockRepo.findByDate.mockResolvedValue([SAMPLE_TASK_2]);

      await manager.removeTask('task-1');

      expect(mockRepo.remove).toHaveBeenCalledWith('task-1');
      expect(mockRepo.findByDate).toHaveBeenCalledWith(TEST_DATE);
      expect(manager.getState().tasks).toEqual([SAMPLE_TASK_2]);
    });

    it('should set error when remove fails', async () => {
      mockRepo.remove.mockRejectedValue(new Error('Delete failed'));

      await manager.loadTasks(TEST_DATE);
      await manager.removeTask('task-1');

      expect(manager.getState().error).toBe('Delete failed');
      expect(manager.getState().isLoading).toBe(false);
    });
  });

  describe('completeTask', () => {
    it('should complete a task and reload the list', async () => {
      const completedTask: Task = {
        ...SAMPLE_TASK_1,
        completedAt: '2026-03-27T10:00:00.000Z',
      };
      mockRepo.complete.mockResolvedValue(completedTask);
      mockRepo.findByDate.mockResolvedValue([completedTask]);

      await manager.loadTasks(TEST_DATE);
      mockRepo.findByDate.mockResolvedValue([completedTask]);

      await manager.completeTask('task-1');

      expect(mockRepo.complete).toHaveBeenCalledWith('task-1');
      expect(manager.getState().tasks).toEqual([completedTask]);
    });

    it('should set error when complete fails', async () => {
      mockRepo.complete.mockRejectedValue(new Error('Complete failed'));

      await manager.loadTasks(TEST_DATE);
      await manager.completeTask('task-1');

      expect(manager.getState().error).toBe('Complete failed');
      expect(manager.getState().isLoading).toBe(false);
    });
  });

  describe('uncompleteTask', () => {
    it('should uncomplete a task and reload the list', async () => {
      const uncompletedTask: Task = {
        ...SAMPLE_TASK_1,
        completedAt: null,
      };
      mockRepo.uncomplete.mockResolvedValue(uncompletedTask);
      mockRepo.findByDate.mockResolvedValue([uncompletedTask]);

      await manager.loadTasks(TEST_DATE);
      mockRepo.findByDate.mockResolvedValue([uncompletedTask]);

      await manager.uncompleteTask('task-1');

      expect(mockRepo.uncomplete).toHaveBeenCalledWith('task-1');
      expect(manager.getState().tasks).toEqual([uncompletedTask]);
    });

    it('should set error when uncomplete fails', async () => {
      mockRepo.uncomplete.mockRejectedValue(new Error('Uncomplete failed'));

      await manager.loadTasks(TEST_DATE);
      await manager.uncompleteTask('task-1');

      expect(manager.getState().error).toBe('Uncomplete failed');
      expect(manager.getState().isLoading).toBe(false);
    });
  });

  describe('state immutability', () => {
    it('should return new state objects on each update', async () => {
      mockRepo.findByDate.mockResolvedValue([SAMPLE_TASK_1]);

      const stateBefore = manager.getState();
      await manager.loadTasks(TEST_DATE);
      const stateAfter = manager.getState();

      expect(stateBefore).not.toBe(stateAfter);
    });

    it('should not mutate the tasks array', async () => {
      mockRepo.findByDate.mockResolvedValue([SAMPLE_TASK_1]);
      await manager.loadTasks(TEST_DATE);

      const tasksRef = manager.getState().tasks;
      mockRepo.findByDate.mockResolvedValue([SAMPLE_TASK_1, SAMPLE_TASK_2]);
      await manager.loadTasks(TEST_DATE);

      expect(tasksRef).toEqual([SAMPLE_TASK_1]);
      expect(manager.getState().tasks).toEqual([SAMPLE_TASK_1, SAMPLE_TASK_2]);
    });
  });

  describe('error clearing', () => {
    it('should clear error on successful operation after failure', async () => {
      mockRepo.findByDate.mockRejectedValueOnce(new Error('Temporary error'));
      await manager.loadTasks(TEST_DATE);
      expect(manager.getState().error).toBe('Temporary error');

      mockRepo.findByDate.mockResolvedValue([SAMPLE_TASK_1]);
      await manager.loadTasks(TEST_DATE);
      expect(manager.getState().error).toBeNull();
    });
  });

  describe('state notification', () => {
    it('should call onStateChange for each state transition', async () => {
      mockRepo.findByDate.mockResolvedValue([SAMPLE_TASK_1]);

      await manager.loadTasks(TEST_DATE);

      expect(states.length).toBeGreaterThanOrEqual(2);
      expect(states[0].isLoading).toBe(true);
      expect(states[states.length - 1].isLoading).toBe(false);
      expect(states[states.length - 1].tasks).toEqual([SAMPLE_TASK_1]);
    });
  });
});
