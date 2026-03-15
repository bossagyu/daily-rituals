import { z } from 'zod';

const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A record of a habit being completed on a specific date.
 * completedDate is in YYYY-MM-DD format.
 * createdAt is an ISO 8601 timestamp.
 */
export type Completion = {
  readonly id: string;
  readonly userId: string;
  readonly habitId: string;
  readonly completedDate: string;
  readonly createdAt: string;
};

export const completionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  habitId: z.string().min(1),
  completedDate: z.string().regex(DATE_FORMAT_REGEX, 'Must be in YYYY-MM-DD format'),
  createdAt: z.string().min(1),
});
