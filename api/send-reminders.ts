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
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import {
  getLocalDate,
  getLocalTime,
  getLocalDayOfWeek,
  getWeekStartSunday,
  floorToSlot,
  isValidTimeZone,
} from '../src/domain/services/timeService';

// --- Constants ---

const NOTIFICATION_WINDOW_MINUTES = 10;
const HTTP_GONE = 410;
const MAX_DISPLAY_HABITS = 3;
const DEFAULT_TIME_ZONE = 'Asia/Tokyo';

// --- Types ---

export type HabitRow = {
  readonly id: string;
  readonly user_id: string;
  readonly name: string;
  readonly frequency_type: string;
  readonly frequency_value: unknown;
  readonly reminder_time: string;
  readonly last_notified_date: string | null;
  readonly timezone: string;
};

export type UserContext = {
  readonly today: string;
  readonly slot: string;
  readonly dayOfWeek: number;
  readonly weekStart: string;
};

type SubscriptionRow = {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
};

// --- Pure helper functions ---

/**
 * ユーザーのタイムゾーンにおける、現在の日付・時刻スロット・曜日・週開始日を求める。
 */
export function buildUserContext(instant: Date, timeZone: string): UserContext {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;

  return {
    today: getLocalDate(instant, zone),
    slot: floorToSlot(getLocalTime(instant, zone), NOTIFICATION_WINDOW_MINUTES),
    dayOfWeek: getLocalDayOfWeek(instant, zone),
    weekStart: getWeekStartSunday(instant, zone),
  };
}

/**
 * 通知すべき習慣を選ぶ。
 *
 * すべての判定を習慣の所有者のタイムゾーン基準で行う。
 */
export function selectHabitsToNotify(
  habits: readonly HabitRow[],
  instant: Date,
  completedHabitIds: ReadonlySet<string>,
  weeklyCompletionCounts: ReadonlyMap<string, number>,
): readonly HabitRow[] {
  return habits.filter((habit) => {
    const ctx = buildUserContext(instant, habit.timezone);

    if (habit.reminder_time.slice(0, 5) > ctx.slot) return false;
    if (habit.last_notified_date === ctx.today) return false;
    if (completedHabitIds.has(habit.id)) return false;
    if (!isScheduledToday(habit, ctx.dayOfWeek)) return false;

    if (habit.frequency_type === 'weekly_count') {
      const count = weeklyCompletionCounts.get(habit.id) ?? 0;
      if (isWeeklyCountMet(habit, count)) return false;
    }

    return true;
  });
}

export function buildNotificationBody(habitNames: readonly string[]): string {
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

export function isWeeklyCountMet(
  habit: HabitRow,
  weeklyCompletionCount: number,
): boolean {
  const freq = habit.frequency_value as { count?: number } | null;
  const requiredCount = freq?.count ?? 1;
  return weeklyCompletionCount >= requiredCount;
}

export function isScheduledToday(habit: HabitRow, dayOfWeek: number): boolean {
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
  supabase: SupabaseClient,
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
        const statusCode =
          error instanceof Error && 'statusCode' in error
            ? (error as { statusCode: number }).statusCode
            : undefined;

        if (statusCode === HTTP_GONE) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        } else {
          console.error('Failed to send push notification:', sub.endpoint, error);
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

  const now = new Date();

  // 1. リマインダー設定のある有効な習慣を、所有者のタイムゾーンつきで取得する
  const { data: habits, error: habitsError } = await supabase
    .from('habits')
    .select(
      'id, user_id, name, frequency_type, frequency_value, reminder_time, last_notified_date, profiles!inner(timezone)',
    )
    .not('reminder_time', 'is', null)
    .is('archived_at', null);

  if (habitsError) {
    res.status(500).json({ error: habitsError.message });
    return;
  }

  const typedHabits: HabitRow[] = (habits ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    frequency_type: row.frequency_type,
    frequency_value: row.frequency_value,
    reminder_time: row.reminder_time,
    last_notified_date: row.last_notified_date,
    timezone:
      (row.profiles as { timezone?: string } | null)?.timezone ?? DEFAULT_TIME_ZONE,
  }));

  if (typedHabits.length === 0) {
    res.status(200).json({ sent: 0, message: 'No habits with reminders' });
    return;
  }

  // 2. 各習慣の所有者にとっての「今日」の完了記録を取得する
  const localTodayByHabit = new Map(
    typedHabits.map((h) => [h.id, buildUserContext(now, h.timezone).today]),
  );
  const targetDates = [...new Set(localTodayByHabit.values())];

  const { data: completions, error: completionsError } = await supabase
    .from('completions')
    .select('habit_id, completed_date')
    .in(
      'habit_id',
      typedHabits.map((h) => h.id),
    )
    .in('completed_date', targetDates);

  if (completionsError) {
    res.status(500).json({ error: completionsError.message });
    return;
  }

  const completedHabitIds = new Set(
    (completions ?? [])
      .filter(
        (c: { habit_id: string; completed_date: string }) =>
          c.completed_date === localTodayByHabit.get(c.habit_id),
      )
      .map((c: { habit_id: string }) => c.habit_id),
  );

  // 3. weekly_count 習慣の今週の完了数を、所有者の週開始日（日曜）基準で取得する
  const weeklyCountHabits = typedHabits.filter(
    (h) => h.frequency_type === 'weekly_count',
  );
  const weeklyCompletionCounts = new Map<string, number>();

  if (weeklyCountHabits.length > 0) {
    const weekStartByHabit = new Map(
      weeklyCountHabits.map((h) => [h.id, buildUserContext(now, h.timezone).weekStart]),
    );
    const earliestWeekStart = [...weekStartByHabit.values()].reduce((min, d) =>
      d < min ? d : min,
    );

    const { data: weeklyCompletions, error: weeklyError } = await supabase
      .from('completions')
      .select('habit_id, completed_date')
      .in(
        'habit_id',
        weeklyCountHabits.map((h) => h.id),
      )
      .gte('completed_date', earliestWeekStart);

    if (weeklyError) {
      res.status(500).json({ error: weeklyError.message });
      return;
    }

    for (const c of (weeklyCompletions ?? []) as {
      habit_id: string;
      completed_date: string;
    }[]) {
      const weekStart = weekStartByHabit.get(c.habit_id);
      const localToday = localTodayByHabit.get(c.habit_id);
      if (weekStart === undefined || localToday === undefined) continue;
      if (c.completed_date < weekStart || c.completed_date > localToday) continue;
      weeklyCompletionCounts.set(
        c.habit_id,
        (weeklyCompletionCounts.get(c.habit_id) ?? 0) + 1,
      );
    }
  }

  // 4. 通知すべき習慣を選ぶ（所有者のタイムゾーン基準）
  const notifiableHabits = selectHabitsToNotify(
    typedHabits,
    now,
    completedHabitIds,
    weeklyCompletionCounts,
  );

  if (notifiableHabits.length === 0) {
    res.status(200).json({ sent: 0, message: 'All habits completed' });
    return;
  }

  // 5. Group by user
  const habitsByUser = new Map<string, readonly string[]>();
  for (const h of notifiableHabits) {
    const names = habitsByUser.get(h.user_id) ?? [];
    habitsByUser.set(h.user_id, [...names, h.name]);
  }

  // 6. Send notifications per user
  const results = await sendNotificationsPerUser(
    habitsByUser,
    notifiableHabits,
    supabase,
  );

  // 7. 通知した習慣の last_notified_date を、所有者のローカル今日で更新する
  for (const habitId of results.notifiedHabitIds) {
    await supabase
      .from('habits')
      .update({ last_notified_date: localTodayByHabit.get(habitId) })
      .eq('id', habitId);
  }

  res.status(200).json({
    sent: results.totalSent,
    habitsNotified: results.notifiedHabitIds.length,
  });
}
