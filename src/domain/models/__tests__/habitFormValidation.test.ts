import {
  validateHabitForm,
  toCreateHabitInput,
  habitToFormState,
  INITIAL_FORM_STATE,
  PRESET_COLORS,
  type HabitFormState,
} from '../habitFormValidation';
import type { Habit } from '../habit';

describe('validateHabitForm', () => {
  const validDailyState: HabitFormState = {
    name: '読書',
    frequencyType: 'daily',
    weeklyDays: [],
    weeklyCount: 1,
    color: PRESET_COLORS[0],
    reminderEnabled: false,
    reminderTime: '',
  };

  describe('daily frequency', () => {
    it('should pass with valid name and color', () => {
      const result = validateHabitForm(validDailyState);
      expect(result.isValid).toBe(true);
    });

    it('should fail when name is empty', () => {
      const state: HabitFormState = { ...validDailyState, name: '' };
      const result = validateHabitForm(state);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors['name']).toBe('習慣名を入力してください');
      }
    });

    it('should fail when name is whitespace only', () => {
      const state: HabitFormState = { ...validDailyState, name: '   ' };
      const result = validateHabitForm(state);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors['name']).toBe('習慣名を入力してください');
      }
    });

    it('should fail when name exceeds 100 characters', () => {
      const state: HabitFormState = {
        ...validDailyState,
        name: 'a'.repeat(101),
      };
      const result = validateHabitForm(state);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors['name']).toContain('100文字以内');
      }
    });

    it('should fail when color is empty', () => {
      const state: HabitFormState = { ...validDailyState, color: '' };
      const result = validateHabitForm(state);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors['color']).toBeDefined();
      }
    });
  });

  describe('weekly_days frequency', () => {
    const validWeeklyDaysState: HabitFormState = {
      name: '運動',
      frequencyType: 'weekly_days',
      weeklyDays: [1, 3, 5],
      weeklyCount: 1,
      color: PRESET_COLORS[1],
      reminderEnabled: false,
      reminderTime: '',
    };

    it('should pass with valid days selected', () => {
      const result = validateHabitForm(validWeeklyDaysState);
      expect(result.isValid).toBe(true);
    });

    it('should fail when no days are selected', () => {
      const state: HabitFormState = {
        ...validWeeklyDaysState,
        weeklyDays: [],
      };
      const result = validateHabitForm(state);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors['weeklyDays']).toBe(
          '曜日を1つ以上選択してください'
        );
      }
    });

    it('should pass with a single day selected', () => {
      const state: HabitFormState = {
        ...validWeeklyDaysState,
        weeklyDays: [0],
      };
      const result = validateHabitForm(state);
      expect(result.isValid).toBe(true);
    });
  });

  describe('weekly_count frequency', () => {
    const validWeeklyCountState: HabitFormState = {
      name: 'ジョギング',
      frequencyType: 'weekly_count',
      weeklyDays: [],
      weeklyCount: 3,
      color: PRESET_COLORS[2],
      reminderEnabled: false,
      reminderTime: '',
    };

    it('should pass with valid count', () => {
      const result = validateHabitForm(validWeeklyCountState);
      expect(result.isValid).toBe(true);
    });

    it('should pass with count of 1', () => {
      const state: HabitFormState = {
        ...validWeeklyCountState,
        weeklyCount: 1,
      };
      const result = validateHabitForm(state);
      expect(result.isValid).toBe(true);
    });

    it('should pass with count of 7', () => {
      const state: HabitFormState = {
        ...validWeeklyCountState,
        weeklyCount: 7,
      };
      const result = validateHabitForm(state);
      expect(result.isValid).toBe(true);
    });

    it('should fail with count of 0', () => {
      const state: HabitFormState = {
        ...validWeeklyCountState,
        weeklyCount: 0,
      };
      const result = validateHabitForm(state);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors['weeklyCount']).toBeDefined();
      }
    });

    it('should fail with count of 8', () => {
      const state: HabitFormState = {
        ...validWeeklyCountState,
        weeklyCount: 8,
      };
      const result = validateHabitForm(state);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors['weeklyCount']).toBeDefined();
      }
    });
  });

  describe('reminder validation', () => {
    const validDailyState: HabitFormState = {
      name: '読書',
      frequencyType: 'daily',
      weeklyDays: [],
      weeklyCount: 1,
      color: PRESET_COLORS[0],
      reminderEnabled: false,
      reminderTime: '',
    };

    it('should pass with reminder enabled and time set', () => {
      const state: HabitFormState = {
        ...validDailyState,
        reminderEnabled: true,
        reminderTime: '08:00',
      };
      const result = validateHabitForm(state);
      expect(result.isValid).toBe(true);
    });

    it('should fail with reminder enabled but no time set', () => {
      const state: HabitFormState = {
        ...validDailyState,
        reminderEnabled: true,
        reminderTime: '',
      };
      const result = validateHabitForm(state);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors['reminderTime']).toBe(
          'リマインダー時刻を選択してください'
        );
      }
    });

    it('should skip reminder validation when disabled', () => {
      const state: HabitFormState = {
        ...validDailyState,
        reminderEnabled: false,
        reminderTime: '',
      };
      const result = validateHabitForm(state);
      expect(result.isValid).toBe(true);
    });
  });
});

describe('toCreateHabitInput', () => {
  it('should convert daily form state to CreateHabitInput', () => {
    const state: HabitFormState = {
      name: '読書',
      frequencyType: 'daily',
      weeklyDays: [],
      weeklyCount: 1,
      color: PRESET_COLORS[0],
      reminderEnabled: false,
      reminderTime: '',
    };

    const result = toCreateHabitInput(state, 'user-abc-123');

    expect(result).toEqual({
      userId: 'user-abc-123',
      name: '読書',
      frequency: { type: 'daily' },
      color: PRESET_COLORS[0],
      reminderTime: null,
    });
  });

  it('should convert weekly_days form state to CreateHabitInput', () => {
    const state: HabitFormState = {
      name: '運動',
      frequencyType: 'weekly_days',
      weeklyDays: [1, 3, 5],
      weeklyCount: 1,
      color: PRESET_COLORS[1],
      reminderEnabled: false,
      reminderTime: '',
    };

    const result = toCreateHabitInput(state, 'user-abc-123');

    expect(result).toEqual({
      userId: 'user-abc-123',
      name: '運動',
      frequency: { type: 'weekly_days', days: [1, 3, 5] },
      color: PRESET_COLORS[1],
      reminderTime: null,
    });
  });

  it('should convert weekly_count form state to CreateHabitInput', () => {
    const state: HabitFormState = {
      name: 'ジョギング',
      frequencyType: 'weekly_count',
      weeklyDays: [],
      weeklyCount: 3,
      color: PRESET_COLORS[2],
      reminderEnabled: false,
      reminderTime: '',
    };

    const result = toCreateHabitInput(state, 'user-abc-123');

    expect(result).toEqual({
      userId: 'user-abc-123',
      name: 'ジョギング',
      frequency: { type: 'weekly_count', count: 3 },
      color: PRESET_COLORS[2],
      reminderTime: null,
    });
  });

  it('should trim whitespace from name', () => {
    const state: HabitFormState = {
      name: '  読書  ',
      frequencyType: 'daily',
      weeklyDays: [],
      weeklyCount: 1,
      color: PRESET_COLORS[0],
      reminderEnabled: false,
      reminderTime: '',
    };

    const result = toCreateHabitInput(state, 'user-abc-123');
    expect(result.name).toBe('読書');
  });
});

describe('habitToFormState', () => {
  it('should convert daily habit to form state', () => {
    const habit: Habit = {
      id: '1',
      userId: 'user-abc-123',
      name: '読書',
      frequency: { type: 'daily' },
      color: PRESET_COLORS[0],
      createdAt: '2026-01-01T00:00:00.000Z',
      archivedAt: null,
      reminderTime: null,
      lastNotifiedDate: null,
    };

    const result = habitToFormState(habit);

    expect(result).toEqual({
      name: '読書',
      frequencyType: 'daily',
      weeklyDays: [],
      weeklyCount: 1,
      color: PRESET_COLORS[0],
      reminderEnabled: false,
      reminderTime: '',
    });
  });

  it('should convert weekly_days habit to form state', () => {
    const habit: Habit = {
      id: '2',
      userId: 'user-abc-123',
      name: '運動',
      frequency: { type: 'weekly_days', days: [1, 3, 5] },
      color: PRESET_COLORS[1],
      createdAt: '2026-01-01T00:00:00.000Z',
      archivedAt: null,
      reminderTime: null,
      lastNotifiedDate: null,
    };

    const result = habitToFormState(habit);

    expect(result).toEqual({
      name: '運動',
      frequencyType: 'weekly_days',
      weeklyDays: [1, 3, 5],
      weeklyCount: 1,
      color: PRESET_COLORS[1],
      reminderEnabled: false,
      reminderTime: '',
    });
  });

  it('should convert weekly_count habit to form state', () => {
    const habit: Habit = {
      id: '3',
      userId: 'user-abc-123',
      name: 'ジョギング',
      frequency: { type: 'weekly_count', count: 3 },
      color: PRESET_COLORS[2],
      createdAt: '2026-01-01T00:00:00.000Z',
      archivedAt: null,
      reminderTime: null,
      lastNotifiedDate: null,
    };

    const result = habitToFormState(habit);

    expect(result).toEqual({
      name: 'ジョギング',
      frequencyType: 'weekly_count',
      weeklyDays: [],
      weeklyCount: 3,
      color: PRESET_COLORS[2],
      reminderEnabled: false,
      reminderTime: '',
    });
  });

  it('should convert habit with reminderTime to form state with reminderEnabled true', () => {
    const habit: Habit = {
      id: '4',
      userId: 'user-abc-123',
      name: '瞑想',
      frequency: { type: 'daily' },
      color: PRESET_COLORS[0],
      createdAt: '2026-01-01T00:00:00.000Z',
      archivedAt: null,
      reminderTime: '07:00:00',
      lastNotifiedDate: null,
    };

    const result = habitToFormState(habit);

    expect(result.reminderEnabled).toBe(true);
    expect(result.reminderTime).toBe('07:00');
  });

  it('should convert habit without reminderTime to form state with reminderEnabled false', () => {
    const habit: Habit = {
      id: '5',
      userId: 'user-abc-123',
      name: '瞑想',
      frequency: { type: 'daily' },
      color: PRESET_COLORS[0],
      createdAt: '2026-01-01T00:00:00.000Z',
      archivedAt: null,
      reminderTime: null,
      lastNotifiedDate: null,
    };

    const result = habitToFormState(habit);

    expect(result.reminderEnabled).toBe(false);
    expect(result.reminderTime).toBe('');
  });
});

describe('INITIAL_FORM_STATE', () => {
  it('should have sensible defaults', () => {
    expect(INITIAL_FORM_STATE.name).toBe('');
    expect(INITIAL_FORM_STATE.frequencyType).toBe('daily');
    expect(INITIAL_FORM_STATE.weeklyDays).toEqual([]);
    expect(INITIAL_FORM_STATE.weeklyCount).toBe(1);
    expect(INITIAL_FORM_STATE.color).toBe(PRESET_COLORS[0]);
    expect(INITIAL_FORM_STATE.reminderEnabled).toBe(false);
    expect(INITIAL_FORM_STATE.reminderTime).toBe('');
  });
});

describe('PRESET_COLORS', () => {
  it('should have at least 6 colors', () => {
    expect(PRESET_COLORS.length).toBeGreaterThanOrEqual(6);
  });

  it('should all be valid hex color strings', () => {
    for (const color of PRESET_COLORS) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
