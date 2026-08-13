/**
 * @vitest-environment jsdom
 */

/**
 * useTimezoneSync tests - Verifies the "never break the app" best-effort
 * failure handling: a rejecting repository must not throw or leave an
 * unhandled rejection. Branch-level behavior of syncTimezone itself is
 * covered by timezoneSyncOperations.test.ts.
 *
 * The null-repository guard is verified separately in
 * useTimezoneSync.guard.test.tsx, which mocks ./timezoneSyncOperations to
 * assert it is never called. That mock is kept out of this file because it
 * would replace the real syncTimezone used below, which is what actually
 * makes repository.findMine()'s rejection reach this hook's catch block.
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
