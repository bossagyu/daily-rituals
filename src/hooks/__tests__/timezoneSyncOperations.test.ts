import { describe, it, expect, vi } from 'vitest';
import { syncTimezone } from '../timezoneSyncOperations';
import type { ProfileRepository } from '@/data/repositories/profileRepository';

function makeRepo(timezone: string): ProfileRepository & {
  updateTimezone: ReturnType<typeof vi.fn>;
} {
  return {
    findMine: vi.fn().mockResolvedValue({
      id: 'u1',
      displayName: null,
      timezone,
    }),
    updateTimezone: vi.fn().mockResolvedValue(undefined),
  };
}

describe('syncTimezone', () => {
  it('DB と一致していれば更新しない', async () => {
    const repo = makeRepo('Asia/Tokyo');
    await syncTimezone(repo, 'Asia/Tokyo');
    expect(repo.updateTimezone).not.toHaveBeenCalled();
  });

  it('DB と異なれば更新する', async () => {
    const repo = makeRepo('Asia/Tokyo');
    await syncTimezone(repo, 'America/New_York');
    expect(repo.updateTimezone).toHaveBeenCalledWith('America/New_York');
  });

  it('不正なタイムゾーンでは更新しない', async () => {
    const repo = makeRepo('Asia/Tokyo');
    await syncTimezone(repo, 'Not/AZone');
    expect(repo.updateTimezone).not.toHaveBeenCalled();
  });

  it('プロフィールが無ければ更新しない', async () => {
    const repo = makeRepo('Asia/Tokyo');
    repo.findMine = vi.fn().mockResolvedValue(null);
    await syncTimezone(repo, 'America/New_York');
    expect(repo.updateTimezone).not.toHaveBeenCalled();
  });
});
