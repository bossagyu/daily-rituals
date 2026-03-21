import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../lib/database.types';
import { createSupabasePushSubscriptionRepository } from '../supabasePushSubscriptionRepository';
import type {
  PushSubscription,
  CreatePushSubscriptionInput,
} from '../../../domain/models/pushSubscription';

// --- Supabase mock builder ---

type PushSubscriptionRow =
  Database['public']['Tables']['push_subscriptions']['Row'];

const createMockSupabase = () => {
  const chainMock = {
    select: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };

  chainMock.select.mockReturnValue(chainMock);
  chainMock.upsert.mockReturnValue(chainMock);
  chainMock.delete.mockReturnValue(chainMock);
  chainMock.eq.mockReturnValue(chainMock);
  chainMock.single.mockReturnValue(chainMock);

  const from = vi.fn().mockReturnValue(chainMock);

  const client = { from } as unknown as SupabaseClient<Database>;

  return { client, from, chain: chainMock };
};

// --- Test data ---

const USER_ID = 'user-123';

const sampleRow: PushSubscriptionRow = {
  id: 'sub-1',
  user_id: USER_ID,
  endpoint: 'https://push.example.com/sub1',
  p256dh: 'p256dh-key-1',
  auth: 'auth-key-1',
  created_at: '2026-01-01T00:00:00Z',
};

const sampleSubscription: PushSubscription = {
  id: 'sub-1',
  userId: USER_ID,
  endpoint: 'https://push.example.com/sub1',
  p256dh: 'p256dh-key-1',
  auth: 'auth-key-1',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('SupabasePushSubscriptionRepository', () => {
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  describe('upsert', () => {
    it('should upsert a subscription and return the domain model', async () => {
      mock.chain.single.mockResolvedValue({
        data: sampleRow,
        error: null,
      });

      const input: CreatePushSubscriptionInput = {
        endpoint: 'https://push.example.com/sub1',
        p256dh: 'p256dh-key-1',
        auth: 'auth-key-1',
      };

      const repo = createSupabasePushSubscriptionRepository(
        mock.client,
        USER_ID,
      );
      const result = await repo.upsert(input);

      expect(mock.from).toHaveBeenCalledWith('push_subscriptions');
      expect(mock.chain.upsert).toHaveBeenCalledWith(
        {
          user_id: USER_ID,
          endpoint: 'https://push.example.com/sub1',
          p256dh: 'p256dh-key-1',
          auth: 'auth-key-1',
        },
        { onConflict: 'endpoint' },
      );
      expect(result).toEqual(sampleSubscription);
    });

    it('should throw on Supabase error', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { message: 'Upsert failed' },
      });

      const input: CreatePushSubscriptionInput = {
        endpoint: 'https://push.example.com/sub1',
        p256dh: 'p256dh-key-1',
        auth: 'auth-key-1',
      };

      const repo = createSupabasePushSubscriptionRepository(
        mock.client,
        USER_ID,
      );
      await expect(repo.upsert(input)).rejects.toThrow(
        'Failed to upsert push subscription: Upsert failed',
      );
    });
  });

  describe('findByEndpoint', () => {
    it('should return a subscription when found', async () => {
      mock.chain.single.mockResolvedValue({
        data: sampleRow,
        error: null,
      });

      const repo = createSupabasePushSubscriptionRepository(
        mock.client,
        USER_ID,
      );
      const result = await repo.findByEndpoint(
        'https://push.example.com/sub1',
      );

      expect(mock.from).toHaveBeenCalledWith('push_subscriptions');
      expect(mock.chain.eq).toHaveBeenCalledWith(
        'endpoint',
        'https://push.example.com/sub1',
      );
      expect(result).toEqual(sampleSubscription);
    });

    it('should return null when not found (PGRST116)', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const repo = createSupabasePushSubscriptionRepository(
        mock.client,
        USER_ID,
      );
      const result = await repo.findByEndpoint(
        'https://push.example.com/nonexistent',
      );

      expect(result).toBeNull();
    });

    it('should throw on non-404 error', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Server error' },
      });

      const repo = createSupabasePushSubscriptionRepository(
        mock.client,
        USER_ID,
      );
      await expect(
        repo.findByEndpoint('https://push.example.com/sub1'),
      ).rejects.toThrow('Failed to find push subscription: Server error');
    });
  });

  describe('deleteByEndpoint', () => {
    it('should delete a subscription by endpoint', async () => {
      mock.chain.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      const repo = createSupabasePushSubscriptionRepository(
        mock.client,
        USER_ID,
      );
      await repo.deleteByEndpoint('https://push.example.com/sub1');

      expect(mock.from).toHaveBeenCalledWith('push_subscriptions');
      expect(mock.chain.delete).toHaveBeenCalled();
      expect(mock.chain.eq).toHaveBeenCalledWith(
        'endpoint',
        'https://push.example.com/sub1',
      );
    });

    it('should throw on Supabase error', async () => {
      mock.chain.eq.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });

      const repo = createSupabasePushSubscriptionRepository(
        mock.client,
        USER_ID,
      );
      await expect(
        repo.deleteByEndpoint('https://push.example.com/sub1'),
      ).rejects.toThrow('Failed to delete push subscription: Delete failed');
    });
  });
});
