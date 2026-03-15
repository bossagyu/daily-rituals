import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../lib/database.types';
import { createSupabaseHabitRepository } from '../supabaseHabitRepository';
import type { Habit, CreateHabitInput } from '../../../domain/models';

// --- Supabase mock builder ---

type HabitRow = Database['public']['Tables']['habits']['Row'];

const createMockSupabase = () => {
  const chainMock = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    not: vi.fn(),
    single: vi.fn(),
  };

  // By default, each method returns chainMock for chaining
  chainMock.select.mockReturnValue(chainMock);
  chainMock.insert.mockReturnValue(chainMock);
  chainMock.update.mockReturnValue(chainMock);
  chainMock.delete.mockReturnValue(chainMock);
  chainMock.eq.mockReturnValue(chainMock);
  chainMock.is.mockReturnValue(chainMock);
  chainMock.not.mockReturnValue(chainMock);
  chainMock.single.mockReturnValue(chainMock);

  const from = vi.fn().mockReturnValue(chainMock);

  const client = { from } as unknown as SupabaseClient<Database>;

  return { client, from, chain: chainMock };
};

// --- Test data ---

const USER_ID = 'user-123';

const sampleHabitRow: HabitRow = {
  id: 'habit-1',
  user_id: USER_ID,
  name: 'Morning run',
  frequency_type: 'daily',
  frequency_value: null,
  color: '#FF0000',
  created_at: '2026-01-01T00:00:00Z',
  archived_at: null,
};

const sampleHabit: Habit = {
  id: 'habit-1',
  userId: USER_ID,
  name: 'Morning run',
  frequency: { type: 'daily' },
  color: '#FF0000',
  createdAt: '2026-01-01T00:00:00Z',
  archivedAt: null,
};

const weeklyDaysRow: HabitRow = {
  id: 'habit-2',
  user_id: USER_ID,
  name: 'Gym',
  frequency_type: 'weekly_days',
  frequency_value: [1, 3, 5],
  color: '#00FF00',
  created_at: '2026-01-02T00:00:00Z',
  archived_at: null,
};

const weeklyCountRow: HabitRow = {
  id: 'habit-3',
  user_id: USER_ID,
  name: 'Read',
  frequency_type: 'weekly_count',
  frequency_value: 3,
  color: '#0000FF',
  created_at: '2026-01-03T00:00:00Z',
  archived_at: null,
};

describe('SupabaseHabitRepository', () => {
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  describe('findAll', () => {
    it('should return all non-archived habits mapped to domain models', async () => {
      // Resolve the final chain call with data
      mock.chain.is.mockResolvedValue({
        data: [sampleHabitRow, weeklyDaysRow, weeklyCountRow],
        error: null,
      });

      const repo = createSupabaseHabitRepository(mock.client, USER_ID);
      const result = await repo.findAll();

      expect(mock.from).toHaveBeenCalledWith('habits');
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(sampleHabit);
      expect(result[1]).toEqual({
        id: 'habit-2',
        userId: USER_ID,
        name: 'Gym',
        frequency: { type: 'weekly_days', days: [1, 3, 5] },
        color: '#00FF00',
        createdAt: '2026-01-02T00:00:00Z',
        archivedAt: null,
      });
      expect(result[2]).toEqual({
        id: 'habit-3',
        userId: USER_ID,
        name: 'Read',
        frequency: { type: 'weekly_count', count: 3 },
        color: '#0000FF',
        createdAt: '2026-01-03T00:00:00Z',
        archivedAt: null,
      });
    });

    it('should throw on Supabase error', async () => {
      mock.chain.is.mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });

      const repo = createSupabaseHabitRepository(mock.client, USER_ID);
      await expect(repo.findAll()).rejects.toThrow(
        'Failed to fetch habits: Network error',
      );
    });
  });

  describe('findById', () => {
    it('should return a habit by ID', async () => {
      mock.chain.single.mockResolvedValue({
        data: sampleHabitRow,
        error: null,
      });

      const repo = createSupabaseHabitRepository(mock.client, USER_ID);
      const result = await repo.findById('habit-1');

      expect(result).toEqual(sampleHabit);
    });

    it('should return null when not found', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const repo = createSupabaseHabitRepository(mock.client, USER_ID);
      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw on non-404 error', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Server error' },
      });

      const repo = createSupabaseHabitRepository(mock.client, USER_ID);
      await expect(repo.findById('habit-1')).rejects.toThrow(
        'Failed to fetch habit: Server error',
      );
    });
  });

  describe('create', () => {
    it('should insert a new habit and return the domain model', async () => {
      const input: CreateHabitInput = {
        userId: USER_ID,
        name: 'Morning run',
        frequency: { type: 'daily' },
        color: '#FF0000',
      };

      mock.chain.single.mockResolvedValue({
        data: sampleHabitRow,
        error: null,
      });

      const repo = createSupabaseHabitRepository(mock.client, USER_ID);
      const result = await repo.create(input);

      expect(mock.from).toHaveBeenCalledWith('habits');
      expect(mock.chain.insert).toHaveBeenCalledWith({
        user_id: USER_ID,
        name: 'Morning run',
        frequency_type: 'daily',
        frequency_value: '{}',
        color: '#FF0000',
      });
      expect(result).toEqual(sampleHabit);
    });

    it('should handle weekly_days frequency on create', async () => {
      const input: CreateHabitInput = {
        userId: USER_ID,
        name: 'Gym',
        frequency: { type: 'weekly_days', days: [1, 3, 5] },
        color: '#00FF00',
      };

      mock.chain.single.mockResolvedValue({
        data: weeklyDaysRow,
        error: null,
      });

      const repo = createSupabaseHabitRepository(mock.client, USER_ID);
      const result = await repo.create(input);

      expect(mock.chain.insert).toHaveBeenCalledWith({
        user_id: USER_ID,
        name: 'Gym',
        frequency_type: 'weekly_days',
        frequency_value: '[1,3,5]',
        color: '#00FF00',
      });
      expect(result.frequency).toEqual({ type: 'weekly_days', days: [1, 3, 5] });
    });

    it('should throw on Supabase error', async () => {
      const input: CreateHabitInput = {
        userId: USER_ID,
        name: 'Test',
        frequency: { type: 'daily' },
        color: '#000',
      };

      mock.chain.single.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });

      const repo = createSupabaseHabitRepository(mock.client, USER_ID);
      await expect(repo.create(input)).rejects.toThrow(
        'Failed to create habit: Insert failed',
      );
    });
  });

  describe('update', () => {
    it('should update a habit and return the updated domain model', async () => {
      const updatedRow: HabitRow = { ...sampleHabitRow, name: 'Evening run' };
      mock.chain.single.mockResolvedValue({
        data: updatedRow,
        error: null,
      });

      const repo = createSupabaseHabitRepository(mock.client, USER_ID);
      const result = await repo.update('habit-1', { name: 'Evening run' });

      expect(mock.chain.update).toHaveBeenCalledWith({ name: 'Evening run' });
      expect(result).toEqual({ ...sampleHabit, name: 'Evening run' });
    });

    it('should update frequency fields when frequency is provided', async () => {
      const updatedRow: HabitRow = {
        ...sampleHabitRow,
        frequency_type: 'weekly_count',
        frequency_value: 5,
      };
      mock.chain.single.mockResolvedValue({
        data: updatedRow,
        error: null,
      });

      const repo = createSupabaseHabitRepository(mock.client, USER_ID);
      await repo.update('habit-1', {
        frequency: { type: 'weekly_count', count: 5 },
      });

      expect(mock.chain.update).toHaveBeenCalledWith({
        frequency_type: 'weekly_count',
        frequency_value: '5',
      });
    });

    it('should return null when habit not found', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const repo = createSupabaseHabitRepository(mock.client, USER_ID);
      const result = await repo.update('nonexistent', { name: 'Test' });

      expect(result).toBeNull();
    });

    it('should throw on non-404 error', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Update failed' },
      });

      const repo = createSupabaseHabitRepository(mock.client, USER_ID);
      await expect(
        repo.update('habit-1', { name: 'Test' }),
      ).rejects.toThrow('Failed to update habit: Update failed');
    });
  });

  describe('archive', () => {
    it('should set archived_at on the habit', async () => {
      mock.chain.eq.mockResolvedValue({ data: null, error: null });

      const repo = createSupabaseHabitRepository(mock.client, USER_ID);
      await repo.archive('habit-1');

      expect(mock.chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          archived_at: expect.any(String),
        }),
      );
    });

    it('should throw on Supabase error', async () => {
      mock.chain.eq.mockResolvedValue({
        data: null,
        error: { message: 'Archive failed' },
      });

      const repo = createSupabaseHabitRepository(mock.client, USER_ID);
      await expect(repo.archive('habit-1')).rejects.toThrow(
        'Failed to archive habit: Archive failed',
      );
    });
  });

  describe('findArchived', () => {
    it('should return archived habits', async () => {
      const archivedRow: HabitRow = {
        ...sampleHabitRow,
        archived_at: '2026-06-01T00:00:00Z',
      };
      mock.chain.not.mockResolvedValue({
        data: [archivedRow],
        error: null,
      });

      const repo = createSupabaseHabitRepository(mock.client, USER_ID);
      const result = await repo.findArchived();

      expect(result).toHaveLength(1);
      expect(result[0].archivedAt).toBe('2026-06-01T00:00:00Z');
    });

    it('should throw on Supabase error', async () => {
      mock.chain.not.mockResolvedValue({
        data: null,
        error: { message: 'Fetch failed' },
      });

      const repo = createSupabaseHabitRepository(mock.client, USER_ID);
      await expect(repo.findArchived()).rejects.toThrow(
        'Failed to fetch archived habits: Fetch failed',
      );
    });
  });
});
