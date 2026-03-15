/**
 * TodayPage - Main screen for daily habit tracking.
 *
 * Displays today's date, the list of habits due today,
 * completion checkboxes, streak counts, and weekly progress.
 * Uses hooks for data access and domain services for business logic.
 */

import React, { useMemo, useCallback } from 'react';
import { useRepositories } from '@/hooks/useRepositories';
import { useHabits } from '@/hooks/useHabits';
import { useCompletions } from '@/hooks/useCompletions';
import { useStreak } from '@/hooks/useStreak';
import { isDueToday } from '@/domain/services/frequencyService';
import { HabitCard } from '@/ui/components/HabitCard';
import type { Habit } from '@/domain/models';

// --- Date Utilities ---

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekDay = weekDays[date.getDay()];
  return `${year}年${month}月${day}日 (${weekDay})`;
}

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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <p className="text-lg font-medium text-foreground">
        今日やるべき習慣はありません
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        新しい習慣を追加して、毎日のルーティンを始めましょう。
      </p>
    </div>
  );
}

// --- Habit List ---

type HabitListProps = {
  readonly habits: readonly Habit[];
  readonly today: string;
  readonly isCompleted: (habitId: string, date: string) => boolean;
  readonly toggleCompletion: (habitId: string, date: string) => Promise<void>;
  readonly getStreak: (habitId: string) => { readonly current: number; readonly longest: number };
  readonly getWeeklyProgress: (habitId: string) => { readonly done: number; readonly target: number };
  readonly onStreakRefresh: (habitId: string) => Promise<void>;
};

function HabitList({
  habits,
  today,
  isCompleted,
  toggleCompletion,
  getStreak,
  getWeeklyProgress,
  onStreakRefresh,
}: HabitListProps) {
  const handleToggle = useCallback(
    async (habitId: string) => {
      await toggleCompletion(habitId, today);
      await onStreakRefresh(habitId);
    },
    [toggleCompletion, today, onStreakRefresh],
  );

  return (
    <div className="flex flex-col gap-2">
      {habits.map((habit) => (
        <HabitCard
          key={habit.id}
          habit={habit}
          isCompleted={isCompleted(habit.id, today)}
          streak={getStreak(habit.id)}
          weeklyProgress={getWeeklyProgress(habit.id)}
          onToggle={() => void handleToggle(habit.id)}
        />
      ))}
    </div>
  );
}

// --- Progress Summary ---

function ProgressSummary({
  completed,
  total,
}: {
  readonly completed: number;
  readonly total: number;
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
        aria-label={`今日の進捗: ${completed}/${total}`}
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
  const today = useMemo(() => getTodayString(), []);
  const displayDate = useMemo(() => formatDisplayDate(today), [today]);

  const { habitRepository, completionRepository } = useRepositories();
  const { habits, isLoading: habitsLoading, error: habitsError, refresh: refreshHabits } = useHabits(habitRepository);
  const { isCompleted, toggleCompletion, loading: completionsLoading, error: completionsError } = useCompletions(completionRepository, today);
  const { getStreak, getWeeklyProgress, refreshStreak } = useStreak(completionRepository, habits, today);

  const todaysHabits = useMemo(() => {
    const todayDate = new Date(
      Number(today.slice(0, 4)),
      Number(today.slice(5, 7)) - 1,
      Number(today.slice(8, 10)),
    );
    return habits.filter((habit) => isDueToday(habit, todayDate));
  }, [habits, today]);

  const completedCount = useMemo(
    () => todaysHabits.filter((h) => isCompleted(h.id, today)).length,
    [todaysHabits, isCompleted, today],
  );

  const isLoading = habitsLoading || completionsLoading;
  const error = habitsError ?? completionsError;

  const handleRetry = useCallback(() => {
    void refreshHabits();
  }, [refreshHabits]);

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
        <h1 className="text-2xl font-bold text-foreground">Today</h1>
        <p className="mt-1 text-sm text-muted-foreground">{displayDate}</p>
      </header>

      {todaysHabits.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-4">
            <ProgressSummary
              completed={completedCount}
              total={todaysHabits.length}
            />
          </div>
          <HabitList
            habits={todaysHabits}
            today={today}
            isCompleted={isCompleted}
            toggleCompletion={toggleCompletion}
            getStreak={getStreak}
            getWeeklyProgress={getWeeklyProgress}
            onStreakRefresh={refreshStreak}
          />
        </>
      )}
    </div>
  );
}
