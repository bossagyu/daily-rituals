import { type Streak, streakSchema } from '../streak';

describe('Streak type', () => {
  it('should represent a streak with current, longest, and totalDays counts', () => {
    const streak: Streak = {
      current: 5,
      longest: 10,
      totalDays: 20,
    };

    expect(streak.current).toBe(5);
    expect(streak.longest).toBe(10);
    expect(streak.totalDays).toBe(20);
  });

  it('should represent a zero streak', () => {
    const streak: Streak = {
      current: 0,
      longest: 0,
      totalDays: 0,
    };

    expect(streak.current).toBe(0);
    expect(streak.longest).toBe(0);
    expect(streak.totalDays).toBe(0);
  });
});

describe('streakSchema', () => {
  it('should validate a valid streak', () => {
    const result = streakSchema.safeParse({ current: 5, longest: 10, totalDays: 20 });
    expect(result.success).toBe(true);
  });

  it('should validate a zero streak', () => {
    const result = streakSchema.safeParse({ current: 0, longest: 0, totalDays: 0 });
    expect(result.success).toBe(true);
  });

  it('should reject negative current streak', () => {
    const result = streakSchema.safeParse({ current: -1, longest: 5, totalDays: 10 });
    expect(result.success).toBe(false);
  });

  it('should reject negative longest streak', () => {
    const result = streakSchema.safeParse({ current: 0, longest: -1, totalDays: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer current', () => {
    const result = streakSchema.safeParse({ current: 1.5, longest: 5, totalDays: 10 });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer longest', () => {
    const result = streakSchema.safeParse({ current: 1, longest: 5.5, totalDays: 10 });
    expect(result.success).toBe(false);
  });

  it('should reject negative totalDays', () => {
    const result = streakSchema.safeParse({ current: 0, longest: 0, totalDays: -1 });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer totalDays', () => {
    const result = streakSchema.safeParse({ current: 1, longest: 5, totalDays: 2.5 });
    expect(result.success).toBe(false);
  });
});
