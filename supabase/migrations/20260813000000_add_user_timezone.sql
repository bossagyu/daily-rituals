-- ============================================================
-- ユーザーのタイムゾーンを保持し、reminder_time をローカル時刻へ戻す
-- ============================================================

ALTER TABLE profiles ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo';

-- 既存の reminder_time は UTC で保存されている。これをユーザーの
-- ローカル時刻へ戻す。以降 reminder_time は「ユーザーが画面で見ている時刻」を意味する。
--
-- ⚠️ この式を他所へ流用しないこと。Postgres は名前付きタイムゾーンのオフセットを
-- 「アンカー日」基準で解決するため、DATE '2000-01-01' を使うこの書き方が正しいのは
-- 2000-01-01 時点と現在でオフセットが同じ地域に限られる。Asia/Tokyo は DST が無く
-- +09:00 で不変なので安全だが、DST のある地域や 2000 年以降にオフセットを変えた地域では
-- 誤った時刻を生む。profiles.timezone は制約なしの TEXT なので、将来ユーザーが
-- タイムゾーンを選べるようになった場合、変換が必要ならアンカー日を実際の基準日にすること。
UPDATE habits h SET reminder_time =
  ((DATE '2000-01-01' + h.reminder_time) AT TIME ZONE 'UTC'
     AT TIME ZONE p.timezone)::time
FROM profiles p
WHERE p.id = h.user_id AND h.reminder_time IS NOT NULL;
