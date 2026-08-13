/**
 * SupabaseProfileRepository - ProfileRepository の Supabase 実装。
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';
import type { Profile, ProfileRepository } from './profileRepository';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

const NOT_FOUND_CODE = 'PGRST116';

/**
 * Maps a Supabase profile row to a domain Profile model.
 */
const toDomainProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  displayName: row.display_name,
  timezone: row.timezone,
});

export const createSupabaseProfileRepository = (
  client: SupabaseClient<Database>,
  userId: string,
): ProfileRepository => ({
  async findMine(): Promise<Profile | null> {
    const { data, error } = await client
      .from('profiles')
      .select()
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === NOT_FOUND_CODE) {
        return null;
      }
      throw new Error(`Failed to fetch profile: ${error.message}`);
    }

    if (!data) return null;

    return toDomainProfile(data);
  },

  async updateTimezone(timezone: string): Promise<void> {
    const { error } = await client
      .from('profiles')
      .update({ timezone })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update timezone: ${error.message}`);
    }
  },
});
