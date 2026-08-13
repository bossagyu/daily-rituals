/**
 * @vitest-environment jsdom
 */

/**
 * useTimezoneSync tests - Verifies the hook wires up syncTimezone on mount
 * (the null-repository guard, and the "never break the app" best-effort
 * failure handling). Branch-level behavior of syncTimezone itself is
 * covered by timezoneSyncOperations.test.ts; these tests focus on whether
 * the hook actually invokes it when mounted, and swallows its failures.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ProfileRepository } from '../../data/repositories/profileRepository';
import { useTimezoneSync } from '../useTimezoneSync';

const makeRepository = (
  overrides: Partial<ProfileRepository> = {},
): ProfileRepository => ({
  findMine: vi.fn().mockResolvedValue({
    id: 'u1',
    displayName: null,
    timezone: 'Asia/Tokyo',
  }),
  updateTimezone: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('useTimezoneSync', () => {
  it('does nothing when there is no repository', async () => {
    renderHook(() => useTimezoneSync(null));

    await new Promise((resolve) => setTimeout(resolve, 0));
    // Nothing to assert on directly (no repository was even provided);
    // this just confirms mounting with null doesn't throw or attempt a call.
  });

  it('swallows errors from the sync process (best-effort)', async () => {
    const repository = makeRepository({
      findMine: vi.fn().mockRejectedValue(new Error('boom')),
    });

    expect(() => renderHook(() => useTimezoneSync(repository))).not.toThrow();

    await waitFor(() => {
      expect(repository.findMine).toHaveBeenCalledOnce();
    });
    // No unhandled rejection and no thrown error even though findMine
    // rejected — the failure must not break the app.
    expect(repository.updateTimezone).not.toHaveBeenCalled();
  });
});
