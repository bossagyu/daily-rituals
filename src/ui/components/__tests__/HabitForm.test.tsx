/**
 * @vitest-environment jsdom
 */

/**
 * HabitForm tests - Verifies form rendering, validation, and submission.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HabitForm } from '../HabitForm';
import type { HabitFormState } from '@/domain/models/habitFormValidation';
import { PRESET_COLORS } from '@/domain/models/habitFormValidation';

describe('HabitForm', () => {
  const mockOnSubmit = vi.fn();

  function renderForm(props?: Partial<React.ComponentProps<typeof HabitForm>>) {
    return render(
      <HabitForm
        onSubmit={mockOnSubmit}
        isSubmitting={false}
        submitLabel="保存"
        {...props}
      />,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields', () => {
    renderForm();
    expect(screen.getByText('習慣名')).toBeInTheDocument();
    expect(screen.getByText('頻度')).toBeInTheDocument();
    expect(screen.getByText('色')).toBeInTheDocument();
    expect(screen.getByText('保存')).toBeInTheDocument();
  });

  it('renders frequency type buttons', () => {
    renderForm();
    expect(screen.getByText('毎日')).toBeInTheDocument();
    expect(screen.getByText('特定曜日')).toBeInTheDocument();
    expect(screen.getByText('週N回')).toBeInTheDocument();
  });

  it('shows day selector when weekly_days is selected', () => {
    renderForm();
    fireEvent.click(screen.getByText('特定曜日'));
    expect(screen.getByText('曜日を選択')).toBeInTheDocument();
    expect(screen.getByLabelText('月曜日')).toBeInTheDocument();
  });

  it('shows count input when weekly_count is selected', () => {
    renderForm();
    fireEvent.click(screen.getByText('週N回'));
    expect(screen.getByText('週の回数')).toBeInTheDocument();
  });

  it('hides day selector when daily is selected', () => {
    renderForm();
    fireEvent.click(screen.getByText('特定曜日'));
    expect(screen.getByText('曜日を選択')).toBeInTheDocument();
    fireEvent.click(screen.getByText('毎日'));
    expect(screen.queryByText('曜日を選択')).not.toBeInTheDocument();
  });

  it('shows validation error for empty name', () => {
    renderForm();
    fireEvent.click(screen.getByText('保存'));
    expect(screen.getByText('習慣名を入力してください')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows validation error for weekly_days without days selected', () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('例: 読書する'), {
      target: { value: '運動' },
    });
    fireEvent.click(screen.getByText('特定曜日'));
    fireEvent.click(screen.getByText('保存'));
    expect(
      screen.getByText('曜日を1つ以上選択してください'),
    ).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with valid daily form state', () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('例: 読書する'), {
      target: { value: '読書する' },
    });
    fireEvent.click(screen.getByText('保存'));
    expect(mockOnSubmit).toHaveBeenCalledOnce();
    const submittedState = mockOnSubmit.mock.calls[0][0] as HabitFormState;
    expect(submittedState.name).toBe('読書する');
    expect(submittedState.frequencyType).toBe('daily');
    expect(submittedState.color).toBe(PRESET_COLORS[0]);
  });

  it('calls onSubmit with valid weekly_days form state', () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('例: 読書する'), {
      target: { value: 'ジョギング' },
    });
    fireEvent.click(screen.getByText('特定曜日'));
    fireEvent.click(screen.getByLabelText('月曜日'));
    fireEvent.click(screen.getByLabelText('水曜日'));
    fireEvent.click(screen.getByText('保存'));
    expect(mockOnSubmit).toHaveBeenCalledOnce();
    const submittedState = mockOnSubmit.mock.calls[0][0] as HabitFormState;
    expect(submittedState.frequencyType).toBe('weekly_days');
    expect(submittedState.weeklyDays).toEqual([1, 3]);
  });

  it('pre-fills form with initial state', () => {
    const initialState: HabitFormState = {
      name: '瞑想する',
      frequencyType: 'weekly_count',
      weeklyDays: [],
      weeklyCount: 3,
      color: PRESET_COLORS[2],
    };
    renderForm({ initialState });
    expect(screen.getByDisplayValue('瞑想する')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
  });

  it('disables submit button when isSubmitting is true', () => {
    renderForm({ isSubmitting: true });
    expect(screen.getByText('保存中...')).toBeInTheDocument();
  });

  it('uses custom submitLabel', () => {
    renderForm({ submitLabel: '更新する' });
    expect(screen.getByText('更新する')).toBeInTheDocument();
  });

  it('clears field error when the field value changes', () => {
    renderForm();
    fireEvent.click(screen.getByText('保存'));
    expect(screen.getByText('習慣名を入力してください')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('例: 読書する'), {
      target: { value: 'a' },
    });
    expect(
      screen.queryByText('習慣名を入力してください'),
    ).not.toBeInTheDocument();
  });

  it('toggles day selection on and off', () => {
    renderForm();
    fireEvent.click(screen.getByText('特定曜日'));
    const mondayButton = screen.getByLabelText('月曜日');
    fireEvent.click(mondayButton);
    expect(mondayButton).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(mondayButton);
    expect(mondayButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders color buttons for all preset colors', () => {
    renderForm();
    for (const color of PRESET_COLORS) {
      expect(screen.getByLabelText(`色: ${color}`)).toBeInTheDocument();
    }
  });
});
