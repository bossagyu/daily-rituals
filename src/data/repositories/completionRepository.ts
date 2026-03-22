/**
 * CompletionRepository - Interface and utilities for habit completion records.
 *
 * The interface defines data access operations for completions.
 * Validation and error types are retained as reusable utilities.
 */

import type { Completion } from '../../domain/models';

/**
 * Custom error thrown when attempting to create a duplicate completion
 * (same habit_id + completed_date combination).
 */
export class DuplicateCompletionError extends Error {
  constructor(habitId: string, completedDate: string) {
    super(
      `Completion already exists for habit "${habitId}" on ${completedDate}`,
    );
    this.name = 'DuplicateCompletionError';
  }
}

/**
 * Interface for completion record data access.
 */
export interface CompletionRepository {
  findByHabitId(habitId: string): Promise<Completion[]>;
  findByDate(date: string): Promise<Completion[]>;
  findByHabitIdAndDateRange(
    habitId: string,
    startDate: string,
    endDate: string,
  ): Promise<Completion[]>;
  findByDateRange(startDate: string, endDate: string): Promise<Completion[]>;
  create(habitId: string, completedDate: string): Promise<Completion>;
  delete(habitId: string, completedDate: string): Promise<void>;
}
