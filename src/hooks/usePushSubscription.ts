import { useState, useEffect, useCallback } from 'react';
import type { PushSubscriptionRepository } from '../data/repositories/pushSubscriptionRepository';

export type UsePushSubscriptionReturn = {
  readonly permissionState: NotificationPermission;
  readonly requestPermission: () => Promise<boolean>;
  readonly ensureSubscription: () => Promise<void>;
};

function getVapidPublicKey(): string {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!key) {
    throw new Error('VITE_VAPID_PUBLIC_KEY is not configured');
  }
  return key;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription(
  repository: PushSubscriptionRepository | null,
): UsePushSubscriptionReturn {
  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermissionState(Notification.permission);
    }
  }, []);

  // Silent re-registration on app load
  useEffect(() => {
    if (!repository || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    async function checkAndReregister() {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        if (!existingSub) return;

        const dbSub = await repository!.findByEndpoint(existingSub.endpoint);
        if (dbSub) return;

        await existingSub.unsubscribe();
        const vapidKey = urlBase64ToUint8Array(getVapidPublicKey());
        const newSub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        });

        const keys = newSub.toJSON().keys ?? {};
        await repository!.upsert({
          endpoint: newSub.endpoint,
          p256dh: keys.p256dh ?? '',
          auth: keys.auth ?? '',
        });
      } catch {
        // Silent failure — re-registration is best-effort
      }
    }

    void checkAndReregister();
  }, [repository]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === 'undefined') return false;
    const result = await Notification.requestPermission();
    setPermissionState(result);
    return result === 'granted';
  }, []);

  const ensureSubscription = useCallback(async (): Promise<void> => {
    if (!repository || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const vapidKey = urlBase64ToUint8Array(getVapidPublicKey());
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });
    }

    const keys = subscription.toJSON().keys ?? {};
    await repository.upsert({
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh ?? '',
      auth: keys.auth ?? '',
    });
  }, [repository]);

  return { permissionState, requestPermission, ensureSubscription };
}
