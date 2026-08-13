/// <reference lib="webworker" />

import { precacheAndRoute, createHandlerBoundToURL, cleanupOutdatedCaches } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

// Activate a newly-installed Service Worker immediately instead of leaving it
// in `waiting` until every tab/PWA instance in this scope is fully closed.
// Without this, a deployed update never takes over on devices that are
// rarely fully quit (e.g. an iOS home-screen PWA), so the device keeps
// running stale precached code indefinitely after a deploy.
// NOTE: this only changes what the *next* load gets. A page that is already
// open keeps running its old JS until it navigates or reloads — that is a
// known, accepted limitation (no update-prompt/auto-reload UI by design),
// not a bug left to fix here.
self.skipWaiting();

// Drop precaches left behind by an older Workbox cache-naming scheme once
// this worker activates. precacheAndRoute() below already prunes individual
// stale entries from the *current* precache on every deploy, so this mainly
// guards against orphaned caches from a future Workbox major-version bump.
cleanupOutdatedCaches();

// Workbox precaching (injected by vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);

// Navigation fallback (equivalent to previous navigateFallback config)
const handler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(handler, {
  denylist: [/^\/api\//],
});
registerRoute(navigationRoute);

// Take control of any already-open clients as soon as this worker activates,
// instead of only on their next navigation. Paired with skipWaiting() above:
// together they collapse the update propagation window from "wait for every
// tab to fully close" down to "wait for the next page load."
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});

// Push notification handler
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) {
    return;
  }

  const payload = event.data.json() as {
    title: string;
    body: string;
    icon?: string;
    data?: { url?: string };
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon ?? '/icon-192x192.png',
      data: payload.data,
    }),
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const url = (event.notification.data as { url?: string })?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
