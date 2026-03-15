/**
 * @vitest-environment jsdom
 */

/**
 * NavigationBar tests - Verifies navigation items and logout button.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { SideNavigation, BottomNavigation } from '../NavigationBar';

describe('SideNavigation', () => {
  const mockSignOut = vi.fn();

  function renderSideNav() {
    return render(
      <MemoryRouter>
        <SideNavigation onSignOut={mockSignOut} />
      </MemoryRouter>,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Today link', () => {
    renderSideNav();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders Habits link', () => {
    renderSideNav();
    expect(screen.getByText('習慣一覧')).toBeInTheDocument();
  });

  it('renders logout button', () => {
    renderSideNav();
    expect(screen.getByText('ログアウト')).toBeInTheDocument();
  });

  it('calls onSignOut when logout button is clicked', () => {
    renderSideNav();
    fireEvent.click(screen.getByText('ログアウト'));
    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it('renders navigation with accessible label', () => {
    renderSideNav();
    const nav = screen.getByRole('navigation', {
      name: 'メインナビゲーション',
    });
    expect(nav).toBeInTheDocument();
  });
});

describe('BottomNavigation', () => {
  const mockSignOut = vi.fn();

  function renderBottomNav() {
    return render(
      <MemoryRouter>
        <BottomNavigation onSignOut={mockSignOut} />
      </MemoryRouter>,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Today link', () => {
    renderBottomNav();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders Habits link', () => {
    renderBottomNav();
    expect(screen.getByText('習慣一覧')).toBeInTheDocument();
  });

  it('renders logout button', () => {
    renderBottomNav();
    expect(screen.getByText('ログアウト')).toBeInTheDocument();
  });

  it('calls onSignOut when logout button is clicked', () => {
    renderBottomNav();
    fireEvent.click(screen.getByText('ログアウト'));
    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it('renders navigation with accessible label', () => {
    renderBottomNav();
    const nav = screen.getByRole('navigation', {
      name: 'メインナビゲーション',
    });
    expect(nav).toBeInTheDocument();
  });
});
