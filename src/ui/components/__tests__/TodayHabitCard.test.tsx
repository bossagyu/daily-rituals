/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TodayHabitCard } from '../TodayHabitCard';
import type { Habit } from '@/domain/models/habit';

const baseHabit: Habit = {
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

const defaultProps = {
  isCompleted: false,
  streak: { current: 0, longest: 0 },
  weeklyProgress: { done: 0, target: 7 },
  onToggle: vi.fn(),
};

describe('TodayHabitCard', () => {
  it('renders habit name', () => {
    render(
      <TodayHabitCard habit={baseHabit} {...defaultProps} />,
    );
    expect(screen.getByText('読書する')).toBeInTheDocument();
  });

  it('does not show reminder time when reminderTime is null', () => {
    render(
      <TodayHabitCard habit={baseHabit} {...defaultProps} />,
    );
    expect(screen.queryByText(/通知/)).not.toBeInTheDocument();
  });

  it('shows reminder time when reminderTime is set', () => {
    const habitWithReminder: Habit = {
      ...baseHabit,
      reminderTime: '09:00:00',
    };
    render(
      <TodayHabitCard habit={habitWithReminder} {...defaultProps} />,
    );
    expect(screen.getByText(/通知/)).toBeInTheDocument();
  });
});
