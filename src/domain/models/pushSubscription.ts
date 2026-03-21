import { z } from 'zod';

export type PushSubscription = {
  readonly id: string;
  readonly userId: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly createdAt: string;
};

export const pushSubscriptionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  createdAt: z.string().min(1),
});

export type CreatePushSubscriptionInput = {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
};
