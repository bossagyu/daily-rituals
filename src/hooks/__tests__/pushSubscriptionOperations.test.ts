import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PushSubscriptionRepository } from '../../data/repositories/pushSubscriptionRepository';
import {
  reconcileSubscription,
  ensureSubscription,
} from '../pushSubscriptionOperations';

// A valid base64url VAPID public key (atob-able after transform).
const VAPID_KEY =
  'BIQHildiu8tu7dTwTm4GVMTyuxsxInrAGulnynO04w-BfL1SGRPOo89jIt6sx4O2ODy2R04nXU3LhtxlkJemSF8';

type MockSub = {
  endpoint: string;
  toJSON: () => { keys: { p256dh: string; auth: string } };
  unsubscribe: ReturnType<typeof vi.fn>;
};

const makeSub = (endpoint: string, p256dh = 'p256', auth = 'auth'): MockSub => ({
  endpoint,
  toJSON: () => ({ keys: { p256dh, auth } }),
  unsubscribe: vi.fn().mockResolvedValue(true),
});

const makeRegistration = (opts: {
  existing?: MockSub | null;
  newSub?: MockSub;
}) => {
  const subscribe = vi.fn().mockResolvedValue(opts.newSub ?? makeSub('new-endpoint'));
  const getSubscription = vi.fn().mockResolvedValue(opts.existing ?? null);
  return {
    pushManager: { getSubscription, subscribe },
  } as unknown as ServiceWorkerRegistration & {
    pushManager: { getSubscription: typeof getSubscription; subscribe: typeof subscribe };
  };
};

const makeRepository = (
  overrides: Partial<PushSubscriptionRepository> = {},
): PushSubscriptionRepository => ({
  upsert: vi.fn().mockResolvedValue(undefined),
  findByEndpoint: vi.fn().mockResolvedValue(null),
  deleteByEndpoint: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', VAPID_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('reconcileSubscription', () => {
  it('does nothing when an existing browser subscription is already tracked in the DB', async () => {
    const existing = makeSub('tracked-endpoint');
    const registration = makeRegistration({ existing });
    const repository = makeRepository({
      findByEndpoint: vi.fn().mockResolvedValue({ endpoint: 'tracked-endpoint' }),
    });

    await reconcileSubscription(registration, repository, 'granted');

    expect(existing.unsubscribe).not.toHaveBeenCalled();
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('refreshes the subscription when the browser sub is not tracked in the DB', async () => {
    const existing = makeSub('stale-endpoint');
    const newSub = makeSub('fresh-endpoint', 'p-new', 'a-new');
    const registration = makeRegistration({ existing, newSub });
    const repository = makeRepository({
      findByEndpoint: vi.fn().mockResolvedValue(null),
    });

    await reconcileSubscription(registration, repository, 'granted');

    expect(existing.unsubscribe).toHaveBeenCalledOnce();
    expect(registration.pushManager.subscribe).toHaveBeenCalledOnce();
    expect(repository.upsert).toHaveBeenCalledWith({
      endpoint: 'fresh-endpoint',
      p256dh: 'p-new',
      auth: 'a-new',
    });
  });

  it('auto re-subscribes when there is no browser sub but permission is granted', async () => {
    const newSub = makeSub('created-endpoint', 'p-c', 'a-c');
    const registration = makeRegistration({ existing: null, newSub });
    const repository = makeRepository();

    await reconcileSubscription(registration, repository, 'granted');

    expect(registration.pushManager.subscribe).toHaveBeenCalledOnce();
    expect(repository.upsert).toHaveBeenCalledWith({
      endpoint: 'created-endpoint',
      p256dh: 'p-c',
      auth: 'a-c',
    });
  });

  it('does NOT subscribe when there is no browser sub and permission is default', async () => {
    const registration = makeRegistration({ existing: null });
    const repository = makeRepository();

    await reconcileSubscription(registration, repository, 'default');

    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('does NOT subscribe when there is no browser sub and permission is denied', async () => {
    const registration = makeRegistration({ existing: null });
    const repository = makeRepository();

    await reconcileSubscription(registration, repository, 'denied');

    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(repository.upsert).not.toHaveBeenCalled();
  });
});

describe('ensureSubscription', () => {
  it('subscribes and persists when no subscription exists', async () => {
    const newSub = makeSub('ensure-endpoint', 'p-e', 'a-e');
    const registration = makeRegistration({ existing: null, newSub });
    const repository = makeRepository();

    await ensureSubscription(registration, repository);

    expect(registration.pushManager.subscribe).toHaveBeenCalledOnce();
    expect(repository.upsert).toHaveBeenCalledWith({
      endpoint: 'ensure-endpoint',
      p256dh: 'p-e',
      auth: 'a-e',
    });
  });

  it('persists the existing subscription without re-subscribing', async () => {
    const existing = makeSub('existing-endpoint', 'p-x', 'a-x');
    const registration = makeRegistration({ existing });
    const repository = makeRepository();

    await ensureSubscription(registration, repository);

    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(repository.upsert).toHaveBeenCalledWith({
      endpoint: 'existing-endpoint',
      p256dh: 'p-x',
      auth: 'a-x',
    });
  });
});
