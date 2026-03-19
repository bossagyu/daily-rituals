import { test, expect } from '../fixtures/base';

test.describe('Habit Creation', () => {
  test('shows habit creation form', async ({ page }) => {
    await page.goto('/habits/new');

    await expect(
      page.getByRole('heading', { name: /新しい習慣/ }),
    ).toBeVisible();
    await expect(page.getByPlaceholder('例: 読書する')).toBeVisible();
  });

  test('shows validation error on empty submit', async ({ page }) => {
    await page.goto('/habits/new');

    // Click submit button without filling the form
    await page.getByRole('button', { name: /追加する|作成する|保存/ }).click();

    // Should show validation error
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('creates a new habit and redirects to list', async ({ page }) => {
    await page.goto('/habits/new');

    // Fill in the habit name
    await page.getByPlaceholder('例: 読書する').fill('E2E新しい習慣テスト');

    // Select a color (click the first color button)
    const colorButtons = page.locator('button[aria-label^="色:"]');
    await colorButtons.first().click();

    // Submit the form
    await page.getByRole('button', { name: /追加する|作成する|保存/ }).click();

    // Should redirect to habits list
    await page.waitForURL('**/habits');
    await expect(page).toHaveURL(/\/habits$/);

    // The new habit should appear in the list
    await expect(page.getByText('E2E新しい習慣テスト')).toBeVisible();
  });
});
