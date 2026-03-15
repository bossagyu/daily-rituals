/**
 * Pure functions for habit list operations.
 *
 * These functions contain the business logic used by useHabitList hook,
 * extracted for testability without React testing dependencies.
 */

import type { Habit } from '../domain/models';
import type { HabitRepository } from '../data/repositories';
import { mergeHabitLists } from '../domain/services/habitListService';

export { extractErrorMessage } from './utils';

// --- Constants ---

export const LOAD_ARCHIVED_ERROR = 'Failed to load archived habits';

// --- State type ---

export type HabitListArchivedState = {
  readonly archivedHabits: readonly Habit[];
  readonly archivedError: string | null;
  readonly archivedLoading: boolean;
};

export const INITIAL_ARCHIVED_STATE: HabitListArchivedState = {
  archivedHabits: [],
  archivedError: null,
  archivedLoading: false,
};

// --- Pure functions ---

/**
 * Loads archived habits from the repository.
 * Returns updated archived state.
 */
export async function loadArchivedHabits(
  repository: HabitRepository,
): Promise<HabitListArchivedState> {
  try {
    const habits = await repository.findArchived();
    return {
      archivedHabits: habits,
      archivedError: null,
      archivedLoading: false,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : LOAD_ARCHIVED_ERROR;
    return {
      archivedHabits: [],
      archivedError: message,
      archivedLoading: false,
    };
  }
}

/**
 * Builds the display habits list by merging active and archived habits.
 */
export function buildDisplayHabits(
  activeHabits: readonly Habit[],
  archivedHabits: readonly Habit[],
  showArchived: boolean,
): readonly Habit[] {
  return mergeHabitLists(activeHabits, archivedHabits, showArchived);
}
