import type { SQLiteDatabase } from 'expo-sqlite';
import type { Completion } from '../../../domain/models';
import {
  CompletionRepositoryImpl,
  DuplicateCompletionError,
} from '../completionRepository';

type CompletionRow = {
  readonly id: string;
  readonly habit_id: string;
  readonly completed_date: string;
  readonly created_at: string;
};

function createMockDatabase() {
  const mockDb = {
    getAllSync: jest.fn(
      <T>(_sql: string, ..._params: unknown[]): T[] => [] as T[]
    ),
    getFirstSync: jest.fn(
      <T>(_sql: string, ..._params: unknown[]): T | null => null
    ),
    runSync: jest.fn((_sql: string, ..._params: unknown[]) => ({
      changes: 1,
      lastInsertRowId: 1,
    })),
  } as unknown as SQLiteDatabase;

  return mockDb;
}

function createSampleRow(overrides: Partial<CompletionRow> = {}): CompletionRow {
  return {
    id: 'comp-1',
    habit_id: 'habit-1',
    completed_date: '2026-03-14',
    created_at: '2026-03-14T10:00:00.000Z',
    ...overrides,
  };
}

function rowToCompletion(row: CompletionRow): Completion {
  return {
    id: row.id,
    habitId: row.habit_id,
    completedDate: row.completed_date,
    createdAt: row.created_at,
  };
}

describe('CompletionRepositoryImpl', () => {
  let db: SQLiteDatabase;
  let repository: CompletionRepositoryImpl;

  beforeEach(() => {
    db = createMockDatabase();
    repository = new CompletionRepositoryImpl(db);
  });

  describe('findByHabitId', () => {
    it('should return completions for a given habit id', async () => {
      const rows: CompletionRow[] = [
        createSampleRow(),
        createSampleRow({
          id: 'comp-2',
          completed_date: '2026-03-13',
          created_at: '2026-03-13T10:00:00.000Z',
        }),
      ];
      (db.getAllSync as jest.Mock).mockReturnValue(rows);

      const result = await repository.findByHabitId('habit-1');

      expect(db.getAllSync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE habit_id = ?'),
        'habit-1'
      );
      expect(result).toEqual(rows.map(rowToCompletion));
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no completions found', async () => {
      (db.getAllSync as jest.Mock).mockReturnValue([]);

      const result = await repository.findByHabitId('habit-nonexistent');

      expect(result).toEqual([]);
    });

    it('should validate habitId is not empty', async () => {
      await expect(repository.findByHabitId('')).rejects.toThrow();
    });
  });

  describe('findByDate', () => {
    it('should return completions for a given date', async () => {
      const rows: CompletionRow[] = [
        createSampleRow(),
        createSampleRow({ id: 'comp-2', habit_id: 'habit-2' }),
      ];
      (db.getAllSync as jest.Mock).mockReturnValue(rows);

      const result = await repository.findByDate('2026-03-14');

      expect(db.getAllSync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE completed_date = ?'),
        '2026-03-14'
      );
      expect(result).toEqual(rows.map(rowToCompletion));
    });

    it('should return empty array when no completions found for date', async () => {
      (db.getAllSync as jest.Mock).mockReturnValue([]);

      const result = await repository.findByDate('2026-01-01');

      expect(result).toEqual([]);
    });

    it('should validate date format is YYYY-MM-DD', async () => {
      await expect(repository.findByDate('2026/03/14')).rejects.toThrow();
      await expect(repository.findByDate('03-14-2026')).rejects.toThrow();
      await expect(repository.findByDate('')).rejects.toThrow();
    });

    it('should reject semantically invalid dates', async () => {
      await expect(repository.findByDate('2026-13-45')).rejects.toThrow();
      await expect(repository.findByDate('2026-02-30')).rejects.toThrow();
      await expect(repository.findByDate('2026-00-01')).rejects.toThrow();
    });
  });

  describe('findByHabitIdAndDateRange', () => {
    it('should return completions within date range', async () => {
      const rows: CompletionRow[] = [
        createSampleRow({ completed_date: '2026-03-10' }),
        createSampleRow({ id: 'comp-2', completed_date: '2026-03-12' }),
      ];
      (db.getAllSync as jest.Mock).mockReturnValue(rows);

      const result = await repository.findByHabitIdAndDateRange(
        'habit-1',
        '2026-03-10',
        '2026-03-14'
      );

      expect(db.getAllSync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE habit_id = ?'),
        'habit-1',
        '2026-03-10',
        '2026-03-14'
      );
      expect(result).toEqual(rows.map(rowToCompletion));
    });

    it('should return empty array when no completions in range', async () => {
      (db.getAllSync as jest.Mock).mockReturnValue([]);

      const result = await repository.findByHabitIdAndDateRange(
        'habit-1',
        '2026-01-01',
        '2026-01-31'
      );

      expect(result).toEqual([]);
    });

    it('should validate startDate is before or equal to endDate', async () => {
      await expect(
        repository.findByHabitIdAndDateRange(
          'habit-1',
          '2026-03-15',
          '2026-03-10'
        )
      ).rejects.toThrow('startDate must be before or equal to endDate');
    });

    it('should validate date formats', async () => {
      await expect(
        repository.findByHabitIdAndDateRange('habit-1', 'invalid', '2026-03-14')
      ).rejects.toThrow();
    });

    it('should validate habitId is not empty', async () => {
      await expect(
        repository.findByHabitIdAndDateRange('', '2026-03-10', '2026-03-14')
      ).rejects.toThrow();
    });
  });

  describe('create', () => {
    it('should create a new completion record', async () => {
      (db.runSync as jest.Mock).mockReturnValue({
        changes: 1,
        lastInsertRowId: 1,
      });

      const result = await repository.create('habit-1', '2026-03-14');

      expect(db.runSync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO completions'),
        expect.any(String), // id (UUID)
        'habit-1',
        '2026-03-14',
        expect.any(String) // createdAt (ISO timestamp)
      );
      expect(result.habitId).toBe('habit-1');
      expect(result.completedDate).toBe('2026-03-14');
      expect(result.id).toBeTruthy();
      expect(result.createdAt).toBeTruthy();
    });

    it('should throw DuplicateCompletionError on unique constraint violation', async () => {
      (db.runSync as jest.Mock).mockImplementation(() => {
        throw new Error('UNIQUE constraint failed');
      });

      await expect(
        repository.create('habit-1', '2026-03-14')
      ).rejects.toThrow(DuplicateCompletionError);
    });

    it('should re-throw non-unique constraint errors', async () => {
      (db.runSync as jest.Mock).mockImplementation(() => {
        throw new Error('FOREIGN KEY constraint failed');
      });

      await expect(
        repository.create('habit-1', '2026-03-14')
      ).rejects.toThrow('FOREIGN KEY constraint failed');
    });

    it('should validate habitId is not empty', async () => {
      await expect(repository.create('', '2026-03-14')).rejects.toThrow();
    });

    it('should validate date format', async () => {
      await expect(repository.create('habit-1', 'bad-date')).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete a completion record', async () => {
      (db.runSync as jest.Mock).mockReturnValue({
        changes: 1,
        lastInsertRowId: 0,
      });

      await repository.delete('habit-1', '2026-03-14');

      expect(db.runSync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM completions'),
        'habit-1',
        '2026-03-14'
      );
    });

    it('should not throw when no record to delete (idempotent)', async () => {
      (db.runSync as jest.Mock).mockReturnValue({
        changes: 0,
        lastInsertRowId: 0,
      });

      await expect(
        repository.delete('habit-1', '2026-03-14')
      ).resolves.toBeUndefined();
    });

    it('should validate habitId is not empty', async () => {
      await expect(repository.delete('', '2026-03-14')).rejects.toThrow();
    });

    it('should validate date format', async () => {
      await expect(repository.delete('habit-1', 'invalid')).rejects.toThrow();
    });
  });
});
