/**
 * SupabaseTaskRepository - Supabase implementation of TaskRepository.
 *
 * Converts between Supabase task rows (snake_case) and domain Task models (camelCase).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';
import type { Task, CreateTaskInput, UpdateTaskInput } from '../../domain/models/task';
import type { TaskRepository } from './taskRepository';

type TaskRow = Database['public']['Tables']['tasks']['Row'];

const NOT_FOUND_CODE = 'PGRST116';

/**
 * Maps a Supabase task row to a domain Task model.
 */
const toDomainTask = (row: TaskRow): Task => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  dueDate: row.due_date,
  completedAt: row.completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Computes the next day in YYYY-MM-DD format for timestamp range queries.
 */
const getNextDay = (date: string): string => {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Creates a Supabase-backed TaskRepository.
 *
 * @param client - Supabase client instance
 * @param userId - The authenticated user's ID (used for INSERT operations)
 */
export const createSupabaseTaskRepository = (
  client: SupabaseClient<Database>,
  userId: string,
): TaskRepository => ({
  async findByDate(date: string): Promise<Task[]> {
    const nextDay = getNextDay(date);

    const { data, error } = await client
      .from('tasks')
      .select()
      .or(
        `and(due_date.is.null,completed_at.is.null),and(due_date.lte.${date},completed_at.is.null),and(completed_at.gte.${date}T00:00:00,completed_at.lt.${nextDay}T00:00:00)`,
      );

    if (error) {
      throw new Error(`Failed to fetch tasks: ${error.message}`);
    }

    return (data ?? []).map(toDomainTask);
  },

  async create(input: CreateTaskInput): Promise<Task> {
    const { data, error } = await client
      .from('tasks')
      .insert({
        user_id: userId,
        name: input.name,
        due_date: input.dueDate,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }

    return toDomainTask(data);
  },

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const updateFields: Record<string, unknown> = {};

    if (input.name !== undefined) {
      updateFields.name = input.name;
    }
    if (input.dueDate !== undefined) {
      updateFields.due_date = input.dueDate;
    }

    const { data, error } = await client
      .from('tasks')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === NOT_FOUND_CODE) {
        throw new Error(`Task not found: ${id}`);
      }
      throw new Error(`Failed to update task: ${error.message}`);
    }

    return toDomainTask(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await client
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete task: ${error.message}`);
    }
  },

  async complete(id: string): Promise<Task> {
    const { data, error } = await client
      .from('tasks')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === NOT_FOUND_CODE) {
        throw new Error(`Task not found: ${id}`);
      }
      throw new Error(`Failed to complete task: ${error.message}`);
    }

    return toDomainTask(data);
  },

  async uncomplete(id: string): Promise<Task> {
    const { data, error } = await client
      .from('tasks')
      .update({ completed_at: null })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === NOT_FOUND_CODE) {
        throw new Error(`Task not found: ${id}`);
      }
      throw new Error(`Failed to uncomplete task: ${error.message}`);
    }

    return toDomainTask(data);
  },
});
