# 信頼性の立て直し 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 時刻・日付の表現を単一の純粋サービスに統一し、通知パイプラインの障害を設定画面から検知できるようにする。

**Architecture:** `src/domain/services/timeService.ts` を時刻の単一の源泉とし、クライアントと Vercel API Route の双方がこれだけを参照する。`reminder_time` は UTC 保存をやめてユーザーのローカル時刻で保存し、サーバーは `profiles.timezone` を使ってユーザー TZ 基準で判定する。通知の送信結果は `notification_events`、cron の生存は `system_heartbeats` に記録し、設定画面で可視化する。

**Tech Stack:** TypeScript 5.8 (strict) / React 19 / Vitest 4 / Playwright 1.58 / Supabase (Postgres + RLS) / Vercel Serverless (Node) / `@base-ui/react` / `web-push`

**元スペック:** `docs/superpowers/specs/2026-08-11-reliability-design.md`

## Global Constraints

- TypeScript strict モード。`any` を新規に導入しない
- **イミュータブル**: 既存オブジェクトを変更せず、常に新しいオブジェクトを返す
- 関数は 50 行未満、ファイルは 800 行未満（目安 200-400 行）
- `console.log` を残さない（`console.error` はサーバー側のエラー経路のみ可）
- カバレッジ 80% 以上
- UI 文字列は日本語
- 日付は `YYYY-MM-DD` 文字列、時刻は `HH:MM` 文字列で扱う。`Date` 型を層をまたいで渡さない
- コミットメッセージは Conventional Commits（`feat:` / `fix:` / `refactor:` / `test:` / `docs:` / `chore:`）。Co-Authored-By 等の署名は付けない
- **1 Phase = 1 issue = 1 PR**。PR は小さく保つ（25 ファイル超は分割を検討）
- PR 作成前に `npm test` と `npm run test:e2e` をローカルで実行し全件パスを確認する
- PR は DA レビューを必須とする（サイズを問わない）
- 新規ブランチは常に最新の `main` から切る。`main` へ直接 push しない

## File Structure

| ファイル | 責務 | Phase |
|---|---|---|
| `src/domain/services/habitScheduleService.ts` | 新規。習慣がある日付に「有効か / リストに出るか / 統計の分母か」の 3 述語 | 1 |
| `src/domain/services/timeService.ts` | 新規。IANA タイムゾーン基準の日付・時刻・曜日・週開始の純粋関数 | 2 |
| `src/data/repositories/profileRepository.ts` | 新規。`ProfileRepository` インターフェース | 3 |
| `src/data/repositories/supabaseProfileRepository.ts` | 新規。Supabase 実装 | 3 |
| `src/hooks/useTimezoneSync.ts` | 新規。起動時にブラウザ TZ を `profiles` へ同期 | 3 |
| `api/send-test-notification.ts` | 新規。JWT 認証で自分にテスト通知を送る | 4 |
| `src/data/repositories/notificationDiagnosticsRepository.ts` | 新規。heartbeat / events / 自デバイス購読の読み取り | 4 |
| `src/hooks/useNotificationDiagnostics.ts` | 新規。診断データの取得と再登録・テスト送信 | 4 |
| `src/ui/components/NotificationDiagnostics.tsx` | 新規。設定画面の通知セクション | 4 |
| `src/ui/components/ToastProvider.tsx` | 新規。`@base-ui/react/toast` のラッパと `useToast` | 5 |
| `api/send-reminders.ts` | 改修。UTC 判定 → ユーザー TZ 判定、イベント記録 | 3, 4 |
| `src/lib/dateUtils.ts` | 改修。`timeService` へ委譲 | 2 |
| `src/lib/reminderTime.ts` | 改修。UTC 変換関数を削除 | 3 |
| `src/domain/services/calendarService.ts` | 改修。判定と `addDays` を移譲 | 1, 2 |
| `src/ui/pages/TodayPage.tsx` | 改修。active 判定の追加、エラー表示の整理 | 1, 5 |
| `src/ui/pages/SettingsPage.tsx` | 改修。通知診断セクションの追加 | 4 |
| `src/hooks/useCompletions.ts` | 改修。楽観更新とロールバック | 5 |

---

# Phase 1: 習慣スケジュール判定の集約と #109 の修正

**issue タイトル案:** `fix: 過去日に作成前の習慣が表示される問題を修正し、スケジュール判定を集約する (#109)`

**背景:** `TodayPage.tsx:277-284` は `frequencyService.isDueOnDate` だけで判定しており、習慣の作成日を見ていない。そのため過去日に戻ると、その時点で存在しなかった習慣が未達成として並ぶ。一方 `calendarService.ts:95` には作成日・アーカイブ日を考慮する `isHabitActiveOnDate` が既にある。

**注意:** `frequencyService.isDueOnDate` と `calendarService.isHabitDueOnDate` は**同じものではない**。前者は `weekly_count` に対して `true`、後者は `false` を返す。これは意図的な差（Today のリスト表示 vs 統計の分母）なので、統合せず名前で区別する。

### Task 1.1: `habitScheduleService` を作る

**Files:**
- Create: `src/domain/services/habitScheduleService.ts`
- Test: `src/domain/services/__tests__/habitScheduleService.test.ts`

**Interfaces:**
- Consumes: `Habit`（`src/domain/models/habit.ts`）
- Produces:
  - `isActiveOnDate(habit: Habit, date: string): boolean`
  - `isListedOnDate(habit: Habit, date: string): boolean`
  - `isCountedAsTargetOnDate(habit: Habit, date: string): boolean`

- [ ] **Step 1: 失敗するテストを書く**

`src/domain/services/__tests__/habitScheduleService.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  isActiveOnDate,
  isListedOnDate,
  isCountedAsTargetOnDate,
} from '../habitScheduleService';
import type { Habit } from '@/domain/models/habit';

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    userId: 'u1',
    name: 'テスト習慣',
    frequency: { type: 'daily' },
    color: '#a78bfa',
    createdAt: '2026-03-10T00:00:00.000Z',
    archivedAt: null,
    reminderTime: null,
    lastNotifiedDate: null,
    ...overrides,
  };
}

describe('isActiveOnDate', () => {
  it('作成日当日は有効', () => {
    expect(isActiveOnDate(makeHabit(), '2026-03-10')).toBe(true);
  });

  it('作成日の前日は無効', () => {
    expect(isActiveOnDate(makeHabit(), '2026-03-09')).toBe(false);
  });

  it('アーカイブ日当日は有効', () => {
    const habit = makeHabit({ archivedAt: '2026-03-20T00:00:00.000Z' });
    expect(isActiveOnDate(habit, '2026-03-20')).toBe(true);
  });

  it('アーカイブ日の翌日は無効', () => {
    const habit = makeHabit({ archivedAt: '2026-03-20T00:00:00.000Z' });
    expect(isActiveOnDate(habit, '2026-03-21')).toBe(false);
  });
});

describe('isListedOnDate', () => {
  it('daily はどの日でも true', () => {
    expect(isListedOnDate(makeHabit(), '2026-03-12')).toBe(true);
  });

  it('weekly_days は指定曜日のみ true', () => {
    // 2026-03-12 は木曜（4）
    const habit = makeHabit({ frequency: { type: 'weekly_days', days: [4] } });
    expect(isListedOnDate(habit, '2026-03-12')).toBe(true);
    expect(isListedOnDate(habit, '2026-03-13')).toBe(false);
  });

  it('weekly_count はいつでも実施できるので true', () => {
    const habit = makeHabit({ frequency: { type: 'weekly_count', count: 3 } });
    expect(isListedOnDate(habit, '2026-03-12')).toBe(true);
  });
});

describe('isCountedAsTargetOnDate', () => {
  it('weekly_count は特定日の目標を持たないので false', () => {
    const habit = makeHabit({ frequency: { type: 'weekly_count', count: 3 } });
    expect(isCountedAsTargetOnDate(habit, '2026-03-12')).toBe(false);
  });

  it('daily は true', () => {
    expect(isCountedAsTargetOnDate(makeHabit(), '2026-03-12')).toBe(true);
  });

  it('weekly_days は指定曜日のみ true', () => {
    const habit = makeHabit({ frequency: { type: 'weekly_days', days: [4] } });
    expect(isCountedAsTargetOnDate(habit, '2026-03-12')).toBe(true);
    expect(isCountedAsTargetOnDate(habit, '2026-03-13')).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/domain/services/__tests__/habitScheduleService.test.ts`
Expected: FAIL — `Failed to resolve import "../habitScheduleService"`

- [ ] **Step 3: 実装する**

`src/domain/services/habitScheduleService.ts`:

```ts
/**
 * habitScheduleService - ある日付に習慣がどう扱われるかを判定する純粋関数群。
 *
 * 3 つの述語は目的が異なる。特に weekly_count の扱いが isListedOnDate と
 * isCountedAsTargetOnDate で逆になる点に注意すること。
 *   - isListedOnDate: 週 N 回の習慣はどの日でも実施できるので、リストには出す
 *   - isCountedAsTargetOnDate: 週 N 回の習慣は特定日の目標を持たないので、
 *     日次の達成率の分母には数えない
 */

import type { Habit } from '../models/habit';

/**
 * 日付文字列の曜日を返す（0=日曜）。
 * タイムゾーンの影響を受けないよう UTC として解釈する。
 */
function getDayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/**
 * その日付の時点で習慣が存在し、まだアーカイブされていないか。
 */
export function isActiveOnDate(habit: Habit, date: string): boolean {
  if (date < habit.createdAt.slice(0, 10)) return false;

  if (habit.archivedAt !== null && date > habit.archivedAt.slice(0, 10)) {
    return false;
  }

  return true;
}

/**
 * Today 画面のリストに表示すべきか。
 */
export function isListedOnDate(habit: Habit, date: string): boolean {
  switch (habit.frequency.type) {
    case 'daily':
      return true;
    case 'weekly_days':
      return habit.frequency.days.includes(getDayOfWeek(date));
    case 'weekly_count':
      return true;
  }
}

/**
 * その日の達成率の分母（目標数）に数えるべきか。
 */
export function isCountedAsTargetOnDate(habit: Habit, date: string): boolean {
  switch (habit.frequency.type) {
    case 'daily':
      return true;
    case 'weekly_days':
      return habit.frequency.days.includes(getDayOfWeek(date));
    case 'weekly_count':
      return false;
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/domain/services/__tests__/habitScheduleService.test.ts`
Expected: PASS（13 テスト）

- [ ] **Step 5: コミット**

```bash
git add src/domain/services/habitScheduleService.ts src/domain/services/__tests__/habitScheduleService.test.ts
git commit -m "feat: 習慣スケジュール判定を habitScheduleService に集約"
```

### Task 1.2: `calendarService` と `xpService` を移譲する

**Files:**
- Modify: `src/domain/services/calendarService.ts:95-113`（`isHabitActiveOnDate` / `isHabitDueOnDate` を削除）
- Modify: `src/domain/services/calendarService.ts:145-150`（`calculateDailyAchievements` の呼び出し）
- Modify: `src/domain/services/xpService.ts:3`（import 元の変更）
- Modify: `src/domain/services/__tests__/calendarService.test.ts`（削除した関数のテストを移動済みとして除去）

**Interfaces:**
- Consumes: Task 1.1 の `isActiveOnDate` / `isCountedAsTargetOnDate`

- [ ] **Step 1: 既存テストを実行してベースラインを取る**

Run: `npx vitest run src/domain/services/__tests__/calendarService.test.ts src/domain/services/__tests__/xpService.test.ts`
Expected: PASS（この時点では全て通る。移譲後も同じ結果になることが目標）

- [ ] **Step 2: `calendarService` から関数を削除して移譲する**

`src/domain/services/calendarService.ts` の先頭 import に追加:

```ts
import {
  isActiveOnDate,
  isCountedAsTargetOnDate,
} from './habitScheduleService';
```

`isHabitActiveOnDate`（95-105 行）と `isHabitDueOnDate`（107-113 行）の定義を**削除**し、
`calculateDailyAchievements` 内（145-150 行）の呼び出しを差し替える:

```ts
    for (const habit of habits) {
      if (!isActiveOnDate(habit, current)) continue;

      if (isCountedAsTargetOnDate(habit, current)) {
        targetCount++;
      }
```

- [ ] **Step 3: `xpService` の import を差し替える**

`src/domain/services/xpService.ts:3` を次のように変更:

```ts
import { addDays } from './calendarService';
import { isActiveOnDate, isCountedAsTargetOnDate } from './habitScheduleService';
```

`calculateAllCompleteBonuses` 内（136-137 行）の呼び出しを差し替える:

```ts
    const dueHabits = habits.filter(
      (h) => isActiveOnDate(h, current) && isCountedAsTargetOnDate(h, current),
    );
```

- [ ] **Step 4: 既存テストの import を修正する**

`src/domain/services/__tests__/calendarService.test.ts` から `isHabitActiveOnDate` /
`isHabitDueOnDate` の import と、それらの `describe` ブロックを削除する（同等のテストは
Task 1.1 で `habitScheduleService.test.ts` に存在する）。

- [ ] **Step 5: 全テストが通ることを確認**

Run: `npm test`
Expected: PASS。特に `xpService.test.ts` の結果が Step 1 と一致すること（挙動を変えていないため）

- [ ] **Step 6: コミット**

```bash
git add src/domain/services/
git commit -m "refactor: calendarService と xpService を habitScheduleService に移譲"
```

### Task 1.3: `TodayPage` の判定を修正する（#109）

**Files:**
- Modify: `src/ui/pages/TodayPage.tsx:18`（import）
- Modify: `src/ui/pages/TodayPage.tsx:277-284`（`dueHabits`）
- Modify: `src/domain/services/frequencyService.ts:12-23`（`isDueOnDate` を削除）
- Test: `src/ui/pages/__tests__/TodayPage.test.tsx`

**Interfaces:**
- Consumes: Task 1.1 の `isActiveOnDate` / `isListedOnDate`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/pages/__tests__/TodayPage.test.tsx` の既存の `describe` に追加する。
既存ファイルのモック構成（`useRepositories` / `useHabits` / `useCompletions` のモック）を
そのまま使うこと。

```ts
  it('選択日が習慣の作成日より前なら、その習慣を表示しない', async () => {
    const habit = makeHabit({
      id: 'h-new',
      name: '後から追加した習慣',
      createdAt: '2026-03-20T00:00:00.000Z',
    });
    mockUseHabits.mockReturnValue({
      habits: [habit],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });

    renderTodayPage({ initialEntries: ['/?date=2026-03-19'] });

    expect(await screen.findByText('この日にやるべきことはありませんでした')).toBeInTheDocument();
    expect(screen.queryByText('後から追加した習慣')).not.toBeInTheDocument();
  });

  it('選択日が習慣の作成日当日なら、その習慣を表示する', async () => {
    const habit = makeHabit({
      id: 'h-new',
      name: '後から追加した習慣',
      createdAt: '2026-03-20T00:00:00.000Z',
    });
    mockUseHabits.mockReturnValue({
      habits: [habit],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });

    renderTodayPage({ initialEntries: ['/?date=2026-03-20'] });

    expect(await screen.findByText('後から追加した習慣')).toBeInTheDocument();
  });
```

`makeHabit` と `renderTodayPage` がファイルに未定義なら、既存のテストが使っている
セットアップに合わせてヘルパーを追加すること。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/ui/pages/__tests__/TodayPage.test.tsx`
Expected: FAIL — 作成日前のテストで「後から追加した習慣」が表示されてしまう

- [ ] **Step 3: `TodayPage` を修正する**

`src/ui/pages/TodayPage.tsx:18` の import を差し替える:

```ts
import { isActiveOnDate, isListedOnDate } from '@/domain/services/habitScheduleService';
```

`dueHabits`（277-284 行）を差し替える。`Date` オブジェクトの組み立てが不要になる:

```ts
  const dueHabits = useMemo(
    () =>
      habits.filter(
        (habit) =>
          isActiveOnDate(habit, selectedDate) && isListedOnDate(habit, selectedDate),
      ),
    [habits, selectedDate],
  );
```

- [ ] **Step 4: `frequencyService.isDueOnDate` を削除する**

`src/domain/services/frequencyService.ts` の `isDueOnDate`（12-23 行）と、
使われなくなった `Habit` 以外の import を削除する。`getWeeklyProgress` は残す。
`src/domain/services/__tests__/frequencyService.test.ts` から `isDueOnDate` の
`describe` ブロックを削除する。

- [ ] **Step 5: 全テストが通ることを確認**

Run: `npm test && npm run typecheck && npm run lint`
Expected: すべて PASS。`isDueOnDate` の未解決参照が残っていないこと

- [ ] **Step 6: コミット**

```bash
git add src/ui/pages/TodayPage.tsx src/ui/pages/__tests__/TodayPage.test.tsx src/domain/services/frequencyService.ts src/domain/services/__tests__/frequencyService.test.ts
git commit -m "fix: 過去日に作成前の習慣が表示される問題を修正 (#109)"
```

### Task 1.4: E2E 回帰テスト

**Files:**
- Modify: `e2e/specs/past-completion.spec.ts`

- [ ] **Step 1: E2E テストを追加する**

`e2e/specs/past-completion.spec.ts` に追加。既存ファイルの `test.describe` と
`e2e/helpers/test-data.ts` のシード関数をそのまま使うこと。

```ts
  test('習慣の作成日より前の日付には、その習慣が表示されない', async ({ page }) => {
    // 今日作成した習慣は、昨日の画面に出てはいけない
    await page.goto('/');
    await expect(page.getByText(habitName)).toBeVisible();

    await page.getByRole('button', { name: '前の日' }).click();

    await expect(page.getByText(habitName)).not.toBeVisible();
    await expect(
      page.getByText('この日にやるべきことはありませんでした'),
    ).toBeVisible();
  });
```

- [ ] **Step 2: E2E を実行する**

Run: `npm run test:e2e -- past-completion`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add e2e/specs/past-completion.spec.ts
git commit -m "test: 作成日より前の日付に習慣が出ない回帰テストを追加 (#109)"
```

### Task 1.5: PR 作成

- [ ] **Step 1: 全テストを実行**

Run: `npm test && npm run test:e2e && npm run typecheck && npm run lint`
Expected: 全件 PASS

- [ ] **Step 2: PR を作成し、DA レビューを依頼する**

```bash
git push -u origin fix/habit-schedule-service
gh pr create --title "fix: 過去日に作成前の習慣が表示される問題を修正し、スケジュール判定を集約する (#109)" --body "..."
```

---

# Phase 2: `timeService` の導入と日付ユーティリティの統合

**issue タイトル案:** `refactor: 日付・時刻の判定を timeService に集約し、api/ を型チェック対象に加える`

**背景:** 「今日」の定義が `src/lib/dateUtils.ts`、`src/hooks/useStatsData.ts:38-41`（再実装）、`api/send-reminders.ts:41-43`（UTC）の 3 箇所にある。`addDays` も `src/lib/dateUtils.ts:65` と `src/domain/services/calendarService.ts:115` に重複している。さらに `tsconfig.json` の `include` が `["src", "vite.config.ts"]` のため `api/` が型チェックされていない。

**この Phase では `reminder_time` の意味を変えない。** 純粋関数の追加とクライアント内の重複解消のみに留め、単独でマージ可能にする。

### Task 2.1: `api/` から `src/` を import できるか検証する

**このタスクは Phase 3 の前提条件である。** `api/` から `src/domain/services/` への相対 import が
Vercel のデプロイで実際に動くことを確認しないまま Phase 3 に進んではならない
（web-push の Deno 非互換を本番デプロイ後に発見した経緯があるため）。

- [ ] **Step 1: 検証用の import を `api/send-reminders.ts` に追加する**

ファイル冒頭の import に追加し、`handler` の先頭でレスポンスに含める:

```ts
import { floorToSlot } from '../src/domain/services/timeService';
```

一時的に、既存の `getCurrentUtcTimeSlot()` の戻り値と `floorToSlot` の結果が一致することを
レスポンスの `debugSlot` フィールドで返す（このデバッグコードは Step 4 で削除する）。

- [ ] **Step 2: PR の自動プレビューで確認する**

Vercel の Git 連携が PR ごとにプレビューデプロイを自動生成する。Vercel CLI の
ローカル認証は使わない。

1. この Phase のブランチを push し、PR を作る（Task 2.4 の PR を先に開いてよい）
2. PR に付く Vercel のプレビュー URL を開く
3. そのプレビューに対して `x-cron-secret` 付きで POST し、200 が返ることを確認する

```bash
curl -i -X POST "https://<preview-url>/api/send-reminders" \
  -H "x-cron-secret: $CRON_SECRET"
```

4. Vercel のデプロイログに、`api/send-reminders.ts` のビルドエラー（`../src/...`
   が解決できない等）が出ていないことを確認する

Expected: HTTP 200。`Cannot find module` 等のビルド/実行時エラーが出ていないこと

- [ ] **Step 3: 結果を記録する**

動いた場合: 相対 import 方式で Phase 3 に進む。
動かなかった場合: `timeService.ts` を `shared/timeService.ts` に置き、`src/` と `api/` の
両方から相対パスで参照する構成に切り替える。この場合、以降のタスクの
`src/domain/services/timeService` を `shared/timeService` に読み替えること。

判断結果をこの計画ファイルの本タスク直下にコメントとして追記し、コミットする。

- [ ] **Step 4: デバッグコードを削除する**

`debugSlot` フィールドと一時的な import を削除し、`api/send-reminders.ts` を元に戻す。

### Task 2.2: `timeService` を作る

**Files:**
- Create: `src/domain/services/timeService.ts`
- Test: `src/domain/services/__tests__/timeService.test.ts`

**Interfaces:**
- Produces:
  - `getLocalDate(instant: Date, timeZone: string): string`
  - `getLocalTime(instant: Date, timeZone: string): string`
  - `getLocalDayOfWeek(instant: Date, timeZone: string): number`
  - `getWeekStart(instant: Date, timeZone: string): string`
  - `addDays(date: string, days: number): string`
  - `floorToSlot(time: string, slotMinutes: number): string`
  - `isValidTimeZone(timeZone: string): boolean`
  - `getBrowserTimeZone(): string`

- [ ] **Step 1: 失敗するテストを書く**

`src/domain/services/__tests__/timeService.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  getLocalDate,
  getLocalTime,
  getLocalDayOfWeek,
  getWeekStart,
  addDays,
  floorToSlot,
  isValidTimeZone,
} from '../timeService';

const TOKYO = 'Asia/Tokyo';
const NEW_YORK = 'America/New_York';
const KIRITIMATI = 'Pacific/Kiritimati'; // UTC+14

describe('getLocalDate', () => {
  it('UTC 22:00 は東京では翌日', () => {
    expect(getLocalDate(new Date('2026-03-11T22:00:00Z'), TOKYO)).toBe('2026-03-12');
  });

  it('UTC 02:00 はニューヨークでは前日', () => {
    expect(getLocalDate(new Date('2026-03-12T02:00:00Z'), NEW_YORK)).toBe('2026-03-11');
  });

  it('UTC+14 では UTC より 1 日進む', () => {
    expect(getLocalDate(new Date('2026-03-11T12:00:00Z'), KIRITIMATI)).toBe('2026-03-12');
  });
});

describe('getLocalTime', () => {
  it('東京は UTC+9', () => {
    expect(getLocalTime(new Date('2026-03-11T22:00:00Z'), TOKYO)).toBe('07:00');
  });

  it('真夜中を 24:00 ではなく 00:00 として返す', () => {
    expect(getLocalTime(new Date('2026-03-11T15:00:00Z'), TOKYO)).toBe('00:00');
  });

  it('DST 開始後のニューヨークは UTC-4', () => {
    // 2026-03-08 に夏時間開始
    expect(getLocalTime(new Date('2026-03-12T12:00:00Z'), NEW_YORK)).toBe('08:00');
  });

  it('DST 終了後のニューヨークは UTC-5', () => {
    // 2026-11-01 に夏時間終了
    expect(getLocalTime(new Date('2026-11-05T12:00:00Z'), NEW_YORK)).toBe('07:00');
  });
});

describe('getLocalDayOfWeek', () => {
  it('2026-03-12 は木曜（4）', () => {
    expect(getLocalDayOfWeek(new Date('2026-03-12T03:00:00Z'), TOKYO)).toBe(4);
  });

  it('日付をまたぐと曜日も変わる', () => {
    // UTC 2026-03-11T22:00 は東京では 03-12 木曜
    expect(getLocalDayOfWeek(new Date('2026-03-11T22:00:00Z'), TOKYO)).toBe(4);
    // UTC 2026-03-11T12:00 は東京では 03-11 水曜
    expect(getLocalDayOfWeek(new Date('2026-03-11T12:00:00Z'), TOKYO)).toBe(3);
  });
});

describe('getWeekStart', () => {
  it('日曜始まりの週開始日を返す', () => {
    // 2026-03-12 は木曜。直前の日曜は 03-08
    expect(getWeekStart(new Date('2026-03-12T03:00:00Z'), TOKYO)).toBe('2026-03-08');
  });

  it('日曜当日はその日を返す', () => {
    expect(getWeekStart(new Date('2026-03-08T03:00:00Z'), TOKYO)).toBe('2026-03-08');
  });
});

describe('addDays', () => {
  it('月をまたぐ', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
  });

  it('負の日数で戻る', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('うるう年を扱う', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('DST のある地域でも日付がずれない', () => {
    // 2026-03-08 はニューヨークの DST 開始日。ローカル時刻ベースの実装だと壊れる
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
  });
});

describe('floorToSlot', () => {
  it('10 分単位に切り捨てる', () => {
    expect(floorToSlot('07:23', 10)).toBe('07:20');
    expect(floorToSlot('07:00', 10)).toBe('07:00');
    expect(floorToSlot('23:59', 10)).toBe('23:50');
  });
});

describe('isValidTimeZone', () => {
  it('正しい IANA 名を受け入れる', () => {
    expect(isValidTimeZone(TOKYO)).toBe(true);
  });

  it('不正な名前を拒否する', () => {
    expect(isValidTimeZone('Not/AZone')).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/domain/services/__tests__/timeService.test.ts`
Expected: FAIL — `Failed to resolve import "../timeService"`

- [ ] **Step 3: 実装する**

`src/domain/services/timeService.ts`:

```ts
/**
 * timeService - タイムゾーンを明示的に受け取る日付・時刻の純粋関数群。
 *
 * このアプリにおける「今日」「今の時刻」の定義はすべてここに集約する。
 * クライアント（src/）と Vercel API Route（api/）の双方がこのファイルだけを参照する。
 *
 * 実装は Intl.DateTimeFormat ベースであり、分オフセット（getTimezoneOffset）を
 * 使わない。これにより DST が自動的に正しく扱われる。
 */

const DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

const MINUTES_PER_HOUR = 60;

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
 * 日曜始まりはカレンダーグリッドおよび statsService.getWeekRange と揃えている。
 */
export function getWeekStart(instant: Date, timeZone: string): string {
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

export { MINUTES_PER_HOUR };
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/domain/services/__tests__/timeService.test.ts`
Expected: PASS（20 テスト）

- [ ] **Step 5: コミット**

```bash
git add src/domain/services/timeService.ts src/domain/services/__tests__/timeService.test.ts
git commit -m "feat: タイムゾーンを明示する timeService を追加"
```

### Task 2.3: `dateUtils` と `calendarService` の重複を解消する

**Files:**
- Modify: `src/lib/dateUtils.ts:12-15, 65-69, 85-90`
- Modify: `src/domain/services/calendarService.ts:115-119`（`addDays` を削除）
- Modify: `src/domain/services/statsService.ts:9`（import 元の変更）
- Modify: `src/domain/services/xpService.ts:3`（import 元の変更）
- Modify: `src/hooks/useStatsData.ts:35-41`（`getTodayString` の再実装を削除）
- Test: `src/lib/__tests__/dateUtils.test.ts`

**Interfaces:**
- Consumes: Task 2.2 の `getLocalDate` / `addDays` / `getBrowserTimeZone`

- [ ] **Step 1: `dateUtils` を `timeService` へ委譲する**

`src/lib/dateUtils.ts` を書き換える。`getTodayString` と `addDays` は自前実装をやめる。
挙動は変わらない（端末ローカル日付）が、定義が 1 箇所になる。

```ts
/**
 * Date utility functions for date parsing, validation, and formatting.
 *
 * 日付そのものの計算は timeService に委譲し、ここでは「ブラウザのタイムゾーンを
 * 使う」というアプリ固有の判断と、表示用の整形だけを担う。
 */

import {
  getLocalDate,
  getBrowserTimeZone,
  addDays as addDaysToDate,
} from '@/domain/services/timeService';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'] as const;

/**
 * Get today's date as YYYY-MM-DD string, in the browser's timezone.
 */
export function getTodayString(): string {
  return getLocalDate(new Date(), getBrowserTimeZone());
}

/**
 * Add days to a date string and return a new YYYY-MM-DD string.
 */
export function addDays(dateStr: string, days: number): string {
  return addDaysToDate(dateStr, days);
}
```

`parseDateParam` / `formatDisplayDate` / `isToday` / `isFutureDate` は現状のまま残し、
末尾の `formatToDateString` は使われなくなるので削除する。

- [ ] **Step 2: `calendarService.addDays` を削除して `timeService` から import する**

`src/domain/services/calendarService.ts` の `addDays`（115-119 行）を削除し、
冒頭で re-export する（既存の import 元を壊さないため）:

```ts
import { addDays } from './timeService';

export { addDays };
```

`src/domain/services/statsService.ts:9` と `src/domain/services/xpService.ts:3` の
`import { addDays } from './calendarService'` を `from './timeService'` に変更する。
その後 `calendarService.ts` の re-export が不要なら削除する。

- [ ] **Step 3: `useStatsData` の再実装を削除する**

`src/hooks/useStatsData.ts:35-41` の `padTwo` と `getTodayString` の定義を削除し、
冒頭の import に追加する:

```ts
import { getTodayString } from '@/lib/dateUtils';
```

- [ ] **Step 4: `tsconfig.json` に `api` を追加する**

```json
  "include": ["src", "api", "vite.config.ts"]
```

- [ ] **Step 5: 全テストと型チェックを実行する**

Run: `npm test && npm run typecheck && npm run lint`
Expected: すべて PASS。`api/` が型チェック対象に入ったことで新しいエラーが出た場合は、
それが**この Phase の成果**なので `api/send-reminders.ts` を修正して解消する
（型エラーの内容を PR 本文に記録すること）

- [ ] **Step 6: E2E を実行する**

Run: `npm run test:e2e`
Expected: 全件 PASS（日付計算の挙動が変わっていないことの確認）

- [ ] **Step 7: コミット**

```bash
git add src/lib/dateUtils.ts src/domain/services/ src/hooks/useStatsData.ts tsconfig.json
git commit -m "refactor: 日付ユーティリティの重複を解消し api を型チェック対象に追加"
```

### Task 2.4: PR 作成

- [ ] **Step 1: 全テストを実行**

Run: `npm test && npm run test:e2e && npm run typecheck && npm run lint`
Expected: 全件 PASS

- [ ] **Step 2: PR を作成し、DA レビューを依頼する**

PR 本文に Task 2.1 の検証結果（`api/` から `src/` への import が動くか）を必ず記載する。

---

# Phase 3: ユーザータイムゾーンによる判定

**issue タイトル案:** `fix: リマインダーをユーザーのタイムゾーン基準で判定する`

**背景:** `reminder_time` は UTC で保存され、`api/send-reminders.ts` は UTC 日付で「今日」を判定している。一方クライアントは端末ローカル日付を使う。この不一致により、JST 06:00〜08:59 のリマインダーでは完了判定と `last_notified_date` がズレる。また分オフセットによる変換は DST を表現できない。

**この Phase は本番の `reminder_time` を書き換える。** マージ後に iPhone 実機で通知が届くことの確認が必須。

**前提:** Phase 2 Task 2.1 の検証が完了していること。

### Task 3.1: マイグレーションを書く

**Files:**
- Create: `supabase/migrations/20260811000000_add_user_timezone.sql`
- Modify: `src/lib/database.types.ts`（`profiles` に `timezone` を追加）

- [ ] **Step 1: マイグレーションを書く**

`supabase/migrations/20260811000000_add_user_timezone.sql`:

```sql
-- ============================================================
-- ユーザーのタイムゾーンを保持し、reminder_time をローカル時刻へ戻す
-- ============================================================

ALTER TABLE profiles ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo';

-- 既存の reminder_time は UTC で保存されている。これをユーザーの
-- ローカル時刻へ戻す。以降 reminder_time は「ユーザーが画面で見ている時刻」を意味する。
UPDATE habits h SET reminder_time =
  ((DATE '2000-01-01' + h.reminder_time) AT TIME ZONE 'UTC'
     AT TIME ZONE p.timezone)::time
FROM profiles p
WHERE p.id = h.user_id AND h.reminder_time IS NOT NULL;
```

- [ ] **Step 2: ローカル Supabase で適用し、変換を検証する**

```bash
npm run supabase:reset
```

適用後、変換が正しいことを SQL で確認する（`13:00` UTC が `22:00` になるはず）:

```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
  -c "SELECT name, reminder_time FROM habits WHERE reminder_time IS NOT NULL;"
```

- [ ] **Step 3: 変換式を CI で検証できるようにする**

CI の DB は毎回まっさらなので、マイグレーションの UPDATE 自体は対象行を持たない。
そこで**変換式そのもの**を既知の入力で検証する。

`supabase/snippets/verify-timezone-conversion.sql`:

```sql
-- reminder_time の UTC → ローカル変換式が正しいことを検証する。
-- マイグレーション 20260811000000_add_user_timezone.sql と同じ式を使っている。
DO $$
DECLARE
  converted TIME;
BEGIN
  SELECT ((DATE '2000-01-01' + TIME '13:00:00') AT TIME ZONE 'UTC'
            AT TIME ZONE 'Asia/Tokyo')::time
    INTO converted;
  IF converted <> TIME '22:00:00' THEN
    RAISE EXCEPTION 'Asia/Tokyo: expected 22:00:00 but got %', converted;
  END IF;

  -- 日付をまたぐケース: 22:10 UTC は東京では翌日 07:10
  SELECT ((DATE '2000-01-01' + TIME '22:10:00') AT TIME ZONE 'UTC'
            AT TIME ZONE 'Asia/Tokyo')::time
    INTO converted;
  IF converted <> TIME '07:10:00' THEN
    RAISE EXCEPTION 'Asia/Tokyo overnight: expected 07:10:00 but got %', converted;
  END IF;
END $$;
```

`.github/workflows/e2e.yml` の「Grant privileges」ステップの後に追加する:

```yaml
      - name: Verify reminder_time conversion expression
        run: |
          eval "$(supabase status -o env)"
          psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/snippets/verify-timezone-conversion.sql
```

- [ ] **Step 4: `database.types.ts` を更新する**

`src/lib/database.types.ts` の `profiles` の `Row` / `Insert` / `Update` に追加:

```ts
        Row: {
          id: string;
          display_name: string | null;
          timezone: string;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          timezone?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          timezone?: string;
          created_at?: string;
        };
```

- [ ] **Step 5: CI 検証をローカルで実行して確認する**

```bash
psql "$(supabase status -o env | grep '^DB_URL=' | cut -d= -f2- | tr -d '"')" \
  -v ON_ERROR_STOP=1 -f supabase/snippets/verify-timezone-conversion.sql
```

Expected: エラーなく終了（式が誤っていれば `RAISE EXCEPTION` で落ちる）

- [ ] **Step 6: コミット**

```bash
git add supabase/migrations/20260811000000_add_user_timezone.sql supabase/snippets/verify-timezone-conversion.sql .github/workflows/e2e.yml src/lib/database.types.ts
git commit -m "feat: profiles.timezone を追加し reminder_time をローカル時刻へ変換"
```

### Task 3.2: `ProfileRepository` を作る

**Files:**
- Create: `src/data/repositories/profileRepository.ts`
- Create: `src/data/repositories/supabaseProfileRepository.ts`
- Modify: `src/data/repositories/index.ts`
- Modify: `src/hooks/useRepositories.tsx`
- Test: `src/data/repositories/__tests__/supabaseProfileRepository.test.ts`

**Interfaces:**
- Produces:
  - `type Profile = { readonly id: string; readonly displayName: string | null; readonly timezone: string }`
  - `interface ProfileRepository { findMine(): Promise<Profile | null>; updateTimezone(timezone: string): Promise<void> }`
  - `createSupabaseProfileRepository(client, userId): ProfileRepository`

- [ ] **Step 1: 失敗するテストを書く**

`src/data/repositories/__tests__/supabaseProfileRepository.test.ts` を作る。
既存の `supabaseRewardRepository.test.ts` のモック構成（`createMockClient` 的なヘルパー）に
合わせること。

```ts
import { describe, it, expect, vi } from 'vitest';
import { createSupabaseProfileRepository } from '../supabaseProfileRepository';

describe('createSupabaseProfileRepository', () => {
  it('findMine は自分のプロフィールを返す', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'u1', display_name: 'ユーザー', timezone: 'Asia/Tokyo' },
      error: null,
    });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) };

    const repo = createSupabaseProfileRepository(client as never, 'u1');
    const profile = await repo.findMine();

    expect(profile).toEqual({
      id: 'u1',
      displayName: 'ユーザー',
      timezone: 'Asia/Tokyo',
    });
    expect(eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('findMine は行が無ければ null を返す', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) };

    const repo = createSupabaseProfileRepository(client as never, 'u1');
    expect(await repo.findMine()).toBeNull();
  });

  it('updateTimezone は自分の行だけを更新する', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ update })) };

    const repo = createSupabaseProfileRepository(client as never, 'u1');
    await repo.updateTimezone('America/New_York');

    expect(update).toHaveBeenCalledWith({ timezone: 'America/New_York' });
    expect(eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('updateTimezone はエラーを投げる', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    const update = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ update })) };

    const repo = createSupabaseProfileRepository(client as never, 'u1');
    await expect(repo.updateTimezone('America/New_York')).rejects.toThrow(
      'Failed to update timezone: boom',
    );
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/data/repositories/__tests__/supabaseProfileRepository.test.ts`
Expected: FAIL — モジュールが解決できない

- [ ] **Step 3: インターフェースを作る**

`src/data/repositories/profileRepository.ts`:

```ts
/**
 * ProfileRepository - ユーザープロフィールの読み書き。
 */

export type Profile = {
  readonly id: string;
  readonly displayName: string | null;
  readonly timezone: string;
};

export interface ProfileRepository {
  /** 認証済みユーザー自身のプロフィールを返す。存在しなければ null。 */
  findMine(): Promise<Profile | null>;
  /** 自分の timezone を更新する。 */
  updateTimezone(timezone: string): Promise<void>;
}
```

- [ ] **Step 4: Supabase 実装を作る**

`src/data/repositories/supabaseProfileRepository.ts`:

```ts
/**
 * SupabaseProfileRepository - ProfileRepository の Supabase 実装。
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';
import type { Profile, ProfileRepository } from './profileRepository';

const NOT_FOUND_CODE = 'PGRST116';

export const createSupabaseProfileRepository = (
  client: SupabaseClient<Database>,
  userId: string,
): ProfileRepository => ({
  async findMine(): Promise<Profile | null> {
    const { data, error } = await client
      .from('profiles')
      .select()
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === NOT_FOUND_CODE) {
        return null;
      }
      throw new Error(`Failed to fetch profile: ${error.message}`);
    }

    if (!data) return null;

    return {
      id: data.id,
      displayName: data.display_name,
      timezone: data.timezone,
    };
  },

  async updateTimezone(timezone: string): Promise<void> {
    const { error } = await client
      .from('profiles')
      .update({ timezone })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update timezone: ${error.message}`);
    }
  },
});
```

- [ ] **Step 5: DI に登録する**

`src/data/repositories/index.ts` に export を追加する（既存行は変更せず、追記のみ）:

```ts
export type { Profile, ProfileRepository } from './profileRepository';
export { createSupabaseProfileRepository } from './supabaseProfileRepository';
```

`src/hooks/useRepositories.tsx` の Context 値の型と生成箇所に `profileRepository` を追加する。
既存の `habitRepository` などと同じパターンに揃えること。

- [ ] **Step 6: テストが通ることを確認**

Run: `npx vitest run src/data/repositories/__tests__/supabaseProfileRepository.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/data/repositories/ src/hooks/useRepositories.tsx
git commit -m "feat: ProfileRepository を追加し DI に登録"
```

### Task 3.3: 起動時にタイムゾーンを同期する

**Files:**
- Create: `src/hooks/useTimezoneSync.ts`
- Create: `src/hooks/__tests__/timezoneSyncOperations.test.ts`
- Create: `src/hooks/timezoneSyncOperations.ts`
- Modify: `src/ui/layouts/AppLayout.tsx`

**Interfaces:**
- Consumes: Task 3.2 の `ProfileRepository`、Task 2.2 の `isValidTimeZone` / `getBrowserTimeZone`
- Produces: `syncTimezone(repository: ProfileRepository, browserTimeZone: string): Promise<void>`

- [ ] **Step 1: 失敗するテストを書く**

`src/hooks/__tests__/timezoneSyncOperations.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { syncTimezone } from '../timezoneSyncOperations';
import type { ProfileRepository } from '@/data/repositories/profileRepository';

function makeRepo(timezone: string): ProfileRepository & {
  updateTimezone: ReturnType<typeof vi.fn>;
} {
  return {
    findMine: vi.fn().mockResolvedValue({
      id: 'u1',
      displayName: null,
      timezone,
    }),
    updateTimezone: vi.fn().mockResolvedValue(undefined),
  };
}

describe('syncTimezone', () => {
  it('DB と一致していれば更新しない', async () => {
    const repo = makeRepo('Asia/Tokyo');
    await syncTimezone(repo, 'Asia/Tokyo');
    expect(repo.updateTimezone).not.toHaveBeenCalled();
  });

  it('DB と異なれば更新する', async () => {
    const repo = makeRepo('Asia/Tokyo');
    await syncTimezone(repo, 'America/New_York');
    expect(repo.updateTimezone).toHaveBeenCalledWith('America/New_York');
  });

  it('不正なタイムゾーンでは更新しない', async () => {
    const repo = makeRepo('Asia/Tokyo');
    await syncTimezone(repo, 'Not/AZone');
    expect(repo.updateTimezone).not.toHaveBeenCalled();
  });

  it('プロフィールが無ければ更新しない', async () => {
    const repo = makeRepo('Asia/Tokyo');
    repo.findMine = vi.fn().mockResolvedValue(null);
    await syncTimezone(repo, 'America/New_York');
    expect(repo.updateTimezone).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/hooks/__tests__/timezoneSyncOperations.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

`src/hooks/timezoneSyncOperations.ts`:

```ts
/**
 * タイムゾーン同期の純粋なビジネスロジック。
 */

import type { ProfileRepository } from '../data/repositories/profileRepository';
import { isValidTimeZone } from '../domain/services/timeService';

/**
 * ブラウザのタイムゾーンが DB の値と異なれば更新する。
 *
 * 旅行や引っ越しでタイムゾーンが変わったとき、リマインダーの判定基準を
 * 自動的に追従させるために呼ぶ。
 */
export async function syncTimezone(
  repository: ProfileRepository,
  browserTimeZone: string,
): Promise<void> {
  if (!isValidTimeZone(browserTimeZone)) {
    return;
  }

  const profile = await repository.findMine();
  if (!profile) {
    return;
  }

  if (profile.timezone === browserTimeZone) {
    return;
  }

  await repository.updateTimezone(browserTimeZone);
}
```

`src/hooks/useTimezoneSync.ts`:

```ts
/**
 * useTimezoneSync - 起動時にブラウザのタイムゾーンを profiles へ同期する。
 *
 * ベストエフォート。失敗しても既存のタイムゾーンで動作を継続し、
 * ユーザーには通知しない。
 */

import { useEffect } from 'react';
import type { ProfileRepository } from '../data/repositories/profileRepository';
import { getBrowserTimeZone } from '../domain/services/timeService';
import { syncTimezone } from './timezoneSyncOperations';

export function useTimezoneSync(repository: ProfileRepository | null): void {
  useEffect(() => {
    if (!repository) return;

    async function sync(): Promise<void> {
      try {
        await syncTimezone(repository!, getBrowserTimeZone());
      } catch {
        // ベストエフォート。同期の失敗はアプリの動作を妨げない。
      }
    }

    void sync();
  }, [repository]);
}
```

- [ ] **Step 4: `AppLayout` から呼ぶ**

`src/ui/layouts/AppLayout.tsx` で `useRepositories()` から `profileRepository` を取り出し、
`useTimezoneSync(profileRepository)` を呼ぶ。`AppLayout` は `RepositoryProvider` の内側に
あるため、ここが最も早く安定して呼べる場所である。

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test && npm run typecheck`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/hooks/timezoneSyncOperations.ts src/hooks/useTimezoneSync.ts src/hooks/__tests__/timezoneSyncOperations.test.ts src/ui/layouts/AppLayout.tsx
git commit -m "feat: 起動時にブラウザのタイムゾーンを profiles へ同期"
```

### Task 3.4: クライアントの UTC 変換を削除する

**Files:**
- Modify: `src/lib/reminderTime.ts`（`localTimeToUtc` / `utcToLocalTime` / `getBrowserTimezoneOffset` を削除）
- Modify: `src/ui/pages/NewHabitPage.tsx:15, 37-45`
- Modify: `src/ui/pages/HabitDetailPage.tsx:21-24, 95-103, 203-211`
- Modify: `src/domain/models/habitFormValidation.ts:209-211`（コメント修正）
- Modify: `src/lib/__tests__/reminderTime.test.ts`

- [ ] **Step 1: `reminderTime.ts` から変換関数を削除する**

`localTimeToUtc` / `utcToLocalTime` / `getBrowserTimezoneOffset` と、それらだけが使う
`parseTime` / `toTimeString` の一部を削除する。`generateTimeOptions` と
`roundToTenMinutes` は残すため、`toTimeString` と `parseTime` は残す。

`src/lib/__tests__/reminderTime.test.ts` から削除した関数の `describe` を除去する。

- [ ] **Step 2: `NewHabitPage` を修正する**

`src/ui/pages/NewHabitPage.tsx:15` の import を削除し、37-45 行を次のように変更する。
`toCreateHabitInput` が既に `reminderTime` を正しく設定しているため、上書きが不要になる:

```ts
        const input = toCreateHabitInput(formState, user.id);

        if (formState.reminderEnabled) {
          await ensureSubscription();
        }

        await createHabit(input);
        navigate('/habits');
```

- [ ] **Step 3: `HabitDetailPage` を修正する**

`src/ui/pages/HabitDetailPage.tsx:21-24` の import を削除。
94-103 行を次のように変更する（`toCreateHabitInput` は `reminderTime` を
`state.reminderEnabled ? state.reminderTime : null` として既に設定しているため、
`reminderTimeUtc` による上書きが不要になる）:

```ts
        const input = toCreateHabitInput(formState, user.id);

        if (formState.reminderEnabled) {
          await ensureSubscription();
        }

        await updateHabit(id, input);
        navigate('/habits');
```

203-211 行の IIFE を削除し、単純化する:

```ts
      <HabitForm
        initialState={habitToFormState(habit)}
```

- [ ] **Step 4: コメントを修正する**

`src/domain/models/habitFormValidation.ts:210` のコメントを更新する:

```ts
    ? habit.reminderTime.substring(0, 5) // "HH:MM:SS" → "HH:MM"（ユーザーのローカル時刻）
```

- [ ] **Step 5: テストと型チェックを実行する**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS。`localTimeToUtc` の未解決参照が残っていないこと

- [ ] **Step 6: コミット**

```bash
git add src/lib/reminderTime.ts src/lib/__tests__/reminderTime.test.ts src/ui/pages/NewHabitPage.tsx src/ui/pages/HabitDetailPage.tsx src/domain/models/habitFormValidation.ts
git commit -m "refactor: reminder_time の UTC 変換を廃止しローカル時刻で保存する"
```

### Task 3.5: `send-reminders` をユーザー TZ 基準にする

**Files:**
- Modify: `api/send-reminders.ts:41-95, 247-336`
- Test: `api/__tests__/send-reminders.test.ts`

**Interfaces:**
- Consumes: Task 2.2 の `getLocalDate` / `getLocalTime` / `getLocalDayOfWeek` / `getWeekStart` / `floorToSlot`

- [ ] **Step 1: 失敗するテストを書く**

`api/__tests__/send-reminders.test.ts` に追加する。`buildUserContext` は Step 3 で作る
純粋関数で、ユーザー 1 人分の時刻文脈を組み立てる。

```ts
import { describe, it, expect } from 'vitest';
import { buildUserContext, selectHabitsToNotify } from '../send-reminders';
import type { HabitRow } from '../send-reminders';

function makeHabitRow(overrides: Partial<HabitRow> = {}): HabitRow {
  return {
    id: 'h1',
    user_id: 'u1',
    name: '日記',
    frequency_type: 'daily',
    frequency_value: null,
    reminder_time: '07:00:00',
    last_notified_date: null,
    timezone: 'Asia/Tokyo',
    ...overrides,
  };
}

describe('buildUserContext', () => {
  it('UTC 22:00 は東京では翌日 07:00', () => {
    const ctx = buildUserContext(new Date('2026-03-11T22:00:00Z'), 'Asia/Tokyo');
    expect(ctx.today).toBe('2026-03-12');
    expect(ctx.slot).toBe('07:00');
    expect(ctx.dayOfWeek).toBe(4); // 木曜
    expect(ctx.weekStart).toBe('2026-03-08');
  });

  it('10 分スロットに切り捨てる', () => {
    const ctx = buildUserContext(new Date('2026-03-11T22:07:00Z'), 'Asia/Tokyo');
    expect(ctx.slot).toBe('07:00');
  });

  it('不正なタイムゾーンは Asia/Tokyo にフォールバックする', () => {
    const ctx = buildUserContext(new Date('2026-03-11T22:00:00Z'), 'Not/AZone');
    expect(ctx.today).toBe('2026-03-12');
  });
});

describe('selectHabitsToNotify', () => {
  const instant = new Date('2026-03-11T22:00:00Z'); // 東京 03-12 木 07:00

  it('リマインダー時刻を過ぎた未完了の習慣を選ぶ', () => {
    const result = selectHabitsToNotify(
      [makeHabitRow()],
      instant,
      new Set(),
      new Map(),
    );
    expect(result.map((h) => h.id)).toEqual(['h1']);
  });

  it('まだ時刻前の習慣は選ばない', () => {
    const habit = makeHabitRow({ reminder_time: '08:00:00' });
    expect(selectHabitsToNotify([habit], instant, new Set(), new Map())).toEqual([]);
  });

  it('ユーザーのローカル今日で通知済みなら選ばない', () => {
    const habit = makeHabitRow({ last_notified_date: '2026-03-12' });
    expect(selectHabitsToNotify([habit], instant, new Set(), new Map())).toEqual([]);
  });

  it('UTC 日付で通知済みでも、ローカル今日が違えば選ぶ', () => {
    // UTC では 03-11 だが東京では 03-12。UTC 基準の実装だとここで誤ってスキップする
    const habit = makeHabitRow({ last_notified_date: '2026-03-11' });
    expect(selectHabitsToNotify([habit], instant, new Set(), new Map()).map((h) => h.id))
      .toEqual(['h1']);
  });

  it('完了済みの習慣は選ばない', () => {
    expect(
      selectHabitsToNotify([makeHabitRow()], instant, new Set(['h1']), new Map()),
    ).toEqual([]);
  });

  it('weekly_days は当日が対象曜日でなければ選ばない', () => {
    const habit = makeHabitRow({
      frequency_type: 'weekly_days',
      frequency_value: { days: [1] }, // 月曜のみ
    });
    expect(selectHabitsToNotify([habit], instant, new Set(), new Map())).toEqual([]);
  });

  it('weekly_count は今週の目標を満たしていれば選ばない', () => {
    const habit = makeHabitRow({
      frequency_type: 'weekly_count',
      frequency_value: { count: 3 },
    });
    const weeklyCounts = new Map([['h1', 3]]);
    expect(selectHabitsToNotify([habit], instant, new Set(), weeklyCounts)).toEqual([]);
  });

  it('weekly_count は目標未達なら選ぶ', () => {
    const habit = makeHabitRow({
      frequency_type: 'weekly_count',
      frequency_value: { count: 3 },
    });
    const weeklyCounts = new Map([['h1', 2]]);
    expect(selectHabitsToNotify([habit], instant, new Set(), weeklyCounts).map((h) => h.id))
      .toEqual(['h1']);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run api/__tests__/send-reminders.test.ts`
Expected: FAIL — `buildUserContext` / `selectHabitsToNotify` が export されていない

- [ ] **Step 3: 純粋関数を実装する**

`api/send-reminders.ts` の `HabitRow` に `timezone` を追加し、UTC 用ヘルパー
（`getTodayUtc` / `getCurrentUtcTimeSlot` / `getWeekStartUtc` / `getCurrentDayOfWeek`）を
削除して次に置き換える:

```ts
import {
  getLocalDate,
  getLocalTime,
  getLocalDayOfWeek,
  getWeekStart,
  floorToSlot,
  isValidTimeZone,
} from '../src/domain/services/timeService';

const DEFAULT_TIME_ZONE = 'Asia/Tokyo';

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

/**
 * ユーザーのタイムゾーンにおける、現在の日付・時刻スロット・曜日・週開始日を求める。
 */
export function buildUserContext(instant: Date, timeZone: string): UserContext {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;

  return {
    today: getLocalDate(instant, zone),
    slot: floorToSlot(getLocalTime(instant, zone), NOTIFICATION_WINDOW_MINUTES),
    dayOfWeek: getLocalDayOfWeek(instant, zone),
    weekStart: getWeekStart(instant, zone),
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run api/__tests__/send-reminders.test.ts`
Expected: PASS

- [ ] **Step 5: `handler` を書き換える**

`handler` 内のクエリと判定を差し替える。SQL 側の時刻フィルタを外し、
`profiles.timezone` を join する:

```ts
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
```

完了記録の取得は、ユーザーごとにローカル今日が異なるため、対象となる日付の集合で引く:

```ts
  // 2. 各習慣の所有者にとっての「今日」の完了記録を取得する
  const localTodayByHabit = new Map(
    typedHabits.map((h) => [h.id, buildUserContext(now, h.timezone).today]),
  );
  const targetDates = [...new Set(localTodayByHabit.values())];

  const { data: completions, error: completionsError } = await supabase
    .from('completions')
    .select('habit_id, completed_date')
    .in('habit_id', typedHabits.map((h) => h.id))
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
```

`weekly_count` の週次カウントも、所有者の週開始日で引く。既存の
`getWeekStartUtc` を使っていた箇所を `buildUserContext(now, habit.timezone).weekStart` に
差し替えること。

最後に `incompleteHabits` の算出を `selectHabitsToNotify` の呼び出しに置き換え、
`last_notified_date` の更新値もユーザーごとのローカル今日を使う:

```ts
  // 7. 通知した習慣の last_notified_date を、所有者のローカル今日で更新する
  for (const habitId of results.notifiedHabitIds) {
    await supabase
      .from('habits')
      .update({ last_notified_date: localTodayByHabit.get(habitId) })
      .eq('id', habitId);
  }
```

- [ ] **Step 6: 全テストと型チェックを実行する**

Run: `npm test && npm run typecheck`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add api/send-reminders.ts api/__tests__/send-reminders.test.ts
git commit -m "fix: リマインダー判定をユーザーのタイムゾーン基準に変更"
```

### Task 3.6: PR 作成と実機確認

- [ ] **Step 1: 全テストを実行**

Run: `npm test && npm run test:e2e && npm run typecheck && npm run lint`
Expected: 全件 PASS

- [ ] **Step 2: PR を作成し、DA レビューを依頼する**

PR 本文に次を明記すること:
- マイグレーションが本番の `reminder_time` を書き換えること
- マージ後に iPhone 実機での通知確認が必要であること

- [ ] **Step 3: マージ後、iPhone 実機で確認する**

1. 習慣のリマインダー時刻を直近（10 分後）に設定する
2. その習慣を未完了のままにする
3. 次の 10 分境界で iPhone に通知が届くことを確認する
4. `habits.reminder_time` が画面に表示されている時刻と一致していることを DB で確認する

---

# Phase 4: 通知パイプラインの可観測性

**issue タイトル案:** `feat: 通知パイプラインの診断情報を記録し、設定画面で確認できるようにする`

**背景:** 2026-04-21 に購読が失効してから 2026-07-02 に気づくまで 2 ヶ月半かかった。cron は succeeded、HTTP は 200、関数は正常動作という状態のまま誰にも届かない状況が成立してしまう（`docs/investigations/2026-07-02-push-notification-not-delivered.md`）。

### Task 4.1: 観測用テーブルのマイグレーション

**Files:**
- Create: `supabase/migrations/20260811000001_add_notification_observability.sql`
- Modify: `src/lib/database.types.ts`

- [ ] **Step 1: マイグレーションを書く**

`supabase/migrations/20260811000001_add_notification_observability.sql`:

```sql
-- ============================================================
-- 通知パイプラインの可観測性
-- ============================================================

-- 送信イベント。意味のあるときだけ記録する（正常な no-op は記録しない）
CREATE TABLE notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN
    ('sent', 'no_subscription', 'send_failed', 'subscription_expired')),
  habit_names TEXT[] NOT NULL DEFAULT '{}',
  endpoint_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_events_user_created
  ON notification_events(user_id, created_at DESC);

ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

-- 読み取りは本人のみ。書き込みポリシーは作らない（service_role のみが書く）
CREATE POLICY "Users can view own notification events"
  ON notification_events FOR SELECT
  USING (auth.uid() = user_id);

-- パイプラインの生存確認。実行ごとに upsert するので行は増えない
CREATE TABLE system_heartbeats (
  name TEXT PRIMARY KEY,
  last_run_at TIMESTAMPTZ NOT NULL,
  last_status TEXT NOT NULL
);

ALTER TABLE system_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view heartbeats"
  ON system_heartbeats FOR SELECT
  TO authenticated
  USING (true);
```

- [ ] **Step 2: ローカルで適用する**

Run: `npm run supabase:reset`
Expected: エラーなく完了

- [ ] **Step 3: `database.types.ts` に 2 テーブルを追加する**

既存テーブルの定義に倣い、`notification_events` と `system_heartbeats` の
`Row` / `Insert` / `Update` を追加する。

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/20260811000001_add_notification_observability.sql src/lib/database.types.ts
git commit -m "feat: notification_events と system_heartbeats を追加"
```

### Task 4.2: `send-reminders` にイベント記録を追加する

**Files:**
- Modify: `api/send-reminders.ts`
- Test: `api/__tests__/send-reminders.test.ts`

**Interfaces:**
- Produces: `type NotificationStatus = 'sent' | 'no_subscription' | 'send_failed' | 'subscription_expired'`

- [ ] **Step 1: 失敗するテストを書く**

`api/__tests__/send-reminders.test.ts` に追加:

```ts
import { classifySendOutcome } from '../send-reminders';

describe('classifySendOutcome', () => {
  it('購読が 0 件なら no_subscription', () => {
    expect(classifySendOutcome({ subscriptionCount: 0, successCount: 0, expiredCount: 0, failureCount: 0 }))
      .toBe('no_subscription');
  });

  it('1 件でも成功していれば sent', () => {
    expect(classifySendOutcome({ subscriptionCount: 2, successCount: 1, expiredCount: 1, failureCount: 0 }))
      .toBe('sent');
  });

  it('全て失効なら subscription_expired', () => {
    expect(classifySendOutcome({ subscriptionCount: 2, successCount: 0, expiredCount: 2, failureCount: 0 }))
      .toBe('subscription_expired');
  });

  it('失効以外の失敗があれば send_failed', () => {
    expect(classifySendOutcome({ subscriptionCount: 1, successCount: 0, expiredCount: 0, failureCount: 1 }))
      .toBe('send_failed');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run api/__tests__/send-reminders.test.ts`
Expected: FAIL — `classifySendOutcome` が export されていない

- [ ] **Step 3: 実装する**

`api/send-reminders.ts` に追加:

```ts
const HTTP_NOT_FOUND = 404;

export type NotificationStatus =
  | 'sent'
  | 'no_subscription'
  | 'send_failed'
  | 'subscription_expired';

export type SendOutcome = {
  readonly subscriptionCount: number;
  readonly successCount: number;
  readonly expiredCount: number;
  readonly failureCount: number;
};

/**
 * 1 ユーザー分の送信結果を、記録すべきステータスに分類する。
 */
export function classifySendOutcome(outcome: SendOutcome): NotificationStatus {
  if (outcome.subscriptionCount === 0) return 'no_subscription';
  if (outcome.successCount > 0) return 'sent';
  if (outcome.failureCount > 0) return 'send_failed';
  return 'subscription_expired';
}
```

`sendNotificationsPerUser` を改修する:
- 購読失効の判定を `statusCode === HTTP_GONE || statusCode === HTTP_NOT_FOUND` に広げる
- ユーザーごとに `SendOutcome` を集計する
- `classifySendOutcome` の結果を `notification_events` に insert する
- 「時刻前」「全習慣が完了済み」で早期 return する経路では**記録しない**

`handler` の末尾（レスポンス直前）に heartbeat の upsert を追加する。イベント記録が
失敗しても通知送信を止めないよう、いずれも `try/catch` で握りつぶす:

```ts
  try {
    await supabase.from('system_heartbeats').upsert({
      name: 'send-reminders',
      last_run_at: new Date().toISOString(),
      last_status: status,
    });
  } catch (error: unknown) {
    console.error('Failed to update heartbeat:', error);
  }
```

heartbeat は**早期 return する経路も含めて必ず実行する**こと。「時刻前」で返る場合も
cron は動いているので、heartbeat は更新されなければならない。

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run api/__tests__/send-reminders.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add api/send-reminders.ts api/__tests__/send-reminders.test.ts
git commit -m "feat: 通知の送信結果とパイプラインの生存を記録する"
```

### Task 4.3: テスト通知エンドポイントを作る

**Files:**
- Create: `api/send-test-notification.ts`
- Test: `api/__tests__/send-test-notification.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`api/__tests__/send-test-notification.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractBearerToken } from '../send-test-notification';

describe('extractBearerToken', () => {
  it('Bearer トークンを取り出す', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('スキームが違えば null', () => {
    expect(extractBearerToken('Basic abc')).toBeNull();
  });

  it('ヘッダーが無ければ null', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('配列で渡ってきても null', () => {
    expect(extractBearerToken(['Bearer a', 'Bearer b'])).toBeNull();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run api/__tests__/send-test-notification.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

`api/send-test-notification.ts`:

```ts
/**
 * Vercel API Route: send-test-notification
 *
 * 設定画面の「テスト通知を送る」から呼ばれる。cron 用の x-cron-secret ではなく
 * Supabase の JWT で認証し、そのユーザー自身の購読にのみ送信する。
 *
 * 結果は notification_events に記録しない。テストが通知履歴を汚さないようにするため。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const HTTP_GONE = 410;
const HTTP_NOT_FOUND = 404;

/**
 * Authorization ヘッダーから Bearer トークンを取り出す。
 */
export function extractBearerToken(
  header: string | readonly string[] | undefined,
): string | null {
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    res.status(500).json({ error: 'Missing environment configuration' });
    return;
  }

  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const userId = userData.user.id;

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (!subscriptions || subscriptions.length === 0) {
    res.status(200).json({ sent: 0, message: 'no_subscription' });
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const payload = JSON.stringify({
    title: 'Daily Rituals',
    body: 'テスト通知です。通知は正常に届いています。',
    icon: '/icon-192x192.png',
    data: { url: '/settings' },
  });

  let sent = 0;

  for (const sub of subscriptions as readonly {
    endpoint: string;
    p256dh: string;
    auth: string;
  }[]) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent = sent + 1;
    } catch (error: unknown) {
      const statusCode =
        error instanceof Error && 'statusCode' in error
          ? (error as { statusCode: number }).statusCode
          : undefined;

      if (statusCode === HTTP_GONE || statusCode === HTTP_NOT_FOUND) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      } else {
        console.error('Failed to send test notification:', sub.endpoint, error);
      }
    }
  }

  res.status(200).json({ sent });
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run api/__tests__/send-test-notification.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add api/send-test-notification.ts api/__tests__/send-test-notification.test.ts
git commit -m "feat: 自分にテスト通知を送るエンドポイントを追加"
```

### Task 4.4: 診断データの読み取り層

**Files:**
- Create: `src/data/repositories/notificationDiagnosticsRepository.ts`
- Create: `src/data/repositories/supabaseNotificationDiagnosticsRepository.ts`
- Modify: `src/data/repositories/index.ts`
- Modify: `src/hooks/useRepositories.tsx`
- Test: `src/data/repositories/__tests__/supabaseNotificationDiagnosticsRepository.test.ts`

**Interfaces:**
- Produces:
  - `type NotificationEvent = { readonly id: string; readonly status: NotificationEventStatus; readonly habitNames: readonly string[]; readonly error: string | null; readonly createdAt: string }`
  - `type NotificationEventStatus = 'sent' | 'no_subscription' | 'send_failed' | 'subscription_expired'`
  - `type Heartbeat = { readonly lastRunAt: string; readonly lastStatus: string }`
  - `interface NotificationDiagnosticsRepository { findHeartbeat(): Promise<Heartbeat | null>; findRecentEvents(limit: number): Promise<readonly NotificationEvent[]> }`

- [ ] **Step 1: 失敗するテストを書く**

`src/data/repositories/__tests__/supabaseNotificationDiagnosticsRepository.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createSupabaseNotificationDiagnosticsRepository } from '../supabaseNotificationDiagnosticsRepository';

describe('findHeartbeat', () => {
  it('send-reminders の行を返す', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        name: 'send-reminders',
        last_run_at: '2026-08-11T09:57:00Z',
        last_status: 'ok',
      },
      error: null,
    });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) };

    const repo = createSupabaseNotificationDiagnosticsRepository(client as never, 'u1');

    expect(await repo.findHeartbeat()).toEqual({
      lastRunAt: '2026-08-11T09:57:00Z',
      lastStatus: 'ok',
    });
    expect(client.from).toHaveBeenCalledWith('system_heartbeats');
    expect(eq).toHaveBeenCalledWith('name', 'send-reminders');
  });

  it('行が無ければ null を返す', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) };

    const repo = createSupabaseNotificationDiagnosticsRepository(client as never, 'u1');
    expect(await repo.findHeartbeat()).toBeNull();
  });
});

describe('findRecentEvents', () => {
  it('created_at 降順で limit 件を返し camelCase に変換する', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'e1',
          status: 'no_subscription',
          habit_names: ['日記'],
          endpoint_count: 0,
          error: null,
          created_at: '2026-08-09T07:00:00Z',
        },
      ],
      error: null,
    });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) };

    const repo = createSupabaseNotificationDiagnosticsRepository(client as never, 'u1');
    const events = await repo.findRecentEvents(5);

    expect(events).toEqual([
      {
        id: 'e1',
        status: 'no_subscription',
        habitNames: ['日記'],
        error: null,
        createdAt: '2026-08-09T07:00:00Z',
      },
    ]);
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(5);
  });

  it('データが無ければ空配列を返す', async () => {
    const limit = vi.fn().mockResolvedValue({ data: null, error: null });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) };

    const repo = createSupabaseNotificationDiagnosticsRepository(client as never, 'u1');
    expect(await repo.findRecentEvents(5)).toEqual([]);
  });

  it('エラーは投げる', async () => {
    const limit = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) };

    const repo = createSupabaseNotificationDiagnosticsRepository(client as never, 'u1');
    await expect(repo.findRecentEvents(5)).rejects.toThrow(
      'Failed to fetch notification events: boom',
    );
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/data/repositories/__tests__/supabaseNotificationDiagnosticsRepository.test.ts`
Expected: FAIL

- [ ] **Step 3: インターフェースを作る**

`src/data/repositories/notificationDiagnosticsRepository.ts`:

```ts
/**
 * NotificationDiagnosticsRepository - 通知パイプラインの診断情報の読み取り。
 *
 * 書き込みは Vercel API Route が service_role で行うため、ここは読み取り専用。
 */

export type NotificationEventStatus =
  | 'sent'
  | 'no_subscription'
  | 'send_failed'
  | 'subscription_expired';

export type NotificationEvent = {
  readonly id: string;
  readonly status: NotificationEventStatus;
  readonly habitNames: readonly string[];
  readonly error: string | null;
  readonly createdAt: string;
};

export type Heartbeat = {
  readonly lastRunAt: string;
  readonly lastStatus: string;
};

export interface NotificationDiagnosticsRepository {
  /** send-reminders の最終実行記録。未記録なら null。 */
  findHeartbeat(): Promise<Heartbeat | null>;
  /** 自分の通知イベントを新しい順に返す。 */
  findRecentEvents(limit: number): Promise<readonly NotificationEvent[]>;
}
```

- [ ] **Step 4: Supabase 実装を作る**

`src/data/repositories/supabaseNotificationDiagnosticsRepository.ts`:

```ts
/**
 * SupabaseNotificationDiagnosticsRepository - 診断情報の Supabase 実装。
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';
import type {
  Heartbeat,
  NotificationDiagnosticsRepository,
  NotificationEvent,
  NotificationEventStatus,
} from './notificationDiagnosticsRepository';

const NOT_FOUND_CODE = 'PGRST116';
const HEARTBEAT_NAME = 'send-reminders';

type EventRow = {
  readonly id: string;
  readonly status: string;
  readonly habit_names: readonly string[];
  readonly error: string | null;
  readonly created_at: string;
};

const toDomainEvent = (row: EventRow): NotificationEvent => ({
  id: row.id,
  status: row.status as NotificationEventStatus,
  habitNames: row.habit_names,
  error: row.error,
  createdAt: row.created_at,
});

export const createSupabaseNotificationDiagnosticsRepository = (
  client: SupabaseClient<Database>,
  userId: string,
): NotificationDiagnosticsRepository => ({
  async findHeartbeat(): Promise<Heartbeat | null> {
    const { data, error } = await client
      .from('system_heartbeats')
      .select()
      .eq('name', HEARTBEAT_NAME)
      .single();

    if (error) {
      if (error.code === NOT_FOUND_CODE) {
        return null;
      }
      throw new Error(`Failed to fetch heartbeat: ${error.message}`);
    }

    if (!data) return null;

    return { lastRunAt: data.last_run_at, lastStatus: data.last_status };
  },

  async findRecentEvents(limit: number): Promise<readonly NotificationEvent[]> {
    const { data, error } = await client
      .from('notification_events')
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch notification events: ${error.message}`);
    }

    return (data ?? []).map((row) => toDomainEvent(row as EventRow));
  },
});
```

- [ ] **Step 5: DI に登録する**

`src/data/repositories/index.ts` に追記する（既存行は変更せず、追記のみ）:

```ts
export type {
  Heartbeat,
  NotificationEvent,
  NotificationEventStatus,
  NotificationDiagnosticsRepository,
} from './notificationDiagnosticsRepository';
export { createSupabaseNotificationDiagnosticsRepository } from './supabaseNotificationDiagnosticsRepository';
```

`src/hooks/useRepositories.tsx` の Context 値の型と生成箇所に
`notificationDiagnosticsRepository` を追加する。

- [ ] **Step 6: テストが通ることを確認**

Run: `npm test && npm run typecheck`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/data/repositories/ src/hooks/useRepositories.tsx
git commit -m "feat: 通知診断データの読み取りリポジトリを追加"
```

### Task 4.5: 診断ロジックのフック

**Files:**
- Create: `src/hooks/notificationDiagnosticsOperations.ts`
- Create: `src/hooks/useNotificationDiagnostics.ts`
- Test: `src/hooks/__tests__/notificationDiagnosticsOperations.test.ts`

**Interfaces:**
- Consumes: Task 4.4 のリポジトリ、`pushSubscriptionOperations.ensureSubscription`
- Produces:
  - `type PipelineHealth = 'healthy' | 'stale' | 'unknown'`
  - `evaluatePipelineHealth(heartbeat: Heartbeat | null, now: Date): PipelineHealth`
  - `formatEventSummary(event: NotificationEvent): string`

- [ ] **Step 1: 失敗するテストを書く**

`src/hooks/__tests__/notificationDiagnosticsOperations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  evaluatePipelineHealth,
  formatEventSummary,
} from '../notificationDiagnosticsOperations';

describe('evaluatePipelineHealth', () => {
  const now = new Date('2026-08-11T10:00:00Z');

  it('直近の実行があれば healthy', () => {
    expect(
      evaluatePipelineHealth({ lastRunAt: '2026-08-11T09:57:00Z', lastStatus: 'ok' }, now),
    ).toBe('healthy');
  });

  it('30 分以上前なら stale', () => {
    expect(
      evaluatePipelineHealth({ lastRunAt: '2026-08-11T09:20:00Z', lastStatus: 'ok' }, now),
    ).toBe('stale');
  });

  it('ちょうど 30 分前は healthy', () => {
    expect(
      evaluatePipelineHealth({ lastRunAt: '2026-08-11T09:30:00Z', lastStatus: 'ok' }, now),
    ).toBe('healthy');
  });

  it('記録が無ければ unknown', () => {
    expect(evaluatePipelineHealth(null, now)).toBe('unknown');
  });
});

describe('formatEventSummary', () => {
  it('sent は習慣名を含む', () => {
    expect(
      formatEventSummary({
        id: 'e1',
        status: 'sent',
        habitNames: ['日記', '朝起きる'],
        error: null,
        createdAt: '2026-08-11T07:00:00Z',
      }),
    ).toBe('「日記」「朝起きる」を通知しました');
  });

  it('no_subscription は原因を説明する', () => {
    expect(
      formatEventSummary({
        id: 'e2',
        status: 'no_subscription',
        habitNames: ['日記'],
        error: null,
        createdAt: '2026-08-11T07:00:00Z',
      }),
    ).toBe('送信先が未登録のため通知できませんでした');
  });

  it('subscription_expired は再登録を促す', () => {
    expect(
      formatEventSummary({
        id: 'e3',
        status: 'subscription_expired',
        habitNames: [],
        error: null,
        createdAt: '2026-08-11T07:00:00Z',
      }),
    ).toBe('送信先が失効しました。再登録してください');
  });

  it('send_failed は失敗を伝える', () => {
    expect(
      formatEventSummary({
        id: 'e4',
        status: 'send_failed',
        habitNames: [],
        error: 'boom',
        createdAt: '2026-08-11T07:00:00Z',
      }),
    ).toBe('通知の送信に失敗しました');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/hooks/__tests__/notificationDiagnosticsOperations.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

`src/hooks/notificationDiagnosticsOperations.ts`:

```ts
/**
 * 通知診断の純粋なビジネスロジック。
 */

import type {
  Heartbeat,
  NotificationEvent,
} from '../data/repositories/notificationDiagnosticsRepository';

/** cron 間隔 10 分の 3 倍を超えたら停止とみなす */
const STALE_THRESHOLD_MS = 30 * 60 * 1000;

export type PipelineHealth = 'healthy' | 'stale' | 'unknown';

/**
 * heartbeat の鮮度からパイプラインの健全性を判定する。
 */
export function evaluatePipelineHealth(
  heartbeat: Heartbeat | null,
  now: Date,
): PipelineHealth {
  if (!heartbeat) return 'unknown';

  const elapsed = now.getTime() - new Date(heartbeat.lastRunAt).getTime();
  return elapsed > STALE_THRESHOLD_MS ? 'stale' : 'healthy';
}

/**
 * 通知イベントを日本語の 1 行サマリーに整形する。
 */
export function formatEventSummary(event: NotificationEvent): string {
  switch (event.status) {
    case 'sent': {
      const names = event.habitNames.map((n) => `「${n}」`).join('');
      return `${names}を通知しました`;
    }
    case 'no_subscription':
      return '送信先が未登録のため通知できませんでした';
    case 'subscription_expired':
      return '送信先が失効しました。再登録してください';
    case 'send_failed':
      return '通知の送信に失敗しました';
  }
}
```

- [ ] **Step 4: `AuthContext` にアクセストークン取得を追加する**

`src/hooks/useAuthContext.tsx` の Context 値に `getAccessToken` を追加する。
テスト通知エンドポイントは Supabase JWT で認証するため、トークンの取得口が必要になる。

```ts
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  }, [client]);
```

- [ ] **Step 5: `useNotificationDiagnostics` を実装する**

`src/hooks/useNotificationDiagnostics.ts`:

```ts
/**
 * useNotificationDiagnostics - 設定画面の通知診断セクション用のデータと操作。
 *
 * 「通知が届かない」の原因が パイプライン / デバイス購読 / OS の許可 の
 * どれなのかを、画面を開くだけで切り分けられるようにする。
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  NotificationDiagnosticsRepository,
  NotificationEvent,
} from '../data/repositories/notificationDiagnosticsRepository';
import type { PushSubscriptionRepository } from '../data/repositories/pushSubscriptionRepository';
import { ensureSubscription } from './pushSubscriptionOperations';
import {
  evaluatePipelineHealth,
  type PipelineHealth,
} from './notificationDiagnosticsOperations';
import { extractErrorMessage } from './utils';

const RECENT_EVENT_LIMIT = 5;

export type TestNotificationResult = 'sent' | 'no_subscription' | 'failed';

export type NotificationDiagnostics = {
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly pipelineHealth: PipelineHealth;
  readonly lastRunAt: string | null;
  readonly isDeviceRegistered: boolean;
  readonly permissionState: NotificationPermission;
  readonly recentEvents: readonly NotificationEvent[];
  readonly reregister: () => Promise<void>;
  readonly sendTestNotification: () => Promise<TestNotificationResult>;
  readonly refresh: () => Promise<void>;
};

type DiagnosticsState = {
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly pipelineHealth: PipelineHealth;
  readonly lastRunAt: string | null;
  readonly isDeviceRegistered: boolean;
  readonly recentEvents: readonly NotificationEvent[];
};

const INITIAL_STATE: DiagnosticsState = {
  isLoading: true,
  error: null,
  pipelineHealth: 'unknown',
  lastRunAt: null,
  isDeviceRegistered: false,
  recentEvents: [],
};

function hasServiceWorker(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * このデバイスの購読が DB に登録されているかを調べる。
 */
async function checkDeviceRegistration(
  repository: PushSubscriptionRepository,
): Promise<boolean> {
  if (!hasServiceWorker()) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  return (await repository.findByEndpoint(subscription.endpoint)) !== null;
}

export function useNotificationDiagnostics(
  diagnosticsRepository: NotificationDiagnosticsRepository,
  pushSubscriptionRepository: PushSubscriptionRepository,
  getAccessToken: () => Promise<string | null>,
): NotificationDiagnostics {
  const [state, setState] = useState<DiagnosticsState>(INITIAL_STATE);
  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );

  const load = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const [heartbeat, events, isDeviceRegistered] = await Promise.all([
        diagnosticsRepository.findHeartbeat(),
        diagnosticsRepository.findRecentEvents(RECENT_EVENT_LIMIT),
        checkDeviceRegistration(pushSubscriptionRepository),
      ]);

      setState({
        isLoading: false,
        error: null,
        pipelineHealth: evaluatePipelineHealth(heartbeat, new Date()),
        lastRunAt: heartbeat?.lastRunAt ?? null,
        isDeviceRegistered,
        recentEvents: events,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: extractErrorMessage(err),
      }));
    }

    if (typeof Notification !== 'undefined') {
      setPermissionState(Notification.permission);
    }
  }, [diagnosticsRepository, pushSubscriptionRepository]);

  useEffect(() => {
    void load();
  }, [load]);

  const reregister = useCallback(async (): Promise<void> => {
    if (!hasServiceWorker()) return;

    const registration = await navigator.serviceWorker.ready;
    await ensureSubscription(registration, pushSubscriptionRepository);
    await load();
  }, [pushSubscriptionRepository, load]);

  const sendTestNotification =
    useCallback(async (): Promise<TestNotificationResult> => {
      try {
        const token = await getAccessToken();
        if (!token) return 'failed';

        const response = await fetch('/api/send-test-notification', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) return 'failed';

        const body = (await response.json()) as { sent: number };
        return body.sent > 0 ? 'sent' : 'no_subscription';
      } catch {
        return 'failed';
      }
    }, [getAccessToken]);

  return {
    isLoading: state.isLoading,
    error: state.error,
    pipelineHealth: state.pipelineHealth,
    lastRunAt: state.lastRunAt,
    isDeviceRegistered: state.isDeviceRegistered,
    permissionState,
    recentEvents: state.recentEvents,
    reregister,
    sendTestNotification,
    refresh: load,
  };
}
```

- [ ] **Step 6: テストが通ることを確認**

Run: `npm test && npm run typecheck`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/hooks/notificationDiagnosticsOperations.ts src/hooks/useNotificationDiagnostics.ts src/hooks/useAuthContext.tsx src/hooks/__tests__/notificationDiagnosticsOperations.test.ts
git commit -m "feat: 通知診断のビジネスロジックとフックを追加"
```

### Task 4.6: 設定画面に診断 UI を追加する

**Files:**
- Create: `src/ui/components/NotificationDiagnostics.tsx`
- Create: `src/ui/components/__tests__/NotificationDiagnostics.test.tsx`
- Modify: `src/ui/pages/SettingsPage.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/components/__tests__/NotificationDiagnostics.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationDiagnostics } from '../NotificationDiagnostics';
import type { NotificationDiagnostics as Diagnostics } from '@/hooks/useNotificationDiagnostics';

const mockUseNotificationDiagnostics = vi.fn();

vi.mock('@/hooks/useNotificationDiagnostics', () => ({
  useNotificationDiagnostics: () => mockUseNotificationDiagnostics(),
}));

vi.mock('@/hooks/useRepositories', () => ({
  useRepositories: () => ({
    notificationDiagnosticsRepository: {},
    pushSubscriptionRepository: {},
  }),
}));

vi.mock('@/hooks/useAuthContext', () => ({
  useAuthContext: () => ({ getAccessToken: vi.fn() }),
}));

function makeDiagnostics(overrides: Partial<Diagnostics> = {}): Diagnostics {
  return {
    isLoading: false,
    error: null,
    pipelineHealth: 'healthy',
    lastRunAt: '2026-08-11T09:57:00Z',
    isDeviceRegistered: true,
    permissionState: 'granted',
    recentEvents: [],
    reregister: vi.fn().mockResolvedValue(undefined),
    sendTestNotification: vi.fn().mockResolvedValue('sent'),
    refresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('NotificationDiagnostics', () => {
  beforeEach(() => {
    mockUseNotificationDiagnostics.mockReset();
  });

  it('パイプラインが正常なら正常と表示する', () => {
    mockUseNotificationDiagnostics.mockReturnValue(makeDiagnostics());
    render(<NotificationDiagnostics />);

    expect(screen.getByTestId('pipeline-health')).toHaveTextContent('正常');
  });

  it('パイプラインが停止していれば警告を出す', () => {
    mockUseNotificationDiagnostics.mockReturnValue(
      makeDiagnostics({ pipelineHealth: 'stale' }),
    );
    render(<NotificationDiagnostics />);

    expect(screen.getByTestId('pipeline-health')).toHaveTextContent(
      '停止している可能性があります',
    );
  });

  it('デバイス未登録なら未登録と再登録ボタンを出す', () => {
    mockUseNotificationDiagnostics.mockReturnValue(
      makeDiagnostics({ isDeviceRegistered: false }),
    );
    render(<NotificationDiagnostics />);

    expect(screen.getByTestId('device-registration')).toHaveTextContent('未登録');
    expect(screen.getByRole('button', { name: '再登録' })).toBeInTheDocument();
  });

  it('再登録ボタンで reregister が呼ばれる', () => {
    const diagnostics = makeDiagnostics({ isDeviceRegistered: false });
    mockUseNotificationDiagnostics.mockReturnValue(diagnostics);
    render(<NotificationDiagnostics />);

    fireEvent.click(screen.getByRole('button', { name: '再登録' }));

    expect(diagnostics.reregister).toHaveBeenCalledOnce();
  });

  it('テスト通知ボタンで sendTestNotification が呼ばれ、結果を表示する', async () => {
    const diagnostics = makeDiagnostics();
    mockUseNotificationDiagnostics.mockReturnValue(diagnostics);
    render(<NotificationDiagnostics />);

    fireEvent.click(screen.getByRole('button', { name: 'テスト通知を送る' }));

    expect(diagnostics.sendTestNotification).toHaveBeenCalledOnce();
    expect(await screen.findByText('テスト通知を送信しました')).toBeInTheDocument();
  });

  it('購読が無い状態でテスト通知を押すと理由を表示する', async () => {
    const diagnostics = makeDiagnostics({
      sendTestNotification: vi.fn().mockResolvedValue('no_subscription'),
    });
    mockUseNotificationDiagnostics.mockReturnValue(diagnostics);
    render(<NotificationDiagnostics />);

    fireEvent.click(screen.getByRole('button', { name: 'テスト通知を送る' }));

    expect(
      await screen.findByText('送信先が未登録です。再登録してください'),
    ).toBeInTheDocument();
  });

  it('直近のイベントをサマリー文言で表示する', () => {
    mockUseNotificationDiagnostics.mockReturnValue(
      makeDiagnostics({
        recentEvents: [
          {
            id: 'e1',
            status: 'no_subscription',
            habitNames: ['日記'],
            error: null,
            createdAt: '2026-08-09T07:00:00Z',
          },
        ],
      }),
    );
    render(<NotificationDiagnostics />);

    expect(screen.getByTestId('recent-events')).toHaveTextContent(
      '送信先が未登録のため通知できませんでした',
    );
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/ui/components/__tests__/NotificationDiagnostics.test.tsx`
Expected: FAIL

- [ ] **Step 3: コンポーネントを実装する**

`src/ui/components/NotificationDiagnostics.tsx`:

```tsx
/**
 * NotificationDiagnostics - 設定画面の通知セクション。
 *
 * 「通知が届かない」の原因が パイプライン / デバイス購読 / OS の許可 の
 * どれなのかを、画面を開くだけで切り分けられるようにする。
 */

import React, { useCallback, useState } from 'react';
import { useRepositories } from '@/hooks/useRepositories';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useNotificationDiagnostics } from '@/hooks/useNotificationDiagnostics';
import { formatEventSummary } from '@/hooks/notificationDiagnosticsOperations';
import { Button } from '@/components/ui/button';

const PIPELINE_LABELS = {
  healthy: '正常',
  stale: '停止している可能性があります',
  unknown: '記録がありません',
} as const;

const PERMISSION_LABELS: Record<NotificationPermission, string> = {
  granted: '許可済み',
  denied: 'ブロック中',
  default: '未設定',
};

const TEST_RESULT_MESSAGES = {
  sent: 'テスト通知を送信しました',
  no_subscription: '送信先が未登録です。再登録してください',
  failed: 'テスト通知の送信に失敗しました',
} as const;

function Row({
  label,
  value,
  testId,
  action,
}: {
  readonly label: string;
  readonly value: string;
  readonly testId: string;
  readonly action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground" data-testid={testId}>
          {value}
        </span>
        {action}
      </div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

export function NotificationDiagnostics() {
  const { notificationDiagnosticsRepository, pushSubscriptionRepository } =
    useRepositories();
  const { getAccessToken } = useAuthContext();
  const diagnostics = useNotificationDiagnostics(
    notificationDiagnosticsRepository,
    pushSubscriptionRepository,
    getAccessToken,
  );

  const [testResult, setTestResult] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const handleReregister = useCallback(async () => {
    setIsBusy(true);
    setTestResult(null);
    try {
      await diagnostics.reregister();
    } finally {
      setIsBusy(false);
    }
  }, [diagnostics]);

  const handleTest = useCallback(async () => {
    setIsBusy(true);
    setTestResult(null);
    try {
      const result = await diagnostics.sendTestNotification();
      setTestResult(TEST_RESULT_MESSAGES[result]);
    } finally {
      setIsBusy(false);
    }
  }, [diagnostics]);

  const pipelineValue =
    diagnostics.pipelineHealth === 'healthy' && diagnostics.lastRunAt
      ? `${PIPELINE_LABELS.healthy}（最終実行 ${formatDateTime(diagnostics.lastRunAt)}）`
      : PIPELINE_LABELS[diagnostics.pipelineHealth];

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">通知</h2>

      <div className="divide-y divide-border rounded-lg border border-border">
        <Row label="パイプライン" value={pipelineValue} testId="pipeline-health" />

        <Row
          label="このデバイス"
          value={diagnostics.isDeviceRegistered ? '登録済み' : '未登録'}
          testId="device-registration"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleReregister()}
              disabled={isBusy}
            >
              再登録
            </Button>
          }
        />

        <Row
          label="通知の許可"
          value={PERMISSION_LABELS[diagnostics.permissionState]}
          testId="permission-state"
        />

        <div className="px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleTest()}
            disabled={isBusy}
          >
            テスト通知を送る
          </Button>
          {testResult && (
            <p className="mt-2 text-sm text-muted-foreground" role="status">
              {testResult}
            </p>
          )}
        </div>
      </div>

      <ul className="mt-3 space-y-1" data-testid="recent-events">
        {diagnostics.recentEvents.map((event) => (
          <li key={event.id} className="text-xs text-muted-foreground">
            {formatDateTime(event.createdAt)} {formatEventSummary(event)}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: `SettingsPage` に組み込む**

見出し「設定」の下、ログアウトの上に `<NotificationDiagnostics />` を配置する。

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 6: E2E テストを追加する**

`e2e/specs/navigation.spec.ts` か新規 `e2e/specs/notification-diagnostics.spec.ts` に、
設定画面を開いて購読が無い状態で「未登録」が表示されることを検証するテストを追加する。

Run: `npm run test:e2e`
Expected: 全件 PASS

- [ ] **Step 7: コミット**

```bash
git add src/ui/components/NotificationDiagnostics.tsx src/ui/components/__tests__/NotificationDiagnostics.test.tsx src/ui/pages/SettingsPage.tsx e2e/specs/
git commit -m "feat: 設定画面に通知の診断セクションを追加"
```

### Task 4.7: 運用ドキュメントの更新と PR 作成

- [ ] **Step 1: 調査記録に恒久対策の結果を追記する**

`docs/investigations/2026-07-02-push-notification-not-delivered.md` の
「6. 恒久対策」に、実装済みである旨と設定画面での復旧手順を追記する。
5 章の手動復旧手順は「設定 → 通知 → 再登録」に置き換わったことを明記する。

- [ ] **Step 2: cron 再登録の注意を明記する**

`supabase/snippets/setup-cron.sql` の冒頭コメントに、デプロイ URL 変更時は
再登録が必要であること、および設定画面の heartbeat 表示で再登録漏れを検知できることを
追記する。

- [ ] **Step 3: 全テストを実行して PR を作成する**

Run: `npm test && npm run test:e2e && npm run typecheck && npm run lint`
Expected: 全件 PASS

---

# Phase 5: 完了トグルの楽観更新と失敗通知

**issue タイトル案:** `fix: 完了トグルの失敗をトーストで通知し、楽観更新でロールバックする`

**背景:** `useCompletions.toggleCompletion` の失敗は `state.error` に入り `TodayPage:352` の `ErrorState` に表示されるが、リストをスクロールしていると画面上部の表示は見えない。また楽観更新がないため、通信が遅いとタップしても無反応に見え、二重タップを誘発する。

### Task 5.1: `ToastProvider` を作る

**Files:**
- Create: `src/ui/components/ToastProvider.tsx`
- Create: `src/ui/components/__tests__/ToastProvider.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces:
  - `<ToastProvider>{children}</ToastProvider>`
  - `useToast(): { showError: (message: string, action?: { label: string; onClick: () => void }) => void }`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/components/__tests__/ToastProvider.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '../ToastProvider';

function Trigger({ onRetry }: { readonly onRetry?: () => void }) {
  const { showError } = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        showError(
          '記録に失敗しました',
          onRetry ? { label: '再試行', onClick: onRetry } : undefined,
        )
      }
    >
      発火
    </button>
  );
}

describe('ToastProvider', () => {
  it('showError でメッセージが表示される', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '発火' }));

    expect(await screen.findByText('記録に失敗しました')).toBeInTheDocument();
  });

  it('アクションを渡すとボタンが出て、クリックでハンドラが呼ばれる', async () => {
    const onRetry = vi.fn();
    render(
      <ToastProvider>
        <Trigger onRetry={onRetry} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '発火' }));
    fireEvent.click(await screen.findByRole('button', { name: '再試行' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('アクションを渡さなければアクションボタンは出ない', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '発火' }));
    await screen.findByText('記録に失敗しました');

    expect(screen.queryByRole('button', { name: '再試行' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/ui/components/__tests__/ToastProvider.test.tsx`
Expected: FAIL

- [ ] **Step 3: 実装する**

`src/ui/components/ToastProvider.tsx`:

```tsx
/**
 * ToastProvider - アプリ全体のトースト表示。
 *
 * base-ui の Toast を包み、呼び出し側には showError だけを見せる。
 * base-ui の詳細（actionProps / Viewport の構造）が UI コードへ漏れないようにする。
 */

import React, { useCallback } from 'react';
import { Toast } from '@base-ui/react/toast';

const ERROR_TIMEOUT_MS = 8000;

export type ToastAction = {
  readonly label: string;
  readonly onClick: () => void;
};

export type ToastApi = {
  readonly showError: (message: string, action?: ToastAction) => void;
};

/**
 * トーストを出すための API。ToastProvider の内側でのみ呼べる。
 */
export function useToast(): ToastApi {
  const manager = Toast.useToastManager();

  const showError = useCallback(
    (message: string, action?: ToastAction) => {
      manager.add({
        title: message,
        type: 'error',
        priority: 'high',
        timeout: ERROR_TIMEOUT_MS,
        actionProps: action
          ? { children: action.label, onClick: action.onClick }
          : undefined,
      });
    },
    [manager],
  );

  return { showError };
}

/**
 * 表示中のトーストを描画する。Toast.Provider の内側でのみ動作する。
 */
function ToastList() {
  const { toasts } = Toast.useToastManager();

  return (
    <>
      {toasts.map((toast) => (
        <Toast.Root
          key={toast.id}
          toast={toast}
          className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg"
        >
          <Toast.Title className="flex-1 text-sm text-destructive" />
          {toast.actionProps && (
            <Toast.Action className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted" />
          )}
          <Toast.Close
            aria-label="閉じる"
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            ✕
          </Toast.Close>
        </Toast.Root>
      ))}
    </>
  );
}

export function ToastProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <Toast.Provider>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed inset-x-4 bottom-20 z-50 mx-auto flex w-auto max-w-md flex-col gap-2">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
```

`Toast.Action` は `toast.actionProps.children` を自分の中身として使い、
`onClick` もマージする（`node_modules/@base-ui/react/toast/action/ToastAction.js:30,45`）。
そのため `actionProps` を渡さないトーストではアクションボタンを描画しない。

表示位置は画面下部（`TaskInlineInput` の上）に重ならないよう `bottom-20` とする。

- [ ] **Step 4: `App.tsx` に組み込む**

`AuthProvider` の内側、`Routes` の外側に `ToastProvider` を配置する。

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/ui/components/ToastProvider.tsx src/ui/components/__tests__/ToastProvider.test.tsx src/App.tsx
git commit -m "feat: base-ui の Toast をラップした ToastProvider を追加"
```

### Task 5.2: 完了トグルを楽観更新にする

**Files:**
- Modify: `src/hooks/completionOperations.ts`
- Modify: `src/hooks/useCompletions.ts:96-115`
- Modify: `src/hooks/__tests__/useCompletions.test.ts`

**Interfaces:**
- Consumes: 既存の `performToggleWithRetry` / `SessionExpiredError`
- Produces: `applyToggleOptimistically(completions: readonly Completion[], habitId: string, date: string): readonly Completion[]`

- [ ] **Step 1: 失敗するテストを書く**

`src/hooks/__tests__/completionOperations.test.ts`（無ければ新規作成）:

```ts
import { describe, it, expect } from 'vitest';
import { applyToggleOptimistically } from '../completionOperations';
import type { Completion } from '@/domain/models';

const existing: Completion = {
  id: 'c1',
  userId: 'u1',
  habitId: 'h1',
  completedDate: '2026-08-11',
  createdAt: '2026-08-11T00:00:00.000Z',
};

describe('applyToggleOptimistically', () => {
  it('未完了なら仮の完了レコードを足す', () => {
    const result = applyToggleOptimistically([], 'h1', '2026-08-11');
    expect(result).toHaveLength(1);
    expect(result[0].habitId).toBe('h1');
    expect(result[0].completedDate).toBe('2026-08-11');
  });

  it('完了済みなら取り除く', () => {
    expect(applyToggleOptimistically([existing], 'h1', '2026-08-11')).toEqual([]);
  });

  it('元の配列を変更しない', () => {
    const input = [existing];
    applyToggleOptimistically(input, 'h1', '2026-08-11');
    expect(input).toEqual([existing]);
  });

  it('別の習慣・別の日付には影響しない', () => {
    const result = applyToggleOptimistically([existing], 'h2', '2026-08-11');
    expect(result).toHaveLength(2);
  });
});
```

`src/hooks/__tests__/useCompletions.test.ts` に、トグル失敗時に完了状態が
元に戻ることを検証するテストを追加する:

```ts
  it('トグルが失敗したら楽観更新をロールバックする', async () => {
    const repository = makeRepository();
    repository.create = vi.fn().mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useCompletions(repository, '2026-08-11'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleCompletion('h1', '2026-08-11');
    });

    expect(result.current.isCompleted('h1', '2026-08-11')).toBe(false);
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/hooks/__tests__/completionOperations.test.ts src/hooks/__tests__/useCompletions.test.ts`
Expected: FAIL

- [ ] **Step 3: `applyToggleOptimistically` を実装する**

`src/hooks/completionOperations.ts` に追加する:

```ts
/** 楽観更新で作る仮レコードの ID プレフィックス。サーバー確定時に置き換わる。 */
const OPTIMISTIC_ID_PREFIX = 'optimistic-';

/**
 * サーバー応答を待たずに完了状態を切り替えた配列を返す。
 *
 * 入力は変更せず、常に新しい配列を返す。
 */
export function applyToggleOptimistically(
  completions: readonly Completion[],
  habitId: string,
  date: string,
): readonly Completion[] {
  const existing = completions.find(
    (c) => c.habitId === habitId && c.completedDate === date,
  );

  if (existing) {
    return completions.filter(
      (c) => !(c.habitId === habitId && c.completedDate === date),
    );
  }

  return [
    ...completions,
    {
      id: `${OPTIMISTIC_ID_PREFIX}${habitId}-${date}`,
      userId: '',
      habitId,
      completedDate: date,
      createdAt: new Date().toISOString(),
    },
  ];
}
```

`Completion` 型のフィールドが上記と異なる場合は `src/domain/models/completion.ts` に
合わせること。

- [ ] **Step 4: `useCompletions` を楽観更新にする**

`src/hooks/useCompletions.ts` の `toggleCompletion`（96-115 行）を差し替える。
`onError` は Task 5.3 で `TodayPage` から渡す:

```ts
  const toggleCompletion = useCallback(
    async (habitId: string, toggleDate: string): Promise<void> => {
      const previous = completionsRef.current;
      const optimistic = applyToggleOptimistically(previous, habitId, toggleDate);

      setState((prev) => ({ ...prev, completions: optimistic, error: null }));

      try {
        const confirmed = await performToggleWithRetry(
          repository,
          previous,
          habitId,
          toggleDate,
          sessionRefresher,
        );
        setState((prev) => ({ ...prev, completions: confirmed, error: null }));
      } catch (err) {
        setState((prev) => ({ ...prev, completions: previous }));

        if (err instanceof SessionExpiredError) {
          navigate('/login', { replace: true });
          return;
        }

        onError?.(extractErrorMessage(err));
      }
    },
    [repository, sessionRefresher, navigate, onError],
  );
```

`useCompletions` のシグネチャに `onError?: (message: string) => void` を追加する。
失敗を `state.error` に入れるのはやめる（`state.error` は初期ロード専用にする）。

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test && npm run typecheck`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/hooks/completionOperations.ts src/hooks/useCompletions.ts src/hooks/__tests__/
git commit -m "fix: 完了トグルを楽観更新にし失敗時にロールバックする"
```

### Task 5.3: `TodayPage` をトーストにつなぐ

**Files:**
- Modify: `src/ui/pages/TodayPage.tsx:261-275, 352`
- Modify: `src/ui/pages/__tests__/TodayPage.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/pages/__tests__/TodayPage.test.tsx` に追加する。`renderTodayPage` ヘルパーが
`ToastProvider` で包むよう修正したうえで、次を書く。

```tsx
  it('完了トグルが失敗するとトーストで通知する', async () => {
    let capturedOnError: ((message: string) => void) | undefined;

    mockUseCompletions.mockImplementation(
      (
        _repository: unknown,
        _date: string,
        _refreshSession: unknown,
        onError?: (message: string) => void,
      ) => {
        capturedOnError = onError;
        return defaultCompletionsResult;
      },
    );

    renderTodayPage();
    await screen.findByText(habitName);

    expect(capturedOnError).toBeDefined();

    act(() => {
      capturedOnError?.('network down');
    });

    expect(
      await screen.findByText('記録に失敗しました: network down'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument();
  });
```

`defaultCompletionsResult` と `habitName` は既存テストのセットアップに合わせること。
`act` は `@testing-library/react` から import する。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/ui/pages/__tests__/TodayPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: `TodayPage` を修正する**

`useToast` を使い、`useCompletions` に `onError` を渡す:

```ts
  const { showError } = useToast();

  const handleCompletionError = useCallback(
    (message: string) => {
      showError(`記録に失敗しました: ${message}`, {
        label: '再試行',
        onClick: () => void refreshCompletions(),
      });
    },
    [showError, refreshCompletions],
  );
```

`useCompletions(completionRepository, selectedDate, refreshSession, handleCompletionError)`
のように渡す。`refreshCompletions` を `handleCompletionError` より前に取得する必要が
あるため、宣言順に注意すること。

`ErrorState` の表示条件（352 行）はそのままでよい。`state.error` が初期ロード失敗
専用になったため、意味が明確になる。

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 5: E2E を実行する**

Run: `npm run test:e2e`
Expected: 全件 PASS

- [ ] **Step 6: コミット**

```bash
git add src/ui/pages/TodayPage.tsx src/ui/pages/__tests__/TodayPage.test.tsx
git commit -m "feat: 完了トグルの失敗をトーストで通知する"
```

### Task 5.4: PR 作成

- [ ] **Step 1: 全テストを実行**

Run: `npm test && npm run test:e2e && npm run typecheck && npm run lint`
Expected: 全件 PASS

- [ ] **Step 2: PR を作成し、DA レビューを依頼する**

---

## 完了の定義（全 Phase 終了時）

- JST 06:00〜08:59 のリマインダーが正しい日付で判定され、正しい時刻に届く
- タイムゾーンが変わっても、次回起動時にリマインダー時刻が追従する
- 購読喪失・cron 停止・送信失敗が、設定画面を開くだけで判別できる
- 過去日に戻しても、その時点で存在しなかった習慣が表示されない
- 完了トグルの失敗がスクロール位置によらずユーザーに伝わり、UI とサーバーの状態が一致する
- `npm run typecheck` が `api/` を含めて通る
