import {
  type Habit,
  type Frequency,
  type DailyFrequency,
  type WeeklyDaysFrequency,
  type WeeklyCountFrequency,
  habitSchema,
  frequencySchema,
  createHabitInputSchema,
} from '../habit';

describe('Frequency type', () => {
  describe('daily frequency', () => {
    it('should represent a daily frequency', () => {
      const freq: DailyFrequency = { type: 'daily' };
      expect(freq.type).toBe('daily');
    });
  });

  describe('weekly_days frequency', () => {
    it('should represent specific days of the week', () => {
      const freq: WeeklyDaysFrequency = { type: 'weekly_days', days: [1, 3, 5] };
      expect(freq.type).toBe('weekly_days');
      expect(freq.days).toEqual([1, 3, 5]);
    });
  });

  describe('weekly_count frequency', () => {
    it('should represent a count per week', () => {
      const freq: WeeklyCountFrequency = { type: 'weekly_count', count: 3 };
      expect(freq.type).toBe('weekly_count');
      expect(freq.count).toBe(3);
    });
  });
});

describe('Habit type', () => {
  it('should represent an active habit', () => {
    const habit: Habit = {
      id: 'habit-1',
      userId: 'user-abc-123',
      name: 'Morning Run',
      frequency: { type: 'daily' },
      color: '#FF5733',
      createdAt: '2026-01-01T00:00:00Z',
      archivedAt: null,
      reminderTime: null,
      lastNotifiedDate: null,
    };

    expect(habit.id).toBe('habit-1');
    expect(habit.userId).toBe('user-abc-123');
    expect(habit.name).toBe('Morning Run');
    expect(habit.archivedAt).toBeNull();
  });

  it('should represent an archived habit', () => {
    const habit: Habit = {
      id: 'habit-2',
      userId: 'user-abc-123',
      name: 'Reading',
      frequency: { type: 'weekly_count', count: 5 },
      color: '#33FF57',
      createdAt: '2026-01-01T00:00:00Z',
      archivedAt: '2026-03-01T00:00:00Z',
      reminderTime: '09:00:00',
      lastNotifiedDate: '2026-03-01',
    };

    expect(habit.archivedAt).toBe('2026-03-01T00:00:00Z');
  });
});

describe('frequencySchema', () => {
  it('should validate daily frequency', () => {
    const result = frequencySchema.safeParse({ type: 'daily' });
    expect(result.success).toBe(true);
  });

  it('should validate weekly_days frequency with valid days', () => {
    const result = frequencySchema.safeParse({
      type: 'weekly_days',
      days: [0, 1, 6],
    });
    expect(result.success).toBe(true);
  });

  it('should reject weekly_days with invalid day number (7)', () => {
    const result = frequencySchema.safeParse({
      type: 'weekly_days',
      days: [0, 7],
    });
    expect(result.success).toBe(false);
  });

  it('should reject weekly_days with negative day number', () => {
    const result = frequencySchema.safeParse({
      type: 'weekly_days',
      days: [-1, 3],
    });
    expect(result.success).toBe(false);
  });

  it('should reject weekly_days with empty days array', () => {
    const result = frequencySchema.safeParse({
      type: 'weekly_days',
      days: [],
    });
    expect(result.success).toBe(false);
  });

  it('should validate weekly_count with valid count', () => {
    const result = frequencySchema.safeParse({
      type: 'weekly_count',
      count: 3,
    });
    expect(result.success).toBe(true);
  });

  it('should reject weekly_count with count 0', () => {
    const result = frequencySchema.safeParse({
      type: 'weekly_count',
      count: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject weekly_count with count greater than 7', () => {
    const result = frequencySchema.safeParse({
      type: 'weekly_count',
      count: 8,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid frequency type', () => {
    const result = frequencySchema.safeParse({
      type: 'monthly',
    });
    expect(result.success).toBe(false);
  });
});

describe('habitSchema', () => {
  const validHabit = {
    id: 'habit-1',
    userId: 'user-abc-123',
    name: 'Morning Run',
    frequency: { type: 'daily' as const },
    color: '#FF5733',
    createdAt: '2026-01-01T00:00:00Z',
    archivedAt: null,
  };

  it('should validate a complete valid habit', () => {
    const result = habitSchema.safeParse(validHabit);
    expect(result.success).toBe(true);
  });

  it('should reject a habit with empty name', () => {
    const result = habitSchema.safeParse({ ...validHabit, name: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a habit with empty id', () => {
    const result = habitSchema.safeParse({ ...validHabit, id: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a habit with empty userId', () => {
    const result = habitSchema.safeParse({ ...validHabit, userId: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a habit without userId', () => {
    const { userId: _, ...habitWithoutUserId } = validHabit;
    const result = habitSchema.safeParse(habitWithoutUserId);
    expect(result.success).toBe(false);
  });

  it('should reject a habit with empty color', () => {
    const result = habitSchema.safeParse({ ...validHabit, color: '' });
    expect(result.success).toBe(false);
  });

  it('should accept a habit with archivedAt as null', () => {
    const result = habitSchema.safeParse(validHabit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.archivedAt).toBeNull();
    }
  });

  it('should accept a habit with archivedAt as a string', () => {
    const result = habitSchema.safeParse({
      ...validHabit,
      archivedAt: '2026-03-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('should accept a habit with reminderTime as null', () => {
    const result = habitSchema.safeParse({
      ...validHabit,
      reminderTime: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reminderTime).toBeNull();
    }
  });

  it('should accept a habit with reminderTime as a string', () => {
    const result = habitSchema.safeParse({
      ...validHabit,
      reminderTime: '09:00:00',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reminderTime).toBe('09:00:00');
    }
  });

  it('should accept a habit with lastNotifiedDate as null', () => {
    const result = habitSchema.safeParse({
      ...validHabit,
      lastNotifiedDate: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lastNotifiedDate).toBeNull();
    }
  });

  it('should accept a habit with lastNotifiedDate as a string', () => {
    const result = habitSchema.safeParse({
      ...validHabit,
      lastNotifiedDate: '2026-03-21',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lastNotifiedDate).toBe('2026-03-21');
    }
  });

  it('should default reminderTime and lastNotifiedDate to null when omitted', () => {
    const result = habitSchema.safeParse(validHabit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reminderTime).toBeNull();
      expect(result.data.lastNotifiedDate).toBeNull();
    }
  });
});

describe('createHabitInputSchema', () => {
  it('should validate a valid create input (without id, createdAt, archivedAt)', () => {
    const result = createHabitInputSchema.safeParse({
      userId: 'user-abc-123',
      name: 'Morning Run',
      frequency: { type: 'daily' },
      color: '#FF5733',
    });
    expect(result.success).toBe(true);
  });

  it('should reject input with empty name', () => {
    const result = createHabitInputSchema.safeParse({
      userId: 'user-abc-123',
      name: '',
      frequency: { type: 'daily' },
      color: '#FF5733',
    });
    expect(result.success).toBe(false);
  });

  it('should reject input with name exceeding max length', () => {
    const result = createHabitInputSchema.safeParse({
      userId: 'user-abc-123',
      name: 'a'.repeat(101),
      frequency: { type: 'daily' },
      color: '#FF5733',
    });
    expect(result.success).toBe(false);
  });

  it('should reject input with missing frequency', () => {
    const result = createHabitInputSchema.safeParse({
      userId: 'user-abc-123',
      name: 'Morning Run',
      color: '#FF5733',
    });
    expect(result.success).toBe(false);
  });

  it('should reject input with missing color', () => {
    const result = createHabitInputSchema.safeParse({
      userId: 'user-abc-123',
      name: 'Morning Run',
      frequency: { type: 'daily' },
    });
    expect(result.success).toBe(false);
  });

  it('should reject input with missing userId', () => {
    const result = createHabitInputSchema.safeParse({
      name: 'Morning Run',
      frequency: { type: 'daily' },
      color: '#FF5733',
    });
    expect(result.success).toBe(false);
  });

  it('should reject input with empty userId', () => {
    const result = createHabitInputSchema.safeParse({
      userId: '',
      name: 'Morning Run',
      frequency: { type: 'daily' },
      color: '#FF5733',
    });
    expect(result.success).toBe(false);
  });
});
