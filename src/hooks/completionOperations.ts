/**
 * Pure functions for completion operations.
 *
 * These functions contain the business logic used by useCompletions hook,
 * extracted for testability without React testing dependencies.
 */

import type { CompletionRepository } from '../data/repositories';
import type { Completion } from '../domain/models';
import { isRlsError } from './utils';

export { extractErrorMessage } from './utils';

/**
 * Error thrown when session refresh fails after an RLS violation.
 * Signals that the user should be redirected to login.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super('SESSION_EXPIRED');
    this.name = 'SessionExpiredError';
  }
}

/**
 * Creates a function that checks whether a specific habit is completed on a given date.
 */
export function buildIsCompleted(
  completions: readonly Completion[],
): (habitId: string, date: string) => boolean {
  return (habitId: string, date: string): boolean =>
    completions.some(
      (c) => c.habitId === habitId && c.completedDate === date,
    );
}

/**
 * Performs the toggle operation: creates if not completed, deletes if completed.
 * Returns the new completions array (immutable - never mutates the input).
 */
export async function performToggle(
  repository: CompletionRepository,
  currentCompletions: readonly Completion[],
  habitId: string,
  date: string,
): Promise<readonly Completion[]> {
  const existing = currentCompletions.find(
    (c) => c.habitId === habitId && c.completedDate === date,
  );

  if (existing) {
    await repository.delete(habitId, date);
    return currentCompletions.filter(
      (c) => !(c.habitId === habitId && c.completedDate === date),
    );
  }

  const created = await repository.create(habitId, date);
  return [...currentCompletions, created];
}

/**
 * Performs toggle with RLS error recovery.
 *
 * If the toggle fails with an RLS violation (code 42501), attempts to refresh
 * the session and retry once. If session refresh fails, throws SessionExpiredError.
 */
export async function performToggleWithRetry(
  repository: CompletionRepository,
  currentCompletions: readonly Completion[],
  habitId: string,
  date: string,
  refreshSession: () => Promise<boolean>,
): Promise<readonly Completion[]> {
  try {
    return await performToggle(repository, currentCompletions, habitId, date);
  } catch (err) {
    if (!isRlsError(err)) {
      throw err;
    }

    const refreshed = await refreshSession();
    if (!refreshed) {
      throw new SessionExpiredError();
    }

    return performToggle(repository, currentCompletions, habitId, date);
  }
}

/**
 * Loads completions for a given date from the repository.
 */
export async function loadCompletionsByDate(
  repository: CompletionRepository,
  date: string,
): Promise<readonly Completion[]> {
  return repository.findByDate(date);
}

