/**
 * @vitest-environment jsdom
 */

/**
 * AppLayout tests - Verifies navigation items are rendered
 * and responsive layout structure.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { AppLayout } from '../AppLayout';

// Mock useAuthContext to provide a test user
vi.mock('@/hooks/useAuthContext', () => ({
  useAuthContext: () => ({
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      user_metadata: { full_name: 'Test User' },
    },
    isLoading: false,
    error: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

function renderWithRouter(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AppLayout />
    </MemoryRouter>,
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the app header with title', () => {
    renderWithRouter();
    expect(screen.getByText('Daily Rituals')).toBeInTheDocument();
  });

  it('renders Today navigation items', () => {
    renderWithRouter();
    const todayLinks = screen.getAllByText('Today');
    expect(todayLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Habits navigation items', () => {
    renderWithRouter();
    const habitsLinks = screen.getAllByText('習慣一覧');
    expect(habitsLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Settings navigation items', () => {
    renderWithRouter();
    const settingsLinks = screen.getAllByText('設定');
    expect(settingsLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render logout buttons in navigation', () => {
    renderWithRouter();
    expect(screen.queryByText('ログアウト')).not.toBeInTheDocument();
  });

  it('renders navigation with correct roles', () => {
    renderWithRouter();
    const navElements = screen.getAllByRole('navigation', {
      name: 'メインナビゲーション',
    });
    // Side navigation + bottom navigation
    expect(navElements).toHaveLength(2);
  });

  it('renders main content area', () => {
    renderWithRouter();
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
  });
});
