/**
 * CompletionRepository: CRUD operations for habit completion records.
 *
 * Uses expo-sqlite synchronous API wrapped in async interface
 * for consistency with the application's data access patterns.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import type { Completion } from '../../domain/models';

const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type CompletionRow = {
  readonly id: string;
  readonly habit_id: string;
  readonly completed_date: string;
  readonly created_at: string;
};

/**
 * Custom error thrown when attempting to create a duplicate completion
 * (same habit_id + completed_date combination).
 */
export class DuplicateCompletionError extends Error {
  constructor(habitId: string, completedDate: string) {
    super(
      `Completion already exists for habit "${habitId}" on ${completedDate}`
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
    endDate: string
  ): Promise<Completion[]>;
  create(habitId: string, completedDate: string): Promise<Completion>;
  delete(habitId: string, completedDate: string): Promise<void>;
}

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

function validateHabitId(habitId: string): void {
  if (!habitId || habitId.trim().length === 0) {
    throw new Error('habitId must not be empty');
  }
}

function validateDateFormat(date: string, fieldName: string): void {
  if (!DATE_FORMAT_REGEX.test(date)) {
    throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
  }
}

function mapRowToCompletion(row: CompletionRow): Completion {
  return {
    id: row.id,
    habitId: row.habit_id,
    completedDate: row.completed_date,
    createdAt: row.created_at,
  };
}

/**
 * SQLite-backed implementation of CompletionRepository.
 */
export class CompletionRepositoryImpl implements CompletionRepository {
  private readonly db: SQLiteDatabase;

  constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  async findByHabitId(habitId: string): Promise<Completion[]> {
    validateHabitId(habitId);

    const rows = this.db.getAllSync<CompletionRow>(
      'SELECT id, habit_id, completed_date, created_at FROM completions WHERE habit_id = ? ORDER BY completed_date DESC',
      habitId
    );

    return rows.map(mapRowToCompletion);
  }

  async findByDate(date: string): Promise<Completion[]> {
    validateDateFormat(date, 'date');

    const rows = this.db.getAllSync<CompletionRow>(
      'SELECT id, habit_id, completed_date, created_at FROM completions WHERE completed_date = ? ORDER BY created_at DESC',
      date
    );

    return rows.map(mapRowToCompletion);
  }

  async findByHabitIdAndDateRange(
    habitId: string,
    startDate: string,
    endDate: string
  ): Promise<Completion[]> {
    validateHabitId(habitId);
    validateDateFormat(startDate, 'startDate');
    validateDateFormat(endDate, 'endDate');

    if (startDate > endDate) {
      throw new Error('startDate must be before or equal to endDate');
    }

    const rows = this.db.getAllSync<CompletionRow>(
      'SELECT id, habit_id, completed_date, created_at FROM completions WHERE habit_id = ? AND completed_date >= ? AND completed_date <= ? ORDER BY completed_date ASC',
      habitId,
      startDate,
      endDate
    );

    return rows.map(mapRowToCompletion);
  }

  async create(
    habitId: string,
    completedDate: string
  ): Promise<Completion> {
    validateHabitId(habitId);
    validateDateFormat(completedDate, 'completedDate');

    const id = generateId();
    const createdAt = new Date().toISOString();

    try {
      this.db.runSync(
        'INSERT INTO completions (id, habit_id, completed_date, created_at) VALUES (?, ?, ?, ?)',
        id,
        habitId,
        completedDate,
        createdAt
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('UNIQUE constraint failed')) {
        throw new DuplicateCompletionError(habitId, completedDate);
      }
      throw error;
    }

    return {
      id,
      habitId,
      completedDate,
      createdAt,
    };
  }

  async delete(
    habitId: string,
    completedDate: string
  ): Promise<void> {
    validateHabitId(habitId);
    validateDateFormat(completedDate, 'completedDate');

    this.db.runSync(
      'DELETE FROM completions WHERE habit_id = ? AND completed_date = ?',
      habitId,
      completedDate
    );
  }
}
