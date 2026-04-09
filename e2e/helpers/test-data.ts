import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  SUPABASE_LOCAL_URL,
  SUPABASE_LOCAL_SERVICE_ROLE_KEY,
} from '../../playwright.config';

export function createAdminClient(): SupabaseClient {
  return createClient(SUPABASE_LOCAL_URL, SUPABASE_LOCAL_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export type SeedHabitOverrides = {
  readonly name?: string;
  readonly frequencyType?: 'daily' | 'weekly_days' | 'weekly_count';
  readonly frequencyValue?: unknown;
  readonly color?: string;
  readonly archivedAt?: string | null;
  readonly reminderTime?: string | null;
  readonly createdAt?: string;
};

export async function seedHabit(
  userId: string,
  overrides: SeedHabitOverrides = {},
): Promise<{ id: string }> {
  const admin = createAdminClient();
  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    name: overrides.name ?? 'E2Eテスト習慣',
    frequency_type: overrides.frequencyType ?? 'daily',
    frequency_value: overrides.frequencyValue ?? null,
    color: overrides.color ?? '#6366f1',
    archived_at: overrides.archivedAt ?? null,
    reminder_time: overrides.reminderTime ?? null,
  };
  if (overrides.createdAt !== undefined) {
    insertPayload.created_at = overrides.createdAt;
  }

  const { data, error } = await admin
    .from('habits')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to seed habit: ${error.message}`);
  }

  return { id: data.id };
}

export async function seedCompletion(
  userId: string,
  habitId: string,
  date: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('completions').insert({
    user_id: userId,
    habit_id: habitId,
    completed_date: date,
  });

  if (error) {
    throw new Error(`Failed to seed completion: ${error.message}`);
  }
}

export async function seedReward(
  userId: string,
  level: number,
  description: string,
): Promise<{ id: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('rewards')
    .insert({ user_id: userId, level, description })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to seed reward: ${error.message}`);
  }

  return { id: data.id };
}

export async function cleanupTestData(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from('push_subscriptions').delete().eq('user_id', userId);
  await admin.from('completions').delete().eq('user_id', userId);
  await admin.from('tasks').delete().eq('user_id', userId);
  await admin.from('rewards').delete().eq('user_id', userId);
  await admin.from('habits').delete().eq('user_id', userId);
}
