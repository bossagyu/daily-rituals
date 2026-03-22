/**
 * @vitest-environment jsdom
 */

/**
 * HabitCard tests - Verifies rendering, navigation link, and archive action.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { HabitCard } from '../HabitCard';
import type { Habit } from '@/domain/models/habit';

const activeHabit: Habit = {
  id: 'h1',
  userId: 'u1',
  name: '読書する',
  frequency: { type: 'daily' },
  color: '#4CAF50',
  createdAt: '2026-01-01T00:00:00Z',
  archivedAt: null,
  reminderTime: null,
  lastNotifiedDate: null,
};

const archivedHabit: Habit = {
  ...activeHabit,
  id: 'h2',
  name: '瞑想する',
  archivedAt: '2026-02-01T00:00:00Z',
};

describe('HabitCard', () => {
  const mockOnRestore = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders habit name and frequency', () => {
    render(
      <MemoryRouter>
        <HabitCard habit={activeHabit} isArchived={false} />
      </MemoryRouter>,
    );
    expect(screen.getByText('読書する')).toBeInTheDocument();
    expect(screen.getByText('毎日')).toBeInTheDocument();
  });

  it('renders edit link pointing to /habits/:id', () => {
    render(
      <MemoryRouter>
        <HabitCard habit={activeHabit} isArchived={false} />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/habits/h1');
  });

  it('does not show restore button for active habits', () => {
    render(
      <MemoryRouter>
        <HabitCard habit={activeHabit} isArchived={false} />
      </MemoryRouter>,
    );
    expect(screen.queryByText('復元')).not.toBeInTheDocument();
  });

  it('shows restore button for archived habits', () => {
    render(
      <MemoryRouter>
        <HabitCard habit={archivedHabit} onRestore={mockOnRestore} isArchived={true} />
      </MemoryRouter>,
    );
    expect(screen.getByText('復元')).toBeInTheDocument();
  });

  it('calls onArchive when restore button is clicked', () => {
    render(
      <MemoryRouter>
        <HabitCard habit={archivedHabit} onRestore={mockOnRestore} isArchived={true} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('復元'));
    expect(mockOnRestore).toHaveBeenCalledWith('h2');
  });

  it('applies line-through style for archived habits', () => {
    render(
      <MemoryRouter>
        <HabitCard habit={archivedHabit} onRestore={mockOnRestore} isArchived={true} />
      </MemoryRouter>,
    );
    const name = screen.getByText('瞑想する');
    expect(name).toHaveClass('line-through');
  });

  it('displays weekly_days frequency correctly', () => {
    const weeklyHabit: Habit = {
      ...activeHabit,
      frequency: { type: 'weekly_days', days: [1, 3, 5] },
    };
    render(
      <MemoryRouter>
        <HabitCard habit={weeklyHabit} isArchived={false} />
      </MemoryRouter>,
    );
    expect(screen.getByText('月・水・金')).toBeInTheDocument();
  });

  it('displays weekly_count frequency correctly', () => {
    const countHabit: Habit = {
      ...activeHabit,
      frequency: { type: 'weekly_count', count: 3 },
    };
    render(
      <MemoryRouter>
        <HabitCard habit={countHabit} isArchived={false} />
      </MemoryRouter>,
    );
    expect(screen.getByText('週3回')).toBeInTheDocument();
  });

  it('renders color indicator with correct background color', () => {
    const { container } = render(
      <MemoryRouter>
        <HabitCard habit={activeHabit} isArchived={false} />
      </MemoryRouter>,
    );
    const colorDot = container.querySelector('[aria-hidden="true"]');
    expect(colorDot).toHaveStyle({ backgroundColor: '#4CAF50' });
  });

  it('does not show reminder time when reminderTime is null', () => {
    render(
      <MemoryRouter>
        <HabitCard habit={activeHabit} isArchived={false} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/🔔/)).not.toBeInTheDocument();
  });

  it('shows reminder time when reminderTime is set', () => {
    const habitWithReminder: Habit = {
      ...activeHabit,
      reminderTime: '09:00:00',
    };
    render(
      <MemoryRouter>
        <HabitCard habit={habitWithReminder} isArchived={false} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/🔔/)).toBeInTheDocument();
  });
});
