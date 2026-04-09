/**
 * LevelUpDialog - Modal shown when the user reaches a new level.
 *
 * Props are fully controlled by the parent. When `open` is false the
 * component renders nothing. The reward section is only shown when a
 * reward description is provided for the new level.
 */

import React from 'react';
import { Sparkles, X } from 'lucide-react';

type LevelUpDialogProps = {
  readonly open: boolean;
  readonly previousLevel: number;
  readonly newLevel: number;
  readonly rewardDescription: string | null;
  readonly onClose: () => void;
};

export function LevelUpDialog({
  open,
  previousLevel,
  newLevel,
  rewardDescription,
  onClose,
}: LevelUpDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-up-title"
        className="relative w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="ダイアログを閉じる"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <Sparkles className="mb-3 size-10 text-primary" aria-hidden />
          <h2
            id="level-up-title"
            className="text-2xl font-bold text-foreground"
          >
            レベルアップ！
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            <span className="font-bold text-foreground">Lv.{previousLevel}</span>
            <span className="mx-2">→</span>
            <span className="text-2xl font-bold text-primary">Lv.{newLevel}</span>
          </p>

          {rewardDescription !== null && (
            <div className="mt-5 w-full rounded-lg border border-primary/40 bg-primary/10 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">
                ご褒美
              </p>
              <p className="mt-1 text-sm text-foreground">{rewardDescription}</p>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
