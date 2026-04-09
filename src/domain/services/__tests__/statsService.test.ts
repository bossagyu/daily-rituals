import { describe, it, expect } from 'vitest';
import {
  getWeekRange,
  getMonthRange,
  aggregateAchievements,
} from '../statsService';
import type { DayAchievement } from '../calendarService';

describe('statsService', () => {
  describe('getWeekRange', () => {
    it('returns Sunday-to-Saturday range for a Wednesday', () => {
      // 2026-04-08 is a Wednesday
      const result = getWeekRange('2026-04-08');
      expect(result.start).toBe('2026-04-05'); // Sunday
      expect(result.end).toBe('2026-04-11'); // Saturday
    });

    it('returns same day as start when today is Sunday', () => {
      // 2026-04-05 is a Sunday
      const result = getWeekRange('2026-04-05');
      expect(result.start).toBe('2026-04-05');
      expect(result.end).toBe('2026-04-11');
    });

    it('returns Sunday-to-Saturday range for a Saturday', () => {
      // 2026-04-11 is a Saturday
      const result = getWeekRange('2026-04-11');
      expect(result.start).toBe('2026-04-05');
      expect(result.end).toBe('2026-04-11');
    });

    it('handles month boundary', () => {
      // 2026-05-01 is a Friday → week starts 2026-04-26 (Sun)
      const result = getWeekRange('2026-05-01');
      expect(result.start).toBe('2026-04-26');
      expect(result.end).toBe('2026-05-02');
    });
  });

  describe('getMonthRange', () => {
    it('returns first to last day of the current month', () => {
      const result = getMonthRange('2026-04-08');
      expect(result.start).toBe('2026-04-01');
      expect(result.end).toBe('2026-04-30');
    });

    it('handles February correctly (non-leap year)', () => {
      const result = getMonthRange('2027-02-15');
      expect(result.start).toBe('2027-02-01');
      expect(result.end).toBe('2027-02-28');
    });

    it('handles February correctly (leap year)', () => {
      // 2028 is a leap year
      const result = getMonthRange('2028-02-15');
      expect(result.start).toBe('2028-02-01');
      expect(result.end).toBe('2028-02-29');
    });

    it('handles December correctly (31 days)', () => {
      const result = getMonthRange('2026-12-15');
      expect(result.start).toBe('2026-12-01');
      expect(result.end).toBe('2026-12-31');
    });
  });

  describe('aggregateAchievements', () => {
    const makeAchievement = (
      date: string,
      targetCount: number,
      completedCount: number,
    ): DayAchievement => ({
      date,
      targetCount,
      completedCount,
      rate: targetCount > 0 ? completedCount / targetCount : 0,
      completedHabitNames: [],
      isTargetDay: targetCount > 0,
    });

    it('returns 0/0/0 for empty input', () => {
      const result = aggregateAchievements([], '2026-04-01', '2026-04-08', '2026-04-08');
      expect(result.completedCount).toBe(0);
      expect(result.targetCount).toBe(0);
      expect(result.rate).toBe(0);
    });

    it('aggregates totals across the range', () => {
      const achievements: DayAchievement[] = [
        makeAchievement('2026-04-05', 3, 3),
        makeAchievement('2026-04-06', 3, 2),
        makeAchievement('2026-04-07', 3, 1),
        makeAchievement('2026-04-08', 3, 0),
      ];
      const result = aggregateAchievements(
        achievements,
        '2026-04-05',
        '2026-04-11',
        '2026-04-08',
      );
      // Only days up to today (04-05 to 04-08): 4 days × 3 target = 12, completed = 6
      expect(result.targetCount).toBe(12);
      expect(result.completedCount).toBe(6);
      expect(result.rate).toBe(0.5);
    });

    it('excludes future days from the calculation', () => {
      const achievements: DayAchievement[] = [
        makeAchievement('2026-04-05', 3, 3),
        makeAchievement('2026-04-06', 3, 3),
        makeAchievement('2026-04-07', 3, 3),
        makeAchievement('2026-04-08', 3, 3),
        makeAchievement('2026-04-09', 3, 0), // future
        makeAchievement('2026-04-10', 3, 0), // future
        makeAchievement('2026-04-11', 3, 0), // future
      ];
      const result = aggregateAchievements(
        achievements,
        '2026-04-05',
        '2026-04-11',
        '2026-04-08',
      );
      // Up to 2026-04-08: 4 days × 3 = 12 target, 12 completed
      expect(result.targetCount).toBe(12);
      expect(result.completedCount).toBe(12);
      expect(result.rate).toBe(1);
    });

    it('filters by the requested range start/end', () => {
      const achievements: DayAchievement[] = [
        makeAchievement('2026-04-04', 5, 5), // before range
        makeAchievement('2026-04-05', 3, 3),
        makeAchievement('2026-04-06', 3, 3),
        makeAchievement('2026-04-12', 5, 5), // after range
      ];
      const result = aggregateAchievements(
        achievements,
        '2026-04-05',
        '2026-04-11',
        '2026-04-30',
      );
      expect(result.targetCount).toBe(6);
      expect(result.completedCount).toBe(6);
      expect(result.rate).toBe(1);
    });

    it('returns rate of 0 when target count is 0', () => {
      const achievements: DayAchievement[] = [
        makeAchievement('2026-04-05', 0, 0),
        makeAchievement('2026-04-06', 0, 0),
      ];
      const result = aggregateAchievements(
        achievements,
        '2026-04-05',
        '2026-04-11',
        '2026-04-08',
      );
      expect(result.targetCount).toBe(0);
      expect(result.completedCount).toBe(0);
      expect(result.rate).toBe(0);
    });

    it('caps rate at 1 if completedCount somehow exceeds target', () => {
      const achievements: DayAchievement[] = [
        // unrealistic but defensive
        { ...makeAchievement('2026-04-05', 2, 5), rate: 2.5 },
      ];
      const result = aggregateAchievements(
        achievements,
        '2026-04-05',
        '2026-04-11',
        '2026-04-08',
      );
      expect(result.rate).toBe(1);
    });
  });
});
