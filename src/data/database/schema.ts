/**
 * SQLite schema definitions for the daily-rituals app.
 *
 * Tables:
 * - habits: Stores habit definitions with frequency configuration.
 * - completions: Records when a habit was completed on a given date.
 * - schema_version: Tracks the current database migration version.
 */

export const SCHEMA_VERSION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
  );
`;

export const HABITS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    frequency_type TEXT NOT NULL CHECK (frequency_type IN ('daily', 'weekly_days', 'weekly_count')),
    frequency_value TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL,
    archived_at TEXT
  );
`;

export const COMPLETIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS completions (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL,
    completed_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (habit_id) REFERENCES habits(id)
  );
`;

export const COMPLETIONS_UNIQUE_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_completions_habit_date
    ON completions(habit_id, completed_date);
`;

/**
 * Represents a single database migration.
 */
export type Migration = {
  readonly version: number;
  readonly description: string;
  readonly statements: readonly string[];
};

/**
 * Ordered list of all database migrations.
 * Each migration is applied in sequence during database initialization.
 * Versions must be sequential starting from 1.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'Create habits and completions tables',
    statements: [
      HABITS_TABLE_SQL,
      COMPLETIONS_TABLE_SQL,
      COMPLETIONS_UNIQUE_INDEX_SQL,
    ],
  },
];
