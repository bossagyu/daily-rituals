import { z } from 'zod';

export const REWARD_DESCRIPTION_MAX_LENGTH = 200;

export type Reward = {
  readonly id: string;
  readonly userId: string;
  readonly level: number;
  readonly description: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export const rewardSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  level: z.number().int().min(1),
  description: z.string().trim().min(1).max(REWARD_DESCRIPTION_MAX_LENGTH),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type CreateRewardInput = {
  readonly level: number;
  readonly description: string;
};

export type UpdateRewardInput = {
  readonly description: string;
};
