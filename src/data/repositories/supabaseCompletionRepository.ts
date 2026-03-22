/**
 * SupabaseCompletionRepository - Supabase implementation of CompletionRepository.
 *
 * Converts between Supabase completion rows (snake_case) and domain Completion models (camelCase).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';
import type { Completion } from '../../domain/models';
import type { CompletionRepository } from './completionRepository';
import { DuplicateCompletionError } from './completionRepository';

type CompletionRow = Database['public']['Tables']['completions']['Row'];

const UNIQUE_VIOLATION_CODE = '23505';

/**
 * Maps a Supabase completion row to a domain Completion model.
 */
const toDomainCompletion = (row: CompletionRow): Completion => ({
  id: row.id,
  userId: row.user_id,
  habitId: row.habit_id,
  completedDate: row.completed_date,
  createdAt: row.created_at,
});

/**
 * Creates a Supabase-backed CompletionRepository.
 *
 * @param client - Supabase client instance
 * @param userId - The authenticated user's ID (used for INSERT operations)
 */
export const createSupabaseCompletionRepository = (
  client: SupabaseClient<Database>,
  userId: string,
): CompletionRepository => ({
  async findByHabitId(habitId: string): Promise<Completion[]> {
    const { data, error } = await client
      .from('completions')
      .select()
      .eq('habit_id', habitId);

    if (error) {
      throw new Error(`Failed to fetch completions: ${error.message}`);
    }

    return (data ?? []).map(toDomainCompletion);
  },

  async findByDate(date: string): Promise<Completion[]> {
    const { data, error } = await client
      .from('completions')
      .select()
      .eq('completed_date', date);

    if (error) {
      throw new Error(
        `Failed to fetch completions by date: ${error.message}`,
      );
    }

    return (data ?? []).map(toDomainCompletion);
  },

  async findByHabitIdAndDateRange(
    habitId: string,
    startDate: string,
    endDate: string,
  ): Promise<Completion[]> {
    const { data, error } = await client
      .from('completions')
      .select()
      .eq('habit_id', habitId)
      .gte('completed_date', startDate)
      .lte('completed_date', endDate);

    if (error) {
      throw new Error(
        `Failed to fetch completions by date range: ${error.message}`,
      );
    }

    return (data ?? []).map(toDomainCompletion);
  },

  async findByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<Completion[]> {
    const { data, error } = await client
      .from('completions')
      .select()
      .gte('completed_date', startDate)
      .lte('completed_date', endDate);

    if (error) {
      throw new Error(
        `Failed to fetch completions by date range: ${error.message}`,
      );
    }

    return (data ?? []).map(toDomainCompletion);
  },

  async create(
    habitId: string,
    completedDate: string,
  ): Promise<Completion> {
    const { data, error } = await client
      .from('completions')
      .insert({
        user_id: userId,
        habit_id: habitId,
        completed_date: completedDate,
      })
      .select()
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION_CODE) {
        throw new DuplicateCompletionError(habitId, completedDate);
      }
      throw new Error(`Failed to create completion: ${error.message}`);
    }

    return toDomainCompletion(data);
  },

  async delete(habitId: string, completedDate: string): Promise<void> {
    const { error } = await client
      .from('completions')
      .delete()
      .eq('habit_id', habitId)
      .eq('completed_date', completedDate);

    if (error) {
      throw new Error(`Failed to delete completion: ${error.message}`);
    }
  },
});
