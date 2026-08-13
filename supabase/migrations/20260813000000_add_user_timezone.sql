-- ============================================================
-- ユーザーのタイムゾーンを保持し、reminder_time をローカル時刻へ戻す
-- ============================================================

ALTER TABLE profiles ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo';

-- このマイグレーション実行時点では、上の ALTER TABLE 直後であるため
-- 既存の profiles.timezone は例外なくデフォルト値 'Asia/Tokyo' である。
-- つまり以下の UPDATE は、すべての既存 habits をあたかも所有者が JST に
-- いるかのように変換する。このアプリでは正しいが、将来ユーザーが複数の
-- タイムゾーンを選べるようになった後に同種のマイグレーションを書く際は
-- この前提（全員 JST）を流用しないこと。
--
-- 変換前に、reminder_time を持つ habits の所有者に profiles 行が
-- 必ず存在することを確認する。on_auth_user_created トリガーにより
-- 本来ありえないはずだが、万一欠けていると当該行は UTC のまま残り、
-- アプリ側はそれをローカル時刻として読むため 9 時間ずれた reminder_time に
-- なる。しかも変換済みか未変換かを事後に見分ける手段がない。だからこそ
-- ここで確認し、半端に変換して進むのではなくマイグレーション自体を止める。
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM habits h
  WHERE h.reminder_time IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = h.user_id);

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Migration aborted: % habits with reminder_time have no matching profiles row (owner missing profile). Investigate before converting reminder_time to local time.',
      orphan_count;
  END IF;
END $$;

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
