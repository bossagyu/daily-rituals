/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TaskCard } from '../TaskCard';
import type { Task } from '@/domain/models/task';

const baseTask: Task = {
  id: 't1',
  userId: 'u1',
  name: '買い物に行く',
  dueDate: '2026-03-27',
  completedAt: null,
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
};

const completedTask: Task = {
  ...baseTask,
  id: 't2',
  completedAt: '2026-03-27T10:00:00Z',
};

const taskNoDueDate: Task = {
  ...baseTask,
  id: 't3',
  dueDate: null,
};

const defaultProps = {
  onToggleComplete: vi.fn(),
  onUpdate: vi.fn(),
  onRemove: vi.fn(),
};

describe('TaskCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders task name and shows "タスク" label when no due date', () => {
    render(<TaskCard task={taskNoDueDate} {...defaultProps} />);
    expect(screen.getByText('買い物に行く')).toBeInTheDocument();
    expect(screen.getByText('タスク')).toBeInTheDocument();
  });

  it('renders due date label when due date is set', () => {
    render(<TaskCard task={baseTask} {...defaultProps} />);
    expect(screen.getByText('2026-03-27')).toBeInTheDocument();
  });

  it('shows line-through and opacity for completed task', () => {
    const { container } = render(
      <TaskCard task={completedTask} {...defaultProps} />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('opacity-60');
    const nameSpan = screen.getByText('買い物に行く');
    expect(nameSpan.className).toContain('line-through');
  });

  it('disables checkbox when disabled is true', () => {
    render(
      <TaskCard task={baseTask} {...defaultProps} disabled={true} />,
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
  });

  it('expands edit form when card is clicked', () => {
    render(<TaskCard task={baseTask} {...defaultProps} />);
    const card = screen.getByTestId('task-card');
    fireEvent.click(card);
    expect(screen.getByLabelText('タスク名')).toBeInTheDocument();
    expect(screen.getByText('保存')).toBeInTheDocument();
    expect(screen.getByText('削除')).toBeInTheDocument();
  });

  it('saves updated task name', () => {
    const onUpdate = vi.fn();
    render(
      <TaskCard task={baseTask} {...defaultProps} onUpdate={onUpdate} />,
    );

    // Expand
    const card = screen.getByTestId('task-card');
    fireEvent.click(card);

    // Edit name
    const input = screen.getByLabelText('タスク名');
    fireEvent.change(input, { target: { value: '新しいタスク名' } });

    // Save
    fireEvent.click(screen.getByText('保存'));
    expect(onUpdate).toHaveBeenCalledWith('t1', { name: '新しいタスク名' });
  });
});
