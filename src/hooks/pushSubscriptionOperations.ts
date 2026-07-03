import type { PushSubscriptionRepository } from '../data/repositories/pushSubscriptionRepository';

/**
 * Reads the VAPID public key from the environment.
 * @throws when VITE_VAPID_PUBLIC_KEY is not configured.
 */
export function getVapidPublicKey(): string {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!key) {
    throw new Error('VITE_VAPID_PUBLIC_KEY is not configured');
  }
  return key;
}

/**
 * Converts a base64url-encoded VAPID key into the Uint8Array the
 * Push API expects for `applicationServerKey`.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Persists a browser PushSubscription to the repository.
 */
async function persistSubscription(
  subscription: PushSubscription,
  repository: PushSubscriptionRepository,
): Promise<void> {
  const keys = subscription.toJSON().keys ?? {};
  await repository.upsert({
    endpoint: subscription.endpoint,
    p256dh: keys.p256dh ?? '',
    auth: keys.auth ?? '',
  });
}

/**
 * Creates a fresh push subscription and persists it to the repository.
 */
async function subscribeAndSave(
  registration: ServiceWorkerRegistration,
  repository: PushSubscriptionRepository,
): Promise<void> {
  const vapidKey = urlBase64ToUint8Array(getVapidPublicKey());
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidKey,
  });
  await persistSubscription(subscription, repository);
}

/**
 * Reconciles the device's push subscription on app load (best-effort).
 *
 * - Browser subscription exists and is tracked in the DB: nothing to do.
 * - Browser subscription exists but is missing from the DB: refresh it
 *   (unsubscribe + subscribe + persist).
 * - No browser subscription but permission is already `granted`: create a
 *   new one. This recovers from iOS silently dropping the subscription,
 *   which otherwise required the user to manually re-enable a reminder.
 * - No browser subscription and permission is not granted: do nothing
 *   (never prompt for permission on load).
 */
export async function reconcileSubscription(
  registration: ServiceWorkerRegistration,
  repository: PushSubscriptionRepository,
  permission: NotificationPermission,
): Promise<void> {
  const existingSub = await registration.pushManager.getSubscription();

  if (existingSub) {
    const dbSub = await repository.findByEndpoint(existingSub.endpoint);
    if (dbSub) {
      return;
    }
    await existingSub.unsubscribe();
    await subscribeAndSave(registration, repository);
    return;
  }

  if (permission === 'granted') {
    await subscribeAndSave(registration, repository);
  }
}

/**
 * Ensures a push subscription exists and is persisted. Called from an
 * explicit user action (enabling a habit reminder), so it may create a
 * subscription (which can trigger the permission prompt).
 */
export async function ensureSubscription(
  registration: ServiceWorkerRegistration,
  repository: PushSubscriptionRepository,
): Promise<void> {
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const vapidKey = urlBase64ToUint8Array(getVapidPublicKey());
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey,
    });
  }

  await persistSubscription(subscription, repository);
}
