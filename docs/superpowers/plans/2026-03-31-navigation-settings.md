# ナビゲーション改善 & 設定ページ追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ボトムナビ・ヘッダーからログアウトを除去し、新設する設定ページに移動する

**Architecture:** 既存のNavigationBar, AppHeader, AppLayoutを修正し、新規SettingsPageを追加。設定ページではuseAuthContextからsignOutを取得してログアウトを実行する。確認ダイアログはwindow.confirmを使用。

**Tech Stack:** React, TypeScript, React Router, Tailwind CSS, Vitest, Playwright

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/ui/components/AppHeader.tsx` | Modify | アプリ名のみ表示に簡素化 |
| `src/ui/components/NavigationBar.tsx` | Modify | 設定タブ追加、ログアウト関連削除 |
| `src/ui/layouts/AppLayout.tsx` | Modify | signOut props削除 |
| `src/ui/pages/SettingsPage.tsx` | Create | 設定ページ（ログアウト + バージョン表示） |
| `src/App.tsx` | Modify | `/settings`ルート追加 |
| `src/ui/components/__tests__/AppHeader.test.tsx` | Create | ヘッダーのユニットテスト |
| `src/ui/pages/__tests__/SettingsPage.test.tsx` | Create | 設定ページのユニットテスト |
| `e2e/specs/navigation.spec.ts` | Modify | 設定タブのナビゲーションテスト追加 |
| `e2e/specs/z-signout.spec.ts` | Modify | 設定ページ経由のログアウトに変更 |

---

### Task 1: SettingsPage - テストとコンポーネント作成

**Files:**
- Create: `src/ui/pages/__tests__/SettingsPage.test.tsx`
- Create: `src/ui/pages/SettingsPage.tsx`

- [ ] **Step 1: SettingsPageのテストを書く**

```tsx
/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { SettingsPage } from '../SettingsPage';

const mockSignOut = vi.fn().mockResolvedValue(undefined);

vi.mock('@/hooks/useAuthContext', () => ({
  useAuthContext: () => ({
    user: { id: 'user-1' },
    isLoading: false,
    error: null,
    signIn: vi.fn(),
    signOut: mockSignOut,
    refreshSession: vi.fn(),
  }),
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '設定' })).toBeInTheDocument();
  });

  it('renders logout item', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
  });

  it('calls signOut when logout is confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('does not call signOut when logout is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('renders version info', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Daily Rituals v/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/ui/pages/__tests__/SettingsPage.test.tsx`
Expected: FAIL — `SettingsPage` が存在しない

- [ ] **Step 3: SettingsPageを実装**

```tsx
import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuthContext } from '@/hooks/useAuthContext';

export function SettingsPage() {
  const { signOut } = useAuthContext();

  const handleSignOut = () => {
    if (window.confirm('ログアウトしますか？')) {
      void signOut();
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-foreground">設定</h1>

      <div className="divide-y divide-border rounded-lg border border-border">
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          onClick={handleSignOut}
        >
          <LogOut className="size-5 text-muted-foreground" />
          <span>ログアウト</span>
        </button>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Daily Rituals v1.0.0
      </p>
    </div>
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/ui/pages/__tests__/SettingsPage.test.tsx`
Expected: PASS（5 tests）

- [ ] **Step 5: コミット**

```bash
git add src/ui/pages/SettingsPage.tsx src/ui/pages/__tests__/SettingsPage.test.tsx
git commit -m "feat: add SettingsPage with logout and confirmation dialog"
```

---

### Task 2: AppHeader簡素化

**Files:**
- Create: `src/ui/components/__tests__/AppHeader.test.tsx`
- Modify: `src/ui/components/AppHeader.tsx`

- [ ] **Step 1: 簡素化後のAppHeaderテストを書く**

```tsx
/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AppHeader } from '../AppHeader';

describe('AppHeader', () => {
  it('renders app name', () => {
    render(<AppHeader />);
    expect(screen.getByText('Daily Rituals')).toBeInTheDocument();
  });

  it('does not render logout button', () => {
    render(<AppHeader />);
    expect(screen.queryByRole('button', { name: /ログアウト/ })).not.toBeInTheDocument();
  });

  it('does not render user name', () => {
    render(<AppHeader />);
    expect(screen.queryByText(/kouhei/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/ui/components/__tests__/AppHeader.test.tsx`
Expected: FAIL — AppHeaderにpropsが必要なためエラー

- [ ] **Step 3: AppHeaderを簡素化**

`src/ui/components/AppHeader.tsx` を以下に置き換え:

```tsx
import React from 'react';

export function AppHeader() {
  return (
    <header className="flex items-center justify-center border-b border-border bg-background px-4 py-3">
      <h1 className="text-lg font-semibold text-foreground">Daily Rituals</h1>
    </header>
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/ui/components/__tests__/AppHeader.test.tsx`
Expected: PASS（3 tests）

- [ ] **Step 5: コミット**

```bash
git add src/ui/components/AppHeader.tsx src/ui/components/__tests__/AppHeader.test.tsx
git commit -m "refactor: simplify AppHeader to show only app name"
```

---

### Task 3: NavigationBar・AppLayout - 設定タブ追加・ログアウト削除

**Files:**
- Modify: `src/ui/components/NavigationBar.tsx`
- Modify: `src/ui/layouts/AppLayout.tsx`

- [ ] **Step 1: NavigationBarを修正**

`src/ui/components/NavigationBar.tsx` を修正:

1. `LogOut` を `Settings` に変更（lucide-react import）
2. `NAV_ITEMS` に設定を追加:

```tsx
import { CalendarDays, CalendarRange, ListTodo, Settings } from 'lucide-react';
```

```tsx
const NAV_ITEMS: readonly NavItemConfig[] = [
  {
    to: '/',
    label: 'Today',
    icon: <CalendarDays className="size-5" />,
  },
  {
    to: '/calendar',
    label: 'カレンダー',
    icon: <CalendarRange className="size-5" />,
  },
  {
    to: '/habits',
    label: '習慣一覧',
    icon: <ListTodo className="size-5" />,
  },
  {
    to: '/settings',
    label: '設定',
    icon: <Settings className="size-5" />,
  },
];
```

3. `NavigationBarProps` 型を削除（`onSignOut` 不要に）
4. `SideNavigation` — propsなし、下部のログアウトボタン削除
5. `BottomNavigation` — propsなし、ログアウトボタン削除
6. `Button` import を削除

- [ ] **Step 2: AppLayoutを修正**

`src/ui/layouts/AppLayout.tsx` を修正:

```tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from '@/ui/components/AppHeader';
import {
  SideNavigation,
  BottomNavigation,
} from '@/ui/components/NavigationBar';
import { useAuthContext } from '@/hooks/useAuthContext';

export function AppLayout() {
  const { user } = useAuthContext();

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <SideNavigation />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
}
```

- [ ] **Step 3: ユニットテストが全て通ることを確認**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add src/ui/components/NavigationBar.tsx src/ui/layouts/AppLayout.tsx
git commit -m "refactor: replace logout with settings tab in navigation and layout"
```

---

### Task 4: ルーティング - /settings追加

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: App.tsxにSettingsPageルートを追加**

`src/App.tsx` に以下を追加:

import文:
```tsx
import { SettingsPage } from '@/ui/pages/SettingsPage';
```

Routeに追加（`<Route path="/habits/:id" .../>` の後に）:
```tsx
<Route path="/settings" element={<SettingsPage />} />
```

- [ ] **Step 2: ビルドが通ることを確認**

Run: `npm run build`
Expected: PASS（エラーなし）

- [ ] **Step 3: コミット**

```bash
git add src/App.tsx
git commit -m "feat: add /settings route"
```

---

### Task 5: E2Eテスト更新

**Files:**
- Modify: `e2e/specs/navigation.spec.ts`
- Modify: `e2e/specs/z-signout.spec.ts`

- [ ] **Step 1: navigation.spec.tsに設定タブテストを追加**

`e2e/specs/navigation.spec.ts` に以下のテストを追加:

```tsx
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
```

- [ ] **Step 2: z-signout.spec.tsを設定ページ経由に変更**

`e2e/specs/z-signout.spec.ts` を修正:

```tsx
import { test, expect } from '../fixtures/base';

test.describe('Sign Out', () => {
  test('signs out via settings page and redirects to login', async ({ page }) => {
    await page.goto('/');

    // Wait for authenticated page to load
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();

    // Navigate to settings
    await page.getByRole('link', { name: /設定/ }).first().click();
    await expect(page.getByRole('heading', { name: '設定' })).toBeVisible();

    // Accept the confirmation dialog
    page.on('dialog', (dialog) => dialog.accept());

    // Click logout
    await page.getByRole('button', { name: /ログアウト/ }).click();

    // Should show login page
    await expect(
      page.getByRole('button', { name: /Sign in with Google/i }),
    ).toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Step 3: E2Eテストを実行**

Run: `npx playwright test`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add e2e/specs/navigation.spec.ts e2e/specs/z-signout.spec.ts
git commit -m "test: update E2E tests for settings page navigation and logout"
```
