/**
 * @vitest-environment jsdom
 */

/**
 * usePushSubscriptionReconcile tests - Verifies the hook wires up
 * reconcileSubscription on mount (service worker readiness, permission
 * lookup, and the "never prompt on load" guarantee). Branch-level behavior
 * of reconcileSubscription itself is covered by pushSubscriptionOperations.test.ts;
 * these tests focus on whether the hook actually invokes it when mounted.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { PushSubscriptionRepository } from '../../data/repositories/pushSubscriptionRepository';
import { usePushSubscriptionReconcile } from '../usePushSubscriptionReconcile';

const VAPID_KEY =
  'BIQHildiu8tu7dTwTm4GVMTyuxsxInrAGulnynO04w-BfL1SGRPOo89jIt6sx4O2ODy2R04nXU3LhtxlkJemSF8';

const makeRepository = (
  overrides: Partial<PushSubscriptionRepository> = {},
): PushSubscriptionRepository => ({
  upsert: vi.fn().mockResolvedValue(undefined),
  findByEndpoint: vi.fn().mockResolvedValue(null),
  deleteByEndpoint: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const makeRegistration = (opts: {
  existingSub?: { endpoint: string } | null;
  rejectGetSubscription?: boolean;
}) => {
  const getSubscription = opts.rejectGetSubscription
    ? vi.fn().mockRejectedValue(new Error('boom'))
    : vi.fn().mockResolvedValue(opts.existingSub ?? null);
  const subscribe = vi.fn().mockResolvedValue({
    endpoint: 'new-endpoint',
    toJSON: () => ({ keys: { p256dh: 'p', auth: 'a' } }),
  });
  return { pushManager: { getSubscription, subscribe } } as unknown as ServiceWorkerRegistration & {
    pushManager: { getSubscription: typeof getSubscription; subscribe: typeof subscribe };
  };
};

beforeEach(() => {
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', VAPID_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('usePushSubscriptionReconcile', () => {
  it('auto re-subscribes on mount when permission is already granted and no browser sub exists', async () => {
    const registration = makeRegistration({ existingSub: null });
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve(registration) },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    const repository = makeRepository();

    renderHook(() => usePushSubscriptionReconcile(repository));

    await waitFor(() => {
      expect(registration.pushManager.subscribe).toHaveBeenCalledOnce();
    });
    expect(repository.upsert).toHaveBeenCalledWith({
      endpoint: 'new-endpoint',
      p256dh: 'p',
      auth: 'a',
    });
  });

  it('never prompts (does not subscribe) on mount when permission is not granted', async () => {
    const registration = makeRegistration({ existingSub: null });
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve(registration) },
    });
    vi.stubGlobal('Notification', { permission: 'default' });
    const repository = makeRepository();

    renderHook(() => usePushSubscriptionReconcile(repository));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('does nothing when there is no repository', async () => {
    const registration = makeRegistration({ existingSub: null });
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve(registration) },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });

    renderHook(() => usePushSubscriptionReconcile(null));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('does nothing when the browser has no serviceWorker support', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('Notification', { permission: 'granted' });
    const repository = makeRepository();

    renderHook(() => usePushSubscriptionReconcile(repository));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('swallows errors from the reconcile process (best-effort)', async () => {
    const registration = makeRegistration({ rejectGetSubscription: true });
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve(registration) },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    const repository = makeRepository();

    expect(() =>
      renderHook(() => usePushSubscriptionReconcile(repository)),
    ).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
