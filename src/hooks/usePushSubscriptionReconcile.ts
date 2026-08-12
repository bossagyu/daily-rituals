import { useEffect } from 'react';
import type { PushSubscriptionRepository } from '../data/repositories/pushSubscriptionRepository';
import { reconcileSubscription } from './pushSubscriptionOperations';
import { hasServiceWorker } from './utils';

/**
 * Reconciles the device's push subscription once per mount (best-effort).
 *
 * This also re-subscribes when iOS has silently dropped the subscription,
 * as long as notification permission is already granted. It never prompts
 * for permission on load — see `reconcileSubscription` for the exact rules.
 *
 * Mount this once near the app root (e.g. AppLayout, which wraps every
 * authenticated route) so it runs on every session regardless of which
 * page the user lands on first. Do not gate it behind a specific page.
 */
export function usePushSubscriptionReconcile(
  repository: PushSubscriptionRepository | null,
): void {
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
}
