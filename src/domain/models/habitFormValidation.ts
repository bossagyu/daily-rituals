/**
 * HabitForm validation logic using Zod.
 *
 * Validates user input for creating/editing habits.
 * Separated from the main habit schema to keep form-specific
 * validation concerns isolated.
 */

import { z } from 'zod';

// --- Constants ---

const HABIT_NAME_MAX_LENGTH = 100;
const WEEKLY_COUNT_MIN = 1;
const WEEKLY_COUNT_MAX = 7;
const DAY_MIN = 0;
const DAY_MAX = 6;

export const PRESET_COLORS = [
  '#4CAF50',
  '#2196F3',
  '#FF9800',
  '#E91E63',
  '#9C27B0',
  '#00BCD4',
  '#FF5722',
  '#607D8B',
] as const;

export const FREQUENCY_TYPES = ['daily', 'weekly_days', 'weekly_count'] as const;

export type FrequencyType = (typeof FREQUENCY_TYPES)[number];

export const FREQUENCY_TYPE_LABELS: Record<FrequencyType, string> = {
  daily: '毎日',
  weekly_days: '特定曜日',
  weekly_count: '週N回',
};

export const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

// --- Form state type ---

export type HabitFormState = {
  readonly name: string;
  readonly frequencyType: FrequencyType;
  readonly weeklyDays: readonly number[];
  readonly weeklyCount: number;
  readonly color: string;
};

export const INITIAL_FORM_STATE: HabitFormState = {
  name: '',
  frequencyType: 'daily',
  weeklyDays: [],
  weeklyCount: 1,
  color: PRESET_COLORS[0],
};

// --- Validation schemas ---

const baseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '習慣名を入力してください')
    .max(HABIT_NAME_MAX_LENGTH, `習慣名は${HABIT_NAME_MAX_LENGTH}文字以内で入力してください`),
  color: z.string().min(1, '色を選択してください'),
});

const dailyFormSchema = baseSchema.extend({
  frequencyType: z.literal('daily'),
});

const weeklyDaysFormSchema = baseSchema.extend({
  frequencyType: z.literal('weekly_days'),
  weeklyDays: z
    .array(z.number().int().min(DAY_MIN).max(DAY_MAX))
    .min(1, '曜日を1つ以上選択してください'),
});

const weeklyCountFormSchema = baseSchema.extend({
  frequencyType: z.literal('weekly_count'),
  weeklyCount: z
    .number()
    .int()
    .min(WEEKLY_COUNT_MIN, `回数は${WEEKLY_COUNT_MIN}以上にしてください`)
    .max(WEEKLY_COUNT_MAX, `回数は${WEEKLY_COUNT_MAX}以下にしてください`),
});

// --- Validation function ---

export type ValidationResult =
  | { readonly isValid: true; readonly errors: Record<string, never> }
  | { readonly isValid: false; readonly errors: Readonly<Record<string, string>> };

/**
 * Validates a HabitFormState and returns structured validation errors.
 */
export function validateHabitForm(state: HabitFormState): ValidationResult {
  const schema = getSchemaForFrequencyType(state.frequencyType);
  const dataToValidate = buildValidationData(state);

  const result = schema.safeParse(dataToValidate);

  if (result.success) {
    return { isValid: true, errors: {} };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) {
      errors[field] = issue.message;
    }
  }

  return { isValid: false, errors };
}

function getSchemaForFrequencyType(type: FrequencyType): z.ZodType {
  switch (type) {
    case 'daily':
      return dailyFormSchema;
    case 'weekly_days':
      return weeklyDaysFormSchema;
    case 'weekly_count':
      return weeklyCountFormSchema;
  }
}

function buildValidationData(
  state: HabitFormState
): Record<string, unknown> {
  const base = {
    name: state.name,
    color: state.color,
    frequencyType: state.frequencyType,
  };

  switch (state.frequencyType) {
    case 'daily':
      return base;
    case 'weekly_days':
      return { ...base, weeklyDays: [...state.weeklyDays] };
    case 'weekly_count':
      return { ...base, weeklyCount: state.weeklyCount };
  }
}

// --- Conversion to CreateHabitInput ---

import type { CreateHabitInput } from './habit';

/**
 * Converts a validated HabitFormState to a CreateHabitInput.
 * Should only be called after validateHabitForm returns isValid: true.
 */
export function toCreateHabitInput(state: HabitFormState): CreateHabitInput {
  return {
    name: state.name.trim(),
    frequency: toFrequencyForInput(state),
    color: state.color,
  };
}

/**
 * Builds a frequency object compatible with CreateHabitInput (Zod-inferred type).
 * Zod infers mutable arrays, so we use number[] instead of readonly number[].
 */
function toFrequencyForInput(
  state: HabitFormState
): CreateHabitInput['frequency'] {
  switch (state.frequencyType) {
    case 'daily':
      return { type: 'daily' as const };
    case 'weekly_days':
      return {
        type: 'weekly_days' as const,
        days: [...state.weeklyDays],
      };
    case 'weekly_count':
      return { type: 'weekly_count' as const, count: state.weeklyCount };
  }
}

// --- Conversion from Habit to form state ---

import type { Habit } from './habit';

/**
 * Converts an existing Habit to a HabitFormState for editing.
 */
export function habitToFormState(habit: Habit): HabitFormState {
  switch (habit.frequency.type) {
    case 'daily':
      return {
        name: habit.name,
        frequencyType: 'daily',
        weeklyDays: [],
        weeklyCount: 1,
        color: habit.color,
      };
    case 'weekly_days':
      return {
        name: habit.name,
        frequencyType: 'weekly_days',
        weeklyDays: [...habit.frequency.days],
        weeklyCount: 1,
        color: habit.color,
      };
    case 'weekly_count':
      return {
        name: habit.name,
        frequencyType: 'weekly_count',
        weeklyDays: [],
        weeklyCount: habit.frequency.count,
        color: habit.color,
      };
  }
}
