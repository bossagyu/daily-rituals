# Push Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-habit push notification reminders that notify users of incomplete habits at their configured times.

**Architecture:** Supabase Edge Function (`send-reminders`) triggered by pg_cron every 10 minutes via pg_net. Frontend uses Web Push API with a custom Service Worker (injectManifest). Reminder settings are stored on the `habits` table; push subscriptions in a new `push_subscriptions` table.

**Tech Stack:** React 19, TypeScript, Supabase (Edge Functions/Deno, pg_cron, pg_net), Web Push API, vite-plugin-pwa (injectManifest), Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-03-21-push-reminder-design.md`
**Issues:** #65-#70

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260321000000_add_push_reminders.sql` | DB migration: add columns to habits, create push_subscriptions table, RLS policies |
| `src/data/repositories/pushSubscriptionRepository.ts` | Interface + mapper for push_subscriptions CRUD |
| `src/data/repositories/supabasePushSubscriptionRepository.ts` | Supabase implementation of PushSubscriptionRepository |
| `src/domain/models/pushSubscription.ts` | PushSubscription domain type + Zod schema |
| `src/lib/reminderTime.ts` | UTC conversion, time rounding, time selector options |
| `src/hooks/usePushSubscription.ts` | Push subscription management hook |
| `src/ui/components/ReminderSection.tsx` | Reminder toggle + time selector UI component |
| `src/sw.ts` | Custom Service Worker with push event handlers |
| `supabase/functions/send-reminders/index.ts` | Edge Function: query habits, send Web Push notifications |
| `supabase/functions/send-reminders/web-push.ts` | VAPID JWT signing + Web Push protocol for Deno |
| `supabase/functions/send-reminders/notification.ts` | Notification body builder (grouping, truncation) |

### Modified Files
| File | Changes |
|------|---------|
| `src/domain/models/habit.ts` | Add `reminderTime` and `lastNotifiedDate` to `Habit` type and schemas |
| `src/domain/models/index.ts` | Re-export PushSubscription type |
| `src/lib/database.types.ts` | Add `reminder_time`, `last_notified_date` to habits; add `push_subscriptions` table type |
| `src/data/repositories/habitRepository.ts` | Add `reminderTime` to mapper |
| `src/data/repositories/supabaseHabitRepository.ts` | Map `reminder_time` and `last_notified_date` in toDomainHabit, update create/update |
| `src/data/repositories/index.ts` | Re-export PushSubscriptionRepository |
| `src/domain/models/habitFormValidation.ts` | Add `reminderEnabled` and `reminderTime` to HabitFormState |
| `src/ui/components/HabitForm.tsx` | Add ReminderSection |
| `src/hooks/index.ts` | Re-export usePushSubscription |
| `vite.config.ts` | Switch to injectManifest strategy |
| `public/` | Add PNG icons (icon-192x192.png) |

### Test Files
| File | Tests |
|------|-------|
| `src/lib/__tests__/reminderTime.test.ts` | UTC conversion, rounding, time options |
| `src/domain/models/__tests__/habit.test.ts` | Update existing tests for new fields |
| `src/domain/models/__tests__/pushSubscription.test.ts` | PushSubscription schema validation |
| `src/domain/models/__tests__/habitFormValidation.test.ts` | Update for reminder fields |
| `src/data/repositories/__tests__/supabaseHabitRepository.test.ts` | Update for reminder_time mapping |
| `src/data/repositories/__tests__/supabasePushSubscriptionRepository.test.ts` | CRUD operations |
| `supabase/functions/send-reminders/__tests__/notification.test.ts` | Notification body builder |

---

## Task 1: DB Migration + Domain Model (#65)

**Files:**
- Create: `supabase/migrations/20260321000000_add_push_reminders.sql`
- Create: `src/domain/models/pushSubscription.ts`
- Modify: `src/domain/models/habit.ts`
- Modify: `src/domain/models/index.ts`
- Modify: `src/lib/database.types.ts`
- Test: `src/domain/models/__tests__/habit.test.ts`
- Test: `src/domain/models/__tests__/pushSubscription.test.ts`

### Step 1.1: Write migration SQL

- [ ] **Create migration file**

```sql
-- supabase/migrations/20260321000000_add_push_reminders.sql

-- habits テーブルにリマインダー関連カラムを追加
ALTER TABLE habits ADD COLUMN reminder_time TIME;
ALTER TABLE habits ADD COLUMN last_notified_date DATE;

-- push_subscriptions テーブルの作成
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_habits_reminder_time ON habits(reminder_time) WHERE reminder_time IS NOT NULL;

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Verify migration applies**

Run: `cd /Users/kouhei/Program/bossagyu/daily-rituals && npx supabase db reset`
Expected: Migration succeeds without errors.

### Step 1.2: Update Habit domain model

- [ ] **Write failing test for new Habit fields**

Add to `src/domain/models/__tests__/habit.test.ts`:

```typescript
describe('habitSchema with reminder fields', () => {
  it('accepts reminderTime as string', () => {
    const habit = {
      id: '1',
      userId: 'u1',
      name: 'Test',
      frequency: { type: 'daily' },
      color: '#4CAF50',
      createdAt: '2026-01-01T00:00:00Z',
      archivedAt: null,
      reminderTime: '09:00:00',
      lastNotifiedDate: null,
    };
    expect(habitSchema.safeParse(habit).success).toBe(true);
  });

  it('accepts reminderTime as null', () => {
    const habit = {
      id: '1',
      userId: 'u1',
      name: 'Test',
      frequency: { type: 'daily' },
      color: '#4CAF50',
      createdAt: '2026-01-01T00:00:00Z',
      archivedAt: null,
      reminderTime: null,
      lastNotifiedDate: null,
    };
    expect(habitSchema.safeParse(habit).success).toBe(true);
  });
});
```

- [ ] **Run test to verify it fails**

Run: `npx vitest run src/domain/models/__tests__/habit.test.ts`
Expected: FAIL — `reminderTime` not in schema.

- [ ] **Update Habit type and schemas**

In `src/domain/models/habit.ts`:

```typescript
// Add to Habit type:
export type Habit = {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly frequency: Frequency;
  readonly color: string;
  readonly createdAt: string;
  readonly archivedAt: string | null;
  readonly reminderTime: string | null;
  readonly lastNotifiedDate: string | null;
};

// Update habitSchema:
export const habitSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1).max(HABIT_NAME_MAX_LENGTH),
  frequency: frequencySchema,
  color: z.string().min(1),
  createdAt: z.string().min(1),
  archivedAt: z.string().nullable(),
  reminderTime: z.string().nullable(),
  lastNotifiedDate: z.string().nullable(),
});
```

- [ ] **Run test to verify it passes**

Run: `npx vitest run src/domain/models/__tests__/habit.test.ts`
Expected: PASS

### Step 1.3: Create PushSubscription domain model

- [ ] **Write failing test**

Create `src/domain/models/__tests__/pushSubscription.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { pushSubscriptionSchema } from '../pushSubscription';

describe('pushSubscriptionSchema', () => {
  it('validates a valid push subscription', () => {
    const sub = {
      id: '123',
      userId: 'u1',
      endpoint: 'https://push.example.com/sub/123',
      p256dh: 'BNcRd...',
      auth: 'tBHI...',
      createdAt: '2026-01-01T00:00:00Z',
    };
    expect(pushSubscriptionSchema.safeParse(sub).success).toBe(true);
  });

  it('rejects missing endpoint', () => {
    const sub = {
      id: '123',
      userId: 'u1',
      p256dh: 'BNcRd...',
      auth: 'tBHI...',
      createdAt: '2026-01-01T00:00:00Z',
    };
    expect(pushSubscriptionSchema.safeParse(sub).success).toBe(false);
  });
});
```

- [ ] **Run test to verify it fails**

Run: `npx vitest run src/domain/models/__tests__/pushSubscription.test.ts`
Expected: FAIL — module not found.

- [ ] **Create PushSubscription model**

Create `src/domain/models/pushSubscription.ts`:

```typescript
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
```

- [ ] **Run test to verify it passes**

Run: `npx vitest run src/domain/models/__tests__/pushSubscription.test.ts`
Expected: PASS

### Step 1.4: Update database.types.ts

- [ ] **Add reminder columns to habits type and push_subscriptions table**

In `src/lib/database.types.ts`, add to `habits.Row`:

```typescript
reminder_time: string | null;
last_notified_date: string | null;
```

Add to `habits.Insert`:

```typescript
reminder_time?: string | null;
last_notified_date?: string | null;
```

Add to `habits.Update`:

```typescript
reminder_time?: string | null;
last_notified_date?: string | null;
```

Add new table `push_subscriptions` to `Tables`:

```typescript
push_subscriptions: {
  Row: {
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    created_at: string;
  };
  Insert: {
    id?: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    created_at?: string;
  };
  Update: {
    id?: string;
    user_id?: string;
    endpoint?: string;
    p256dh?: string;
    auth?: string;
    created_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: 'push_subscriptions_user_id_fkey';
      columns: ['user_id'];
      isOneToOne: false;
      referencedRelation: 'users';
      referencedColumns: ['id'];
    },
  ];
};
```

### Step 1.5: Update repository mappers

- [ ] **Write failing test for reminder_time mapping**

Add to `src/data/repositories/__tests__/supabaseHabitRepository.test.ts`:

```typescript
it('maps reminder_time from DB row to domain model', () => {
  const row = {
    id: '1', user_id: 'u1', name: 'Test',
    frequency_type: 'daily', frequency_value: '{}',
    color: '#4CAF50', created_at: '2026-01-01T00:00:00Z',
    archived_at: null, reminder_time: '09:00:00', last_notified_date: null,
  };
  // Test that toDomainHabit returns reminderTime: '09:00:00'
});
```

- [ ] **Run test to verify it fails**

- [ ] **Update supabaseHabitRepository.ts mapper**

In `toDomainHabit`:

```typescript
const toDomainHabit = (row: HabitRow): Habit => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  frequency: toFrequency(
    row.frequency_type,
    row.frequency_value != null
      ? typeof row.frequency_value === 'string'
        ? row.frequency_value
        : JSON.stringify(row.frequency_value)
      : '{}',
  ),
  color: row.color,
  createdAt: row.created_at,
  archivedAt: row.archived_at,
  reminderTime: row.reminder_time,
  lastNotifiedDate: row.last_notified_date,
});
```

In `update` method, add handling for `reminderTime`:

```typescript
if (input.reminderTime !== undefined) {
  updateFields.reminder_time = input.reminderTime;
}
```

Update `UpdateHabitInput` in `habitRepository.ts` to include `reminderTime`:

```typescript
export type UpdateHabitInput = Partial<CreateHabitInput> & {
  readonly reminderTime?: string | null;
};
```

- [ ] **Run test to verify it passes**

- [ ] **Update index.ts re-exports**

In `src/domain/models/index.ts`, add:

```typescript
export type { PushSubscription, CreatePushSubscriptionInput } from './pushSubscription';
export { pushSubscriptionSchema } from './pushSubscription';
```

### Step 1.6: Commit

- [ ] **Commit**

```bash
git add supabase/migrations/20260321000000_add_push_reminders.sql \
  src/domain/models/pushSubscription.ts \
  src/domain/models/habit.ts \
  src/domain/models/index.ts \
  src/lib/database.types.ts \
  src/data/repositories/habitRepository.ts \
  src/data/repositories/supabaseHabitRepository.ts \
  src/domain/models/__tests__/habit.test.ts \
  src/domain/models/__tests__/pushSubscription.test.ts \
  src/data/repositories/__tests__/supabaseHabitRepository.test.ts
git commit -m "feat: add push reminder DB migration and domain models (#65)"
```

---

## Task 2: Reminder Time Utilities (#65 continued)

**Files:**
- Create: `src/lib/reminderTime.ts`
- Test: `src/lib/__tests__/reminderTime.test.ts`

### Step 2.1: Write failing tests

- [ ] **Create test file**

Create `src/lib/__tests__/reminderTime.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  localTimeToUtc,
  utcToLocalTime,
  roundToTenMinutes,
  generateTimeOptions,
} from '../reminderTime';

describe('localTimeToUtc', () => {
  it('converts JST 18:00 to UTC 09:00', () => {
    expect(localTimeToUtc('18:00', 540)).toBe('09:00');
  });

  it('handles day boundary crossing (JST 02:00 → UTC 17:00 previous day)', () => {
    expect(localTimeToUtc('02:00', 540)).toBe('17:00');
  });
});

describe('utcToLocalTime', () => {
  it('converts UTC 09:00 to JST 18:00', () => {
    expect(utcToLocalTime('09:00', 540)).toBe('18:00');
  });
});

describe('roundToTenMinutes', () => {
  it('rounds 09:03 down to 09:00', () => {
    expect(roundToTenMinutes('09:03')).toBe('09:00');
  });

  it('rounds 09:07 down to 09:00', () => {
    expect(roundToTenMinutes('09:07')).toBe('09:00');
  });

  it('keeps 09:10 as is', () => {
    expect(roundToTenMinutes('09:10')).toBe('09:10');
  });
});

describe('generateTimeOptions', () => {
  it('generates options from 06:00 to 23:50 in 10-minute intervals', () => {
    const options = generateTimeOptions();
    expect(options[0]).toBe('06:00');
    expect(options[options.length - 1]).toBe('23:50');
    expect(options.length).toBe(108); // (24-6)*6 = 108
  });

  it('all values are 10-minute intervals', () => {
    const options = generateTimeOptions();
    for (const opt of options) {
      const minutes = parseInt(opt.split(':')[1], 10);
      expect(minutes % 10).toBe(0);
    }
  });
});
```

- [ ] **Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/reminderTime.test.ts`
Expected: FAIL — module not found.

### Step 2.2: Implement reminderTime utilities

- [ ] **Create src/lib/reminderTime.ts**

```typescript
/**
 * Reminder time utilities.
 * Handles UTC conversion, rounding, and time selector options.
 */

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const TOTAL_MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;
const INTERVAL_MINUTES = 10;
const START_HOUR = 6;
const END_HOUR = 23;
const END_MINUTE = 50;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function parseTime(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':').map(Number);
  return { hours: h, minutes: m };
}

function toTimeString(hours: number, minutes: number): string {
  const normalizedMinutes =
    ((hours * MINUTES_PER_HOUR + minutes) % TOTAL_MINUTES_PER_DAY + TOTAL_MINUTES_PER_DAY) %
    TOTAL_MINUTES_PER_DAY;
  return `${pad(Math.floor(normalizedMinutes / MINUTES_PER_HOUR))}:${pad(normalizedMinutes % MINUTES_PER_HOUR)}`;
}

/**
 * Converts a local time string to UTC.
 * @param localTime - "HH:MM" in local time
 * @param offsetMinutes - Timezone offset in minutes (e.g., 540 for JST)
 * @returns "HH:MM" in UTC
 */
export function localTimeToUtc(localTime: string, offsetMinutes: number): string {
  const { hours, minutes } = parseTime(localTime);
  return toTimeString(hours, minutes - offsetMinutes);
}

/**
 * Converts a UTC time string to local time.
 * @param utcTime - "HH:MM" in UTC
 * @param offsetMinutes - Timezone offset in minutes (e.g., 540 for JST)
 * @returns "HH:MM" in local time
 */
export function utcToLocalTime(utcTime: string, offsetMinutes: number): string {
  const { hours, minutes } = parseTime(utcTime);
  return toTimeString(hours, minutes + offsetMinutes);
}

/**
 * Rounds a time string down to the nearest 10-minute interval.
 * @param time - "HH:MM"
 * @returns "HH:MM" rounded down
 */
export function roundToTenMinutes(time: string): string {
  const { hours, minutes } = parseTime(time);
  const rounded = Math.floor(minutes / INTERVAL_MINUTES) * INTERVAL_MINUTES;
  return `${pad(hours)}:${pad(rounded)}`;
}

/**
 * Generates time selector options from 06:00 to 23:50 in 10-minute intervals.
 * @returns Array of "HH:MM" strings
 */
export function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    const maxMinute = h === END_HOUR ? END_MINUTE : MINUTES_PER_HOUR - INTERVAL_MINUTES;
    for (let m = 0; m <= maxMinute; m += INTERVAL_MINUTES) {
      options.push(`${pad(h)}:${pad(m)}`);
    }
  }
  return options;
}

/**
 * Gets the browser's timezone offset in minutes.
 * Positive for east of UTC (e.g., 540 for JST).
 * Note: JavaScript's getTimezoneOffset() returns negative for east of UTC,
 * so we negate it.
 */
export function getBrowserTimezoneOffset(): number {
  return -new Date().getTimezoneOffset();
}
```

- [ ] **Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/reminderTime.test.ts`
Expected: PASS

### Step 2.3: Commit

- [ ] **Commit**

```bash
git add src/lib/reminderTime.ts src/lib/__tests__/reminderTime.test.ts
git commit -m "feat: add reminder time UTC conversion utilities (#65)"
```

---

## Task 3: PushSubscription Repository (#67)

**Files:**
- Create: `src/data/repositories/pushSubscriptionRepository.ts`
- Create: `src/data/repositories/supabasePushSubscriptionRepository.ts`
- Modify: `src/data/repositories/index.ts`
- Test: `src/data/repositories/__tests__/supabasePushSubscriptionRepository.test.ts`

### Step 3.1: Write failing tests

- [ ] **Create test file**

Create `src/data/repositories/__tests__/supabasePushSubscriptionRepository.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabasePushSubscriptionRepository } from '../supabasePushSubscriptionRepository';

// Mock Supabase client following existing patterns in supabaseHabitRepository.test.ts
function createMockClient() {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
  const client = {
    from: vi.fn().mockReturnValue(mockChain),
  };
  return { client, mockChain };
}

describe('supabasePushSubscriptionRepository', () => {
  it('upserts a subscription using endpoint as conflict key', async () => {
    const { client, mockChain } = createMockClient();
    mockChain.select.mockResolvedValueOnce({
      data: [{ id: '1', user_id: 'u1', endpoint: 'https://push.example.com', p256dh: 'key', auth: 'auth', created_at: '2026-01-01T00:00:00Z' }],
      error: null,
    });

    const repo = createSupabasePushSubscriptionRepository(client as any, 'u1');
    await repo.upsert({ endpoint: 'https://push.example.com', p256dh: 'key', auth: 'auth' });

    expect(client.from).toHaveBeenCalledWith('push_subscriptions');
  });

  it('finds subscription by endpoint', async () => {
    const { client, mockChain } = createMockClient();
    mockChain.single.mockResolvedValueOnce({
      data: { id: '1', user_id: 'u1', endpoint: 'https://push.example.com', p256dh: 'key', auth: 'auth', created_at: '2026-01-01T00:00:00Z' },
      error: null,
    });

    const repo = createSupabasePushSubscriptionRepository(client as any, 'u1');
    const result = await repo.findByEndpoint('https://push.example.com');

    expect(result).not.toBeNull();
    expect(result!.endpoint).toBe('https://push.example.com');
  });

  it('deletes subscription by endpoint', async () => {
    const { client, mockChain } = createMockClient();
    mockChain.eq.mockResolvedValueOnce({ error: null });

    const repo = createSupabasePushSubscriptionRepository(client as any, 'u1');
    await repo.deleteByEndpoint('https://push.example.com');

    expect(client.from).toHaveBeenCalledWith('push_subscriptions');
  });
});
```

- [ ] **Run tests to verify they fail**

Run: `npx vitest run src/data/repositories/__tests__/supabasePushSubscriptionRepository.test.ts`
Expected: FAIL — module not found.

### Step 3.2: Create repository interface

- [ ] **Create pushSubscriptionRepository.ts**

```typescript
/**
 * PushSubscriptionRepository - Interface for push subscription persistence.
 */

import type { PushSubscription, CreatePushSubscriptionInput } from '../../domain/models/pushSubscription';

export type PushSubscriptionRepository = {
  readonly upsert: (input: CreatePushSubscriptionInput) => Promise<PushSubscription>;
  readonly findByEndpoint: (endpoint: string) => Promise<PushSubscription | null>;
  readonly deleteByEndpoint: (endpoint: string) => Promise<void>;
};
```

### Step 3.3: Create Supabase implementation

- [ ] **Create supabasePushSubscriptionRepository.ts**

```typescript
/**
 * SupabasePushSubscriptionRepository - Supabase implementation.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';
import type { PushSubscription, CreatePushSubscriptionInput } from '../../domain/models/pushSubscription';
import type { PushSubscriptionRepository } from './pushSubscriptionRepository';

type PushSubscriptionRow = Database['public']['Tables']['push_subscriptions']['Row'];

const NOT_FOUND_CODE = 'PGRST116';

const toDomainSubscription = (row: PushSubscriptionRow): PushSubscription => ({
  id: row.id,
  userId: row.user_id,
  endpoint: row.endpoint,
  p256dh: row.p256dh,
  auth: row.auth,
  createdAt: row.created_at,
});

export const createSupabasePushSubscriptionRepository = (
  client: SupabaseClient<Database>,
  userId: string,
): PushSubscriptionRepository => ({
  async upsert(input: CreatePushSubscriptionInput): Promise<PushSubscription> {
    const { data, error } = await client
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
        },
        { onConflict: 'endpoint' },
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert push subscription: ${error.message}`);
    }

    return toDomainSubscription(data);
  },

  async findByEndpoint(endpoint: string): Promise<PushSubscription | null> {
    const { data, error } = await client
      .from('push_subscriptions')
      .select()
      .eq('endpoint', endpoint)
      .single();

    if (error) {
      if (error.code === NOT_FOUND_CODE) {
        return null;
      }
      throw new Error(`Failed to find push subscription: ${error.message}`);
    }

    return data ? toDomainSubscription(data) : null;
  },

  async deleteByEndpoint(endpoint: string): Promise<void> {
    const { error } = await client
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);

    if (error) {
      throw new Error(`Failed to delete push subscription: ${error.message}`);
    }
  },
});
```

- [ ] **Run tests to verify they pass**

Run: `npx vitest run src/data/repositories/__tests__/supabasePushSubscriptionRepository.test.ts`
Expected: PASS

### Step 3.4: Update index re-exports

- [ ] **Update src/data/repositories/index.ts**

Add:

```typescript
export type { PushSubscriptionRepository } from './pushSubscriptionRepository';
export { createSupabasePushSubscriptionRepository } from './supabasePushSubscriptionRepository';
```

### Step 3.5: Commit

- [ ] **Commit**

```bash
git add src/data/repositories/pushSubscriptionRepository.ts \
  src/data/repositories/supabasePushSubscriptionRepository.ts \
  src/data/repositories/index.ts \
  src/data/repositories/__tests__/supabasePushSubscriptionRepository.test.ts
git commit -m "feat: add PushSubscription repository (#67)"
```

---

## Task 4: HabitForm Reminder UI (#68)

**Files:**
- Modify: `src/domain/models/habitFormValidation.ts`
- Create: `src/ui/components/ReminderSection.tsx`
- Modify: `src/ui/components/HabitForm.tsx`
- Test: `src/domain/models/__tests__/habitFormValidation.test.ts`

### Step 4.1: Update HabitFormState

- [ ] **Write failing test for reminder fields**

Add to `src/domain/models/__tests__/habitFormValidation.test.ts`:

```typescript
describe('reminder fields in HabitFormState', () => {
  it('validates form with reminder enabled', () => {
    const state: HabitFormState = {
      ...INITIAL_FORM_STATE,
      name: 'Test',
      reminderEnabled: true,
      reminderTime: '18:00',
    };
    const result = validateHabitForm(state);
    expect(result.isValid).toBe(true);
  });

  it('rejects reminder enabled without time', () => {
    const state: HabitFormState = {
      ...INITIAL_FORM_STATE,
      name: 'Test',
      reminderEnabled: true,
      reminderTime: '',
    };
    const result = validateHabitForm(state);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveProperty('reminderTime');
  });

  it('skips reminder validation when disabled', () => {
    const state: HabitFormState = {
      ...INITIAL_FORM_STATE,
      name: 'Test',
      reminderEnabled: false,
      reminderTime: '',
    };
    const result = validateHabitForm(state);
    expect(result.isValid).toBe(true);
  });
});

describe('habitToFormState with reminder', () => {
  it('converts habit with reminderTime to form state', () => {
    const habit = {
      id: '1', userId: 'u1', name: 'Test',
      frequency: { type: 'daily' as const },
      color: '#4CAF50', createdAt: '2026-01-01T00:00:00Z',
      archivedAt: null, reminderTime: '09:00:00', lastNotifiedDate: null,
    };
    const state = habitToFormState(habit);
    expect(state.reminderEnabled).toBe(true);
    // reminderTime is UTC, form shows local time — conversion tested separately
  });

  it('converts habit without reminderTime to form state', () => {
    const habit = {
      id: '1', userId: 'u1', name: 'Test',
      frequency: { type: 'daily' as const },
      color: '#4CAF50', createdAt: '2026-01-01T00:00:00Z',
      archivedAt: null, reminderTime: null, lastNotifiedDate: null,
    };
    const state = habitToFormState(habit);
    expect(state.reminderEnabled).toBe(false);
    expect(state.reminderTime).toBe('');
  });
});
```

- [ ] **Run tests to verify they fail**

- [ ] **Update HabitFormState type and validation**

In `src/domain/models/habitFormValidation.ts`:

Add to `HabitFormState`:

```typescript
export type HabitFormState = {
  readonly name: string;
  readonly frequencyType: FrequencyType;
  readonly weeklyDays: readonly number[];
  readonly weeklyCount: number;
  readonly color: string;
  readonly reminderEnabled: boolean;
  readonly reminderTime: string;
};
```

Update `INITIAL_FORM_STATE`:

```typescript
export const INITIAL_FORM_STATE: HabitFormState = {
  name: '',
  frequencyType: 'daily',
  weeklyDays: [],
  weeklyCount: 1,
  color: PRESET_COLORS[0],
  reminderEnabled: false,
  reminderTime: '',
};
```

Add reminder validation to `validateHabitForm`:

```typescript
// After existing validation, add reminder validation:
if (state.reminderEnabled && !state.reminderTime) {
  errors['reminderTime'] = 'リマインダー時刻を選択してください';
}
```

Update `habitToFormState` to include reminder fields. Note: UTC→ローカル変換はドメイン層の純粋性を保つため、UI層（ページコンポーネント）で行う。`habitToFormState`はUTC時刻のまま返す:

```typescript
// Add to each case in habitToFormState:
reminderEnabled: habit.reminderTime !== null,
reminderTime: habit.reminderTime !== null
  ? habit.reminderTime.substring(0, 5)  // UTC "HH:MM" をそのまま返す。UI層で変換する
  : '',
```

Update `toCreateHabitInput` to pass through `reminderTime` (as a separate field handled by the page, not part of `CreateHabitInput`).

Update `createHabitInputSchema` to include optional `reminderTime` for create flow:

```typescript
export const createHabitInputSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(HABIT_NAME_MAX_LENGTH),
  frequency: frequencySchema,
  color: z.string().min(1),
  reminderTime: z.string().nullable().optional(),
});
```

- [ ] **Run tests to verify they pass**

### Step 4.2: Create ReminderSection component

- [ ] **Create src/ui/components/ReminderSection.tsx**

```typescript
/**
 * ReminderSection - Toggle + time selector for habit reminders.
 */

import React from 'react';
import { generateTimeOptions } from '@/lib/reminderTime';

type ReminderSectionProps = {
  readonly enabled: boolean;
  readonly time: string;
  readonly onEnabledChange: (enabled: boolean) => void;
  readonly onTimeChange: (time: string) => void;
  readonly error?: string;
  readonly permissionState?: NotificationPermission;
  readonly onRequestPermission?: () => void;
};

const TIME_OPTIONS = generateTimeOptions();

export function ReminderSection({
  enabled,
  time,
  onEnabledChange,
  onTimeChange,
  error,
  permissionState,
  onRequestPermission,
}: ReminderSectionProps) {
  const handleToggle = () => {
    if (!enabled && permissionState !== 'granted' && onRequestPermission) {
      onRequestPermission();
      return;
    }
    onEnabledChange(!enabled);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">リマインダー</label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>

        {enabled && (
          <select
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">時刻を選択</option>
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>

      {permissionState === 'denied' && enabled && (
        <p className="text-sm text-destructive">
          通知がブロックされています。ブラウザの設定から許可してください。
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

### Step 4.3: Add ReminderSection to HabitForm

- [ ] **Update HabitForm.tsx**

Import `ReminderSection` and update `HabitFormProps` to accept permission props:

```typescript
import { ReminderSection } from './ReminderSection';

// Update HabitFormProps:
type HabitFormProps = {
  readonly initialState?: HabitFormState;
  readonly onSubmit: (state: HabitFormState) => void;
  readonly isSubmitting: boolean;
  readonly submitLabel: string;
  readonly permissionState?: NotificationPermission;
  readonly onRequestPermission?: () => void;
};

// In HabitForm component signature, destructure new props:
export function HabitForm({
  initialState,
  onSubmit,
  isSubmitting,
  submitLabel,
  permissionState,
  onRequestPermission,
}: HabitFormProps) {

// Add after ColorSelector:
<ReminderSection
  enabled={formState.reminderEnabled}
  time={formState.reminderTime}
  onEnabledChange={(value) => updateField('reminderEnabled', value)}
  onTimeChange={(value) => updateField('reminderTime', value)}
  error={errors['reminderTime']}
  permissionState={permissionState}
  onRequestPermission={onRequestPermission}
/>
```

### Step 4.4: Commit

- [ ] **Commit**

```bash
git add src/domain/models/habitFormValidation.ts \
  src/domain/models/__tests__/habitFormValidation.test.ts \
  src/ui/components/ReminderSection.tsx \
  src/ui/components/HabitForm.tsx
git commit -m "feat: add reminder UI to habit form (#68)"
```

---

## Task 5: Service Worker (injectManifest) (#66)

**Files:**
- Modify: `vite.config.ts`
- Create: `src/sw.ts`
- Add: `public/icon-192x192.png`

### Step 5.1: Generate PNG icon

- [ ] **Generate PNG from SVG**

Use a tool or manually create a 192x192 PNG icon and place it at `public/icon-192x192.png`.

If the SVG is simple, you can use the `sharp` or `svg2png` npm package:

```bash
npx sharp-cli --input public/icon-192x192.svg --output public/icon-192x192.png resize 192 192
```

Or create it manually. The PNG icon is needed for push notification display.

### Step 5.2: Create custom Service Worker

- [ ] **Create src/sw.ts**

```typescript
/// <reference lib="webworker" />

import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

// Workbox precaching (injected by vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);

// Navigation fallback (equivalent to previous navigateFallback config)
const handler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(handler, {
  denylist: [/^\/api\//],
});
registerRoute(navigationRoute);

// Push notification handler
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) {
    return;
  }

  const payload = event.data.json() as {
    title: string;
    body: string;
    icon?: string;
    data?: { url?: string };
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon ?? '/icon-192x192.png',
      data: payload.data,
    }),
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const url = (event.notification.data as { url?: string })?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
```

### Step 5.3: Switch vite.config.ts to injectManifest

- [ ] **Update vite.config.ts**

Replace the `VitePWA` config:

```typescript
VitePWA({
  registerType: 'autoUpdate',
  srcDir: 'src',
  filename: 'sw.ts',
  strategies: 'injectManifest',
  includeAssets: ['icon-192x192.svg', 'icon-512x512.svg', 'icon-192x192.png'],
  manifest: {
    name: 'Daily Rituals',
    short_name: 'Rituals',
    description: 'Daily habit tracking application',
    theme_color: THEME_COLOR,
    background_color: BACKGROUND_COLOR,
    display: 'standalone',
    start_url: '/',
    icons: [
      {
        src: 'icon-192x192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: 'icon-512x512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
      {
        src: 'icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  },
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
  },
  devOptions: {
    enabled: false,
  },
}),
```

### Step 5.4: Verify build

- [ ] **Run build**

Run: `npm run build`
Expected: Build succeeds, SW is generated with precache manifest injected.

### Step 5.5: Commit

- [ ] **Commit**

```bash
git add vite.config.ts src/sw.ts public/icon-192x192.png
git commit -m "feat: switch to injectManifest with push notification SW (#66)"
```

---

## Task 6: usePushSubscription Hook (#67 continued)

**Files:**
- Create: `src/hooks/usePushSubscription.ts`
- Modify: `src/hooks/index.ts`

### Step 6.1: Create usePushSubscription hook

- [ ] **Create src/hooks/usePushSubscription.ts**

```typescript
/**
 * usePushSubscription - Manages Web Push subscription lifecycle.
 *
 * Handles permission requests, subscription registration/re-registration,
 * and Supabase persistence.
 */

import { useState, useEffect, useCallback } from 'react';
import type { PushSubscriptionRepository } from '../data/repositories/pushSubscriptionRepository';

type UsePushSubscriptionReturn = {
  readonly permissionState: NotificationPermission;
  readonly requestPermission: () => Promise<boolean>;
  readonly ensureSubscription: () => Promise<void>;
};

function getVapidPublicKey(): string {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!key) {
    throw new Error('VITE_VAPID_PUBLIC_KEY is not configured');
  }
  return key;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription(
  repository: PushSubscriptionRepository | null,
): UsePushSubscriptionReturn {
  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );

  // Sync permission state
  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermissionState(Notification.permission);
    }
  }, []);

  // Silent re-registration on app load
  useEffect(() => {
    if (!repository || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    async function checkAndReregister() {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        if (!existingSub) {
          return;
        }

        const dbSub = await repository!.findByEndpoint(existingSub.endpoint);
        if (dbSub) {
          return; // Subscription is valid
        }

        // DB record missing — re-register silently
        await existingSub.unsubscribe();
        const vapidKey = urlBase64ToUint8Array(getVapidPublicKey());
        const newSub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        });

        const keys = newSub.toJSON().keys ?? {};
        await repository!.upsert({
          endpoint: newSub.endpoint,
          p256dh: keys.p256dh ?? '',
          auth: keys.auth ?? '',
        });
      } catch {
        // Silent failure — re-registration is best-effort
      }
    }

    void checkAndReregister();
  }, [repository]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === 'undefined') {
      return false;
    }

    const result = await Notification.requestPermission();
    setPermissionState(result);
    return result === 'granted';
  }, []);

  const ensureSubscription = useCallback(async (): Promise<void> => {
    if (!repository || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const vapidKey = urlBase64ToUint8Array(getVapidPublicKey());
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });
    }

    const keys = subscription.toJSON().keys ?? {};
    await repository.upsert({
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh ?? '',
      auth: keys.auth ?? '',
    });
  }, [repository]);

  return {
    permissionState,
    requestPermission,
    ensureSubscription,
  };
}
```

### Step 6.2: Write unit tests for usePushSubscription

- [ ] **Create src/hooks/__tests__/usePushSubscription.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tests require mocking browser APIs (Notification, navigator.serviceWorker, PushManager).
// Key test cases:

describe('usePushSubscription', () => {
  it('initializes permissionState from Notification.permission', () => {
    // Mock Notification.permission = 'default'
    // Verify hook returns permissionState: 'default'
  });

  it('requestPermission updates permissionState on grant', async () => {
    // Mock Notification.requestPermission → 'granted'
    // Call requestPermission(), verify returns true and state updates
  });

  it('requestPermission returns false on deny', async () => {
    // Mock Notification.requestPermission → 'denied'
    // Call requestPermission(), verify returns false
  });

  it('ensureSubscription creates and persists subscription', async () => {
    // Mock PushManager.getSubscription → null (no existing)
    // Mock PushManager.subscribe → new subscription
    // Call ensureSubscription(), verify repository.upsert called
  });

  it('ensureSubscription reuses existing subscription', async () => {
    // Mock PushManager.getSubscription → existing subscription
    // Call ensureSubscription(), verify repository.upsert called with existing endpoint
  });

  it('silent re-registration when DB record missing', async () => {
    // Mock PushManager.getSubscription → existing subscription
    // Mock repository.findByEndpoint → null (deleted server-side)
    // Verify unsubscribe + re-subscribe + upsert called
  });

  it('skips re-registration when DB record exists', async () => {
    // Mock PushManager.getSubscription → existing subscription
    // Mock repository.findByEndpoint → subscription record
    // Verify no unsubscribe/re-subscribe
  });
});
```

- [ ] **Run tests**

Run: `npx vitest run src/hooks/__tests__/usePushSubscription.test.ts`
Expected: PASS

### Step 6.3: Update index re-exports

- [ ] **Update src/hooks/index.ts**

Add:

```typescript
export { usePushSubscription } from './usePushSubscription';
export type { UsePushSubscriptionReturn } from './usePushSubscription';
```

### Step 6.3: Commit

- [ ] **Commit**

```bash
git add src/hooks/usePushSubscription.ts src/hooks/index.ts
git commit -m "feat: add usePushSubscription hook (#67)"
```

---

## Task 7: Wire Up Reminder in HabitDetailPage & NewHabitPage (#68 continued)

**Files:**
- Modify: `src/ui/pages/HabitDetailPage.tsx`
- Modify: `src/ui/pages/NewHabitPage.tsx` (if exists, check pattern)

### Step 7.1: Connect push subscription to HabitForm

- [ ] **Update HabitDetailPage.tsx**

Import and use `usePushSubscription`. Pass `permissionState` and `onRequestPermission` to HabitForm/ReminderSection. On form submit, convert `reminderTime` to UTC and include in the update input:

```typescript
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { localTimeToUtc, getBrowserTimezoneOffset } from '@/lib/reminderTime';

// In component:
const { permissionState, requestPermission, ensureSubscription } = usePushSubscription(pushSubscriptionRepository);

// In handleSubmit, after creating input:
const reminderTimeUtc = formState.reminderEnabled
  ? localTimeToUtc(formState.reminderTime, getBrowserTimezoneOffset())
  : null;

if (formState.reminderEnabled) {
  await ensureSubscription();
}

await updateHabit(id, { ...input, reminderTime: reminderTimeUtc });
```

Pass `permissionState` and `requestPermission` through to `HabitForm` → `ReminderSection`.

### Step 7.2: Apply same pattern to NewHabitPage

- [ ] **Update NewHabitPage similarly**

The same push subscription and reminder time conversion logic applies.

### Step 7.3: Verify build and manual test

- [ ] **Run build**

Run: `npm run build`
Expected: Build succeeds.

### Step 7.4: Commit

- [ ] **Commit**

```bash
git add src/ui/pages/HabitDetailPage.tsx src/ui/pages/NewHabitPage.tsx \
  src/ui/components/HabitForm.tsx
git commit -m "feat: wire up reminder settings in habit pages (#68)"
```

---

## Task 8: Edge Function - Notification Builder (#69)

**Files:**
- Create: `supabase/functions/send-reminders/notification.ts`
- Test: `supabase/functions/send-reminders/__tests__/notification.test.ts`

### Step 8.1: Write failing tests

- [ ] **Create test file**

```typescript
import { describe, it, expect } from 'vitest';
import { buildNotificationBody } from '../notification';

describe('buildNotificationBody', () => {
  it('shows single habit name', () => {
    expect(buildNotificationBody(['読書'])).toBe('「読書」がまだ完了していません');
  });

  it('shows two habit names', () => {
    expect(buildNotificationBody(['読書', '運動'])).toBe(
      '「読書」「運動」がまだ完了していません',
    );
  });

  it('shows three habit names', () => {
    expect(buildNotificationBody(['読書', '運動', '瞑想'])).toBe(
      '「読書」「運動」「瞑想」がまだ完了していません',
    );
  });

  it('truncates to 3 and shows remainder count', () => {
    expect(buildNotificationBody(['読書', '運動', '瞑想', '筋トレ', 'ランニング'])).toBe(
      '「読書」「運動」「瞑想」他2件がまだ完了していません',
    );
  });

  it('returns empty string for empty array', () => {
    expect(buildNotificationBody([])).toBe('');
  });
});
```

- [ ] **Run test to verify it fails**

### Step 8.2: Implement notification builder

- [ ] **Create notification.ts**

```typescript
const MAX_DISPLAY = 3;

export function buildNotificationBody(habitNames: readonly string[]): string {
  if (habitNames.length === 0) {
    return '';
  }

  const displayed = habitNames.slice(0, MAX_DISPLAY).map((n) => `「${n}」`).join('');
  const remaining = habitNames.length - MAX_DISPLAY;
  const suffix = remaining > 0 ? `他${remaining}件` : '';

  return `${displayed}${suffix}がまだ完了していません`;
}
```

- [ ] **Run test to verify it passes**

### Step 8.3: Commit

- [ ] **Commit**

```bash
git add supabase/functions/send-reminders/notification.ts \
  supabase/functions/send-reminders/__tests__/notification.test.ts
git commit -m "feat: add notification body builder (#69)"
```

---

## Task 9: Edge Function - Web Push + Main Handler (#69 continued)

**Files:**
- Create: `supabase/functions/send-reminders/web-push.ts`
- Create: `supabase/functions/send-reminders/index.ts`

### Step 9.1: Create Web Push utility for Deno

- [ ] **Create web-push.ts**

This implements VAPID JWT signing and the Web Push protocol using Deno's crypto API. The implementation details are complex — refer to the Web Push protocol RFC 8030 and VAPID RFC 8292.

Key functions:
- `createVapidAuthHeader(audience, subject, publicKey, privateKey)` — Creates the VAPID Authorization header
- `encryptPayload(payload, p256dh, auth)` — Encrypts the notification payload using ECDH
- `sendWebPush(subscription, payload, vapidKeys)` — Sends a single push notification

### Step 9.2: Create main Edge Function handler

- [ ] **Create index.ts**

```typescript
// supabase/functions/send-reminders/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildNotificationBody } from './notification.ts';
import { sendWebPush } from './web-push.ts';

const INTERVAL_MINUTES = 10;

function roundToInterval(date: Date): string {
  const hours = date.getUTCHours();
  const minutes = Math.floor(date.getUTCMinutes() / INTERVAL_MINUTES) * INTERVAL_MINUTES;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
}

function getTodayUtc(): string {
  return new Date().toISOString().split('T')[0];
}

function getWeekStartUtc(today: string): string {
  const date = new Date(today + 'T00:00:00Z');
  const day = date.getUTCDay(); // 0=Sun
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().split('T')[0];
}

type HabitRow = {
  id: string;
  user_id: string;
  name: string;
  reminder_time: string;
  frequency_type: string;
  frequency_value: unknown;
};

function isWeeklyCountTargetMet(
  habit: HabitRow,
  weeklyCompletionCount: number,
): boolean {
  if (habit.frequency_type !== 'weekly_count') {
    return false;
  }
  const target = typeof habit.frequency_value === 'number'
    ? habit.frequency_value
    : Number(habit.frequency_value);
  return weeklyCompletionCount >= target;
}

Deno.serve(async (req: Request) => {
  try {
    // Authentication: verify service role key
    const authHeader = req.headers.get('Authorization');
    const expectedKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      expectedKey,
    );

    const now = new Date();
    const currentTime = roundToInterval(now);
    const today = getTodayUtc();
    const weekStart = getWeekStartUtc(today);

    // 1. Find habits with pending reminders
    const { data: habits, error: habitsError } = await supabase
      .from('habits')
      .select('id, user_id, name, reminder_time, frequency_type, frequency_value')
      .not('reminder_time', 'is', null)
      .is('archived_at', null)
      .lte('reminder_time', currentTime)
      .or(`last_notified_date.is.null,last_notified_date.lt.${today}`);

    if (habitsError) {
      throw new Error(`Failed to fetch habits: ${habitsError.message}`);
    }

    if (!habits || habits.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Check completions for today AND this week (for weekly_count habits)
    const habitIds = habits.map((h) => h.id);
    const { data: todayCompletions } = await supabase
      .from('completions')
      .select('habit_id')
      .in('habit_id', habitIds)
      .eq('completed_date', today);

    const completedTodayIds = new Set((todayCompletions ?? []).map((c) => c.habit_id));

    // For weekly_count habits, check this week's completion count
    const weeklyCountHabitIds = habits
      .filter((h) => h.frequency_type === 'weekly_count')
      .map((h) => h.id);

    const weeklyCompletionCounts = new Map<string, number>();
    if (weeklyCountHabitIds.length > 0) {
      const { data: weekCompletions } = await supabase
        .from('completions')
        .select('habit_id')
        .in('habit_id', weeklyCountHabitIds)
        .gte('completed_date', weekStart)
        .lte('completed_date', today);

      for (const c of weekCompletions ?? []) {
        weeklyCompletionCounts.set(
          c.habit_id,
          (weeklyCompletionCounts.get(c.habit_id) ?? 0) + 1,
        );
      }
    }

    // 3. Filter out completed habits and weekly_count habits that met their target
    const incompleteHabits = habits.filter((h) => {
      // Skip if completed today (daily/weekly_days)
      if (completedTodayIds.has(h.id)) {
        return false;
      }
      // Skip if weekly_count target met
      if (isWeeklyCountTargetMet(h, weeklyCompletionCounts.get(h.id) ?? 0)) {
        return false;
      }
      return true;
    });

    if (incompleteHabits.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Group by user
    const userHabits = new Map<string, typeof incompleteHabits>();
    for (const habit of incompleteHabits) {
      const existing = userHabits.get(habit.user_id) ?? [];
      userHabits.set(habit.user_id, [...existing, habit]);
    }

    // 5. Send notifications per user
    const vapidKeys = {
      publicKey: Deno.env.get('VAPID_PUBLIC_KEY')!,
      privateKey: Deno.env.get('VAPID_PRIVATE_KEY')!,
      subject: Deno.env.get('VAPID_SUBJECT')!,
    };

    let sentCount = 0;
    const notifiedHabitIds: string[] = [];

    for (const [userId, userHabitList] of userHabits) {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', userId);

      if (!subscriptions || subscriptions.length === 0) {
        continue;
      }

      const body = buildNotificationBody(userHabitList.map((h) => h.name));
      const payload = JSON.stringify({
        title: 'Daily Rituals',
        body,
        icon: '/icon-192x192.png',
        data: { url: '/' },
      });

      let userSendSucceeded = false;
      for (const sub of subscriptions) {
        try {
          await sendWebPush(sub, payload, vapidKeys);
          sentCount++;
          userSendSucceeded = true;
        } catch (error: unknown) {
          // 410 Gone — subscription expired, delete it
          if (error instanceof Error && error.message.includes('410')) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint);
          }
        }
      }

      // Only mark as notified if at least one push succeeded
      if (userSendSucceeded) {
        notifiedHabitIds.push(...userHabitList.map((h) => h.id));
      }
    }

    // 6. Update last_notified_date for successfully sent habits
    if (notifiedHabitIds.length > 0) {
      await supabase
        .from('habits')
        .update({ last_notified_date: today })
        .in('id', notifiedHabitIds);
    }

    return new Response(JSON.stringify({ sent: sentCount }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Edge Functions use console.error for server-side logging (visible in Supabase Dashboard)
    console.error('send-reminders error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

### Step 9.3: Verify Edge Function deploys

- [ ] **Deploy and test locally**

Run: `npx supabase functions serve send-reminders`
Expected: Function serves without errors.

### Step 9.4: Commit

- [ ] **Commit**

```bash
git add supabase/functions/send-reminders/
git commit -m "feat: add send-reminders Edge Function (#69)"
```

---

## Task 10: RepositoryProvider Update + Integration

**Files:**
- Modify: Wherever `RepositoryProvider` is defined (check `src/hooks/useRepositories.ts` or similar)

### Step 10.1: Add PushSubscriptionRepository to context

- [ ] **Update RepositoryProvider to include pushSubscriptionRepository**

Follow the existing pattern for `habitRepository` and `completionRepository`. Add `pushSubscriptionRepository` using `createSupabasePushSubscriptionRepository`.

### Step 10.2: Verify all tests pass

- [ ] **Run full test suite**

Run: `npm test`
Expected: All tests pass.

### Step 10.3: Run build

- [ ] **Build**

Run: `npm run build`
Expected: Build succeeds.

### Step 10.4: Commit

- [ ] **Commit**

```bash
git add <modified files>
git commit -m "feat: integrate PushSubscriptionRepository into app context"
```

---

## Task 11: E2E Tests (#70)

**Files:**
- Create: Playwright test for reminder UI flow

### Step 11.1: Create E2E test for reminder settings

- [ ] **Create test file** (e.g., `e2e/reminder.spec.ts`)

Test flow:
1. Login
2. Navigate to create habit
3. Fill in habit details
4. Toggle reminder ON (mock notification permission)
5. Select time
6. Submit
7. Navigate to edit, verify reminder is shown

### Step 11.2: Run E2E tests

- [ ] **Run E2E**

Run: `npm run test:e2e`
Expected: Reminder flow tests pass.

### Step 11.3: Commit

- [ ] **Commit**

```bash
git add e2e/reminder.spec.ts
git commit -m "test: add E2E tests for reminder flow (#70)"
```

---

## Task 12: VAPID Key Setup + pg_cron Configuration

This task requires manual configuration and cannot be fully automated.

### Step 12.1: Generate VAPID keys

- [ ] **Generate keys**

```bash
npx web-push generate-vapid-keys
```

### Step 12.2: Set Supabase Secrets

- [ ] **Configure secrets**

```bash
supabase secrets set VAPID_PUBLIC_KEY=<public_key>
supabase secrets set VAPID_PRIVATE_KEY=<private_key>
supabase secrets set VAPID_SUBJECT=mailto:your-email@example.com
```

### Step 12.3: Add VITE_VAPID_PUBLIC_KEY to .env

- [ ] **Add to .env**

```
VITE_VAPID_PUBLIC_KEY=<public_key>
```

### Step 12.4: Configure pg_cron

- [ ] **Run SQL in Supabase Dashboard**

Note: This SQL must be run manually via the Supabase Dashboard SQL editor. The `<SUPABASE_URL>` and `<SUPABASE_SERVICE_ROLE_KEY>` values must never be committed to version control.

```sql
SELECT cron.schedule(
  'send-reminders',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := '<SUPABASE_URL>/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Step 12.5: Deploy Edge Function

- [ ] **Deploy**

```bash
supabase functions deploy send-reminders
```
