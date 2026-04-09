/**
 * RewardsPage - User-defined reward management page (CRUD).
 *
 * Users can register a reward (description) for any level. The page is
 * accessed via the LevelBar tap on CalendarPage. There is no entry in the
 * navigation bar — the only way in is the LevelBar.
 *
 * Deletion is unconfirmed by design (single-user, low-stakes data).
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Pencil, Trash2, Check, X } from 'lucide-react';
import { z } from 'zod';
import { useRepositories } from '@/hooks/useRepositories';
import type { Reward } from '@/domain/models';
import {
  REWARD_DESCRIPTION_MAX_LENGTH,
} from '@/domain/models/reward';
import { DuplicateRewardLevelError } from '@/data/repositories/rewardRepository';

// --- Validation ---

const createRewardFormSchema = z.object({
  level: z
    .number({ invalid_type_error: 'レベルは整数で入力してください' })
    .int('レベルは整数で入力してください')
    .min(1, 'レベルは1以上の整数を入力してください'),
  description: z
    .string()
    .trim()
    .min(1, 'ご褒美の内容を入力してください')
    .max(REWARD_DESCRIPTION_MAX_LENGTH, `ご褒美は${REWARD_DESCRIPTION_MAX_LENGTH}文字以内で入力してください`),
});

// --- Sub-components ---

function RewardItem({
  reward,
  onUpdate,
  onDelete,
}: {
  readonly reward: Reward;
  readonly onUpdate: (id: string, description: string) => Promise<void>;
  readonly onDelete: (id: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(reward.description);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const beginEdit = () => {
    setDraft(reward.description);
    setError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraft(reward.description);
    setError(null);
    setIsEditing(false);
  };

  const save = async () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setError('ご褒美の内容を入力してください');
      return;
    }
    if (trimmed.length > REWARD_DESCRIPTION_MAX_LENGTH) {
      setError(`ご褒美は${REWARD_DESCRIPTION_MAX_LENGTH}文字以内で入力してください`);
      return;
    }
    setIsSaving(true);
    try {
      await onUpdate(reward.id, trimmed);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    setIsSaving(true);
    try {
      await onDelete(reward.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
      setIsSaving(false);
    }
  };

  return (
    <li
      data-testid="reward-item"
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
    >
      <div className="flex items-center gap-3">
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
          Lv.{reward.level}
        </span>
        {isEditing ? (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={REWARD_DESCRIPTION_MAX_LENGTH}
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            aria-label="ご褒美の内容"
          />
        ) : (
          <span className="flex-1 text-sm text-foreground">{reward.description}</span>
        )}
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={save}
              disabled={isSaving}
              aria-label="保存"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Check className="size-4" />
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isSaving}
              aria-label="キャンセル"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={beginEdit}
              aria-label="編集"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={isSaving}
              aria-label="削除"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Trash2 className="size-4" />
            </button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

function AddRewardForm({
  onCreate,
}: {
  readonly onCreate: (level: number, description: string) => Promise<void>;
}) {
  const [levelInput, setLevelInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = createRewardFormSchema.safeParse({
      level: Number(levelInput),
      description: descInput,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '入力が不正です');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate(parsed.data.level, parsed.data.description);
      setLevelInput('');
      setDescInput('');
    } catch (err) {
      if (err instanceof DuplicateRewardLevelError) {
        setError(`レベル ${err.level} には既にご褒美が登録されています`);
      } else {
        setError(err instanceof Error ? err.message : '登録に失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-card p-3"
    >
      <h2 className="mb-2 text-sm font-bold text-foreground">新しいご褒美を追加</h2>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-col text-xs text-muted-foreground sm:w-24">
          レベル
          <input
            type="number"
            step={1}
            value={levelInput}
            onChange={(e) => setLevelInput(e.target.value)}
            className="mt-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            disabled={isSubmitting}
          />
        </label>
        <label className="flex flex-1 flex-col text-xs text-muted-foreground">
          ご褒美の内容
          <input
            type="text"
            value={descInput}
            onChange={(e) => setDescInput(e.target.value)}
            maxLength={REWARD_DESCRIPTION_MAX_LENGTH}
            className="mt-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            disabled={isSubmitting}
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          追加
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

// --- Main Page ---

export function RewardsPage() {
  const { rewardRepository } = useRepositories();
  const [rewards, setRewards] = useState<readonly Reward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRewards() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await rewardRepository.findAll();
        if (!cancelled) {
          setRewards(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '取得に失敗しました');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchRewards();
    return () => {
      cancelled = true;
    };
  }, [rewardRepository]);

  const handleCreate = useCallback(
    async (level: number, description: string) => {
      const created = await rewardRepository.create({ level, description });
      setRewards((prev) =>
        [...prev, created].sort((a, b) => a.level - b.level),
      );
    },
    [rewardRepository],
  );

  const handleUpdate = useCallback(
    async (id: string, description: string) => {
      const updated = await rewardRepository.update(id, { description });
      setRewards((prev) => prev.map((r) => (r.id === id ? updated : r)));
    },
    [rewardRepository],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await rewardRepository.remove(id);
      setRewards((prev) => prev.filter((r) => r.id !== id));
    },
    [rewardRepository],
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <Link
        to="/calendar"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        カレンダーに戻る
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-foreground">ご褒美</h1>

      <div className="mb-6">
        <AddRewardForm onCreate={handleCreate} />
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : rewards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          まだご褒美がありません。レベルアップしたときの自分へのプレゼントを登録しましょう。
        </p>
      ) : (
        <ul className="space-y-2">
          {rewards.map((r) => (
            <RewardItem
              key={r.id}
              reward={r}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
