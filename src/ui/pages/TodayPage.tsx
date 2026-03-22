/**
 * TodayPage - Main screen for daily habit tracking with date navigation.
 *
 * Displays the selected date's habits, completion checkboxes,
 * streak counts, and weekly progress. Supports navigating to past dates
 * via URL search params (?date=YYYY-MM-DD).
 */

import React, { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRepositories } from '@/hooks/useRepositories';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useHabits } from '@/hooks/useHabits';
import { useCompletions } from '@/hooks/useCompletions';
import { useStreak } from '@/hooks/useStreak';
import { isDueOnDate } from '@/domain/services/frequencyService';
import { TodayHabitCard } from '@/ui/components/TodayHabitCard';
import { Button } from '@/components/ui/button';
import {
  parseDateParam,
  formatDisplayDate,
  addDays,
  isToday,
  isFutureDate,
  getTodayString,
} from '@/lib/dateUtils';
import type { Habit } from '@/domain/models';

// --- State Components ---

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
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16"
      role="alert"
    >
      <p className="mb-4 text-sm text-destructive">
        エラーが発生しました: {message}
      </p>
      <button
        type="button"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        onClick={onRetry}
      >
        再試行
      </button>
    </div>
  );
}

function EmptyState({
  selectedDate,
}: {
  readonly selectedDate: string;
}) {
  const message = useMemo(() => {
    if (isToday(selectedDate)) {
      return '今日やるべき習慣はありません';
    }
    if (isFutureDate(selectedDate)) {
      return 'この日にやるべき習慣はありません';
    }
    return 'この日にやるべき習慣はありませんでした';
  }, [selectedDate]);

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <p className="text-lg font-medium text-foreground">{message}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        新しい習慣を追加して、毎日のルーティンを始めましょう。
      </p>
    </div>
  );
}

// --- Date Navigation ---

function DateNavigationHeader({
  displayDate,
  onPrevious,
  onNext,
}: {
  readonly displayDate: string;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <Button
        variant="ghost"
        size="icon"
        onClick={onPrevious}
        aria-label="前の日"
      >
        <ChevronLeft className="size-5" />
      </Button>
      <span className="text-sm font-medium text-muted-foreground">
        {displayDate}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={onNext}
        aria-label="次の日"
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}

// --- Habit List ---

type HabitListProps = {
  readonly habits: readonly Habit[];
  readonly selectedDate: string;
  readonly isCompleted: (habitId: string, date: string) => boolean;
  readonly toggleCompletion: (habitId: string, date: string) => Promise<void>;
  readonly getStreak: (habitId: string) => { readonly current: number; readonly longest: number };
  readonly getWeeklyProgress: (habitId: string) => { readonly done: number; readonly target: number };
  readonly onStreakRefresh: (habitId: string) => Promise<void>;
  readonly disabled: boolean;
};

function HabitList({
  habits,
  selectedDate,
  isCompleted,
  toggleCompletion,
  getStreak,
  getWeeklyProgress,
  onStreakRefresh,
  disabled,
}: HabitListProps) {
  const handleToggle = useCallback(
    async (habitId: string) => {
      await toggleCompletion(habitId, selectedDate);
      await onStreakRefresh(habitId);
    },
    [toggleCompletion, selectedDate, onStreakRefresh],
  );

  return (
    <div className="flex flex-col gap-2">
      {habits.map((habit) => (
        <TodayHabitCard
          key={habit.id}
          habit={habit}
          isCompleted={isCompleted(habit.id, selectedDate)}
          streak={getStreak(habit.id)}
          weeklyProgress={getWeeklyProgress(habit.id)}
          onToggle={() => void handleToggle(habit.id)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

// --- Progress Summary ---

function ProgressSummary({
  completed,
  total,
  displayDate,
}: {
  readonly completed: number;
  readonly total: number;
  readonly displayDate: string;
}) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${displayDate}の進捗: ${completed}/${total}`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-medium text-muted-foreground">
        {completed}/{total}
      </span>
    </div>
  );
}

// --- Main Page ---

export function TodayPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDate = useMemo(() => parseDateParam(searchParams.get('date')), [searchParams]);
  const todayStr = useMemo(() => getTodayString(), []);
  const isSelectedToday = isToday(selectedDate);
  const isSelectedFuture = isFutureDate(selectedDate);
  const displayDate = useMemo(() => formatDisplayDate(selectedDate), [selectedDate]);

  const goToPreviousDay = useCallback(() => {
    const prev = addDays(selectedDate, -1);
    setSearchParams({ date: prev }, { replace: true });
  }, [selectedDate, setSearchParams]);

  const goToNextDay = useCallback(() => {
    const next = addDays(selectedDate, 1);
    setSearchParams({ date: next }, { replace: true });
  }, [selectedDate, setSearchParams]);

  const goToToday = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const { refreshSession } = useAuthContext();
  const { habitRepository, completionRepository } = useRepositories();
  const { habits, isLoading: habitsLoading, error: habitsError, refresh: refreshHabits } = useHabits(habitRepository);
  const { isCompleted, toggleCompletion, loading: completionsLoading, error: completionsError, refreshCompletions } = useCompletions(completionRepository, selectedDate, refreshSession);
  const { getStreak, getWeeklyProgress, refreshStreak } = useStreak(completionRepository, habits, todayStr);

  const dueHabits = useMemo(() => {
    const selectedDateObj = new Date(
      Number(selectedDate.slice(0, 4)),
      Number(selectedDate.slice(5, 7)) - 1,
      Number(selectedDate.slice(8, 10)),
    );
    return habits.filter((habit) => isDueOnDate(habit, selectedDateObj));
  }, [habits, selectedDate]);

  const sortedHabits = useMemo(() => {
    const incomplete = dueHabits.filter((h) => !isCompleted(h.id, selectedDate));
    const completed = dueHabits.filter((h) => isCompleted(h.id, selectedDate));

    const sortedIncomplete = [...incomplete].sort((a, b) => {
      if (a.reminderTime && b.reminderTime) {
        return a.reminderTime.localeCompare(b.reminderTime);
      }
      if (a.reminderTime) return -1;
      if (b.reminderTime) return 1;
      return 0;
    });

    return [...sortedIncomplete, ...completed];
  }, [dueHabits, isCompleted, selectedDate]);

  const completedCount = useMemo(
    () => dueHabits.filter((h) => isCompleted(h.id, selectedDate)).length,
    [dueHabits, isCompleted, selectedDate],
  );

  const isLoading = habitsLoading || completionsLoading;
  const error = habitsError ?? completionsError;

  const handleRetry = useCallback(() => {
    void refreshHabits();
    void refreshCompletions();
  }, [refreshHabits, refreshCompletions]);

  const pageTitle = isSelectedToday
    ? 'Today'
    : formatDisplayDate(selectedDate).split(' ')[0];

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <ErrorState message={error} onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
      </header>

      <DateNavigationHeader
        displayDate={displayDate}
        onPrevious={goToPreviousDay}
        onNext={goToNextDay}
      />

      {!isSelectedToday && (
        <div className="mb-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
          >
            今日に戻る
          </Button>
        </div>
      )}

      {dueHabits.length === 0 ? (
        <EmptyState selectedDate={selectedDate} />
      ) : (
        <>
          <div className="mb-4">
            <ProgressSummary
              completed={completedCount}
              total={dueHabits.length}
              displayDate={displayDate}
            />
          </div>
          <HabitList
            habits={sortedHabits}
            selectedDate={selectedDate}
            isCompleted={isCompleted}
            toggleCompletion={toggleCompletion}
            getStreak={getStreak}
            getWeeklyProgress={getWeeklyProgress}
            onStreakRefresh={refreshStreak}
            disabled={isSelectedFuture}
          />
        </>
      )}
    </div>
  );
}
