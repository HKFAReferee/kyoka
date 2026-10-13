# 北海道 強化審判員システム — 引き継ぎメモ（画面側）

GitHub Pages（https://hkfareferee.github.io/kyoka/）で公開する画面。データと仕様の詳細は非公開リポジトリ `HKFAReferee/kyoka-system` の CLAUDE.md を見ること。

- `app.js`：全画面（ページは `ROUTES` に登録、`go(page, arg)` で移動）。API 呼び出しは `call('api_xxx', ...args)` で、トークンは自動で付く
- `config.js`：Apps Script ウェブアプリの URL（`API_URL`）
- `style.css`：配色 #1976D2 / #D84315 / #E8F4FB / #222222 / #888888 / #E0E0E0、背景白、Noto Sans JP、影・グラデなし
- URL：`?t=トークン&p=ページ&a=引数`。トークンは個人用の合言葉なので、このリポジトリやログに書かない
- ロール別メニュー：個人（審判員）／アセッサー／共有／委員会。チーム用 URL は映像提供ページだけ
