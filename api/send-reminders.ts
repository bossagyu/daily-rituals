/**
 * Vercel API Route: send-reminders
 *
 * Queries habits with reminder_time that match the current UTC time slot,
 * checks whether they are already completed today, and sends push
 * notifications for incomplete habits.
 *
 * Invoked periodically via pg_cron with x-cron-secret header.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// --- Constants ---

const NOTIFICATION_WINDOW_MINUTES = 10;
const HTTP_GONE = 410;
const MAX_DISPLAY_HABITS = 3;

// --- Types ---

type HabitRow = {
  readonly id: string;
  readonly user_id: string;
  readonly name: string;
  readonly frequency_type: string;
  readonly frequency_value: unknown;
  readonly reminder_time: string;
  readonly last_notified_date: string | null;
};

type SubscriptionRow = {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
};

// --- Pure helper functions ---

function getTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentUtcTimeSlot(): string {
  const now = new Date();
  const hours = now.getUTCHours();
  const minutes =
    Math.floor(now.getUTCMinutes() / NOTIFICATION_WINDOW_MINUTES) *
    NOTIFICATION_WINDOW_MINUTES;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getWeekStartUtc(): string {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function getCurrentDayOfWeek(): number {
  return new Date().getUTCDay();
}

function buildNotificationBody(habitNames: readonly string[]): string {
  if (habitNames.length === 0) {
    return '';
  }
  const displayed = habitNames
    .slice(0, MAX_DISPLAY_HABITS)
    .map((n) => `「${n}」`)
    .join('');
  const remaining = habitNames.length - MAX_DISPLAY_HABITS;
  const suffix = remaining > 0 ? `他${remaining}件` : '';
  return `${displayed}${suffix}がまだ完了していません`;
}

function isWeeklyCountMet(
  habit: HabitRow,
  weeklyCompletionCount: number,
): boolean {
  const freq = habit.frequency_value as { count?: number } | null;
  const requiredCount = freq?.count ?? 1;
  return weeklyCompletionCount >= requiredCount;
}

function isScheduledToday(habit: HabitRow, dayOfWeek: number): boolean {
  if (habit.frequency_type !== 'weekly_days') {
    return true;
  }
  const freq = habit.frequency_value as { days?: number[] } | null;
  const scheduledDays = freq?.days ?? [];
  return scheduledDays.includes(dayOfWeek);
}

// --- Environment validation ---

type EnvConfig = {
  readonly supabaseUrl: string;
  readonly supabaseServiceRoleKey: string;
  readonly vapidPublicKey: string;
  readonly vapidPrivateKey: string;
  readonly vapidSubject: string;
  readonly cronSecret: string;
};

function loadEnvConfig(): EnvConfig | null {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  const cronSecret = process.env.CRON_SECRET;

  if (
    !supabaseUrl ||
    !supabaseServiceRoleKey ||
    !vapidPublicKey ||
    !vapidPrivateKey ||
    !vapidSubject ||
    !cronSecret
  ) {
    return null;
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject,
    cronSecret,
  };
}

// --- Notification sending ---

type SendResult = {
  readonly totalSent: number;
  readonly notifiedHabitIds: readonly string[];
};

async function sendNotificationsPerUser(
  habitsByUser: ReadonlyMap<string, readonly string[]>,
  incompleteHabits: readonly HabitRow[],
  supabase: ReturnType<typeof createClient>,
): Promise<SendResult> {
  let totalSent = 0;
  let notifiedHabitIds: readonly string[] = [];

  for (const [userId, habitNames] of habitsByUser) {
    const body = buildNotificationBody(habitNames);
    if (!body) {
      continue;
    }

    const payload = JSON.stringify({
      title: 'Daily Rituals',
      body,
      icon: '/icon-192x192.png',
      data: { url: '/' },
    });

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (!subscriptions || subscriptions.length === 0) {
      continue;
    }

    let userSendSucceeded = false;

    for (const sub of subscriptions as SubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        totalSent = totalSent + 1;
        userSendSucceeded = true;
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          'statusCode' in error &&
          (error as { statusCode: number }).statusCode === HTTP_GONE
        ) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
      }
    }

    if (userSendSucceeded) {
      const userHabitIds = incompleteHabits
        .filter((h) => h.user_id === userId)
        .map((h) => h.id);
      notifiedHabitIds = [...notifiedHabitIds, ...userHabitIds];
    }
  }

  return { totalSent, notifiedHabitIds };
}

// --- Main handler ---

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const config = loadEnvConfig();
  if (!config) {
    res.status(500).json({ error: 'Missing environment configuration' });
    return;
  }

  // Auth check
  const cronSecretHeader = req.headers['x-cron-secret'];
  if (cronSecretHeader !== config.cronSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  webpush.setVapidDetails(
    config.vapidSubject,
    config.vapidPublicKey,
    config.vapidPrivateKey,
  );

  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);

  const today = getTodayUtc();
  const currentSlot = getCurrentUtcTimeSlot();
  const currentSlotWithSeconds = `${currentSlot}:00`;

  // 1. Query habits with matching reminder_time that haven't been notified today
  const { data: habits, error: habitsError } = await supabase
    .from('habits')
    .select(
      'id, user_id, name, frequency_type, frequency_value, reminder_time, last_notified_date',
    )
    .lte('reminder_time', currentSlotWithSeconds)
    .is('archived_at', null)
    .or(`last_notified_date.is.null,last_notified_date.neq.${today}`);

  if (habitsError) {
    res.status(500).json({ error: habitsError.message });
    return;
  }

  if (!habits || habits.length === 0) {
    res.status(200).json({ sent: 0, message: 'No habits to notify' });
    return;
  }

  const typedHabits = habits as HabitRow[];

  // 2. Get today's completions
  const habitIds = typedHabits.map((h) => h.id);
  const { data: completions, error: completionsError } = await supabase
    .from('completions')
    .select('habit_id')
    .in('habit_id', habitIds)
    .eq('completed_date', today);

  if (completionsError) {
    res.status(500).json({ error: completionsError.message });
    return;
  }

  const completedHabitIds = new Set(
    (completions ?? []).map((c: { habit_id: string }) => c.habit_id),
  );

  // 3. For weekly_count habits, check this week's completions
  const weeklyCountHabitIds = typedHabits
    .filter((h) => h.frequency_type === 'weekly_count')
    .map((h) => h.id);

  const weeklyCompletedSet = new Set<string>();

  if (weeklyCountHabitIds.length > 0) {
    const weekStart = getWeekStartUtc();
    const { data: weeklyCompletions } = await supabase
      .from('completions')
      .select('habit_id')
      .in('habit_id', weeklyCountHabitIds)
      .gte('completed_date', weekStart)
      .lte('completed_date', today);

    if (weeklyCompletions) {
      const countsByHabit = new Map<string, number>();
      for (const c of weeklyCompletions as { habit_id: string }[]) {
        countsByHabit.set(c.habit_id, (countsByHabit.get(c.habit_id) ?? 0) + 1);
      }

      for (const h of typedHabits) {
        if (h.frequency_type !== 'weekly_count') {
          continue;
        }
        if (isWeeklyCountMet(h, countsByHabit.get(h.id) ?? 0)) {
          weeklyCompletedSet.add(h.id);
        }
      }
    }
  }

  // 4. Filter out completed habits and habits not scheduled for today
  const dayOfWeek = getCurrentDayOfWeek();
  const incompleteHabits = typedHabits.filter((h) => {
    if (completedHabitIds.has(h.id)) {
      return false;
    }
    if (weeklyCompletedSet.has(h.id)) {
      return false;
    }
    if (!isScheduledToday(h, dayOfWeek)) {
      return false;
    }
    return true;
  });

  if (incompleteHabits.length === 0) {
    res.status(200).json({ sent: 0, message: 'All habits completed' });
    return;
  }

  // 5. Group by user
  const habitsByUser = new Map<string, readonly string[]>();
  for (const h of incompleteHabits) {
    const names = habitsByUser.get(h.user_id) ?? [];
    habitsByUser.set(h.user_id, [...names, h.name]);
  }

  // 6. Send notifications per user
  const results = await sendNotificationsPerUser(
    habitsByUser,
    incompleteHabits,
    supabase,
  );

  // 7. Update last_notified_date for notified habits
  if (results.notifiedHabitIds.length > 0) {
    await supabase
      .from('habits')
      .update({ last_notified_date: today })
      .in('id', results.notifiedHabitIds);
  }

  res.status(200).json({
    sent: results.totalSent,
    habitsNotified: results.notifiedHabitIds.length,
  });
}
