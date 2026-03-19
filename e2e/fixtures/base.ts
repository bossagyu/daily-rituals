import { test as base } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { seedHabit, seedCompletion, cleanupTestData } from '../helpers/test-data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_ID_PATH = path.join(__dirname, '..', '.auth', 'test-user-id.txt');

function getTestUserId(): string {
  return fs.readFileSync(USER_ID_PATH, 'utf-8').trim();
}

type SeedHabitOverrides = {
  readonly name?: string;
  readonly frequencyType?: 'daily' | 'weekly_days' | 'weekly_count';
  readonly frequencyValue?: unknown;
  readonly color?: string;
  readonly archivedAt?: string | null;
};

type TestFixtures = {
  testUserId: string;
  seedHabit: (overrides?: SeedHabitOverrides) => Promise<{ id: string }>;
  seedCompletion: (habitId: string, date: string) => Promise<void>;
  cleanDb: void;
};

export const test = base.extend<TestFixtures>({
  // Auto-fixture: cleans DB before and after each test
  cleanDb: [async ({}, use) => {
    const userId = getTestUserId();
    await cleanupTestData(userId);
    await use();
    await cleanupTestData(userId);
  }, { auto: true }],

  testUserId: async ({}, use) => {
    const userId = getTestUserId();
    await use(userId);
  },

  seedHabit: async ({ testUserId }, use) => {
    const seed = async (overrides: SeedHabitOverrides = {}) => {
      const result = await seedHabit(testUserId, overrides);
      return result;
    };
    await use(seed);
  },

  seedCompletion: async ({ testUserId }, use) => {
    const seed = async (habitId: string, date: string) => {
      await seedCompletion(testUserId, habitId, date);
    };
    await use(seed);
  },
});

export { expect } from '@playwright/test';
