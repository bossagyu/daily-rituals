import { z } from 'zod';

/**
 * Represents a habit's streak information.
 * current: the number of consecutive periods the habit has been completed.
 * longest: the longest streak ever achieved for this habit.
 */
export type Streak = {
  readonly current: number;
  readonly longest: number;
};

export const streakSchema = z.object({
  current: z.number().int().min(0),
  longest: z.number().int().min(0),
});
