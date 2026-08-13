import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { shouldRunUpdateCheck } from './lib/swUpdateCheck';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

// How often to poll the deployed Service Worker script for changes while the
// app stays open in the foreground. registration.update() only fetches
// sw.js with a conditional GET, so an hourly cadence is cheap while still
// catching a deploy within the same working session for a tab/PWA that is
// never backgrounded or navigated.
const PERIODIC_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// Minimum gap between update checks triggered by the app regaining
// visibility. This is intentionally much shorter than the periodic interval
// above: an iOS home-screen PWA freezes its JS timers while backgrounded, so
// the interval above effectively does not run during that time. Checking
// again on every real resume is what actually catches a deploy that shipped
// while the app was backgrounded (the failure mode behind this fix) — the
// gap here only exists to collapse a burst of rapid visibilitychange events
// (e.g. quickly flicking through the iOS app switcher) into a single check.
const MIN_VISIBILITY_UPDATE_CHECK_GAP_MS = 60 * 1000;

// Registers the Service Worker and drives periodic update checks so the
// browser actually notices new deploys. This alone does not make the app
// disruptive: vite.config.ts sets registerType: 'prompt' (NOT 'autoUpdate'),
// specifically because vite-plugin-pwa's built-in 'autoUpdate' client wiring
// forces an unconditional window.location.reload() on activation regardless
// of what's passed to registerSW() here. 'prompt' disables that reload, and
// since onNeedRefresh is never passed below, no "update available" prompt is
// shown either — the user explicitly declined both. skipWaiting()/
// clients.claim() in src/sw.ts still activate a detected update in the
// background; it's simply picked up transparently on the next natural
// load/navigation, never forced mid-session.
registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (!registration) {
      return;
    }

    let lastCheckAt = Date.now();
    const checkForUpdate = () => {
      lastCheckAt = Date.now();
      // registration.update() rejects when the request for sw.js fails
      // (e.g. offline, which is a routine state on a phone) — swallow it so
      // that doesn't surface as an unhandled promise rejection on every
      // hourly tick / foreground resume. There is no error-reporting sink
      // in this codebase to forward it to instead.
      void registration.update().catch(() => {});
    };

    setInterval(checkForUpdate, PERIODIC_UPDATE_CHECK_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (!shouldRunUpdateCheck(Date.now(), lastCheckAt, MIN_VISIBILITY_UPDATE_CHECK_GAP_MS)) {
        return;
      }
      checkForUpdate();
    });
  },
});
