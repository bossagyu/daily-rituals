import type { Habit, Completion, Streak } from '../models';

const MS_PER_DAY = 86400000;

/**
 * Parse a YYYY-MM-DD date string into a Date object at midnight UTC.
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Format a Date to YYYY-MM-DD string.
 */
function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get the day before a given date string.
 */
function previousDay(dateStr: string): string {
  const date = parseDate(dateStr);
  return formatDate(new Date(date.getTime() - MS_PER_DAY));
}

/**
 * Get the Monday-based week start (ISO week) for a given date string.
 * Returns YYYY-MM-DD of the Monday of that week.
 */
function getWeekStart(dateStr: string): string {
  const date = parseDate(dateStr);
  const day = date.getUTCDay();
  // day: 0=Sun, 1=Mon, ..., 6=Sat
  // offset to Monday: Mon=0, Tue=-1, ..., Sun=-6
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date.getTime() + offsetToMonday * MS_PER_DAY);
  return formatDate(monday);
}

/**
 * Get the week start string for the week before the given week start.
 */
function previousWeekStart(weekStartStr: string): string {
  const date = parseDate(weekStartStr);
  return formatDate(new Date(date.getTime() - 7 * MS_PER_DAY));
}

/**
 * Build a Set of unique completion dates for a specific habit.
 */
function buildCompletionDateSet(
  habitId: string,
  completions: readonly Completion[],
): Set<string> {
  const dateSet = new Set<string>();
  for (const c of completions) {
    if (c.habitId === habitId) {
      dateSet.add(c.completedDate);
    }
  }
  return dateSet;
}

/**
 * Calculate the longest consecutive run in an array of run lengths.
 * Each run is separated by a break (value of 0 or missing).
 * Here we receive the sorted unique dates and compute runs manually.
 */
function computeAllStreaks(
  sortedDates: readonly string[],
  isConsecutive: (prev: string, curr: string) => boolean,
): { readonly runs: readonly number[] } {
  if (sortedDates.length === 0) {
    return { runs: [] };
  }

  const runs: number[] = [];
  let currentRun = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    if (isConsecutive(sortedDates[i - 1], sortedDates[i])) {
      currentRun++;
    } else {
      runs.push(currentRun);
      currentRun = 1;
    }
  }
  runs.push(currentRun);

  return { runs };
}

/**
 * Calculate streak for daily frequency.
 */
function calculateDailyStreak(
  habitId: string,
  completions: readonly Completion[],
  today: string,
): Streak {
  const dateSet = buildCompletionDateSet(habitId, completions);

  const totalDays = dateSet.size;

  if (totalDays === 0) {
    return Object.freeze({ current: 0, longest: 0, totalDays: 0 });
  }

  // Calculate current streak
  let current = 0;
  let checkDate = today;

  if (dateSet.has(today)) {
    current = 1;
    checkDate = previousDay(today);
  } else {
    // Today not completed - start checking from yesterday
    checkDate = previousDay(today);
  }

  while (dateSet.has(checkDate)) {
    current++;
    checkDate = previousDay(checkDate);
  }

  // Calculate longest streak from all completion dates
  const sortedDates = Array.from(dateSet).sort();
  const { runs } = computeAllStreaks(sortedDates, (prev, curr) => {
    return previousDay(curr) === prev;
  });

  const longest = Math.max(current, ...runs);

  return Object.freeze({ current, longest, totalDays });
}

/**
 * Get all target days between two dates (inclusive) for weekly_days frequency.
 */
function getTargetDaysBetween(
  startDate: string,
  endDate: string,
  targetDays: readonly number[],
): readonly string[] {
  const targetDaySet = new Set(targetDays);
  const result: string[] = [];
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  let current = new Date(start.getTime());
  while (current <= end) {
    if (targetDaySet.has(current.getUTCDay())) {
      result.push(formatDate(current));
    }
    current = new Date(current.getTime() + MS_PER_DAY);
  }

  return result;
}

/**
 * Calculate streak for weekly_days frequency.
 */
function calculateWeeklyDaysStreak(
  habitId: string,
  completions: readonly Completion[],
  today: string,
  targetDays: readonly number[],
): Streak {
  const dateSet = buildCompletionDateSet(habitId, completions);
  const totalDays = dateSet.size;

  if (totalDays === 0) {
    return Object.freeze({ current: 0, longest: 0, totalDays: 0 });
  }

  // Get all dates from sorted completions to find the range
  const allDates = Array.from(dateSet).sort();
  const earliestDate = allDates[0];

  // Generate all target days from earliest completion to today
  const allTargetDays = getTargetDaysBetween(earliestDate, today, targetDays);

  if (allTargetDays.length === 0) {
    return Object.freeze({ current: 0, longest: 0, totalDays });
  }

  // For current streak: walk backwards from the most recent target day
  // If today is a target day and not completed, we still allow streak from previous target days
  // (today hasn't ended yet)
  let current = 0;
  const todayDate = parseDate(today);
  const todayDayOfWeek = todayDate.getUTCDay();
  const isTodayTargetDay = new Set(targetDays).has(todayDayOfWeek);

  // Find starting index for current streak calculation
  let startIdx = allTargetDays.length - 1;

  // If today is a target day but not completed, skip it (today hasn't ended)
  if (isTodayTargetDay && !dateSet.has(today) && allTargetDays[startIdx] === today) {
    startIdx--;
  }

  // Walk backwards counting consecutive completed target days
  for (let i = startIdx; i >= 0; i--) {
    if (dateSet.has(allTargetDays[i])) {
      current++;
    } else {
      break;
    }
  }

  // Calculate longest from all target days
  const targetDayRuns: number[] = [];
  let run = 0;
  for (const targetDay of allTargetDays) {
    if (dateSet.has(targetDay)) {
      run++;
    } else {
      if (run > 0) {
        targetDayRuns.push(run);
      }
      run = 0;
    }
  }
  if (run > 0) {
    targetDayRuns.push(run);
  }

  // If today is a target day but not completed, the last run might be ongoing
  // We need to handle this: if today is the last target day and not completed,
  // the current streak already accounts for skipping it
  const longest = Math.max(current, ...targetDayRuns, 0);

  return Object.freeze({ current, longest, totalDays });
}

/**
 * Count completions for a habit in a specific week (identified by week start).
 */
function countCompletionsInWeek(
  weekStart: string,
  dateSet: Set<string>,
): number {
  let count = 0;
  const start = parseDate(weekStart);
  for (let i = 0; i < 7; i++) {
    const day = formatDate(new Date(start.getTime() + i * MS_PER_DAY));
    if (dateSet.has(day)) {
      count++;
    }
  }
  return count;
}

/**
 * Calculate streak for weekly_count frequency.
 */
function calculateWeeklyCountStreak(
  habitId: string,
  completions: readonly Completion[],
  today: string,
  targetCount: number,
): Streak {
  const dateSet = buildCompletionDateSet(habitId, completions);
  const totalDays = dateSet.size;

  if (totalDays === 0) {
    return Object.freeze({ current: 0, longest: 0, totalDays: 0 });
  }

  const allDates = Array.from(dateSet).sort();
  const earliestDate = allDates[0];
  const earliestWeekStart = getWeekStart(earliestDate);
  const currentWeekStart = getWeekStart(today);

  // Build list of weeks from earliest to current
  const weeks: string[] = [];
  let ws = earliestWeekStart;
  while (ws <= currentWeekStart) {
    weeks.push(ws);
    ws = formatDate(new Date(parseDate(ws).getTime() + 7 * MS_PER_DAY));
  }

  // Determine which weeks met the target
  const weekMet: boolean[] = weeks.map(
    (w) => countCompletionsInWeek(w, dateSet) >= targetCount,
  );

  // Current streak: walk backwards from the most recent week
  let current = 0;
  for (let i = weekMet.length - 1; i >= 0; i--) {
    if (weekMet[i]) {
      current++;
    } else {
      // If this is the current week and target not yet met, skip it
      // (week hasn't ended yet) and continue from previous week
      if (i === weekMet.length - 1 && weeks[i] === currentWeekStart) {
        continue;
      }
      break;
    }
  }

  // Longest streak
  let longest = 0;
  let run = 0;
  for (const met of weekMet) {
    if (met) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  longest = Math.max(longest, current);

  return Object.freeze({ current, longest, totalDays });
}

/**
 * Calculate the current and longest streak for a habit based on its completions.
 *
 * This is a pure function with no side effects.
 *
 * @param habit - The habit to calculate the streak for
 * @param completions - All completion records (may include other habits)
 * @param today - Today's date in YYYY-MM-DD format
 * @returns A frozen Streak object with current and longest values
 */
export function calculateStreak(
  habit: Habit,
  completions: readonly Completion[],
  today: string,
): Streak {
  switch (habit.frequency.type) {
    case 'daily':
      return calculateDailyStreak(habit.id, completions, today);
    case 'weekly_days':
      return calculateWeeklyDaysStreak(
        habit.id,
        completions,
        today,
        habit.frequency.days,
      );
    case 'weekly_count':
      return calculateWeeklyCountStreak(
        habit.id,
        completions,
        today,
        habit.frequency.count,
      );
  }
}
