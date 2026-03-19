import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  createTestUser,
  getTestSession,
  buildSupabaseSessionPayload,
  getStorageKey,
} from './helpers/auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, '.auth');
const STORAGE_STATE_PATH = path.join(AUTH_DIR, 'storage-state.json');
const USER_ID_PATH = path.join(AUTH_DIR, 'test-user-id.txt');

async function globalSetup(): Promise<void> {
  // Ensure auth directory exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  // Create test user and get session
  const userId = await createTestUser();
  const session = await getTestSession();

  // Save user ID for tests
  fs.writeFileSync(USER_ID_PATH, userId, 'utf-8');

  // Launch browser and set storage state
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('domcontentloaded');

  // Set Supabase session in localStorage
  const storageKey = getStorageKey();
  const sessionPayload = buildSupabaseSessionPayload(session);

  await page.evaluate(
    ({ key, value }: { key: string; value: string }) => {
      localStorage.setItem(key, value);
    },
    { key: storageKey, value: sessionPayload },
  );

  // Save storage state
  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}

export default globalSetup;
