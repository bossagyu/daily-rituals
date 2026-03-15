/**
 * SupabaseHabitRepository - Supabase implementation of HabitRepository.
 *
 * Converts between Supabase habit rows (snake_case) and domain Habit models (camelCase).
 * Reuses toFrequency and toFrequencyDbFields mapper functions.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';
import type { Habit, CreateHabitInput } from '../../domain/models';
import type { HabitRepository, UpdateHabitInput } from './habitRepository';
import { toFrequency, toFrequencyDbFields } from './habitRepository';

type HabitRow = Database['public']['Tables']['habits']['Row'];

const NOT_FOUND_CODE = 'PGRST116';

/**
 * Maps a Supabase habit row to a domain Habit model.
 */
const toDomainHabit = (row: HabitRow): Habit => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  frequency: toFrequency(
    row.frequency_type,
    row.frequency_value != null
      ? typeof row.frequency_value === 'string'
        ? row.frequency_value
        : JSON.stringify(row.frequency_value)
      : '{}',
  ),
  color: row.color,
  createdAt: row.created_at,
  archivedAt: row.archived_at,
});

/**
 * Creates a Supabase-backed HabitRepository.
 *
 * @param client - Supabase client instance
 * @param userId - The authenticated user's ID (used for INSERT operations)
 */
export const createSupabaseHabitRepository = (
  client: SupabaseClient<Database>,
  userId: string,
): HabitRepository => ({
  async findAll(): Promise<Habit[]> {
    const { data, error } = await client
      .from('habits')
      .select()
      .is('archived_at', null);

    if (error) {
      throw new Error(`Failed to fetch habits: ${error.message}`);
    }

    return (data ?? []).map(toDomainHabit);
  },

  async findById(id: string): Promise<Habit | null> {
    const { data, error } = await client
      .from('habits')
      .select()
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === NOT_FOUND_CODE) {
        return null;
      }
      throw new Error(`Failed to fetch habit: ${error.message}`);
    }

    return data ? toDomainHabit(data) : null;
  },

  async create(input: CreateHabitInput): Promise<Habit> {
    const { frequencyType, frequencyValue } = toFrequencyDbFields(
      input.frequency,
    );

    const { data, error } = await client
      .from('habits')
      .insert({
        user_id: userId,
        name: input.name,
        frequency_type: frequencyType,
        frequency_value: frequencyValue,
        color: input.color,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create habit: ${error.message}`);
    }

    return toDomainHabit(data);
  },

  async update(
    id: string,
    input: UpdateHabitInput,
  ): Promise<Habit | null> {
    const updateFields: Record<string, unknown> = {};

    if (input.name !== undefined) {
      updateFields.name = input.name;
    }
    if (input.color !== undefined) {
      updateFields.color = input.color;
    }
    if (input.frequency !== undefined) {
      const { frequencyType, frequencyValue } = toFrequencyDbFields(
        input.frequency,
      );
      updateFields.frequency_type = frequencyType;
      updateFields.frequency_value = frequencyValue;
    }

    const { data, error } = await client
      .from('habits')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === NOT_FOUND_CODE) {
        return null;
      }
      throw new Error(`Failed to update habit: ${error.message}`);
    }

    return data ? toDomainHabit(data) : null;
  },

  async archive(id: string): Promise<void> {
    const { error } = await client
      .from('habits')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to archive habit: ${error.message}`);
    }
  },

  async findArchived(): Promise<Habit[]> {
    const { data, error } = await client
      .from('habits')
      .select()
      .not('archived_at', 'is', null);

    if (error) {
      throw new Error(
        `Failed to fetch archived habits: ${error.message}`,
      );
    }

    return (data ?? []).map(toDomainHabit);
  },
});
