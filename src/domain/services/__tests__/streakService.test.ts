import { calculateStreak } from '../streakService';
import { Habit, Completion } from '../../models';

// --- Helpers ---

const makeHabit = (frequency: Habit['frequency']): Habit => ({
  id: 'habit-1',
  userId: 'user-abc-123',
  name: 'Test Habit',
  frequency,
  color: '#FF0000',
  createdAt: '2025-01-01T00:00:00Z',
  archivedAt: null,
  reminderTime: null,
  lastNotifiedDate: null,
});

const makeCompletion = (habitId: string, completedDate: string): Completion => ({
  id: `comp-${completedDate}`,
  userId: 'user-abc-123',
  habitId,
  completedDate,
  createdAt: `${completedDate}T12:00:00Z`,
});

const makeCompletions = (habitId: string, dates: readonly string[]): readonly Completion[] =>
  dates.map((date) => makeCompletion(habitId, date));

// --- Daily ---

describe('calculateStreak - daily', () => {
  const habit = makeHabit({ type: 'daily' });

  it('returns zero streak when there are no completions', () => {
    const result = calculateStreak(habit, [], '2025-03-10');
    expect(result).toEqual({ current: 0, longest: 0, totalDays: 0 });
  });

  it('returns current:1 when only today is completed', () => {
    const completions = makeCompletions('habit-1', ['2025-03-10']);
    const result = calculateStreak(habit, completions, '2025-03-10');
    expect(result).toEqual({ current: 1, longest: 1, totalDays: 1 });
  });

  it('counts consecutive days including today', () => {
    const completions = makeCompletions('habit-1', [
      '2025-03-07',
      '2025-03-08',
      '2025-03-09',
      '2025-03-10',
    ]);
    const result = calculateStreak(habit, completions, '2025-03-10');
    expect(result).toEqual({ current: 4, longest: 4, totalDays: 4 });
  });

  it('counts consecutive days when today is not completed (streak from yesterday)', () => {
    const completions = makeCompletions('habit-1', [
      '2025-03-07',
      '2025-03-08',
      '2025-03-09',
    ]);
    const result = calculateStreak(habit, completions, '2025-03-10');
    expect(result).toEqual({ current: 3, longest: 3, totalDays: 3 });
  });

  it('returns current:0 when yesterday is not completed and today is not completed', () => {
    const completions = makeCompletions('habit-1', ['2025-03-08']);
    const result = calculateStreak(habit, completions, '2025-03-10');
    expect(result).toEqual({ current: 0, longest: 1, totalDays: 1 });
  });

  it('returns current:1 when yesterday is not completed but today is completed', () => {
    const completions = makeCompletions('habit-1', ['2025-03-08', '2025-03-10']);
    const result = calculateStreak(habit, completions, '2025-03-10');
    expect(result).toEqual({ current: 1, longest: 1, totalDays: 2 });
  });

  it('tracks longest streak separately from current', () => {
    // Had a 5-day streak earlier, then a gap, now 2-day streak
    const completions = makeCompletions('habit-1', [
      '2025-03-01',
      '2025-03-02',
      '2025-03-03',
      '2025-03-04',
      '2025-03-05',
      // gap on 03-06 through 03-08
      '2025-03-09',
      '2025-03-10',
    ]);
    const result = calculateStreak(habit, completions, '2025-03-10');
    expect(result).toEqual({ current: 2, longest: 5, totalDays: 7 });
  });

  it('handles unsorted completions correctly', () => {
    const completions = makeCompletions('habit-1', [
      '2025-03-10',
      '2025-03-08',
      '2025-03-09',
    ]);
    const result = calculateStreak(habit, completions, '2025-03-10');
    expect(result).toEqual({ current: 3, longest: 3, totalDays: 3 });
  });

  it('handles duplicate completion dates', () => {
    const completions = makeCompletions('habit-1', [
      '2025-03-09',
      '2025-03-09',
      '2025-03-10',
    ]);
    const result = calculateStreak(habit, completions, '2025-03-10');
    expect(result).toEqual({ current: 2, longest: 2, totalDays: 2 });
  });

  it('longest equals current when current is the best streak', () => {
    const completions = makeCompletions('habit-1', [
      '2025-03-08',
      '2025-03-09',
      '2025-03-10',
    ]);
    const result = calculateStreak(habit, completions, '2025-03-10');
    expect(result).toEqual({ current: 3, longest: 3, totalDays: 3 });
  });
});

// --- Weekly Days ---

describe('calculateStreak - weekly_days', () => {
  // Mon=1, Wed=3, Fri=5
  const habit = makeHabit({ type: 'weekly_days', days: [1, 3, 5] });

  it('returns zero streak when there are no completions', () => {
    const result = calculateStreak(habit, [], '2025-03-10');
    expect(result).toEqual({ current: 0, longest: 0, totalDays: 0 });
  });

  it('counts streak for consecutive target days completed', () => {
    // 2025-03-10 is Monday(1), 2025-03-07 is Friday(5), 2025-03-05 is Wednesday(3)
    const completions = makeCompletions('habit-1', [
      '2025-03-05', // Wed
      '2025-03-07', // Fri
      '2025-03-10', // Mon
    ]);
    const result = calculateStreak(habit, completions, '2025-03-10');
    expect(result).toEqual({ current: 3, longest: 3, totalDays: 3 });
  });

  it('breaks streak when a target day is missed', () => {
    // Only Mon(1) and Wed(3) are targets.
    // Target days in order: Mon 3/3, Wed 3/5, Mon 3/10, Wed 3/12
    // Complete Mon 3/3 and Mon 3/10 but skip Wed 3/5 -> streak breaks
    const habit2 = makeHabit({ type: 'weekly_days', days: [1, 3] });
    const completions = makeCompletions('habit-1', [
      '2025-03-03', // Mon (completed)
      // Wed 3/5 missed
      '2025-03-10', // Mon (completed)
    ]);
    const result = calculateStreak(habit2, completions, '2025-03-10');
    expect(result).toEqual({ current: 1, longest: 1, totalDays: 2 });
  });

  it('streak from last target day when today is not a target day', () => {
    // Today is Tue(2), targets are Mon(1), Wed(3), Fri(5)
    // Mon was completed
    const completions = makeCompletions('habit-1', [
      '2025-03-07', // Fri
      '2025-03-10', // Mon
    ]);
    // Checking on Tuesday 2025-03-11
    const result = calculateStreak(habit, completions, '2025-03-11');
    expect(result).toEqual({ current: 2, longest: 2, totalDays: 2 });
  });

  it('streak broken when most recent target day is missed', () => {
    // Mon(1), Wed(3), Fri(5). Today is Thu(4).
    // Wed(3/12) was not completed, Mon(3/10) was.
    const completions = makeCompletions('habit-1', ['2025-03-10']); // Mon
    const result = calculateStreak(habit, completions, '2025-03-13'); // Thu
    // Wed 3/12 was a target day that was missed
    expect(result).toEqual({ current: 0, longest: 1, totalDays: 1 });
  });

  it('handles today being a target day but not completed', () => {
    // Today is Mon(1), Mon is a target. Not completed today yet.
    // Fri was completed.
    const completions = makeCompletions('habit-1', ['2025-03-07']); // Fri
    const result = calculateStreak(habit, completions, '2025-03-10'); // Mon
    // Today is a target day but not completed yet - streak continues from last completed target day
    expect(result).toEqual({ current: 1, longest: 1, totalDays: 1 });
  });

  it('tracks longest streak correctly', () => {
    const habit2 = makeHabit({ type: 'weekly_days', days: [1, 5] }); // Mon, Fri
    const completions = makeCompletions('habit-1', [
      '2025-02-24', // Mon
      '2025-02-28', // Fri
      '2025-03-03', // Mon - 3 consecutive target days
      // gap: 2025-03-07 Fri missed
      '2025-03-10', // Mon
    ]);
    const result = calculateStreak(habit2, completions, '2025-03-10');
    expect(result).toEqual({ current: 1, longest: 3, totalDays: 4 });
  });
});

// --- Weekly Count ---

describe('calculateStreak - weekly_count', () => {
  // 3 times per week
  const habit = makeHabit({ type: 'weekly_count', count: 3 });

  it('returns zero streak when there are no completions', () => {
    const result = calculateStreak(habit, [], '2025-03-10');
    expect(result).toEqual({ current: 0, longest: 0, totalDays: 0 });
  });

  it('counts consecutive weeks where target count was met', () => {
    // Week of 3/3-3/9: 3 completions, Week of 3/10-3/16: 3 completions (current week)
    // Using Monday as week start
    const completions = makeCompletions('habit-1', [
      '2025-03-03', // Mon
      '2025-03-05', // Wed
      '2025-03-07', // Fri
      '2025-03-10', // Mon
      '2025-03-11', // Tue
      '2025-03-12', // Wed
    ]);
    const result = calculateStreak(habit, completions, '2025-03-12');
    expect(result).toEqual({ current: 2, longest: 2, totalDays: 6 });
  });

  it('current week counts if target is met', () => {
    const completions = makeCompletions('habit-1', [
      '2025-03-10',
      '2025-03-11',
      '2025-03-12',
    ]);
    const result = calculateStreak(habit, completions, '2025-03-14');
    expect(result).toEqual({ current: 1, longest: 1, totalDays: 3 });
  });

  it('current week does not count if target is not yet met, but streak continues from previous weeks', () => {
    // Last week met target (3), current week only 1 so far
    const completions = makeCompletions('habit-1', [
      '2025-03-03',
      '2025-03-05',
      '2025-03-07',
      '2025-03-10', // current week, only 1
    ]);
    const result = calculateStreak(habit, completions, '2025-03-10');
    expect(result).toEqual({ current: 1, longest: 1, totalDays: 4 });
  });

  it('streak breaks when a week does not meet target count', () => {
    // Week of 2/24: 3 completions
    // Week of 3/3: only 2 completions (not enough)
    // Week of 3/10: 3 completions
    const completions = makeCompletions('habit-1', [
      '2025-02-24',
      '2025-02-25',
      '2025-02-26',
      '2025-03-03',
      '2025-03-04',
      // only 2 in week of 3/3
      '2025-03-10',
      '2025-03-11',
      '2025-03-12',
    ]);
    const result = calculateStreak(habit, completions, '2025-03-12');
    expect(result).toEqual({ current: 1, longest: 1, totalDays: 8 });
  });

  it('tracks longest streak correctly', () => {
    // 3 consecutive weeks met, then gap, then 1 week met
    const completions = makeCompletions('habit-1', [
      // Week of 2/17
      '2025-02-17',
      '2025-02-18',
      '2025-02-19',
      // Week of 2/24
      '2025-02-24',
      '2025-02-25',
      '2025-02-26',
      // Week of 3/3
      '2025-03-03',
      '2025-03-04',
      '2025-03-05',
      // Week of 3/10: only 1 (gap)
      '2025-03-10',
      // Week of 3/17
      '2025-03-17',
      '2025-03-18',
      '2025-03-19',
    ]);
    const result = calculateStreak(habit, completions, '2025-03-19');
    expect(result).toEqual({ current: 1, longest: 3, totalDays: 13 });
  });

  it('handles count of 1 (at least once per week)', () => {
    const habit1 = makeHabit({ type: 'weekly_count', count: 1 });
    const completions = makeCompletions('habit-1', [
      '2025-03-03',
      '2025-03-10',
    ]);
    const result = calculateStreak(habit1, completions, '2025-03-10');
    expect(result).toEqual({ current: 2, longest: 2, totalDays: 2 });
  });
});

// --- Edge Cases ---

describe('calculateStreak - edge cases', () => {
  it('ignores completions for other habits', () => {
    const habit = makeHabit({ type: 'daily' });
    const completions = [
      makeCompletion('other-habit', '2025-03-09'),
      makeCompletion('habit-1', '2025-03-10'),
    ];
    const result = calculateStreak(habit, completions, '2025-03-10');
    expect(result).toEqual({ current: 1, longest: 1, totalDays: 1 });
  });

  it('longest is always >= current', () => {
    const habit = makeHabit({ type: 'daily' });
    const completions = makeCompletions('habit-1', [
      '2025-03-01',
      '2025-03-02',
      '2025-03-03',
      '2025-03-10',
    ]);
    const result = calculateStreak(habit, completions, '2025-03-10');
    expect(result.longest).toBeGreaterThanOrEqual(result.current);
  });

  it('returns immutable Streak object', () => {
    const habit = makeHabit({ type: 'daily' });
    const completions = makeCompletions('habit-1', ['2025-03-10']);
    const result = calculateStreak(habit, completions, '2025-03-10');
    expect(Object.isFrozen(result)).toBe(true);
  });
});
