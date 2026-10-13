# 北海道 強化審判員システム — 引き継ぎメモ（画面側）

GitHub Pages（https://hkfareferee.github.io/kyoka/）で公開する画面。データと仕様の詳細は非公開リポジトリ `HKFAReferee/kyoka-system` の CLAUDE.md を見ること。

- `app.js`：全画面（ページは `ROUTES` に登録、`go(page, arg)` で移動、名前とアイコンは `PAGES`）。API 呼び出しは `call('api_xxx', ...args)` で、トークンは自動で付く
- 画面の作り：PC は左のメニュー、スマホは下のタブ（`tabItems`）＋「メニュー」。見出しは `head(タイトル, 戻り先, 右上の操作)`、ダイアログは `openModal({title, body, foot})`（スマホでは下から出る）
- 入力は「押したら保存」が基本：稼働調査はタップで自動保存、レポートは入力が止まって4秒で下書きを自動保存、割当は枠をタップ→候補から選ぶ→「保存する」でまとめて保存
- ページを離れる前の処理（未保存の保存など）は `LEAVE` に入れる
- `config.js`：Apps Script ウェブアプリの URL（`API_URL`）
- `style.css`：配色 #1976D2 / #D84315 / #E8F4FB / #222222 / #888888 / #E0E0E0、背景白、Noto Sans JP、影・グラデなし
- URL：`?t=トークン&p=ページ&a=引数`。トークンは個人用の合言葉なので、このリポジトリやログに書かない
- ロール別メニュー：自分／アセッサー／みんな／委員会（`navGroups`）。チーム用 URL は映像提供ページだけ
