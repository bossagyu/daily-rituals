import { z } from 'zod';

export const TASK_NAME_MAX_LENGTH = 100;

/**
 * A task that the user wants to complete.
 * completedAt is null when pending, or an ISO timestamp when completed.
 */
export type Task = {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly dueDate: string | null;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export const taskSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().trim().min(1).max(TASK_NAME_MAX_LENGTH),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((s) => !isNaN(new Date(s + 'T00:00:00').getTime()), {
      message: 'Invalid date',
    })
    .nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type CreateTaskInput = {
  readonly name: string;
  readonly dueDate: string | null;
};

export type UpdateTaskInput = {
  readonly name?: string;
  readonly dueDate?: string | null;
};
