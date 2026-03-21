import type {
  PushSubscription,
  CreatePushSubscriptionInput,
} from '../../domain/models/pushSubscription';

export type PushSubscriptionRepository = {
  readonly upsert: (
    input: CreatePushSubscriptionInput,
  ) => Promise<PushSubscription>;
  readonly findByEndpoint: (
    endpoint: string,
  ) => Promise<PushSubscription | null>;
  readonly deleteByEndpoint: (endpoint: string) => Promise<void>;
};
