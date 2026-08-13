// Pure scheduling logic behind the Service Worker update-check throttle in
// main.tsx. Split out from the registerSW()/visibilitychange wiring (which
// needs a real browser/SW environment to exercise) so the throttle decision
// itself can be unit-tested.

/**
 * Whether enough time has passed since the last update check to run another
 * one. Used to collapse a burst of rapid `visibilitychange` events (e.g.
 * quickly flicking through the iOS app switcher) into a single
 * `registration.update()` call, without rate-limiting genuine app resumes.
 *
 * @param now current timestamp (ms since epoch)
 * @param lastCheckAt timestamp of the last update check (ms since epoch)
 * @param minGapMs minimum required gap between checks (ms)
 */
export function shouldRunUpdateCheck(now: number, lastCheckAt: number, minGapMs: number): boolean {
  return now - lastCheckAt >= minGapMs;
}
