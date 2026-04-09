/**
 * useLevelUpDetection - Detects level-ups by comparing the current level
 * with the level stored in localStorage from the previous visit.
 *
 * Behavior:
 *  - First run (no stored value): no event, current level is persisted.
 *  - Same level: no event.
 *  - Higher level: returns a level-up event with previous and new level.
 *  - Lower level (defensive): no event, stored level is updated to current.
 *  - Invalid stored value (NaN): treated as first run.
 *  - `currentLevel === null` (data not loaded): no event, no persistence.
 *
 * The dismiss callback updates localStorage to the new level so the dialog
 * is not shown again for the same transition.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export const LEVEL_STORAGE_KEY = 'daily-rituals-last-level';

export type LevelUpEvent = {
  readonly previousLevel: number;
  readonly newLevel: number;
};

export type UseLevelUpDetectionReturn = {
  readonly event: LevelUpEvent | null;
  readonly dismiss: () => void;
};

const readStoredLevel = (): number | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(LEVEL_STORAGE_KEY);
  if (raw === null) return null;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return null;
  return parsed;
};

const writeStoredLevel = (level: number): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LEVEL_STORAGE_KEY, String(level));
};

export function useLevelUpDetection(
  currentLevel: number | null,
): UseLevelUpDetectionReturn {
  const [event, setEvent] = useState<LevelUpEvent | null>(null);
  const lastProcessedLevel = useRef<number | null>(null);

  useEffect(() => {
    if (currentLevel === null) return;

    // Avoid reprocessing the same level on re-renders
    if (lastProcessedLevel.current === currentLevel) return;
    lastProcessedLevel.current = currentLevel;

    const stored = readStoredLevel();

    if (stored === null) {
      // First run or invalid value: just persist
      writeStoredLevel(currentLevel);
      return;
    }

    if (currentLevel > stored) {
      setEvent({ previousLevel: stored, newLevel: currentLevel });
      return;
    }

    if (currentLevel < stored) {
      // Defensive: keep storage in sync if level somehow regressed
      writeStoredLevel(currentLevel);
      return;
    }

    // currentLevel === stored: no-op
  }, [currentLevel]);

  const dismiss = useCallback(() => {
    if (event !== null) {
      writeStoredLevel(event.newLevel);
    }
    setEvent(null);
  }, [event]);

  return { event, dismiss };
}
