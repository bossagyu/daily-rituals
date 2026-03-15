/**
 * useCompletions hook - manages habit completion records for a given date.
 *
 * Provides loading/error state, completion checking, and toggle functionality.
 * Business logic is in completionOperations.ts for testability.
 */

import { useCallback, useEffect, useState } from 'react';
import type { CompletionRepository } from '../data/repositories';
import type { Completion } from '../domain/models';
import {
  buildIsCompleted,
  performToggle,
  loadCompletionsByDate,
  extractErrorMessage,
} from './completionOperations';

// --- State type ---

type CompletionsState = {
  readonly completions: readonly Completion[];
  readonly loading: boolean;
  readonly error: string | null;
};

const INITIAL_STATE: CompletionsState = {
  completions: [],
  loading: true,
  error: null,
};

// --- React Hook ---

export type UseCompletionsResult = {
  readonly completions: readonly Completion[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly isCompleted: (habitId: string, date: string) => boolean;
  readonly toggleCompletion: (habitId: string, date: string) => Promise<void>;
};

export function useCompletions(
  repository: CompletionRepository,
  date: string,
): UseCompletionsResult {
  const [state, setState] = useState<CompletionsState>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const completions = await loadCompletionsByDate(repository, date);
        if (!cancelled) {
          setState({ completions, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ completions: [], loading: false, error: extractErrorMessage(err) });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [repository, date]);

  const isCompleted = useCallback(
    (habitId: string, checkDate: string): boolean =>
      buildIsCompleted(state.completions)(habitId, checkDate),
    [state.completions],
  );

  const toggleCompletion = useCallback(
    async (habitId: string, toggleDate: string): Promise<void> => {
      try {
        const newCompletions = await performToggle(
          repository,
          state.completions,
          habitId,
          toggleDate,
        );
        setState((prev) => ({ ...prev, completions: newCompletions, error: null }));
      } catch (err) {
        setState((prev) => ({ ...prev, error: extractErrorMessage(err) }));
      }
    },
    [repository, state.completions],
  );

  return {
    completions: state.completions,
    loading: state.loading,
    error: state.error,
    isCompleted,
    toggleCompletion,
  };
}
