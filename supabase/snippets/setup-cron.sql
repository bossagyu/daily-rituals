-- ============================================================
-- send-reminders: pg_cron ジョブ設定（プッシュ通知リマインダー）
-- ============================================================
--
-- このジョブは 10 分ごとに Vercel API Route を呼び出し、
-- 該当時刻のリマインダーを持つ未完了習慣に通知を送信する。
--
-- 重要（#73 / #74 の移行後の正しい設定）:
--   - 呼び出し先は Supabase Edge Function ではなく Vercel API Route。
--     Edge Function（/functions/v1/send-reminders）は削除済み（commit bc8d6b4）。
--   - 認証は `Authorization: Bearer <SERVICE_ROLE_KEY>` ではなく
--     `x-cron-secret: <CRON_SECRET>` ヘッダーを使う。
--     （api/send-reminders.ts は x-cron-secret のみを検証し、
--      それ以外は 401 Unauthorized を返す）
--
-- 実行前に置き換える値:
--   <VERCEL_APP_URL> : 本番デプロイの URL（例: daily-rituals-nine.vercel.app）
--   <CRON_SECRET>    : Vercel 環境変数 CRON_SECRET と同一の値
--
-- 前提: pg_cron と pg_net 拡張が有効であること。
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   CREATE EXTENSION IF NOT EXISTS pg_net;
-- ------------------------------------------------------------

-- 旧ジョブ（Edge Function 宛て / Bearer 認証）が残っていれば削除する。
-- 存在しない場合のエラーを無視するため DO ブロックで囲む。
DO $$
BEGIN
  PERFORM cron.unschedule('send-reminders');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Vercel API Route 宛て / x-cron-secret 認証で再登録する。
SELECT cron.schedule(
  'send-reminders',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<VERCEL_APP_URL>/api/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ------------------------------------------------------------
-- 診断用クエリ（トラブルシューティング時に実行）
-- ------------------------------------------------------------
-- 登録済みジョブの確認（url / headers が Vercel + x-cron-secret になっているか）:
--   SELECT jobid, schedule, active, command FROM cron.job WHERE jobname = 'send-reminders';
--
-- 直近の実行結果の確認（status = 'succeeded' か、HTTP 応答は何か）:
--   SELECT jobid, status, return_message, start_time, end_time
--   FROM cron.job_run_details
--   ORDER BY start_time DESC
--   LIMIT 20;
--
-- pg_net の HTTP 応答本文の確認（200 / 401 / 404 など）:
--   SELECT id, status_code, content, error_msg, created
--   FROM net._http_response
--   ORDER BY created DESC
--   LIMIT 20;
