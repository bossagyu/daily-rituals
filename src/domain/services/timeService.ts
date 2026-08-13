/**
 * timeService - タイムゾーンを明示的に受け取る日付・時刻の純粋関数群。
 *
 * このアプリにおける「今日」「今の時刻」の定義をここに集約していくのが目標状態。
 * ただし現時点ではまだ以下がこのモジュールの外にあり、集約は完了していない：
 * - api/send-reminders.ts の getTodayUtc()（Phase 3 で吸収予定）
 * - src/hooks/useCalendarData.ts の年/月ベースのローカル日付取得（別形状のため未着手・移行時期未定）
 * - src/lib/reminderTime.ts の getBrowserTimezoneOffset()（Phase 3 で吸収予定）
 *
 * クライアント（src/）と Vercel API Route（api/）の双方がこのファイルを参照する。
 *
 * 実装は Intl.DateTimeFormat ベースであり、分オフセット（getTimezoneOffset）を
 * 使わない。これにより DST が自動的に正しく扱われる。
 */

const DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function getDateFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = DATE_FORMATTERS.get(timeZone);
  if (cached) return cached;

  // en-CA は YYYY-MM-DD 形式を返す
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  DATE_FORMATTERS.set(timeZone, formatter);
  return formatter;
}

function getTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = TIME_FORMATTERS.get(timeZone);
  if (cached) return cached;

  // hourCycle: 'h23' により真夜中が 24:00 ではなく 00:00 になる
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  TIME_FORMATTERS.set(timeZone, formatter);
  return formatter;
}

/**
 * 指定タイムゾーンにおけるその瞬間の日付を YYYY-MM-DD で返す。
 */
export function getLocalDate(instant: Date, timeZone: string): string {
  return getDateFormatter(timeZone).format(instant);
}

/**
 * 指定タイムゾーンにおけるその瞬間の時刻を HH:MM で返す。
 */
export function getLocalTime(instant: Date, timeZone: string): string {
  const parts = getTimeFormatter(timeZone).formatToParts(instant);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

/**
 * 日付文字列に日数を加算する。
 *
 * UTC 上で計算するため、DST のある地域でも 1 日が 23 時間や 25 時間になる
 * 影響を受けない。
 */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 指定タイムゾーンにおけるその瞬間の曜日を返す（0=日曜）。
 */
export function getLocalDayOfWeek(instant: Date, timeZone: string): number {
  return new Date(`${getLocalDate(instant, timeZone)}T00:00:00Z`).getUTCDay();
}

/**
 * 指定タイムゾーンにおける、その瞬間が属する週の開始日（日曜）を返す。
 *
 * 日曜始まりであり、これはカレンダーグリッドおよび statsService.getWeekRange と
 * 揃えるための意図的な選択。ただしこのコードベースには週開始の定義が他に複数あり、
 * それらはすべて月曜始まりで、名前だけでは規約の違いが分からない：
 * - src/domain/services/streakService.ts の（モジュール非公開の）getWeekStart
 * - src/hooks/streakOperations.ts の getWeekStartDate
 * - api/send-reminders.ts の getWeekStartUtc（isWeeklyCountMet に渡される）
 *
 * Phase 3 で send-reminders.ts の getWeekStartUtc() をこの getWeekStartSunday(now, tz)
 * に置き換える計画があるが、これは単純な差し替えではない。日曜始まりへの変更により
 * weekly_count の集計ウィンドウが最大 1 日分ずれる、意図的な挙動変更になる。
 */
export function getWeekStartSunday(instant: Date, timeZone: string): string {
  const date = getLocalDate(instant, timeZone);
  return addDays(date, -getLocalDayOfWeek(instant, timeZone));
}

/**
 * 時刻を指定分単位に切り捨てる。
 */
export function floorToSlot(time: string, slotMinutes: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  const floored = Math.floor(minutes / slotMinutes) * slotMinutes;
  return `${pad(hours)}:${pad(floored)}`;
}

/**
 * IANA タイムゾーン名として有効か。
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * 実行環境のタイムゾーンを IANA 名で返す。
 */
export function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
