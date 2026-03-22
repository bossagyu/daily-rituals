/**
 * send-reminders Edge Function
 *
 * Queries habits with reminder_time that match the current UTC time slot,
 * checks whether they are already completed today, and sends push
 * notifications for incomplete habits.
 *
 * Invoked periodically via pg_cron with Authorization: Bearer <service_role_key>.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildNotificationBody } from './notification.ts';
import { sendWebPush } from './web-push.ts';

const MINUTES_PER_HOUR = 60;
const NOTIFICATION_WINDOW_MINUTES = 10;
const HTTP_GONE = 410;

type HabitRow = {
  id: string;
  user_id: string;
  name: string;
  frequency_type: string;
  frequency_value: unknown;
  reminder_time: string;
  last_notified_date: string | null;
};

type SubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

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

Deno.serve(async (req: Request) => {
  // Deployed with --no-verify-jwt to bypass Edge Runtime JWT issues with pg_cron.
  // Auth via dedicated CRON_SECRET header to prevent unauthorized access.
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret) {
    const authHeader = req.headers.get('x-cron-secret');
    if (authHeader !== cronSecret) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Missing environment configuration', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';

  const today = getTodayUtc();
  const currentSlot = getCurrentUtcTimeSlot();
  const currentSlotWithSeconds = `${currentSlot}:00`;

  // 2. Query habits with matching reminder_time that haven't been notified today
  const { data: habits, error: habitsError } = await supabase
    .from('habits')
    .select('id, user_id, name, frequency_type, frequency_value, reminder_time, last_notified_date')
    .lte('reminder_time', currentSlotWithSeconds)
    .is('archived_at', null)
    .or(`last_notified_date.is.null,last_notified_date.neq.${today}`);

  if (habitsError) {
    return new Response(
      JSON.stringify({ error: habitsError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!habits || habits.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, message: 'No habits to notify' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const typedHabits = habits as HabitRow[];

  // 3. Get today's completions for the relevant habit IDs
  const habitIds = typedHabits.map((h) => h.id);
  const { data: completions, error: completionsError } = await supabase
    .from('completions')
    .select('habit_id')
    .in('habit_id', habitIds)
    .eq('completed_date', today);

  if (completionsError) {
    return new Response(
      JSON.stringify({ error: completionsError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const completedHabitIds = new Set(
    (completions ?? []).map((c: { habit_id: string }) => c.habit_id),
  );

  // 4. For weekly_count habits, check this week's completions
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
        if (h.frequency_type !== 'weekly_count') continue;
        const freq = h.frequency_value as { count?: number } | null;
        const requiredCount = freq?.count ?? 1;
        const actualCount = countsByHabit.get(h.id) ?? 0;
        if (actualCount >= requiredCount) {
          weeklyCompletedSet.add(h.id);
        }
      }
    }
  }

  // 5. Filter out completed habits and habits not scheduled for today
  const dayOfWeek = getCurrentDayOfWeek();
  const incompleteHabits = typedHabits.filter((h) => {
    // Already completed today (daily/weekly_days)
    if (completedHabitIds.has(h.id)) return false;

    // Weekly count already met
    if (weeklyCompletedSet.has(h.id)) return false;

    // Weekly days: check if today is a scheduled day
    if (h.frequency_type === 'weekly_days') {
      const freq = h.frequency_value as { days?: number[] } | null;
      const scheduledDays = freq?.days ?? [];
      if (!scheduledDays.includes(dayOfWeek)) return false;
    }

    return true;
  });

  if (incompleteHabits.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, message: 'All habits completed' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 6. Group by user
  const habitsByUser = new Map<string, string[]>();
  for (const h of incompleteHabits) {
    const names = habitsByUser.get(h.user_id) ?? [];
    habitsByUser.set(h.user_id, [...names, h.name]);
  }

  let totalSent = 0;
  const notifiedHabitIds: string[] = [];

  // 7. Send notifications per user
  for (const [userId, habitNames] of habitsByUser) {
    const body = buildNotificationBody(habitNames);
    if (!body) continue;

    const payload = JSON.stringify({
      title: 'Daily Rituals リマインダー',
      body,
    });

    // Get user's push subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (!subscriptions || subscriptions.length === 0) continue;

    for (const sub of subscriptions as SubscriptionRow[]) {
      try {
        await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          { publicKey: vapidPublicKey, privateKey: vapidPrivateKey, subject: vapidSubject },
        );
        totalSent++;
      } catch (error: unknown) {
        // 410 Gone: subscription expired, clean up
        if (error instanceof Error && error.message.includes(String(HTTP_GONE))) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
      }
    }

    // Collect habit IDs for this user to mark as notified
    for (const h of incompleteHabits) {
      if (h.user_id === userId) {
        notifiedHabitIds.push(h.id);
      }
    }
  }

  // 8. Update last_notified_date for notified habits
  if (notifiedHabitIds.length > 0) {
    await supabase
      .from('habits')
      .update({ last_notified_date: today })
      .in('id', notifiedHabitIds);
  }

  return new Response(
    JSON.stringify({ sent: totalSent, habitsNotified: notifiedHabitIds.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
