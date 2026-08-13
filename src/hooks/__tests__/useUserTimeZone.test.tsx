/**
 * @vitest-environment jsdom
 */

/**
 * useUserTimeZone tests - Verifies profiles.timezone resolution with a
 * browser-timezone fallback, mirroring useTimezoneSync's best-effort pattern
 * (see useTimezoneSync.test.tsx) but for the read path instead of the write
 * path.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ProfileRepository } from '../../data/repositories/profileRepository';
import { getBrowserTimeZone } from '../../domain/services/timeService';
import { useUserTimeZone } from '../useUserTimeZone';

const makeRepository = (
  overrides: Partial<ProfileRepository> = {},
): ProfileRepository => ({
  findMine: vi.fn().mockResolvedValue({
    id: 'u1',
    displayName: null,
    timezone: 'America/Los_Angeles',
  }),
  updateTimezone: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('useUserTimeZone', () => {
  it('starts with the browser timezone before the profile resolves', () => {
    const repository = makeRepository();
    const { result } = renderHook(() => useUserTimeZone(repository));
    expect(result.current).toBe(getBrowserTimeZone());
  });

  it('switches to profile.timezone once it resolves', async () => {
    const repository = makeRepository();
    const { result } = renderHook(() => useUserTimeZone(repository));

    await waitFor(() => {
      expect(result.current).toBe('America/Los_Angeles');
    });
  });

  it('falls back to the browser timezone when there is no repository', () => {
    const { result } = renderHook(() => useUserTimeZone(null));
    expect(result.current).toBe(getBrowserTimeZone());
  });

  it('falls back to the browser timezone when the profile is missing', async () => {
    const repository = makeRepository({ findMine: vi.fn().mockResolvedValue(null) });
    const { result } = renderHook(() => useUserTimeZone(repository));

    await waitFor(() => {
      expect(repository.findMine).toHaveBeenCalledOnce();
    });
    expect(result.current).toBe(getBrowserTimeZone());
  });

  it('swallows errors and keeps the browser timezone (best-effort)', async () => {
    const repository = makeRepository({
      findMine: vi.fn().mockRejectedValue(new Error('boom')),
    });

    expect(() => renderHook(() => useUserTimeZone(repository))).not.toThrow();

    await waitFor(() => {
      expect(repository.findMine).toHaveBeenCalledOnce();
    });
    expect(getBrowserTimeZone()).toBeTruthy();
  });

  it('falls back to the browser timezone when profile.timezone is not a valid IANA name', async () => {
    // profiles.timezone is unconstrained TEXT, so an invalid value can reach
    // here. Without validation this would flow into isActiveOnDate ->
    // getLocalDate -> new Intl.DateTimeFormat(...) and throw a RangeError
    // during TodayPage's render-phase useMemo, white-screening the page
    // (there is no ErrorBoundary in src/).
    const repository = makeRepository({
      findMine: vi.fn().mockResolvedValue({
        id: 'u1',
        displayName: null,
        timezone: 'Not/AValidZone',
      }),
    });

    const { result } = renderHook(() => useUserTimeZone(repository));

    await waitFor(() => {
      expect(repository.findMine).toHaveBeenCalledOnce();
    });
    expect(result.current).toBe(getBrowserTimeZone());
  });
});
