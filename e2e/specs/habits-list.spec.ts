import { test, expect } from '../fixtures/base';

test.describe('Habits List', () => {
  test('displays habits list page', async ({ page, seedHabit }) => {
    await seedHabit({ name: 'E2E一覧表示テスト' });

    await page.goto('/habits');

    await expect(
      page.getByRole('heading', { name: '習慣一覧' }),
    ).toBeVisible();
    await expect(page.getByText('E2E一覧表示テスト')).toBeVisible();
  });

  test('navigates to new habit page via button', async ({ page }) => {
    await page.goto('/habits');

    await page.getByRole('button', { name: /新しい習慣/ }).click();

    await expect(page).toHaveURL(/\/habits\/new/);
  });

  test('toggles archived habits visibility', async ({
    page,
    seedHabit,
  }) => {
    await seedHabit({ name: 'E2Eアクティブ習慣' });
    await seedHabit({
      name: 'E2Eアーカイブ済み習慣',
      archivedAt: new Date().toISOString(),
    });

    await page.goto('/habits');

    // Initially, archived habit should not be visible
    await expect(page.getByText('E2Eアクティブ習慣')).toBeVisible();
    await expect(page.getByText('E2Eアーカイブ済み習慣')).not.toBeVisible();

    // Toggle archived visibility
    await page.getByText('アーカイブ済みを表示').click();

    // Now archived habit should be visible
    await expect(page.getByText('E2Eアーカイブ済み習慣')).toBeVisible();
  });
});
