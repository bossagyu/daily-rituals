/**
 * Vercel API Route: send-reminders
 *
 * Queries habits with a reminder_time set, and for each one judges the
 * current time slot, completion status, and notification history in the
 * habit owner's own timezone (profiles.timezone), then sends push
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
  getWeekStartMonday,
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

export type CompletionRow = {
  readonly habit_id: string;
  readonly completed_date: string;
};

// --- Pure helper functions ---

/**
 * ユーザーのタイムゾーンにおける、現在の日付・時刻スロット・曜日・週開始日（月曜）を求める。
 *
 * weekStart は月曜始まり。src/hooks/streakOperations.ts / streakService.ts の週次進捗
 * 計算と揃えており、これは TodayHabitCard の「今週 {done}/{target}」表示（この通知が
 * 指す当のカード）と一致させるため。詳細は timeService.getWeekStartMonday のコメント参照。
 */
export function buildUserContext(instant: Date, timeZone: string): UserContext {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;

  return {
    today: getLocalDate(instant, zone),
    slot: floorToSlot(getLocalTime(instant, zone), NOTIFICATION_WINDOW_MINUTES),
    dayOfWeek: getLocalDayOfWeek(instant, zone),
    weekStart: getWeekStartMonday(instant, zone),
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

/**
 * completion のうち、その habit の所有者にとっての「ローカル今日」と一致するものだけを
 * 完了済みとして拾う。ユーザーごとにローカル今日が異なるため、単一の "today" ではなく
 * habit ごとの日付で照合する。
 */
export function selectCompletedHabitIds(
  completions: readonly CompletionRow[],
  localTodayByHabit: ReadonlyMap<string, string>,
): ReadonlySet<string> {
  return new Set(
    completions
      .filter((c) => c.completed_date === localTodayByHabit.get(c.habit_id))
      .map((c) => c.habit_id),
  );
}

/**
 * weekly_count 習慣ごとに、所有者のローカル週開始日〜ローカル今日の範囲内にある
 * completion 件数を数える。
 */
export function countWeeklyCompletions(
  completions: readonly CompletionRow[],
  weekStartByHabit: ReadonlyMap<string, string>,
  localTodayByHabit: ReadonlyMap<string, string>,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const c of completions) {
    const weekStart = weekStartByHabit.get(c.habit_id);
    const localToday = localTodayByHabit.get(c.habit_id);
    if (weekStart === undefined || localToday === undefined) continue;
    if (c.completed_date < weekStart || c.completed_date > localToday) continue;
    counts.set(c.habit_id, (counts.get(c.habit_id) ?? 0) + 1);
  }
  return counts;
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

  // 1. リマインダー設定のある有効な習慣を取得する
  const { data: habits, error: habitsError } = await supabase
    .from('habits')
    .select(
      'id, user_id, name, frequency_type, frequency_value, reminder_time, last_notified_date',
    )
    .not('reminder_time', 'is', null)
    .is('archived_at', null);

  if (habitsError) {
    res.status(500).json({ error: habitsError.message });
    return;
  }

  if (!habits || habits.length === 0) {
    res.status(200).json({ sent: 0, message: 'No habits with reminders' });
    return;
  }

  // habits と profiles の間に外部キーはないため、埋め込み select
  // （profiles!inner(...)）は PostgREST で解決できない。
  // 個別に取得し、JS 側で user_id をキーに結合する。
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, timezone')
    .in('id', [...new Set(habits.map((h) => h.user_id))]);

  if (profilesError) {
    res.status(500).json({ error: profilesError.message });
    return;
  }

  const timeZoneByUser = new Map(
    (profiles ?? []).map((p: { id: string; timezone: string | null }) => [
      p.id,
      p.timezone ?? DEFAULT_TIME_ZONE,
    ]),
  );

  const typedHabits: HabitRow[] = habits.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    frequency_type: row.frequency_type,
    frequency_value: row.frequency_value,
    reminder_time: row.reminder_time,
    last_notified_date: row.last_notified_date,
    timezone: timeZoneByUser.get(row.user_id) ?? DEFAULT_TIME_ZONE,
  }));

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

  const completedHabitIds = selectCompletedHabitIds(
    (completions ?? []) as CompletionRow[],
    localTodayByHabit,
  );

  // 3. weekly_count 習慣の今週の完了数を、所有者の週開始日（月曜）基準で取得する。
  //    月曜始まりなのは buildUserContext / getWeekStartMonday と同じ理由：
  //    TodayHabitCard の「今週 {done}/{target}」表示と揃えるため。日曜始まりに
  //    戻すと表示とズレて土日に通知の有無が食い違う regression を再発させる
  //    （詳細は timeService.getWeekStartMonday のコメント参照）。
  const weeklyCountHabits = typedHabits.filter(
    (h) => h.frequency_type === 'weekly_count',
  );
  let weeklyCompletionCounts: ReadonlyMap<string, number> = new Map();

  if (weeklyCountHabits.length > 0) {
    const weekStartByHabit = new Map(
      weeklyCountHabits.map((h) => [h.id, buildUserContext(now, h.timezone).weekStart]),
    );
    const localTodayForWeekly = weeklyCountHabits.map(
      (h) => localTodayByHabit.get(h.id) as string,
    );
    const earliestWeekStart = [...weekStartByHabit.values()].reduce((min, d) =>
      d < min ? d : min,
    );
    const latestLocalToday = localTodayForWeekly.reduce((max, d) =>
      d > max ? d : max,
    );

    const { data: weeklyCompletions, error: weeklyError } = await supabase
      .from('completions')
      .select('habit_id, completed_date')
      .in(
        'habit_id',
        weeklyCountHabits.map((h) => h.id),
      )
      .gte('completed_date', earliestWeekStart)
      .lte('completed_date', latestLocalToday);

    if (weeklyError) {
      res.status(500).json({ error: weeklyError.message });
      return;
    }

    weeklyCompletionCounts = countWeeklyCompletions(
      (weeklyCompletions ?? []) as CompletionRow[],
      weekStartByHabit,
      localTodayByHabit,
    );
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
    const localToday = localTodayByHabit.get(habitId);
    if (!localToday) {
      continue;
    }
    await supabase
      .from('habits')
      .update({ last_notified_date: localToday })
      .eq('id', habitId);
  }

  res.status(200).json({
    sent: results.totalSent,
    habitsNotified: results.notifiedHabitIds.length,
  });
}
