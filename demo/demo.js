/* 独立デモ：サーバーの処理（Apps Script のコード）を見えない iframe の中で動かし、画面（../app.js）からの呼び出しをそこへ回す。
   データはこの端末の localStorage にだけ保存。役割はページ上の帯で切り替える */
(function () {
  window.API_URL = 'demo';
  const ROLES = [['DEMO01', '委員会', 'デモ 委員', 'home'], ['DEMO02', '審判員', 'デモ 審判A', 'survey'], ['DEMO03', 'アセッサー', 'デモ アセッサー', 'home']];
  const QS = new URLSearchParams(location.search);
  const base = location.origin + location.pathname;
  let gas = null, TOK = null;
  const ready = new Promise((ok) => {
    const f = document.getElementById('gas');
    const go = () => { gas = f.contentWindow; if (gas.DEMO) ok(); else setTimeout(go, 30); };
    f.addEventListener('load', go); if (f.contentDocument && f.contentDocument.readyState === 'complete') go();
  });
  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, opt) => {
    if (url !== 'demo') return realFetch(url, opt);
    await ready;
    return new Response(gas.DEMO.post(opt.body), { headers: { 'content-type': 'application/json' } });
  };
  const open = (id, page) => { location.href = base + '?t=' + encodeURIComponent(TOK[id]) + '&p=' + page; };
  window.demoRole = (i) => open(ROLES[i][0], ROLES[i][3]);
  window.demoReset = () => {
    if (!confirm('デモのデータを最初の状態に戻しますか？\n（入力した回答・割当・レポートは消えます）')) return;
    TOK = gas.DEMO.init(base, true); open('DEMO01', 'home');
  };
  ready.then(() => {
    TOK = gas.DEMO.init(base, false);
    const cur = QS.get('t');
    const me = ROLES.findIndex((r) => TOK[r[0]] === cur);
    if (me < 0) return open('DEMO01', 'home');   // 最初は委員会の画面から
    document.getElementById('demobar').innerHTML = `<span class="demo-tag">デモ</span>
      <span class="demo-roles">${ROLES.map((r, i) => `<button class="${i === me ? 'on' : ''}" onclick="demoRole(${i})" title="${r[2]}">${r[1]}</button>`).join('')}</span>
      <span class="demo-note">この端末の中だけで動きます。本番のデータ・メールには関係ありません</span>
      <button class="demo-reset" onclick="demoReset()">最初に戻す</button>`;
    const s = document.createElement('script'); s.src = '../app.js?v=' + Date.now(); document.body.appendChild(s);
  });
})();
