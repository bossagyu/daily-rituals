/**
 * @vitest-environment jsdom
 */

/**
 * useTimezoneSync guard tests - Verifies the `if (!repository) return;`
 * guard in useTimezoneSync.ts actually prevents syncTimezone from running
 * when no repository is available.
 *
 * Kept in a separate file from useTimezoneSync.test.tsx: this file mocks
 * ./timezoneSyncOperations so we can assert `syncTimezone` was (not) called
 * directly, but that mock would replace the real syncTimezone that
 * useTimezoneSync.test.tsx's "swallows errors" test relies on to turn a
 * real repository.findMine() rejection into a caught error. Mixing the two
 * in one file would silently weaken that test.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ProfileRepository } from '../../data/repositories/profileRepository';
import { useTimezoneSync } from '../useTimezoneSync';
import { syncTimezone } from '../timezoneSyncOperations';

vi.mock('../timezoneSyncOperations', () => ({
  syncTimezone: vi.fn().mockResolvedValue(undefined),
}));

const mockSyncTimezone = vi.mocked(syncTimezone);

const makeRepository = (): ProfileRepository => ({
  findMine: vi.fn().mockResolvedValue({
    id: 'u1',
    displayName: null,
    timezone: 'Asia/Tokyo',
  }),
  updateTimezone: vi.fn().mockResolvedValue(undefined),
});

describe('useTimezoneSync guard', () => {
  it('never calls syncTimezone when there is no repository', async () => {
    renderHook(() => useTimezoneSync(null));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockSyncTimezone).not.toHaveBeenCalled();
  });

  it('calls syncTimezone when a repository is provided (sanity check that the mock is wired up)', async () => {
    const repository = makeRepository();

    renderHook(() => useTimezoneSync(repository));

    await waitFor(() => {
      expect(mockSyncTimezone).toHaveBeenCalledWith(repository, expect.any(String));
    });
  });
});
