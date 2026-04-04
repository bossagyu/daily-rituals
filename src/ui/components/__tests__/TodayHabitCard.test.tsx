/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
  streak: { current: 0, longest: 0, totalDays: 0 },
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

  it('shows streak and total days when both current > 0 and totalDays > 0', () => {
    render(
      <TodayHabitCard
        habit={baseHabit}
        {...defaultProps}
        streak={{ current: 3, longest: 5, totalDays: 10 }}
      />,
    );
    expect(screen.getByText('3日連続 / 計10日')).toBeInTheDocument();
  });

  it('shows only total days when current is 0 but totalDays > 0', () => {
    render(
      <TodayHabitCard
        habit={baseHabit}
        {...defaultProps}
        streak={{ current: 0, longest: 5, totalDays: 10 }}
      />,
    );
    expect(screen.getByText('計10日')).toBeInTheDocument();
    expect(screen.queryByText(/日連続/)).not.toBeInTheDocument();
  });

  it('shows nothing when both current and totalDays are 0', () => {
    render(
      <TodayHabitCard
        habit={baseHabit}
        {...defaultProps}
        streak={{ current: 0, longest: 0, totalDays: 0 }}
      />,
    );
    expect(screen.queryByText(/日連続/)).not.toBeInTheDocument();
    expect(screen.queryByText(/計.*日/)).not.toBeInTheDocument();
  });

  it('disables checkbox when disabled is true', () => {
    render(
      <TodayHabitCard habit={baseHabit} {...defaultProps} disabled={true} />,
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
  });

  it('applies opacity-60 when disabled', () => {
    const { container } = render(
      <TodayHabitCard habit={baseHabit} {...defaultProps} disabled />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('opacity-60');
  });

  it('does not call onToggle when disabled and checkbox is clicked', () => {
    const onToggle = vi.fn();
    render(
      <TodayHabitCard
        habit={baseHabit}
        {...defaultProps}
        onToggle={onToggle}
        disabled={true}
      />,
    );
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
