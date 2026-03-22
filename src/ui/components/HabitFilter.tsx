/**
 * HabitFilter - Filter buttons for calendar heatmap view.
 *
 * Shows "すべて" (all) button and individual habit buttons.
 * Archived habits are labeled with "(アーカイブ)" and shown with reduced opacity.
 */

import React from 'react';
import type { Habit } from '@/domain/models';
import type { CalendarFilter } from '@/hooks/useCalendarData';
import { cn } from '@/lib/utils';

type HabitFilterProps = {
  readonly habits: readonly Habit[];
  readonly filter: CalendarFilter;
  readonly onFilterChange: (filter: CalendarFilter) => void;
};

function FilterButton({
  label,
  isSelected,
  color,
  isArchived,
  onClick,
}: {
  readonly label: string;
  readonly isSelected: boolean;
  readonly color?: string;
  readonly isArchived?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        isSelected
          ? 'text-white shadow-sm'
          : 'bg-muted text-muted-foreground hover:bg-muted/80',
        isArchived && !isSelected && 'opacity-60',
      )}
      style={
        isSelected
          ? { backgroundColor: color ?? 'hsl(var(--primary))' }
          : undefined
      }
      onClick={onClick}
    >
      {label}
      {isArchived && (
        <span className="ml-1 text-[10px] opacity-70">(アーカイブ)</span>
      )}
    </button>
  );
}

export function HabitFilter({
  habits,
  filter,
  onFilterChange,
}: HabitFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterButton
        label="すべて"
        isSelected={filter.mode === 'all'}
        onClick={() => onFilterChange({ mode: 'all' })}
      />
      {habits.map((habit) => (
        <FilterButton
          key={habit.id}
          label={habit.name}
          isSelected={
            filter.mode === 'habit' && filter.habitId === habit.id
          }
          color={habit.color}
          isArchived={habit.archivedAt !== null}
          onClick={() =>
            onFilterChange({ mode: 'habit', habitId: habit.id })
          }
        />
      ))}
    </div>
  );
}
