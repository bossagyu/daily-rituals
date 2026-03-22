/**
 * useCalendarData - Hook for calendar heatmap data management.
 *
 * Manages current year/month state, filter selection, data fetching
 * (habits + archived habits + completions), and month navigation.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Habit } from '@/domain/models';
import type { Completion } from '@/domain/models';
import type { HabitRepository } from '@/data/repositories/habitRepository';
import type { CompletionRepository } from '@/data/repositories/completionRepository';
import {
  generateCalendarGrid,
  calculateDailyAchievements,
  type CalendarDay,
  type DayAchievement,
} from '@/domain/services/calendarService';

// --- Types ---

export type CalendarFilter =
  | { readonly mode: 'all' }
  | { readonly mode: 'habit'; readonly habitId: string };

export type UseCalendarDataReturn = {
  readonly year: number;
  readonly month: number;
  readonly calendarGrid: readonly CalendarDay[];
  readonly achievements: readonly DayAchievement[];
  readonly allHabits: readonly Habit[];
  readonly filter: CalendarFilter;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly goToPreviousMonth: () => void;
  readonly goToNextMonth: () => void;
  readonly canGoNext: boolean;
  readonly setFilter: (filter: CalendarFilter) => void;
};

// --- Utilities ---

export function getInitialYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function getDateRange(
  grid: readonly CalendarDay[],
): { startDate: string; endDate: string } {
  return {
    startDate: grid[0].date,
    endDate: grid[grid.length - 1].date,
  };
}

export function canNavigateNext(year: number, month: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year < currentYear || (year === currentYear && month < currentMonth);
}

export function navigatePreviousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

export function navigateNextMonth(year: number, month: number): { year: number; month: number } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year > currentYear) return { year, month };
  if (year === currentYear && month >= currentMonth) return { year, month };

  if (month === 12) {
    return { year: year + 1, month: 1 };
  }
  return { year, month: month + 1 };
}

export function filterHabitsForCalculation(
  allHabits: readonly Habit[],
  filter: CalendarFilter,
): readonly Habit[] {
  return filter.mode === 'all'
    ? allHabits
    : allHabits.filter((h) => h.id === filter.habitId);
}

// --- Hook ---

export function useCalendarData(
  habitRepository: HabitRepository,
  completionRepository: CompletionRepository,
): UseCalendarDataReturn {
  const [yearMonth, setYearMonth] = useState(getInitialYearMonth);
  const [filter, setFilter] = useState<CalendarFilter>({ mode: 'all' });
  const [habits, setHabits] = useState<readonly Habit[]>([]);
  const [archivedHabits, setArchivedHabits] = useState<readonly Habit[]>([]);
  const [completions, setCompletions] = useState<readonly Completion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { year, month } = yearMonth;

  const calendarGrid = useMemo(
    () => generateCalendarGrid(year, month),
    [year, month],
  );

  const allHabits = useMemo(
    () => [...habits, ...archivedHabits],
    [habits, archivedHabits],
  );

  // Fetch data when year/month or filter changes
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        const grid = generateCalendarGrid(year, month);
        const { startDate, endDate } = getDateRange(grid);

        const [activeHabits, archived, completionData] = await Promise.all([
          habitRepository.findAll(),
          habitRepository.findArchived(),
          filter.mode === 'all'
            ? completionRepository.findByDateRange(startDate, endDate)
            : completionRepository.findByHabitIdAndDateRange(
                filter.habitId,
                startDate,
                endDate,
              ),
        ]);

        if (!cancelled) {
          setHabits(activeHabits);
          setArchivedHabits(archived);
          setCompletions(completionData);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'データの取得に失敗しました';
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
  }, [year, month, filter, habitRepository, completionRepository]);

  const achievements = useMemo(() => {
    if (isLoading || allHabits.length === 0) return [];

    const { startDate, endDate } = getDateRange(calendarGrid);

    const habitsForCalc = filterHabitsForCalculation(allHabits, filter);

    return calculateDailyAchievements(habitsForCalc, completions, startDate, endDate);
  }, [isLoading, allHabits, completions, calendarGrid, filter]);

  const canGoNext = useMemo(() => canNavigateNext(year, month), [year, month]);

  const goToPreviousMonth = useCallback(() => {
    setYearMonth((prev) => navigatePreviousMonth(prev.year, prev.month));
  }, []);

  const goToNextMonth = useCallback(() => {
    setYearMonth((prev) => navigateNextMonth(prev.year, prev.month));
  }, []);

  return {
    year,
    month,
    calendarGrid,
    achievements,
    allHabits,
    filter,
    isLoading,
    error,
    goToPreviousMonth,
    goToNextMonth,
    canGoNext,
    setFilter,
  };
}
