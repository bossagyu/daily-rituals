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
