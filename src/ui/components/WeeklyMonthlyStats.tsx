/**
 * WeeklyMonthlyStats - Side-by-side weekly and monthly completion summaries.
 *
 * Displays the completion ratio (completed / target) and rounded percentage.
 * Future days are excluded upstream by aggregateAchievements.
 */

import React from 'react';
import type { AchievementSummary } from '@/domain/services/statsService';

type WeeklyMonthlyStatsProps = {
  readonly weekly: AchievementSummary;
  readonly monthly: AchievementSummary;
};

const formatPercent = (rate: number): string => `${Math.round(rate * 100)}%`;

function StatCell({
  label,
  summary,
  testId,
}: {
  readonly label: string;
  readonly summary: AchievementSummary;
  readonly testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col items-center rounded-lg border border-border bg-card p-3"
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="mt-1 text-2xl font-bold text-foreground">
        {formatPercent(summary.rate)}
      </span>
      <span className="text-xs text-muted-foreground">
        {summary.completedCount} / {summary.targetCount}
      </span>
    </div>
  );
}

export function WeeklyMonthlyStats({ weekly, monthly }: WeeklyMonthlyStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCell label="今週" summary={weekly} testId="stats-weekly" />
      <StatCell label="今月" summary={monthly} testId="stats-monthly" />
    </div>
  );
}
