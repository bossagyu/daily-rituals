import type { Reward, CreateRewardInput, UpdateRewardInput } from '../../domain/models/reward';

/**
 * Repository interface for managing user rewards.
 *
 * Rewards are user-defined achievements unlocked at specific levels.
 */
export type RewardRepository = {
  readonly findAll: () => Promise<Reward[]>;
  readonly create: (input: CreateRewardInput) => Promise<Reward>;
  readonly update: (id: string, input: UpdateRewardInput) => Promise<Reward>;
  readonly remove: (id: string) => Promise<void>;
};

/**
 * Thrown when attempting to create a reward at a level that already has one.
 */
export class DuplicateRewardLevelError extends Error {
  readonly level: number;

  constructor(level: number) {
    super(`Reward already exists for level: ${level}`);
    this.name = 'DuplicateRewardLevelError';
    this.level = level;
  }
}
