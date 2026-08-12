import { useState, useEffect, useCallback } from 'react';
import type { PushSubscriptionRepository } from '../data/repositories/pushSubscriptionRepository';
import { ensureSubscription as ensureSubscriptionOp } from './pushSubscriptionOperations';
import { usePushSubscriptionReconcile } from './usePushSubscriptionReconcile';
import { hasServiceWorker } from './utils';

export type UsePushSubscriptionReturn = {
  readonly permissionState: NotificationPermission;
  readonly requestPermission: () => Promise<boolean>;
  readonly ensureSubscription: () => Promise<void>;
};

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

  // Reconcile the device subscription on mount (best-effort). Also mounted
  // unconditionally at the app root (AppLayout) so it runs even when this
  // hook itself isn't — see usePushSubscriptionReconcile for details.
  usePushSubscriptionReconcile(repository);

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
