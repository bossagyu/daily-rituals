/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { LevelBar } from '../LevelBar';

describe('LevelBar', () => {
  it('renders the current level number', () => {
    render(
      <MemoryRouter>
        <LevelBar level={12} currentXp={20} requiredXp={65} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Lv\.12/i)).toBeInTheDocument();
  });

  it('renders the current and required XP', () => {
    render(
      <MemoryRouter>
        <LevelBar level={5} currentXp={15} requiredXp={30} />
      </MemoryRouter>,
    );
    expect(screen.getByText('15 / 30 XP')).toBeInTheDocument();
  });

  it('renders progress bar with width matching XP ratio', () => {
    render(
      <MemoryRouter>
        <LevelBar level={3} currentXp={10} requiredXp={20} />
      </MemoryRouter>,
    );
    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuenow', '10');
    expect(progress).toHaveAttribute('aria-valuemin', '0');
    expect(progress).toHaveAttribute('aria-valuemax', '20');
    // Visual fill: 50%
    const fill = progress.querySelector('[data-testid="level-bar-fill"]') as HTMLElement;
    expect(fill).toBeTruthy();
    expect(fill.style.width).toBe('50%');
  });

  it('renders progress bar with 0% width when currentXp is 0', () => {
    render(
      <MemoryRouter>
        <LevelBar level={1} currentXp={0} requiredXp={10} />
      </MemoryRouter>,
    );
    const fill = screen
      .getByRole('progressbar')
      .querySelector('[data-testid="level-bar-fill"]') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('caps progress bar width at 100% even when XP exceeds required', () => {
    render(
      <MemoryRouter>
        <LevelBar level={1} currentXp={50} requiredXp={10} />
      </MemoryRouter>,
    );
    const fill = screen
      .getByRole('progressbar')
      .querySelector('[data-testid="level-bar-fill"]') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });

  it('renders 0% width when requiredXp is 0 (defensive)', () => {
    render(
      <MemoryRouter>
        <LevelBar level={1} currentXp={0} requiredXp={0} />
      </MemoryRouter>,
    );
    const fill = screen
      .getByRole('progressbar')
      .querySelector('[data-testid="level-bar-fill"]') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('links to /rewards', () => {
    render(
      <MemoryRouter>
        <LevelBar level={5} currentXp={10} requiredXp={30} />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/rewards');
  });
});
