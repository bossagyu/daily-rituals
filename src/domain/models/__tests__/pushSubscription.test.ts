import { pushSubscriptionSchema, type PushSubscription } from '../pushSubscription';

describe('PushSubscription type', () => {
  it('should represent a push subscription', () => {
    const sub: PushSubscription = {
      id: 'sub-1',
      userId: 'user-123',
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUl...',
      auth: 'tBHItJI5svbpC7htYQ==',
      createdAt: '2026-01-01T00:00:00Z',
    };

    expect(sub.id).toBe('sub-1');
    expect(sub.userId).toBe('user-123');
    expect(sub.endpoint).toBe('https://fcm.googleapis.com/fcm/send/abc123');
  });
});

describe('pushSubscriptionSchema', () => {
  const validSubscription = {
    id: 'sub-1',
    userId: 'user-123',
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUl',
    auth: 'tBHItJI5svbpC7htYQ==',
    createdAt: '2026-01-01T00:00:00Z',
  };

  it('should validate a complete valid subscription', () => {
    const result = pushSubscriptionSchema.safeParse(validSubscription);
    expect(result.success).toBe(true);
  });

  it('should reject a subscription with empty id', () => {
    const result = pushSubscriptionSchema.safeParse({ ...validSubscription, id: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a subscription with empty userId', () => {
    const result = pushSubscriptionSchema.safeParse({ ...validSubscription, userId: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a subscription with invalid endpoint URL', () => {
    const result = pushSubscriptionSchema.safeParse({ ...validSubscription, endpoint: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('should reject a subscription with empty endpoint', () => {
    const result = pushSubscriptionSchema.safeParse({ ...validSubscription, endpoint: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a subscription with empty p256dh', () => {
    const result = pushSubscriptionSchema.safeParse({ ...validSubscription, p256dh: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a subscription with empty auth', () => {
    const result = pushSubscriptionSchema.safeParse({ ...validSubscription, auth: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a subscription with empty createdAt', () => {
    const result = pushSubscriptionSchema.safeParse({ ...validSubscription, createdAt: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a subscription with missing fields', () => {
    const result = pushSubscriptionSchema.safeParse({ id: 'sub-1' });
    expect(result.success).toBe(false);
  });
});
