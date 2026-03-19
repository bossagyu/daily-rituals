import { test, expect } from '../fixtures/base';
import { cleanupTestData } from '../helpers/test-data';

function getTodayDisplayParts(): { year: number; month: number; day: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

test.describe('Today Page', () => {
  test('displays today page with current date', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();

    const { year, month, day } = getTodayDisplayParts();
    const dateText = `${year}年${month}月${day}日`;
    await expect(page.getByText(dateText)).toBeVisible();
  });

  test('shows empty state when no habits exist', async ({
    page,
    testUserId,
  }) => {
    // Ensure DB is truly clean
    await cleanupTestData(testUserId);

    await page.goto('/');

    // Wait for data to load - either empty state or habits
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();

    // Wait a bit for the async data fetch to complete
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText('今日やるべき習慣はありません'),
    ).toBeVisible({ timeout: 10000 });
  });

  test('displays seeded habits', async ({ page, seedHabit }) => {
    await seedHabit({ name: 'E2E朝の運動' });

    await page.goto('/');
    await expect(page.getByText('E2E朝の運動')).toBeVisible();
  });

  test('toggles habit completion', async ({ page, seedHabit }) => {
    await seedHabit({ name: 'E2E完了トグル' });

    await page.goto('/');
    await expect(page.getByText('E2E完了トグル')).toBeVisible();

    // Find and click the checkbox for this habit
    const checkbox = page
      .locator('text=E2E完了トグル')
      .locator('..')
      .locator('..')
      .getByRole('checkbox')
      .first();

    await checkbox.click();

    // Progress should update to show 1/1
    await expect(page.getByText('1/1')).toBeVisible();
  });
});
