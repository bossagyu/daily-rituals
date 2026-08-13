import { describe, it, expect } from 'vitest';
import {
  buildNotificationBody,
  isWeeklyCountMet,
  isScheduledToday,
  buildUserContext,
  selectHabitsToNotify,
  selectCompletedHabitIds,
  countWeeklyCompletions,
  type HabitRow,
  type CompletionRow,
} from '../send-reminders';

const baseHabit: HabitRow = {
  id: '1',
  user_id: 'u1',
  name: 'Test',
  frequency_type: 'daily',
  frequency_value: null,
  reminder_time: '09:00:00',
  last_notified_date: null,
  timezone: 'Asia/Tokyo',
};

describe('buildNotificationBody', () => {
  it('returns empty string for empty array', () => {
    expect(buildNotificationBody([])).toBe('');
  });

  it('shows single habit name', () => {
    expect(buildNotificationBody(['読書'])).toBe(
      '「読書」がまだ完了していません',
    );
  });

  it('shows two habit names', () => {
    expect(buildNotificationBody(['読書', '運動'])).toBe(
      '「読書」「運動」がまだ完了していません',
    );
  });

  it('shows three habit names', () => {
    expect(buildNotificationBody(['読書', '運動', '瞑想'])).toBe(
      '「読書」「運動」「瞑想」がまだ完了していません',
    );
  });

  it('truncates to 3 and shows remainder count', () => {
    expect(
      buildNotificationBody(['読書', '運動', '瞑想', '筋トレ', 'ランニング']),
    ).toBe('「読書」「運動」「瞑想」他2件がまだ完了していません');
  });

  it('shows exactly one remainder', () => {
    expect(
      buildNotificationBody(['読書', '運動', '瞑想', '筋トレ']),
    ).toBe('「読書」「運動」「瞑想」他1件がまだ完了していません');
  });
});

describe('isWeeklyCountMet', () => {
  it('returns true when count equals required', () => {
    const habit: HabitRow = {
      ...baseHabit,
      frequency_type: 'weekly_count',
      frequency_value: { count: 3 },
    };
    expect(isWeeklyCountMet(habit, 3)).toBe(true);
  });

  it('returns true when count exceeds required', () => {
    const habit: HabitRow = {
      ...baseHabit,
      frequency_type: 'weekly_count',
      frequency_value: { count: 3 },
    };
    expect(isWeeklyCountMet(habit, 5)).toBe(true);
  });

  it('returns false when count is below required', () => {
    const habit: HabitRow = {
      ...baseHabit,
      frequency_type: 'weekly_count',
      frequency_value: { count: 3 },
    };
    expect(isWeeklyCountMet(habit, 2)).toBe(false);
  });

  it('defaults to count of 1 when frequency_value is null', () => {
    const habit: HabitRow = {
      ...baseHabit,
      frequency_type: 'weekly_count',
      frequency_value: null,
    };
    expect(isWeeklyCountMet(habit, 1)).toBe(true);
    expect(isWeeklyCountMet(habit, 0)).toBe(false);
  });
});

describe('isScheduledToday', () => {
  it('returns true for daily habits regardless of day', () => {
    const habit: HabitRow = {
      ...baseHabit,
      frequency_type: 'daily',
    };
    expect(isScheduledToday(habit, 0)).toBe(true);
    expect(isScheduledToday(habit, 3)).toBe(true);
    expect(isScheduledToday(habit, 6)).toBe(true);
  });

  it('returns true for weekly_count habits regardless of day', () => {
    const habit: HabitRow = {
      ...baseHabit,
      frequency_type: 'weekly_count',
      frequency_value: { count: 3 },
    };
    expect(isScheduledToday(habit, 0)).toBe(true);
    expect(isScheduledToday(habit, 5)).toBe(true);
  });

  it('returns true for weekly_days when today is a scheduled day', () => {
    const habit: HabitRow = {
      ...baseHabit,
      frequency_type: 'weekly_days',
      frequency_value: { days: [1, 3, 5] },
    };
    expect(isScheduledToday(habit, 1)).toBe(true);
    expect(isScheduledToday(habit, 3)).toBe(true);
    expect(isScheduledToday(habit, 5)).toBe(true);
  });

  it('returns false for weekly_days when today is not a scheduled day', () => {
    const habit: HabitRow = {
      ...baseHabit,
      frequency_type: 'weekly_days',
      frequency_value: { days: [1, 3, 5] },
    };
    expect(isScheduledToday(habit, 0)).toBe(false);
    expect(isScheduledToday(habit, 2)).toBe(false);
    expect(isScheduledToday(habit, 4)).toBe(false);
    expect(isScheduledToday(habit, 6)).toBe(false);
  });

  it('returns false for weekly_days with null frequency_value', () => {
    const habit: HabitRow = {
      ...baseHabit,
      frequency_type: 'weekly_days',
      frequency_value: null,
    };
    expect(isScheduledToday(habit, 1)).toBe(false);
  });
});

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

  it('weekly_days はローカル曜日（東京の木曜=4）が対象なら選ぶ', () => {
    // instant は UTC では 03-11 水曜（3）、東京では 03-12 木曜（4）。
    // ローカル評価でのみ選ばれる。UTC 曜日に戻す退行があるとここで落ちる。
    const habit = makeHabitRow({
      frequency_type: 'weekly_days',
      frequency_value: { days: [4] },
    });
    expect(selectHabitsToNotify([habit], instant, new Set(), new Map()).map((h) => h.id))
      .toEqual(['h1']);
  });

  it('weekly_days は UTC 曜日（水曜=3）が対象でもローカルでなければ選ばない', () => {
    // UTC 基準の実装ならここで誤って選んでしまう。ローカル基準なら選ばれない。
    const habit = makeHabitRow({
      frequency_type: 'weekly_days',
      frequency_value: { days: [3] },
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

describe('selectCompletedHabitIds', () => {
  it('habit ごとの所有者ローカル今日と一致する completion のみ完了とみなす', () => {
    // hA は東京（ローカル今日 03-12）、hB はロサンゼルス（ローカル今日 03-11）を想定。
    // hB の completion に "03-12"（hA のローカル今日と同じ日付）が紛れ込んでいても、
    // hB 自身のローカル今日と一致しない限り完了扱いにしてはいけない。
    const localTodayByHabit = new Map([
      ['hA', '2026-03-12'],
      ['hB', '2026-03-11'],
    ]);
    const completions: CompletionRow[] = [
      { habit_id: 'hA', completed_date: '2026-03-12' },
      { habit_id: 'hB', completed_date: '2026-03-12' },
    ];

    const result = selectCompletedHabitIds(completions, localTodayByHabit);

    expect(result.has('hA')).toBe(true);
    expect(result.has('hB')).toBe(false);
  });

  it('対応する localToday が無い habit_id の completion は無視する', () => {
    const result = selectCompletedHabitIds(
      [{ habit_id: 'unknown', completed_date: '2026-03-12' }],
      new Map(),
    );
    expect(result.size).toBe(0);
  });
});

describe('countWeeklyCompletions', () => {
  it('habit ごとの週開始日〜ローカル今日の範囲内の completion のみカウントする', () => {
    // hA・hB は同じ週開始日だが、hB のローカル今日は hA より1日早い（別タイムゾーン）。
    // hB 宛ての completion のうち hB のローカル今日より後の日付は、hA のローカル今日と
    // 一致していても hB のカウントに含めてはいけない。
    const weekStartByHabit = new Map([
      ['hA', '2026-03-08'],
      ['hB', '2026-03-08'],
    ]);
    const localTodayByHabit = new Map([
      ['hA', '2026-03-12'],
      ['hB', '2026-03-11'],
    ]);
    const completions: CompletionRow[] = [
      { habit_id: 'hA', completed_date: '2026-03-12' }, // hA の範囲内
      { habit_id: 'hB', completed_date: '2026-03-12' }, // hB のローカル今日より後 → 範囲外
      { habit_id: 'hB', completed_date: '2026-03-09' }, // hB の範囲内
    ];

    const result = countWeeklyCompletions(completions, weekStartByHabit, localTodayByHabit);

    expect(result.get('hA')).toBe(1);
    expect(result.get('hB')).toBe(1);
  });

  it('週開始日より前の completion はカウントしない', () => {
    const weekStartByHabit = new Map([['h1', '2026-03-08']]);
    const localTodayByHabit = new Map([['h1', '2026-03-12']]);
    const completions: CompletionRow[] = [
      { habit_id: 'h1', completed_date: '2026-03-07' },
    ];

    const result = countWeeklyCompletions(completions, weekStartByHabit, localTodayByHabit);

    expect(result.has('h1')).toBe(false);
  });
});
