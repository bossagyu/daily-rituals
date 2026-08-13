import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
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
// browser actually notices new deploys (see vite.config.ts's
// registerType: 'autoUpdate', which otherwise only takes effect once
// registerSW() is called). Detecting an update here does NOT reload the
// page or show an "update available" prompt by design — the user does not
// want to be interrupted. skipWaiting()/clients.claim() in src/sw.ts mean a
// detected update activates in the background and is picked up transparently
// on the next natural load/navigation.
registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (!registration) {
      return;
    }

    let lastCheckAt = Date.now();
    const checkForUpdate = () => {
      lastCheckAt = Date.now();
      void registration.update();
    };

    setInterval(checkForUpdate, PERIODIC_UPDATE_CHECK_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (Date.now() - lastCheckAt < MIN_VISIBILITY_UPDATE_CHECK_GAP_MS) {
        return;
      }
      checkForUpdate();
    });
  },
});
