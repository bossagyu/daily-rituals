import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../lib/database.types';
import { createSupabaseTaskRepository } from '../supabaseTaskRepository';
import type { Task, CreateTaskInput } from '../../../domain/models';

// --- Supabase mock builder ---

type TaskRow = Database['public']['Tables']['tasks']['Row'];

const createMockSupabase = () => {
  const chainMock = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    single: vi.fn(),
  };

  // By default, each method returns chainMock for chaining
  chainMock.select.mockReturnValue(chainMock);
  chainMock.insert.mockReturnValue(chainMock);
  chainMock.update.mockReturnValue(chainMock);
  chainMock.delete.mockReturnValue(chainMock);
  chainMock.eq.mockReturnValue(chainMock);
  chainMock.or.mockReturnValue(chainMock);
  chainMock.single.mockReturnValue(chainMock);

  const from = vi.fn().mockReturnValue(chainMock);

  const client = { from } as unknown as SupabaseClient<Database>;

  return { client, from, chain: chainMock };
};

// --- Test data ---

const USER_ID = 'user-123';

const sampleTaskRow: TaskRow = {
  id: 'task-1',
  user_id: USER_ID,
  name: 'Buy groceries',
  due_date: '2026-03-25',
  completed_at: null,
  created_at: '2026-03-24T10:00:00Z',
  updated_at: '2026-03-24T10:00:00Z',
};

const sampleTask: Task = {
  id: 'task-1',
  userId: USER_ID,
  name: 'Buy groceries',
  dueDate: '2026-03-25',
  completedAt: null,
  createdAt: '2026-03-24T10:00:00Z',
  updatedAt: '2026-03-24T10:00:00Z',
};

const completedTaskRow: TaskRow = {
  id: 'task-2',
  user_id: USER_ID,
  name: 'Submit report',
  due_date: '2026-03-24',
  completed_at: '2026-03-24T15:30:00Z',
  created_at: '2026-03-20T10:00:00Z',
  updated_at: '2026-03-24T15:30:00Z',
};

const noDueDateTaskRow: TaskRow = {
  id: 'task-3',
  user_id: USER_ID,
  name: 'Someday task',
  due_date: null,
  completed_at: null,
  created_at: '2026-03-20T10:00:00Z',
  updated_at: '2026-03-20T10:00:00Z',
};

describe('SupabaseTaskRepository', () => {
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  describe('findByDate', () => {
    it('should return tasks mapped to domain models', async () => {
      mock.chain.or.mockResolvedValue({
        data: [sampleTaskRow, completedTaskRow, noDueDateTaskRow],
        error: null,
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      const result = await repo.findByDate('2026-03-24');

      expect(mock.from).toHaveBeenCalledWith('tasks');
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(sampleTask);
      expect(result[2]).toEqual({
        id: 'task-3',
        userId: USER_ID,
        name: 'Someday task',
        dueDate: null,
        completedAt: null,
        createdAt: '2026-03-20T10:00:00Z',
        updatedAt: '2026-03-20T10:00:00Z',
      });
    });

    it('should pass correct OR filter for date query', async () => {
      mock.chain.or.mockResolvedValue({
        data: [],
        error: null,
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      await repo.findByDate('2026-03-24');

      expect(mock.chain.or).toHaveBeenCalledWith(
        'and(due_date.is.null,completed_at.is.null),and(due_date.lte.2026-03-24,completed_at.is.null),and(completed_at.gte.2026-03-24T00:00:00,completed_at.lt.2026-03-25T00:00:00)',
      );
    });

    it('should return empty array when no tasks found', async () => {
      mock.chain.or.mockResolvedValue({
        data: [],
        error: null,
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      const result = await repo.findByDate('2026-03-24');

      expect(result).toEqual([]);
    });

    it('should throw on Supabase error', async () => {
      mock.chain.or.mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      await expect(repo.findByDate('2026-03-24')).rejects.toThrow(
        'Failed to fetch tasks: Network error',
      );
    });
  });

  describe('create', () => {
    it('should insert a new task and return the domain model', async () => {
      const input: CreateTaskInput = {
        name: 'Buy groceries',
        dueDate: '2026-03-25',
      };

      mock.chain.single.mockResolvedValue({
        data: sampleTaskRow,
        error: null,
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      const result = await repo.create(input);

      expect(mock.from).toHaveBeenCalledWith('tasks');
      expect(mock.chain.insert).toHaveBeenCalledWith({
        user_id: USER_ID,
        name: 'Buy groceries',
        due_date: '2026-03-25',
      });
      expect(result).toEqual(sampleTask);
    });

    it('should create a task without due date', async () => {
      const input: CreateTaskInput = {
        name: 'Someday task',
        dueDate: null,
      };

      mock.chain.single.mockResolvedValue({
        data: noDueDateTaskRow,
        error: null,
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      const result = await repo.create(input);

      expect(mock.chain.insert).toHaveBeenCalledWith({
        user_id: USER_ID,
        name: 'Someday task',
        due_date: null,
      });
      expect(result.dueDate).toBeNull();
    });

    it('should throw on Supabase error', async () => {
      const input: CreateTaskInput = {
        name: 'Test',
        dueDate: null,
      };

      mock.chain.single.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      await expect(repo.create(input)).rejects.toThrow(
        'Failed to create task: Insert failed',
      );
    });
  });

  describe('update', () => {
    it('should update a task name and return the updated domain model', async () => {
      const updatedRow: TaskRow = { ...sampleTaskRow, name: 'Buy organic groceries' };
      mock.chain.single.mockResolvedValue({
        data: updatedRow,
        error: null,
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      const result = await repo.update('task-1', { name: 'Buy organic groceries' });

      expect(mock.chain.update).toHaveBeenCalledWith({ name: 'Buy organic groceries' });
      expect(result).toEqual({ ...sampleTask, name: 'Buy organic groceries' });
    });

    it('should update due date', async () => {
      const updatedRow: TaskRow = { ...sampleTaskRow, due_date: '2026-04-01' };
      mock.chain.single.mockResolvedValue({
        data: updatedRow,
        error: null,
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      const result = await repo.update('task-1', { dueDate: '2026-04-01' });

      expect(mock.chain.update).toHaveBeenCalledWith({ due_date: '2026-04-01' });
      expect(result.dueDate).toBe('2026-04-01');
    });

    it('should allow clearing due date by passing null', async () => {
      const updatedRow: TaskRow = { ...sampleTaskRow, due_date: null };
      mock.chain.single.mockResolvedValue({
        data: updatedRow,
        error: null,
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      const result = await repo.update('task-1', { dueDate: null });

      expect(mock.chain.update).toHaveBeenCalledWith({ due_date: null });
      expect(result.dueDate).toBeNull();
    });

    it('should throw when task not found', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      await expect(repo.update('nonexistent', { name: 'Test' })).rejects.toThrow(
        'Task not found: nonexistent',
      );
    });

    it('should throw on non-404 error', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Update failed' },
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      await expect(
        repo.update('task-1', { name: 'Test' }),
      ).rejects.toThrow('Failed to update task: Update failed');
    });
  });

  describe('remove', () => {
    it('should delete the task by id', async () => {
      mock.chain.eq.mockResolvedValue({ data: null, error: null });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      await repo.remove('task-1');

      expect(mock.from).toHaveBeenCalledWith('tasks');
      expect(mock.chain.delete).toHaveBeenCalled();
      expect(mock.chain.eq).toHaveBeenCalledWith('id', 'task-1');
    });

    it('should throw on Supabase error', async () => {
      mock.chain.eq.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      await expect(repo.remove('task-1')).rejects.toThrow(
        'Failed to delete task: Delete failed',
      );
    });
  });

  describe('complete', () => {
    it('should set completed_at and return the updated task', async () => {
      const completedRow: TaskRow = {
        ...sampleTaskRow,
        completed_at: '2026-03-24T15:00:00Z',
      };
      mock.chain.single.mockResolvedValue({
        data: completedRow,
        error: null,
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      const result = await repo.complete('task-1');

      expect(mock.chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          completed_at: expect.any(String),
        }),
      );
      expect(result.completedAt).toBe('2026-03-24T15:00:00Z');
    });

    it('should throw when task not found', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      await expect(repo.complete('nonexistent')).rejects.toThrow(
        'Task not found: nonexistent',
      );
    });

    it('should throw on Supabase error', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Complete failed' },
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      await expect(repo.complete('task-1')).rejects.toThrow(
        'Failed to complete task: Complete failed',
      );
    });
  });

  describe('uncomplete', () => {
    it('should set completed_at to null and return the updated task', async () => {
      mock.chain.single.mockResolvedValue({
        data: sampleTaskRow,
        error: null,
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      const result = await repo.uncomplete('task-2');

      expect(mock.chain.update).toHaveBeenCalledWith({ completed_at: null });
      expect(result.completedAt).toBeNull();
    });

    it('should throw when task not found', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      await expect(repo.uncomplete('nonexistent')).rejects.toThrow(
        'Task not found: nonexistent',
      );
    });

    it('should throw on Supabase error', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Uncomplete failed' },
      });

      const repo = createSupabaseTaskRepository(mock.client, USER_ID);
      await expect(repo.uncomplete('task-1')).rejects.toThrow(
        'Failed to uncomplete task: Uncomplete failed',
      );
    });
  });
});
