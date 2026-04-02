/**
 * @vitest-environment jsdom
 */

/**
 * NavigationBar tests - Verifies navigation items are rendered correctly.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { SideNavigation, BottomNavigation } from '../NavigationBar';

describe('SideNavigation', () => {
  function renderSideNav() {
    return render(
      <MemoryRouter>
        <SideNavigation />
      </MemoryRouter>,
    );
  }

  it('renders Today link', () => {
    renderSideNav();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders Habits link', () => {
    renderSideNav();
    expect(screen.getByText('習慣一覧')).toBeInTheDocument();
  });

  it('renders Settings link', () => {
    renderSideNav();
    expect(screen.getByText('設定')).toBeInTheDocument();
  });

  it('does not render logout button', () => {
    renderSideNav();
    expect(screen.queryByText('ログアウト')).not.toBeInTheDocument();
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
  function renderBottomNav() {
    return render(
      <MemoryRouter>
        <BottomNavigation />
      </MemoryRouter>,
    );
  }

  it('renders Today link', () => {
    renderBottomNav();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders Habits link', () => {
    renderBottomNav();
    expect(screen.getByText('習慣一覧')).toBeInTheDocument();
  });

  it('renders Settings link', () => {
    renderBottomNav();
    expect(screen.getByText('設定')).toBeInTheDocument();
  });

  it('does not render logout button', () => {
    renderBottomNav();
    expect(screen.queryByText('ログアウト')).not.toBeInTheDocument();
  });

  it('renders navigation with accessible label', () => {
    renderBottomNav();
    const nav = screen.getByRole('navigation', {
      name: 'メインナビゲーション',
    });
    expect(nav).toBeInTheDocument();
  });
});
