import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('redirects unauthenticated user from / to /login', async ({ browser }) => {
    // Use a fresh context without stored auth
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/');
    await page.waitForURL('**/login');

    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test('shows Google sign-in button on login page', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/login');

    await expect(
      page.getByRole('button', { name: /Sign in with Google/i }),
    ).toBeVisible();
    await context.close();
  });

  test('redirects authenticated user from /login to /', async ({ page }) => {
    await page.goto('/login');
    await page.waitForURL('**/');

    // Should not be on login page
    await expect(page).not.toHaveURL(/\/login/);
  });
});
