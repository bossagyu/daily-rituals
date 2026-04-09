import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../lib/database.types';
import { createSupabaseRewardRepository } from '../supabaseRewardRepository';
import { DuplicateRewardLevelError } from '../rewardRepository';
import type { Reward, CreateRewardInput } from '../../../domain/models';

// --- Supabase mock builder ---

type RewardRow = Database['public']['Tables']['rewards']['Row'];

const createMockSupabase = () => {
  const chainMock = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
  };

  // Default chaining
  chainMock.select.mockReturnValue(chainMock);
  chainMock.insert.mockReturnValue(chainMock);
  chainMock.update.mockReturnValue(chainMock);
  chainMock.delete.mockReturnValue(chainMock);
  chainMock.eq.mockReturnValue(chainMock);
  chainMock.order.mockReturnValue(chainMock);
  chainMock.single.mockReturnValue(chainMock);

  const from = vi.fn().mockReturnValue(chainMock);
  const client = { from } as unknown as SupabaseClient<Database>;

  return { client, from, chain: chainMock };
};

// --- Test data ---

const USER_ID = 'user-123';

const sampleRewardRow: RewardRow = {
  id: 'reward-1',
  user_id: USER_ID,
  level: 5,
  description: 'Watch a movie',
  created_at: '2026-04-08T10:00:00Z',
  updated_at: '2026-04-08T10:00:00Z',
};

const sampleReward: Reward = {
  id: 'reward-1',
  userId: USER_ID,
  level: 5,
  description: 'Watch a movie',
  createdAt: '2026-04-08T10:00:00Z',
  updatedAt: '2026-04-08T10:00:00Z',
};

const sampleRewardRow2: RewardRow = {
  id: 'reward-2',
  user_id: USER_ID,
  level: 10,
  description: 'Buy new book',
  created_at: '2026-04-08T11:00:00Z',
  updated_at: '2026-04-08T11:00:00Z',
};

describe('SupabaseRewardRepository', () => {
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  describe('findAll', () => {
    it('should return rewards mapped to domain models, ordered by level ascending', async () => {
      mock.chain.order.mockResolvedValue({
        data: [sampleRewardRow, sampleRewardRow2],
        error: null,
      });

      const repo = createSupabaseRewardRepository(mock.client, USER_ID);
      const result = await repo.findAll();

      expect(mock.from).toHaveBeenCalledWith('rewards');
      expect(mock.chain.order).toHaveBeenCalledWith('level', { ascending: true });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(sampleReward);
      expect(result[1]).toEqual({
        id: 'reward-2',
        userId: USER_ID,
        level: 10,
        description: 'Buy new book',
        createdAt: '2026-04-08T11:00:00Z',
        updatedAt: '2026-04-08T11:00:00Z',
      });
    });

    it('should return empty array when no rewards exist', async () => {
      mock.chain.order.mockResolvedValue({
        data: [],
        error: null,
      });

      const repo = createSupabaseRewardRepository(mock.client, USER_ID);
      const result = await repo.findAll();

      expect(result).toEqual([]);
    });

    it('should throw on Supabase error', async () => {
      mock.chain.order.mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });

      const repo = createSupabaseRewardRepository(mock.client, USER_ID);
      await expect(repo.findAll()).rejects.toThrow(
        'Failed to fetch rewards: Network error',
      );
    });
  });

  describe('create', () => {
    it('should insert a new reward and return the domain model', async () => {
      const input: CreateRewardInput = {
        level: 5,
        description: 'Watch a movie',
      };

      mock.chain.single.mockResolvedValue({
        data: sampleRewardRow,
        error: null,
      });

      const repo = createSupabaseRewardRepository(mock.client, USER_ID);
      const result = await repo.create(input);

      expect(mock.from).toHaveBeenCalledWith('rewards');
      expect(mock.chain.insert).toHaveBeenCalledWith({
        user_id: USER_ID,
        level: 5,
        description: 'Watch a movie',
      });
      expect(result).toEqual(sampleReward);
    });

    it('should throw a DuplicateRewardLevelError with the conflicting level on UNIQUE constraint violation', async () => {
      const input: CreateRewardInput = {
        level: 5,
        description: 'Duplicate level',
      };

      mock.chain.single.mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "uq_rewards_user_level"',
        },
      });

      const repo = createSupabaseRewardRepository(mock.client, USER_ID);
      await expect(repo.create(input)).rejects.toBeInstanceOf(DuplicateRewardLevelError);
      // Re-trigger to check level field (separate call because rejects.toBeInstanceOf consumes the rejection)
      mock.chain.single.mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "uq_rewards_user_level"',
        },
      });
      try {
        await repo.create(input);
        throw new Error('expected rejection');
      } catch (err) {
        expect(err).toBeInstanceOf(DuplicateRewardLevelError);
        expect((err as DuplicateRewardLevelError).level).toBe(5);
        expect((err as DuplicateRewardLevelError).message).toBe(
          'Reward already exists for level: 5',
        );
      }
    });

    it('should throw on generic Supabase error', async () => {
      const input: CreateRewardInput = {
        level: 5,
        description: 'Test',
      };

      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Insert failed' },
      });

      const repo = createSupabaseRewardRepository(mock.client, USER_ID);
      await expect(repo.create(input)).rejects.toThrow(
        'Failed to create reward: Insert failed',
      );
    });
  });

  describe('update', () => {
    it('should update only the description field', async () => {
      const updatedRow: RewardRow = {
        ...sampleRewardRow,
        description: 'Watch two movies',
      };
      mock.chain.single.mockResolvedValue({
        data: updatedRow,
        error: null,
      });

      const repo = createSupabaseRewardRepository(mock.client, USER_ID);
      const result = await repo.update('reward-1', { description: 'Watch two movies' });

      expect(mock.chain.update).toHaveBeenCalledWith({ description: 'Watch two movies' });
      expect(mock.chain.eq).toHaveBeenCalledWith('id', 'reward-1');
      expect(result.description).toBe('Watch two movies');
    });

    it('should throw when reward not found', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const repo = createSupabaseRewardRepository(mock.client, USER_ID);
      await expect(
        repo.update('nonexistent', { description: 'Test' }),
      ).rejects.toThrow('Reward not found: nonexistent');
    });

    it('should throw on non-404 error', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Update failed' },
      });

      const repo = createSupabaseRewardRepository(mock.client, USER_ID);
      await expect(
        repo.update('reward-1', { description: 'Test' }),
      ).rejects.toThrow('Failed to update reward: Update failed');
    });
  });

  describe('remove', () => {
    it('should delete the reward by id', async () => {
      mock.chain.eq.mockResolvedValue({ data: null, error: null });

      const repo = createSupabaseRewardRepository(mock.client, USER_ID);
      await repo.remove('reward-1');

      expect(mock.from).toHaveBeenCalledWith('rewards');
      expect(mock.chain.delete).toHaveBeenCalled();
      expect(mock.chain.eq).toHaveBeenCalledWith('id', 'reward-1');
    });

    it('should throw on Supabase error', async () => {
      mock.chain.eq.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });

      const repo = createSupabaseRewardRepository(mock.client, USER_ID);
      await expect(repo.remove('reward-1')).rejects.toThrow(
        'Failed to delete reward: Delete failed',
      );
    });
  });
});
