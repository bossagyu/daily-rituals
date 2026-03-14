import {
  HABITS_TABLE_SQL,
  COMPLETIONS_TABLE_SQL,
  COMPLETIONS_UNIQUE_INDEX_SQL,
  MIGRATIONS,
} from '../schema';

describe('schema', () => {
  describe('HABITS_TABLE_SQL', () => {
    it('should define CREATE TABLE for habits', () => {
      expect(HABITS_TABLE_SQL).toContain('CREATE TABLE IF NOT EXISTS habits');
    });

    it('should include all required columns', () => {
      const requiredColumns = [
        'id TEXT PRIMARY KEY',
        'name TEXT NOT NULL',
        'frequency_type TEXT NOT NULL',
        'frequency_value TEXT NOT NULL',
        'color TEXT NOT NULL',
        'created_at TEXT NOT NULL',
        'archived_at TEXT',
      ];
      for (const col of requiredColumns) {
        expect(HABITS_TABLE_SQL).toContain(col);
      }
    });

    it('should validate frequency_type with CHECK constraint', () => {
      expect(HABITS_TABLE_SQL).toContain('CHECK');
      expect(HABITS_TABLE_SQL).toContain('daily');
      expect(HABITS_TABLE_SQL).toContain('weekly_days');
      expect(HABITS_TABLE_SQL).toContain('weekly_count');
    });
  });

  describe('COMPLETIONS_TABLE_SQL', () => {
    it('should define CREATE TABLE for completions', () => {
      expect(COMPLETIONS_TABLE_SQL).toContain(
        'CREATE TABLE IF NOT EXISTS completions'
      );
    });

    it('should include all required columns', () => {
      const requiredColumns = [
        'id TEXT PRIMARY KEY',
        'habit_id TEXT NOT NULL',
        'completed_date TEXT NOT NULL',
        'created_at TEXT NOT NULL',
      ];
      for (const col of requiredColumns) {
        expect(COMPLETIONS_TABLE_SQL).toContain(col);
      }
    });

    it('should have foreign key referencing habits', () => {
      expect(COMPLETIONS_TABLE_SQL).toContain('FOREIGN KEY');
      expect(COMPLETIONS_TABLE_SQL).toContain('REFERENCES habits(id)');
    });
  });

  describe('COMPLETIONS_UNIQUE_INDEX_SQL', () => {
    it('should create unique index on habit_id and completed_date', () => {
      expect(COMPLETIONS_UNIQUE_INDEX_SQL).toContain('CREATE UNIQUE INDEX');
      expect(COMPLETIONS_UNIQUE_INDEX_SQL).toContain('habit_id');
      expect(COMPLETIONS_UNIQUE_INDEX_SQL).toContain('completed_date');
    });
  });

  describe('MIGRATIONS', () => {
    it('should have at least one migration', () => {
      expect(MIGRATIONS.length).toBeGreaterThanOrEqual(1);
    });

    it('should have sequential version numbers starting from 1', () => {
      MIGRATIONS.forEach((migration, index) => {
        expect(migration.version).toBe(index + 1);
      });
    });

    it('should have non-empty statements in each migration', () => {
      MIGRATIONS.forEach((migration) => {
        expect(migration.statements.length).toBeGreaterThan(0);
        migration.statements.forEach((stmt) => {
          expect(stmt.trim().length).toBeGreaterThan(0);
        });
      });
    });

    it('should have a description for each migration', () => {
      MIGRATIONS.forEach((migration) => {
        expect(migration.description.trim().length).toBeGreaterThan(0);
      });
    });

    it('first migration should include habits and completions table creation', () => {
      const firstMigration = MIGRATIONS[0];
      const allStatements = firstMigration.statements.join(' ');
      expect(allStatements).toContain('habits');
      expect(allStatements).toContain('completions');
    });
  });
});
