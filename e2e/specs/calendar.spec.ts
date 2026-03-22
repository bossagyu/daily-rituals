import { test, expect } from '../fixtures/base';

test.describe('Calendar View', () => {
  test('navigates to calendar page', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByText(/\d{4}年\d{1,2}月/)).toBeVisible();
  });

  test('shows day labels', async ({ page }) => {
    await page.goto('/calendar');
    for (const day of ['日', '月', '火', '水', '木', '金', '土']) {
      await expect(page.getByText(day).first()).toBeVisible();
    }
  });

  test('navigates to previous month', async ({ page }) => {
    await page.goto('/calendar');
    const monthText = await page.getByText(/\d{4}年\d{1,2}月/).textContent();
    await page.getByRole('button', { name: '前の月' }).click();
    const newMonthText = await page.getByText(/\d{4}年\d{1,2}月/).textContent();
    expect(newMonthText).not.toBe(monthText);
  });

  test('disables next month button on current month', async ({ page }) => {
    await page.goto('/calendar');
    const nextButton = page.getByRole('button', { name: '次の月' });
    await expect(nextButton).toBeDisabled();
  });

  test('shows habit filter with "すべて" selected by default', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByText('すべて')).toBeVisible();
  });
});
