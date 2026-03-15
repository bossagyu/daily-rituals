/**
 * HabitCard - Displays a single habit with completion checkbox,
 * streak information, and weekly progress.
 */

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { formatFrequencyShort } from '@/domain/services/frequencyDisplayService';
import type { Habit, Streak } from '@/domain/models';
import type { WeeklyProgress } from '@/domain/services/frequencyService';
import { cn } from '@/lib/utils';

type HabitCardProps = {
  readonly habit: Habit;
  readonly isCompleted: boolean;
  readonly streak: Streak;
  readonly weeklyProgress: WeeklyProgress;
  readonly onToggle: () => void;
  readonly isToggling?: boolean;
};

const COLOR_BORDER_MAP: Record<string, string> = {
  red: 'border-l-red-500',
  blue: 'border-l-blue-500',
  green: 'border-l-green-500',
  yellow: 'border-l-yellow-500',
  purple: 'border-l-purple-500',
  pink: 'border-l-pink-500',
  orange: 'border-l-orange-500',
  teal: 'border-l-teal-500',
  cyan: 'border-l-cyan-500',
  indigo: 'border-l-indigo-500',
};

function getColorBorderClass(color: string): string {
  return COLOR_BORDER_MAP[color] ?? 'border-l-gray-500';
}

function StreakBadge({ current }: { readonly current: number }) {
  if (current === 0) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
      aria-label={`${current}日連続`}
    >
      <span aria-hidden="true">&#128293;</span>
      {current}
    </span>
  );
}

function WeeklyProgressBar({
  progress,
}: {
  readonly progress: WeeklyProgress;
}) {
  if (progress.target === 0) {
    return null;
  }

  const percentage = Math.min(
    Math.round((progress.done / progress.target) * 100),
    100,
  );

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={progress.done}
        aria-valuemin={0}
        aria-valuemax={progress.target}
        aria-label={`今週の進捗: ${progress.done}/${progress.target}`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {progress.done}/{progress.target}
      </span>
    </div>
  );
}

export function HabitCard({
  habit,
  isCompleted,
  streak,
  weeklyProgress,
  onToggle,
  isToggling = false,
}: HabitCardProps) {
  const borderClass = getColorBorderClass(habit.color);
  const frequencyLabel = formatFrequencyShort(habit.frequency);

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors',
        'border-l-4',
        borderClass,
        isCompleted && 'bg-muted/50 opacity-80',
      )}
      data-testid={`habit-card-${habit.id}`}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={onToggle}
        disabled={isToggling}
        aria-label={`${habit.name}を${isCompleted ? '未完了にする' : '完了にする'}`}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'truncate text-sm font-medium',
              isCompleted && 'text-muted-foreground line-through',
            )}
          >
            {habit.name}
          </span>
          <StreakBadge current={streak.current} />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{frequencyLabel}</span>
          <WeeklyProgressBar progress={weeklyProgress} />
        </div>
      </div>
    </div>
  );
}
