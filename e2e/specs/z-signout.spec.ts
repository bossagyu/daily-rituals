/**
 * Sign-out test runs last (z-prefix for alphabetical ordering).
 * This test invalidates the server-side session, so it must run
 * after all other authenticated tests.
 */
import { test, expect } from '../fixtures/base';

test.describe('Sign Out', () => {
  test('signs out and redirects to login', async ({ page }) => {
    await page.goto('/');

    // Wait for authenticated page to load
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();

    // Click logout
    await page.getByRole('button', { name: /ログアウト/ }).first().click();

    // Should show login page
    await expect(
      page.getByRole('button', { name: /Sign in with Google/i }),
    ).toBeVisible({ timeout: 10000 });
  });
});
