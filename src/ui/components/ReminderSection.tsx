/**
 * ReminderSection - Toggle and time selector for habit reminders.
 *
 * Handles notification permission requests and displays
 * appropriate messaging when notifications are blocked.
 */

import React from 'react';
import { generateTimeOptions } from '@/lib/reminderTime';

type ReminderSectionProps = {
  readonly enabled: boolean;
  readonly time: string;
  readonly onEnabledChange: (enabled: boolean) => void;
  readonly onTimeChange: (time: string) => void;
  readonly error?: string;
  readonly permissionState?: NotificationPermission;
  readonly onRequestPermission?: () => void;
};

const TIME_OPTIONS = generateTimeOptions();

export function ReminderSection({
  enabled,
  time,
  onEnabledChange,
  onTimeChange,
  error,
  permissionState,
  onRequestPermission,
}: ReminderSectionProps) {
  const handleToggle = () => {
    if (!enabled && permissionState !== 'granted' && onRequestPermission) {
      onRequestPermission();
      return;
    }
    onEnabledChange(!enabled);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        リマインダー
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-foreground transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        {enabled && (
          <select
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">時刻を選択</option>
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>
      {permissionState === 'denied' && enabled && (
        <p className="text-sm text-destructive">
          通知がブロックされています。ブラウザの設定から許可してください。
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
