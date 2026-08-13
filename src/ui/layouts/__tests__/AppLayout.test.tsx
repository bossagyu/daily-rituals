/**
 * @vitest-environment jsdom
 */

/**
 * AppLayout tests - Verifies navigation items are rendered
 * and responsive layout structure.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { AppLayout } from '../AppLayout';
import type { PushSubscriptionRepository } from '@/data/repositories/pushSubscriptionRepository';
import type { ProfileRepository } from '@/data/repositories/profileRepository';

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

// Mock useRepositories - AppLayout reconciles the push subscription and
// syncs the timezone on mount, which requires access to
// pushSubscriptionRepository and profileRepository.
const mockPushSubscriptionRepository: PushSubscriptionRepository = {
  upsert: vi.fn().mockResolvedValue(undefined),
  findByEndpoint: vi.fn().mockResolvedValue(null),
  deleteByEndpoint: vi.fn().mockResolvedValue(undefined),
};

const mockProfileRepository: ProfileRepository = {
  findMine: vi.fn().mockResolvedValue(null),
  updateTimezone: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/hooks/useRepositories', () => ({
  useRepositories: () => ({
    pushSubscriptionRepository: mockPushSubscriptionRepository,
    profileRepository: mockProfileRepository,
  }),
}));

// Mock usePushSubscriptionReconcile so navigation tests below don't touch
// the real service worker / Notification APIs, and so the wiring test below
// can assert AppLayout actually invokes it on mount.
const mockReconcile = vi.fn();
vi.mock('@/hooks/usePushSubscriptionReconcile', () => ({
  usePushSubscriptionReconcile: (
    repository: PushSubscriptionRepository | null,
  ) => mockReconcile(repository),
}));

// Mock useTimezoneSync so the wiring test below can assert AppLayout
// actually invokes it on mount, without touching Intl/DB.
const mockTimezoneSync = vi.fn();
vi.mock('@/hooks/useTimezoneSync', () => ({
  useTimezoneSync: (repository: ProfileRepository | null) =>
    mockTimezoneSync(repository),
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

describe('AppLayout push subscription reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Regression test for the case where usePushSubscription (and therefore
  // reconcileSubscription) was only wired into NewHabitPage/HabitDetailPage,
  // so a user landing on any other route (e.g. the default "/" Today page)
  // never triggered a re-subscribe after iOS silently dropped the
  // subscription. AppLayout wraps every authenticated route, so reconciling
  // here guarantees it runs once per session regardless of the landing page.
  it('reconciles the push subscription on mount, regardless of route', async () => {
    renderWithRouter('/');

    await waitFor(() => {
      expect(mockReconcile).toHaveBeenCalledWith(mockPushSubscriptionRepository);
    });
  });

  it('reconciles the push subscription even when landing on a non-default route', async () => {
    renderWithRouter('/calendar');

    await waitFor(() => {
      expect(mockReconcile).toHaveBeenCalledWith(mockPushSubscriptionRepository);
    });
  });
});

describe('AppLayout timezone sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Regression test for the same class of bug as the push subscription
  // reconciliation above: a hook wired into only specific pages silently
  // never runs when the user lands elsewhere, and unit tests for the hook
  // itself can't catch that because they don't check where it's called
  // from. AppLayout wraps every authenticated route, so syncing here
  // guarantees the browser's timezone reaches profiles once per session
  // regardless of the landing page.
  it('syncs the timezone on mount, regardless of route', async () => {
    renderWithRouter('/');

    await waitFor(() => {
      expect(mockTimezoneSync).toHaveBeenCalledWith(mockProfileRepository);
    });
  });

  it('syncs the timezone even when landing on a non-default route', async () => {
    renderWithRouter('/calendar');

    await waitFor(() => {
      expect(mockTimezoneSync).toHaveBeenCalledWith(mockProfileRepository);
    });
  });
});
