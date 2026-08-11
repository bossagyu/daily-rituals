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
