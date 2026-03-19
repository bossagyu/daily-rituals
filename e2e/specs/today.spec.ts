import { test, expect } from '../fixtures/base';
import { cleanupTestData } from '../helpers/test-data';

test.describe('Today Page', () => {
  test('displays today page with current date', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();

    // Verify that a date in the format "YYYY年M月D日 (曜日)" is shown
    // Uses a regex to avoid timezone dependency between test runner and browser
    await expect(page.getByText(/\d{4}年\d{1,2}月\d{1,2}日/)).toBeVisible();
  });

  test('shows empty state when no habits exist', async ({
    page,
    testUserId,
  }) => {
    // Ensure DB is truly clean
    await cleanupTestData(testUserId);

    await page.goto('/');

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
      .getByRole('checkbox', { name: /E2E完了トグル/ })
      .first();

    await checkbox.click();

    // Progress should update to show 1/1
    await expect(page.getByText('1/1')).toBeVisible();
  });
});
