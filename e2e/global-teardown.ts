import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { deleteTestUser } from './helpers/auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_ID_PATH = path.join(__dirname, '.auth', 'test-user-id.txt');

async function globalTeardown(): Promise<void> {
  try {
    if (fs.existsSync(USER_ID_PATH)) {
      const userId = fs.readFileSync(USER_ID_PATH, 'utf-8').trim();
      await deleteTestUser(userId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.warn('Global teardown warning:', message);
  }
}

export default globalTeardown;
