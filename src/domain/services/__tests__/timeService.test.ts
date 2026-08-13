import { describe, it, expect } from 'vitest';
import {
  getLocalDate,
  getLocalTime,
  getLocalDayOfWeek,
  getWeekStartSunday,
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

describe('getWeekStartSunday', () => {
  it('日曜始まりの週開始日を返す', () => {
    // 2026-03-12 は木曜。直前の日曜は 03-08
    expect(getWeekStartSunday(new Date('2026-03-12T03:00:00Z'), TOKYO)).toBe('2026-03-08');
  });

  it('日曜当日はその日を返す', () => {
    expect(getWeekStartSunday(new Date('2026-03-08T03:00:00Z'), TOKYO)).toBe('2026-03-08');
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

  it('連続する日付を通常どおり 1 日ずつ進める', () => {
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
