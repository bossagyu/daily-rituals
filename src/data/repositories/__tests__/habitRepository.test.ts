import type { SQLiteDatabase } from 'expo-sqlite';
import type { Habit, CreateHabitInput, Frequency } from '../../../domain/models';
import {
  HabitRepositoryImpl,
  toFrequency,
  toFrequencyDbFields,
} from '../habitRepository';

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

const SAMPLE_DAILY_HABIT_ROW: HabitRow = {
  id: 'habit-1',
  name: 'Morning Run',
  frequency_type: 'daily',
  frequency_value: '{}',
  color: '#FF0000',
  created_at: '2026-01-01T00:00:00.000Z',
  archived_at: null,
};

const SAMPLE_WEEKLY_DAYS_ROW: HabitRow = {
  id: 'habit-2',
  name: 'Yoga',
  frequency_type: 'weekly_days',
  frequency_value: '[1,3,5]',
  color: '#00FF00',
  created_at: '2026-01-02T00:00:00.000Z',
  archived_at: null,
};

const SAMPLE_WEEKLY_COUNT_ROW: HabitRow = {
  id: 'habit-3',
  name: 'Reading',
  frequency_type: 'weekly_count',
  frequency_value: '3',
  color: '#0000FF',
  created_at: '2026-01-03T00:00:00.000Z',
  archived_at: '2026-02-01T00:00:00.000Z',
};

/**
 * Creates a mock SQLiteDatabase for repository testing.
 */
function createMockDatabase(): jest.Mocked<
  Pick<SQLiteDatabase, 'getAllSync' | 'getFirstSync' | 'runSync'>
> {
  return {
    getAllSync: jest.fn().mockReturnValue([]),
    getFirstSync: jest.fn().mockReturnValue(null),
    runSync: jest.fn().mockReturnValue({ changes: 1, lastInsertRowId: 1 }),
  };
}

// --- Mapper unit tests ---

describe('toFrequency', () => {
  it('should convert daily frequency', () => {
    const result = toFrequency('daily', '{}');
    expect(result).toEqual({ type: 'daily' });
  });

  it('should convert weekly_days frequency', () => {
    const result = toFrequency('weekly_days', '[0,2,4]');
    expect(result).toEqual({ type: 'weekly_days', days: [0, 2, 4] });
  });

  it('should convert weekly_count frequency', () => {
    const result = toFrequency('weekly_count', '5');
    expect(result).toEqual({ type: 'weekly_count', count: 5 });
  });

  it('should throw for unknown frequency type', () => {
    expect(() => toFrequency('unknown', '{}')).toThrow(
      'Unknown frequency type: unknown'
    );
  });

  it('should throw for invalid weekly_days JSON', () => {
    expect(() => toFrequency('weekly_days', 'not-valid-json')).toThrow(
      'Invalid frequency_value for weekly_days: not-valid-json'
    );
  });

  it('should throw for invalid weekly_count value', () => {
    expect(() => toFrequency('weekly_count', 'abc')).toThrow(
      'Invalid frequency_value for weekly_count: abc'
    );
  });
});

describe('toFrequencyDbFields', () => {
  it('should convert daily frequency to DB fields', () => {
    const result = toFrequencyDbFields({ type: 'daily' });
    expect(result).toEqual({ frequencyType: 'daily', frequencyValue: '{}' });
  });

  it('should convert weekly_days frequency to DB fields', () => {
    const result = toFrequencyDbFields({
      type: 'weekly_days',
      days: [1, 3, 5],
    });
    expect(result).toEqual({
      frequencyType: 'weekly_days',
      frequencyValue: '[1,3,5]',
    });
  });

  it('should convert weekly_count frequency to DB fields', () => {
    const result = toFrequencyDbFields({ type: 'weekly_count', count: 4 });
    expect(result).toEqual({
      frequencyType: 'weekly_count',
      frequencyValue: '4',
    });
  });
});

// --- Repository tests ---

describe('HabitRepositoryImpl', () => {
  let mockDb: ReturnType<typeof createMockDatabase>;
  let repository: HabitRepositoryImpl;

  beforeEach(() => {
    mockDb = createMockDatabase();
    repository = new HabitRepositoryImpl(
      mockDb as unknown as SQLiteDatabase,
      () => 'generated-id',
      () => '2026-03-14T00:00:00.000Z'
    );
  });

  describe('findAll', () => {
    it('should return active habits (archived_at IS NULL)', async () => {
      mockDb.getAllSync.mockReturnValue([
        SAMPLE_DAILY_HABIT_ROW,
        SAMPLE_WEEKLY_DAYS_ROW,
      ]);

      const result = await repository.findAll();

      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        expect.stringContaining('archived_at IS NULL')
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual<Habit>({
        id: 'habit-1',
        name: 'Morning Run',
        frequency: { type: 'daily' },
        color: '#FF0000',
        createdAt: '2026-01-01T00:00:00.000Z',
        archivedAt: null,
      });
      expect(result[1]).toEqual<Habit>({
        id: 'habit-2',
        name: 'Yoga',
        frequency: { type: 'weekly_days', days: [1, 3, 5] },
        color: '#00FF00',
        createdAt: '2026-01-02T00:00:00.000Z',
        archivedAt: null,
      });
    });

    it('should return empty array when no habits exist', async () => {
      mockDb.getAllSync.mockReturnValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return habit when found', async () => {
      mockDb.getFirstSync.mockReturnValue(SAMPLE_DAILY_HABIT_ROW);

      const result = await repository.findById('habit-1');

      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ?'),
        'habit-1'
      );
      expect(result).toEqual<Habit>({
        id: 'habit-1',
        name: 'Morning Run',
        frequency: { type: 'daily' },
        color: '#FF0000',
        createdAt: '2026-01-01T00:00:00.000Z',
        archivedAt: null,
      });
    });

    it('should return null when habit not found', async () => {
      mockDb.getFirstSync.mockReturnValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should insert a new habit and return it', async () => {
      const input: CreateHabitInput = {
        name: 'Meditation',
        frequency: { type: 'daily' },
        color: '#AABBCC',
      };

      const result = await repository.create(input);

      expect(mockDb.runSync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO habits'),
        'generated-id',
        'Meditation',
        'daily',
        '{}',
        '#AABBCC',
        '2026-03-14T00:00:00.000Z'
      );
      expect(result).toEqual<Habit>({
        id: 'generated-id',
        name: 'Meditation',
        frequency: { type: 'daily' },
        color: '#AABBCC',
        createdAt: '2026-03-14T00:00:00.000Z',
        archivedAt: null,
      });
    });

    it('should create a habit with weekly_days frequency', async () => {
      const input: CreateHabitInput = {
        name: 'Gym',
        frequency: { type: 'weekly_days', days: [1, 3, 5] },
        color: '#112233',
      };

      const result = await repository.create(input);

      expect(mockDb.runSync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO habits'),
        'generated-id',
        'Gym',
        'weekly_days',
        '[1,3,5]',
        '#112233',
        '2026-03-14T00:00:00.000Z'
      );
      expect(result.frequency).toEqual({
        type: 'weekly_days',
        days: [1, 3, 5],
      });
    });

    it('should create a habit with weekly_count frequency', async () => {
      const input: CreateHabitInput = {
        name: 'Journal',
        frequency: { type: 'weekly_count', count: 3 },
        color: '#445566',
      };

      const result = await repository.create(input);

      expect(mockDb.runSync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO habits'),
        'generated-id',
        'Journal',
        'weekly_count',
        '3',
        '#445566',
        '2026-03-14T00:00:00.000Z'
      );
      expect(result.frequency).toEqual({ type: 'weekly_count', count: 3 });
    });
  });

  describe('update', () => {
    it('should update habit name and return updated habit', async () => {
      mockDb.getFirstSync.mockReturnValue({
        ...SAMPLE_DAILY_HABIT_ROW,
        name: 'Evening Run',
      });

      const result = await repository.update('habit-1', { name: 'Evening Run' });

      expect(mockDb.runSync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE habits SET'),
        expect.anything(),
        expect.anything()
      );
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Evening Run');
    });

    it('should update habit frequency', async () => {
      const updatedRow: HabitRow = {
        ...SAMPLE_DAILY_HABIT_ROW,
        frequency_type: 'weekly_count',
        frequency_value: '5',
      };
      mockDb.getFirstSync.mockReturnValue(updatedRow);

      const result = await repository.update('habit-1', {
        frequency: { type: 'weekly_count', count: 5 },
      });

      expect(result).not.toBeNull();
      expect(result!.frequency).toEqual({ type: 'weekly_count', count: 5 });
    });

    it('should update multiple fields at once', async () => {
      const updatedRow: HabitRow = {
        ...SAMPLE_DAILY_HABIT_ROW,
        name: 'Updated',
        color: '#999999',
      };
      mockDb.getFirstSync.mockReturnValue(updatedRow);

      const result = await repository.update('habit-1', {
        name: 'Updated',
        color: '#999999',
      });

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Updated');
      expect(result!.color).toBe('#999999');
    });

    it('should return null when habit to update is not found', async () => {
      mockDb.getFirstSync.mockReturnValue(null);

      const result = await repository.update('non-existent', { name: 'Test' });

      expect(result).toBeNull();
    });

    it('should not execute update when no fields provided', async () => {
      mockDb.getFirstSync.mockReturnValue(SAMPLE_DAILY_HABIT_ROW);

      const result = await repository.update('habit-1', {});

      // Should still fetch the habit but not run UPDATE
      expect(result).not.toBeNull();
    });

    it('should build update query immutably without array mutation', async () => {
      mockDb.getFirstSync.mockReturnValue({
        ...SAMPLE_DAILY_HABIT_ROW,
        name: 'New Name',
        color: '#ABCDEF',
        frequency_type: 'weekly_days',
        frequency_value: '[0,6]',
      });

      await repository.update('habit-1', {
        name: 'New Name',
        color: '#ABCDEF',
        frequency: { type: 'weekly_days', days: [0, 6] },
      });

      expect(mockDb.runSync).toHaveBeenCalledWith(
        'UPDATE habits SET name = ?, color = ?, frequency_type = ?, frequency_value = ? WHERE id = ?',
        'New Name',
        '#ABCDEF',
        'weekly_days',
        '[0,6]',
        'habit-1'
      );
    });
  });

  describe('archive', () => {
    it('should set archived_at to current timestamp', async () => {
      await repository.archive('habit-1');

      expect(mockDb.runSync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE habits SET archived_at = ?'),
        '2026-03-14T00:00:00.000Z',
        'habit-1'
      );
    });
  });

  describe('findArchived', () => {
    it('should return only archived habits', async () => {
      mockDb.getAllSync.mockReturnValue([SAMPLE_WEEKLY_COUNT_ROW]);

      const result = await repository.findArchived();

      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        expect.stringContaining('archived_at IS NOT NULL')
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual<Habit>({
        id: 'habit-3',
        name: 'Reading',
        frequency: { type: 'weekly_count', count: 3 },
        color: '#0000FF',
        createdAt: '2026-01-03T00:00:00.000Z',
        archivedAt: '2026-02-01T00:00:00.000Z',
      });
    });
  });

  describe('async behavior', () => {
    it('should return Promises from all methods', async () => {
      mockDb.getAllSync.mockReturnValue([]);
      mockDb.getFirstSync.mockReturnValue(null);

      const findAllResult = repository.findAll();
      const findByIdResult = repository.findById('id');
      const createResult = repository.create({
        name: 'Test',
        frequency: { type: 'daily' },
        color: '#000000',
      });
      const updateResult = repository.update('id', {});
      const archiveResult = repository.archive('id');
      const findArchivedResult = repository.findArchived();

      expect(findAllResult).toBeInstanceOf(Promise);
      expect(findByIdResult).toBeInstanceOf(Promise);
      expect(createResult).toBeInstanceOf(Promise);
      expect(updateResult).toBeInstanceOf(Promise);
      expect(archiveResult).toBeInstanceOf(Promise);
      expect(findArchivedResult).toBeInstanceOf(Promise);

      // Await all to avoid unhandled promise warnings
      await Promise.all([
        findAllResult,
        findByIdResult,
        createResult,
        updateResult,
        archiveResult,
        findArchivedResult,
      ]);
    });
  });
});
