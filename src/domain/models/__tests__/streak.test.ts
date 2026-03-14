import { type Streak, streakSchema } from '../streak';

describe('Streak type', () => {
  it('should represent a streak with current and longest counts', () => {
    const streak: Streak = {
      current: 5,
      longest: 10,
    };

    expect(streak.current).toBe(5);
    expect(streak.longest).toBe(10);
  });

  it('should represent a zero streak', () => {
    const streak: Streak = {
      current: 0,
      longest: 0,
    };

    expect(streak.current).toBe(0);
    expect(streak.longest).toBe(0);
  });
});

describe('streakSchema', () => {
  it('should validate a valid streak', () => {
    const result = streakSchema.safeParse({ current: 5, longest: 10 });
    expect(result.success).toBe(true);
  });

  it('should validate a zero streak', () => {
    const result = streakSchema.safeParse({ current: 0, longest: 0 });
    expect(result.success).toBe(true);
  });

  it('should reject negative current streak', () => {
    const result = streakSchema.safeParse({ current: -1, longest: 5 });
    expect(result.success).toBe(false);
  });

  it('should reject negative longest streak', () => {
    const result = streakSchema.safeParse({ current: 0, longest: -1 });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer current', () => {
    const result = streakSchema.safeParse({ current: 1.5, longest: 5 });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer longest', () => {
    const result = streakSchema.safeParse({ current: 1, longest: 5.5 });
    expect(result.success).toBe(false);
  });
});
