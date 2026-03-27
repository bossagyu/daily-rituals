/**
 * TodayPage - Main screen for daily habit and task tracking with date navigation.
 *
 * Displays the selected date's habits and tasks, completion checkboxes,
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
import { useTasks } from '@/hooks/useTasks';
import { isDueOnDate } from '@/domain/services/frequencyService';
import { TodayHabitCard } from '@/ui/components/TodayHabitCard';
import { TaskCard } from '@/ui/components/TaskCard';
import { TaskInlineInput } from '@/ui/components/TaskInlineInput';
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
import type { Task } from '@/domain/models/task';

// --- Unified list item type ---

type TodayItem =
  | { readonly type: 'habit'; readonly habit: Habit; readonly isCompleted: boolean }
  | { readonly type: 'task'; readonly task: Task };

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
      return '今日やるべきことはありません';
    }
    if (isFutureDate(selectedDate)) {
      return 'この日にやるべきことはありません';
    }
    return 'この日にやるべきことはありませんでした';
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

// --- Sorting helpers ---

function buildTodayItems(
  dueHabits: readonly Habit[],
  tasks: readonly Task[],
  isCompleted: (habitId: string, date: string) => boolean,
  selectedDate: string,
): readonly TodayItem[] {
  // 1. Incomplete habits (by reminder time, then no-reminder at end)
  const incompleteHabits = dueHabits
    .filter((h) => !isCompleted(h.id, selectedDate))
    .map((habit): TodayItem => ({ type: 'habit', habit, isCompleted: false }));

  const sortedIncompleteHabits = [...incompleteHabits].sort((a, b) => {
    if (a.type !== 'habit' || b.type !== 'habit') return 0;
    const aTime = a.habit.reminderTime;
    const bTime = b.habit.reminderTime;
    if (aTime && bTime) return aTime.localeCompare(bTime);
    if (aTime) return -1;
    if (bTime) return 1;
    return 0;
  });

  // 2. Incomplete tasks (due-date tasks first, then no-date, by created_at ascending)
  const incompleteTasks = tasks
    .filter((t) => t.completedAt === null)
    .map((task): TodayItem => ({ type: 'task', task }));

  const sortedIncompleteTasks = [...incompleteTasks].sort((a, b) => {
    if (a.type !== 'task' || b.type !== 'task') return 0;
    const aDue = a.task.dueDate;
    const bDue = b.task.dueDate;
    if (aDue && !bDue) return -1;
    if (!aDue && bDue) return 1;
    return a.task.createdAt.localeCompare(b.task.createdAt);
  });

  // 3. Completed habits (original order)
  const completedHabits = dueHabits
    .filter((h) => isCompleted(h.id, selectedDate))
    .map((habit): TodayItem => ({ type: 'habit', habit, isCompleted: true }));

  // 4. Completed tasks (by completed_at descending)
  const completedTasks = tasks
    .filter((t) => t.completedAt !== null)
    .map((task): TodayItem => ({ type: 'task', task }));

  const sortedCompletedTasks = [...completedTasks].sort((a, b) => {
    if (a.type !== 'task' || b.type !== 'task') return 0;
    return (b.task.completedAt ?? '').localeCompare(a.task.completedAt ?? '');
  });

  return [
    ...sortedIncompleteHabits,
    ...sortedIncompleteTasks,
    ...completedHabits,
    ...sortedCompletedTasks,
  ];
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
  const { habitRepository, completionRepository, taskRepository } = useRepositories();
  const { habits, isLoading: habitsLoading, error: habitsError, refresh: refreshHabits } = useHabits(habitRepository);
  const { isCompleted, toggleCompletion, loading: completionsLoading, error: completionsError, refreshCompletions } = useCompletions(completionRepository, selectedDate, refreshSession);
  const { getStreak, getWeeklyProgress, refreshStreak } = useStreak(completionRepository, habits, todayStr);
  const {
    tasks,
    isLoading: tasksLoading,
    error: tasksError,
    createTask,
    updateTask,
    removeTask,
    completeTask,
    uncompleteTask,
  } = useTasks(taskRepository, selectedDate);

  const dueHabits = useMemo(() => {
    const selectedDateObj = new Date(
      Number(selectedDate.slice(0, 4)),
      Number(selectedDate.slice(5, 7)) - 1,
      Number(selectedDate.slice(8, 10)),
    );
    return habits.filter((habit) => isDueOnDate(habit, selectedDateObj));
  }, [habits, selectedDate]);

  const todayItems = useMemo(
    () => buildTodayItems(dueHabits, tasks, isCompleted, selectedDate),
    [dueHabits, tasks, isCompleted, selectedDate],
  );

  const completedHabitCount = useMemo(
    () => dueHabits.filter((h) => isCompleted(h.id, selectedDate)).length,
    [dueHabits, isCompleted, selectedDate],
  );

  const completedTaskCount = useMemo(
    () => tasks.filter((t) => t.completedAt !== null).length,
    [tasks],
  );

  const totalCount = dueHabits.length + tasks.length;
  const completedCount = completedHabitCount + completedTaskCount;

  const isLoading = habitsLoading || completionsLoading || tasksLoading;
  const error = habitsError ?? completionsError ?? tasksError;

  const handleRetry = useCallback(() => {
    void refreshHabits();
    void refreshCompletions();
  }, [refreshHabits, refreshCompletions]);

  const handleToggleHabit = useCallback(
    async (habitId: string) => {
      await toggleCompletion(habitId, selectedDate);
      await refreshStreak(habitId);
    },
    [toggleCompletion, selectedDate, refreshStreak],
  );

  const isEmpty = dueHabits.length === 0 && tasks.length === 0;

  const pageTitle = isSelectedToday
    ? 'Today'
    : formatDisplayDate(selectedDate).split(' ')[0];

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

      {error && <ErrorState message={error} onRetry={handleRetry} />}

      {isLoading ? (
        <LoadingState />
      ) : isEmpty ? (
        <EmptyState selectedDate={selectedDate} />
      ) : (
        <>
          <div className="mb-4">
            <ProgressSummary
              completed={completedCount}
              total={totalCount}
              displayDate={displayDate}
            />
          </div>
          <div className="flex flex-col gap-2">
            {todayItems.map((item) =>
              item.type === 'task' ? (
                <TaskCard
                  key={`task-${item.task.id}`}
                  task={item.task}
                  disabled={isSelectedFuture}
                  onToggleComplete={(id) =>
                    item.task.completedAt !== null
                      ? void uncompleteTask(id)
                      : void completeTask(id)
                  }
                  onUpdate={(id, input) => void updateTask(id, input)}
                  onRemove={(id) => void removeTask(id)}
                />
              ) : (
                <TodayHabitCard
                  key={`habit-${item.habit.id}`}
                  habit={item.habit}
                  isCompleted={item.isCompleted}
                  streak={getStreak(item.habit.id)}
                  weeklyProgress={getWeeklyProgress(item.habit.id)}
                  onToggle={() => void handleToggleHabit(item.habit.id)}
                  disabled={isSelectedFuture}
                />
              ),
            )}
          </div>
        </>
      )}

      <div className="mt-4">
        <TaskInlineInput onAdd={(name) => void createTask({ name, dueDate: null })} />
      </div>
    </div>
  );
}
