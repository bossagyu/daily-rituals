/**
 * HabitCard - Displays a single habit with name, frequency, color, and action buttons.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { Habit } from '@/domain/models/habit';
import { formatFrequency } from '@/domain/services/frequencyDisplayService';

type HabitCardProps = {
  readonly habit: Habit;
  readonly onArchive: (id: string) => void;
  readonly isArchived: boolean;
};

export function HabitCard({ habit, onArchive, isArchived }: HabitCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30">
      <div
        className="h-4 w-4 shrink-0 rounded-full"
        style={{ backgroundColor: habit.color }}
        aria-hidden="true"
      />

      <Link
        to={`/habits/${habit.id}`}
        className="flex min-w-0 flex-1 flex-col"
      >
        <span
          className={`text-sm font-medium ${isArchived ? 'text-muted-foreground line-through' : 'text-foreground'}`}
        >
          {habit.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatFrequency(habit.frequency)}
        </span>
      </Link>

      {isArchived && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onArchive(habit.id)}
          aria-label={`${habit.name}をアーカイブ解除`}
        >
          復元
        </Button>
      )}
    </div>
  );
}
