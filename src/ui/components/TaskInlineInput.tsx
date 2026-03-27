/**
 * TaskInlineInput - Inline input for adding a new task.
 *
 * Text field with placeholder and "追加" button.
 * Validates: trim, min 1 char, max 100 chars.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TASK_NAME_MAX_LENGTH } from '@/domain/models/task';

export type TaskInlineInputProps = {
  readonly onAdd: (name: string) => void;
};

export function TaskInlineInput({ onAdd }: TaskInlineInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > TASK_NAME_MAX_LENGTH) {
      return;
    }
    onAdd(trimmed);
    setValue('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={TASK_NAME_MAX_LENGTH}
        placeholder="+ タスクを追加..."
        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
        aria-label="新しいタスク名"
      />
      <Button
        size="sm"
        onClick={handleSubmit}
      >
        追加
      </Button>
    </div>
  );
}
