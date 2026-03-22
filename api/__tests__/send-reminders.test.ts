import { describe, it, expect } from 'vitest';
import {
  buildNotificationBody,
  isWeeklyCountMet,
  isScheduledToday,
  type HabitRow,
} from '../send-reminders';

const baseHabit: HabitRow = {
  id: '1',
  user_id: 'u1',
  name: 'Test',
  frequency_type: 'daily',
  frequency_value: null,
  reminder_time: '09:00:00',
  last_notified_date: null,
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
