import { initializeDatabase, getSchemaVersion } from '../database';
import { MIGRATIONS } from '../schema';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Creates a mock SQLiteDatabase for testing.
 * Tracks executed SQL statements and simulates schema_version table.
 */
function createMockDatabase(): SQLiteDatabase & {
  executedStatements: string[];
} {
  let schemaVersion = 0;
  const executedStatements: string[] = [];

  const mockDb = {
    executedStatements,
    execSync: jest.fn((sql: string) => {
      executedStatements.push(sql);
    }),
    runSync: jest.fn((sql: string, ..._params: unknown[]) => {
      executedStatements.push(sql);
      if (sql.includes('INSERT OR REPLACE INTO schema_version')) {
        const versionMatch = sql.match(/VALUES\s*\(\s*(\d+)\s*\)/);
        if (!versionMatch) {
          const params = _params.flat();
          if (params.length > 0) {
            schemaVersion = Number(params[0]);
          }
        } else {
          schemaVersion = Number(versionMatch[1]);
        }
      }
      return { changes: 1, lastInsertRowId: 1 };
    }),
    getFirstSync: jest.fn(
      <T>(sql: string, ..._params: unknown[]): T | null => {
        executedStatements.push(sql);
        if (sql.includes('SELECT version FROM schema_version')) {
          return { version: schemaVersion } as T;
        }
        return null;
      }
    ),
    withTransactionSync: jest.fn((callback: () => void) => {
      callback();
    }),
  } as unknown as SQLiteDatabase & { executedStatements: string[] };

  return mockDb;
}

describe('database', () => {
  describe('initializeDatabase', () => {
    it('should enable WAL mode and foreign keys', () => {
      const db = createMockDatabase();

      initializeDatabase(db);

      expect(db.execSync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL;');
      expect(db.execSync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
    });

    it('should create schema_version table', () => {
      const db = createMockDatabase();

      initializeDatabase(db);

      const createVersionTableCall = (
        db.execSync as jest.Mock
      ).mock.calls.find((call: string[]) =>
        call[0].includes('schema_version')
      );
      expect(createVersionTableCall).toBeDefined();
    });

    it('should run all migrations on fresh database', () => {
      const db = createMockDatabase();

      initializeDatabase(db);

      // Should have run migration statements
      const totalMigrationStatements = MIGRATIONS.reduce(
        (sum, m) => sum + m.statements.length,
        0
      );
      // Each migration runs its statements + version update
      expect(db.withTransactionSync).toHaveBeenCalledTimes(
        MIGRATIONS.length
      );

      // Verify version was updated to latest
      const latestVersion = MIGRATIONS[MIGRATIONS.length - 1].version;
      expect(db.runSync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO schema_version'),
        latestVersion
      );
    });

    it('should skip already applied migrations', () => {
      // Simulate database already at version 1
      let currentVersion = 1;
      const db = createMockDatabase();
      (db.getFirstSync as jest.Mock).mockImplementation(
        <T>(sql: string): T | null => {
          if (sql.includes('SELECT version FROM schema_version')) {
            return { version: currentVersion } as T;
          }
          return null;
        }
      );

      initializeDatabase(db);

      // Should not run migration 1 again (only migrations > currentVersion)
      if (MIGRATIONS.length > 1) {
        expect(db.withTransactionSync).toHaveBeenCalledTimes(
          MIGRATIONS.length - 1
        );
      } else {
        expect(db.withTransactionSync).not.toHaveBeenCalled();
      }
    });

    it('should throw an error when migration fails', () => {
      const db = createMockDatabase();
      (db.withTransactionSync as jest.Mock).mockImplementation(() => {
        throw new Error('SQL execution error');
      });

      expect(() => initializeDatabase(db)).toThrow(
        'Database migration failed'
      );
    });
  });

  describe('getSchemaVersion', () => {
    it('should return 0 when no version record exists', () => {
      const db = createMockDatabase();
      (db.getFirstSync as jest.Mock).mockReturnValue(null);

      const version = getSchemaVersion(db);
      expect(version).toBe(0);
    });

    it('should return the current version from schema_version table', () => {
      const db = createMockDatabase();
      (db.getFirstSync as jest.Mock).mockReturnValue({ version: 3 });

      const version = getSchemaVersion(db);
      expect(version).toBe(3);
    });
  });
});
