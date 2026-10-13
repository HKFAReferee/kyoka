# 北海道 強化審判員システム（画面・GitHub Pages）

強化審判員・アセッサー・審判委員会・映像提供チームが使う画面。データは Apps Script（非公開リポジトリ）の API から読み書きする。
このリポジトリには個人情報や合言葉は入っていない。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `index.html` | 画面の枠 |
| `app.js` | 全画面の表示と操作 |
| `style.css` | デザイン（白地・ヘアライン罫線・6色） |
| `config.js` | Apps Script ウェブアプリの URL（`API_URL`） |

## 公開のしかた

1. `config.js` の `API_URL` に、Apps Script をウェブアプリとしてデプロイした URL（…/exec）を貼る
2. GitHub の「Settings → Pages」で、Branch を `main`、フォルダを `/ (root)` にして保存
3. 表示された URL（`https://<アカウント>.github.io/<リポジトリ名>/`）を、スプレッドシートの「設定」シートの `PAGE_URL` に入れる

個人ページは `PAGE_URL?t=<トークン>` で開く。トークンはメールで本人に届く URL に入っている。
