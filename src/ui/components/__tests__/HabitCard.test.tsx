/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HabitCard } from '../HabitCard';
import type { Habit, Streak } from '@/domain/models';
import type { WeeklyProgress } from '@/domain/services/frequencyService';

// --- Helpers ---

function createTestHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    userId: 'user-1',
    name: '朝のジョギング',
    frequency: { type: 'daily' },
    color: 'blue',
    createdAt: '2025-01-01T00:00:00Z',
    archivedAt: null,
    ...overrides,
  };
}

const DEFAULT_STREAK: Streak = { current: 0, longest: 0 };
const DEFAULT_PROGRESS: WeeklyProgress = { done: 0, target: 7 };

function renderCard(overrides: {
  habit?: Habit;
  isCompleted?: boolean;
  streak?: Streak;
  weeklyProgress?: WeeklyProgress;
  onToggle?: () => void;
  isToggling?: boolean;
} = {}) {
  const props = {
    habit: overrides.habit ?? createTestHabit(),
    isCompleted: overrides.isCompleted ?? false,
    streak: overrides.streak ?? DEFAULT_STREAK,
    weeklyProgress: overrides.weeklyProgress ?? DEFAULT_PROGRESS,
    onToggle: overrides.onToggle ?? vi.fn(),
    isToggling: overrides.isToggling ?? false,
  };
  return render(<HabitCard {...props} />);
}

// --- Tests ---

describe('HabitCard', () => {
  it('renders the habit name', () => {
    renderCard();
    expect(screen.getByText('朝のジョギング')).toBeInTheDocument();
  });

  it('renders frequency label', () => {
    renderCard({ habit: createTestHabit({ frequency: { type: 'daily' } }) });
    expect(screen.getByText('毎日')).toBeInTheDocument();
  });

  it('renders weekly_days frequency label', () => {
    renderCard({
      habit: createTestHabit({
        frequency: { type: 'weekly_days', days: [1, 3, 5] },
      }),
    });
    expect(screen.getByText('月水金')).toBeInTheDocument();
  });

  it('renders weekly_count frequency label', () => {
    renderCard({
      habit: createTestHabit({
        frequency: { type: 'weekly_count', count: 3 },
      }),
    });
    expect(screen.getByText('週3回')).toBeInTheDocument();
  });

  it('shows streak badge when current streak is greater than 0', () => {
    renderCard({ streak: { current: 5, longest: 10 } });
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByLabelText('5日連続')).toBeInTheDocument();
  });

  it('does not show streak badge when current streak is 0', () => {
    renderCard({ streak: { current: 0, longest: 5 } });
    expect(screen.queryByLabelText(/日連続/)).not.toBeInTheDocument();
  });

  it('shows weekly progress bar', () => {
    renderCard({ weeklyProgress: { done: 3, target: 5 } });
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: '今週の進捗: 3/5' }),
    ).toBeInTheDocument();
  });

  it('calls onToggle when checkbox is clicked', () => {
    const onToggle = vi.fn();
    renderCard({ onToggle });
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('renders completed state with line-through', () => {
    renderCard({ isCompleted: true });
    const nameEl = screen.getByText('朝のジョギング');
    expect(nameEl).toHaveClass('line-through');
  });

  it('applies the correct color border for known colors', () => {
    const { container } = renderCard({
      habit: createTestHabit({ color: 'red' }),
    });
    const card = container.querySelector('[data-testid="habit-card-habit-1"]');
    expect(card).toHaveClass('border-l-red-500');
  });

  it('applies gray border for unknown colors', () => {
    const { container } = renderCard({
      habit: createTestHabit({ color: 'unknown' }),
    });
    const card = container.querySelector('[data-testid="habit-card-habit-1"]');
    expect(card).toHaveClass('border-l-gray-500');
  });

  it('shows appropriate aria-label on checkbox for incomplete habit', () => {
    renderCard({ isCompleted: false });
    expect(
      screen.getByLabelText('朝のジョギングを完了にする'),
    ).toBeInTheDocument();
  });

  it('shows appropriate aria-label on checkbox for completed habit', () => {
    renderCard({ isCompleted: true });
    expect(
      screen.getByLabelText('朝のジョギングを未完了にする'),
    ).toBeInTheDocument();
  });
});
