import {
  habitSchema,
  frequencySchema,
  createHabitInputSchema,
  completionSchema,
  streakSchema,
} from '../index';

describe('domain/models/index', () => {
  it('should re-export habitSchema', () => {
    expect(habitSchema).toBeDefined();
  });

  it('should re-export frequencySchema', () => {
    expect(frequencySchema).toBeDefined();
  });

  it('should re-export createHabitInputSchema', () => {
    expect(createHabitInputSchema).toBeDefined();
  });

  it('should re-export completionSchema', () => {
    expect(completionSchema).toBeDefined();
  });

  it('should re-export streakSchema', () => {
    expect(streakSchema).toBeDefined();
  });
});
