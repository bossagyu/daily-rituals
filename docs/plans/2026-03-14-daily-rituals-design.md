# daily-rituals 設計ドキュメント

## 概要

毎日の習慣を記録し、継続ストリークを可視化するモバイルアプリ。
React Native（Expo）+ SQLiteでローカルファーストに構築する。

## 要件

### 機能要件
- 習慣の登録・編集・アーカイブ（ソフトデリート）
- 習慣の完了記録（日ごとにチェック/アンチェック）
- 継続ストリーク表示（現在の連続回数、最長記録）
- 頻度設定：毎日 / 特定曜日 / 週N回

### 非機能要件
- ローカルのみ（サーバー不要）
- 通知機能はMVPに含めない

## 技術スタック

- React Native + Expo
- TypeScript（strictモード）
- expo-sqlite（ローカルデータベース）
- Jest（テスト）

## アーキテクチャ: クリーンアーキテクチャ Lite

```
src/
├── domain/           # ドメイン層（外部依存なし）
│   ├── models/       # 型定義 + ビジネスルール
│   └── services/     # ドメインサービス
├── data/             # データ層
│   ├── database/     # SQLiteスキーマ、マイグレーション
│   └── repositories/ # リポジトリ（インターフェース + 実装）
├── hooks/            # カスタムフック（アプリケーション層の役割）
└── ui/               # プレゼンテーション層
    ├── screens/
    └── components/
```

### 依存ルール
- domain → 依存なし（ピュアなTypeScript）
- data → domain にのみ依存
- hooks → domain, data に依存
- ui → hooks を通じてデータにアクセス

### 将来の拡張
ドメインの複雑さが増した場合（モデル5つ以上、複数データソースなど）、フルDDD（4層構造 + 値オブジェクト/エンティティ分離）への移行を検討する。

## データモデル

### habits テーブル

| カラム | 型 | 説明 |
|--------|------|------|
| id | TEXT (UUID) | 主キー |
| name | TEXT | 習慣名 |
| frequency_type | TEXT | `daily` / `weekly_days` / `weekly_count` |
| frequency_value | TEXT | JSON。曜日指定: `[1,3,5]`、週N回: `3`、毎日: `null` |
| color | TEXT | 表示色（HEX） |
| created_at | TEXT (ISO8601) | 作成日時 |
| archived_at | TEXT | アーカイブ日時（NULL=有効） |

### completions テーブル

| カラム | 型 | 説明 |
|--------|------|------|
| id | TEXT (UUID) | 主キー |
| habit_id | TEXT | 外部キー → habits.id |
| completed_date | TEXT | 完了日（YYYY-MM-DD） |
| created_at | TEXT (ISO8601) | 記録日時 |

- `(habit_id, completed_date)` にユニーク制約
- 削除は `archived_at` によるソフトデリート

## ドメイン層

### モデル定義

```typescript
type Frequency =
  | { type: 'daily' }
  | { type: 'weekly_days'; days: number[] }  // 0=日, 1=月, ..., 6=土
  | { type: 'weekly_count'; count: number }  // 週N回

type Habit = {
  id: string
  name: string
  frequency: Frequency
  color: string
  createdAt: string
  archivedAt: string | null
}

type Completion = {
  id: string
  habitId: string
  completedDate: string  // YYYY-MM-DD
  createdAt: string
}

type Streak = {
  current: number
  longest: number
}
```

### ドメインサービス

- **StreakService**: 完了記録と頻度タイプからストリークを計算
  - `daily`: 連続日数
  - `weekly_days`: 指定曜日の連続達成回数
  - `weekly_count`: 週ごとの目標達成連続週数
- **FrequencyService**: 習慣の実施判定
  - `isDueToday(habit, date): boolean`
  - `getWeeklyProgress(habit, completions, weekStart): { done: number, target: number }`

## 画面構成

### ナビゲーション

```
TabNavigator
├── Today（ホーム画面）
└── Habits（習慣一覧画面）
      └── HabitForm（追加/編集 - モーダルまたはStack）
```

### 画面詳細

1. **ホーム画面（Today）**
   - 今日やるべき習慣の一覧
   - チェックボックスで完了/未完了切り替え
   - 各習慣の現在ストリーク表示
   - `weekly_count` は「今週 2/3 達成」のような進捗表示

2. **習慣追加/編集画面（HabitForm）**
   - 習慣名入力
   - 頻度タイプ選択 + 詳細設定
   - 色選択
   - 保存/アーカイブ

3. **習慣一覧画面（Habits）**
   - 全習慣の一覧（有効なもの）
   - タップで編集画面へ
   - アーカイブ済みの表示切り替え

## エラーハンドリング

- **DB操作失敗**: try/catchでキャッチし、トースト通知で表示
- **不正な入力**: Zodスキーマによるフォームバリデーション
- **データ整合性**: ユニーク制約で二重完了を防止

## テスト戦略

| レイヤー | テスト種別 | 対象 |
|----------|-----------|------|
| domain/services | ユニットテスト | ストリーク計算、頻度判定 |
| data/repositories | 統合テスト | SQLite CRUD操作 |
| hooks | ユニットテスト | データ取得・更新フロー |
| ui/screens | E2Eテスト | 習慣追加→完了→ストリーク確認 |

- カバレッジ目標: 80%以上
- ストリーク計算は境界値テストを重点的に実施

## 開発チーム（エージェント構成）

| ロール | 責務 |
|--------|------|
| PO | 要件定義、issue作成、優先順位付け、タスクアサイン |
| dev | TDDで実装、PR作成 |
| DA | 批判的レビュー、品質検証 |
| TL | 技術的最終判断 |
