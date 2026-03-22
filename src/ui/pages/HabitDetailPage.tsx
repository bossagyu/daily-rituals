/**
 * HabitDetailPage - Page for editing an existing habit.
 *
 * Loads existing habit data by ID, pre-fills the form, and updates on save.
 * Includes archive and delete actions with confirmation dialogs.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { HabitForm } from '@/ui/components/HabitForm';
import { useHabits } from '@/hooks/useHabits';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useRepositories } from '@/hooks/useRepositories';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import {
  habitToFormState,
  toCreateHabitInput,
} from '@/domain/models/habitFormValidation';
import {
  localTimeToUtc,
  utcToLocalTime,
  getBrowserTimezoneOffset,
} from '@/lib/reminderTime';
import type { HabitFormState } from '@/domain/models/habitFormValidation';
import type { Habit } from '@/domain/models/habit';

export function HabitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { habitRepository, pushSubscriptionRepository } = useRepositories();
  const { updateHabit, archiveHabit, deleteHabit } = useHabits(habitRepository);
  const { permissionState, requestPermission, ensureSubscription } =
    usePushSubscription(pushSubscriptionRepository);

  const [habit, setHabit] = useState<Habit | null>(null);
  const [isLoadingHabit, setIsLoadingHabit] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    let cancelled = false;

    async function loadHabit() {
      setIsLoadingHabit(true);
      setLoadError(null);
      try {
        const found = await habitRepository.findById(id!);
        if (cancelled) {
          return;
        }
        if (!found) {
          setLoadError('習慣が見つかりません');
        } else {
          setHabit(found);
        }
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : '習慣の読み込みに失敗しました';
        setLoadError(message);
      } finally {
        if (!cancelled) {
          setIsLoadingHabit(false);
        }
      }
    }

    void loadHabit();

    return () => {
      cancelled = true;
    };
  }, [id, habitRepository]);

  const handleSubmit = useCallback(
    async (formState: HabitFormState) => {
      if (!user || !id) {
        return;
      }
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        const input = toCreateHabitInput(formState, user.id);
        const reminderTimeUtc = formState.reminderEnabled
          ? localTimeToUtc(formState.reminderTime, getBrowserTimezoneOffset())
          : null;

        if (formState.reminderEnabled) {
          await ensureSubscription();
        }

        await updateHabit(id, { ...input, reminderTime: reminderTimeUtc });
        navigate('/habits');
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : '習慣の更新に失敗しました';
        setSubmitError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, id, updateHabit, ensureSubscription, navigate],
  );

  const handleArchive = useCallback(() => {
    if (!id) {
      return;
    }
    const confirmed = window.confirm('この習慣をアーカイブしますか？アーカイブした習慣は一覧から非表示になります。');
    if (!confirmed) {
      return;
    }
    void (async () => {
      try {
        await archiveHabit(id);
        navigate('/habits');
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : '習慣のアーカイブに失敗しました';
        setSubmitError(message);
      }
    })();
  }, [id, archiveHabit, navigate]);

  const handleDelete = useCallback(() => {
    if (!id) {
      return;
    }
    const confirmed = window.confirm('この習慣を完全に削除しますか？関連するすべての記録も削除され、元に戻せません。');
    if (!confirmed) {
      return;
    }
    void (async () => {
      try {
        await deleteHabit(id);
        navigate('/habits');
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : '習慣の削除に失敗しました';
        setSubmitError(message);
      }
    })();
  }, [id, deleteHabit, navigate]);

  if (isLoadingHabit) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div
          className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {loadError}
        </div>
        <Button variant="outline" onClick={() => navigate('/habits')}>
          一覧に戻る
        </Button>
      </div>
    );
  }

  if (!habit) {
    return null;
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-6 text-2xl font-bold text-foreground">習慣の編集</h1>

      {submitError && (
        <div
          className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {submitError}
        </div>
      )}

      <HabitForm
        initialState={(() => {
          const formInitialState = habitToFormState(habit);
          const localReminderTime = formInitialState.reminderTime
            ? utcToLocalTime(formInitialState.reminderTime, getBrowserTimezoneOffset())
            : '';
          return {
            ...formInitialState,
            reminderTime: localReminderTime,
          };
        })()}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel="更新する"
        permissionState={permissionState}
        onRequestPermission={requestPermission}
      />

      <div className="mt-8 space-y-3 border-t pt-6">
        {habit.archivedAt === null && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleArchive}
          >
            アーカイブ
          </Button>
        )}
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleDelete}
        >
          削除
        </Button>
      </div>
    </div>
  );
}
