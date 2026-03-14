/**
 * HabitRepository - CRUD operations for habits.
 *
 * Provides an interface and implementation for persisting habits
 * to SQLite via expo-sqlite, with mapping between DB rows and domain models.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import type { Habit, Frequency, CreateHabitInput } from '../../domain/models';

// --- Types ---

/**
 * Input type for updating an existing habit.
 * All fields are optional; only provided fields will be updated.
 */
export type UpdateHabitInput = Partial<CreateHabitInput>;

/**
 * Row shape returned by SQLite for the habits table.
 */
type HabitRow = {
  readonly id: string;
  readonly name: string;
  readonly frequency_type: string;
  readonly frequency_value: string;
  readonly color: string;
  readonly created_at: string;
  readonly archived_at: string | null;
};

// --- Mapper functions ---

/**
 * Converts DB frequency_type and frequency_value to a domain Frequency object.
 *
 * @throws Error if frequency_type is not recognized
 */
export function toFrequency(
  frequencyType: string,
  frequencyValue: string
): Frequency {
  switch (frequencyType) {
    case 'daily':
      return { type: 'daily' };
    case 'weekly_days':
      return {
        type: 'weekly_days',
        days: JSON.parse(frequencyValue) as number[],
      };
    case 'weekly_count':
      return { type: 'weekly_count', count: Number(frequencyValue) };
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

/**
 * Maps a SQLite row to a domain Habit object.
 */
function toHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    frequency: toFrequency(row.frequency_type, row.frequency_value),
    color: row.color,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

// --- Repository interface ---

/**
 * Interface for habit persistence operations.
 */
export type HabitRepository = {
  readonly findAll: () => Habit[];
  readonly findById: (id: string) => Habit | null;
  readonly create: (input: CreateHabitInput) => Habit;
  readonly update: (id: string, input: UpdateHabitInput) => Habit | null;
  readonly archive: (id: string) => void;
  readonly findArchived: () => Habit[];
};

// --- Repository implementation ---

type IdGenerator = () => string;
type TimestampGenerator = () => string;

/**
 * SQLite-backed implementation of HabitRepository.
 *
 * Uses dependency injection for ID and timestamp generation
 * to support deterministic testing.
 */
export class HabitRepositoryImpl implements HabitRepository {
  private readonly db: SQLiteDatabase;
  private readonly generateId: IdGenerator;
  private readonly generateTimestamp: TimestampGenerator;

  constructor(
    db: SQLiteDatabase,
    generateId?: IdGenerator,
    generateTimestamp?: TimestampGenerator
  ) {
    this.db = db;
    this.generateId = generateId ?? (() => crypto.randomUUID());
    this.generateTimestamp = generateTimestamp ?? (() => new Date().toISOString());
  }

  findAll(): Habit[] {
    const rows = this.db.getAllSync<HabitRow>(
      'SELECT id, name, frequency_type, frequency_value, color, created_at, archived_at FROM habits WHERE archived_at IS NULL ORDER BY created_at ASC'
    );
    return rows.map(toHabit);
  }

  findById(id: string): Habit | null {
    const row = this.db.getFirstSync<HabitRow>(
      'SELECT id, name, frequency_type, frequency_value, color, created_at, archived_at FROM habits WHERE id = ?',
      id
    );
    return row ? toHabit(row) : null;
  }

  create(input: CreateHabitInput): Habit {
    const id = this.generateId();
    const createdAt = this.generateTimestamp();
    const { frequencyType, frequencyValue } = toFrequencyDbFields(
      input.frequency
    );

    this.db.runSync(
      'INSERT INTO habits (id, name, frequency_type, frequency_value, color, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      input.name,
      frequencyType,
      frequencyValue,
      input.color,
      createdAt
    );

    return {
      id,
      name: input.name,
      frequency: input.frequency,
      color: input.color,
      createdAt,
      archivedAt: null,
    };
  }

  update(id: string, input: UpdateHabitInput): Habit | null {
    const setClauses: string[] = [];
    const params: string[] = [];

    if (input.name !== undefined) {
      setClauses.push('name = ?');
      params.push(input.name);
    }

    if (input.color !== undefined) {
      setClauses.push('color = ?');
      params.push(input.color);
    }

    if (input.frequency !== undefined) {
      const { frequencyType, frequencyValue } = toFrequencyDbFields(
        input.frequency
      );
      setClauses.push('frequency_type = ?');
      params.push(frequencyType);
      setClauses.push('frequency_value = ?');
      params.push(frequencyValue);
    }

    if (setClauses.length > 0) {
      params.push(id);
      this.db.runSync(
        `UPDATE habits SET ${setClauses.join(', ')} WHERE id = ?`,
        ...params
      );
    }

    return this.findById(id);
  }

  archive(id: string): void {
    const archivedAt = this.generateTimestamp();
    this.db.runSync(
      'UPDATE habits SET archived_at = ? WHERE id = ?',
      archivedAt,
      id
    );
  }

  findArchived(): Habit[] {
    const rows = this.db.getAllSync<HabitRow>(
      'SELECT id, name, frequency_type, frequency_value, color, created_at, archived_at FROM habits WHERE archived_at IS NOT NULL ORDER BY created_at ASC'
    );
    return rows.map(toHabit);
  }
}
