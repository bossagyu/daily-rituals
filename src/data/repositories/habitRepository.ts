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
 * @throws Error if frequency_type is not recognized or frequency_value is invalid
 */
export function toFrequency(
  frequencyType: string,
  frequencyValue: string
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
          `Invalid frequency_value for weekly_days: ${frequencyValue}`
        );
      }
    }
    case 'weekly_count': {
      const count = Number(frequencyValue);
      if (Number.isNaN(count)) {
        throw new Error(
          `Invalid frequency_value for weekly_count: ${frequencyValue}`
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
 * All methods return Promises for future compatibility with async storage backends.
 */
export type HabitRepository = {
  readonly findAll: () => Promise<Habit[]>;
  readonly findById: (id: string) => Promise<Habit | null>;
  readonly create: (input: CreateHabitInput) => Promise<Habit>;
  readonly update: (id: string, input: UpdateHabitInput) => Promise<Habit | null>;
  readonly archive: (id: string) => Promise<void>;
  readonly findArchived: () => Promise<Habit[]>;
};

// --- Repository implementation ---

type IdGenerator = () => string;
type TimestampGenerator = () => string;

/**
 * SQLite-backed implementation of HabitRepository.
 *
 * Uses dependency injection for ID and timestamp generation
 * to support deterministic testing.
 * Wraps synchronous expo-sqlite operations in Promises for interface compliance.
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

  async findAll(): Promise<Habit[]> {
    const rows = this.db.getAllSync<HabitRow>(
      'SELECT id, name, frequency_type, frequency_value, color, created_at, archived_at FROM habits WHERE archived_at IS NULL ORDER BY created_at ASC'
    );
    return rows.map(toHabit);
  }

  async findById(id: string): Promise<Habit | null> {
    const row = this.db.getFirstSync<HabitRow>(
      'SELECT id, name, frequency_type, frequency_value, color, created_at, archived_at FROM habits WHERE id = ?',
      id
    );
    return row ? toHabit(row) : null;
  }

  async create(input: CreateHabitInput): Promise<Habit> {
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

  async update(id: string, input: UpdateHabitInput): Promise<Habit | null> {
    const fields = [
      ...(input.name !== undefined
        ? [{ clause: 'name = ?', value: input.name }]
        : []),
      ...(input.color !== undefined
        ? [{ clause: 'color = ?', value: input.color }]
        : []),
      ...(input.frequency !== undefined
        ? (() => {
            const { frequencyType, frequencyValue } = toFrequencyDbFields(input.frequency);
            return [
              { clause: 'frequency_type = ?', value: frequencyType },
              { clause: 'frequency_value = ?', value: frequencyValue },
            ];
          })()
        : []),
    ];

    if (fields.length > 0) {
      const setClauses = fields.map(f => f.clause).join(', ');
      const params = [...fields.map(f => f.value), id];
      this.db.runSync(
        `UPDATE habits SET ${setClauses} WHERE id = ?`,
        ...params
      );
    }

    return this.findById(id);
  }

  async archive(id: string): Promise<void> {
    const archivedAt = this.generateTimestamp();
    this.db.runSync(
      'UPDATE habits SET archived_at = ? WHERE id = ?',
      archivedAt,
      id
    );
  }

  async findArchived(): Promise<Habit[]> {
    const rows = this.db.getAllSync<HabitRow>(
      'SELECT id, name, frequency_type, frequency_value, color, created_at, archived_at FROM habits WHERE archived_at IS NOT NULL ORDER BY created_at ASC'
    );
    return rows.map(toHabit);
  }
}
