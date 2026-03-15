# daily-rituals PWA移行設計ドキュメント

## 概要

React Native (Expo) モバイルアプリから、Vite + React の PWA (Progressive Web App) に移行する。
データ保存をローカルSQLiteからSupabase (PostgreSQL)に変更し、複数端末でのクラウド同期を実現する。

## 背景

- iPhoneアプリとしての公開コスト（Apple Developer Program年額$99）が高い
- PWAならブラウザから利用可能で、ホーム画面追加でネイティブアプリに近い体験を提供できる
- クラウド同期により複数端末からのアクセスが可能になる

## 技術スタック

| 領域 | 技術 |
|------|------|
| フレームワーク | Vite + React + TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui |
| データ | Supabase (PostgreSQL + Auth + リアルタイム) |
| 認証 | Supabase Auth (Google OAuth) |
| PWA | vite-plugin-pwa (Workbox) |
| テスト | Vitest + Testing Library |
| ホスティング | Vercel |

## アーキテクチャ: クリーンアーキテクチャ Lite（維持）

```
src/
├── domain/           # そのまま再利用（変更なし）
│   ├── models/       # Habit, Completion, Streak, Frequency
│   └── services/     # StreakService, FrequencyService 等
├── data/             # Supabaseに差し替え
│   ├── supabase/     # Supabaseクライアント設定
│   └── repositories/ # インターフェース維持、実装をSupabaseに
├── hooks/            # operations再利用、React hooks微修正
│   ├── *Operations.ts  # そのまま再利用
│   └── use*.ts         # React hooks（微修正）
├── ui/               # 全面書き直し
│   ├── components/   # Tailwind + shadcn/ui
│   ├── pages/        # Today, Habits, HabitForm, Login
│   └── layouts/      # ナビゲーションレイアウト
└── lib/              # 新規：認証、PWA設定
```

### 依存ルール（変更なし）

- domain → 依存なし（ピュアなTypeScript）
- data → domain にのみ依存
- hooks → domain, data に依存
- ui → hooks を通じてデータにアクセス

### 再利用マップ

| レイヤー | 再利用率 | 変更内容 |
|----------|----------|----------|
| domain/models | 100%（userId追加のみ） | Habit, CompletionにuserId追加 |
| domain/services | 100% | 変更なし |
| hooks/operations | 100% | 変更なし |
| hooks/use*.ts | 90% | React Native依存なし→ほぼそのまま |
| data/repositories | インターフェース再利用 | 実装をSupabaseに差し替え |
| ui/ | 0%（全面書き直し） | React Native → React (HTML/CSS) |

## データモデル（Supabase PostgreSQL）

### profiles テーブル（新規）

| カラム | 型 | 説明 |
|--------|------|------|
| id | UUID | 主キー（Supabase Auth user.id） |
| display_name | TEXT | 表示名 |
| created_at | TIMESTAMPTZ | 作成日時 |

### habits テーブル

| カラム | 型 | 説明 |
|--------|------|------|
| id | UUID | 主キー（DEFAULT gen_random_uuid()） |
| user_id | UUID | 外部キー → auth.users.id（新規） |
| name | TEXT | 習慣名 |
| frequency_type | TEXT | `daily` / `weekly_days` / `weekly_count` |
| frequency_value | JSONB | 曜日指定やカウント値 |
| color | TEXT | 表示色（HEX） |
| created_at | TIMESTAMPTZ | 作成日時 |
| archived_at | TIMESTAMPTZ | アーカイブ日時（NULL=有効） |

### completions テーブル

| カラム | 型 | 説明 |
|--------|------|------|
| id | UUID | 主キー |
| user_id | UUID | 外部キー → auth.users.id（新規） |
| habit_id | UUID | 外部キー → habits.id |
| completed_date | DATE | 完了日 |
| created_at | TIMESTAMPTZ | 記録日時 |

- `(habit_id, completed_date)` にユニーク制約

### Row Level Security (RLS)

```sql
-- habits: ユーザーは自分のデータのみ操作可能
CREATE POLICY "Users can CRUD own habits"
  ON habits FOR ALL
  USING (auth.uid() = user_id);

-- completions: 同様
CREATE POLICY "Users can CRUD own completions"
  ON completions FOR ALL
  USING (auth.uid() = user_id);
```

## 画面構成・ルーティング

### ルーティング（React Router）

```
/              → Today画面（ホーム）
/habits        → 習慣一覧画面
/habits/new    → 習慣追加画面
/habits/:id    → 習慣編集画面
/login         → ログイン画面（Google OAuth）
```

- 未認証時は `/login` にリダイレクト
- ログイン後は `/` にリダイレクト

### 画面一覧

1. **ログイン画面**: Googleログインボタン。シンプルなデザイン。
2. **Today画面**: 今日の習慣一覧、チェックボックス、ストリーク表示、weekly_count進捗
3. **習慣一覧画面**: 全習慣一覧、アーカイブ切り替え
4. **習慣フォーム画面**: 追加/編集、頻度設定、色選択、Zodバリデーション

### レスポンシブ対応

- モバイルファースト（Tailwindの`sm:`/`md:`ブレークポイント）
- ボトムナビゲーション（モバイル）/ サイドナビ（デスクトップ）

## PWA設定

- `vite-plugin-pwa`でService Worker自動生成
- `manifest.json`: アプリ名、アイコン、テーマカラー
- オフライン対応: キャッシュファーストでアプリシェルをキャッシュ
- ホーム画面に追加可能（A2HS）

## 認証フロー

1. ユーザーが `/login` にアクセス
2. 「Googleでログイン」ボタンをクリック
3. Supabase Auth → Google OAuth → コールバック
4. 認証成功 → `/` にリダイレクト
5. 認証トークンはSupabaseクライアントが自動管理

## テスト戦略

| レイヤー | テスト種別 | ツール |
|----------|-----------|--------|
| domain/services | ユニットテスト（既存再利用） | Vitest |
| data/repositories | 統合テスト | Vitest + Supabase |
| hooks/operations | ユニットテスト（既存再利用） | Vitest |
| ui/pages | コンポーネントテスト | Vitest + Testing Library |
| E2E | ユーザーフロー | Playwright |

- Jest → Vitestへの移行（設定変更のみ、テストコードはほぼ互換）
- 既存のdomain/hooksテストは90%以上そのまま再利用可能
- カバレッジ目標: 80%以上

## 移行手順（大枠）

1. Expo/React Native関連を削除
2. Viteプロジェクトとして再初期化（Tailwind CSS設定含む）
3. Jest → Vitest移行、既存テストの動作確認
4. Supabase設定（クライアント、テーブル、RLS）
5. リポジトリ層をSupabase実装に差し替え
6. 認証フロー追加（Google OAuth + ルートガード）
7. UI書き直し（Tailwind + shadcn/uiで全画面）
8. PWA設定追加
9. Vercelデプロイ設定

## 開発チーム（エージェント構成）

既存のスクラムプロセス（PO/dev/DA/TL）を維持。
エージェント定義は技術スタック変更に合わせて更新する。
