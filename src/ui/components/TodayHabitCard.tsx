/**
 * TodayHabitCard - Habit card for the Today page with checkbox, streak, and weekly progress.
 */

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Habit } from '@/domain/models/habit';
import type { Streak } from '@/domain/models/streak';

type WeeklyProgress = {
  readonly done: number;
  readonly target: number;
};

export type TodayHabitCardProps = {
  readonly habit: Habit;
  readonly isCompleted: boolean;
  readonly streak: Streak;
  readonly weeklyProgress: WeeklyProgress;
  readonly onToggle: () => void;
};

export function TodayHabitCard({
  habit,
  isCompleted,
  streak,
  weeklyProgress,
  onToggle,
}: TodayHabitCardProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-4 shadow-sm transition-colors ${
        isCompleted
          ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
          : 'border-border bg-card'
      }`}
    >
      <div
        className="h-4 w-4 shrink-0 rounded-full"
        style={{ backgroundColor: habit.color }}
        aria-hidden="true"
      />

      <Checkbox
        checked={isCompleted}
        onCheckedChange={onToggle}
        aria-label={`${habit.name}を${isCompleted ? '未完了に' : '完了に'}する`}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={`text-sm font-medium ${
            isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'
          }`}
        >
          {habit.name}
        </span>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {streak.current > 0 && (
            <span className="font-medium text-orange-500">
              {streak.current}日連続
            </span>
          )}
          {habit.frequency.type === 'weekly_count' && (
            <span>
              今週 {weeklyProgress.done}/{weeklyProgress.target}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
