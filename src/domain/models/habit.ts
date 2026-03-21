import { z } from 'zod';

/**
 * Daily frequency - habit should be performed every day.
 */
export type DailyFrequency = {
  readonly type: 'daily';
};

/**
 * Weekly days frequency - habit should be performed on specific days of the week.
 * Days are represented as numbers: 0=Sunday, 1=Monday, ..., 6=Saturday.
 */
export type WeeklyDaysFrequency = {
  readonly type: 'weekly_days';
  readonly days: readonly number[];
};

/**
 * Weekly count frequency - habit should be performed N times per week.
 */
export type WeeklyCountFrequency = {
  readonly type: 'weekly_count';
  readonly count: number;
};

/**
 * Discriminated union representing how often a habit should be performed.
 */
export type Frequency = DailyFrequency | WeeklyDaysFrequency | WeeklyCountFrequency;

/**
 * A habit that the user wants to track.
 * archivedAt is null when the habit is active, or an ISO timestamp when archived.
 */
export type Habit = {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly frequency: Frequency;
  readonly color: string;
  readonly createdAt: string;
  readonly archivedAt: string | null;
  readonly reminderTime: string | null;
  readonly lastNotifiedDate: string | null;
};

// --- Zod Schemas ---

const DAY_MIN = 0;
const DAY_MAX = 6;
const WEEKLY_COUNT_MIN = 1;
const WEEKLY_COUNT_MAX = 7;
const HABIT_NAME_MAX_LENGTH = 100;

const dailyFrequencySchema = z.object({
  type: z.literal('daily'),
});

const weeklyDaysFrequencySchema = z.object({
  type: z.literal('weekly_days'),
  days: z
    .array(z.number().int().min(DAY_MIN).max(DAY_MAX))
    .min(1),
});

const weeklyCountFrequencySchema = z.object({
  type: z.literal('weekly_count'),
  count: z.number().int().min(WEEKLY_COUNT_MIN).max(WEEKLY_COUNT_MAX),
});

export const frequencySchema = z.discriminatedUnion('type', [
  dailyFrequencySchema,
  weeklyDaysFrequencySchema,
  weeklyCountFrequencySchema,
]);

export const habitSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1).max(HABIT_NAME_MAX_LENGTH),
  frequency: frequencySchema,
  color: z.string().min(1),
  createdAt: z.string().min(1),
  archivedAt: z.string().nullable(),
  reminderTime: z.string().nullable().default(null),
  lastNotifiedDate: z.string().nullable().default(null),
});

/**
 * Schema for validating user input when creating a new habit.
 * Does not include id, createdAt, or archivedAt as those are system-generated.
 */
export const createHabitInputSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(HABIT_NAME_MAX_LENGTH),
  frequency: frequencySchema,
  color: z.string().min(1),
});

export type CreateHabitInput = z.infer<typeof createHabitInputSchema>;
