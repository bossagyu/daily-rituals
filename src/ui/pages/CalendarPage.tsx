/**
 * CalendarPage - Monthly calendar heatmap view for habit completion tracking.
 *
 * Composes month navigation header, HeatmapCalendar, and HabitFilter.
 * Uses useCalendarData hook for data management and useRepositories for data access.
 */

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRepositories } from '@/hooks/useRepositories';
import { useCalendarData } from '@/hooks/useCalendarData';
import { useStatsData } from '@/hooks/useStatsData';
import { HeatmapCalendar } from '@/ui/components/HeatmapCalendar';
import { HabitFilter } from '@/ui/components/HabitFilter';
import { LevelBar } from '@/ui/components/LevelBar';
import { WeeklyMonthlyStats } from '@/ui/components/WeeklyMonthlyStats';
import { Button } from '@/components/ui/button';

// --- Sub-components ---

function LoadingState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-16"
      role="status"
      aria-label="読み込み中"
    >
      <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <p className="mt-4 text-sm text-muted-foreground">読み込み中...</p>
    </div>
  );
}

function ErrorState({
  message,
}: {
  readonly message: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16"
      role="alert"
    >
      <p className="text-sm text-destructive">
        エラーが発生しました: {message}
      </p>
    </div>
  );
}

function MonthNavigationHeader({
  year,
  month,
  canGoNext,
  onPrevious,
  onNext,
}: {
  readonly year: number;
  readonly month: number;
  readonly canGoNext: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <Button
        variant="ghost"
        size="icon"
        onClick={onPrevious}
        aria-label="前の月"
      >
        <ChevronLeft className="size-5" />
      </Button>
      <h2 className="text-lg font-bold text-foreground">
        {year}年{month}月
      </h2>
      <Button
        variant="ghost"
        size="icon"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="次の月"
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}

// --- Main Page ---

export function CalendarPage() {
  const { habitRepository, completionRepository } = useRepositories();

  const {
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
  } = useCalendarData(habitRepository, completionRepository);

  const stats = useStatsData(habitRepository, completionRepository);

  const selectedHabitColor = useMemo(() => {
    if (filter.mode !== 'habit') return undefined;
    const habit = allHabits.find((h) => h.id === filter.habitId);
    return habit?.color;
  }, [filter, allHabits]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">カレンダー</h1>
      </header>

      {stats.xp && stats.weekly && stats.monthly && (
        <div className="mb-6 space-y-3">
          <LevelBar
            level={stats.xp.level}
            currentXp={stats.xp.currentXp}
            requiredXp={stats.xp.requiredXp}
          />
          <WeeklyMonthlyStats weekly={stats.weekly} monthly={stats.monthly} />
        </div>
      )}

      <MonthNavigationHeader
        year={year}
        month={month}
        canGoNext={canGoNext}
        onPrevious={goToPreviousMonth}
        onNext={goToNextMonth}
      />

      {error && <ErrorState message={error} />}

      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="mb-6">
          <HeatmapCalendar
            calendarGrid={calendarGrid}
            achievements={achievements}
            filterMode={filter.mode === 'all' ? 'all' : 'habit'}
            selectedHabitColor={selectedHabitColor}
          />
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          フィルター
        </h3>
        <HabitFilter
          habits={allHabits}
          filter={filter}
          onFilterChange={setFilter}
        />
      </div>
    </div>
  );
}
