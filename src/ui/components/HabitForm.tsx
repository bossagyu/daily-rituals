/**
 * HabitForm - Shared form component for creating and editing habits.
 *
 * Handles habit name, frequency type, day selection, count input, and color selection.
 * Uses Zod validation from domain layer.
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import type { HabitFormState, FrequencyType } from '@/domain/models/habitFormValidation';
import {
  INITIAL_FORM_STATE,
  PRESET_COLORS,
  FREQUENCY_TYPES,
  FREQUENCY_TYPE_LABELS,
  DAY_LABELS,
  validateHabitForm,
} from '@/domain/models/habitFormValidation';

// --- Types ---

type HabitFormProps = {
  readonly initialState?: HabitFormState;
  readonly onSubmit: (state: HabitFormState) => void;
  readonly isSubmitting: boolean;
  readonly submitLabel: string;
};

type FieldErrors = Readonly<Record<string, string>>;

// --- Sub-components ---

function FormField({
  label,
  error,
  children,
}: {
  readonly label: string;
  readonly error?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function NameInput({
  value,
  onChange,
  error,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string;
}) {
  return (
    <FormField label="習慣名" error={error}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="例: 読書する"
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-invalid={error ? 'true' : 'false'}
      />
    </FormField>
  );
}

function FrequencyTypeSelector({
  value,
  onChange,
}: {
  readonly value: FrequencyType;
  readonly onChange: (value: FrequencyType) => void;
}) {
  return (
    <FormField label="頻度">
      <div className="flex gap-2">
        {FREQUENCY_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              value === type
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
            aria-pressed={value === type}
          >
            {FREQUENCY_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
    </FormField>
  );
}

function DaySelector({
  selectedDays,
  onChange,
  error,
}: {
  readonly selectedDays: readonly number[];
  readonly onChange: (days: readonly number[]) => void;
  readonly error?: string;
}) {
  const toggleDay = useCallback(
    (day: number) => {
      const isSelected = selectedDays.includes(day);
      const newDays = isSelected
        ? selectedDays.filter((d) => d !== day)
        : [...selectedDays, day];
      onChange(newDays);
    },
    [selectedDays, onChange],
  );

  return (
    <FormField label="曜日を選択" error={error}>
      <div className="flex gap-1.5">
        {DAY_LABELS.map((label, index) => (
          <button
            key={index}
            type="button"
            onClick={() => toggleDay(index)}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
              selectedDays.includes(index)
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
            aria-pressed={selectedDays.includes(index)}
            aria-label={`${label}曜日`}
          >
            {label}
          </button>
        ))}
      </div>
    </FormField>
  );
}

function CountInput({
  value,
  onChange,
  error,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly error?: string;
}) {
  return (
    <FormField label="週の回数" error={error}>
      <input
        type="number"
        min={1}
        max={7}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex h-9 w-24 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-invalid={error ? 'true' : 'false'}
      />
    </FormField>
  );
}

function ColorSelector({
  value,
  onChange,
  error,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string;
}) {
  return (
    <FormField label="色" error={error}>
      <div className="flex gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`h-8 w-8 rounded-full border-2 transition-transform ${
              value === color
                ? 'scale-110 border-foreground'
                : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
            aria-label={`色: ${color}`}
            aria-pressed={value === color}
          />
        ))}
      </div>
    </FormField>
  );
}

// --- Main component ---

export function HabitForm({
  initialState,
  onSubmit,
  isSubmitting,
  submitLabel,
}: HabitFormProps) {
  const [formState, setFormState] = useState<HabitFormState>(
    initialState ?? INITIAL_FORM_STATE,
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const updateField = useCallback(
    <K extends keyof HabitFormState>(field: K, value: HabitFormState[K]) => {
      setFormState((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (field in prev) {
          const { [field as string]: _, ...rest } = prev;
          return rest;
        }
        return prev;
      });
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const result = validateHabitForm(formState);
      if (!result.isValid) {
        setErrors(result.errors);
        return;
      }
      setErrors({});
      onSubmit(formState);
    },
    [formState, onSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <NameInput
        value={formState.name}
        onChange={(value) => updateField('name', value)}
        error={errors['name']}
      />

      <FrequencyTypeSelector
        value={formState.frequencyType}
        onChange={(value) => updateField('frequencyType', value)}
      />

      {formState.frequencyType === 'weekly_days' && (
        <DaySelector
          selectedDays={formState.weeklyDays}
          onChange={(days) => updateField('weeklyDays', days)}
          error={errors['weeklyDays']}
        />
      )}

      {formState.frequencyType === 'weekly_count' && (
        <CountInput
          value={formState.weeklyCount}
          onChange={(value) => updateField('weeklyCount', value)}
          error={errors['weeklyCount']}
        />
      )}

      <ColorSelector
        value={formState.color}
        onChange={(value) => updateField('color', value)}
        error={errors['color']}
      />

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? '保存中...' : submitLabel}
      </Button>
    </form>
  );
}
