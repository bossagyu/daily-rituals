import { test, expect } from '../fixtures/base';

test.describe('XP・レベルシステム', () => {
  test.describe('CalendarPage stats display', () => {
    test('shows LevelBar after at least one habit exists', async ({
      page,
      seedHabit,
    }) => {
      await seedHabit({ name: 'E2E習慣' });
      await page.goto('/calendar');
      // LevelBar contains "Lv." text and links to /rewards
      const levelLink = page.getByRole('link', { name: /Lv\./ });
      await expect(levelLink).toBeVisible();
      await expect(levelLink).toHaveAttribute('href', '/rewards');
    });

    test('shows weekly and monthly stats sections', async ({
      page,
      seedHabit,
    }) => {
      await seedHabit({ name: 'E2E習慣' });
      await page.goto('/calendar');
      await expect(page.getByTestId('stats-weekly')).toBeVisible();
      await expect(page.getByTestId('stats-monthly')).toBeVisible();
      await expect(page.getByText('今週')).toBeVisible();
      await expect(page.getByText('今月')).toBeVisible();
    });

    test('LevelBar tap navigates to /rewards', async ({ page, seedHabit }) => {
      await seedHabit({ name: 'E2E習慣' });
      await page.goto('/calendar');
      await page.getByRole('link', { name: /Lv\./ }).click();
      await expect(page).toHaveURL(/\/rewards$/);
    });
  });

  test.describe('Rewards CRUD', () => {
    test('back-to-calendar link goes back', async ({ page }) => {
      await page.goto('/rewards');
      await page.getByRole('link', { name: /カレンダーに戻る/ }).click();
      await expect(page).toHaveURL(/\/calendar$/);
    });

    test('creates a new reward', async ({ page }) => {
      await page.goto('/rewards');
      await page.getByLabel('レベル').fill('5');
      await page.getByLabel('ご褒美の内容').fill('映画を見る');
      await page.getByRole('button', { name: '追加' }).click();
      await expect(page.getByText('映画を見る')).toBeVisible();
      await expect(page.getByText('Lv.5')).toBeVisible();
    });

    test('edits a reward description', async ({ page, seedReward }) => {
      await seedReward(5, '映画を見る');
      await page.goto('/rewards');
      await expect(page.getByText('映画を見る')).toBeVisible();

      await page.getByRole('button', { name: '編集' }).first().click();
      const editInput = page.getByLabel('ご褒美の内容').last();
      await editInput.fill('映画を2本見る');
      await page.getByRole('button', { name: '保存' }).click();
      await expect(page.getByText('映画を2本見る')).toBeVisible();
    });

    test('deletes a reward', async ({ page, seedReward }) => {
      await seedReward(5, '映画を見る');
      await page.goto('/rewards');
      await expect(page.getByText('映画を見る')).toBeVisible();
      await page.getByRole('button', { name: '削除' }).first().click();
      await expect(page.getByText('映画を見る')).not.toBeVisible();
    });

    test('shows duplicate level error', async ({ page, seedReward }) => {
      await seedReward(5, '映画を見る');
      await page.goto('/rewards');
      await page.getByLabel('レベル').fill('5');
      await page.getByLabel('ご褒美の内容').fill('別のご褒美');
      await page.getByRole('button', { name: '追加' }).click();
      await expect(
        page.getByText(/レベル 5 には既にご褒美が登録されています/),
      ).toBeVisible();
    });

    test('shows empty state initially', async ({ page }) => {
      await page.goto('/rewards');
      await expect(page.getByText(/まだご褒美がありません/)).toBeVisible();
    });
  });

  test.describe('Level-up dialog', () => {
    test('shows level-up dialog when stored level is lower than current', async ({
      page,
      seedHabit,
      seedCompletion,
    }) => {
      // Seed a habit created 30 days ago so past completions fall in range
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30);
      const oldIso = oldDate.toISOString();
      const { id } = await seedHabit({ name: 'E2E習慣', createdAt: oldIso });

      // Add 10 consecutive completions ending today
      const today = new Date();
      for (let i = 0; i < 10; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        await seedCompletion(id, dateString);
      }

      // First load: persist initial localStorage
      await page.goto('/calendar');
      // Force localStorage to a low level so the next load triggers level-up
      await page.evaluate(() => {
        localStorage.setItem('daily-rituals-last-level', '1');
      });
      await page.reload();

      // The dialog should appear
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('レベルアップ！')).toBeVisible();
      // The level transition should reference Lv.1
      await expect(page.getByText('Lv.1', { exact: false })).toBeVisible();

      // Close button dismisses (exact match avoids the X button "ダイアログを閉じる")
      await page.getByRole('button', { name: '閉じる', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('shows reward in level-up dialog when reward is registered', async ({
      page,
      seedHabit,
      seedCompletion,
      seedReward,
    }) => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30);
      const { id } = await seedHabit({
        name: 'E2E習慣',
        createdAt: oldDate.toISOString(),
      });
      const today = new Date();
      for (let i = 0; i < 10; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        await seedCompletion(id, dateString);
      }
      // Seed reward at level 3 (the user reaches Lv.3 with these completions)
      await seedReward(3, '特別なディナー');

      await page.goto('/calendar');
      await page.evaluate(() => {
        localStorage.setItem('daily-rituals-last-level', '1');
      });
      await page.reload();

      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
      // Rewards may load slightly after the dialog opens, so allow extra time
      await expect(page.getByText('特別なディナー')).toBeVisible({ timeout: 10000 });
    });

    test('does not show dialog on first visit', async ({ page, seedHabit }) => {
      await seedHabit({ name: 'E2E習慣' });
      // Clean storage to simulate first visit
      await page.goto('/calendar');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });
});
