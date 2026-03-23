import { test, expect } from '../fixtures/base';

test.describe('Habit Edit', () => {
  test('shows pre-filled form with existing data', async ({
    page,
    seedHabit,
  }) => {
    const { id } = await seedHabit({ name: 'E2E編集テスト習慣' });

    await page.goto(`/habits/${id}`);

    await expect(
      page.getByRole('heading', { name: '習慣の編集' }),
    ).toBeVisible();

    // Name field should be pre-filled
    const nameInput = page.getByPlaceholder('例: 読書する');
    await expect(nameInput).toHaveValue('E2E編集テスト習慣');
  });

  test('updates habit name and saves', async ({ page, seedHabit }) => {
    const { id } = await seedHabit({ name: 'E2E変更前の名前' });

    await page.goto(`/habits/${id}`);

    // Change the name
    const nameInput = page.getByPlaceholder('例: 読書する');
    await nameInput.clear();
    await nameInput.fill('E2E変更後の名前');

    // Submit
    await page.getByRole('button', { name: /更新する/ }).click();

    // Should redirect to habits list
    await page.waitForURL('**/habits');
    await expect(page).toHaveURL(/\/habits$/);

    // Updated name should appear
    await expect(page.getByText('E2E変更後の名前')).toBeVisible();
  });

  test('archives a habit from edit page', async ({ page, seedHabit }) => {
    const { id } = await seedHabit({ name: 'E2Eアーカイブテスト' });

    await page.goto(`/habits/${id}`);

    // Click archive button and accept confirmation dialog
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: /アーカイブ/ }).click();

    // Should redirect to habits list
    await page.waitForURL('**/habits');
    await expect(page).toHaveURL(/\/habits$/);

    // The habit should no longer be visible (archived by default hidden)
    await expect(page.getByText('E2Eアーカイブテスト')).not.toBeVisible();
  });
});
