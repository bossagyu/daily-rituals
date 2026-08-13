import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import handler from '../../api/send-reminders';
import { getLocalDate } from '../../src/domain/services/timeService';
import { getProfileTimezone, setProfileTimezone } from '../helpers/test-data';
import {
  SUPABASE_LOCAL_URL,
  SUPABASE_LOCAL_SERVICE_ROLE_KEY,
} from '../../playwright.config';
import { test, expect } from '../fixtures/base';

/**
 * Smoke test for the send-reminders Vercel handler.
 *
 * Unlike api/__tests__/send-reminders.test.ts (which only exercises the pure
 * helper functions), this invokes the real default-exported `handler`
 * against the local Supabase stack. Its job is narrow: prove every query
 * shape the handler sends actually resolves against the real schema (no
 * unresolved PostgREST embeds, no renamed/missing columns). It intentionally
 * does not assert on notification-sending behaviour — that needs real VAPID
 * subscribers and is out of scope here.
 *
 * A habit is seeded so the handler's habits query returns a row and
 * proceeds to the separate profiles lookup (habits and profiles have no FK
 * between them, so that join must be done in application code, not via a
 * PostgREST embed — see the comment in api/send-reminders.ts). With zero
 * habits the handler short-circuits before ever touching profiles or
 * completions, which would make this test blind to exactly the bug class
 * it exists to catch.
 *
 * A completion is also seeded, dated to the habit owner's *local* today.
 * This exercises `localTodayByHabit`, which is built inside `handler` itself
 * and therefore invisible to the pure-function unit tests: if it were ever
 * computed from a UTC date instead of the owner's timezone, the completion
 * would fail to match and the handler would (wrongly) still consider the
 * habit due, so the `message` assertion below would fail.
 *
 * A second, weekly_count habit is also seeded (with its own completion for
 * today) so that `weeklyCountHabits.length > 0` is true and the handler's
 * *second* completions query — `.gte('completed_date', ...).lte(...)` for
 * weekly progress — actually executes. Without this, that query shape would
 * be the one path in the handler still unvalidated against the real schema,
 * which is exactly the class of defect that already bit this branch once
 * (an unresolvable `profiles!inner(timezone)` embed typechecked, passed unit
 * and E2E tests, and returned HTTP 500 on every cron run until a human
 * caught it by querying the database by hand).
 *
 * The test user's profile is temporarily switched to a timezone picked by
 * `pickDivergentTimeZone` (see its docstring) so that the owner-local date
 * and the UTC date are *guaranteed* to differ, regardless of what time of
 * day this test happens to run. Without that, a UTC-vs-local regression in
 * `localTodayByHabit` would only be caught during the ~9 daily hours where
 * the default Asia/Tokyo date happens to disagree with UTC — a detector
 * that passes or fails depending on the clock is exactly the kind of
 * "looks like it works" test this branch has run into before.
 */

/**
 * Picks an IANA timezone whose local calendar date is guaranteed to differ
 * from the UTC calendar date at `instant`, no matter what time of day it is.
 *
 * Reasoning, in minutes since UTC midnight (T, 0–1439):
 * - Pacific/Kiritimati (UTC+14) rolls the local date forward to the next
 *   day whenever T + 14h >= 24h, i.e. T >= 600 (10:00 UTC).
 * - Pacific/Midway (UTC-11) rolls the local date back to the previous day
 *   whenever T - 11h < 0h, i.e. T < 660 (11:00 UTC).
 * These two rollover windows — [10:00, 24:00) and [00:00, 11:00) — overlap
 * on [10:00, 11:00), so their union covers the full 24 hours: whichever one
 * applies, the local date differs from the UTC date. Splitting the choice
 * at 10:30 UTC (630 minutes, the overlap's midpoint) keeps a 30-minute
 * margin from either boundary, which comfortably absorbs the few
 * milliseconds of drift between this computation and `handler`'s own
 * `new Date()` call. Neither zone observes DST, so the offset is stable.
 */
function pickDivergentTimeZone(instant: Date): string {
  const utcMinutes = instant.getUTCHours() * 60 + instant.getUTCMinutes();
  return utcMinutes >= 630 ? 'Pacific/Kiritimati' : 'Pacific/Midway';
}

type CapturedResponse = {
  statusCode: number;
  body: unknown;
};

function createFakeRes(): { res: VercelResponse; captured: CapturedResponse } {
  const captured: CapturedResponse = { statusCode: 0, body: undefined };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      captured.body = payload;
      return res;
    },
  } as unknown as VercelResponse;
  return { res, captured };
}

const HANDLER_ENV_KEYS = [
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'CRON_SECRET',
] as const;

test.describe('send-reminders handler smoke test', () => {
  test('runs the real handler against local Supabase without a query/schema error', async ({
    testUserId,
    seedHabit,
    seedCompletion,
  }) => {
    // reminder_time '00:00:00' is always <= the current time slot, so the
    // habit is due (were it not already completed) regardless of when this
    // test happens to run.
    const { id: habitId } = await seedHabit({
      name: 'E2Eスモークテスト習慣',
      reminderTime: '00:00:00',
    });

    // weekly_count habit so the handler's weekly-completions query
    // (`.gte('completed_date', ...).lte(...)`) actually executes. See the
    // suite-level docstring above.
    const { id: weeklyHabitId } = await seedHabit({
      name: 'E2Eスモークテスト習慣（週次）',
      frequencyType: 'weekly_count',
      frequencyValue: { count: 1 },
      reminderTime: '00:00:00',
    });

    // Force a timezone where owner-local date != UTC date right now (see
    // pickDivergentTimeZone doc), then restore the profile's original
    // timezone afterwards. Nothing else in this test suite reads
    // profiles.timezone from the browser (useTimezoneSync only runs on app
    // mount, and this test never navigates a page), but we restore
    // regardless to avoid leaking state into any test that runs after this
    // one in the same worker.
    const originalTimezone = await getProfileTimezone(testUserId);
    const divergentTimeZone = pickDivergentTimeZone(new Date());

    const cronSecret = 'e2e-smoke-test-cron-secret';
    // Dummy but well-formed VAPID keypair. The seeded user has no
    // push_subscriptions, so sendNotificationsPerUser never reaches
    // webpush.sendNotification — these keys only need to satisfy
    // webpush.setVapidDetails's format validation.
    const vapidKeys = webpush.generateVAPIDKeys();

    const originalEnv = new Map(
      HANDLER_ENV_KEYS.map((key) => [key, process.env[key]]),
    );

    process.env.SUPABASE_URL = SUPABASE_LOCAL_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_LOCAL_SERVICE_ROLE_KEY;
    process.env.VAPID_PUBLIC_KEY = vapidKeys.publicKey;
    process.env.VAPID_PRIVATE_KEY = vapidKeys.privateKey;
    process.env.VAPID_SUBJECT = 'mailto:smoke-test@example.com';
    process.env.CRON_SECRET = cronSecret;

    try {
      // Applied inside the try so the finally below always restores it, even
      // if setup between here and the assertions throws. Outside the try, a
      // throw would leak this timezone into every later test in this worker.
      await setProfileTimezone(testUserId, divergentTimeZone);

      // Owner-local "today" under the divergent timezone. Seeding the
      // completion under this date, rather than the runner's own UTC date,
      // is what makes this test fail if localTodayByHabit reverts to UTC.
      const ownerLocalToday = getLocalDate(new Date(), divergentTimeZone);
      await seedCompletion(habitId, ownerLocalToday);
      // Same owner-local today, so the weekly habit's required count (1) is
      // already met and it stays out of the notifiable set — the
      // 'All habits completed' expectation below still holds.
      await seedCompletion(weeklyHabitId, ownerLocalToday);

      const req = {
        method: 'POST',
        headers: { 'x-cron-secret': cronSecret },
      } as unknown as VercelRequest;
      const { res, captured } = createFakeRes();

      await handler(req, res);

      // If any query shape is wrong against the real schema (e.g. an
      // unresolvable PostgREST embed like `profiles!inner(timezone)`, a
      // renamed column, ...), the handler responds 500 with an `error`
      // body instead of reaching this point.
      expect(captured.body).not.toHaveProperty('error');
      expect(captured.statusCode).toBe(200);
      // The only habit is already completed for the owner's local today, so
      // the handler must recognize that and send nothing.
      expect(captured.body).toMatchObject({
        sent: 0,
        message: 'All habits completed',
      });
    } finally {
      for (const key of HANDLER_ENV_KEYS) {
        const original = originalEnv.get(key);
        if (original === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = original;
        }
      }
      await setProfileTimezone(testUserId, originalTimezone);
    }
  });
});
