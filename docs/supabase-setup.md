# Supabase セットアップ手順

## 1. Supabaseプロジェクトの作成

1. [Supabase Dashboard](https://app.supabase.com/) にアクセス
2. 「New Project」をクリック
3. プロジェクト名、データベースパスワード、リージョン（Northeast Asia - Tokyo推奨）を設定
4. 「Create new project」をクリック

## 2. 環境変数の設定

プロジェクトダッシュボードの **Settings > API** から以下の値を取得する。

```bash
cp .env.example .env
```

`.env` ファイルを編集:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

- `VITE_SUPABASE_URL`: Project URL
- `VITE_SUPABASE_ANON_KEY`: Project API keys > anon public

## 3. データベースマイグレーション

### Supabase CLIを使う場合（推奨）

```bash
# Supabase CLIのインストール
npm install -g supabase

# ローカル開発環境の初期化
npx supabase init
npx supabase start

# マイグレーションの実行（ローカル）
npx supabase db reset

# 本番環境へのマイグレーション
npx supabase link --project-ref your-project-ref
npx supabase db push
```

### SQL Editorを使う場合

Supabase Dashboard の **SQL Editor** で `supabase/migrations/20260315000000_create_tables.sql` の内容を実行する。

## 4. 認証プロバイダーの設定（Google OAuth）

### 4.1 Google Cloud Console での設定

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを作成または選択
3. **APIs & Services > OAuth consent screen** で同意画面を設定
   - User Type: External（テスト段階では「Testing」モードで可）
   - アプリ名、サポートメール等を入力
4. **APIs & Services > Credentials** に移動
5. **Create Credentials > OAuth client ID** をクリック
6. Application type: **Web application** を選択
7. 以下を設定:
   - **Authorized JavaScript origins**: `https://your-project-ref.supabase.co`
   - **Authorized redirect URIs**: `https://your-project-ref.supabase.co/auth/v1/callback`
8. **Create** をクリックし、**Client ID** と **Client Secret** をコピー

### 4.2 Supabase Dashboard での設定

1. Supabase Dashboard の **Authentication > Providers** に移動
2. **Google** を展開し、**Enable Sign in with Google** をON
3. Google Cloud Console でコピーした **Client ID** と **Client Secret** を入力
4. **Authorized Client IDs** にはフロントエンドで使用するクライアントIDを入力（任意）
5. **Save** をクリック

### 4.3 環境変数の設定

`.env` ファイルにリダイレクトURLを設定する（任意）:

```
VITE_SUPABASE_REDIRECT_URL=http://localhost:5173
```

本番環境では本番URLに変更する:

```
VITE_SUPABASE_REDIRECT_URL=https://your-production-domain.com
```

> **Note**: `VITE_SUPABASE_REDIRECT_URL` を設定しない場合、現在のオリジンがデフォルトで使用されます。

## 5. テーブル構成

### profiles

| カラム | 型 | 説明 |
|--------|------|------|
| id | UUID | 主キー（auth.users.id） |
| display_name | TEXT | 表示名 |
| created_at | TIMESTAMPTZ | 作成日時 |

- ユーザー登録時にトリガーで自動作成

### habits

| カラム | 型 | 説明 |
|--------|------|------|
| id | UUID | 主キー |
| user_id | UUID | FK -> auth.users.id |
| name | TEXT | 習慣名 |
| frequency_type | TEXT | daily / weekly_days / weekly_count |
| frequency_value | JSONB | 頻度の詳細値 |
| color | TEXT | 表示色（HEX） |
| created_at | TIMESTAMPTZ | 作成日時 |
| archived_at | TIMESTAMPTZ | アーカイブ日時 |

### completions

| カラム | 型 | 説明 |
|--------|------|------|
| id | UUID | 主キー |
| user_id | UUID | FK -> auth.users.id |
| habit_id | UUID | FK -> habits.id |
| completed_date | DATE | 完了日 |
| created_at | TIMESTAMPTZ | 記録日時 |

- `(habit_id, completed_date)` にユニーク制約

## 6. Row Level Security (RLS)

全テーブルでRLSが有効化されており、`auth.uid() = user_id`（profilesは`auth.uid() = id`）で自分のデータのみアクセス可能。

## 7. 型定義の再生成

テーブル構造を変更した場合、型定義を再生成する:

```bash
npx supabase gen types typescript --linked > src/lib/database.types.ts
```
