import { test, expect } from '../fixtures/base';

test.describe('Past Completion', () => {
  test('shows date navigation on today page', async ({ page }) => {
    await page.goto('/');
    // Check that navigation buttons exist
    await expect(page.getByRole('button', { name: '前の日' })).toBeVisible();
    await expect(page.getByRole('button', { name: '次の日' })).toBeVisible();
  });

  test('navigates to previous day', async ({ page }) => {
    await page.goto('/');
    const todayText = await page.locator('h2').textContent();
    await page.getByRole('button', { name: '前の日' }).click();
    const newText = await page.locator('h2').textContent();
    expect(newText).not.toBe(todayText);
  });

  test('shows "今日に戻る" button on non-today date', async ({ page }) => {
    await page.goto('/');
    // Should NOT be visible on today
    await expect(page.getByText('今日に戻る')).not.toBeVisible();
    // Navigate to previous day
    await page.getByRole('button', { name: '前の日' }).click();
    // Should be visible
    await expect(page.getByText('今日に戻る')).toBeVisible();
  });

  test('returns to today when clicking "今日に戻る"', async ({ page }) => {
    await page.goto('/?date=2026-03-01');
    await page.getByText('今日に戻る').click();
    // URL should not have date param
    expect(page.url()).not.toContain('date=');
  });

  test('loads specific date via URL parameter', async ({ page }) => {
    await page.goto('/?date=2026-03-15');
    await expect(page.getByText('2026年3月15日')).toBeVisible();
  });

  test('falls back to today for invalid date parameter', async ({ page }) => {
    await page.goto('/?date=invalid');
    // Should show today's page without error
    await expect(page.getByText('Today')).toBeVisible();
  });
});
