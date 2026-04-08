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
| ストリークボーナス | +3 XP | 7日連続達成時に1回付与 |
| 全完了ボーナス | +2 XP | その日の全習慣を完了した日ごとに |

### XP計算ロジック（純粋関数）

XPは全期間のcompletionsから算出する：

1. **基本XP** = 全completions数
2. **ストリークボーナス** = 7日連続達成ごとに+3XP（ストリーク履歴から計算）
3. **全完了ボーナス** = 全習慣を完了した日数 × 2XP

計算に必要なデータ：
- 全completions（既存の `findByHabitId` で取得可能）
- 全habits（既存の `findAll` + `findArchived` で取得可能）
- 各日の「やるべき習慣数」と「完了数」（`calculateDailyAchievements` を再利用可能）

### パフォーマンス考慮

- XP計算は全期間のデータが必要だが、個人利用では年間数千件程度のため問題なし
- カレンダーページ表示時に1回計算するだけで、リアルタイム更新は不要
- 将来的にデータ量が増えた場合はXPキャッシュテーブルの導入を検討

## Level Calculation

- 式: `必要XP = min(5 × レベル + 5, 255)`
- レベル1→2: 10XP
- レベル50以降: 毎回255XPで固定
- 現在のレベルと進捗は累計XPから逆算

```typescript
function calculateLevel(totalXp: number): { level: number; currentXp: number; requiredXp: number } {
  let level = 1;
  let remainingXp = totalXp;

  while (true) {
    const required = Math.min(5 * level + 5, 255);
    if (remainingXp < required) {
      return { level, currentXp: remainingXp, requiredXp: required };
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

UNIQUE制約: `(user_id, level)` — 1レベルにつき1ご褒美。
RLS policy: ユーザーは自分のご褒美のみCRUD可能。

### Migration SQL

```sql
CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level >= 1),
  description TEXT NOT NULL CHECK (length(trim(description)) > 0 AND length(description) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rewards_user_level UNIQUE (user_id, level)
);

CREATE INDEX idx_rewards_user_id ON rewards(user_id);

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rewards"
  ON rewards
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### ご褒美の管理UI

カレンダーページのレベル表示をタップすると、ご褒美管理ページ（`/rewards`）に遷移：
- 登録済みご褒美の一覧
- 新規追加: レベル番号 + ご褒美テキストを入力
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

- カレンダーページ表示時にXPを計算し、前回表示時のレベルと比較
- レベルが上がっていたらダイアログを表示
- 前回のレベルは `localStorage` に保存（`daily-rituals-last-level`）

## Weekly/Monthly Stats Calculation

### 週間達成率

- 今週（月曜〜日曜）の各日について：
  - 対象習慣数（`isDueOnDate` で判定、`created_at` と `archived_at` を考慮）
  - 完了数（completions）
- 達成率 = 完了合計 / 対象合計

### 月間達成率

- 今月1日〜今日の各日について同様に計算
- `calculateDailyAchievements` を再利用可能

## File Changes

### 新規ファイル

| ファイル | 責務 |
|---------|------|
| `supabase/migrations/YYYYMMDD_add_rewards.sql` | DBマイグレーション |
| `src/domain/services/xpService.ts` | XP計算、レベル計算、ストリークボーナス計算（純粋関数） |
| `src/domain/models/reward.ts` | Reward型 + Zodスキーマ + CreateRewardInput |
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
  - ストリークボーナス計算（7日連続ごとに+3）
  - 全完了ボーナス計算（全習慣完了の日ごとに+2）
  - レベル計算（累計XPからレベル・進捗を逆算）
  - レベル50以降の必要XP上限（255固定）
- `reward.ts`: Zodスキーマバリデーション
- `supabaseRewardRepository.ts`: CRUD操作のモックテスト

### E2Eテスト

- カレンダーページにレベル表示があること
- カレンダーページに週間・月間達成率が表示されること
