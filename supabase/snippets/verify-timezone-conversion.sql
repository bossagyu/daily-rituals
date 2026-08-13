-- reminder_time の UTC → ローカル変換式が正しいことを検証する。
-- マイグレーション 20260813000000_add_user_timezone.sql と同じ式を使っている。
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
