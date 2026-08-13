import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../lib/database.types';
import { createSupabaseProfileRepository } from '../supabaseProfileRepository';
import type { Profile } from '../profileRepository';

// --- Supabase mock builder ---

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

const createMockSupabase = () => {
  const chainMock = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };

  // Default chaining
  chainMock.select.mockReturnValue(chainMock);
  chainMock.update.mockReturnValue(chainMock);
  chainMock.eq.mockReturnValue(chainMock);
  chainMock.single.mockReturnValue(chainMock);

  const from = vi.fn().mockReturnValue(chainMock);
  const client = { from } as unknown as SupabaseClient<Database>;

  return { client, from, chain: chainMock };
};

// --- Test data ---

const USER_ID = 'u1';

const sampleProfileRow: ProfileRow = {
  id: USER_ID,
  display_name: 'ユーザー',
  timezone: 'Asia/Tokyo',
  created_at: '2026-04-08T10:00:00Z',
};

const sampleProfile: Profile = {
  id: USER_ID,
  displayName: 'ユーザー',
  timezone: 'Asia/Tokyo',
};

describe('createSupabaseProfileRepository', () => {
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  describe('findMine', () => {
    it('自分のプロフィールを返す', async () => {
      mock.chain.single.mockResolvedValue({
        data: sampleProfileRow,
        error: null,
      });

      const repo = createSupabaseProfileRepository(mock.client, USER_ID);
      const profile = await repo.findMine();

      expect(mock.from).toHaveBeenCalledWith('profiles');
      expect(mock.chain.eq).toHaveBeenCalledWith('id', USER_ID);
      expect(profile).toEqual(sampleProfile);
    });

    it('行が無ければ null を返す', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const repo = createSupabaseProfileRepository(mock.client, USER_ID);
      expect(await repo.findMine()).toBeNull();
    });

    it('PGRST116以外のエラーは投げる', async () => {
      mock.chain.single.mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'boom' },
      });

      const repo = createSupabaseProfileRepository(mock.client, USER_ID);
      await expect(repo.findMine()).rejects.toThrow(
        'Failed to fetch profile: boom',
      );
    });
  });

  describe('updateTimezone', () => {
    it('自分の行だけを更新する', async () => {
      mock.chain.eq.mockResolvedValue({ error: null });

      const repo = createSupabaseProfileRepository(mock.client, USER_ID);
      await repo.updateTimezone('America/New_York');

      expect(mock.from).toHaveBeenCalledWith('profiles');
      expect(mock.chain.update).toHaveBeenCalledWith({
        timezone: 'America/New_York',
      });
      expect(mock.chain.eq).toHaveBeenCalledWith('id', USER_ID);
    });

    it('エラーを投げる', async () => {
      mock.chain.eq.mockResolvedValue({ error: { message: 'boom' } });

      const repo = createSupabaseProfileRepository(mock.client, USER_ID);
      await expect(
        repo.updateTimezone('America/New_York'),
      ).rejects.toThrow('Failed to update timezone: boom');
    });
  });
});
