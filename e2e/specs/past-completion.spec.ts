import { test, expect } from '../fixtures/base';

test.describe('Past Completion', () => {
  test('shows date navigation on today page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '前の日' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: '次の日' })).toBeVisible();
  });

  test('navigates to previous day', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '前の日' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: '前の日' }).click();
    await expect(page.getByText('今日に戻る')).toBeVisible({ timeout: 10000 });
  });

  test('shows "今日に戻る" button on non-today date', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '前の日' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('今日に戻る')).not.toBeVisible();
    await page.getByRole('button', { name: '前の日' }).click();
    await expect(page.getByText('今日に戻る')).toBeVisible({ timeout: 10000 });
  });

  test('returns to today when clicking "今日に戻る"', async ({ page }) => {
    await page.goto('/?date=2026-03-01');
    await expect(page.getByText('今日に戻る')).toBeVisible({ timeout: 10000 });
    await page.getByText('今日に戻る').click();
    await expect(page.getByText('Today')).toBeVisible({ timeout: 10000 });
  });

  test('loads specific date via URL parameter', async ({ page }) => {
    await page.goto('/?date=2026-03-15');
    await expect(page.getByText(/2026年3月15日/)).toBeVisible({ timeout: 10000 });
  });

  test('falls back to today for invalid date parameter', async ({ page }) => {
    await page.goto('/?date=invalid');
    await expect(page.getByText('Today')).toBeVisible({ timeout: 10000 });
  });
});
