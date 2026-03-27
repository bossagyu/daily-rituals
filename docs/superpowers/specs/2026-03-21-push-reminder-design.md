# Push Reminder Design

## Overview

習慣ごとに個別のプッシュ通知リマインダーを設定できる機能。未完了の習慣のみ、設定した時刻にブラウザのプッシュ通知で知らせる。

## Requirements

- 習慣ごとにリマインダー時刻を設定可能（10分刻み、06:00〜23:50 ローカル時刻）
- 時間帯制限の理由: 深夜（00:00〜05:50）の通知を防止するため
- 未完了の習慣のみ通知（完了済みはスキップ）
- ブラウザのWeb Push APIを使用（アプリを閉じていても受信可能）
- 通知許可がブロックされた場合はメッセージを表示するのみ（フォールバックなし）
- 同一時刻に複数の未完了習慣がある場合、1通にまとめて通知する（最大3件表示 +「他N件」）
- `weekly_count` タイプの習慣は、週の目標を達成済みならリマインダーをスキップする
- アーカイブされた習慣のリマインダー設定は保持する（アーカイブ中は通知されない、復元時に再開）
- 通知タップ時はTodayページ（`/`）に遷移する
- サブスクリプション期限切れ時はアプリ起動時にサイレント再登録する（ユーザーへの通知なし）

## Architecture

> **注: 2026-03-22 アーキテクチャ変更済み**
> Deno Edge Functionでのweb-pushライブラリ互換性問題により、Vercel API Route (Node.js) に移行。

```
[Browser Service Worker] <-- Web Push -- [Vercel API Route: api/send-reminders.ts]
                                                    |
                                            [Supabase DB]
                                          (habits, completions,
                                           push_subscriptions)
                                                    ^
                                            [pg_cron + pg_net]
                                          (10分ごとにVercel API Routeを呼び出し)
```

pg_cron が10分ごとに pg_net 経由で Vercel API Route を HTTP呼び出しし、該当時刻のリマインダーを持つ未完了習慣を検索し、`web-push` npmパッケージ (Node.js) で通知を送信する。

CRON_SECRET ヘッダーによる認証で、不正なリクエストを排除する。

## Database Design

### `habits` table (existing) - column additions

| Column | Type | Description |
|--------|------|-------------|
| `reminder_time` | `TIME`, nullable | リマインダー時刻（UTC）。NULLならリマインダー無効。10分刻み |
| `last_notified_date` | `DATE`, nullable | 最後に通知を送信した日付（UTC）。重複通知防止に使用 |

### `push_subscriptions` table (new)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, PK | Primary key |
| `user_id` | UUID, FK → auth.users | ユーザーID |
| `endpoint` | TEXT, NOT NULL, UNIQUE | Web Push エンドポイントURL |
| `p256dh` | TEXT, NOT NULL | 公開鍵 |
| `auth` | TEXT, NOT NULL | 認証シークレット |
| `created_at` | TIMESTAMPTZ, NOT NULL | 作成日時 |

UNIQUE制約: `endpoint` カラムにUNIQUE制約を設け、同一ブラウザの重複登録を防止。同一ユーザーが複数デバイスを使う場合は異なるendpointとなるため問題ない。

RLS policy: ユーザーは自分のサブスクリプションのみCRUD可能。

### Migration SQL

```sql
-- habits テーブルにカラムを追加
ALTER TABLE habits ADD COLUMN reminder_time TIME;
ALTER TABLE habits ADD COLUMN last_notified_date DATE;

-- push_subscriptions テーブルの作成
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS有効化
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: 自分のサブスクリプションのみ操作可能
CREATE POLICY "Users can manage own subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- pg_cronジョブの設定（10分ごとにEdge Functionを呼び出し）
SELECT cron.schedule(
  'send-reminders',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := '<SUPABASE_URL>/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## Backend Design

### Edge Function: `send-reminders`

pg_cron + pg_net 経由で10分ごとに呼び出される。

**処理フロー:**

1. 現在時刻を10分単位に丸める（UTC）
2. `habits` テーブルから以下の条件に一致するレコードを取得:
   - `reminder_time <= 現在時刻（10分丸め）`
   - `last_notified_date IS NULL OR last_notified_date < today（UTC）`
   - これにより、cronスキップ時も次回実行で漏れなくリカバリされる
3. `completions` テーブルとJOINし、今日未完了のもののみ抽出（`weekly_count` タイプは今週の目標達成済みなら除外）
   - アーカイブ済みの習慣（`archived_at IS NOT NULL`）も除外
4. ユーザーごとに未完了の習慣をグルーピング
5. 該当ユーザーの `push_subscriptions` を取得
6. ユーザーごとに1通の通知を送信（複数習慣はまとめる）
7. 通知送信成功後、該当習慣の `last_notified_date` を今日の日付（UTC）に更新
8. 送信失敗（410 Gone等）のサブスクリプションは `push_subscriptions` から削除

**重複通知防止とリカバリの仕組み:**

- `last_notified_date` により、同じ日に同じ習慣の通知は1回のみ送信される
- `reminder_time <= 現在時刻` の範囲検索により、cronがスキップされても次回実行時にリカバリされる
- 翌日になると `last_notified_date < today` となり、再びリマインダー対象になる
- 習慣が完了済みの場合は `completions` とのJOINで除外されるため、完了後に再通知されることはない

**Web Push実装:**

Supabase Edge FunctionsはDeno環境で動作するため、Node.js用の `web-push` ライブラリは使用できない。代わりに、Deno標準の `crypto` APIを使用してVAPID JWTの署名とWeb Pushプロトコルの実装を行う。

**環境変数（Supabase Secrets）:**

- `VAPID_PUBLIC_KEY` — Web Push用公開鍵
- `VAPID_PRIVATE_KEY` — Web Push用秘密鍵
- `VAPID_SUBJECT` — `mailto:` 形式のメールアドレス

**VAPID鍵の生成・管理:**

```bash
# 開発環境: Node.jsのweb-pushで鍵ペアを生成
npx web-push generate-vapid-keys

# Supabase Secretsに設定
supabase secrets set VAPID_PUBLIC_KEY=<generated_public_key>
supabase secrets set VAPID_PRIVATE_KEY=<generated_private_key>
supabase secrets set VAPID_SUBJECT=mailto:your-email@example.com
```

フロントエンドには `VITE_VAPID_PUBLIC_KEY` 環境変数で公開鍵を渡す。

**通知ペイロード:**

```json
{
  "title": "Daily Rituals",
  "body": "「読書」「運動」「瞑想」他2件がまだ完了していません",
  "icon": "/icon-192x192.png",
  "data": { "url": "/" }
}
```

通知本文には最大3件の習慣名を表示し、4件以上の場合は「他N件」と省略する。

注: アイコンはPNG形式が必要。現在SVGのみ存在するため、PNG版のアイコンを生成して追加する。

**タイムゾーン:**

フロントエンドで設定時にローカル時刻をUTCに変換して保存。サーバー側はUTCで比較。日本（JST, UTC+9）は夏時間がないため固定オフセットで正確に動作する。DSTのあるタイムゾーンへの対応は将来の拡張とし、現時点ではサポート対象外とする。

## Frontend Design

### Service Worker changes

既存のPWA Service Workerは vite-plugin-pwa の `generateSW`（Workbox自動生成）を使用している。プッシュ通知のイベントリスナーを追加するには、`injectManifest` 戦略に切り替える必要がある。

**変更内容:**

1. `vite.config.ts` の VitePWA 設定を `generateSW` → `injectManifest` に変更
2. カスタム Service Worker ファイル `src/sw.ts` を作成
3. Workboxのプリキャッシュ機能は `injectManifest` でも維持
4. 以下のイベントリスナーを追加:
   - `push` イベントリスナー — 通知の受信・表示
   - `notificationclick` イベントリスナー — タップでアプリを開く（`data.url` に遷移）

### Habit edit form changes

既存の習慣作成・編集フォームに「リマインダー」セクションを追加:

- トグルスイッチ（ON/OFF）
- 時刻セレクター（10分刻み、06:00〜23:50 ローカル時刻表示）
- 初回ON時にブラウザの通知許可をリクエスト
- 通知許可の状態に応じた動作:
  - `granted`: サブスクリプション登録、reminder_time保存
  - `denied`: 「通知がブロックされています。ブラウザの設定から許可してください」と表示、トグルをOFFに戻す
  - `default`（ダイアログをdismiss）: トグルをOFFに戻す。次回ONにしたとき再度許可リクエスト

### New hook: `usePushSubscription`

- 通知許可の状態管理（`granted` / `denied` / `default`）
- `PushManager.subscribe()` によるサブスクリプション登録
- サブスクリプション情報を `push_subscriptions` テーブルに保存
- サブスクリプション解除
- アプリ起動時のサブスクリプション検証（後述）

### Subscription re-registration

アプリ起動時に以下のフローでサブスクリプションの有効性を検証する:

1. `PushManager.getSubscription()` でブラウザ側のサブスクリプションを取得
2. 取得できた場合、そのendpointが `push_subscriptions` テーブルに存在するか確認
3. DBに存在しない場合（サーバー側で期限切れ削除済み）、自動で `unsubscribe()` → 再度 `subscribe()` → DBに保存（サイレント再登録）
4. ブラウザ側にサブスクリプションがない場合は何もしない（リマインダーON時に登録される）

### Domain model updates

以下のファイルを更新する:

- `src/domain/models/habit.ts` — `Habit` 型に `reminderTime: string | null` と `lastNotifiedDate: string | null` を追加、`habitSchema` と `createHabitInputSchema` を更新
- `src/lib/database.types.ts` — `habits` テーブルの型定義に `reminder_time` と `last_notified_date` を追加
- `src/data/repositories/habitRepository.ts` — マッパー関数に `reminderTime` を追加
- `src/data/repositories/supabaseHabitRepository.ts` — クエリに `reminder_time` を含める
- `src/domain/models/habitFormValidation.ts` — `HabitFormState` にリマインダー関連フィールドを追加

新規ファイル:

- `src/data/repositories/pushSubscriptionRepository.ts` — `push_subscriptions` テーブルのCRUD
- `src/hooks/usePushSubscription.ts` — プッシュ通知サブスクリプション管理フック
- `src/sw.ts` — カスタムService Worker

### Data flow

1. ユーザーがリマインダーをON → 通知許可リクエスト
2. 許可されたら `PushManager.subscribe()` でサブスクリプション取得
3. サブスクリプションを Supabase `push_subscriptions` テーブルに保存（UPSERT: endpointが既存なら更新）
4. `reminder_time` をUTC変換して `habits` テーブルに保存

## Error Handling

- 通知許可拒否/dismiss: UIにメッセージ表示、トグルをOFFに戻す
- サブスクリプション期限切れ: Edge Functionがレコードを削除、次回アプリ起動時にサイレント再登録
- Edge Function実行エラー: ログ出力（Supabase Dashboard で確認可能）

## Testing Strategy

- **Unit tests:** `usePushSubscription` フック、UTC変換ロジック、時刻丸めロジック、通知グルーピングロジック
- **Integration tests:** Edge Function のDB クエリとフィルタリングロジック、push_subscriptions CRUD
- **E2E tests:** リマインダー設定UIの操作フロー（通知許可のモックが必要）
