# プッシュ通知が届かない問題 — 調査結果と対処手順

- **調査日**: 2026-07-02（2026-07-03 に DB 実データで最終確定）
- **対象**: プッシュ通知リマインダー（habits の `reminder_time` による通知）
- **症状**: リマインダー時刻になっても iPhone に通知が届かない
- **結論（DB 実データで確定）**: **`push_subscriptions` テーブルが空＝通知の宛先（デバイス購読）が存在しない。** そのため送信関数は常に `sent:0` になり、通知が届かない。最後に送信成功した日付は 2026-04-21（`last_notified_date`）。それ以降 iOS 側で購読が失効し、再登録されていない。
- **確定の根拠**:
  1. `push_subscriptions` を照会 → **0 行**。
  2. リマインダー設定済みの習慣（日記・ソフトウェア開発, `13:00:00` UTC）の `last_notified_date` が `2026-04-21` で停止。この列は「送信成功時のみ」更新されるため、最後に通知が成功したのが 4/21 であることを示す。
  3. `net._http_response` の直近実行は**全て HTTP 200**、内容は `No habits to notify` / `All habits completed`。関数は正常に動作しており、時刻判定・完了判定ロジックにバグは無い。
- **インフラは全て正常だったことを確認済み**（当初仮説は棄却）: pg_cron ジョブ（jobid 3, `*/10 * * * *`, active）は登録済みで実行も全て succeeded。URL は `daily-rituals-nine.vercel.app/api/send-reminders`、認証は `x-cron-secret` で正しい。手動で本番エンドポイントを叩いても 200 `{"sent":0,"message":"No habits to notify"}` を返す。→ **原因は cron でも Vercel 関数でもなく、クライアント側の購読喪失。**
- **自動復旧しない理由（設計上の穴）**: `usePushSubscription` のサイレント再登録は「ブラウザに購読が残るが DB に無い」場合のみ動作し、iOS のように購読ごと消えると `existingSub` が null で早期 return する。新規購読を作る `ensureSubscription` は習慣の作成/編集でリマインダー ON 保存時（`NewHabitPage` / `HabitDetailPage`）にしか呼ばれず、起動時・設定画面での再購読トリガーが無い。

> 注: 2026-07-02 時点で `cron.job_run_details` を確認した際、`users`/`participants` の DELETE ジョブしか見えず「send-reminders 未登録」と誤判定した。これは**別の Supabase プロジェクトで SQL を実行していた**ためで、正しいプロジェクト（`rfobzbtkqhsqoyyuafuv`）では send-reminders は正常稼働していた。教訓: cron 診断は必ず対象プロジェクトで実行すること。

---

## 1. アーキテクチャ（現状の想定フロー）

```
pg_cron (10分ごと)
  → pg_net (net.http_post)
    → Vercel API Route  https://daily-rituals-nine.vercel.app/api/send-reminders
       (認証: x-cron-secret ヘッダー)
      → 未完了習慣を検索し web-push で送信
        → Service Worker (src/sw.ts) が受信し通知表示
```

- 送信の実体: `api/send-reminders.ts`（Vercel Serverless / Node.js）
- 認証: リクエストヘッダー `x-cron-secret` を環境変数 `CRON_SECRET` と照合。不一致・欠落は **401 Unauthorized**
- 過去の経緯: 当初は Supabase Edge Function（Deno）だったが、`web-push` の Deno 非互換のため #73 で Vercel API Route に移行、#74 で Edge Function を削除

---

## 2. 根本原因（DB 実行履歴で確定）

**`send-reminders` の pg_cron ジョブが実行されていない（未登録、または無効化されている）。** pg_cron ジョブは Supabase DB 内の手動設定で、リポジトリのマイグレーションには含まれない。#71 で当初設定されたものが、#73（Vercel 移行）/ #74（Edge Function 削除）の過程で登録し直されなかった、あるいは一度も正しく登録されていなかったと考えられる。

`cron.job_run_details` の直近履歴には別アプリの日次 DELETE ジョブしか現れず、`send-reminders` の実行が 1 件も存在しないことから、ジョブが稼働していないと断定できる（10分間隔なら直近履歴を占有するはず）。

### 補足: 当初仮説との差分（棄却された仮説）

当初、下記2点を最有力原因と推定していたが、実データにより「ジョブがそもそも動いていない」ことが判明したため、これらは**現時点では該当しない**（ただしジョブを新規登録する際に同じ誤りを繰り返さないよう、正しい URL / 認証は手順②で担保する）。

- ~~**呼び出し先 URL が古い**: 旧 `<SUPABASE_URL>/functions/v1/send-reminders`（#74 で削除済み）を叩き続けている~~
- ~~**認証方式が古い**: 旧 `Authorization: Bearer <SERVICE_ROLE_KEY>` のまま（移行後の関数は `x-cron-secret` のみ検証し 401）~~

---

## 3. 根拠（DB 実データ・エンドポイント検証）

| # | 確認内容 | 結果 |
|---|----------|------|
| 1 | **`push_subscriptions` の中身** | **0 行**。通知の宛先が存在しない。→ 送信関数は宛先ゼロで `sent:0` を返し、通知は届きようがない |
| 2 | **`habits` のリマインダー設定** | 日記・ソフトウェア開発（`13:00:00` UTC, daily）と朝起きる（`22:10:00` UTC, weekly_days）にリマインダーあり。前者の `last_notified_date` は **`2026-04-21`** で停止。この列は送信成功時のみ更新されるため、最後の成功が 4/21 だと分かる |
| 3 | **`net._http_response`（cron の実 HTTP 応答）** | 直近すべて **HTTP 200**。内容は `No habits to notify`（UTC 0時台は 13:00/22:10 の習慣がまだ時刻前）/ `All habits completed`（前夜は完了済み）。関数は正常動作、時刻・完了判定にバグなし |
| 4 | **手動エンドポイント呼び出し** | 正しい `x-cron-secret` で `POST` → **200 `{"sent":0,"message":"No habits to notify"}`**。関数まで完全到達し正常応答 |
| 5 | **pg_cron ジョブ** | jobid 3 / `*/10 * * * *` / `active: true` / URL `daily-rituals-nine.vercel.app/api/send-reminders` / `x-cron-secret`。`cron.job_run_details` は全て succeeded。**設定・稼働ともに正常** |

結論: **インフラ（cron → pg_net → Vercel → 関数 → 認証）は全て健全。唯一の欠落はクライアント側のデバイス購読**（`push_subscriptions` が空）。

---

## 4. 自動復旧しない理由（コードの設計上の穴）

- `usePushSubscription.ts` の**サイレント再登録**は、`registration.pushManager.getSubscription()` が購読を返す（＝ブラウザ側に購読が残っている）場合のみ DB へ再登録する。iOS のように**購読ごと失効**すると `existingSub` が `null` になり `return` して何もしない。
- **新規購読を作る `ensureSubscription()`** は、習慣の作成/編集画面で**リマインダー ON にして保存したとき**にしか呼ばれない（`NewHabitPage.tsx`, `HabitDetailPage.tsx:99-101`）。アプリ起動時・設定画面に再購読トリガーが無い。
- ⇒ 一度デバイス購読が消えると、ユーザーが手動で習慣のリマインダーを付け直すまで復活しない。

---

## 5. 手動復旧手順（2026-08-13 時点では不要）

> **この手順はもう必要ない。** PR #142 でアプリ起動時の自動再購読が実装され、通知許可が `granted`
> である限りデバイス購読は自動で復旧する。以下は自動復旧が働かない場合（通知許可そのものを
> 拒否している場合など）の予備手順として残す。

1. **ホーム画面に追加した PWA** を開く（Safari のタブ不可。iOS の Web Push はホーム画面 PWA でのみ有効）。
2. 既存の習慣（例:「日記」）を開く。
3. **リマインダーのトグルを OFF にして保存 → もう一度 ON にして時刻を選び保存**。通知許可を聞かれたら「許可」。これで `ensureSubscription()` が走り、`push_subscriptions` に新しい行が登録される。
4. 過去に通知を「拒否」していた場合は、iOS 設定 → 該当 PWA → 通知 で許可し直してから再度手順3を行う。

### 検証

- 再購読後、`push_subscriptions` に行が増えたことを確認（`SELECT count(*) FROM push_subscriptions;`）。
- 習慣のリマインダー時刻を直近（未完了状態）に設定し、次の 10 分境界で iPhone に通知が届くか確認。急ぐ場合は本番エンドポイントを手動 POST して `sent:1` になるか確認できる。

---

## 6. 恒久対策（実施状況）

### ✅ アプリ起動時の無条件再購読 — 実装済み（PR #142, 2026-08-12 マージ）

`reconcileSubscription`（`src/hooks/pushSubscriptionOperations.ts`）が、ブラウザ購読が無く通知許可が
`granted` の場合に新規 subscribe して DB へ登録する。これが今回の再発の根治策である。

呼び出しは `usePushSubscriptionReconcile`（`src/hooks/usePushSubscriptionReconcile.ts`）経由で、
認証済み全ルートを包む `src/ui/layouts/AppLayout.tsx` から行う。**どの画面から起動しても走る**ことが
要件である点に注意。

> **レビューで見つかった落とし穴（再発防止のため記録）**: 最初の実装では `usePushSubscription` から
> しか呼んでおらず、そのフックの利用箇所が `NewHabitPage` と `HabitDetailPage` の2つだけだったため、
> **Today 画面を開くだけでは一度も走らなかった**。つまり本章がまさに*暫定回避策*として書いた
> 「習慣のリマインダーを触る」とほぼ同じ発火条件にしかなっておらず、本節の恒久対策になっていなかった。
> CI が全緑だったのは、`reconcileSubscription` 単体のテストはあったのに「どこから呼ばれるか」を
> 検証するテストが unit・E2E ともに無かったため。現在は `AppLayout` から呼ばれることを検証する
> テストを置いてある（`src/ui/layouts/__tests__/AppLayout.test.tsx`）。
>
> 教訓: **副作用フックは「正しく動くか」だけでなく「正しい場所から呼ばれるか」もテストする。**

**実機確認**: 2026-08-13 に iPhone のホーム画面 PWA で通知が届くことを確認済み。

### ⬜ 設定画面に通知の再登録 UI / テスト通知ボタン — 未実装

習慣編集に依存せず購読を貼り直せる導線と、押した瞬間に届くか分かるテスト通知ボタン。
`docs/superpowers/plans/2026-08-11-reliability.md` の **Phase 4**（Task 4.3 / 4.6）として設計済み。

### ⬜ 通知パイプラインの可観測性 — 未実装

今回、購読が失効してから気づくまで**2ヶ月半**かかった。cron は succeeded、HTTP は 200、関数は
正常動作という状態のまま誰にも届かない状況が成立してしまうため、痕跡を残す仕組みが要る。
`notification_events`（送信・異常時のみ記録）と `system_heartbeats`（cron の生存確認）を
同じく Phase 4 で設計済み。

### 参考

調査初期に作成した `supabase/snippets/setup-cron.sql` と設計書の cron SQL 修正は、原因ではなかったが
**運用ドキュメントとして有効**なので残置。将来デプロイ URL 変更時などに参照可能。

---

## 付録: 参照

- 送信処理: `api/send-reminders.ts`
- Service Worker: `src/sw.ts`
- 購読の再調整: `src/hooks/pushSubscriptionOperations.ts`, `src/hooks/usePushSubscriptionReconcile.ts`
- 購読フック: `src/hooks/usePushSubscription.ts`
- 起動時の配線: `src/ui/layouts/AppLayout.tsx`
- 時刻変換: `src/lib/reminderTime.ts`
- 設計書: `docs/superpowers/specs/2026-03-21-push-reminder-design.md`
- 未実装分の設計・計画: `docs/superpowers/specs/2026-08-11-reliability-design.md`, `docs/superpowers/plans/2026-08-11-reliability.md`
- cron 設定 SQL: `supabase/snippets/setup-cron.sql`
- 関連 Issue/PR: #71（機能追加）, #73（Vercel 移行）, #74（Edge Function 削除）, #142（起動時の自動再購読）
