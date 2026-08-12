/**
 * @vitest-environment jsdom
 */

/**
 * usePushSubscription tests - Focuses on the regression this hook must not
 * reintroduce: it must NOT call usePushSubscriptionReconcile itself.
 * Reconciliation runs exactly once, at the app root, via AppLayout (see
 * AppLayout.test.tsx). If this hook also reconciled, a page using it
 * (NewHabitPage/HabitDetailPage) landed on directly would mount alongside
 * AppLayout and run reconcileSubscription twice concurrently against the
 * same repository.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { PushSubscriptionRepository } from '../../data/repositories/pushSubscriptionRepository';
import { usePushSubscription } from '../usePushSubscription';

const mockReconcile = vi.fn();
vi.mock('../usePushSubscriptionReconcile', () => ({
  usePushSubscriptionReconcile: (repository: PushSubscriptionRepository | null) =>
    mockReconcile(repository),
}));

const makeRepository = (): PushSubscriptionRepository => ({
  upsert: vi.fn().mockResolvedValue(undefined),
  findByEndpoint: vi.fn().mockResolvedValue(null),
  deleteByEndpoint: vi.fn().mockResolvedValue(undefined),
});

describe('usePushSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not reconcile the push subscription itself (AppLayout owns that)', () => {
    const repository = makeRepository();

    renderHook(() => usePushSubscription(repository));

    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('returns the current notification permission state', () => {
    const repository = makeRepository();

    const { result } = renderHook(() => usePushSubscription(repository));

    expect(result.current.permissionState).toBe(
      typeof Notification !== 'undefined' ? Notification.permission : 'default',
    );
  });
});
