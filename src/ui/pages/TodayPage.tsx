/**
 * TodayPage - Placeholder for the Today screen.
 * Full implementation will be done in a separate issue.
 */

import React from 'react';

export function TodayPage() {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Today</h1>
      <p className="text-muted-foreground">
        今日の習慣がここに表示されます。
      </p>
    </div>
  );
}
