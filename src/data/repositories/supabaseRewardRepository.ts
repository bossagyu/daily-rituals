/**
 * SupabaseRewardRepository - Supabase implementation of RewardRepository.
 *
 * Converts between Supabase reward rows (snake_case) and domain Reward models (camelCase).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';
import type { Reward, CreateRewardInput, UpdateRewardInput } from '../../domain/models/reward';
import type { RewardRepository } from './rewardRepository';
import { DuplicateRewardLevelError } from './rewardRepository';

type RewardRow = Database['public']['Tables']['rewards']['Row'];

const NOT_FOUND_CODE = 'PGRST116';
const UNIQUE_VIOLATION_CODE = '23505';

/**
 * Maps a Supabase reward row to a domain Reward model.
 */
const toDomainReward = (row: RewardRow): Reward => ({
  id: row.id,
  userId: row.user_id,
  level: row.level,
  description: row.description,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Creates a Supabase-backed RewardRepository.
 *
 * @param client - Supabase client instance
 * @param userId - The authenticated user's ID (used for INSERT operations)
 */
export const createSupabaseRewardRepository = (
  client: SupabaseClient<Database>,
  userId: string,
): RewardRepository => ({
  async findAll(): Promise<Reward[]> {
    const { data, error } = await client
      .from('rewards')
      .select()
      .order('level', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch rewards: ${error.message}`);
    }

    return (data ?? []).map(toDomainReward);
  },

  async create(input: CreateRewardInput): Promise<Reward> {
    const { data, error } = await client
      .from('rewards')
      .insert({
        user_id: userId,
        level: input.level,
        description: input.description,
      })
      .select()
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION_CODE) {
        throw new DuplicateRewardLevelError(input.level);
      }
      throw new Error(`Failed to create reward: ${error.message}`);
    }

    return toDomainReward(data);
  },

  async update(id: string, input: UpdateRewardInput): Promise<Reward> {
    const { data, error } = await client
      .from('rewards')
      .update({ description: input.description })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === NOT_FOUND_CODE) {
        throw new Error(`Reward not found: ${id}`);
      }
      throw new Error(`Failed to update reward: ${error.message}`);
    }

    return toDomainReward(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await client
      .from('rewards')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete reward: ${error.message}`);
    }
  },
});
