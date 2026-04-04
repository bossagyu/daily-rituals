/**
 * TodayHabitCard - Habit card for the Today page with checkbox, streak, and weekly progress.
 */

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Habit } from '@/domain/models/habit';
import type { Streak } from '@/domain/models/streak';
import { utcToLocalTime, getBrowserTimezoneOffset } from '@/lib/reminderTime';

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
  readonly disabled?: boolean;
};

export function TodayHabitCard({
  habit,
  isCompleted,
  streak,
  weeklyProgress,
  onToggle,
  disabled = false,
}: TodayHabitCardProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 shadow-sm transition-all ${
        isCompleted
          ? 'border-emerald-500/20 bg-emerald-500/5'
          : 'border-border bg-card hover:border-primary/20'
      }${disabled ? ' opacity-60' : ''}`}
    >
      <div
        className="h-4 w-4 shrink-0 rounded-full"
        style={{ backgroundColor: habit.color }}
        aria-hidden="true"
      />

      <Checkbox
        checked={isCompleted}
        onCheckedChange={disabled ? undefined : onToggle}
        disabled={disabled}
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
          {streak.current > 0 && streak.totalDays > 0 && (
            <span className="font-medium text-primary">
              {streak.current}日連続 / 計{streak.totalDays}日
            </span>
          )}
          {streak.current === 0 && streak.totalDays > 0 && (
            <span className="font-medium text-primary">
              計{streak.totalDays}日
            </span>
          )}
          {habit.frequency.type === 'weekly_count' && (
            <span>
              今週 {weeklyProgress.done}/{weeklyProgress.target}
            </span>
          )}
          {habit.reminderTime && (
            <span>
              通知 {utcToLocalTime(habit.reminderTime.substring(0, 5), getBrowserTimezoneOffset())}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
