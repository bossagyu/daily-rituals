import { test, expect } from '../fixtures/base';

test.describe('Task Feature', () => {
  test('adds a task via inline input', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('+ タスクを追加...')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('+ タスクを追加...').fill('テストタスク');
    await page.getByRole('button', { name: '追加' }).click();

    await expect(page.getByText('テストタスク')).toBeVisible({ timeout: 10000 });
  });

  test('completes a task via checkbox', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('+ タスクを追加...')).toBeVisible({ timeout: 10000 });

    // Add a task first
    await page.getByPlaceholder('+ タスクを追加...').fill('完了テスト');
    await page.getByRole('button', { name: '追加' }).click();
    await expect(page.getByText('完了テスト')).toBeVisible({ timeout: 10000 });

    // Find and click the checkbox for this task
    const taskCard = page.locator('[data-testid="task-card"]').filter({ hasText: '完了テスト' });
    await taskCard.getByRole('checkbox').click();

    // Task should show as completed (with line-through style)
    await expect(taskCard.locator('.line-through')).toBeVisible({ timeout: 5000 });
  });

  test('edits a task name', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('+ タスクを追加...')).toBeVisible({ timeout: 10000 });

    // Add a task
    await page.getByPlaceholder('+ タスクを追加...').fill('編集テスト');
    await page.getByRole('button', { name: '追加' }).click();
    await expect(page.getByText('編集テスト')).toBeVisible({ timeout: 10000 });

    // Click the task name to expand (avoid clicking checkbox area)
    await page.getByText('編集テスト').click();

    // Wait for expanded state — use testid to scope within the expanded card
    const expandedCard = page.getByTestId('task-card');
    const nameInput = expandedCard.getByRole('textbox', { name: 'タスク名' });
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.clear();
    await nameInput.fill('編集済みタスク');
    await expandedCard.getByRole('button', { name: '保存' }).click();

    await expect(page.getByText('編集済みタスク')).toBeVisible({ timeout: 5000 });
  });

  test('deletes a task', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('+ タスクを追加...')).toBeVisible({ timeout: 10000 });

    // Add a task
    await page.getByPlaceholder('+ タスクを追加...').fill('削除テスト');
    await page.getByRole('button', { name: '追加' }).click();
    await expect(page.getByText('削除テスト')).toBeVisible({ timeout: 10000 });

    // Click the task name to expand (avoid clicking checkbox area)
    await page.getByText('削除テスト').click();

    // Wait for expanded state — find delete button directly since hasText filter
    // won't match the expanded card (text is in input value, not text content)
    const deleteButton = page.getByRole('button', { name: '削除' });
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

    await expect(page.getByText('削除テスト')).not.toBeVisible({ timeout: 5000 });
  });

  test('task without date shows on next day', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('+ タスクを追加...')).toBeVisible({ timeout: 10000 });

    // Add a task
    await page.getByPlaceholder('+ タスクを追加...').fill('翌日テスト');
    await page.getByRole('button', { name: '追加' }).click();
    await expect(page.getByText('翌日テスト')).toBeVisible({ timeout: 10000 });

    // Navigate to next day
    await page.getByRole('button', { name: '次の日' }).click();

    // Task should still be visible (no date = shows every day until completed)
    await expect(page.getByText('翌日テスト')).toBeVisible({ timeout: 10000 });
  });

  test('completed task does not show on next day', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('+ タスクを追加...')).toBeVisible({ timeout: 10000 });

    // Add and complete a task
    await page.getByPlaceholder('+ タスクを追加...').fill('消えるタスク');
    await page.getByRole('button', { name: '追加' }).click();
    await expect(page.getByText('消えるタスク')).toBeVisible({ timeout: 10000 });

    const taskCard = page.locator('[data-testid="task-card"]').filter({ hasText: '消えるタスク' });
    await taskCard.getByRole('checkbox').click();
    await page.waitForTimeout(1000);

    // Navigate to next day
    await page.getByRole('button', { name: '次の日' }).click();

    // Completed task should NOT be visible
    await expect(page.getByText('消えるタスク')).not.toBeVisible({ timeout: 5000 });
  });
});
