/**
 * TaskCard - Displays a single task with checkbox, inline editing, and delete.
 *
 * Two states:
 * - Collapsed: shows task name, checkbox, due date label
 * - Expanded: shows edit form with name input, date input, save/delete buttons
 */

import React, { useState, useRef, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { Task, UpdateTaskInput } from '@/domain/models/task';
import { TASK_NAME_MAX_LENGTH } from '@/domain/models/task';

const TASK_COLOR = '#f472b6';

export type TaskCardProps = {
  readonly task: Task;
  readonly disabled?: boolean;
  readonly onToggleComplete: (id: string) => void;
  readonly onUpdate: (id: string, input: UpdateTaskInput) => void;
  readonly onRemove: (id: string) => void;
};

function formatDueLabel(dueDate: string | null): string {
  if (dueDate === null) {
    return 'タスク';
  }
  return dueDate;
}

export function TaskCard({
  task,
  disabled = false,
  onToggleComplete,
  onUpdate,
  onRemove,
}: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editName, setEditName] = useState(task.name);
  const [editDueDate, setEditDueDate] = useState(task.dueDate ?? '');
  const cardRef = useRef<HTMLDivElement>(null);

  const isCompleted = task.completedAt !== null;

  // Close on outside click
  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
        setEditName(task.name);
        setEditDueDate(task.dueDate ?? '');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded, task.name, task.dueDate]);

  const handleToggle = () => {
    onToggleComplete(task.id);
  };

  const handleCardClick = (event: React.MouseEvent) => {
    // Don't expand if clicking checkbox area
    const target = event.target as HTMLElement;
    if (target.closest('[role="checkbox"]') || target.closest('button')) {
      return;
    }
    if (!isExpanded) {
      setIsExpanded(true);
      setEditName(task.name);
      setEditDueDate(task.dueDate ?? '');
    }
  };

  const handleSave = () => {
    const trimmedName = editName.trim();
    if (trimmedName.length === 0 || trimmedName.length > TASK_NAME_MAX_LENGTH) {
      return;
    }

    const newDueDate = editDueDate === '' ? null : editDueDate;
    const updates: UpdateTaskInput = {
      ...(trimmedName !== task.name ? { name: trimmedName } : {}),
      ...(newDueDate !== task.dueDate ? { dueDate: newDueDate } : {}),
    };

    if (Object.keys(updates).length > 0) {
      onUpdate(task.id, updates);
    }

    setIsExpanded(false);
  };

  const handleDelete = () => {
    onRemove(task.id);
    setIsExpanded(false);
  };

  if (isExpanded) {
    return (
      <div
        ref={cardRef}
        data-testid="task-card"
        className="rounded-2xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            maxLength={TASK_NAME_MAX_LENGTH}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            aria-label="タスク名"
          />

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              日付（任意）
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                aria-label="期限日"
              />
              {editDueDate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditDueDate('')}
                  aria-label="日付をクリア"
                >
                  ✕
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              className="flex-1"
            >
              保存
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="flex-1"
            >
              削除
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      data-testid="task-card"
      className={`flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/20${
        isCompleted ? ' opacity-60' : ''
      }${disabled ? ' opacity-60' : ''}`}
      onClick={disabled ? undefined : handleCardClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={disabled ? undefined : (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsExpanded(true);
          setEditName(task.name);
          setEditDueDate(task.dueDate ?? '');
        }
      }}
    >
      <div
        className="h-4 w-4 shrink-0 rounded-full"
        style={{ backgroundColor: TASK_COLOR }}
        aria-hidden="true"
      />

      <Checkbox
        checked={isCompleted}
        onCheckedChange={disabled ? undefined : handleToggle}
        disabled={disabled}
        aria-label={`${task.name}を${isCompleted ? '未完了に' : '完了に'}する`}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={`text-sm font-medium ${
            isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'
          }`}
        >
          {task.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDueLabel(task.dueDate)}
        </span>
      </div>
    </div>
  );
}
