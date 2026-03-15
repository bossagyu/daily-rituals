/**
 * HabitsPage - Placeholder for the habits list screen.
 * Full implementation will be done in a separate issue.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function HabitsPage() {
  const navigate = useNavigate();

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">習慣一覧</h1>
        <Button onClick={() => navigate('/habits/new')}>新しい習慣</Button>
      </div>
      <p className="text-muted-foreground">
        習慣の一覧がここに表示されます。
      </p>
    </div>
  );
}
