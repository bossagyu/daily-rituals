# 信頼性の立て直し — 設計ドキュメント

- **作成日**: 2026-08-11
- **対象**: daily-rituals 全体（クライアント / Vercel API Route / Supabase スキーマ）
- **前提となる調査**: `docs/investigations/2026-07-02-push-notification-not-delivered.md`

## 概要

このスペックは「時刻・日付の扱い」と「通知パイプラインの可観測性」を立て直す。
症状として現れているのは早朝リマインダーのズレと通知不達だが、真因は次の2つである。

1. 時刻に関する知識が 5 箇所に重複し、それぞれ違う前提（ローカル日付 / UTC 日付 / 分オフセット）で実装されている
2. 通知パイプラインが壊れても、どこにも痕跡が残らない

いずれも個別のバグ修正では再発する構造的な問題なので、表現の統一と観測点の追加で根治する。

## 解決する問題

| # | 問題 | 現状の症状 |
|---|------|-----------|
| P1 | クライアント＝ローカル日付 / サーバー＝UTC 日付 の不一致 | JST 06:00〜08:59 のリマインダーで完了判定と `last_notified_date` がズレる。TZ 変更・DST に追従しない |
| P2 | 通知パイプラインの障害が検知できない | 購読喪失に 2 ヶ月半気づかなかった。cron・HTTP・関数がすべて正常に見えたまま誰にも届かない状態が成立する |
| P3 | `TodayPage` が習慣の作成日を考慮しない（issue #109） | 過去日に戻ると、その時点で存在しなかった習慣が未達成として並ぶ |
| P4 | 完了トグルの失敗がユーザーに届かない | スクロール中は画面上部のエラー表示が見えない。楽観更新がなく無反応に見える |

## 非スコープ

- オフライン対応（IndexedDB キャッシュ・同期）
- `useStatsData` の全期間フェッチのサーバー集計化
- アーカイブ済み習慣の過去日での見え方
- 4 ロール体制ドキュメントの二重管理解消（別スペックで扱う）

---

## アーキテクチャ

### 現状: 時刻の知識が 5 箇所に分散

| 場所 | 「今日」の定義 | 時刻の表現 |
|---|---|---|
| `src/lib/dateUtils.ts` | 端末ローカル日付 | — |
| `src/hooks/useStatsData.ts` | 端末ローカル日付（`getTodayString` を再実装） | — |
| `src/lib/reminderTime.ts` | — | ローカル ⇄ UTC を分オフセットで変換 |
| `api/send-reminders.ts` | UTC 日付 | UTC スロット |
| `habits.created_at` / `archived_at` | UTC 日付（Postgres のカラムデフォルト。クライアントは値を設定しない） | — |

分オフセット（`Date.getTimezoneOffset()`）は DST を表現できないため、この方式では正しくなりようがない。

`habits.created_at` / `archived_at` は他の 4 箇所と性質が異なり、日付の「取得元」ではなく
DB カラムそのものが UTC 日付を持つ。`habitScheduleService.isActiveOnDate`（Phase 1 で新設）は
この UTC 日付を、呼び出し元がローカル日付として渡す `date`（`src/lib/dateUtils.ts` の
`getTodayString`）とそのまま比較しており、負の UTC オフセット地域では作成当日の習慣が
Today に表示されない不整合を生む。Phase 1 の P3 対応表（下記）はこの述語をレビューしたが、
このハザードは一覧に含めていない。JST（本アプリの実ユーザー）ではズレが無害な方向にしか
効かないため実害はないが、`profiles.timezone` 導入後（Phase 3）にはユーザー TZ 基準へ
揃える必要がある。

### 変更後: `timeService` を単一の源泉とする

```
                    src/domain/services/timeService.ts
                       （純粋関数・依存は Intl のみ）
                                  |
              +-------------------+-------------------+
              |                                       |
     クライアント（src/）                    サーバー（api/）
     dateUtils / useStatsData /              send-reminders /
     calendarService / statsService          send-test-notification
```

`api/` からは相対パス（`../src/domain/services/timeService`）で import する。Vercel の Node ランタイムは
`api/` 配下をバンドルするため解決できる想定だが、これは Phase 2 の最初に検証する。`api/` から `src/` への
import が実際にデプロイで動くことを、プレビューデプロイで確認してから Phase 3 に進むこと
（外部ランタイムの互換性を事前検証するルールは、web-push の Deno 非互換で得た教訓に基づく）。
仮に動かない場合は `timeService` を `api/` 側にもコピーせず、共有パッケージ相当のディレクトリ
（例: `shared/`）へ切り出して両方から参照する形に切り替える。

---

## コンポーネント設計

### 1. `src/domain/services/timeService.ts`（新規）

外部依存を持たない純粋関数。実装は `Intl.DateTimeFormat('en-CA', { timeZone })` ベースとし、
分オフセット計算を用いない。これにより DST が自動的に正しく扱われる。

```ts
export function getLocalDate(instant: Date, timeZone: string): string       // 'YYYY-MM-DD'
export function getLocalTime(instant: Date, timeZone: string): string       // 'HH:MM'
export function getLocalDayOfWeek(instant: Date, timeZone: string): number  // 0=日曜
export function getWeekStart(instant: Date, timeZone: string): string       // 'YYYY-MM-DD'
export function floorToSlot(time: string, slotMinutes: number): string      // 'HH:MM'
export function getBrowserTimeZone(): string                                // IANA 名
```

`getWeekStart` は日曜始まりとする（`statsService.getWeekRange` およびカレンダーグリッドと揃える）。
現在 `api/send-reminders.ts:54-60` の `getWeekStartUtc` は月曜始まりで、クライアントの日曜始まりと
食い違っている。この統一により `weekly_count` 習慣の週次判定のズレも解消される。

### 2. データベース

**マイグレーション `supabase/migrations/20260811000000_add_user_timezone.sql`**

```sql
ALTER TABLE profiles ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo';

-- 既存 reminder_time を UTC からユーザーのローカル時刻へ戻す
UPDATE habits h SET reminder_time =
  ((DATE '2000-01-01' + h.reminder_time) AT TIME ZONE 'UTC'
     AT TIME ZONE p.timezone)::time
FROM profiles p
WHERE p.id = h.user_id AND h.reminder_time IS NOT NULL;
```

`profiles` の RLS は既存の own-row ポリシーのままでよい。`send-reminders` は service_role
で動くため RLS をバイパスして読める。

**マイグレーション `supabase/migrations/20260811000001_add_notification_observability.sql`**

```sql
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

CREATE POLICY "Users can view own notification events"
  ON notification_events FOR SELECT
  USING (auth.uid() = user_id);
-- INSERT ポリシーは作らない（service_role のみが書き込む）

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

`notification_events` に書くのは意味のあるときだけとする。「時刻前」「全習慣が完了済み」といった
正常な no-op は記録しない。これにより行数は日に数行に収まり、かつ購読喪失は当日中に 1 行残る。

`system_heartbeats` は実行ごとに 1 行 upsert するだけなので行が増えない。イベントログだけでは
「静かなだけ」と「cron が止まった」を区別できないため、この 2 つは両方必要である。

### 3. `api/send-reminders.ts`（改修）

判定を UTC 基準からユーザー TZ 基準へ移す。

- `habits` と `profiles.timezone` を join して取得する
- SQL の `.lte('reminder_time', ...)` による絞り込みを外し、`reminder_time IS NOT NULL`
  かつ `archived_at IS NULL` で取得したうえで、ユーザーごとに `timeService` でローカル時刻・
  ローカル日付を算出して判定する
- 完了判定（`completions.completed_date`）と `last_notified_date` の比較を、UTC 今日ではなく
  ユーザーのローカル今日で行う
- `weekly_count` の週範囲もユーザー TZ の日曜始まりで求める
- 購読失効の扱いを 410 のみから **410 と 404 の両方**に広げる（404 を返すプッシュサービスがある）
- 実行のたびに `system_heartbeats` を upsert し、送信・異常時のみ `notification_events` を insert する

SQL 側の絞り込みが失われるが、`idx_habits_reminder_time` の部分インデックスが効くうえ、
個人利用規模では実害がない。判定ロジックがクライアントと同じ純粋関数に乗る利点の方が大きい。

### 4. `api/send-test-notification.ts`（新規）

設定画面の「テスト通知を送る」から呼ばれる。

- 認証は Supabase JWT（`Authorization: Bearer <access_token>`）。cron 用の `x-cron-secret` は使わない
- JWT から解決したユーザー自身の購読にのみ送信する。他ユーザーへは送れない
- 送信結果は `notification_events` に記録しない（テストが履歴を汚さないようにする）

### 5. クライアント

**タイムゾーンの同期**

アプリ起動時に `getBrowserTimeZone()` と `profiles.timezone` を比較し、異なれば更新する。
旅行・引っ越しに自動追従させるため。新規 `ProfileRepository`（`findMine` / `updateTimezone`）を
`data/repositories` に追加し、既存の DI（`RepositoryProvider`）に載せる。

**削除するもの**

`src/lib/reminderTime.ts` の `localTimeToUtc` / `utcToLocalTime` / `getBrowserTimezoneOffset` と、
`NewHabitPage` / `HabitDetailPage` での変換呼び出し。`reminder_time` は「ユーザーが画面で見ている
時刻そのもの」になる。DB を覗いたときに何時の通知かが一目で分かる状態にすることが目的である。
`generateTimeOptions` / `roundToTenMinutes` は残す。

**習慣スケジュール判定の整理（P3）**

現在、似た名前の「その日にやるべきか」の判定が 2 つあるが、**両者は `weekly_count` の扱いが逆である**。

- `frequencyService.isDueOnDate(habit, date: Date)` — `weekly_count` は **true**（Today 画面は週 N 回の習慣も毎日出す）
- `calendarService.isHabitDueOnDate(habit, date: string)` — `weekly_count` は **false**（統計の分母には数えない）

つまり単純な重複ではなく、目的の異なる 2 つの述語が紛らわしい名前で並んでいる。統合するのではなく、
**役割が名前から分かるように分離**し、新しい `src/domain/services/habitScheduleService.ts` に集約する。

```ts
export function isActiveOnDate(habit: Habit, date: string): boolean          // 作成日〜アーカイブ日の範囲内か
export function isListedOnDate(habit: Habit, date: string): boolean          // Today 画面のリストに出すか（weekly_count は true）
export function isCountedAsTargetOnDate(habit: Habit, date: string): boolean // 統計の分母に数えるか（weekly_count は false）
```

日付はすべて `YYYY-MM-DD` 文字列で受け取る。`calendarService` と `xpService` は既存の
`isHabitActiveOnDate` / `isHabitDueOnDate` を使うのをやめ、この新サービスを参照する。

`TodayPage` の `dueHabits` は `isActiveOnDate` と `isListedOnDate` の組で判定するよう変更し、
作成日より前の日付に習慣が出ないようにする。#109 が再発しないのは、判定の住所が 1 箇所になり、
かつ 2 つの述語の違いが名前で表現されるためである。

**設定画面の通知診断 UI**

現在の `SettingsPage`（ログアウトのみ）に通知セクションを追加する。

```
通知
  パイプライン     最終実行 3分前  ✅        ← system_heartbeats
  このデバイス     登録済み       [再登録]   ← push_subscriptions を endpoint で照会
  通知の許可       許可済み                  ← Notification.permission
  直近の通知       8/11 07:00「日記」他1件   ← notification_events
                  [テスト通知を送る]

  ⚠️ 8/9 07:00 送信先が未登録のため通知できませんでした
```

`last_run_at` が 30 分以上前の場合は警告を表示する（cron 間隔 10 分の 3 倍）。
「再登録」は `pushSubscriptionOperations.ensureSubscription` を明示的に呼ぶ。
これにより、調査ドキュメント 5 章の復旧手順（習慣のリマインダーを OFF→ON し直す）が不要になる。

**依存関係の注記（解消済み）:** `pushSubscriptionOperations` モジュール
（`src/hooks/pushSubscriptionOperations.ts`、`ensureSubscription` と `reconcileSubscription` を持つ）は、
本スペック作成時点では未マージのブランチ `fix/push-auto-resubscribe` にしか存在しなかった。
2026-08-12 に PR #142 がマージされ、`main` で利用可能になっている。あわせて、起動時の再購読は
`src/hooks/usePushSubscriptionReconcile.ts` として切り出され、認証済み全ルートを包む
`src/ui/layouts/AppLayout.tsx` から呼ばれる。したがって診断 UI（Phase 4）の「再登録」導線は
`ensureSubscription` をそのまま利用できる。

**完了トグルの失敗ハンドリング（P4）**

- `useCompletions.toggleCompletion` を楽観更新にする。先に state を更新し、失敗時にロールバックする。
  既存の `performToggleWithRetry`（RLS リトライ）の外側にロールバックを被せる
- 失敗は `@base-ui/react/toast` で「記録に失敗しました [再試行]」を表示する。同パッケージは
  依存に含まれているため新規ライブラリの追加は不要
- `TodayPage` の `ErrorState` は初期ロード失敗専用に戻す。現在はトグル失敗も同じ場所に出て
  役割が混ざっている

---

## データフロー

### リマインダー送信（変更後）

```
pg_cron（10分毎）
  → pg_net → POST /api/send-reminders（x-cron-secret）
    → habits × profiles.timezone を取得
    → ユーザーごとに timeService でローカル今日・ローカルスロットを算出
    → reminder_time <= ローカルスロット かつ last_notified_date != ローカル今日
    → ローカル今日の completions と照合、weekly_days / weekly_count を判定
    → push_subscriptions へ web-push
       ├─ 成功 → notification_events(sent) + habits.last_notified_date 更新
       ├─ 購読 0 件 → notification_events(no_subscription)
       ├─ 410/404 → 購読削除 + notification_events(subscription_expired)
       └─ その他例外 → notification_events(send_failed)
    → system_heartbeats を upsert（毎回）
```

### 診断画面の読み取り

```
SettingsPage
  ├─ system_heartbeats.last_run_at        → パイプラインの生存
  ├─ push_subscriptions（endpoint 一致）   → このデバイスの登録状態
  ├─ Notification.permission              → OS/ブラウザの許可状態
  └─ notification_events（直近 N 件）      → 実際に届いたか / なぜ届かなかったか
```

## エラーハンドリング

| 箇所 | 方針 |
|---|---|
| `timeService` に不正な IANA 名が渡る | `Intl` が例外を投げるため、`profiles.timezone` 読み取り時に検証し、不正なら `'Asia/Tokyo'` にフォールバックする |
| TZ 同期の失敗 | ベストエフォート。失敗しても既存の TZ で動作を継続し、ユーザーには通知しない |
| `notification_events` の書き込み失敗 | 通知送信自体は継続する。観測が本体を止めてはならない |
| テスト通知の送信失敗 | トーストで理由を表示する（購読なし / 許可なし / 送信エラーを区別する） |
| 完了トグルの失敗 | 楽観更新をロールバックし、再試行付きトーストを表示する |

## テスト戦略

| 対象 | 種別 | 重点 |
|---|---|---|
| `timeService` | ユニット | DST 境界（`America/New_York` の 3 月 / 11 月）、UTC 日付をまたぐ `Asia/Tokyo` 06:00、UTC+14 の `Pacific/Kiritimati` |
| `habitScheduleService` | ユニット | 作成日当日 / 前日、アーカイブ日前後の境界値、`weekly_count` が `isListedOnDate` では true・`isCountedAsTargetOnDate` では false になること |
| `send-reminders` の `handler` | 統合 | 現在ほぼ未テスト（既存 146 行は純粋関数のみ）。Supabase クライアントをモックし「JST 07:00 の習慣が UTC 22:00 に通知される」を検証。購読 0 件で `no_subscription` が記録されることも検証 |
| `send-test-notification` | 統合 | 他ユーザーの購読へ送れないことを検証 |
| マイグレーション | CI | ローカル Supabase で `reminder_time` 変換 SQL の前後値を検証 |
| #109 | E2E | 過去日に戻して、作成日より前の日付に習慣が出ないことを回帰テスト |
| 通知診断 UI | E2E | 購読なしの状態で「未登録」と表示されること |

カバレッジ目標は既存方針どおり 80% 以上。

**あわせて修正**: `tsconfig.json` の `include` が `["src", "vite.config.ts"]` のため、
`api/` が型チェックの対象外になっている（`npm run typecheck` も CI も見ていない）。
本番でしか壊れない領域を放置していた点は Deno 互換問題と同じ構図なので、`api` を include に追加する。

## 実装フェーズ

1 フェーズ = 1 issue = 1 PR とする。

| Phase | 内容 | 対応する問題 | 規模 |
|---|---|---|---|
| 1 | #109 修正 + `habitScheduleService` への判定集約 | P3 | 小 |
| 2 | `timeService` 追加 + クライアント内の日付重複解消 + `tsconfig` に `api` を追加 | P1（準備） | 中 |
| 3 | `profiles.timezone` マイグレーション + `reminder_time` 変換 + サーバーの TZ 判定 + `ProfileRepository` と TZ 同期 + `habitScheduleService.isActiveOnDate` のユーザー TZ 化 | P1 | 中〜大 |
| 4 | `notification_events` + `system_heartbeats` + 診断 UI + テスト通知 | P2 | 中 |
| 5 | トースト + 楽観更新 | P4 | 小〜中 |

Phase 2 は `reminder_time` の意味を変えず、純粋関数の追加とクライアント内の重複解消のみに留める。
これにより Phase 2 は単独でマージでき、`reminder_time` の意味が変わる変更は Phase 3 の 1 PR に閉じる。
クライアントとサーバーで解釈が食い違う中途半端な状態を作らないことが分割の要件である。

Phase 3 は本番の `reminder_time` を書き換えるため、マージ後に iPhone 実機で通知が届くことの確認を
必須とする。Phase 4 の診断画面があれば確認は容易になるが、Phase 4 自体が Phase 3 の TZ 基盤に
乗るため、この順序になる。

## 完了の定義

- JST 06:00〜08:59 のリマインダーが正しい日付で判定され、正しい時刻に届く
- タイムゾーンが変わっても、次回起動時にリマインダー時刻が追従する
- 購読喪失・cron 停止・送信失敗が、設定画面を開くだけで判別できる
- 過去日に戻しても、その時点で存在しなかった習慣が表示されない
- 完了トグルの失敗がスクロール位置によらずユーザーに伝わり、UI とサーバーの状態が一致する
