import { test, expect } from '../fixtures/base';

test.describe('Navigation', () => {
  test('navigates between Today and Habits tabs', async ({ page }) => {
    await page.goto('/');

    // Should be on Today page
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();

    // Click Habits tab
    await page.getByRole('link', { name: /習慣一覧/ }).first().click();
    await expect(page).toHaveURL(/\/habits/);
    await expect(
      page.getByRole('heading', { name: '習慣一覧' }),
    ).toBeVisible();

    // Click Today tab
    await page.getByRole('link', { name: /Today/ }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  });

  test('navigates to settings page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();

    // Click Settings tab
    await page.getByRole('link', { name: /設定/ }).first().click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(
      page.getByRole('heading', { name: '設定' }),
    ).toBeVisible();
  });
});
