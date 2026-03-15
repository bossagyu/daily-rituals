/**
 * HabitsPage - Displays all habits with archive toggle and navigation to add/edit.
 *
 * Uses useHabitList hook for habit management including archived habits.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { HabitCard } from '@/ui/components/HabitCard';
import { useHabitList } from '@/hooks/useHabitList';
import { useRepositories } from '@/hooks/useRepositories';

export function HabitsPage() {
  const navigate = useNavigate();
  const { habitRepository } = useRepositories();
  const {
    displayHabits,
    showArchived,
    toggleShowArchived,
    isLoading,
    error,
    archiveHabit,
  } = useHabitList(habitRepository);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">習慣一覧</h1>
        <Button onClick={() => navigate('/habits/new')}>+ 新しい習慣</Button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={toggleShowArchived}
            className="h-4 w-4 rounded border-input"
          />
          アーカイブ済みを表示
        </label>
      </div>

      {error && (
        <div
          className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      )}

      {!isLoading && displayHabits.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="text-muted-foreground">
            まだ習慣がありません
          </p>
          <Button variant="outline" onClick={() => navigate('/habits/new')}>
            最初の習慣を追加する
          </Button>
        </div>
      )}

      {!isLoading && displayHabits.length > 0 && (
        <div className="space-y-2">
          {displayHabits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              onArchive={archiveHabit}
              isArchived={habit.archivedAt !== null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
