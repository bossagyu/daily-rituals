import { test, expect } from '../fixtures/base';

/**
 * Helper to set up notification permission mocks.
 * In E2E, real Notification.permission is 'default' which prevents
 * the reminder toggle from enabling. This grants permission.
 */
async function grantNotificationPermission(
  page: import('@playwright/test').Page,
  context: import('@playwright/test').BrowserContext,
) {
  await context.grantPermissions(['notifications']);
  await page.addInitScript(() => {
    Object.defineProperty(Notification, 'permission', {
      get: () => 'granted',
      configurable: true,
    });
  });
}

/**
 * Convert UTC time "HH:MM:SS" to expected local time "HH:MM"
 * matching the browser's timezone offset logic.
 */
function utcTimeToExpectedLocal(utcTime: string): string {
  const [h, m] = utcTime.split(':').map(Number);
  const offsetMinutes = new Date().getTimezoneOffset() * -1;
  const totalMinutes =
    ((h * 60 + m + offsetMinutes) % 1440 + 1440) % 1440;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

test.describe('Reminder Settings', () => {
  test.describe('UI elements', () => {
    test('shows reminder toggle on new habit form', async ({ page }) => {
      await page.goto('/habits/new');

      // Reminder section should be visible
      await expect(page.getByText('リマインダー')).toBeVisible();

      // Toggle switch should be present and OFF by default
      const toggle = page.getByRole('switch');
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-checked', 'false');
    });

    test('shows reminder toggle on edit habit form', async ({
      page,
      seedHabit,
    }) => {
      const { id } = await seedHabit({ name: 'E2Eリマインダー表示テスト' });

      await page.goto(`/habits/${id}`);

      await expect(page.getByText('リマインダー')).toBeVisible();
      const toggle = page.getByRole('switch');
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-checked', 'false');
    });

    test('shows time selector when reminder toggle is ON', async ({
      page,
      context,
    }) => {
      await grantNotificationPermission(page, context);

      await page.goto('/habits/new');

      const toggle = page.getByRole('switch');
      await toggle.click();

      // Toggle should now be checked
      await expect(toggle).toHaveAttribute('aria-checked', 'true');

      // Time selector should appear
      const timeSelector = page.locator('select');
      await expect(timeSelector).toBeVisible();

      // Should have the placeholder option
      await expect(timeSelector.locator('option').first()).toHaveText(
        '時刻を選択',
      );
    });

    test('hides time selector when reminder toggle is turned OFF', async ({
      page,
      context,
    }) => {
      await grantNotificationPermission(page, context);

      await page.goto('/habits/new');

      const toggle = page.getByRole('switch');

      // Turn ON
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator('select')).toBeVisible();

      // Turn OFF
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', 'false');
      await expect(page.locator('select')).not.toBeVisible();
    });
  });

  test.describe('Create habit with reminder', () => {
    test('fills in reminder settings correctly on create form', async ({
      page,
      context,
    }) => {
      // NOTE: Full create-with-reminder flow requires real service worker
      // and VAPID key for push subscription (ensureSubscription).
      // This test verifies the UI interactions work correctly.
      await grantNotificationPermission(page, context);

      await page.goto('/habits/new');

      // Fill in habit name
      await page.getByPlaceholder('例: 読書する').fill('E2Eリマインダー付き習慣');

      // Select a color
      const colorButtons = page.locator('button[aria-label^="色:"]');
      await colorButtons.first().click();

      // Enable reminder
      const toggle = page.getByRole('switch');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', 'true');

      // Select a reminder time
      const timeSelector = page.locator('select');
      await expect(timeSelector).toBeVisible();
      await timeSelector.selectOption('08:00');
      await expect(timeSelector).toHaveValue('08:00');

      // Change time to another value
      await timeSelector.selectOption('21:30');
      await expect(timeSelector).toHaveValue('21:30');

      // Verify the submit button is enabled (form is valid)
      const submitButton = page.getByRole('button', { name: /追加する|作成する|保存/ });
      await expect(submitButton).toBeEnabled();
    });

    test('shows validation error when reminder enabled without time', async ({
      page,
      context,
    }) => {
      await grantNotificationPermission(page, context);

      await page.goto('/habits/new');

      // Fill in habit name
      await page.getByPlaceholder('例: 読書する').fill('E2Eバリデーションテスト');

      // Select a color
      const colorButtons = page.locator('button[aria-label^="色:"]');
      await colorButtons.first().click();

      // Enable reminder but don't select time
      const toggle = page.getByRole('switch');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', 'true');

      // Submit without selecting time
      await page.getByRole('button', { name: /追加する|作成する|保存/ }).click();

      // Should show validation error
      await expect(
        page.getByText('リマインダー時刻を選択してください'),
      ).toBeVisible();
    });
  });

  test.describe('Edit habit with reminder', () => {
    test('shows saved reminder time on edit page', async ({
      page,
      context,
      seedHabit,
    }) => {
      // Seed a habit with reminder_time (stored as UTC TIME in DB)
      const seedUtcTime = '08:00:00';
      const { id } = await seedHabit({
        name: 'E2Eリマインダー編集テスト',
        reminderTime: seedUtcTime,
      });

      await grantNotificationPermission(page, context);
      await page.goto(`/habits/${id}`);

      // Toggle should be ON since habit has reminder_time
      const toggle = page.getByRole('switch');
      await expect(toggle).toHaveAttribute('aria-checked', 'true');

      // Time selector should show the UTC time converted to local time
      const expectedLocalTime = utcTimeToExpectedLocal(seedUtcTime);
      const timeSelector = page.locator('select');
      await expect(timeSelector).toBeVisible();
      await expect(timeSelector).toHaveValue(expectedLocalTime);
    });

    test('disables reminder and saves', async ({
      page,
      context,
      seedHabit,
    }) => {
      const { id } = await seedHabit({
        name: 'E2Eリマインダー無効化テスト',
        reminderTime: '09:00:00',
      });

      await grantNotificationPermission(page, context);
      await page.goto(`/habits/${id}`);

      // Toggle should be ON
      const toggle = page.getByRole('switch');
      await expect(toggle).toHaveAttribute('aria-checked', 'true');

      // Disable reminder
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', 'false');

      // Time selector should disappear
      await expect(page.locator('select')).not.toBeVisible();

      // Submit (reminder disabled, so ensureSubscription is not called)
      await page.getByRole('button', { name: /更新する/ }).click();

      // Should redirect to habits list
      await page.waitForURL('**/habits');
      await expect(page).toHaveURL(/\/habits$/);
    });
  });
});
