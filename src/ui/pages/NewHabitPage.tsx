/**
 * NewHabitPage - Page for creating a new habit.
 *
 * Uses the shared HabitForm component and navigates back to /habits on success.
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HabitForm } from '@/ui/components/HabitForm';
import { useHabits } from '@/hooks/useHabits';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useRepositories } from '@/hooks/useRepositories';
import { toCreateHabitInput } from '@/domain/models/habitFormValidation';
import type { HabitFormState } from '@/domain/models/habitFormValidation';

export function NewHabitPage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { habitRepository } = useRepositories();
  const { createHabit } = useHabits(habitRepository);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (formState: HabitFormState) => {
      if (!user) {
        return;
      }
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        const input = toCreateHabitInput(formState, user.id);
        await createHabit(input);
        navigate('/habits');
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : '習慣の作成に失敗しました';
        setSubmitError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, createHabit, navigate],
  );

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        新しい習慣を追加
      </h1>

      {submitError && (
        <div
          className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {submitError}
        </div>
      )}

      <HabitForm
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel="追加する"
      />
    </div>
  );
}
