/**
 * Integration tests for CompletionRepositoryImpl.
 *
 * Uses better-sqlite3 to run actual SQLite operations (in-memory),
 * verifying that SQL statements, unique constraints, and query results
 * work correctly against a real database engine.
 */

import Database from 'better-sqlite3';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  CompletionRepositoryImpl,
  DuplicateCompletionError,
} from '../completionRepository';
import {
  HABITS_TABLE_SQL,
  COMPLETIONS_TABLE_SQL,
  COMPLETIONS_UNIQUE_INDEX_SQL,
} from '../../database/schema';

/**
 * Adapts better-sqlite3 to the expo-sqlite SQLiteDatabase interface
 * used by CompletionRepositoryImpl.
 */
function createSqliteAdapter(db: Database.Database): SQLiteDatabase {
  return {
    getAllSync<T>(sql: string, ...params: unknown[]): T[] {
      const stmt = db.prepare(sql);
      return stmt.all(...params) as T[];
    },
    getFirstSync<T>(sql: string, ...params: unknown[]): T | null {
      const stmt = db.prepare(sql);
      return (stmt.get(...params) as T) ?? null;
    },
    runSync(sql: string, ...params: unknown[]) {
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);
      return {
        changes: result.changes,
        lastInsertRowId: Number(result.lastInsertRowid),
      };
    },
    execSync(sql: string) {
      db.exec(sql);
    },
  } as unknown as SQLiteDatabase;
}

function setupTestDatabase(): {
  rawDb: Database.Database;
  adapter: SQLiteDatabase;
} {
  const rawDb = new Database(':memory:');
  rawDb.pragma('foreign_keys = ON');
  rawDb.exec(HABITS_TABLE_SQL);
  rawDb.exec(COMPLETIONS_TABLE_SQL);
  rawDb.exec(COMPLETIONS_UNIQUE_INDEX_SQL);
  return { rawDb, adapter: createSqliteAdapter(rawDb) };
}

function insertTestHabit(
  rawDb: Database.Database,
  id: string = 'habit-1'
): void {
  rawDb
    .prepare(
      'INSERT INTO habits (id, name, frequency_type, frequency_value, color, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(id, 'Test Habit', 'daily', '{}', '#FF0000', '2026-01-01T00:00:00Z');
}

describe('CompletionRepositoryImpl (integration)', () => {
  let rawDb: Database.Database;
  let adapter: SQLiteDatabase;
  let repository: CompletionRepositoryImpl;

  beforeEach(() => {
    const setup = setupTestDatabase();
    rawDb = setup.rawDb;
    adapter = setup.adapter;
    repository = new CompletionRepositoryImpl(adapter);
    insertTestHabit(rawDb, 'habit-1');
    insertTestHabit(rawDb, 'habit-2');
  });

  afterEach(() => {
    rawDb.close();
  });

  describe('create', () => {
    it('should insert a completion record into the database', async () => {
      const result = await repository.create('habit-1', '2026-03-14');

      expect(result.habitId).toBe('habit-1');
      expect(result.completedDate).toBe('2026-03-14');
      expect(result.id).toBeTruthy();
      expect(result.createdAt).toBeTruthy();

      const row = rawDb
        .prepare('SELECT * FROM completions WHERE id = ?')
        .get(result.id) as Record<string, unknown>;
      expect(row).toBeDefined();
      expect(row.habit_id).toBe('habit-1');
      expect(row.completed_date).toBe('2026-03-14');
    });

    it('should generate a valid UUID for the id', async () => {
      const result = await repository.create('habit-1', '2026-03-14');
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      expect(result.id).toMatch(uuidRegex);
    });

    it('should throw DuplicateCompletionError on unique constraint violation', async () => {
      await repository.create('habit-1', '2026-03-14');

      await expect(
        repository.create('habit-1', '2026-03-14')
      ).rejects.toThrow(DuplicateCompletionError);
    });

    it('should allow same date for different habits', async () => {
      const r1 = await repository.create('habit-1', '2026-03-14');
      const r2 = await repository.create('habit-2', '2026-03-14');

      expect(r1.habitId).toBe('habit-1');
      expect(r2.habitId).toBe('habit-2');
    });

    it('should reject invalid dates like 2026-13-45', async () => {
      await expect(
        repository.create('habit-1', '2026-13-45')
      ).rejects.toThrow();
    });

    it('should reject invalid dates like 2026-02-30', async () => {
      await expect(
        repository.create('habit-1', '2026-02-30')
      ).rejects.toThrow();
    });

    it('should reject invalid dates like 2026-00-01', async () => {
      await expect(
        repository.create('habit-1', '2026-00-01')
      ).rejects.toThrow();
    });
  });

  describe('findByHabitId', () => {
    it('should return completions for a specific habit ordered by date descending', async () => {
      await repository.create('habit-1', '2026-03-10');
      await repository.create('habit-1', '2026-03-14');
      await repository.create('habit-1', '2026-03-12');
      await repository.create('habit-2', '2026-03-14');

      const results = await repository.findByHabitId('habit-1');

      expect(results).toHaveLength(3);
      expect(results[0].completedDate).toBe('2026-03-14');
      expect(results[1].completedDate).toBe('2026-03-12');
      expect(results[2].completedDate).toBe('2026-03-10');
    });

    it('should return empty array when habit has no completions', async () => {
      const results = await repository.findByHabitId('habit-1');
      expect(results).toEqual([]);
    });
  });

  describe('findByDate', () => {
    it('should return all completions for a given date', async () => {
      await repository.create('habit-1', '2026-03-14');
      await repository.create('habit-2', '2026-03-14');
      await repository.create('habit-1', '2026-03-13');

      const results = await repository.findByDate('2026-03-14');

      expect(results).toHaveLength(2);
      const habitIds = results.map((r) => r.habitId).sort();
      expect(habitIds).toEqual(['habit-1', 'habit-2']);
    });

    it('should return empty array when no completions exist for date', async () => {
      const results = await repository.findByDate('2026-01-01');
      expect(results).toEqual([]);
    });
  });

  describe('findByHabitIdAndDateRange', () => {
    it('should return completions within the specified date range', async () => {
      await repository.create('habit-1', '2026-03-10');
      await repository.create('habit-1', '2026-03-12');
      await repository.create('habit-1', '2026-03-14');
      await repository.create('habit-1', '2026-03-16');

      const results = await repository.findByHabitIdAndDateRange(
        'habit-1',
        '2026-03-11',
        '2026-03-15'
      );

      expect(results).toHaveLength(2);
      expect(results[0].completedDate).toBe('2026-03-12');
      expect(results[1].completedDate).toBe('2026-03-14');
    });

    it('should include boundary dates (inclusive range)', async () => {
      await repository.create('habit-1', '2026-03-10');
      await repository.create('habit-1', '2026-03-14');

      const results = await repository.findByHabitIdAndDateRange(
        'habit-1',
        '2026-03-10',
        '2026-03-14'
      );

      expect(results).toHaveLength(2);
    });

    it('should not include other habits completions', async () => {
      await repository.create('habit-1', '2026-03-12');
      await repository.create('habit-2', '2026-03-12');

      const results = await repository.findByHabitIdAndDateRange(
        'habit-1',
        '2026-03-10',
        '2026-03-14'
      );

      expect(results).toHaveLength(1);
      expect(results[0].habitId).toBe('habit-1');
    });

    it('should return results ordered by date ascending', async () => {
      await repository.create('habit-1', '2026-03-14');
      await repository.create('habit-1', '2026-03-10');
      await repository.create('habit-1', '2026-03-12');

      const results = await repository.findByHabitIdAndDateRange(
        'habit-1',
        '2026-03-10',
        '2026-03-14'
      );

      expect(results[0].completedDate).toBe('2026-03-10');
      expect(results[1].completedDate).toBe('2026-03-12');
      expect(results[2].completedDate).toBe('2026-03-14');
    });
  });

  describe('delete', () => {
    it('should remove the completion record from the database', async () => {
      await repository.create('habit-1', '2026-03-14');

      await repository.delete('habit-1', '2026-03-14');

      const results = await repository.findByHabitId('habit-1');
      expect(results).toEqual([]);
    });

    it('should not throw when deleting a non-existent record (idempotent)', async () => {
      await expect(
        repository.delete('habit-1', '2026-03-14')
      ).resolves.toBeUndefined();
    });

    it('should only delete the targeted completion', async () => {
      await repository.create('habit-1', '2026-03-13');
      await repository.create('habit-1', '2026-03-14');

      await repository.delete('habit-1', '2026-03-14');

      const results = await repository.findByHabitId('habit-1');
      expect(results).toHaveLength(1);
      expect(results[0].completedDate).toBe('2026-03-13');
    });
  });

  describe('unique constraint', () => {
    it('should enforce uniqueness on (habit_id, completed_date)', async () => {
      await repository.create('habit-1', '2026-03-14');

      await expect(
        repository.create('habit-1', '2026-03-14')
      ).rejects.toThrow(DuplicateCompletionError);

      const count = rawDb
        .prepare(
          'SELECT COUNT(*) as cnt FROM completions WHERE habit_id = ? AND completed_date = ?'
        )
        .get('habit-1', '2026-03-14') as { cnt: number };
      expect(count.cnt).toBe(1);
    });
  });
});
