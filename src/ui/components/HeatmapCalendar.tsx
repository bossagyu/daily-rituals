/**
 * HeatmapCalendar - Calendar grid with heatmap coloring for habit completion.
 *
 * Displays a month grid with color-coded cells based on completion rate.
 * Uses shadcn/ui Popover for day cell detail display.
 * Supports "all" mode (shows completed habit names) and "habit" mode (shows done/not done).
 */

import React, { useMemo } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { CalendarDay, DayAchievement, HeatmapLevel } from '@/domain/services/calendarService';
import { getHeatmapLevel } from '@/domain/services/calendarService';
import { cn } from '@/lib/utils';

// --- Types ---

type HeatmapCalendarProps = {
  readonly calendarGrid: readonly CalendarDay[];
  readonly achievements: readonly DayAchievement[];
  readonly filterMode: 'all' | 'habit';
  readonly selectedHabitColor?: string;
};

// --- Constants ---

const DAY_HEADERS = ['日', '月', '火', '水', '木', '金', '土'] as const;

const HEATMAP_CLASSES: Record<HeatmapLevel, string> = {
  0: 'bg-muted text-muted-foreground',
  1: 'bg-primary/20 text-foreground',
  2: 'bg-primary/50 text-white',
  3: 'bg-primary/75 text-white',
  4: 'bg-primary text-white',
};

// --- Utilities ---

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function isFutureDate(dateStr: string, today: string): boolean {
  return dateStr > today;
}

function getHeatmapStyle(
  level: HeatmapLevel,
  filterMode: 'all' | 'habit',
  selectedHabitColor?: string,
): { className?: string; style?: React.CSSProperties } {
  if (filterMode === 'habit' && selectedHabitColor && level > 0) {
    const opacity = level === 1 ? 0.3 : level === 2 ? 0.5 : level === 3 ? 0.7 : 1;
    return {
      className: level >= 2 ? 'text-white' : 'text-foreground',
      style: { backgroundColor: selectedHabitColor, opacity },
    };
  }
  return { className: HEATMAP_CLASSES[level] };
}

// --- Sub-components ---

function DayHeader() {
  return (
    <div className="mb-1 grid grid-cols-7 gap-1">
      {DAY_HEADERS.map((day) => (
        <div
          key={day}
          className="text-center text-xs font-medium text-muted-foreground"
        >
          {day}
        </div>
      ))}
    </div>
  );
}

function PopoverContentAll({
  achievement,
  dateStr,
}: {
  readonly achievement: DayAchievement;
  readonly dateStr: string;
}) {
  return (
    <>
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        {dateStr}
      </p>
      {achievement.completedHabitNames.length === 0 ? (
        <p className="text-xs text-muted-foreground">完了した習慣はありません</p>
      ) : (
        <ul className="space-y-0.5">
          {achievement.completedHabitNames.map((name) => (
            <li key={name} className="text-xs">
              {name}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">
        {achievement.completedCount}/{achievement.targetCount} 完了
      </p>
    </>
  );
}

function PopoverContentHabit({
  achievement,
  dateStr,
}: {
  readonly achievement: DayAchievement;
  readonly dateStr: string;
}) {
  return (
    <>
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        {dateStr}
      </p>
      <p className="text-sm font-medium">
        {achievement.completedCount > 0 ? '完了' : '未完了'}
      </p>
    </>
  );
}

function DayCell({
  day,
  achievement,
  filterMode,
  selectedHabitColor,
  today,
}: {
  readonly day: CalendarDay;
  readonly achievement: DayAchievement | undefined;
  readonly filterMode: 'all' | 'habit';
  readonly selectedHabitColor?: string;
  readonly today: string;
}) {
  const isFuture = isFutureDate(day.date, today);
  const isNonCurrentMonth = !day.isCurrentMonth;
  const isToday = day.date === today;

  if (isFuture || isNonCurrentMonth) {
    return (
      <div
        className={cn(
          'flex aspect-square items-center justify-center rounded-sm text-xs',
          'bg-muted/30 text-muted-foreground/40',
        )}
      >
        {day.dayOfMonth}
      </div>
    );
  }

  if (!achievement || !achievement.isTargetDay) {
    return (
      <div
        className={cn(
          'flex aspect-square items-center justify-center rounded-sm text-xs',
          'bg-muted/50 text-muted-foreground/60',
        )}
      >
        {day.dayOfMonth}
      </div>
    );
  }

  const level = getHeatmapLevel(achievement.rate);
  const heatmapStyle = getHeatmapStyle(level, filterMode, selectedHabitColor);

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'flex aspect-square w-full items-center justify-center rounded-sm text-xs font-medium transition-colors cursor-pointer',
          heatmapStyle.className,
          isToday && 'ring-2 ring-primary ring-offset-1',
        )}
        style={heatmapStyle.style}
      >
        {day.dayOfMonth}
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3">
        {filterMode === 'all' ? (
          <PopoverContentAll achievement={achievement} dateStr={day.date} />
        ) : (
          <PopoverContentHabit achievement={achievement} dateStr={day.date} />
        )}
      </PopoverContent>
    </Popover>
  );
}

// --- Main Component ---

export function HeatmapCalendar({
  calendarGrid,
  achievements,
  filterMode,
  selectedHabitColor,
}: HeatmapCalendarProps) {
  const today = useMemo(() => getTodayString(), []);

  const achievementMap = useMemo(() => {
    const map = new Map<string, DayAchievement>();
    for (const a of achievements) {
      map.set(a.date, a);
    }
    return map;
  }, [achievements]);

  return (
    <div>
      <DayHeader />
      <div className="grid grid-cols-7 gap-1">
        {calendarGrid.map((day) => (
          <DayCell
            key={day.date}
            day={day}
            achievement={achievementMap.get(day.date)}
            filterMode={filterMode}
            selectedHabitColor={selectedHabitColor}
            today={today}
          />
        ))}
      </div>
    </div>
  );
}
