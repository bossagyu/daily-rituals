import { type Reward, rewardSchema, REWARD_DESCRIPTION_MAX_LENGTH } from '../reward';

describe('Reward type', () => {
  it('should represent a reward', () => {
    const reward: Reward = {
      id: 'reward-1',
      userId: 'user-abc-123',
      level: 5,
      description: 'Buy a nice coffee',
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    };

    expect(reward.id).toBe('reward-1');
    expect(reward.level).toBe(5);
    expect(reward.description).toBe('Buy a nice coffee');
  });
});

describe('rewardSchema', () => {
  const validReward = {
    id: 'reward-1',
    userId: 'user-abc-123',
    level: 1,
    description: 'Buy a nice coffee',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  };

  it('should validate a valid reward', () => {
    const result = rewardSchema.safeParse(validReward);
    expect(result.success).toBe(true);
  });

  it('should reject an empty description', () => {
    const result = rewardSchema.safeParse({ ...validReward, description: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a whitespace-only description', () => {
    const result = rewardSchema.safeParse({ ...validReward, description: '   ' });
    expect(result.success).toBe(false);
  });

  it('should reject a description exceeding max length', () => {
    const result = rewardSchema.safeParse({
      ...validReward,
      description: 'a'.repeat(REWARD_DESCRIPTION_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it('should accept a description at max length', () => {
    const result = rewardSchema.safeParse({
      ...validReward,
      description: 'a'.repeat(REWARD_DESCRIPTION_MAX_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it('should reject level 0', () => {
    const result = rewardSchema.safeParse({ ...validReward, level: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject a negative level', () => {
    const result = rewardSchema.safeParse({ ...validReward, level: -1 });
    expect(result.success).toBe(false);
  });

  it('should reject a non-integer level', () => {
    const result = rewardSchema.safeParse({ ...validReward, level: 1.5 });
    expect(result.success).toBe(false);
  });

  it('should reject an empty id', () => {
    const result = rewardSchema.safeParse({ ...validReward, id: '' });
    expect(result.success).toBe(false);
  });

  it('should reject an empty userId', () => {
    const result = rewardSchema.safeParse({ ...validReward, userId: '' });
    expect(result.success).toBe(false);
  });

  it('should reject an empty createdAt', () => {
    const result = rewardSchema.safeParse({ ...validReward, createdAt: '' });
    expect(result.success).toBe(false);
  });

  it('should reject an empty updatedAt', () => {
    const result = rewardSchema.safeParse({ ...validReward, updatedAt: '' });
    expect(result.success).toBe(false);
  });
});
