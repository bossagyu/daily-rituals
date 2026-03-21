import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';
import type {
  PushSubscription,
  CreatePushSubscriptionInput,
} from '../../domain/models/pushSubscription';
import type { PushSubscriptionRepository } from './pushSubscriptionRepository';

type PushSubscriptionRow =
  Database['public']['Tables']['push_subscriptions']['Row'];

const NOT_FOUND_CODE = 'PGRST116';

const toDomainSubscription = (row: PushSubscriptionRow): PushSubscription => ({
  id: row.id,
  userId: row.user_id,
  endpoint: row.endpoint,
  p256dh: row.p256dh,
  auth: row.auth,
  createdAt: row.created_at,
});

export const createSupabasePushSubscriptionRepository = (
  client: SupabaseClient<Database>,
  userId: string,
): PushSubscriptionRepository => ({
  async upsert(input: CreatePushSubscriptionInput) {
    const { data, error } = await client
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
        },
        { onConflict: 'endpoint' },
      )
      .select()
      .single();
    if (error)
      throw new Error(
        `Failed to upsert push subscription: ${error.message}`,
      );
    return toDomainSubscription(data);
  },

  async findByEndpoint(endpoint: string) {
    const { data, error } = await client
      .from('push_subscriptions')
      .select()
      .eq('endpoint', endpoint)
      .single();
    if (error) {
      if (error.code === NOT_FOUND_CODE) return null;
      throw new Error(
        `Failed to find push subscription: ${error.message}`,
      );
    }
    return data ? toDomainSubscription(data) : null;
  },

  async deleteByEndpoint(endpoint: string) {
    const { error } = await client
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);
    if (error)
      throw new Error(
        `Failed to delete push subscription: ${error.message}`,
      );
  },
});
