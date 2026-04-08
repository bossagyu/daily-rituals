# XP・レベルシステム + 統計サマリー + ご褒美 Design

## Overview

カレンダーページに経験値（XP）・レベルシステムと週間/月間の達成率サマリーを追加。習慣の完了でXPが貯まりレベルが上がる。ユーザーは任意のレベルにご褒美を設定でき、レベルアップ時にポップアップで通知される。

## Requirements

- カレンダーページ上部にレベル + XPプログレスバーを表示
- カレンダーページ上部に週間・月間の達成率を表示
- 習慣の完了でXPが貯まる（1完了=1XP + ボーナス）
- レベルアップ時にポップアップで通知（ご褒美設定済みならご褒美も表示）
- ユーザーが任意のレベルにご褒美テキストを登録・管理できる
- XP・レベルはDB保存せず、表示時にリアルタイム計算

## XP Calculation Rules

| アクション | XP | 条件 |
|-----------|-----|------|
| 習慣1つ完了 | +1 XP | 習慣のcompletionが1件追加されるごとに |
| ストリークボーナス | +3 XP | 習慣ごとに暦日7日連続達成ごとに付与（daily習慣のみ対象） |
| 全完了ボーナス | +2 XP | その日のdaily + weekly_days 習慣がすべて完了した日ごとに（weekly_countは判定から除外） |

### ストリークボーナスの詳細定義

- **対象:** `daily` 頻度の習慣のみ。`weekly_days` と `weekly_count` は対象外
- **計算:** 各習慣の現在の連続達成日数から `floor(currentStreak / 7) × 3` で算出
- **例:** 読書が14日連続 → `floor(14/7) × 3 = 6XP`。運動（weekly_days）が10日連続 → 対象外、0XP
- **全習慣の合計:** 各daily習慣のストリークボーナスを合算

### 全完了ボーナスの詳細定義

- **判定基準:** 既存の `calculateDailyAchievements` を再利用。`targetCount > 0 && completedCount >= targetCount` の日を「全完了」とする
- `weekly_count` 習慣は `targetCount` に含まれないため、判定から自然に除外される

### XP計算ロジック（純粋関数）

XPは全期間のcompletionsから算出する：

1. **基本XP** = 全completions数
2. **ストリークボーナス** = 各daily習慣の `floor(currentStreak / 7) × 3` の合計
3. **全完了ボーナス** = `calculateDailyAchievements` で `rate >= 1.0` の日数 × 2XP

### データ取得

- completions: 既存の `findByDateRange` で最古の習慣の `created_at` から今日までの範囲で取得（`findAll` は新設しない）
- habits: 既存の `findAll` + `findArchived` で取得
- 各日の達成率: `calculateDailyAchievements` を再利用

### パフォーマンス考慮

- XP計算は全期間のデータが必要だが、個人利用では年間数千件程度のため問題なし
- カレンダーページ表示時に1回計算するだけで、リアルタイム更新は不要
- 将来的にデータ量が増えた場合はXPキャッシュテーブルの導入を検討

## Level Calculation

- 式: `必要XP = min(5 × レベル + 5, 255)`
- 255 = レベル50時点の値。これ以上の増加は月単位の所要期間となりモチベーション低下のため上限とする
- レベル1→2: 10XP
- レベル50以降: 毎回255XPで固定
- 現在のレベルと進捗は累計XPから逆算

```typescript
// ローカル変数のミューテーションは関数内に閉じており、返り値はObject.freezeで凍結する
// （既存のstreakServiceと同じパターン）
function calculateLevel(totalXp: number): { level: number; currentXp: number; requiredXp: number } {
  let level = 1;
  let remainingXp = totalXp;

  while (true) {
    const required = Math.min(5 * level + 5, 255);
    if (remainingXp < required) {
      return Object.freeze({ level, currentXp: remainingXp, requiredXp: required });
    }
    remainingXp -= required;
    level++;
  }
}
```

## Rewards System

### Database: `rewards` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, PK | Primary key |
| `user_id` | UUID, FK → auth.users, NOT NULL | ユーザーID |
| `level` | INTEGER, NOT NULL | 対象レベル（1以上） |
| `description` | TEXT, NOT NULL | ご褒美の内容（最大200文字） |
| `created_at` | TIMESTAMPTZ, NOT NULL, DEFAULT now() | 作成日時 |
| `updated_at` | TIMESTAMPTZ, NOT NULL, DEFAULT now() | 更新日時 |

UNIQUE制約: `(user_id, level)` — 1レベルにつき1ご褒美。
RLS policy: ユーザーは自分のご褒美のみCRUD可能。

### Domain Model

```typescript
type Reward = {
  readonly id: string;
  readonly userId: string;
  readonly level: number;
  readonly description: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

const REWARD_DESCRIPTION_MAX_LENGTH = 200;

const rewardSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  level: z.number().int().min(1),
  description: z.string().trim().min(1).max(REWARD_DESCRIPTION_MAX_LENGTH),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

type CreateRewardInput = {
  readonly level: number;
  readonly description: string;
};

type UpdateRewardInput = {
  readonly description: string;
};
```

### Migration SQL

```sql
CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level >= 1),
  description TEXT NOT NULL CHECK (length(trim(description)) > 0 AND length(description) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rewards_user_level UNIQUE (user_id, level)
);

CREATE INDEX idx_rewards_user_id ON rewards(user_id);

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rewards"
  ON rewards
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_rewards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rewards_updated_at_trigger
  BEFORE UPDATE ON rewards
  FOR EACH ROW
  EXECUTE FUNCTION update_rewards_updated_at();
```

### ご褒美の管理UI

カレンダーページのレベル表示をタップすると、ご褒美管理ページ（`/rewards`）に遷移：
- 登録済みご褒美の一覧（レベル順）
- 新規追加: レベル番号（整数、1以上）+ ご褒美テキスト（1〜200文字、trim処理）
- 同じレベルに既にご褒美がある場合はエラーメッセージ表示
- 編集・削除

## Calendar Page UI Changes

### 統計サマリーセクション（ヒートマップの上）

```
Lv.12  ████████░░ 38/55 XP
今週 85% (6/7)  今月 73% (22/30)
```

**LevelBar:**
- 現在のレベル番号
- XPプログレスバー（現在XP / 必要XP）
- タップでご褒美管理画面へ

**WeeklyMonthlyStats:**
- 今週の達成率（完了数 / 対象数）
- 今月の達成率（完了数 / 対象数）
- 計算は `calculateDailyAchievements` を再利用
- 「今週」はカレンダーグリッドと同じ**日曜始まり**（`getDay()` = 0が日曜）で統一

## Level Up Dialog

レベルアップ時にアプリ内ポップアップを表示：

**ご褒美なしの場合:**
```
🎉 レベルアップ！
Lv.9 → Lv.10
```

**ご褒美ありの場合:**
```
🎉 レベルアップ！
Lv.9 → Lv.10
ご褒美: 映画を見る 🎁
```

### レベルアップ検知

- カレンダーページ表示時にXPを計算し、`localStorage` の `daily-rituals-last-level` と比較
- レベルが上がっていたらダイアログを表示し、新しいレベルを保存
- **初回表示時（localStorageに値がない場合）:** ダイアログは表示せず、現在のレベルをそのまま保存。これにより初回訪問やブラウザデータ消去後に過去のレベルアップが一気に表示されることを防ぐ
- **マルチデバイス:** 個人利用を想定しているため、デバイス間でのlocalStorage非共有は許容する。別デバイスで開いた際にレベルアップ通知が重複表示される可能性があるが、実害はない

## Weekly/Monthly Stats Calculation

### 週間達成率

- 今週（**日曜〜土曜**、カレンダーグリッドの曜日表示と統一）の各日について：
  - 対象習慣数（`isDueOnDate` で判定、`created_at` と `archived_at` を考慮）
  - 完了数（completions）
- 達成率 = 完了合計 / 対象合計
- 未来の日は計算に含めない（今日までの達成率）

### 月間達成率

- 今月1日〜今日の各日について同様に計算
- `calculateDailyAchievements` を再利用可能

## File Changes

### 新規ファイル

| ファイル | 責務 |
|---------|------|
| `supabase/migrations/YYYYMMDD_add_rewards.sql` | DBマイグレーション |
| `src/domain/services/xpService.ts` | XP計算、レベル計算、ストリークボーナス計算（純粋関数）。内部で `streakService.calculateStreak` と `calendarService.calculateDailyAchievements` を利用 |
| `src/domain/models/reward.ts` | Reward型 + Zodスキーマ + CreateRewardInput / UpdateRewardInput |
| `src/data/repositories/rewardRepository.ts` | RewardRepository インターフェース |
| `src/data/repositories/supabaseRewardRepository.ts` | Supabase実装 |
| `src/ui/components/LevelBar.tsx` | レベル + XPプログレスバーUI |
| `src/ui/components/WeeklyMonthlyStats.tsx` | 週間・月間達成率UI |
| `src/ui/components/LevelUpDialog.tsx` | レベルアップポップアップ |
| `src/ui/pages/RewardsPage.tsx` | ご褒美管理ページ（一覧 + 追加 + 編集 + 削除） |

### 修正ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/lib/database.types.ts` | rewards テーブル型追加 |
| `src/hooks/useRepositories.tsx` | RewardRepository を追加 |
| `src/ui/pages/CalendarPage.tsx` | LevelBar + WeeklyMonthlyStats + LevelUpDialog を追加 |
| `src/App.tsx` | `/rewards` ルート追加 |

## Testing Strategy

### ユニットテスト

- `xpService.ts`:
  - 基本XP計算（completions数）
  - ストリークボーナス計算（daily習慣のみ、`floor(currentStreak / 7) × 3`）
  - 全完了ボーナス計算（`rate >= 1.0` の日数 × 2、weekly_count除外の確認）
  - レベル計算（累計XPからレベル・進捗を逆算）
  - レベル50以降の必要XP上限（255固定）
  - 返り値が `Object.freeze` で凍結されていること
- `reward.ts`: Zodスキーマバリデーション（level最小値1、description trim + max 200文字、空文字拒否）
- `supabaseRewardRepository.ts`: CRUD操作のモックテスト

### E2Eテスト

- カレンダーページにレベル表示があること
- カレンダーページに週間・月間達成率が表示されること
- 習慣を完了してXPが増加し、条件を満たす場合にレベルアップダイアログが表示されること
- ご褒美管理ページでご褒美を登録・編集・削除できること
