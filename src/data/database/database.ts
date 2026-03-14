/**
 * Database initialization and migration logic for daily-rituals.
 *
 * Uses expo-sqlite's synchronous API for schema setup at app startup.
 * Migrations are applied in order, skipping any already applied versions.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { MIGRATIONS, SCHEMA_VERSION_TABLE_SQL } from './schema';

type SchemaVersionRow = {
  readonly version: number;
};

/**
 * Returns the current schema version from the database.
 * Returns 0 if no version record exists (fresh database).
 */
export function getSchemaVersion(db: SQLiteDatabase): number {
  const row = db.getFirstSync<SchemaVersionRow>(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  );
  return row?.version ?? 0;
}

/**
 * Initializes the database by enabling pragmas and running pending migrations.
 *
 * This function should be called once at app startup. It:
 * 1. Enables WAL mode for better concurrent read performance
 * 2. Enables foreign key enforcement
 * 3. Creates the schema_version tracking table
 * 4. Runs any pending migrations in version order
 *
 * @throws Error if any migration fails to apply
 */
export function initializeDatabase(db: SQLiteDatabase): void {
  db.execSync('PRAGMA journal_mode = WAL;');
  db.execSync('PRAGMA foreign_keys = ON;');
  db.execSync(SCHEMA_VERSION_TABLE_SQL);

  const currentVersion = getSchemaVersion(db);
  const pendingMigrations = MIGRATIONS.filter(
    (m) => m.version > currentVersion
  );

  for (const migration of pendingMigrations) {
    try {
      db.withTransactionSync(() => {
        for (const statement of migration.statements) {
          db.execSync(statement);
        }
        db.runSync(
          'INSERT OR REPLACE INTO schema_version (version) VALUES (?)',
          migration.version
        );
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Database migration failed (version ${migration.version}: ${migration.description}): ${message}`
      );
    }
  }
}
