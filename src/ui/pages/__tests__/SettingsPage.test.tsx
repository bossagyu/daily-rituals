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
