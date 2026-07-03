import { useState, useEffect, useCallback } from 'react';
import type { PushSubscriptionRepository } from '../data/repositories/pushSubscriptionRepository';
import {
  reconcileSubscription,
  ensureSubscription as ensureSubscriptionOp,
} from './pushSubscriptionOperations';

export type UsePushSubscriptionReturn = {
  readonly permissionState: NotificationPermission;
  readonly requestPermission: () => Promise<boolean>;
  readonly ensureSubscription: () => Promise<void>;
};

function hasServiceWorker(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
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

  // Reconcile the device subscription on app load (best-effort). This also
  // re-subscribes when iOS has silently dropped the subscription, as long as
  // notification permission is already granted.
  useEffect(() => {
    if (!repository || !hasServiceWorker()) return;

    async function reconcile() {
      try {
        const registration = await navigator.serviceWorker.ready;
        const permission =
          typeof Notification !== 'undefined' ? Notification.permission : 'default';
        await reconcileSubscription(registration, repository!, permission);
      } catch {
        // Silent failure — reconciliation is best-effort.
      }
    }

    void reconcile();
  }, [repository]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === 'undefined') return false;
    const result = await Notification.requestPermission();
    setPermissionState(result);
    return result === 'granted';
  }, []);

  const ensureSubscription = useCallback(async (): Promise<void> => {
    if (!repository || !hasServiceWorker()) return;
    const registration = await navigator.serviceWorker.ready;
    await ensureSubscriptionOp(registration, repository);
  }, [repository]);

  return { permissionState, requestPermission, ensureSubscription };
}
