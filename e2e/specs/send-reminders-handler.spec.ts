import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import handler from '../../api/send-reminders';
import { getLocalDate } from '../../src/domain/services/timeService';
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
 * A completion is also seeded, dated to the habit owner's *local* today
 * (the test user's profile defaults to Asia/Tokyo — see
 * on_auth_user_created). This exercises `localTodayByHabit`, which is built
 * inside `handler` itself and therefore invisible to the pure-function unit
 * tests: if it were ever computed from a UTC date instead of the owner's
 * timezone, the completion would fail to match and the handler would (wrongly)
 * still consider the habit due, so the `message` assertion below would fail.
 */

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

    // Owner-local "today" (test user's profile timezone defaults to
    // Asia/Tokyo). Seeding the completion under this date, rather than the
    // runner's own UTC date, is what makes this test fail if
    // localTodayByHabit reverts to UTC.
    const ownerLocalToday = getLocalDate(new Date(), 'Asia/Tokyo');
    await seedCompletion(habitId, ownerLocalToday);

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
    }
  });
});
