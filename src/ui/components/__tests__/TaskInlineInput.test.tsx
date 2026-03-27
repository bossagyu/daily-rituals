/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TaskInlineInput } from '../TaskInlineInput';

describe('TaskInlineInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call onAdd when input is empty', () => {
    const onAdd = vi.fn();
    render(<TaskInlineInput onAdd={onAdd} />);
    fireEvent.click(screen.getByText('追加'));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('does not call onAdd when input is only whitespace', () => {
    const onAdd = vi.fn();
    render(<TaskInlineInput onAdd={onAdd} />);
    const input = screen.getByLabelText('新しいタスク名');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByText('追加'));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('calls onAdd with trimmed name and clears input', () => {
    const onAdd = vi.fn();
    render(<TaskInlineInput onAdd={onAdd} />);
    const input = screen.getByLabelText('新しいタスク名');
    fireEvent.change(input, { target: { value: '  新しいタスク  ' } });
    fireEvent.click(screen.getByText('追加'));
    expect(onAdd).toHaveBeenCalledWith('新しいタスク');
    expect(input).toHaveValue('');
  });

  it('submits on Enter key', () => {
    const onAdd = vi.fn();
    render(<TaskInlineInput onAdd={onAdd} />);
    const input = screen.getByLabelText('新しいタスク名');
    fireEvent.change(input, { target: { value: 'Enterで追加' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith('Enterで追加');
    expect(input).toHaveValue('');
  });
});
