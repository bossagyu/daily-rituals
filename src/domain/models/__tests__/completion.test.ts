import { type Completion, completionSchema } from '../completion';

describe('Completion type', () => {
  it('should represent a habit completion', () => {
    const completion: Completion = {
      id: 'comp-1',
      habitId: 'habit-1',
      completedDate: '2026-03-14',
      createdAt: '2026-03-14T08:30:00Z',
    };

    expect(completion.id).toBe('comp-1');
    expect(completion.habitId).toBe('habit-1');
    expect(completion.completedDate).toBe('2026-03-14');
    expect(completion.createdAt).toBe('2026-03-14T08:30:00Z');
  });
});

describe('completionSchema', () => {
  const validCompletion = {
    id: 'comp-1',
    habitId: 'habit-1',
    completedDate: '2026-03-14',
    createdAt: '2026-03-14T08:30:00Z',
  };

  it('should validate a valid completion', () => {
    const result = completionSchema.safeParse(validCompletion);
    expect(result.success).toBe(true);
  });

  it('should reject a completion with empty id', () => {
    const result = completionSchema.safeParse({ ...validCompletion, id: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a completion with empty habitId', () => {
    const result = completionSchema.safeParse({ ...validCompletion, habitId: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a completion with invalid date format', () => {
    const result = completionSchema.safeParse({
      ...validCompletion,
      completedDate: '2026/03/14',
    });
    expect(result.success).toBe(false);
  });

  it('should reject a completion with empty completedDate', () => {
    const result = completionSchema.safeParse({
      ...validCompletion,
      completedDate: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject a completion with empty createdAt', () => {
    const result = completionSchema.safeParse({
      ...validCompletion,
      createdAt: '',
    });
    expect(result.success).toBe(false);
  });
});
