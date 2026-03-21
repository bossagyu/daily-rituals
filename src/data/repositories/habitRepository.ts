/**
 * HabitRepository - Interface and mapper functions for habit persistence.
 *
 * The interface defines CRUD operations for habits.
 * Mapper functions (toFrequency, toFrequencyDbFields) are retained as pure utilities
 * usable by any future storage backend implementation.
 */

import type { Habit, Frequency, CreateHabitInput } from '../../domain/models';

// --- Types ---

/**
 * Input type for updating an existing habit.
 * All fields are optional; only provided fields will be updated.
 */
export type UpdateHabitInput = Partial<CreateHabitInput> & {
  readonly reminderTime?: string | null;
};

// --- Mapper functions ---

/**
 * Converts DB frequency_type and frequency_value to a domain Frequency object.
 *
 * @throws Error if frequency_type is not recognized or frequency_value is invalid
 */
export function toFrequency(
  frequencyType: string,
  frequencyValue: string,
): Frequency {
  switch (frequencyType) {
    case 'daily':
      return { type: 'daily' };
    case 'weekly_days': {
      try {
        const days = JSON.parse(frequencyValue) as number[];
        return { type: 'weekly_days', days };
      } catch {
        throw new Error(
          `Invalid frequency_value for weekly_days: ${frequencyValue}`,
        );
      }
    }
    case 'weekly_count': {
      const count = Number(frequencyValue);
      if (Number.isNaN(count)) {
        throw new Error(
          `Invalid frequency_value for weekly_count: ${frequencyValue}`,
        );
      }
      return { type: 'weekly_count', count };
    }
    default:
      throw new Error(`Unknown frequency type: ${frequencyType}`);
  }
}

/**
 * Converts a domain Frequency object to DB column values.
 */
export function toFrequencyDbFields(frequency: Frequency): {
  readonly frequencyType: string;
  readonly frequencyValue: string;
} {
  switch (frequency.type) {
    case 'daily':
      return { frequencyType: 'daily', frequencyValue: '{}' };
    case 'weekly_days':
      return {
        frequencyType: 'weekly_days',
        frequencyValue: JSON.stringify(frequency.days),
      };
    case 'weekly_count':
      return {
        frequencyType: 'weekly_count',
        frequencyValue: String(frequency.count),
      };
  }
}

// --- Repository interface ---

/**
 * Interface for habit persistence operations.
 * All methods return Promises for compatibility with async storage backends.
 */
export type HabitRepository = {
  readonly findAll: () => Promise<Habit[]>;
  readonly findById: (id: string) => Promise<Habit | null>;
  readonly create: (input: CreateHabitInput) => Promise<Habit>;
  readonly update: (
    id: string,
    input: UpdateHabitInput,
  ) => Promise<Habit | null>;
  readonly archive: (id: string) => Promise<void>;
  readonly findArchived: () => Promise<Habit[]>;
};
