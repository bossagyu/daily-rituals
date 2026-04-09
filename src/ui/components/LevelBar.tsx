/**
 * LevelBar - Displays the user's current level and XP progress.
 *
 * The whole bar acts as a link to the rewards management page (/rewards),
 * so users can see what reward they've set for the next level.
 */

import React from 'react';
import { Link } from 'react-router-dom';

type LevelBarProps = {
  readonly level: number;
  readonly currentXp: number;
  readonly requiredXp: number;
};

const computeFillPercentage = (currentXp: number, requiredXp: number): number => {
  if (requiredXp <= 0) return 0;
  const ratio = currentXp / requiredXp;
  return Math.max(0, Math.min(1, ratio)) * 100;
};

export function LevelBar({ level, currentXp, requiredXp }: LevelBarProps) {
  const fillPercent = computeFillPercentage(currentXp, requiredXp);

  return (
    <Link
      to="/rewards"
      className="block rounded-lg border border-border bg-card p-3 shadow-sm transition-colors hover:bg-accent/30"
      aria-label={`現在 Lv.${level}（${currentXp} / ${requiredXp} XP）。ご褒美を見る`}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-base font-bold text-foreground">Lv.{level}</span>
        <span className="text-xs text-muted-foreground">
          {currentXp} / {requiredXp} XP
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={currentXp}
        aria-valuemin={0}
        aria-valuemax={requiredXp}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          data-testid="level-bar-fill"
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${fillPercent}%` }}
        />
      </div>
    </Link>
  );
}
