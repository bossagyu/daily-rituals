/**
 * Sign-out test runs last (z-prefix for alphabetical ordering).
 * This test invalidates the server-side session, so it must run
 * after all other authenticated tests.
 */
import { test, expect } from '../fixtures/base';

test.describe('Sign Out', () => {
  test('signs out via settings page and redirects to login', async ({ page }) => {
    await page.goto('/');

    // Wait for authenticated page to load
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();

    // Navigate to settings
    await page.getByRole('link', { name: /設定/ }).first().click();
    await expect(page.getByRole('heading', { name: '設定' })).toBeVisible();

    // Accept the confirmation dialog
    page.on('dialog', (dialog) => dialog.accept());

    // Click logout
    await page.getByRole('button', { name: /ログアウト/ }).click();

    // Should show login page
    await expect(
      page.getByRole('button', { name: /Sign in with Google/i }),
    ).toBeVisible({ timeout: 10000 });
  });
});
