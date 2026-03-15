# Vercel デプロイ手順

## 前提条件

- Vercel アカウントを持っていること
- GitHub リポジトリ `bossagyu/daily-rituals` へのアクセス権があること
- Supabase プロジェクトがセットアップ済みであること

## 1. Vercel プロジェクトの作成

1. [Vercel Dashboard](https://vercel.com/dashboard) にログインする
2. **Add New... > Project** をクリック
3. GitHub リポジトリ `bossagyu/daily-rituals` を選択して **Import** する
4. フレームワークプリセットは **Vite** を選択する
5. ビルド設定は `vercel.json` から自動で読み込まれる（変更不要）
   - Build Command: `npm run build`
   - Output Directory: `dist`

## 2. 環境変数の設定

Vercel Dashboard の **Settings > Environment Variables** で以下の環境変数を設定する。

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `VITE_SUPABASE_URL` | Supabase プロジェクトの URL | `https://<project-id>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase の匿名キー（公開鍵） | `eyJhbGciOiJI...` |
| `VITE_SUPABASE_REDIRECT_URL` | OAuth リダイレクト URL | `https://<your-domain>.vercel.app` |

### 設定手順

1. Vercel Dashboard でプロジェクトを開く
2. **Settings** タブをクリック
3. 左メニューから **Environment Variables** を選択
4. 各変数について：
   - **Key** に変数名を入力
   - **Value** に値を入力
   - **Environment** は Production / Preview / Development を必要に応じて選択
5. **Save** をクリック

### 注意事項

- `VITE_` プレフィックスが付いた変数はクライアントサイドに公開される
- `VITE_SUPABASE_ANON_KEY` は Supabase の Row Level Security (RLS) で保護されるため、クライアント公開は設計上安全
- 秘密鍵（Service Role Key など）は絶対に `VITE_` プレフィックス付きで設定しないこと

## 3. Supabase 側の設定

OAuth リダイレクトを正しく動作させるため、Supabase 側の設定も必要。

1. [Supabase Dashboard](https://supabase.com/dashboard) でプロジェクトを開く
2. **Authentication > URL Configuration** を選択
3. **Site URL** に Vercel のデプロイ URL を設定（例: `https://<your-domain>.vercel.app`）
4. **Redirect URLs** に以下を追加：
   - `https://<your-domain>.vercel.app`
   - `https://<your-domain>.vercel.app/**`（プレビューデプロイ用に必要な場合）

## 4. デプロイ

### 自動デプロイ

- `main` ブランチへのプッシュで本番環境に自動デプロイされる
- プルリクエスト作成時にプレビューデプロイが自動生成される

### 手動デプロイ

Vercel Dashboard の **Deployments** タブから **Redeploy** を実行できる。

## 5. デプロイの確認

1. Vercel Dashboard の **Deployments** タブでデプロイ状態を確認
2. デプロイ URL にアクセスしてアプリが正しく表示されることを確認
3. Google OAuth ログインが正常に動作することを確認
4. SPA ルーティングが正しく動作することを確認（直接 URL アクセスで 404 にならないこと）

## トラブルシューティング

### ビルドが失敗する

- Vercel のビルドログを確認する
- 環境変数が正しく設定されているか確認する
- ローカルで `npm run build` が成功するか確認する

### OAuth リダイレクトが動作しない

- `VITE_SUPABASE_REDIRECT_URL` が正しいデプロイ URL と一致しているか確認する
- Supabase 側の Redirect URLs 設定を確認する

### ページリロードで 404 になる

- `vercel.json` の rewrites 設定が正しいか確認する
- デプロイ後、Vercel Dashboard の **Settings > General** で Output Directory が `dist` になっているか確認する
