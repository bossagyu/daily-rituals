import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../lib/database.types';
import { createSupabaseCompletionRepository } from '../supabaseCompletionRepository';
import { DuplicateCompletionError } from '../completionRepository';
import type { Completion } from '../../../domain/models';

// --- Supabase mock builder ---

type CompletionRow = Database['public']['Tables']['completions']['Row'];

const createMockSupabase = () => {
  const chainMock = {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    single: vi.fn(),
  };

  chainMock.select.mockReturnValue(chainMock);
  chainMock.insert.mockReturnValue(chainMock);
  chainMock.delete.mockReturnValue(chainMock);
  chainMock.eq.mockReturnValue(chainMock);
  chainMock.gte.mockReturnValue(chainMock);
  chainMock.lte.mockReturnValue(chainMock);
  chainMock.single.mockReturnValue(chainMock);

  const from = vi.fn().mockReturnValue(chainMock);
  const client = { from } as unknown as SupabaseClient<Database>;

  return { client, from, chain: chainMock };
};

// --- Test data ---

const USER_ID = 'user-123';

const sampleRow: CompletionRow = {
  id: 'comp-1',
  user_id: USER_ID,
  habit_id: 'habit-1',
  completed_date: '2026-03-15',
  created_at: '2026-03-15T08:00:00Z',
};

const sampleCompletion: Completion = {
  id: 'comp-1',
  userId: USER_ID,
  habitId: 'habit-1',
  completedDate: '2026-03-15',
  createdAt: '2026-03-15T08:00:00Z',
};

describe('SupabaseCompletionRepository', () => {
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  describe('findByHabitId', () => {
    it('should return completions for a given habit', async () => {
      mock.chain.eq.mockResolvedValue({
        data: [sampleRow],
        error: null,
      });

      const repo = createSupabaseCompletionRepository(mock.client, USER_ID);
      const result = await repo.findByHabitId('habit-1');

      expect(mock.from).toHaveBeenCalledWith('completions');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(sampleCompletion);
    });

    it('should throw on Supabase error', async () => {
      mock.chain.eq.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      const repo = createSupabaseCompletionRepository(mock.client, USER_ID);
      await expect(repo.findByHabitId('habit-1')).rejects.toThrow(
        'Failed to fetch completions: Query failed',
      );
    });
  });

  describe('findByDate', () => {
    it('should return completions for a given date', async () => {
      mock.chain.eq.mockResolvedValue({
        data: [sampleRow],
        error: null,
      });

      const repo = createSupabaseCompletionRepository(mock.client, USER_ID);
      const result = await repo.findByDate('2026-03-15');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(sampleCompletion);
    });

    it('should throw on Supabase error', async () => {
      mock.chain.eq.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      const repo = createSupabaseCompletionRepository(mock.client, USER_ID);
      await expect(repo.findByDate('2026-03-15')).rejects.toThrow(
        'Failed to fetch completions by date: Query failed',
      );
    });
  });

  describe('findByHabitIdAndDateRange', () => {
    it('should return completions in a date range for a habit', async () => {
      mock.chain.lte.mockResolvedValue({
        data: [sampleRow],
        error: null,
      });

      const repo = createSupabaseCompletionRepository(mock.client, USER_ID);
      const result = await repo.findByHabitIdAndDateRange(
        'habit-1',
        '2026-03-01',
        '2026-03-31',
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(sampleCompletion);
    });

    it('should throw on Supabase error', async () => {
      mock.chain.lte.mockResolvedValue({
        data: null,
        error: { message: 'Range query failed' },
      });

      const repo = createSupabaseCompletionRepository(mock.client, USER_ID);
      await expect(
        repo.findByHabitIdAndDateRange('habit-1', '2026-03-01', '2026-03-31'),
      ).rejects.toThrow(
        'Failed to fetch completions by date range: Range query failed',
      );
    });
  });

  describe('create', () => {
    it('should insert a new completion and return the domain model', async () => {
      mock.chain.single.mockResolvedValue({
        data: sampleRow,
        error: null,
      });

      const repo = createSupabaseCompletionRepository(mock.client, USER_ID);
      const result = await repo.create('habit-1', '2026-03-15');

      expect(mock.chain.insert).toHaveBeenCalledWith({
        user_id: USER_ID,
        habit_id: 'habit-1',
        completed_date: '2026-03-15',
      });
      expect(result).toEqual(sampleCompletion);
    });

    it('should throw DuplicateCompletionError on unique constraint violation', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      });

      const repo = createSupabaseCompletionRepository(mock.client, USER_ID);
      await expect(repo.create('habit-1', '2026-03-15')).rejects.toThrow(
        DuplicateCompletionError,
      );
    });

    it('should throw generic error on other failures', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Insert failed' },
      });

      const repo = createSupabaseCompletionRepository(mock.client, USER_ID);
      await expect(repo.create('habit-1', '2026-03-15')).rejects.toThrow(
        'Failed to create completion: Insert failed',
      );
    });
  });

  describe('delete', () => {
    it('should delete a completion by habitId and date', async () => {
      // delete().eq('habit_id', ...) returns chainMock, then .eq('completed_date', ...) resolves
      mock.chain.eq
        .mockReturnValueOnce(mock.chain) // first .eq() returns chain for further chaining
        .mockResolvedValueOnce({ data: null, error: null }); // second .eq() resolves

      const repo = createSupabaseCompletionRepository(mock.client, USER_ID);
      await repo.delete('habit-1', '2026-03-15');

      expect(mock.from).toHaveBeenCalledWith('completions');
      expect(mock.chain.delete).toHaveBeenCalled();
    });

    it('should throw on Supabase error', async () => {
      mock.chain.eq
        .mockReturnValueOnce(mock.chain)
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Delete failed' },
        });

      const repo = createSupabaseCompletionRepository(mock.client, USER_ID);
      await expect(
        repo.delete('habit-1', '2026-03-15'),
      ).rejects.toThrow('Failed to delete completion: Delete failed');
    });
  });
});
