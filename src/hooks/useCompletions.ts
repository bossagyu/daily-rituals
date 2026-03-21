/**
 * useCompletions hook - manages habit completion records for a given date.
 *
 * Provides loading/error state, completion checking, and toggle functionality.
 * Business logic is in completionOperations.ts for testability.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { CompletionRepository } from '../data/repositories';
import type { Completion } from '../domain/models';
import { useNavigate } from 'react-router-dom';
import {
  buildIsCompleted,
  computeOptimisticCompletions,
  loadCompletionsByDate,
  performToggleWithRetry,
  extractErrorMessage,
  SessionExpiredError,
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
  readonly refreshCompletions: () => Promise<void>;
};

export function useCompletions(
  repository: CompletionRepository,
  date: string,
  refreshSession?: () => Promise<boolean>,
): UseCompletionsResult {
  const [state, setState] = useState<CompletionsState>(INITIAL_STATE);
  const completionsRef = useRef<readonly Completion[]>(state.completions);
  completionsRef.current = state.completions;
  const navigate = useNavigate();

  const fetchAndSetCompletions = useCallback(
    async (shouldUpdate: () => boolean): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const completions = await loadCompletionsByDate(repository, date);
        if (shouldUpdate()) {
          setState({ completions, loading: false, error: null });
        }
      } catch (err) {
        if (shouldUpdate()) {
          setState({ completions: [], loading: false, error: extractErrorMessage(err) });
        }
      }
    },
    [repository, date],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchAndSetCompletions(() => !cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchAndSetCompletions]);

  const loadCompletions = useCallback(
    () => fetchAndSetCompletions(() => true),
    [fetchAndSetCompletions],
  );

  const isCompleted = useCallback(
    (habitId: string, checkDate: string): boolean =>
      buildIsCompleted(state.completions)(habitId, checkDate),
    [state.completions],
  );

  const defaultRefreshSession = useCallback(async (): Promise<boolean> => false, []);
  const sessionRefresher = refreshSession ?? defaultRefreshSession;

  const toggleCompletion = useCallback(
    async (habitId: string, toggleDate: string): Promise<void> => {
      const previousCompletions = completionsRef.current;
      const optimistic = computeOptimisticCompletions(previousCompletions, habitId, toggleDate);
      flushSync(() => {
        setState((prev) => ({ ...prev, completions: optimistic, error: null }));
      });

      try {
        const confirmedCompletions = await performToggleWithRetry(
          repository,
          previousCompletions,
          habitId,
          toggleDate,
          sessionRefresher,
        );
        setState((prev) => ({ ...prev, completions: confirmedCompletions, error: null }));
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          setState((prev) => ({ ...prev, completions: previousCompletions }));
          navigate('/login', { replace: true });
          return;
        }
        setState((prev) => ({ ...prev, completions: previousCompletions, error: extractErrorMessage(err) }));
      }
    },
    [repository, sessionRefresher, navigate],
  );

  return {
    completions: state.completions,
    loading: state.loading,
    error: state.error,
    isCompleted,
    toggleCompletion,
    refreshCompletions: loadCompletions,
  };
}
