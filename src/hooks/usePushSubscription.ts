import { useState, useEffect, useCallback } from 'react';
import type { PushSubscriptionRepository } from '../data/repositories/pushSubscriptionRepository';
import { ensureSubscription as ensureSubscriptionOp } from './pushSubscriptionOperations';
import { hasServiceWorker } from './utils';

export type UsePushSubscriptionReturn = {
  readonly permissionState: NotificationPermission;
  readonly requestPermission: () => Promise<boolean>;
  readonly ensureSubscription: () => Promise<void>;
};

/**
 * Manages notification permission state and exposes an explicit
 * `ensureSubscription` for user-initiated subscribe actions (e.g. enabling a
 * habit reminder).
 *
 * This hook does NOT reconcile the push subscription itself — that runs
 * once at the app root via `usePushSubscriptionReconcile` in `AppLayout`,
 * which wraps every authenticated route. Calling it again here would race
 * with the AppLayout instance when a page using this hook is the initial
 * landing route (e.g. a deep link to `/habits/:id`), since both would mount
 * together and reconcile the same repository concurrently.
 */
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
