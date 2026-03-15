/**
 * HabitDetailPage - Placeholder for the habit edit/detail screen.
 * Full implementation will be done in a separate issue.
 */

import React from 'react';
import { useParams } from 'react-router-dom';

export function HabitDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold text-foreground">習慣の編集</h1>
      <p className="text-muted-foreground">
        習慣 (ID: {id}) の編集フォームがここに表示されます。
      </p>
    </div>
  );
}
