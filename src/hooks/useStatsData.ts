/**
 * useStatsData - Hook that fetches all-time data needed for the
 * level / weekly / monthly summary on the calendar page.
 *
 * Loads active + archived habits and all completions from the earliest
 * habit creation date through today, then derives:
 *   - XP / level breakdown via xpService
 *   - this-week and this-month achievement summaries via statsService
 */

import { useState, useEffect } from 'react';
import type { Habit, Completion } from '@/domain/models';
import type { HabitRepository } from '@/data/repositories/habitRepository';
import type { CompletionRepository } from '@/data/repositories/completionRepository';
import { calculateTotalXp, type XpBreakdown } from '@/domain/services/xpService';
import {
  calculateDailyAchievements,
} from '@/domain/services/calendarService';
import {
  aggregateAchievements,
  getWeekRange,
  getMonthRange,
  type AchievementSummary,
} from '@/domain/services/statsService';

export type StatsData = {
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly xp: XpBreakdown | null;
  readonly weekly: AchievementSummary | null;
  readonly monthly: AchievementSummary | null;
};

const padTwo = (n: number): string => String(n).padStart(2, '0');

const getTodayString = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${padTwo(now.getMonth() + 1)}-${padTwo(now.getDate())}`;
};

const getEarliestHabitDate = (habits: readonly Habit[]): string | null => {
  if (habits.length === 0) return null;
  let earliest = habits[0].createdAt.slice(0, 10);
  for (const h of habits) {
    const d = h.createdAt.slice(0, 10);
    if (d < earliest) earliest = d;
  }
  return earliest;
};

export function useStatsData(
  habitRepository: HabitRepository,
  completionRepository: CompletionRepository,
): StatsData {
  const [habits, setHabits] = useState<readonly Habit[]>([]);
  const [completions, setCompletions] = useState<readonly Completion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        const [active, archived] = await Promise.all([
          habitRepository.findAll(),
          habitRepository.findArchived(),
        ]);

        const allHabits: readonly Habit[] = [...active, ...archived];
        const earliest = getEarliestHabitDate(allHabits);
        const today = getTodayString();

        let completionData: readonly Completion[] = [];
        if (earliest !== null) {
          completionData = await completionRepository.findByDateRange(earliest, today);
        }

        if (!cancelled) {
          setHabits(allHabits);
          setCompletions(completionData);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : '統計データの取得に失敗しました';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [habitRepository, completionRepository]);

  if (isLoading || error || habits.length === 0) {
    return {
      isLoading,
      error,
      xp: null,
      weekly: null,
      monthly: null,
    };
  }

  const today = getTodayString();
  const earliest = getEarliestHabitDate(habits) ?? today;

  const xp = calculateTotalXp(habits, completions, earliest, today);

  const weekRange = getWeekRange(today);
  const monthRange = getMonthRange(today);

  // Calculate per-day achievements once over the union of week and month
  // (month range fully contains the relevant span when today is mid-month;
  // for weeks crossing month boundaries we extend the range to include both).
  const aggregateStart = weekRange.start < monthRange.start ? weekRange.start : monthRange.start;
  const aggregateEnd = weekRange.end > monthRange.end ? weekRange.end : monthRange.end;

  const achievements = calculateDailyAchievements(
    habits,
    completions,
    aggregateStart,
    aggregateEnd,
  );

  const weekly = aggregateAchievements(achievements, weekRange.start, weekRange.end, today);
  const monthly = aggregateAchievements(achievements, monthRange.start, monthRange.end, today);

  return {
    isLoading,
    error,
    xp,
    weekly,
    monthly,
  };
}
