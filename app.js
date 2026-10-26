/* ───────── 基本 ───────── */
let B = null;            // 起動時の情報（本人・ロール・定数）
let CUR = '';            // 表示中のページ
let LEAVE = null;        // ページを離れる前に実行する処理（未保存の内容を保存する等）
const ROUTES = {};
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WD = ['日', '月', '火', '水', '木', '金', '土'];

/* URL の ?t=（個人用の合言葉）&p=（ページ）&a=（引数） */
const QS = new URLSearchParams(location.search);
const TOKEN = QS.get('t') || '';
const START_PAGE = QS.get('p') || '';
const START_ARG = QS.get('a') || '';

async function call(fn, ...args) {
  let res;
  try {
    // text/plain で送ると、Apps Script でも事前確認（CORS preflight）なしで受け付けられる
    res = await fetch(window.API_URL, { method: 'POST', body: JSON.stringify({ fn, t: TOKEN, args }) });
  } catch (e) {
    throw new Error('サーバーに接続できませんでした。通信状態を確認してください。');
  }
  if (!READS.test(fn) && !/^api_(boot|video|reportGet|setDuration)$/.test(fn)) { MEMO.clear(); WGEN++; GEN++; }
  const j = await res.json().catch(() => ({ ok: false, error: 'サーバーの応答を読み取れませんでした。' }));
  if (!j.ok) throw new Error(j.error || 'エラーが発生しました。');
  return j.result;
}
/* 読み込んだデータを覚えておき、次に開くときはすぐ表示する（裏で最新を取り直し、変わっていれば描き直す）。
   書き込みの API を呼んだら覚えたものは捨てる。 */
const READS = /^api_(home|survey|assignTable|myReports|myReport|fitness|fitnessResults|myAssessments|months|matches|surveyStatus|assignBoard|dispatch|reports|karte|master|videos|cases|videoMatches|teamHome)$/;
const MEMO = new Map();      // キー → { s: JSON文字列, at: 取得時刻 }
let GEN = 0;                 // ページを移るたび・書き込むたびに進める（古い描き直しを捨てるため）
let WGEN = 0;                // 書き込むたびに進める（書き込み前に取りに行ったデータは覚えない）
let FRESH = new Set();       // このページ表示中に取り直したキー
let CUR_ARG;
const memoKey = (fn, args) => fn + JSON.stringify(args);
const PENDING = new Map();   // 読み込み中のキー → Promise（同じものを二重に取りに行かない）
function fetchMemo(fn, args) {
  const k = memoKey(fn, args);
  if (PENDING.has(k)) return PENDING.get(k).then((s) => JSON.parse(s));
  const wgen = WGEN;
  const p = call(fn, ...args).then((r) => { const s = JSON.stringify(r); if (wgen === WGEN) MEMO.set(k, { s, at: Date.now() }); return s; });
  PENDING.set(k, p);
  p.finally(() => PENDING.delete(k)).catch(() => {});
  return p.then((s) => JSON.parse(s));
}
async function get(fn, ...args) {
  const k = memoKey(fn, args), m = MEMO.get(k);
  if (!m) { FRESH.add(k); return fetchMemo(fn, args); }
  if (!FRESH.has(k) && Date.now() - m.at > 20000) {
    FRESH.add(k);
    const gen = GEN, wgen = WGEN, page = CUR;
    call(fn, ...args).then((r) => {
      const s = JSON.stringify(r);
      if (wgen !== WGEN) return;
      MEMO.set(k, { s, at: Date.now() });
      if (gen !== GEN) return;
      MEMO.set(k, { s, at: Date.now() });
      if (s === m.s || page !== CUR) return;
      // 入力中・ダイアログ表示中・未保存の変更があるときは描き直さない
      const busy = !$('#modal').hidden || (LEAVE && LEAVE.dirty && LEAVE.dirty()) || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');
      if (busy) return;
      const y = window.scrollY;
      Promise.resolve(ROUTES[CUR](CUR_ARG)).then(() => window.scrollTo(0, y)).catch(() => {});
    }).catch(() => {});
  }
  return JSON.parse(m.s);
}
/* 裏で先に読み込んでおく（失敗しても気にしない） */
function prefetch(list) {
  let p = Promise.resolve();
  list.forEach(([fn, ...args]) => { p = p.then(() => (MEMO.has(memoKey(fn, args)) ? null : fetchMemo(fn, args).catch(() => {}))); });
}
function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = 'toast'), err ? 6000 : 2500);
}
function fail(e) { toast((e && e.message) || String(e), true); }
let MAIN_GEN = -1;           // 今のページの中身を描いた時点の GEN
function setMain(html) { $('#main').innerHTML = html; MAIN_GEN = GEN; }
function md(d) { return d ? Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)) : ''; }
function wd(d) { return d ? WD[new Date(d + 'T00:00:00').getDay()] : ''; }
function dl(d) { return d ? md(d) + '(' + wd(d) + ')' : ''; }
function ymLabel(ym) { return ym ? ym.slice(0, 4) + '年' + Number(ym.slice(5, 7)) + '月' : ''; }
function addMonth(ym, n) { let y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) + n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return y + '-' + String(m).padStart(2, '0'); }
function daysLeft(d) { return Math.round((new Date(d + 'T00:00:00') - new Date(B.today + 'T00:00:00')) / 86400000); }
function card(m) { return h(m.a) + ' 対 ' + h(m.b); }
function fmtSec(s) {
  s = Math.max(0, Math.round(Number(s) || 0));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0');
}
function parseSec(str) {
  const p = String(str || '').trim().replace('：', ':').split(':').map(Number);
  if (p.some(isNaN) || !p.length) return null;
  return p.reduce((a, x) => a * 60 + x, 0);
}
function fmt2(n) { return n === null || n === undefined || n === '' ? '' : Number(n).toFixed(2); }
function copyText(txt) {
  const done = () => toast('コピーしました');
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(txt).then(done, () => copyOld(txt));
  copyOld(txt);
}
function copyOld(txt) {
  const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('コピーしました'); } catch (e) { toast('コピーできませんでした', true); }
  ta.remove();
}
function debounce(fn, ms) { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; f.flush = () => { clearTimeout(t); fn(); }; f.cancel = () => clearTimeout(t); return f; }

/* 日付のブロック表示 */
function dateBox(d) {
  if (!d) return '<div class="date"><div class="d">—</div></div>';
  const w = new Date(d + 'T00:00:00').getDay();
  return `<div class="date ${w === 0 ? 'sun' : w === 6 ? 'sat' : ''}"><div class="m">${Number(d.slice(5, 7))}月</div><div class="d">${Number(d.slice(8, 10))}</div><div class="w">${WD[w]}</div></div>`;
}
function statusPill(status) {
  const cls = status === '提出済' ? 'ok' : status === '下書き' || status === '未作成' ? 'ng' : '';
  return `<span class="pill ${cls}">${h(status)}</span>`;
}
function empty(msg) { return `<div class="empty">${msg}</div>`; }

/* 月の切り替え（‹ 2026年11月 ›）。list を渡すとその中だけを行き来する */
function monthNav(page, cur, list) {
  let prev, next;
  if (list) { const i = list.indexOf(cur); next = i > 0 ? list[i - 1] : ''; prev = i >= 0 && i < list.length - 1 ? list[i + 1] : ''; }
  else { prev = addMonth(cur, -1); next = addMonth(cur, 1); }
  return `<div class="monthnav"><button aria-label="前の月" ${prev ? `onclick="go('${page}','${prev}')"` : 'disabled'}>‹</button><span>${ymLabel(cur)}</span><button aria-label="次の月" ${next ? `onclick="go('${page}','${next}')"` : 'disabled'}>›</button></div>`;
}

/* 見出し（タイトル・戻る・右上の操作） */
function head(title, back, tools) {
  $('#title').textContent = title;
  document.title = title + '｜北海道 強化審判員システム';
  const b = $('#back');
  b.classList.toggle('show', !!back);
  b.onclick = back ? () => go(back[0], back[1]) : null;
  $('#tools').innerHTML = tools || '';
}

/* ダイアログ（スマホでは下から出るシート） */
function openModal(o) {
  $('#modal').innerHTML = `<div class="modal-box ${o.wide ? 'wide' : ''}" role="dialog" aria-modal="true">
    <div class="modal-head"><h2>${o.title || ''}</h2><button class="iconbtn" onclick="closeModal()" aria-label="閉じる">×</button></div>
    <div class="modal-body">${o.body || ''}</div>${o.foot ? `<div class="modal-foot">${o.foot}</div>` : ''}</div>`;
  $('#modal').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal() { destroyPlayer('modal'); $('#modal').hidden = true; $('#modal').innerHTML = ''; document.body.style.overflow = ''; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
document.addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

/* 左のメニューを隠す・出す（PC。次に開いたときも同じ状態） */
function navToggle(force) {
  const hide = force !== undefined ? force : !document.body.classList.contains('navhide');
  document.body.classList.toggle('navhide', hide);
  $('#navtoggle').title = hide ? 'メニューを出す' : 'メニューを隠す';
  try { localStorage.setItem('navhide', hide ? '1' : ''); } catch (e) {}
}

/* ───────── ナビゲーション ───────── */
const ICON = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  survey: '<circle cx="12" cy="12" r="8"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
  report: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h4"/>',
  fitness: '<path d="M13 4a2 2 0 1 0 0 .1M7 21l3-6 3 2v4M10 15l1-5 4 3 3-1M8 10l3-1"/>',
  assess: '<path d="M4 20h4l11-11-4-4L4 16z"/><path d="M13 7l4 4"/>',
  videos: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/>',
  cases: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>',
  matches: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  status: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  assign: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 11h6M20 8v6"/>',
  dispatch: '<path d="M3 6h18v12H3z"/><path d="M3 6l9 7 9-7"/>',
  karte: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  master: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  team: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/>',
};
function icon(k, size = 20) { return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ''}</svg>`; }

const PAGES = {
  home: ['ホーム', 'home'], survey: ['稼働調査', 'survey'], myreports: ['レポート', 'report'], fitness: ['体力テスト', 'fitness'],
  assess: ['担当試合', 'assess'], table: ['割当表', 'table'], videos: ['試合映像', 'videos'], cases: ['事例ライブラリ', 'cases'],
  c_matches: ['試合一覧', 'matches'], c_survey: ['稼働状況', 'status'], c_assign: ['割当', 'assign'], c_dispatch: ['派遣依頼', 'dispatch'],
  c_reports: ['レポート', 'report'], c_fitness: ['体力テスト結果', 'fitness'], c_karte: ['審判員カルテ', 'karte'], c_master: ['マスタ', 'master'],
  team: ['映像の提供', 'team'],
};
function navGroups() {
  const c = B.ctx, g = [];
  if (c.kind === 'team') return [['チーム', ['team']]];
  g.push(['自分', ['home', ...(c.ref ? ['survey', 'myreports', 'fitness'] : [])]]);
  if (c.asr) g.push(['アセッサー', ['assess']]);
  g.push(['みんな', ['table', 'videos', 'cases']]);
  if (c.com) g.push(['委員会', ['c_matches', 'c_survey', 'c_assign', 'c_dispatch', 'c_reports', 'c_fitness', 'c_karte', 'c_master']]);
  return g;
}
function tabItems() {
  const c = B.ctx;
  if (c.com) return ['home', 'c_assign', 'c_survey', 'c_reports'];
  if (c.ref && c.asr) return ['home', 'survey', 'assess', 'table'];
  if (c.ref) return ['home', 'survey', 'table', 'myreports'];
  if (c.asr) return ['home', 'assess', 'videos', 'cases'];
  return ['home', 'table', 'videos', 'cases'];
}
const PARENT = { myreport: 'myreports', video: 'videos', c_report: 'c_reports' };
let BADGE = {};
function navOn() { if (CUR === 'report') return B.ctx.asr && !B.ctx.com ? 'assess' : 'c_reports'; return PARENT[CUR] || CUR; }
function renderNav() {
  const on = navOn();
  const dot = (k) => BADGE[k] ? `<span class="pill ng cnt">${BADGE[k] === true ? '!' : BADGE[k]}</span>` : '';
  $('#side').innerHTML = `<div class="brand"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect x="5" y="4" width="13" height="19" rx="2" fill="#FFD400" transform="rotate(-12 11 13)"/><rect x="12" y="6" width="13" height="19" rx="2" fill="#D32F2F" transform="rotate(10 18 15)"/></svg><span>北海道<br>強化審判員システム</span></div><div class="me">${h(B.ctx.name)}${B.ctx.kind === 'team' ? '' : ' さん'}</div>` +
    navGroups().map(([g, list]) => `<div class="navgrp">${g}</div>` + list.map((k) =>
      `<a href="#" class="navlink ${k === on ? 'on' : ''}" onclick="go('${k}');return false;">${icon(PAGES[k][1], 18)}<span>${PAGES[k][0]}</span>${dot(k)}</a>`).join('')).join('');
  if (B.ctx.kind === 'team') { $('#tabbar').innerHTML = ''; $('#tabbar').hidden = true; return; }
  const tabs = tabItems();
  const inTabs = tabs.includes(on);
  $('#tabbar').innerHTML = tabs.map((k) => `<a href="#" class="${k === on ? 'on' : ''}" onclick="go('${k}');return false;">${icon(PAGES[k][1], 22)}<span>${PAGES[k][0]}</span>${BADGE[k] ? '<i class="dot">!</i>' : ''}</a>`).join('') +
    `<a href="#" class="${inTabs ? '' : 'on'}" onclick="openMenu();return false;">${icon('menu', 22)}<span>メニュー</span></a>`;
}
function openMenu() {
  const on = navOn();
  openModal({ title: h(B.ctx.name) + ' さん', body: `<div class="menu-sheet">${navGroups().map(([g, list]) => `<div class="flabel" style="margin-top:8px">${g}</div><div class="list">${list.map((k) =>
    `<a href="#" class="li ${k === on ? 'me' : ''}" onclick="closeModal();go('${k}');return false;">${icon(PAGES[k][1])}<div class="main"><div class="t">${PAGES[k][0]}</div></div>${BADGE[k] ? '<span class="pill ng">!</span>' : ''}<span class="chev">›</span></a>`).join('')}</div>`).join('')}</div>` });
}
function go(page, arg) {
  if (LEAVE) { try { LEAVE(); } catch (e) {} LEAVE = null; }
  if (!ROUTES[page]) page = B.ctx.kind === 'team' ? 'team' : 'home';
  CUR = page; CUR_ARG = arg; GEN++; FRESH = new Set(); renderNav(); destroyPlayer('main'); clearInterval(TL_TIMER); TL = null;
  document.body.classList.toggle('wide', page === 'video'); document.body.classList.remove('pfull'); fsLabel();   // 映像のページは画面の横幅いっぱいを使う
  if (!$('#modal').hidden) closeModal();
  try { const q = new URLSearchParams({ t: TOKEN, p: page }); if (arg) q.set('a', arg); history.replaceState(null, '', '?' + q.toString()); } catch (e) {}
  head(PAGES[PARENT[page] || page] ? PAGES[PARENT[page] || page][0] : '', null, '');
  const gen = GEN;
  setTimeout(() => { if (gen === GEN && MAIN_GEN !== gen) { $('#main').innerHTML = '<p class="loading">読み込み中…</p>'; } }, 150);
  window.scrollTo(0, 0);
  Promise.resolve(ROUTES[page](arg)).catch((e) => { setMain(`<div class="card warn"><p class="red b">開けませんでした</p><p>${h((e && e.message) || e)}</p><button class="btn" onclick="go('${page}'${arg ? `,'${h(arg)}'` : ''})">もう一度読み込む</button></div>`); });
}
window.addEventListener('beforeunload', (e) => { if (LEAVE && LEAVE.dirty && LEAVE.dirty()) { e.preventDefault(); e.returnValue = ''; } });

/* ───────── YouTube プレーヤー ───────── */
const PLAYERS = {};
let ytReady = null;
function loadYT() {
  if (ytReady) return ytReady;
  ytReady = new Promise((res) => {
    if (window.YT && window.YT.Player) return res();
    window.onYouTubeIframeAPIReady = () => res();
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
    setTimeout(res, 6000);
  });
  return ytReady;
}
async function mountPlayer(slot, elId, yt, opt = {}) {
  destroyPlayer(slot);
  await loadYT();
  const el = document.getElementById(elId);
  if (!el) return;
  if (window.YT && window.YT.Player) {
    // origin：YouTube はどのサイトに埋め込まれているかを確かめる（分からないと「エラー153」で再生できない）
    const pv = { playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, origin: location.origin };
    // 試合映像のページは自前の操作バーを使うので、YouTube の操作バーは出さない
    if (opt.noControls) Object.assign(pv, { controls: 0, disablekb: 1, fs: 0 });
    if (opt.start) pv.start = opt.start;
    if (opt.end) pv.end = opt.end;
    PLAYERS[slot] = { yt: new YT.Player(elId, { videoId: yt, playerVars: pv, events: { onStateChange: (e) => opt.onState && opt.onState(e.data) } }), id: yt };
  } else {
    el.innerHTML = `<iframe src="https://www.youtube.com/embed/${yt}?playsinline=1&start=${opt.start || 0}${opt.end ? '&end=' + opt.end : ''}" allow="autoplay; encrypted-media" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    PLAYERS[slot] = { el: el, id: yt };
  }
}
function destroyPlayer(slot) {
  const p = PLAYERS[slot]; if (p && p.yt && p.yt.destroy) { try { p.yt.destroy(); } catch (e) {} } delete PLAYERS[slot];
}
function curTime(slot = 'main') { const p = PLAYERS[slot]; return p && p.yt && p.yt.getCurrentTime ? Math.floor(p.yt.getCurrentTime()) : 0; }
function seek(sec, slot = 'main') {
  const p = PLAYERS[slot]; if (!p) return;
  if (p.yt && p.yt.seekTo) { p.yt.seekTo(sec, true); if (p.yt.playVideo) p.yt.playVideo(); }
  else if (p.el) p.el.innerHTML = `<iframe src="https://www.youtube.com/embed/${p.id}?autoplay=1&playsinline=1&start=${sec}" allow="autoplay; encrypted-media" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
}
function pausePlayer(slot = 'main') { const p = PLAYERS[slot]; if (p && p.yt && p.yt.pauseVideo) p.yt.pauseVideo(); }

/* 映像の下の操作バー：10秒戻る／再生・一時停止／10秒進む／再生速度（スロー） */
const RATES = [0.25, 0.5, 1, 1.5, 2];
const RATE_LABEL = { 0.25: '超スロー', 0.5: 'スロー', 1: '標準', 1.5: '1.5倍', 2: '2倍' };
function playerBar(slot) {
  return `<div class="pbar" id="pbar-${slot}">
    <button onclick="skip(-10,'${slot}')" aria-label="10秒戻る">« 10秒</button>
    <button class="play" onclick="togglePlay('${slot}')" aria-label="再生・一時停止">▶ ／ ❚❚</button>
    <button onclick="skip(10,'${slot}')" aria-label="10秒進む">10秒 »</button>
    <span class="rates">${RATES.map((r) => `<button data-r="${r}" class="${r === 1 ? 'on' : ''}" onclick="setRate(${r},'${slot}')">${RATE_LABEL[r]}</button>`).join('')}</span>
    ${slot === 'main' ? `<button class="fsbtn" onclick="playerFull()" aria-label="全画面">⛶ 全画面</button>` : ''}</div>`;
}
/* 全画面：映像・全体のバー・操作バーごと。使えない端末（iPhone）では画面いっぱいに広げる */
function playerFull() {
  const el = $('.pstick'); if (!el) return;
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  if (fsEl) return (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  if (document.body.classList.contains('pfull')) { document.body.classList.remove('pfull'); return fsLabel(); }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  const fallback = () => { document.body.classList.add('pfull'); fsLabel(); };
  // スマホは全画面にしたら横向きに固定（できる端末だけ）
  const land = () => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} };
  if (req && document.fullscreenEnabled !== false) { try { const r = req.call(el); if (r && r.then) r.then(land, fallback); else land(); return; } catch (e) {} }
  fallback();
}
function fsOn() { return !!(document.fullscreenElement || document.webkitFullscreenElement || document.body.classList.contains('pfull')); }
function fsLabel() {
  const b = $('.fsbtn'), el = $('.pstick'), on = fsOn();
  if (b) b.textContent = on ? '✕ 元に戻す' : '⛶ 全画面';
  if (el) { el.classList.toggle('fs', on); if (on) pokeCtl(); else el.classList.remove('idle'); }
  // iPhone の全画面（画面いっぱいに広げる方）では、カメラ部分の余白を YouTube の中にまで伝えないよう viewport-fit=cover を外す（映像が右に寄るのを防ぐ）
  const vp = document.querySelector('meta[name=viewport]');
  if (vp) vp.content = 'width=device-width, initial-scale=1' + (document.body.classList.contains('pfull') ? '' : ', viewport-fit=cover');
}
// 全画面では操作を映像の上に重ね、再生中に3秒さわらなければ消す（タップかマウスを動かすと出る）
let CTL_T;
function pokeCtl() {
  const el = $('.pstick.fs'); if (!el) return;
  el.classList.remove('idle'); clearTimeout(CTL_T);
  CTL_T = setTimeout(() => { const y = ytOf('main'); if (y && y.getPlayerState() === 1 && el.isConnected) el.classList.add('idle'); }, 3000);
}
function tapCtl() {
  const el = $('.pstick.fs'); if (!el) return;
  const y = ytOf('main');
  if (!el.classList.contains('idle') && y && y.getPlayerState() === 1) { clearTimeout(CTL_T); el.classList.add('idle'); } else pokeCtl();
}
document.addEventListener('fullscreenchange', fsLabel); document.addEventListener('webkitfullscreenchange', fsLabel);
function ytOf(slot) { const p = PLAYERS[slot]; return p && p.yt && p.yt.seekTo ? p.yt : null; }
function skip(sec, slot = 'main') {
  const y = ytOf(slot); if (!y) return;
  if (slot === 'main' && TL) { const t = nowT(); if (t !== null) return seekT(Math.max(0, Math.min(t + sec, tlTotal() || Infinity))); }
  y.seekTo(Math.max(0, y.getCurrentTime() + sec), true);
}
function togglePlay(slot = 'main') { const y = ytOf(slot); if (!y) return; if (y.getPlayerState() === 1) y.pauseVideo(); else y.playVideo(); }
function setRate(r, slot = 'main') {
  const y = ytOf(slot); if (!y) return;
  y.setPlaybackRate(r); if (slot === 'main' && TL) TL.rate = r;
  $$(`#pbar-${slot} .rates button`).forEach((b) => b.classList.toggle('on', Number(b.dataset.r) === r));
  if (y.getPlayerState() !== 1) y.playVideo();
}
// キーボード：← → で10秒、スペースで再生・一時停止（文字を入力中は効かない）
document.addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
  const slot = !$('#modal').hidden && PLAYERS.modal ? 'modal' : PLAYERS.main ? 'main' : '';
  if (!slot) return;
  if (e.key === 'ArrowLeft') { skip(-10, slot); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { skip(10, slot); e.preventDefault(); }
  else if (e.key === ' ') { togglePlay(slot); e.preventDefault(); }
});

/* Key Incidents の「時間」→ 映像の秒（キックオフ位置・後半開始位置が登録されている場合） */
function kiToSec(time, video, halfLen) {
  if (!video || (video.ko === null && video.h2 === null)) return null;
  const m = String(time || '').replace(/[＋]/g, '+').match(/(\d+)\s*(?:\+\s*(\d+))?/);
  if (!m) return null;
  const base = Number(m[1]), extra = Number(m[2] || 0), half = halfLen || 45;
  if (base <= half) return video.ko === null ? null : video.ko + Math.max(0, base - 1 + extra) * 60;
  if (video.h2 === null) return null;
  return video.h2 + Math.max(0, base - half - 1 + extra) * 60;
}

/* ───────── ホーム ───────── */
function todo(page, title, sub, label) {
  return `<a class="todo" href="#" onclick="go('${page}');return false;"><span class="ic">!</span><div class="main"><div class="t">${h(title)}</div>${sub ? `<div class="s">${h(sub)}</div>` : ''}</div><span class="go">${label || '開く'} ›</span></a>`;
}
function matchLi(m, right, onclick) {
  return `<${onclick ? 'a href="#" onclick="' + onclick + ';return false;"' : 'div'} class="li">${dateBox(m.date)}<div class="main"><div class="t">${card(m)}</div><div class="s">${h(m.ko)}　${h(m.comp)} ${h(m.name)}${m.venue ? '／' + h(m.venue) : ''}</div></div>${right || ''}${onclick ? '<span class="chev">›</span></a>' : '</div>'}`;
}
const NOTICE_LABEL = { survey: '回答する', fitness: '入力する', assess: '書く' };
ROUTES.home = async () => {
  head('ホーム');
  const r = await get('api_home');
  BADGE = {}; r.notices.forEach((x) => (BADGE[x.page] = true));
  const c = B.ctx;
  let html = `<p class="muted" style="margin-bottom:4px">${h(c.name)} さん</p><p class="small muted" style="margin-bottom:20px">${[c.ref && '強化審判員', c.asr && 'アセッサー', c.com && '委員会'].filter(Boolean).join('・')}</p>`;
  const todos = r.notices.map((x) => todo(x.page, x.text, '', NOTICE_LABEL[x.page]));
  if (r.com) {
    if (r.com.reportsPending) { todos.push(todo('c_reports', `未提出のアセスメントレポート ${r.com.reportsPending}件`, '試合日を過ぎてもアセッサーが提出していないもの')); BADGE.c_reports = r.com.reportsPending; }
    if (r.com.dispatchPending) { todos.push(todo('c_dispatch', `派遣者が未定の地区派遣 ${r.com.dispatchPending}件`, '地区協会からの返事を待っているもの')); BADGE.c_dispatch = r.com.dispatchPending; }
  }
  html += `<h2 style="margin-top:0">やること</h2>` + (todos.length ? todos.join('') : `<div class="todo done"><span class="ic">✓</span><div class="main"><div class="t">いま、やることはありません</div><div class="s">新しい依頼があるとメールでお知らせします</div></div></div>`);
  if (r.com) html += r.com.months.map(comMonthCard).join('');
  if (c.ref || c.asr) {
    html += `<h2>これからの担当試合</h2>` + (r.upcoming.length ? `<div class="list">${r.upcoming.map((m) => matchLi(m, `<span class="pill solid">${h(m.role)}</span>`)).join('')}</div>` : empty('公開されている担当試合はまだありません'));
  }
  setMain(html);
  renderNav();
  prefetchTabs();
};
/* ホームを出したあと、よく使うページのデータを裏で読み込んでおく */
function prefetchTabs() {
  const c = B.ctx, nm = addMonth(B.today.slice(0, 7), 1), list = [];
  if (c.com) list.push(['api_months'], ['api_assignBoard', nm], ['api_surveyStatus', nm], ['api_reports', B.today.slice(0, 7)], ['api_matches', nm]);
  if (c.ref) list.push(['api_survey', ''], ['api_assignTable', ''], ['api_myReports']);
  if (c.asr) list.push(['api_myAssessments']);
  if (!c.com && !c.ref) list.push(['api_assignTable', '']);
  list.push(['api_videos']);
  prefetch(list);
}
function comMonthCard(m) {
  const isNext = m.ym !== B.today.slice(0, 7);
  if (!isNext && !m.matches) return '';
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const filled = m.slots - m.empty, answered = m.refs - m.unanswered;
  const box = (k, v, sub, page, pctv) => `<a class="stat" href="#" onclick="go('${page}','${m.ym}');return false;" style="display:block;color:inherit"><div class="k">${k}</div><div class="v">${v}</div>${pctv !== undefined ? `<div class="bar"><i style="width:${pctv}%"></i></div>` : ''}<div class="small muted">${sub}</div></a>`;
  return `<h2>${ymLabel(m.ym)}（${isNext ? '来月' : '今月'}）</h2>
    <div class="grid3 stats3">
      ${box('試合一覧', m.matches + '<small>試合</small>', m.list ? '公開済み' : '<span class="red">未公開</span>', 'c_matches')}
      ${box('稼働調査の回答', m.list ? answered + '<small>／' + m.refs + '人</small>' : '—', m.list ? `締切 ${md(m.deadline)}${m.unanswered ? `・<span class="red">未回答 ${m.unanswered}人</span>` : '・全員回答'}` : '一覧の公開後に始まります', 'c_survey', m.list ? pct(answered, m.refs) : undefined)}
      ${box('割当', m.slots ? filled + '<small>／' + m.slots + '枠</small>' : '—', m.assign ? '公開済み' : (m.slots ? '<span class="red">未公開</span>' : '試合がありません'), 'c_assign', m.slots ? pct(filled, m.slots) : undefined)}
    </div>`;
}

/* ───────── 個人：稼働調査 ───────── */
let SV = null;
const ANS = [['○', '行ける', 'o'], ['△', '条件付き', 'tri'], ['×', '行けない', 'x']];
ROUTES.survey = async (ym) => {
  head('稼働調査');
  SV = await get('api_survey', ym || '');
  if (!SV.month || !SV.matches.length) return setMain(empty('いま回答できる稼働調査はありません。<br>毎月10日に翌月の試合一覧が公開され、メールでお知らせします。'));
  head(ymLabel(SV.month) + 'の稼働調査');
  const left = daysLeft(SV.deadline);
  setMain(`<div class="card ${SV.open ? 'pale' : ''}">
      <div class="row"><div><div class="small muted">締切</div><div class="b">${dl(SV.deadline)}${SV.open ? `　<span class="${left <= 2 ? 'red' : 'blue'}">${left === 0 ? '今日まで' : 'あと' + left + '日'}</span>` : '　<span class="red">締切済み（変更は委員会へ連絡）</span>'}</div></div>
      <span class="spacer"></span><div style="text-align:right"><div class="small muted">回答</div><div class="b" id="sv-count"></div></div></div>
      <div class="bar"><i id="sv-bar"></i></div>
      ${SV.open ? '<div class="small muted">選ぶとすぐに保存されます。締切までは何度でも変えられます。</div>' : ''}
    </div>
    <div id="sv-list">${SV.matches.map(svCard).join('')}</div>
    <div class="actionbar"><div class="in"><span class="msg" id="sv-state">${SV.open ? '選ぶと自動で保存されます' : '締切を過ぎたため変更できません'}</span>${SV.open ? `<button class="btn primary" onclick="svSaveNow()">保存</button>` : ''}</div></div>`);
  svCount();
  LEAVE = () => svSave.flush();
  LEAVE.dirty = () => SV && SV.dirty;
};
function svCard(m, i) {
  const showNote = m.ans === '△' || m.note;
  return `<div class="mcard" id="sv-${i}">
    <div class="mhead">${dateBox(m.date)}<div class="main"><div class="t">${card(m)}</div><div class="s">${h(m.ko)} キックオフ　${h(m.comp)} ${h(m.name)}</div><div class="s">${h(m.venue)}</div></div></div>
    <div style="padding:12px 16px">
      <div class="seg">${ANS.map(([a, l, k]) => `<button class="${k} ${m.ans === a ? 'on' : ''}" ${SV.open ? '' : 'disabled'} onclick="svSet(${i},'${a}')"><span class="mk">${a}</span>${l}</button>`).join('')}</div>
      <div style="margin-top:10px" ${showNote ? '' : 'hidden'} id="sv-note-${i}"><input placeholder="${m.ans === '△' ? '△の条件（例：午後なら可）' : '備考'}" value="${h(m.note)}" ${SV.open ? '' : 'disabled'} oninput="svNote(${i},this.value)"></div>
      ${!showNote && SV.open ? `<button class="btn ghost sm" style="margin-top:6px;padding-left:4px" id="sv-nb-${i}" onclick="this.hidden=true;$('#sv-note-${i}').hidden=false;$('#sv-note-${i} input').focus()">＋ 備考を書く</button>` : ''}
    </div></div>`;
}
function svCount() {
  const n = SV.matches.filter((m) => m.ans).length, all = SV.matches.length;
  $('#sv-count').innerHTML = `${n}／${all}試合${n === all ? ' <span class="blue">✓</span>' : ''}`;
  $('#sv-bar').style.width = Math.round((n / all) * 100) + '%';
}
function svSet(i, a) {
  const m = SV.matches[i]; m.ans = m.ans === a ? '' : a;
  const el = $('#sv-' + i);
  el.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.querySelector('.mk').textContent === m.ans));
  if (m.ans === '△') { $('#sv-note-' + i).hidden = false; const nb = $('#sv-nb-' + i); if (nb) nb.hidden = true; $('#sv-note-' + i + ' input').placeholder = '△の条件（例：午後なら可）'; }
  svCount(); SV.dirty = true; svState('保存中…'); svSave();
}
function svNote(i, v) { SV.matches[i].note = v; SV.dirty = true; svState('入力中…'); svSave(); }
function svState(s) { const e = $('#sv-state'); if (e) e.innerHTML = s; }
const svSave = debounce(async () => {
  if (!SV || !SV.dirty || !SV.open) return;
  SV.dirty = false;
  try {
    await call('api_saveSurvey', SV.month, SV.matches.map((m) => ({ id: m.id, ans: m.ans, note: m.note })));
    const t = new Date(); svState(`<span class="blue">✓</span> 保存しました（${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}）`);
  } catch (e) { SV.dirty = true; svState('<span class="red">保存できませんでした。「保存」を押してください</span>'); fail(e); }
}, 700);
function svSaveNow() { SV.dirty = true; svSave.flush(); }

/* ───────── みんな：割当表 ───────── */
let TB = null, TB_MINE = false;
ROUTES.table = async (ym) => {
  head('割当表');
  TB = await get('api_assignTable', ym || '');
  if (!TB.month) return setMain(empty('公開されている割当はまだありません'));
  head('割当表', null, monthNav('table', TB.month, TB.months));
  renderTable();
};
// 割当表（スマホ）：日付ごと、その中を大会（リーグ）ごとにまとめる
function tGroups(list) {
  const sorted = list.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.comp).localeCompare(String(b.comp)) || String(a.ko).localeCompare(String(b.ko)));
  const out = [];
  sorted.forEach((m) => { let g = out[out.length - 1]; if (!g || g.date !== m.date || g.comp !== m.comp) out.push((g = { date: m.date, comp: m.comp, newDay: !g || g.date !== m.date, items: [] })); g.items.push(m); });
  return out;
}
function renderTable() {
  const roles = B.consts.ROLES;
  const mine = (m) => roles.some((x) => m['mine_' + x]);
  const list = TB.matches.filter((m) => !TB_MINE || mine(m));
  const cell = (m, x) => m['mine_' + x] ? `<b class="blue">${h(m.slots[x])}</b>` : m.slots[x] === '未定' ? '<span class="muted">未定</span>' : h(m.slots[x]);
  setMain(`${TB.published ? '' : '<div class="card warn"><span class="red b">この月の割当はまだ公開していません</span>（委員会だけに表示）</div>'}
    ${B.ctx.ref || B.ctx.asr ? `<div style="margin-bottom:12px"><button class="chip ${TB_MINE ? '' : 'on'}" onclick="TB_MINE=false;renderTable()">すべての試合</button><button class="chip ${TB_MINE ? 'on' : ''}" onclick="TB_MINE=true;renderTable()">自分の担当だけ</button></div>` : ''}
    ${!list.length ? empty(TB_MINE ? 'この月の担当はありません' : 'この月の試合はありません') : `
    <div class="tbl pc-only"><table><thead><tr><th>日付</th><th>試合</th>${roles.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${list.map((m) => `<tr class="${mine(m) ? 'me' : ''}">
      <td style="white-space:nowrap"><b>${dl(m.date)}</b><div class="small muted">${h(m.ko)}</div></td>
      <td><div class="b">${card(m)}</div><div class="small muted">${h(m.comp)} ${h(m.name)}／${h(m.venue)}</div></td>
      ${roles.map((x) => `<td>${cell(m, x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="sp-only tlist"><div class="thead">${['主審', '副審1', '副審2', '4審', 'アセッサー'].map((x) => `<span>${x}</span>`).join('')}</div>${tGroups(list).map((g) => `
      ${g.newDay ? `<div class="tday">${dl(g.date)}</div>` : ''}<div class="tcomp">${h(g.comp || '大会名なし')}</div>${g.items.map((m) => `<div class="trow ${mine(m) ? 'me' : ''}">
      <div class="t1"><span class="muted num">${h(m.ko)}</span><span class="tcard">${card(m)}</span></div>
      ${m.name || m.venue ? `<div class="t3">${[m.name, m.venue].filter(Boolean).map(h).join('・')}</div>` : ''}
      <div class="t2">${roles.map((x) => `<span>${cell(m, x)}</span>`).join('')}</div></div>`).join('')}`).join('')}</div>`}`);
  // 役割の見出しは、上の見出し（黒い帯）のすぐ下に止める
  const th = $('.tlist .thead'), hd = $('.head');
  if (th && hd) th.style.top = ((parseFloat(getComputedStyle(hd).top) || 0) + hd.offsetHeight) + 'px';
}

/* ───────── 個人：レポートと年間評価 ───────── */
function annualStats(annual) {
  return annual.length ? `<div class="grid3" style="margin-bottom:8px">${annual.map((a) => `<div class="stat blue"><div class="k">${a.year}年の年間評価</div><div class="v">${a.avg.toFixed(2)}</div><div class="small muted">${a.n}試合の平均</div></div>`).join('')}</div>` : '';
}
function scoreText(s) { return s === null || s === undefined ? '—' : Number(s).toFixed(1); }
ROUTES.myreports = async () => {
  head('アセスメントレポート');
  const r = await get('api_myReports');
  if (!r.list.length) return setMain(empty('まだレポートはありません。<br>担当した試合のレポートが提出されると、メールでお知らせします。'));
  setMain(`${annualStats(r.annual)}<p class="small muted">年間評価は、その年に受けたレポートの評価点（例外の評価点があればそちら）の平均です。</p>
    <h2>受け取ったレポート</h2><div class="list">${r.list.map((m) => matchLi(m, `<div style="text-align:right"><div class="small muted">${h(m.role)}</div><div class="b blue num" style="font-size:18px">${scoreText(m.score)}</div></div>`, `go('myreport','${m.id}')`)).join('')}</div>`);
};

function sectionRO(role, sec, crewName) {
  const C = B.consts;
  const label = role === '第4審' ? '第4の審判員' : role;
  if (role === '第4審') return `<h2 style="margin-top:0">${label}　<span class="muted" style="font-weight:400">${h(crewName || '')}</span></h2><p class="pre">${h(sec.comment || '（記載なし）')}</p>`;
  const items = role === '主審' ? C.REF_ITEMS : C.AR_ITEMS;
  const it = sec.items || {};
  const body = items.map((x) => role === '主審'
    ? `<div class="item"><div class="ttl">${x.k}　${h(x.t)}</div><div class="grid2" style="margin-top:6px"><div><div class="flabel">良かった点</div><p class="pre">${h((it[x.k] || {}).good || '—')}</p></div><div><div class="flabel">課題点</div><p class="pre">${h((it[x.k] || {}).bad || '—')}</p></div></div></div>`
    : `<div class="item"><div class="ttl">${x.k}　${h(x.t)}</div><p class="pre" style="margin-top:6px">${h(it[x.k] || '—')}</p></div>`).join('');
  const hasEx = sec.exception !== '' && sec.exception !== undefined && sec.exception !== null;
  const ad = hasEx ? sec.exception : sec.score;
  return `<h2 style="margin-top:0">${label}　<span class="muted" style="font-weight:400">${h(crewName || '')}</span></h2>
    <div class="row" style="gap:24px;margin:0 0 12px"><div><div class="small muted">評価点</div><div class="bigscore">${ad !== undefined && ad !== '' ? Number(ad).toFixed(1) : '—'}</div></div>
    <dl class="kv"><dt>難易度</dt><dd>${h(sec.diff || '—')}</dd><dt>全体のパフォーマンス</dt><dd>${h(sec.perf || '—')}</dd>${hasEx ? `<dt>例外の評価点</dt><dd>${h(sec.exception)}</dd>` : ''}</dl></div>
    ${body}
    ${role === '主審' ? `<div class="item"><div class="ttl">アドバイス</div><p class="pre">${h(sec.advice || '—')}</p></div>` : ''}
    <div class="item"><div class="ttl">難易度の理由</div><p class="pre">${h(sec.reason || '—')}</p></div>
    ${sec.note ? `<div class="item"><div class="ttl">特記事項</div><p class="pre">${h(sec.note)}</p></div>` : ''}`;
}
function scoreTotals(sc) {
  sc = sc || {};
  const total = (k) => ['1', '2', 'e1', 'e2'].reduce((s, x) => s + (Number(sc[k + x]) || 0), 0);
  return [total('a'), total('b')];
}
function infoRO(match, info, assessor, date) {
  const sc = info.sc || {};
  const t = (a, b) => (a === '' || a === undefined ? '-' : a) + ' - ' + (b === '' || b === undefined ? '-' : b);
  const [ta, tb] = scoreTotals(sc);
  return `<div class="row top" style="gap:16px">${dateBox(match.date)}<div style="flex:1;min-width:0"><div class="b" style="font-size:17px">${card(match)}</div>
      <div class="small muted">${h(match.ko)}　${h(match.comp)} ${h(match.name)}／${h(match.venue)}</div></div>
      <div style="text-align:right"><div class="small muted">結果</div><div class="bigscore" style="font-size:26px">${ta} - ${tb}</div></div></div>
    <dl class="kv" style="margin-top:12px"><dt>内訳</dt><dd>前半 ${t(sc.a1, sc.b1)}／後半 ${t(sc.a2, sc.b2)}${sc.ae1 !== undefined && sc.ae1 !== '' ? `／延長前半 ${t(sc.ae1, sc.be1)}／延長後半 ${t(sc.ae2, sc.be2)}` : ''}${sc.apk !== undefined && sc.apk !== '' ? `／PK ${t(sc.apk, sc.bpk)}` : ''}</dd>
    <dt>試合時間</dt><dd>${h(info.time || '—')}分${info.ext ? '（延長 ' + h(info.ext) + '分）' : ''}</dd>
    <dt>アセッサー</dt><dd>${h(assessor || '')}</dd><dt>記入日</dt><dd>${h(date || info.date || '')}</dd>
    ${info.ops ? `<dt>運営上の問題点</dt><dd class="pre">${h(info.ops)}</dd>` : ''}</dl>`;
}
/* レポートの試合の映像を組（出どころ）ごとにまとめ、キックオフ位置のある組を使う */
function matchTimeline(videos) {
  const PARTS = B.consts.PARTS || [];
  const sets = {};
  (videos || []).filter((v) => !v.veo).forEach((v) => (sets[v.team] = sets[v.team] || []).push(v));
  for (const team in sets) {
    const parts = sets[team].sort((a, b) => PARTS.indexOf(a.part) - PARTS.indexOf(b.part) || String(a.at).localeCompare(String(b.at)));
    const tl = tlBuild(parts), mk = tlMarks(tl);
    if (mk.ko !== null || mk.h2 !== null) return { tl, mk };
  }
  return null;
}
function kiRO(ki, videos, halfLen) {
  const list = (ki || []).filter((k) => k && (k.time || k.text));
  if (!list.length) return '<h2 style="margin-top:0">Key Incidents</h2><p class="muted">ありません</p>';
  const m = matchTimeline(videos);
  return `<h2 style="margin-top:0">Key Incidents</h2>${list.map((k) => {
    const t = m ? kiToSec(k.time, m.mk, halfLen) : null;
    const p = t !== null ? fromT(t, m.tl) : null;
    return `<div class="item row top"><span class="b blue num" style="width:56px">${h(k.time)}${/\d$/.test(k.time) ? '分' : ''}</span><div class="pre" style="flex:1">${h(k.text)}</div>${p ? `<button class="btn sm" onclick="go('video','${p.id}@${Math.round(p.local)}')">映像</button>` : ''}</div>`;
  }).join('')}`;
}
// Veo の映像は Veo の画面で開く（外から操作できないため、コメント・事例・スローは使えない）
function veoBtn(v, label) { return `<a class="btn sm" href="${h(v.url)}" target="_blank" rel="noopener">${label} ↗</a>`; }
const VEO_NOTE = 'Veo の映像は Veo の画面で開きます（コメント・事例・スロー・つなぎ再生は使えません）。使いたいときは、チームに Veo から MP4 をダウンロードして YouTube に「限定公開」で上げてもらい、その URL を登録してください。';
function videoBtns(videos) {
  const first = {}; (videos || []).forEach((v) => { const k = v.team + (v.veo ? '|veo' : ''); if (!first[k]) first[k] = v; });
  const list = Object.values(first);
  return list.length ? `<div class="row" style="margin:0 0 12px">${list.map((v) => v.veo ? veoBtn(v, `Veoで見る（${h(v.team)}提供）`)
    : `<button class="btn sm" onclick="go('video','${v.id}')">${icon('videos', 16)} 試合映像（${h(v.team)}提供）</button>`).join('')}</div>` : '';
}

ROUTES.myreport = async (matchId) => {
  head('アセスメントレポート', ['myreports']);
  const r = await get('api_myReport', matchId);
  const half = r.info.time ? Number(r.info.time) / 2 : 45;
  setMain(`<div class="card">${infoRO(r.match, r.info, r.assessor, r.date)}</div>${videoBtns(r.videos)}
    ${r.roles.map((role) => `<div class="card">${sectionRO(role, r.sections[role])}</div>`).join('')}
    <div class="card">${kiRO(r.ki, r.videos, half)}</div>`);
};

/* ───────── 個人：体力テスト ───────── */
let FT = null;
ROUTES.fitness = async (ym) => {
  head('体力テスト');
  FT = await get('api_fitness');
  const c = FT.current || { date: '', yoyo: '', d: ['', '', '', '', '', ''] };
  const left = daysLeft(FT.deadline);
  const hist = FT.history.map((x) => `<tr><td>${ymLabel(x.month)}</td><td class="num">${x.yoyo}</td><td class="num b">${fmt2(x.avg)}</td><td class="num">${fmt2(x.min)}</td><td class="num">${fmt2(x.max)}</td></tr>`).join('');
  const resM = ym && FT.months.includes(ym) ? ym : FT.months[0];
  setMain(`${B.ctx.ref ? `<div class="card ${FT.current ? '' : 'warn'}">
      <div class="row" style="margin-bottom:12px"><h2 style="margin:0">${ymLabel(FT.month)}の記録</h2>${FT.current ? '<span class="pill ok">入力済み</span>' : '<span class="pill ng">未入力</span>'}<span class="spacer"></span><span class="small muted">締切 ${md(FT.deadline)}（${left === 0 ? '今日まで' : 'あと' + left + '日'}）</span></div>
      ${fitForm(c, FT.month)}
      <button class="btn primary wide" style="margin-top:8px" onclick="ftSave()">${FT.current ? '更新する' : '保存する'}</button>
      <p class="small muted" style="margin:8px 0 0">全員の結果は翌月1日に、氏名と順位つきで公開されます。</p></div>` : ''}
    ${hist ? `<h2>自分の記録</h2><div class="tbl"><table><thead><tr><th>月</th><th class="num">Yo-Yo（本）</th><th class="num">40m平均</th><th class="num">最速</th><th class="num">最遅</th></tr></thead><tbody>${hist}</tbody></table></div>` : ''}
    <div class="row" style="margin-top:28px;margin-bottom:10px"><h2 style="margin:0">全体の結果</h2><span class="spacer"></span>${resM ? monthNav('fitness', resM, FT.months) : ''}</div>
    <div id="ft-res">${resM ? '<p class="loading">読み込み中…</p>' : empty('公開されている結果はまだありません')}</div>`);
  ftCalc();
  if (resM) ftResults(resM);
};
function fitForm(c, month) {
  return `<div class="grid2"><div class="field"><label>測定日</label><input type="date" id="ft-date" value="${h(c.date)}" min="${month}-01" max="${month}-31"></div>
    <div class="field"><label>Yo-Yoテスト（本数）</label><input type="number" inputmode="numeric" id="ft-yoyo" min="0" step="1" value="${c.yoyo ?? ''}" placeholder="例：18"></div></div>
    <div class="field"><label>40mダッシュ（秒・6本）</label>
    <div class="grid3" style="grid-template-columns:repeat(3,1fr);gap:8px">${[0, 1, 2, 3, 4, 5].map((i) => `<input type="number" inputmode="decimal" class="ft-d num" step="0.01" min="0" placeholder="${i + 1}本目" value="${c.d[i] ?? ''}" oninput="ftCalc()" aria-label="${i + 1}本目">`).join('')}</div></div>
    <div id="ft-calc"></div>`;
}
function ftCalc() {
  const el = $('#ft-calc'); if (!el) return;
  const d = $$('.ft-d').map((e) => Number(e.value)).filter((x) => x > 0);
  const lo = B.consts.warnLo, hi = B.consts.warnHi;
  $$('.ft-d').forEach((e) => { const v = Number(e.value); e.style.borderColor = v > 0 && (v < lo || v > hi) ? 'var(--accent)' : ''; });
  const warn = d.some((x) => x < lo || x > hi) ? `<p class="alert" style="margin:8px 0 0">${lo}秒未満または${hi}秒超の記録があります。入力ミスがないか確認してください。</p>` : '';
  el.innerHTML = d.length ? `<div class="grid3" style="grid-template-columns:repeat(3,1fr);gap:8px"><div class="stat blue"><div class="k">平均</div><div class="v">${(d.reduce((a, b) => a + b, 0) / d.length).toFixed(2)}</div></div>
    <div class="stat"><div class="k">最速</div><div class="v">${Math.min(...d).toFixed(2)}</div></div><div class="stat"><div class="k">最遅</div><div class="v">${Math.max(...d).toFixed(2)}</div></div></div>
    ${d.length < 6 ? `<p class="small muted" style="margin:6px 0 0">${d.length}本入力済み</p>` : ''}${warn}` : '';
}
function ftCollect() { return { date: $('#ft-date').value, yoyo: $('#ft-yoyo').value, d: $$('.ft-d').map((e) => e.value) }; }
async function ftSave(memberId, month) {
  try {
    const rec = ftCollect(); if (memberId) { rec.memberId = memberId; rec.month = month; }
    await call('api_fitnessSave', rec); toast('保存しました');
    if (memberId) { closeModal(); go('c_fitness', month); } else go('fitness');
  } catch (e) { fail(e); }
}
function rankTables(r, editable) {
  const me = B.ctx.id;
  const edit = (x) => editable ? `<td><button class="btn sm ghost" onclick="cfEdit('${x.memberId}','${r.month}')">修正</button></td>` : '';
  const medal = (n) => n <= 3 ? `<b class="blue">${n}</b>` : n;
  const yoyo = r.yoyo.map((x) => `<tr class="${x.memberId === me ? 'me' : ''}"><td class="num">${medal(x.rank)}</td><td>${h(x.name)}</td><td class="num b">${x.yoyo}</td>${edit(x)}</tr>`).join('');
  const dash = r.dash.map((x) => `<tr class="${x.memberId === me ? 'me' : ''}"><td class="num">${medal(x.rank)}</td><td style="white-space:nowrap">${h(x.name)}</td><td class="num b">${fmt2(x.avg)}</td><td class="num">${fmt2(x.min)}</td><td class="num">${fmt2(x.max)}</td>${x.d.map((v) => `<td class="num muted">${fmt2(v)}</td>`).join('')}${edit(x)}</tr>`).join('');
  const miss = r.missing.map((x) => editable ? `<button class="chip" onclick="cfEdit('${x.memberId}','${r.month}')">＋ ${h(x.name)}</button>` : `<span class="tag">${h(x.name)}</span>`).join('');
  return `<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)">
    <div><h3>Yo-Yoテスト</h3><div class="tbl"><table><thead><tr><th class="num">順位</th><th>氏名</th><th class="num">本数</th>${editable ? '<th></th>' : ''}</tr></thead><tbody>${yoyo || '<tr><td colspan="4" class="muted">記録なし</td></tr>'}</tbody></table></div></div>
    <div><h3>40mダッシュ（平均の速い順）</h3><div class="tbl"><table><thead><tr><th class="num">順位</th><th>氏名</th><th class="num">平均</th><th class="num">最速</th><th class="num">最遅</th>${[1, 2, 3, 4, 5, 6].map((i) => `<th class="num">${i}</th>`).join('')}${editable ? '<th></th>' : ''}</tr></thead><tbody>${dash || '<tr><td colspan="12" class="muted">記録なし</td></tr>'}</tbody></table></div></div></div>
    ${r.missing.length ? `<h3>未測定（${r.missing.length}名）</h3><div>${miss}</div>` : ''}`;
}
async function ftResults(ym) {
  try { const r = await get('api_fitnessResults', ym); $('#ft-res').innerHTML = rankTables(r, false); } catch (e) { $('#ft-res').innerHTML = `<p class="alert">${h(e.message)}</p>`; }
}

/* ───────── アセッサー：担当試合 ───────── */
ROUTES.assess = async () => {
  head('担当試合（アセッサー）');
  const list = await get('api_myAssessments');
  if (!list.length) return setMain(empty('担当試合はありません'));
  const todo = list.filter((m) => m.status !== '提出済' && m.date <= B.today);
  const later = list.filter((m) => m.status !== '提出済' && m.date > B.today).reverse();
  const done = list.filter((m) => m.status === '提出済');
  const li = (m) => matchLi(m, statusPill(m.status), `go('report','${m.id}')`);
  setMain(`<p class="lead">試合が終わったらレポートを書いて提出してください。提出すると担当審判員と委員会に届きます。</p>
    ${todo.length ? `<h2 style="margin-top:0">書くもの（${todo.length}件）</h2><div class="list">${todo.map(li).join('')}</div>` : ''}
    ${later.length ? `<h2>これからの試合</h2><div class="list">${later.map(li).join('')}</div>` : ''}
    ${done.length ? `<h2>提出済み</h2><div class="list">${done.map(li).join('')}</div>` : ''}`);
};

/* ───────── アセスメントレポート（入力・閲覧） ───────── */
let RP = null;
function getPath(o, p) { return p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o); }
function setPath(o, p, v) { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach((k) => { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
function ta(path, max, ph, rows) { return `<textarea data-k="${path}" data-max="${max}" oninput="cnt(this);rpDirty()" placeholder="${h(ph || '')}" ${rows ? `style="min-height:${rows}px"` : ''}></textarea><span class="count">0／${max}字</span>`; }
function cnt(el) { const n = Array.from(el.value).length, max = Number(el.dataset.max); const c = el.nextElementSibling; if (!c) return; c.textContent = n + '／' + max + '字'; c.classList.toggle('over', n > max); }
const DIFFS = ['やさしい', 'ふつう', 'むずかしい'], PERFS = ['良い', '普通', '悪い'];

function segPick(key, list, cur, onpick) {
  return `<input type="hidden" data-k="${key}" value="${h(cur || '')}"><div class="seg sm" data-seg="${key}">${list.map((v) => `<button type="button" class="${v === cur ? 'on' : ''}" onclick="segSet('${key}','${v}');${onpick || ''}">${v}</button>`).join('')}</div>`;
}
function segSet(key, v) {
  const inp = $(`[data-k="${key}"]`); inp.value = inp.value === v ? '' : v;
  $$(`[data-seg="${key}"] button`).forEach((b) => b.classList.toggle('on', b.textContent === inp.value));
  rpDirty();
}
function rangeOf(role) {
  const d = ($(`[data-k="s.${role}.diff"]`) || {}).value, p = ($(`[data-k="s.${role}.perf"]`) || {}).value;
  return d && p ? B.consts.RANGES[p][d] : null;
}
function scorePick(role) {
  const box = $(`#sc-${role}`); if (!box) return;
  const r = rangeOf(role);
  const inp = $(`[data-k="s.${role}.score"]`);
  if (!r) { box.innerHTML = '<span class="small muted">難易度と全体のパフォーマンスを選ぶと、選べる評価点が出ます</span>'; return; }
  const opts = []; for (let v = Math.round(r[0] * 10); v <= Math.round(r[1] * 10); v++) opts.push((v / 10).toFixed(1));
  if (inp.value && !opts.includes(Number(inp.value).toFixed(1))) inp.value = '';
  box.innerHTML = `<div class="scoregrid">${opts.map((v) => `<button type="button" class="${inp.value && Number(inp.value).toFixed(1) === v ? 'on' : ''}" onclick="scoreSet('${role}','${v}')">${v}</button>`).join('')}</div>`;
  noteHint(role);
}
function scoreSet(role, v) { const inp = $(`[data-k="s.${role}.score"]`); inp.value = inp.value === v ? '' : v; scorePick(role); rpDirty(); }
function exToggle(role, on) { $(`#ex-${role}`).hidden = !on; if (!on) $(`[data-k="s.${role}.exception"]`).value = ''; noteHint(role); rpDirty(); }
function noteHint(role) {
  const el = $(`#nh-${role}`); if (!el) return;
  const ex = ($(`[data-k="s.${role}.exception"]`) || {}).value, sc = ($(`[data-k="s.${role}.score"]`) || {}).value;
  const need = ex !== '' || (sc !== '' && Number(sc) < 8);
  el.innerHTML = need ? `<span class="red b">${ex !== '' ? '例外の評価点' : '評価点が8.0未満'}のため、特記事項に理由を必ず書いてください</span>` : '評価点が8.0未満、または例外の評価点のときは必ず記入';
}

function roleForm(role, crew) {
  const C = B.consts, L = C.LIMITS;
  const who = `<div class="card pale" style="margin-bottom:16px"><div class="small muted">${role === '第4審' ? '第4の審判員' : role}</div><div class="b" style="font-size:17px">${h(crew.name)}${crew.affil ? `<span class="small muted" style="font-weight:400">（${h(crew.affil)}）</span>` : ''}</div></div>`;
  if (role === '第4審') return who + `<div class="field"><label>コメント・アドバイス</label>${ta('s.第4審.comment', L.fourth, '', 160)}</div>`;
  const items = role === '主審'
    ? C.REF_ITEMS.map((x) => `<div class="item"><div class="ttl">${x.k}　${h(x.t)}</div><div class="desc">${h(x.d)}</div>
        <div class="grid2"><div class="field"><label>良かった点</label>${ta(`s.${role}.items.${x.k}.good`, L.good)}</div><div class="field"><label>課題点</label>${ta(`s.${role}.items.${x.k}.bad`, L.bad)}</div></div></div>`).join('')
    : C.AR_ITEMS.map((x) => `<div class="item"><div class="ttl">${x.k}　${h(x.t)}</div><div class="field" style="margin-top:6px"><label>良かった点、課題点、アドバイス</label>${ta(`s.${role}.items.${x.k}`, L.ar)}</div></div>`).join('');
  return who + `<div class="card">${items}</div>
    <div class="card blue"><h2>総合評価</h2>
      <div class="grid2"><div class="field"><label>難易度</label>${segPick(`s.${role}.diff`, DIFFS, '', `scorePick('${role}')`)}</div>
      <div class="field"><label>全体のパフォーマンス</label>${segPick(`s.${role}.perf`, PERFS, '', `scorePick('${role}')`)}</div></div>
      <div class="field"><label>評価点</label><input type="hidden" data-k="s.${role}.score"><div id="sc-${role}"></div></div>
      <label class="row small" style="cursor:pointer;margin:4px 0 8px"><input type="checkbox" id="exc-${role}" onchange="exToggle('${role}',this.checked)"> 範囲外の評価点（例外）を使う</label>
      <div class="field" id="ex-${role}" hidden><label>例外の評価点（0〜10）</label><input type="number" inputmode="decimal" step="0.1" min="0" max="10" data-k="s.${role}.exception" class="w-m" oninput="noteHint('${role}');rpDirty()"></div>
      ${role === '主審' ? `<div class="field"><label>アドバイス（課題点解決のための具体的な方法）</label>${ta(`s.${role}.advice`, L.advice)}</div>` : ''}
      <div class="field"><label>難易度の理由</label>${ta(`s.${role}.reason`, L.reason)}</div>
      <div class="field"><label>特記事項</label><div class="hint" id="nh-${role}" style="margin:0 0 4px"></div>${ta(`s.${role}.note`, L.note)}</div>
    </div>`;
}

function collectReport() {
  const d = {};
  $$('#rp-form [data-k]').forEach((el) => setPath(d, el.dataset.k, el.value));
  d.ki = [0, 1, 2, 3, 4].map((i) => ((d.ki || {})[i]) || { time: '', text: '' });
  return d;
}
function fillReport(data) {
  $$('#rp-form [data-k]').forEach((el) => {
    const v = getPath(data, el.dataset.k);
    if (v !== undefined && v !== null) el.value = v;
    if (el.tagName === 'TEXTAREA' && el.dataset.max) cnt(el);
  });
  $$('#rp-form [data-seg]').forEach((s) => { const v = $(`[data-k="${s.dataset.seg}"]`).value; s.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.textContent === v)); });
  B.consts.OFFICIAL_ROLES.forEach((role) => {
    const ex = $(`[data-k="s.${role}.exception"]`);
    if (ex && ex.value !== '') { $(`#exc-${role}`).checked = true; $(`#ex-${role}`).hidden = false; }
    scorePick(role); noteHint(role);
  });
  rpTotals();
}
function rpTotals() {
  const g = (k) => Number(($(`[data-k="info.sc.${k}"]`) || {}).value) || 0;
  const a = g('a1') + g('a2') + g('ae1') + g('ae2'), b = g('b1') + g('b2') + g('be1') + g('be2');
  if ($('#rp-total')) $('#rp-total').textContent = a + ' - ' + b;
}
function rpSecs() { return RP.secs; }
function rpTab(k) {
  RP.sec = k;
  $$('#rp-form .pane').forEach((p) => (p.hidden = p.dataset.pane !== k));
  $$('#rp-nav button').forEach((b) => b.classList.toggle('on', b.dataset.t === k));
  const on = $(`#rp-nav button[data-t="${k}"]`); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  if (k === 'check') rpCheck();
  window.scrollTo(0, 0);
  rpAutosave.flush();
}
function rpNext() { const i = RP.secs.findIndex((s) => s[0] === RP.sec); if (i < RP.secs.length - 1) rpTab(RP.secs[i + 1][0]); }
function rpDirty() { if (!RP || !RP.editable) return; RP.dirty = true; $('#rp-state').textContent = '未保存の変更があります'; rpAutosave(); }
const rpAutosave = debounce(() => { if (RP && RP.dirty && RP.editable) rpSave(false, true); }, 4000);

/* 画面側でも提出前のチェックをする（サーバーでも同じ確認をする） */
function rpLocalErrors(d) {
  const e = []; const L = B.consts.LIMITS;
  const lim = (v, n, label, sec) => { if (Array.from(v || '').length > n) e.push([sec, `${label}が${n}字を超えています`]); };
  lim((d.info || {}).ops, L.ops, '運営上の問題点', 'info');
  (d.ki || []).forEach((k, i) => lim(k.text, L.ki, 'Key Incidents ' + (i + 1), 'ki'));
  B.consts.OFFICIAL_ROLES.filter((r) => r !== '第4審' && RP.crew[r].evaluated).forEach((role) => {
    const x = (d.s || {})[role] || {};
    $$(`#rp-form .pane[data-pane="${role}"] textarea[data-max]`).forEach((t) => { if (Array.from(t.value).length > Number(t.dataset.max)) e.push([role, `${role}：字数を超えている欄があります`]); });
    if (!x.diff || !x.perf) return e.push([role, `${role}：難易度と全体のパフォーマンスを選んでください`]);
    if (x.exception === '' && x.score === '') return e.push([role, `${role}：評価点を選んでください`]);
    const ad = x.exception !== '' ? Number(x.exception) : Number(x.score);
    if ((x.exception !== '' || ad < 8) && !String(x.note || '').trim()) e.push([role, `${role}：特記事項に理由を書いてください`]);
  });
  return e.filter((x, i) => e.findIndex((y) => y[1] === x[1]) === i);
}
function errSec(msg) {
  if (/^Key/.test(msg)) return 'ki';
  if (/^運営/.test(msg)) return 'info';
  if (/^第4/.test(msg)) return '第4審';
  const r = B.consts.OFFICIAL_ROLES.find((x) => msg.startsWith(x)); return r || 'check';
}
function rpMarkErrs(list) {
  const bad = new Set(list.map((x) => x[0]));
  $$('#rp-nav button').forEach((b) => b.classList.toggle('err', bad.has(b.dataset.t)));
}
function rpCheck() {
  const d = collectReport();
  const errs = rpLocalErrors(d);
  rpMarkErrs(errs);
  const roles = B.consts.OFFICIAL_ROLES.filter((r) => r !== '第4審' && RP.crew[r].evaluated);
  $('#rp-summary').innerHTML = `<div class="grid3">${roles.map((r) => { const x = (d.s || {})[r] || {}; const ad = x.exception !== '' && x.exception !== undefined ? x.exception : x.score; return `<div class="stat"><div class="k">${r}　${h(RP.crew[r].name)}</div><div class="v">${ad ? Number(ad).toFixed(1) : '—'}</div><div class="small muted">${h(x.diff || '難易度未選択')}・${h(x.perf || 'パフォーマンス未選択')}${x.exception ? '・例外' : ''}</div></div>`; }).join('')}</div>`;
  $('#rp-errs').innerHTML = errs.length ? `<div class="errs"><b>提出前に直すところ（${errs.length}件）</b><ul>${errs.map(([s, m]) => `<li><a href="#" onclick="rpTab('${s}');return false;">${h(m)}</a></li>`).join('')}</ul></div>`
    : '<div class="card pale"><span class="blue b">✓ 必須の項目はそろっています</span></div>';
}

ROUTES.report = async (matchId) => {
  const back = B.ctx.asr && !B.ctx.com ? ['assess'] : null;
  head('アセスメントレポート', back || ['c_reports']);
  RP = await call('api_reportGet', matchId);
  RP.id = matchId;
  if (!back) head('アセスメントレポート', ['c_reports', RP.match.ym]);
  const crew = RP.crew;
  const evalRoles = B.consts.OFFICIAL_ROLES.filter((r) => crew[r].evaluated);
  if (!RP.editable) {
    const d = RP.data || {}; const half = d.info && d.info.time ? Number(d.info.time) / 2 : 45;
    $('#tools').innerHTML = statusPill(RP.status);
    setMain(`${RP.status === '未作成' ? `<div class="card">${infoRO(RP.match, {}, RP.assessor, '')}</div>` + empty('まだ作成されていません') : `
      ${B.ctx.com && RP.status === '提出済' ? `<div class="row" style="margin-bottom:12px"><span class="small muted">提出 ${h(RP.submittedAt)}</span><span class="spacer"></span><button class="btn danger sm" onclick="rpRevert()">アセッサーに差し戻す</button></div>` : ''}
      <div class="card">${infoRO(RP.match, d.info || {}, RP.assessor, '')}</div>${videoBtns(RP.videos)}
      ${evalRoles.map((r) => `<div class="card">${sectionRO(r, (d.s || {})[r] || {}, crew[r].name)}</div>`).join('')}
      <div class="card">${kiRO(d.ki, RP.videos, half)}</div>
      ${d.p3 ? `<div class="card warn"><h2 style="margin-top:0">委員会への報告</h2><p class="small muted">審判員には表示されません</p><p class="pre">${h(d.p3)}</p></div>` : ''}`}`);
    return;
  }
  const L = B.consts.LIMITS;
  RP.secs = [['info', '試合情報'], ...evalRoles.map((r) => [r, r === '第4審' ? '第4の審判員' : r]), ['ki', 'Key Incidents'], ['p3', '委員会への報告'], ['check', '確認・提出']];
  RP.sec = 'info';
  const notEval = B.consts.OFFICIAL_ROLES.filter((r) => !crew[r].evaluated).map((r) => `${r}：${crew[r].kind === '地区派遣' ? '地区派遣のため評価しません' : '割当なし'}`).join('　');
  const sc = (k) => `<input type="number" inputmode="numeric" min="0" data-k="info.sc.${k}" oninput="rpTotals();rpDirty()">`;
  const nextBtn = (label) => `<div class="row" style="margin-top:8px"><span class="spacer"></span><button class="btn primary" onclick="rpNext()">次へ：${label} ›</button></div>`;
  const nextOf = (k) => { const i = RP.secs.findIndex((s) => s[0] === k); return RP.secs[i + 1][1]; };
  $('#tools').innerHTML = statusPill(RP.status);
  setMain(`<div class="row" style="margin-bottom:8px">${dateBox(RP.match.date)}<div style="flex:1;min-width:0"><div class="b">${card(RP.match)}</div><div class="small muted">${h(RP.match.comp)} ${h(RP.match.name)}／${h(RP.match.venue)}</div></div></div>
    <div class="secnav" id="rp-nav">${RP.secs.map(([k, l], i) => `<button data-t="${k}" class="${i ? '' : 'on'}" onclick="rpTab('${k}')">${l}</button>`).join('')}</div>
    <div id="rp-form" style="margin-top:12px">
      <div class="pane" data-pane="info">
        <div class="card"><div class="grid3"><div class="field"><label>記入日</label><input type="date" data-k="info.date" oninput="rpDirty()"></div>
        <div class="field"><label>試合時間（分）</label><input type="number" inputmode="numeric" data-k="info.time" placeholder="90" oninput="rpDirty()"></div>
        <div class="field"><label>延長（分）</label><input type="number" inputmode="numeric" data-k="info.ext" placeholder="なし" oninput="rpDirty()"></div></div></div>
        <div class="card"><div class="row" style="margin-bottom:8px"><h2 style="margin:0">試合結果</h2><span class="spacer"></span><span id="rp-total" class="bigscore" style="font-size:26px"></span></div>
          <table class="scoretbl" style="max-width:440px"><thead><tr><th></th><th>${h(RP.match.a)}</th><th>${h(RP.match.b)}</th></tr></thead><tbody>
          ${[['前半', '1'], ['後半', '2'], ['延長前半', 'e1'], ['延長後半', 'e2'], ['PK', 'pk']].map(([l, k]) => `<tr><td class="small muted" style="text-align:left">${l}</td><td>${sc('a' + k)}</td><td>${sc('b' + k)}</td></tr>`).join('')}</tbody></table></div>
        <div class="card"><div class="field" style="margin:0"><label>運営上の問題点</label>${ta('info.ops', L.ops)}</div></div>
        ${notEval ? `<p class="small muted">${notEval}</p>` : ''}
        ${nextBtn(nextOf('info'))}
      </div>
      ${evalRoles.map((r) => `<div class="pane" data-pane="${r}" hidden>${roleForm(r, crew[r])}${nextBtn(nextOf(r))}</div>`).join('')}
      <div class="pane" data-pane="ki" hidden><div class="card"><p class="small muted">重大な出来事（最大5項目）。時間を「35」「45+2」のように分で書くと、映像の場面へのリンクになります。</p>
        ${[0, 1, 2, 3, 4].map((i) => `<div class="item"><div class="row top" style="flex-wrap:nowrap"><div style="width:88px;flex:none"><label class="flabel">時間（分）</label><input data-k="ki.${i}.time" placeholder="45+2" oninput="rpDirty()"></div><div style="flex:1;min-width:0"><label class="flabel">内容 ${i + 1}</label>${ta(`ki.${i}.text`, L.ki, '', 72)}</div></div></div>`).join('')}</div>
        ${nextBtn(nextOf('ki'))}</div>
      <div class="pane" data-pane="p3" hidden><div class="card warn"><p class="small"><b class="red">審判員には表示されません。</b>退場などの重大な事態の報告、審判員に関する委員会への報告、事務連絡を書いてください。</p><textarea data-k="p3" style="min-height:200px" oninput="rpDirty()"></textarea></div>
        ${nextBtn(nextOf('p3'))}</div>
      <div class="pane" data-pane="check" hidden><h2 style="margin-top:0">評価点のまとめ</h2><div id="rp-summary"></div><div id="rp-errs" style="margin-top:12px"></div>
        <div class="card"><p class="small">提出すると、担当審判員と委員会にメールで届きます。<b>提出後は変更できません</b>（修正は委員会の差し戻しが必要です）。</p><button class="btn primary wide" onclick="rpSave(true)">提出する</button></div></div>
    </div>
    <div class="actionbar"><div class="in"><span class="msg" id="rp-state">${RP.status === '下書き' ? '下書きを保存済み' : ''}</span><button class="btn" onclick="rpSave(false)">途中保存</button><button class="btn primary" onclick="rpTab('check')">確認・提出へ</button></div></div>`);
  RP.form = RP.data || {};
  if (!getPath(RP.form, 'info.date')) setPath(RP.form, 'info.date', B.today);
  fillReport(RP.form);
  RP.dirty = false;
  LEAVE = () => { if (RP && RP.dirty && RP.editable) rpSave(false, true); };
  LEAVE.dirty = () => RP && RP.dirty;
};
async function rpSave(submit, auto) {
  rpAutosave.cancel();
  const data = collectReport();
  if (submit) {
    const local = rpLocalErrors(data);
    if (local.length) { rpTab('check'); toast('直すところがあります', true); return; }
    if (!confirm('提出すると担当審判員と委員会に届き、変更できなくなります。提出しますか？')) return;
  }
  const st = $('#rp-state');
  if (st) st.textContent = '保存中…';
  RP.dirty = false;
  try {
    const r = await call('api_reportSave', RP.id, data, submit);
    if (!r.ok) {
      const errs = r.errors.map((m) => [errSec(m), m]);
      rpMarkErrs(errs);
      if (RP.sec !== 'check') rpTab('check');
      $('#rp-errs').innerHTML = `<div class="errs"><b>提出前に直すところ（${errs.length}件）</b><ul>${errs.map(([s, m]) => `<li><a href="#" onclick="rpTab('${s}');return false;">${h(m)}</a></li>`).join('')}</ul></div>`;
      if (st) st.textContent = '下書きを保存済み';
      toast('入力内容を確認してください', true); return;
    }
    const t = new Date();
    if (st) st.innerHTML = `<span class="blue">✓</span> ${auto ? '自動保存' : '保存'}しました（${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}）`;
    if (!auto) toast(submit ? '提出しました' : '途中保存しました');
    if (!submit) $('#tools').innerHTML = statusPill('下書き');
    if (submit) { RP.dirty = false; LEAVE = null; go('report', RP.id); }
  } catch (e) { RP.dirty = true; if (st) st.innerHTML = '<span class="red">保存できませんでした</span>'; fail(e); }
}
async function rpRevert() {
  if (!confirm('このレポートを下書きに戻し、アセッサーが修正できるようにしますか？（年間評価の計算からも一時的に外れます）')) return;
  try { await call('api_reportRevert', RP.id); toast('差し戻しました'); go('report', RP.id); } catch (e) { fail(e); }
}

/* ───────── みんな：試合映像 ───────── */
let VL = [];
ROUTES.videos = async () => {
  head('試合映像', null, B.ctx.kind === 'member' ? `<button class="btn sm primary" onclick="vdAdd()">＋ 映像を登録</button>` : '');
  VL = await get('api_videos');
  if (!VL.length) return setMain(empty('映像はまだありません。<br>チームから届いた映像や、受け取った映像を「＋ 映像を登録」から登録できます。'));
  // 年ごとに分ける（試合日の年）。最初は映像のある一番新しい年
  const years = [...new Set(VL.map((v) => String((v.match && v.match.date) || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  if (!years.includes(VY)) VY = years[0] || '';
  setMain(`<div class="vfilter"><select id="vl-y" onchange="VY=this.value;VC='';vlComps();vlFilter()">${years.map((y) => `<option value="${y}" ${y === VY ? 'selected' : ''}>${y}年</option>`).join('')}<option value="" ${VY ? '' : 'selected'}>すべての年</option></select>
    <select id="vl-c" onchange="VC=this.value;vlFilter()"></select>
    <div class="search"><input id="vl-q" type="search" placeholder="チーム名でさがす" oninput="vlFilter()"></div></div><div id="vl"></div>`);
  vlComps(); vlFilter();
};
// 大会の選択肢（選んだ年にある大会だけ）
function vlComps() {
  const comps = [...new Set(VL.filter((v) => v.match && (!VY || String(v.match.date).startsWith(VY))).map((v) => v.match.comp || 'その他'))].sort();
  if (!comps.includes(VC)) VC = '';
  $('#vl-c').innerHTML = `<option value="">すべての大会</option>` + comps.map((c) => `<option ${c === VC ? 'selected' : ''}>${h(c)}</option>`).join('');
}
let VC = '';
let VY = '';
/* Veo の映像：区分ごとに「Veoで開く」。登録した人・委員会はここから直す・消す */
function veoSet(id) { const v = VL.find((x) => x.id === id); return v ? VL.filter((x) => x.veo && x.matchId === v.matchId && x.team === v.team).sort((a, b) => (B.consts.PARTS || []).indexOf(a.part) - (B.consts.PARTS || []).indexOf(b.part)) : []; }
function canEditV(p) { return B.ctx.com || (p.byId && p.byId === B.ctx.id); }
function veoOpen(id) {
  const set = veoSet(id); if (!set.length) return;
  const m = set[0].match;
  openModal({ title: `${m.a} 対 ${m.b}`, body: `<p class="small muted" style="margin-top:0">${h(m.comp)} ${h(m.name)}・${h(set[0].team)}提供</p>
    <div class="list">${set.map((p) => `<div class="li"><div class="main"><div class="t">${h(p.part)}</div></div>
      ${canEditV(p) ? `<button class="btn sm ghost" onclick="vdEdit('${p.id}')">直す</button><button class="btn sm ghost danger" onclick="veoDel('${p.id}')">削除</button>` : ''}
      <a class="btn sm primary" href="${h(p.url)}" target="_blank" rel="noopener">Veoで開く ↗</a></div>`).join('')}</div>
    <p class="small muted" style="margin-bottom:0">${h(VEO_NOTE)}</p>` });
}
async function veoDel(id) {
  const p = VL.find((x) => x.id === id);
  if (!p || !confirm(`この映像（${p.part}）の登録を削除しますか？`)) return;
  try { await call('api_delVideo', id, false); toast('削除しました'); closeModal(); go('videos'); } catch (e) { fail(e); }
}
/* メンバーが映像を登録する（チームから受け取った映像など） */
let VM = [];
async function vdAdd() {
  openModal({ title: '映像を登録', body: '<p class="loading">試合を読み込み中…</p>', foot: `<button class="btn" onclick="closeModal()">やめる</button><button class="btn primary" id="vd-save" onclick="vdSave()" disabled>登録する</button>` });
  try { VM = await get('api_videoMatches'); } catch (e) { closeModal(); return fail(e); }
  if ($('#modal').hidden) return;
  $('#modal .modal-body').innerHTML = VM.length ? `
    <div class="field"><label>試合</label><select id="vd-m" onchange="vdTeams()">${VM.map((m) => `<option value="${m.id}">${dl(m.date)}　${h(m.a)} 対 ${h(m.b)}（${h(m.comp)} ${h(m.name)}）</option>`).join('')}</select><div class="hint">今日までの試合が新しい順に並んでいます</div></div>
    <div class="field"><label>映像の出どころ</label><input id="vd-src" list="vd-teams" placeholder="例：北海FC（チームから受け取り）"><datalist id="vd-teams"></datalist><div class="hint">どこから届いた映像か（チーム名など）。映像の一覧に「○○提供」と表示されます</div></div>
    <div class="field"><label>区分</label><select id="vd-part">${(B.consts.PARTS || ['試合全体']).map((p) => `<option>${p}</option>`).join('')}</select><div class="hint">映像が前半・後半などに分かれているときは、1本ずつ区分を選んで登録してください。同じ出どころの映像は、見るときに区分の順につないで再生します</div></div>
    <div class="field"><label>YouTube か Veo の URL</label><input id="vd-url" type="url" inputmode="url" placeholder="https://youtu.be/... または Veo の共有リンク"><div class="hint">YouTube は「限定公開」の映像の URL、Veo は試合を「公開」にした共有リンクを貼り付けてください。${h(VEO_NOTE)}</div></div>`
    : empty('登録できる試合がありません（今日までの試合が対象です）');
  if (VM.length) { $('#vd-save').disabled = false; vdTeams(); }
}
function vdTeams() { const m = VM.find((x) => x.id === $('#vd-m').value); $('#vd-teams').innerHTML = m ? [m.a, m.b].map((t) => `<option value="${h(t)}">`).join('') : ''; }
async function vdSave() {
  const url = $('#vd-url').value.trim(), src = $('#vd-src').value.trim();
  if (!src) return toast('映像の出どころを入力してください', true);
  if (!url) return toast('YouTube か Veo の URL を貼り付けてください', true);
  $('#vd-save').disabled = true;
  try { const r = await call('api_addVideo', $('#vd-m').value, src, url, $('#vd-part').value); toast('登録しました'); closeModal(); r.veo ? go('videos') : go('video', r.id); }
  catch (e) { $('#vd-save').disabled = false; fail(e); }
}
async function vdDel(id) {
  const p = TL.parts[tlIdx(id)];
  const nCase = VD.cases.filter((c) => c.videoId === id).length;
  if (nCase && !VD.com) return toast(`この映像は事例ライブラリで${nCase}件使われているため削除できません。委員会に相談してください`, true);
  const msg = `この映像（${p.part}）の登録を削除しますか？\nついているコメントも消えます。` + (nCase ? `\n事例ライブラリの事例 ${nCase}件 も一緒に消えます。` : '');
  if (!confirm(msg)) return;
  try {
    await call('api_delVideo', id, nCase > 0); toast('削除しました');
    const rest = TL.parts.filter((x) => x.id !== id);
    closeModal();
    if (rest.length) go('video', rest[0].id); else go('videos');
  } catch (e) { fail(e); }
}
function vlFilter() {
  const q = ($('#vl-q') || {}).value || '';
  // 同じ試合・同じ出どころの映像（前半・後半など）は1行にまとめる
  const PARTS = B.consts.PARTS || [], sets = [];
  VL.forEach((v) => { let s = sets.find((x) => x.matchId === v.matchId && x.team === v.team && x.veo === !!v.veo); if (!s) sets.push((s = { matchId: v.matchId, team: v.team, veo: !!v.veo, match: v.match, parts: [], comments: 0 })); s.parts.push(v); s.comments += v.comments; });
  sets.forEach((s) => s.parts.sort((a, b) => PARTS.indexOf(a.part) - PARTS.indexOf(b.part)));
  const list = sets.filter((s) => (!VY || String(s.match.date).startsWith(VY)) && (!VC || (s.match.comp || 'その他') === VC) && (!q || [s.match.comp, s.match.a, s.match.b, s.team, s.match.name].join(' ').includes(q)))
    .sort((a, b) => String(b.match.date).localeCompare(String(a.match.date)));
  // 1試合1行：日付・対戦・試合名／出どころ・区分・コメント数（サムネイルなしで一覧性を優先）
  const cardOf = (s) => { const m = s.match, p0 = s.parts[0];
    return `<a href="#" class="vrow" onclick="${s.veo ? `veoOpen('${p0.id}')` : `go('video','${p0.id}')`};return false;">
      <span class="vdate">${m.date ? `${Number(m.date.slice(5, 7))}/${Number(m.date.slice(8, 10))}<small>${wd(m.date)}</small>` : ''}</span>
      <span class="vbody"><span class="vteams">${h(m.a)}<span>対</span>${h(m.b)}</span>
        <span class="vmeta">${h(m.name)}${m.name ? '・' : ''}${h(s.team)}提供${s.parts.length > 1 ? '・' + s.parts.map((p) => h(p.part)).join('／') : ''}</span></span>
      ${s.veo ? '<span class="vveo">Veo</span>' : ''}${s.comments ? `<span class="vcm">💬 ${s.comments}</span>` : ''}<span class="vgo">›</span></a>`; };
  // 大会ごとに見出しを付けて並べる（大会を1つ選んだときは見出しなし）
  const groups = [];
  list.forEach((s) => { const c = s.match.comp || 'その他'; let g = groups.find((x) => x.c === c); if (!g) groups.push((g = { c, items: [] })); g.items.push(s); });
  $('#vl').innerHTML = !list.length ? empty('見つかりませんでした') : VC ? `<div class="vlist">${list.map(cardOf).join('')}</div>`
    : groups.map((g) => `<div class="vgroup"><h2>${h(g.c)}<span>${g.items.length}試合</span></h2><div class="vlist">${g.items.map(cardOf).join('')}</div></div>`).join('');
}

/* ───── 分かれた映像を1本のようにつなぐ（同じ試合・同じ出どころの映像を区分の順に続けて再生） ─────
   T＝つないだ全体での秒。各映像の長さ（dur）が分かれば、映像ID＋その映像の秒 ⇔ T を行き来できる */
let TL = null, TL_TIMER = null;
function tlBuild(parts) {
  const off = []; let acc = 0;
  parts.forEach((p, i) => { off[i] = acc; acc = acc === null || !p.dur ? null : acc + p.dur; });
  return { parts, off, cur: 0, rate: 1 };
}
function tlIdx(id, tl = TL) { return tl.parts.findIndex((p) => p.id === id); }
function tlTotal(tl = TL) { const i = tl.parts.length - 1; return tl.off[i] !== null && tl.parts[i].dur ? tl.off[i] + tl.parts[i].dur : null; }
function toT(id, local, tl = TL) { const i = tlIdx(id, tl); return i >= 0 && tl.off[i] !== null ? tl.off[i] + local : null; }
function fromT(t, tl = TL) {
  for (let i = tl.parts.length - 1; i >= 0; i--) if (tl.off[i] !== null && t >= tl.off[i]) return { i, id: tl.parts[i].id, local: t - tl.off[i] };
  return { i: 0, id: tl.parts[0].id, local: Math.max(0, t) };
}
// キックオフ・後半開始の位置（T）
function tlMarks(tl = TL) {
  const m = { ko: null, h2: null };
  tl.parts.forEach((p) => { if (p.ko !== null) m.ko = toT(p.id, p.ko, tl); if (p.h2 !== null) m.h2 = toT(p.id, p.h2, tl); });
  return m;
}
function nowT() { const y = ytOf('main'); if (!y || !TL) return null; return toT(TL.parts[TL.cur].id, y.getCurrentTime()); }
function nowLocal() { const y = ytOf('main'); return { id: TL.parts[TL.cur].id, local: y ? Math.floor(y.getCurrentTime()) : 0 }; }
function seekPart(id, local) {
  const y = ytOf('main'); if (!y || !TL) return;
  const i = tlIdx(id); if (i < 0) return;
  if (i === TL.cur) { y.seekTo(local, true); y.playVideo(); }
  else { TL.cur = i; y.loadVideoById({ videoId: TL.parts[i].yt, startSeconds: local }); }
  tlDraw();
}
function seekT(t) { const p = fromT(t); seekPart(p.id, p.local); }
function tlOnState(st) {
  const y = ytOf('main'); if (!y || !TL) return;
  if (st === 1) {   // 再生が始まった：速度を戻し、長さが分からなければ記録（全画面なら操作を消すタイマーを始める）
    if (!$(".pstick.fs.idle")) pokeCtl();
    if (TL.rate !== 1) y.setPlaybackRate(TL.rate);
    const p = TL.parts[TL.cur], d = Math.round(y.getDuration() || 0);
    const vid = y.getVideoData ? (y.getVideoData() || {}).video_id : p.yt;   // 別の動画が流れているときは記録しない
    if (vid === p.yt && d > 0 && Math.abs((p.dur || 0) - d) > 1) tlSetDur(p, d);
  }
  if (st === 0 && TL.cur < TL.parts.length - 1) seekPart(TL.parts[TL.cur + 1].id, 0);   // 終わったら次の映像へ
}
function tlSetDur(p, d) {
  p.dur = d; const cur = TL.cur; TL = Object.assign(tlBuild(TL.parts), { cur, rate: TL.rate });
  call('api_setDuration', p.id, d).catch(() => {});
  tlDraw(true); renderComments(); renderCaseArea(); renderMarks(); renderParts();
}
/* 長さが分からない映像は、見えないプレーヤーで少しだけ読み込んで長さを調べる（初回だけ） */
async function tlProbe() {
  for (const p of TL ? TL.parts.filter((x) => !x.dur) : []) {
    if (!TL || !window.YT || !YT.Player) return;
    const d = await new Promise((res) => {
      const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-9999px;top:0;width:200px;height:120px';
      const el = document.createElement('div'); box.appendChild(el); document.body.appendChild(box);
      let pl = null; const done = (v) => { clearTimeout(tm); try { pl && pl.destroy(); } catch (e) {} box.remove(); res(v); };
      const tm = setTimeout(() => done(0), 10000);
      const read = () => { const v = pl && pl.getDuration ? Math.round(pl.getDuration()) : 0; if (v > 0) done(v); return v > 0; };
      pl = new YT.Player(el, { videoId: p.yt, playerVars: { mute: 1, playsinline: 1, controls: 0, origin: location.origin },
        events: { onReady: () => { if (!read()) { pl.mute(); pl.playVideo(); } }, onStateChange: (e) => { if (e.data === 1) read(); } } });
    });
    if (d > 0 && TL && TL.parts.includes(p)) tlSetDur(p, d);
  }
}
// 映像の下の「試合全体のバー」
function tlBarHtml() { return `<div class="tl" id="tl"><div class="tl-track" id="tl-track" onclick="tlClick(event)"></div><div class="tl-info small"><span id="tl-now"></span><span class="spacer"></span><span id="tl-total" class="muted"></span></div></div>`; }
function tlDraw(full) {
  if (!TL || !$('#tl-track')) return;
  const total = tlTotal(), n = TL.parts.length;
  if (full || !$('#tl-track').children.length) {
    $('#tl-track').innerHTML = TL.parts.map((p, i) => `<div class="tl-seg ${i === TL.cur ? 'on' : ''}" style="flex:${total ? p.dur : 1}" title="${h(p.part)}"><span>${n > 1 ? h(p.part) : ''}</span></div>`).join('') + '<i id="tl-pos"></i>';
    const mk = tlMarks();
    ['ko', 'h2'].forEach((k) => { if (total && mk[k] !== null) $('#tl-track').insertAdjacentHTML('beforeend', `<b class="tl-mark" style="left:${(mk[k] / total) * 100}%" title="${k === 'ko' ? 'キックオフ' : '後半開始'}"></b>`); });
  }
  $$('#tl-track .tl-seg').forEach((el, i) => el.classList.toggle('on', i === TL.cur));
  const t = nowT();
  if (total && t !== null) $('#tl-pos').style.left = Math.min(100, (t / total) * 100) + '%';
  const mt = t !== null ? tToMatch(t) : '';
  $('#tl-now').innerHTML = t === null ? '映像の長さを読み込み中…' : `${mt ? `<b class="blue">試合 ${mt}</b>　` : ''}全体 ${fmtSec(t)}${n > 1 ? `　<span class="muted">（${h(TL.parts[TL.cur].part)}）</span>` : ''}`;
  $('#tl-total').textContent = total ? '/ ' + fmtSec(total) + (n > 1 ? `（${n}本をつないで再生）` : '') : (n > 1 ? `${n}本をつないで再生` : '');
}
function tlClick(e) {
  const total = tlTotal(); if (!total) return toast('映像の長さを読み込み中です。少し待ってください');
  const r = $('#tl-track').getBoundingClientRect();
  seekT(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * total);
}

/* 試合の時間 ⇔ T（キックオフ位置・後半開始位置を基準にする。前後半は45分で計算）
   試合の時間は「24:06」「45+2:10」「67:30」の形。映像の 5:24 がキックオフなら、試合の 24:06 → 映像の 29:30 */
const HALF = 45 * 60;
function matchToVideo(str, v) {
  const m = String(str || '').trim().replace(/[：]/g, ':').replace(/[＋]/g, '+').match(/^(\d+)(?:\+(\d+))?:(\d{1,2})$/);
  if (!m || (v.ko === null && v.h2 === null)) return null;
  const base = Number(m[1]), extra = m[2] !== undefined ? Number(m[2]) : null, sec = Number(m[3]);
  const t = (base + (extra || 0)) * 60 + sec;
  const second = extra !== null ? base > 45 : t >= HALF;
  if (!second) return v.ko === null ? undefined : v.ko + t;
  if (v.h2 === null) return undefined;           // 後半の時間なのに後半開始位置がない
  return v.h2 + (t - HALF);
}
function videoToMatch(sec, v) {
  const mm = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  if (v.h2 !== null && sec >= v.h2) { const t = HALF + (sec - v.h2); return t >= 2 * HALF ? '90+' + mm(t - 2 * HALF) : mm(t); }
  if (v.ko === null) return '';
  const t = sec - v.ko;
  if (t < 0) return '0:00';
  return t >= HALF && v.h2 !== null ? '45+' + mm(t - HALF) : mm(t);
}
function tToMatch(t) { return videoToMatch(t, tlMarks()); }
function aligned() { const m = tlMarks(); return m.ko !== null || m.h2 !== null; }
// コメント・事例の時間の表示（試合の時間が分かればそれ、なければ映像の区分＋秒）
function timeLabel(id, local) {
  const t = toT(id, local);
  if (t !== null && aligned()) return '試合 ' + tToMatch(t);
  const p = TL.parts[tlIdx(id)];
  return (TL.parts.length > 1 && p ? p.part + ' ' : '') + fmtSec(local);
}
function sortKey(id, local) { const t = toT(id, local); return t !== null ? t : tlIdx(id) * 1e6 + local; }

let VD = null;
ROUTES.video = async (arg) => {
  head('試合映像', ['videos']);
  const [vid, at] = String(arg || '').split('@');
  VD = await call('api_video', vid);
  const v = VD.video, m = VD.match;
  const parts = VD.parts && VD.parts.length ? VD.parts : [v];
  const crew = B.consts.OFFICIAL_ROLES.map((r) => VD.crew[r].name ? `<span class="tag">${r}　${h(VD.crew[r].name)}</span>` : '').join('');
  setMain(`<div class="vlayout"><div class="vleft">
      <div class="pstick"><div id="player-anchor" class="player"><div id="yt-main"></div><div class="ptap" onclick="tapCtl()" onpointermove="if(event.pointerType==='mouse')pokeCtl()"></div></div><div class="pctl" onpointerdown="pokeCtl()">${tlBarHtml()}${playerBar('main')}</div></div>
      <div style="margin:12px 0"><div class="b" style="font-size:17px">${card(m)}</div><div class="small muted">${dl(m.date)} ${h(m.ko)}　${h(m.comp)} ${h(m.name)}／${h(m.venue)}／${h(v.team)}提供${v.by ? `（${h(v.by)}さんが登録）` : ''}</div>
      <div id="parts" style="margin-top:6px"></div>
      ${VD.others.length || (VD.veo || []).length ? `<div style="margin-top:6px">${VD.others.map((o) => `<button class="btn sm" onclick="go('video','${o.id}')">${h(o.team)}提供の映像に切り替え</button>`).join(' ')} ${(VD.veo || []).map((o) => veoBtn(o, `Veoで見る（${h(o.team)}提供・${h(o.part)}）`)).join(' ')}</div>` : ''}
      <div style="margin-top:8px">${crew}</div></div>
    </div><div class="vright">
      <div id="marks"></div>
      <div id="case-area"></div>
      <div class="card" style="padding:0">
        <div class="row" style="padding:12px 16px;border-bottom:1px solid var(--line)"><h2 style="margin:0">コメント</h2><span class="spacer"></span>${VD.canComment ? `<button class="btn sm primary" onclick="cmOpen()">＋ 今の場面にコメント</button>` : ''}</div>
        <div id="cm-form"></div>
        <div id="cm-filter" style="padding:8px 12px 0"></div>
        <div class="clist" id="clist"></div>
      </div>
    </div></div>`);
  TL = tlBuild(parts); TL.cur = Math.max(0, tlIdx(v.id));
  renderParts(); renderMarks(); renderComments(); renderCaseArea(); tlDraw(true);
  await mountPlayer('main', 'yt-main', TL.parts[TL.cur].yt, { start: at ? Number(at) : 0, onState: tlOnState, noControls: true });
  clearInterval(TL_TIMER); TL_TIMER = setInterval(() => tlDraw(), 500);
  tlProbe();
};
// この組の映像（区分ごと）。押すとその映像の頭から。登録した人・委員会は「登録を直す」から直せる・消せる
function canEditVideo(p) { return VD.com || (p.byId && p.byId === VD.me); }
function renderParts() {
  if (!$('#parts')) return;
  const edit = TL.parts.some(canEditVideo);
  $('#parts').innerHTML = (TL.parts.length > 1 ? TL.parts.map((p) => `<span class="tag" style="padding:2px 10px"><a href="#" onclick="seekPart('${p.id}',0);return false;">${h(p.part)}${p.dur ? ' ' + fmtSec(p.dur) : ''}</a></span>`).join('') : '')
    + (edit ? `<a href="#" class="small" style="margin-left:4px" onclick="vdFix();return false;">登録を直す</a>` : '');
}
/* 登録を直す：この組の映像の一覧 → 1本ずつ「直す」「削除」 */
function vdFix() {
  openModal({ title: '映像の登録を直す', body: `<p class="small muted">間違えて登録した映像は、試合・出どころ・区分・URL を直すか、削除できます。</p>
    <div class="list">${TL.parts.map((p) => `<div class="li"><div class="main"><div class="t">${h(p.part)}</div><div class="s">${h(p.url || p.yt)}</div></div>
      ${canEditVideo(p) ? `<button class="btn sm" onclick="vdEdit('${p.id}')">直す</button><button class="btn sm danger" onclick="vdDel('${p.id}')">削除</button>` : '<span class="small muted">登録した人か委員会が直せます</span>'}</div>`).join('')}</div>` });
}
async function vdEdit(id) {
  const onPage = TL && tlIdx(id) >= 0, p = onPage ? TL.parts[tlIdx(id)] : VL.find((x) => x.id === id), match = onPage ? VD.match : p.match;
  $('#modal .modal-body').innerHTML = '<p class="loading">読み込み中…</p>';
  $('#modal .modal-foot') && $('#modal .modal-foot').remove();
  try { VM = await get('api_videoMatches'); } catch (e) { return fail(e); }
  const ms = VM.some((m) => m.id === match.id) ? VM : [match].concat(VM);
  $('#modal .modal-body').innerHTML = `
    <div class="field"><label>試合</label><select id="ve-m">${ms.map((m) => `<option value="${m.id}" ${m.id === match.id ? 'selected' : ''}>${dl(m.date)}　${h(m.a)} 対 ${h(m.b)}（${h(m.comp)} ${h(m.name)}）</option>`).join('')}</select></div>
    <div class="field"><label>映像の出どころ</label><input id="ve-src" value="${h(p.team || (onPage && VD.team) || '')}"><div class="hint">同じ試合・同じ出どころの映像が、つないで再生する1組になります</div></div>
    <div class="field"><label>区分</label><select id="ve-part">${(B.consts.PARTS || ['試合全体']).map((x) => `<option ${x === p.part ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
    <div class="field"><label>YouTube か Veo の URL</label><input id="ve-url" type="url" value="${h(p.url || '')}"><div class="hint">URL を別の動画に変えると、その映像のキックオフ・後半開始の位置は設定し直しになります</div></div>`;
  $('#modal .modal-head h2').textContent = p.part + 'の登録を直す';
  $('#modal .modal-box').insertAdjacentHTML('beforeend', `<div class="modal-foot"><button class="btn" onclick="${onPage ? 'vdFix()' : `veoOpen('${id}')`}">戻る</button><button class="btn primary" onclick="vdEditSave('${id}')">保存</button></div>`);
}
async function vdEditSave(id) {
  const x = { matchId: $('#ve-m').value, source: $('#ve-src').value.trim(), part: $('#ve-part').value, url: $('#ve-url').value.trim() };
  if (!x.source) return toast('映像の出どころを入力してください', true);
  if (!x.url) return toast('YouTube か Veo の URL を貼り付けてください', true);
  try { const r = await call('api_editVideo', id, x); toast('直しました'); closeModal(); r.veo ? go('videos') : go('video', id); } catch (e) { fail(e); }
}
function renderMarks() {
  if (!$('#marks') || !TL) return;
  const edit = VD.canCase, mk = tlMarks();
  const where = (k) => { const p = TL.parts.find((x) => x[k] !== null); return p ? (TL.parts.length > 1 ? `<span class="small muted">（${h(p.part)} ${fmtSec(p[k])}）</span>` : '') : ''; };
  const row = (k, label) => { const p = TL.parts.find((x) => x[k] !== null);
    return `<div class="row" style="flex:1 1 100%"><span class="small muted" style="width:72px;white-space:nowrap">${label}</span><b class="num">${!p ? '<span class="muted">未設定</span>' : `<a href="#" onclick="seekPart('${p.id}',${p[k]});return false;">${mk[k] !== null ? fmtSec(mk[k]) : fmtSec(p[k])}</a>`}</b>${where(k)}
    ${edit ? `<button class="btn sm ghost" onclick="setMark('${k}')">今の位置にする</button>` : ''}</div>`; };
  $('#marks').innerHTML = `<div class="card">
    <div class="row">${row('ko', 'キックオフ')}${row('h2', '後半開始')}</div>
    <div class="small muted" style="margin-top:4px">この2つが設定されていると、試合の時間（24:06 など）で場面を探したり、レポートのKey Incidents（分）から映像へ飛べます。${TL.parts.length > 1 ? '映像が分かれていても、全体で1回ずつ設定すれば大丈夫です。' : ''}</div></div>`;
}
async function setMark(k) {
  const n = nowLocal();
  try {
    await call('api_setMark', n.id, k, n.local);
    TL.parts.forEach((p) => (p[k] = p.id === n.id ? n.local : null));
    renderMarks(); renderComments(); renderCaseArea(); tlDraw(true); toast('設定しました');
  } catch (e) { fail(e); }
}
let CM_FILTER = '';
function renderComments() {
  if (!$('#clist') || !TL) return;
  const targets = [...new Set(VD.comments.map((c) => c.target).filter(Boolean))];
  $('#cm-filter').innerHTML = targets.length > 1 ? ['', ...targets].map((t) => `<button class="chip ${CM_FILTER === t ? 'on' : ''}" onclick="CM_FILTER='${t}';renderComments()">${t || 'すべて'}</button>`).join('') : '';
  const list = VD.comments.filter((c) => !CM_FILTER || c.target === CM_FILTER).sort((a, b) => sortKey(a.videoId, a.sec) - sortKey(b.videoId, b.sec));
  $('#clist').innerHTML = list.length ? list.map((c) => `<div class="citem" onclick="seekPart('${c.videoId}',${c.sec})">
      <div class="row" style="gap:6px"><span class="ctime">▶ ${timeLabel(c.videoId, c.sec)}</span>${c.target ? `<span class="pill">${h(c.target)}</span>` : ''}${c.eval ? `<span class="pill ${c.eval === '良い' ? 'ok' : 'ng'}">${h(c.eval)}</span>` : ''}${c.cat ? `<span class="small muted">${h(c.cat)}</span>` : ''}</div>
      <div class="pre" style="margin-top:4px">${h(c.text)}</div>
      <div class="small muted">${h(c.by)}　${h(c.at)}${(c.byId === VD.me || VD.com) ? `　<a href="#" onclick="event.stopPropagation();cmDel('${c.id}');return false;">削除</a>` : ''}</div></div>`).join('')
    : `<p class="muted small" style="padding:12px 16px;margin:0">コメントはまだありません。${VD.canComment ? '映像を止めたところで「＋ 今の場面にコメント」を押すと、その時間で書けます。' : ''}</p>`;
}
function catOptions(target) {
  const C = B.consts;
  const list = target === '主審' ? C.REF_ITEMS : (target === '副審1' || target === '副審2') ? C.AR_ITEMS : [];
  return '<option value="">分類なし</option>' + list.map((x) => `<option>${x.k} ${h(x.t)}</option>`).join('');
}
/* 時間の入力欄：試合の時間が使えればそれ（24:06）、なければ全体の時間、それもなければ今の映像の時間 */
function tMode() { return aligned() ? 'match' : tlTotal() !== null || TL.parts.length === 1 ? 'all' : 'part'; }
function fmtIn(id, local) { const t = toT(id, local); const m = tMode(); return m === 'match' && t !== null ? tToMatch(t) : m !== 'part' && t !== null ? fmtSec(t) : fmtSec(local); }
// 入力 → {id, local}。エラーは文字列で返す
/* 前半・後半を選んで入れた時間を、試合の時間の形にそろえる
   前半：「24:06」、45分を過ぎたら「45+2:10」。後半：「10:00」（後半10分）でも「55:00」でも、「90+1:05」でもよい */
function halfTime(str, half) {
  const m = String(str || '').trim().replace(/[：]/g, ':').replace(/[＋]/g, '+').match(/^(\d+)(?:\+(\d+))?:(\d{1,2})$/);
  if (!m || !half) return str;
  let base = Number(m[1]); const plus = m[2] !== undefined, ss = m[3].padStart(2, '0');
  if (half === '後半' && !plus && base < 45) base += 45;
  if (half === '前半' && !plus && base >= 45) return '45+' + (base - 45) + ':' + ss;
  if (half === '後半' && !plus && base >= 90) return '90+' + (base - 90) + ':' + ss;
  return plus ? base + '+' + m[2] + ':' + ss : base + ':' + ss;
}
function parseIn(str, half) {
  const m = tMode();
  let t;
  if (m === 'match') { t = matchToVideo(halfTime(str, half), tlMarks()); if (t === undefined) return '後半の時間です。先に「後半開始」の位置を設定してください'; if (t === null) return '時間は「24:06」「45+2:10」の形で入力してください'; }
  else { t = parseSec(str); if (t === null) return '時間は 12:34 の形で入力してください'; if (m === 'part') return { id: TL.parts[TL.cur].id, local: t }; }
  if (t < 0) return 'この映像には入っていない時間です';
  const p = fromT(t); return { id: p.id, local: Math.round(p.local) };
}
function inLabel() { const m = tMode(); return m === 'match' ? '（試合の時間）' : m === 'all' ? '（映像の時間）' : `（${h(TL.parts[TL.cur].part)}の時間）`; }
function inHint(str, half) { const r = parseIn(str, half); return typeof r === 'string' ? `<span class="red">${r}</span>` : tMode() === 'match' ? `${half ? '試合 ' + h(halfTime(str, half)) + '　→　' : ''}映像では ${TL.parts.length > 1 ? h(TL.parts[tlIdx(r.id)].part) + ' ' : ''}${fmtSec(r.local)}` : ''; }

let CMF = { target: '主審', eval: '' };
function cmOpen() {
  pausePlayer();
  const n = nowLocal();
  const chips = (k, list) => list.map((x) => `<button type="button" class="chip ${CMF[k] === x ? 'on' : ''}" onclick="CMF.${k}=CMF.${k}==='${x}'&&'${k}'==='eval'?'':'${x}';cmChips()">${x}</button>`).join('');
  window.cmChips = () => {
    $('#cm-tg').innerHTML = chips('target', ['主審', '副審1', '副審2', '第4審', 'チーム全体']);
    $('#cm-ev').innerHTML = chips('eval', ['良い', '課題']);
    const cur = $('#cm-cat').value; $('#cm-cat').innerHTML = catOptions(CMF.target); $('#cm-cat').value = [...$('#cm-cat').options].some((o) => o.value === cur) ? cur : '';
    $('#cm-cat').hidden = !/主審|副審/.test(CMF.target);
  };
  $('#cm-form').innerHTML = `<div style="padding:12px 16px;background:var(--pale);border-bottom:1px solid var(--line)">
    <div class="row" style="margin-bottom:2px"><span class="flabel" style="margin:0">時間 <span class="small muted">${inLabel()}</span></span><input id="cm-t" value="${fmtIn(n.id, n.local)}" class="w-s num" oninput="$('#cm-t-p').innerHTML=inHint(this.value)"><button class="btn sm ghost" onclick="const n=nowLocal();$('#cm-t').value=fmtIn(n.id,n.local);$('#cm-t-p').innerHTML=inHint($('#cm-t').value)">今の位置</button></div>
    <div class="hint" id="cm-t-p" style="margin-bottom:8px"></div>
    <div class="flabel">だれについて</div><div id="cm-tg"></div>
    <select id="cm-cat" style="margin-bottom:8px"></select>
    <div class="flabel">評価</div><div id="cm-ev"></div>
    <textarea id="cm-text" placeholder="コメント"></textarea>
    <div class="row" style="margin-top:8px"><span class="spacer"></span><button class="btn sm" onclick="$('#cm-form').innerHTML=''">やめる</button><button class="btn sm primary" onclick="cmSave()">追加する</button></div></div>`;
  cmChips();
  $('#cm-t-p').innerHTML = inHint($('#cm-t').value);
  $('#cm-text').focus();
}
async function cmSave() {
  const r = parseIn($('#cm-t').value);
  if (typeof r === 'string') return toast(r, true);
  if (!$('#cm-text').value.trim()) return toast('コメントを書いてください', true);
  try {
    VD.comments = await call('api_addComment', r.id, { sec: r.local, target: CMF.target, cat: /主審|副審/.test(CMF.target) ? $('#cm-cat').value : '', eval: CMF.eval, text: $('#cm-text').value });   // 組全体のコメントが返る
    $('#cm-form').innerHTML = ''; renderComments(); toast('追加しました');
  } catch (e) { fail(e); }
}
async function cmDel(id) {
  if (!confirm('このコメントを削除しますか？')) return;
  try { await call('api_delComment', id); VD.comments = VD.comments.filter((c) => c.id !== id); renderComments(); } catch (e) { fail(e); }
}
function caseTime(c) { return `${timeLabel(c.videoId, c.start)}〜${fmtIn(c.videoId, c.end)}`; }

function renderCaseArea() {
  if (!$('#case-area') || !TL) return;
  const list = VD.cases.slice().sort((a, b) => sortKey(a.videoId, a.start) - sortKey(b.videoId, b.start)).map((c) => `<div class="citem" onclick="seekPart('${c.videoId}',${c.start})"><div class="row" style="gap:6px"><span class="ctime">▶ ${caseTime(c)}</span><span class="spacer"></span>
      ${c.byId === VD.me || VD.com ? `<a href="#" class="small" onclick="event.stopPropagation();caseEdit('${c.id}');return false;">編集</a><a href="#" class="small" style="color:var(--accent);margin-left:10px" onclick="event.stopPropagation();caseDelHere('${c.id}');return false;">削除</a>` : ''}</div>
      <b>${h(c.title)}</b><div>${c.tags.map((t) => `<span class="tag">${h(t)}</span>`).join('')}</div></div>`).join('');
  if (!list && !VD.canCase) { $('#case-area').innerHTML = ''; return; }
  const open = $('#case-form') && $('#case-form').innerHTML;
  if (open) return;   // 入力中は描き直さない
  $('#case-area').innerHTML = `<div class="card" style="padding:0"><div class="row" style="padding:12px 16px;border-bottom:1px solid var(--line)"><h2 style="margin:0">この映像の事例</h2><span class="spacer"></span>${VD.canCase ? `<button class="btn sm" onclick="caseForm()">＋ 事例に登録</button>` : ''}</div>
    <div id="case-form"></div>${list || '<p class="muted small" style="padding:12px 16px;margin:0">登録された事例はありません。</p>'}</div>`;
}
let CS_HALF = '前半';
// 事例の時間：試合の時間で、前半・後半ごとの表示（後半は 45:00 からの時計のまま）
function halfOf(id, local) { const t = toT(id, local), mk = tlMarks(); return t !== null && mk.h2 !== null && t >= mk.h2 ? '後半' : '前半'; }
function csHalf(hf) { CS_HALF = hf; $$('#cs-half button').forEach((b) => b.classList.toggle('on', b.dataset.h === hf)); csPreview(); }
function caseFormHtml(x, withTimes) {
  const tags = B.consts.tags;
  const al = withTimes && aligned();
  if (al) CS_HALF = halfOf(x.videoId, x.start);
  const timeField = (k, label, id, local) => `<div class="field"><label>${label} <span class="small muted">${al ? '（試合の時間）' : inLabel()}</span></label><div class="row" style="flex-wrap:nowrap"><input id="cs-${k}" value="${fmtIn(id, local)}" class="num" inputmode="numeric" oninput="csPreview()"><button class="btn sm ghost" onclick="const n=nowLocal();$('#cs-${k}').value=fmtIn(n.id,n.local);${al ? "csHalf(halfOf(n.id,n.local));" : ''}csPreview()">今の位置</button></div><div class="hint" id="cs-${k}-p"></div></div>`;
  return `<div style="padding:12px 16px;background:var(--pale);border-bottom:1px solid var(--line)">
    ${withTimes ? `${al ? `<div class="field"><label>前半・後半</label><div class="seg sm" id="cs-half" style="max-width:260px">${['前半', '後半'].map((hf) => `<button type="button" data-h="${hf}" class="${CS_HALF === hf ? 'on' : ''}" onclick="csHalf('${hf}')">${hf}</button>`).join('')}</div>
      <div class="hint">実際の試合の時間を入れると、その場面を映像から抜き出します。前半は「24:06」（45分を過ぎたら「45+2:10」）、後半は「10:00」（後半10分）でも「55:00」でもかまいません。</div></div>`
      : '<p class="small muted" style="margin:0 0 8px">映像の時間で入力します。右上の「キックオフ」「後半開始」の位置を設定すると、前半・後半を選んで実際の試合の時間で入力できます。</p>'}
    <div class="grid2">${timeField('s', '開始', x.videoId, x.start)}${timeField('e', '終了', x.videoId, x.end)}</div>` : ''}
    <div class="field"><label>タイトル</label><input id="cs-title" value="${h(x.title || '')}" placeholder="例：PA内での接触、PKの判断"></div>
    <div class="field"><label>テーマ（複数可）</label><div id="cs-tags">${tags.map((t) => `<button type="button" class="chip ${(x.tags || []).includes(t) ? 'on' : ''}" onclick="this.classList.toggle('on')">${h(t)}</button>`).join('')}</div></div>
    <div class="field"><label>正しい判定</label><input id="cs-correct" value="${h(x.correct || '')}" placeholder="例：直接FK＋警告"></div>
    <div class="field"><label>解説</label><textarea id="cs-text">${h(x.text || '')}</textarea></div>
    <div class="field"><label>研修資料のURL（任意）</label><input id="cs-mat" value="${h(x.material || '')}" placeholder="GoogleドライブのPDFやスライドなど"></div>
    <p class="small muted">事例ライブラリでは、担当審判員の名前は表示されません。</p>
    <div class="row"><span class="spacer"></span><button class="btn sm" onclick="this.closest('#case-form').innerHTML='';renderCaseArea()">やめる</button><button class="btn primary sm" onclick="caseSave('${x.id || ''}','${x.videoId || ''}',${withTimes ? 'null' : x.start},${withTimes ? 'null' : x.end})">保存</button></div></div>`;
}
function csPreview() { const hf = $('#cs-half') ? CS_HALF : ''; ['s', 'e'].forEach((k) => { const el = $('#cs-' + k + '-p'); if (el) el.innerHTML = inHint($('#cs-' + k).value, hf); }); }
function caseForm() { pausePlayer(); const n = nowLocal(); $('#case-form').innerHTML = caseFormHtml({ videoId: n.id, start: Math.max(0, n.local - 10), end: n.local + 10 }, true); csPreview(); $('#case-form').scrollIntoView({ block: 'nearest' }); }
function caseEdit(id) { const c = VD.cases.find((x) => x.id === id); $('#case-form').innerHTML = caseFormHtml(c, true); csPreview(); $('#case-form').scrollIntoView({ block: 'nearest' }); }
async function caseDelHere(id) {
  if (!confirm('この事例を削除しますか？（映像そのものは消えません）')) return;
  try { await call('api_delCase', id); VD.cases = VD.cases.filter((c) => c.id !== id); renderCaseArea(); toast('削除しました'); } catch (e) { fail(e); }
}
async function caseSave(id, videoId, start, end) {
  const x = { id, videoId, title: $('#cs-title').value, correct: $('#cs-correct').value, text: $('#cs-text').value, material: $('#cs-mat').value,
    tags: $$('#cs-tags .chip.on').map((b) => b.textContent) };
  if (start !== null) { x.start = start; x.end = end; }
  else {
    const hf = $('#cs-half') ? CS_HALF : '';
    const s0 = parseIn($('#cs-s').value, hf), e0 = parseIn($('#cs-e').value, hf);
    if (typeof s0 === 'string') return toast(s0, true);
    if (typeof e0 === 'string') return toast(e0, true);
    // 事例は開始の映像にまとめる（終了がつぎの映像にかかっても、開始の映像の秒で持つ）
    x.videoId = s0.id; x.start = s0.local;
    const te = toT(e0.id, e0.local), ts = toT(s0.id, s0.local);
    x.end = te !== null && ts !== null ? s0.local + (te - ts) : (e0.id === s0.id ? e0.local : s0.local + 20);
  }
  if (x.end <= x.start) return toast('終了は開始より後にしてください', true);
  if (!x.title.trim()) return toast('タイトルを入力してください', true);
  try {
    await call('api_addCase', x); toast('保存しました');
    if (CUR === 'video') { const r = await call('api_video', VD.video.id); VD.cases = r.cases; $('#case-form').innerHTML = ''; renderCaseArea(); } else { closeModal(); go('cases'); }
  } catch (e) { fail(e); }
}

/* ───────── みんな：事例ライブラリ ───────── */
let CS = { list: [], tag: '', comp: '', q: '' };
ROUTES.cases = async () => {
  head('事例ライブラリ');
  CS.list = await get('api_cases');
  if (!CS.list.length) return setMain(empty('事例はまだありません。<br>委員会とアセッサーが試合映像の画面から登録できます。'));
  const comps = [...new Set(CS.list.map((c) => c.comp).filter(Boolean))];
  setMain(`<p class="lead">判断の難しい場面を集めた教材です。開くとその場面から再生されます。</p>
    <div class="grid2" style="grid-template-columns:2fr 1fr;margin-bottom:4px"><div class="search" style="margin:0"><input type="search" placeholder="キーワードでさがす" value="${h(CS.q)}" oninput="CS.q=this.value;csRender()"></div>
    <select onchange="CS.comp=this.value;csRender()"><option value="">すべての大会</option>${comps.map((c) => `<option ${CS.comp === c ? 'selected' : ''}>${h(c)}</option>`).join('')}</select></div>
    <div id="cs-tagbar" style="margin:12px 0 4px"></div><div id="cs-list"></div>`);
  csRender();
};
function csRender() {
  const n = (t) => CS.list.filter((c) => !t || c.tags.includes(t)).length;
  $('#cs-tagbar').innerHTML = ['', ...B.consts.tags].filter((t) => !t || n(t)).map((t) => `<button class="chip ${CS.tag === t ? 'on' : ''}" onclick="CS.tag='${t}';csRender()">${t || 'すべて'} <span style="opacity:.6;margin-left:4px">${n(t)}</span></button>`).join('');
  const list = CS.list.filter((c) => (!CS.tag || c.tags.includes(CS.tag)) && (!CS.comp || c.comp === CS.comp) && (!CS.q || (c.title + c.text + c.correct).includes(CS.q)));
  $('#cs-list').innerHTML = list.length ? `<div class="list">${list.map((c) => `<a href="#" class="li" onclick="csOpen('${c.id}');return false;"><span class="iconbtn" style="background:var(--pale);color:var(--blue);flex:none">▶</span>
      <div class="main"><div class="t">${h(c.title)}</div><div>${c.tags.map((t) => `<span class="tag">${h(t)}</span>`).join('')}</div>${c.correct ? `<div class="s">正しい判定：${h(c.correct)}</div>` : ''}</div>
      <span class="small muted" style="text-align:right">${h(c.comp)}<br>${c.date ? dl(c.date) : ''}</span><span class="chev">›</span></a>`).join('')}</div>` : empty('該当する事例はありません');
}
async function csOpen(id) {
  const c = CS.list.find((x) => x.id === id);
  const mine = c.byId === B.ctx.id || B.ctx.com;
  openModal({ title: h(c.title), wide: true, body: `<div class="player"><div id="yt-modal"></div></div>${playerBar('modal')}
    <div class="row small" style="margin-bottom:8px"><span class="muted num">${fmtSec(c.start)}〜${fmtSec(c.end)}</span><button class="btn sm ghost" onclick="seek(${c.start},'modal')">もう一度再生</button><span class="spacer"></span>${c.tags.map((t) => `<span class="tag">${h(t)}</span>`).join('')}</div>
    ${c.correct ? `<div class="card pale"><div class="small muted">正しい判定</div><div class="b" style="font-size:17px">${h(c.correct)}</div></div>` : ''}
    ${c.text ? `<div class="flabel">解説</div><p class="pre">${h(c.text)}</p>` : ''}
    ${c.material ? `<p><a class="btn sm" href="${h(c.material)}" target="_blank" rel="noopener">研修資料を開く</a></p>` : ''}
    <p class="small muted">登録：${h(c.by)}　${h(c.at)}</p>
    ${mine ? `<div class="row"><button class="btn sm" onclick="csEdit('${c.id}')">編集</button><button class="btn sm danger" onclick="csDel('${c.id}')">削除</button></div><div id="case-form" style="margin-top:12px"></div>` : ''}` });
  await mountPlayer('modal', 'yt-modal', c.yt, { start: c.start, end: c.end });
}
function csEdit(id) { const c = CS.list.find((x) => x.id === id); $('#case-form').innerHTML = caseFormHtml(c, false); }
async function csDel(id) {
  if (!confirm('この事例を削除しますか？')) return;
  try { await call('api_delCase', id); closeModal(); go('cases'); } catch (e) { fail(e); }
}

/* ───────── 委員会：共通 ───────── */
let MONTHS = [];
/* 委員会の月：指定がなければ来月。月の一覧（進み具合）はページのデータと同時に取る */
function comMonth(ym) { return ym || addMonth(B.today.slice(0, 7), 1); }
async function withMonths(p) { const [m, r] = await Promise.all([get('api_months'), p]); MONTHS = m; return r; }
/* 月の流れ：①試合一覧 → ②稼働調査 → ③割当 → ④派遣依頼 */
function flowSteps(ym, on) {
  const m = MONTHS.find((x) => x.ym === ym) || {};
  const st = [
    ['c_matches', '試合一覧', m.list ? '公開済み' : '未公開', m.list ? 'done' : 'need'],
    ['c_survey', '稼働調査', m.list ? `締切 ${md(m.deadline)}` : '一覧の公開後', m.list ? (B.today > m.deadline ? 'done' : '') : ''],
    ['c_assign', '割当', m.assign ? '公開済み' : '未公開', m.assign ? 'done' : (m.list ? 'need' : '')],
    ['c_dispatch', '派遣依頼', '地区協会へ', ''],
  ];
  return `<div class="steps">${st.map(([p, l, s, cls], i) => `<a class="step ${cls} ${p === on ? 'on' : ''}" href="#" onclick="go('${p}','${ym}');return false;"><div class="n">${i + 1}</div><div class="l">${l}</div><div class="st">${s}</div></a>`).join('')}</div>`;
}

/* ───────── 委員会：試合一覧 ───────── */
let CM = null;
ROUTES.c_matches = async (ym) => {
  head('試合一覧');
  ym = comMonth(ym);
  CM = await withMonths(get('api_matches', ym));
  head('試合一覧', null, monthNav('c_matches', ym));
  const byDate = {};
  CM.matches.forEach((m, i) => { (byDate[m.date] = byDate[m.date] || []).push([m, i]); });
  const noVenue = CM.matches.filter((m) => m.venue && !m.assoc).length;
  setMain(`${flowSteps(ym, 'c_matches')}
    <div class="card ${CM.listPublished ? 'pale' : (CM.matches.length ? 'warn' : '')}"><div class="row">
      <div style="flex:1;min-width:200px">${CM.listPublished ? `<div class="b blue">一覧を公開済み・稼働調査の受付中</div><div class="small muted">締切 ${dl(CM.deadline)}。試合を追加・変更したときは、必要なら回答依頼を再送してください。</div>`
        : `<div class="b">${CM.matches.length ? 'まだ公開していません' : '試合を登録してください'}</div><div class="small muted">公開すると全強化審判員に稼働調査の回答依頼メールが届きます。毎月10日の朝、翌月の一覧が未公開なら自動で公開されます。</div>`}</div>
      <button class="btn ${CM.listPublished ? '' : 'primary'}" onclick="cmPublish()" ${CM.matches.length ? '' : 'disabled'}>${CM.listPublished ? '回答依頼を再送' : '公開して回答依頼'}</button></div></div>
    ${noVenue ? `<div class="card warn small"><span class="red b">会場マスタにない会場が ${noVenue}件 あります。</span>派遣依頼の宛先が決まらないため、マスタの「会場」に登録してください。</div>` : ''}
    <div class="row" style="margin:20px 0 10px"><h2 style="margin:0">${CM.matches.length}試合</h2><span class="spacer"></span><button class="btn" onclick="cmPaste()">CSV・Excelから取り込み</button><button class="btn primary" onclick="cmEdit(-1)">＋ 試合を追加</button></div>
    ${CM.matches.length ? Object.keys(byDate).sort().map((d) => `<div class="flabel" style="margin-top:12px">${dl(d)}</div><div class="list">${byDate[d].map(([m, i]) =>
      `<a href="#" class="li" onclick="cmEdit(${i});return false;"><span class="b num" style="width:48px">${h(m.ko)}</span><div class="main"><div class="t">${card(m)}</div><div class="s">${h(m.comp)} ${h(m.name)}／${h(m.venue)}${m.venue && !m.assoc ? ' <span class="red">（会場マスタ未登録）</span>' : ''}</div></div><span class="chev">›</span></a>`).join('')}</div>`).join('')
      : empty('この月の試合はまだありません。<br>「＋ 試合を追加」か「CSV・Excelから取り込み」で登録します。')}
    <datalist id="dl-venue">${CM.venues.map((v) => `<option value="${h(v)}">`).join('')}</datalist>
    <datalist id="dl-team">${CM.teams.map((v) => `<option value="${h(v)}">`).join('')}</datalist>
    <datalist id="dl-comp">${CM.comps.map((v) => `<option value="${h(v)}">`).join('')}</datalist>`);
};
function cmEdit(i) {
  const last = CM.matches[CM.matches.length - 1] || {};
  const m = i >= 0 ? CM.matches[i] : { date: '', ko: '', comp: last.comp || '', name: '', venue: '', a: '', b: '' };
  openModal({ title: i >= 0 ? '試合を編集' : '試合を追加', body: `
    <div class="grid2"><div class="field"><label>試合日</label><input type="date" id="me-date" value="${h(m.date)}" min="${CM.month}-01" max="${CM.month}-31"></div><div class="field"><label>キックオフ</label><input type="time" id="me-ko" value="${h(m.ko)}"></div></div>
    <div class="grid2"><div class="field"><label>大会名</label><input id="me-comp" list="dl-comp" value="${h(m.comp)}"></div><div class="field"><label>試合名（節・回戦）</label><input id="me-name" value="${h(m.name)}" placeholder="例：第10節"></div></div>
    <div class="field"><label>会場</label><input id="me-venue" list="dl-venue" value="${h(m.venue)}"></div>
    <div class="grid2"><div class="field"><label>チームA（ホーム）</label><input id="me-a" list="dl-team" value="${h(m.a)}"></div><div class="field"><label>チームB（アウェイ）</label><input id="me-b" list="dl-team" value="${h(m.b)}"></div></div>
    ${i >= 0 ? `<button class="btn danger sm" onclick="cmDelMatch('${m.id}')">この試合を削除</button>` : ''}`,
    foot: `${i < 0 ? `<button class="btn" onclick="cmSaveOne('',true)">保存して続けて追加</button>` : ''}<button class="btn primary" onclick="cmSaveOne('${m.id || ''}')">保存</button>` });
}
async function cmSaveOne(id, again) {
  const x = { id, date: $('#me-date').value, ko: $('#me-ko').value, comp: $('#me-comp').value.trim(), name: $('#me-name').value.trim(), venue: $('#me-venue').value.trim(), a: $('#me-a').value.trim(), b: $('#me-b').value.trim() };
  try {
    const r = await call('api_saveMatches', [x]); if (r.errors.length) return toast(r.errors[0], true);
    toast('保存しました');
    if (again) { await ROUTES.c_matches(CM.month); cmEdit(-1); $('#me-date').value = x.date; $('#me-ko').value = x.ko; $('#me-venue').value = x.venue; $('#me-comp').value = x.comp; return; }
    closeModal(); go('c_matches', x.date.slice(0, 7) || CM.month);
  } catch (e) { fail(e); }
}
/* CSV・Excelから取り込み：CSVファイルを選ぶか、Excelからコピーして貼り付ける。見出し行があれば列の順番は自由 */
const CM_COLS = [['comp', '大会名'], ['name', '試合名'], ['date', '試合日'], ['ko', 'キックオフ'], ['venue', '会場'], ['a', 'チームA'], ['b', 'チームB']];
let PT = [];
function cmPaste() {
  PT = [];
  openModal({ title: 'CSV・Excelから取り込み', wide: true, body: `
    <p class="small" style="margin-top:0">次の列のCSVファイルを選ぶか、Excelで同じ列を並べてコピーし、下に貼り付けてください。1行目に見出し（大会名・試合日 など）があれば、列の順番は自由です。</p>
    <div class="tbl"><table><thead><tr>${CM_COLS.map((c) => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody><tr class="small muted"><td>北海道リーグ</td><td>第10節</td><td>2026/11/3</td><td>13:00</td><td>○○競技場</td><td>チームA</td><td>チームB</td></tr></tbody></table></div>
    <div class="row" style="margin:10px 0"><label class="btn primary" style="cursor:pointer">CSVファイルを選ぶ<input type="file" accept=".csv,.txt,text/csv" onchange="ptFile(this)" hidden></label><button class="btn ghost" onclick="ptTemplate()">ひな形（CSV）をダウンロード</button></div>
    <textarea id="pt" style="min-height:140px" placeholder="または、ここに貼り付け" oninput="ptRead(this.value)"></textarea>
    <div id="pt-prev" style="margin-top:8px"></div><div id="pt-err" style="margin-top:8px"></div>`,
    foot: `<button class="btn" onclick="closeModal()">やめる</button><button class="btn primary" id="pt-save" onclick="cmPasteSave()" disabled>追加する</button>` });
}
// CSV の1行をセルに分ける（"…" で囲まれたカンマ・改行にも対応）。タブ区切り（Excelからの貼り付け）も読む
function ptParse(text) {
  text = text.replace(/^﻿/, '');
  const tab = text.split(/\r?\n/)[0].includes('\t'), sep = tab ? '\t' : ',', rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"' && cell === '') q = true;
    else if (ch === sep) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter((r) => r.some(Boolean));
}
function ptRead(text) {
  const rows = ptParse(text || '');
  // 1行目が見出しなら、見出しの名前で列を決める（「日付」「KO」「ホーム」なども読む）
  const alias = { comp: /大会|リーグ/, name: /試合名|節|回戦/, date: /日付|試合日|^日$/, ko: /キックオフ|KO|開始|時刻|時間/i, venue: /会場|場所|グラウンド/, a: /チームA|ホーム|^A$/i, b: /チームB|アウェイ|^B$/i };
  let idx = CM_COLS.map((c, i) => i);
  if (rows.length && rows[0].some((x) => /大会|試合日|日付|会場|チーム/.test(x))) {
    const hd = rows.shift();
    idx = CM_COLS.map(([k]) => hd.findIndex((x) => alias[k].test(x)));
  }
  PT = rows.map((r) => { const o = {}; CM_COLS.forEach(([k], i) => { o[k] = idx[i] >= 0 ? (r[idx[i]] || '') : ''; }); return o; });
  const bad = (o) => !o.comp || !o.date || !o.a || !o.b;
  $('#pt-save').disabled = !PT.length;
  $('#pt-err').innerHTML = '';
  $('#pt-prev').innerHTML = PT.length ? `<div class="small b" style="margin-bottom:4px">${PT.length}試合を読み取りました${PT.some(bad) ? `<span class="red">（大会名・試合日・チームが空の行 ${PT.filter(bad).length}件）</span>` : ''}</div>
    <div class="tbl" style="max-height:260px;overflow:auto"><table><thead><tr>${CM_COLS.map((c) => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${PT.map((o) => `<tr class="${bad(o) ? 'warn' : ''}">${CM_COLS.map(([k]) => `<td class="small">${h(o[k]) || (['comp', 'date', 'a', 'b'].includes(k) ? '<span class="red">空</span>' : '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
}
// ファイルを読む：UTF-8 で読めなければ Shift_JIS（Excel で保存したCSV）として読む
function ptFile(inp) {
  const f = inp.files && inp.files[0]; if (!f) return;
  f.arrayBuffer().then((buf) => {
    let t; try { t = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { t = new TextDecoder('shift_jis').decode(buf); }
    $('#pt').value = t; ptRead(t);
  });
  inp.value = '';
}
function ptTemplate() {
  const csv = '﻿' + CM_COLS.map((c) => c[1]).join(',') + '\r\n北海道リーグ,第10節,2026/11/3,13:00,○○競技場,チームA,チームB\r\n';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'matches_template.csv'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function cmPasteSave() {
  if (!PT.length) return toast('CSVを選ぶか貼り付けてください', true);
  $('#pt-save').disabled = true;
  try {
    const r = await call('api_saveMatches', PT);
    if (r.errors.length) $('#pt-err').innerHTML = `<div class="errs"><b>追加できなかった行</b><ul>${r.errors.map((e) => `<li>${h(e)}</li>`).join('')}</ul></div>`;
    toast(r.saved + '試合を追加しました' + (r.skipped ? `（${r.skipped}試合は登録済みのため飛ばしました）` : ''));
    const first = PT.map((o) => o.date).find(Boolean) || '';
    const ym = (first.replace(/[年月\/.]/g, '-').match(/^(\d{4})-(\d{1,2})/) || []);
    if (!r.errors.length) { closeModal(); go('c_matches', ym[1] ? ym[1] + '-' + ('0' + ym[2]).slice(-2) : CM.month); }
    else $('#pt-save').disabled = false;
  } catch (e) { $('#pt-save').disabled = false; fail(e); }
}
async function cmDelMatch(id) {
  if (!confirm('この試合を削除しますか？（稼働調査の回答と割当も削除されます）')) return;
  try { await call('api_deleteMatch', id); toast('削除しました'); closeModal(); go('c_matches', CM.month); } catch (e) { fail(e); }
}
async function cmPublish() {
  if (!confirm(`${ymLabel(CM.month)}の試合一覧を公開し、全強化審判員に稼働調査の回答依頼メールを送ります。よろしいですか？`)) return;
  try { await call('api_publishList', CM.month); toast('公開してメールを送りました'); go('c_matches', CM.month); } catch (e) { fail(e); }
}

/* ───────── 委員会：稼働状況 ───────── */
ROUTES.c_survey = async (ym) => {
  head('稼働状況');
  ym = comMonth(ym);
  const r = await withMonths(get('api_surveyStatus', ym));
  head('稼働状況', null, monthNav('c_survey', ym));
  if (!r.matches.length) return setMain(flowSteps(ym, 'c_survey') + empty('この月の試合はまだありません'));
  const cls = (a) => a === '○' ? 'a-o' : a === '△' ? 'a-t' : a === '×' ? 'a-x' : 'a-n';
  const done = r.refs.filter((x) => x.answered >= r.matches.length).length;
  const notes = [];
  const head2 = r.matches.map((m) => `<th title="${h(m.comp + ' ' + m.name)}"><div>${dl(m.date)}</div><div style="font-weight:400">${h(m.a).slice(0, 5)}<br>${h(m.b).slice(0, 5)}</div></th>`).join('');
  const body = r.refs.map((x) => `<tr><td>${h(x.name)} <span class="small ${x.answered < r.matches.length ? 'red' : 'muted'}">${x.answered}/${r.matches.length}</span></td>${r.matches.map((m) => {
    const a = x.answers[m.id] || {};
    if (a.note) notes.push({ who: x.name, m, a });
    return `<td class="${cls(a.ans)} ${a.note ? 'note' : ''}" ${a.note ? `onclick="toast('${h(x.name)}：${h(a.note).replace(/'/g, '')}')" title="${h(a.note)}"` : ''}>${h(a.ans || '・')}</td>`;
  }).join('')}</tr>`).join('');
  const sum = (m, a) => r.refs.filter((x) => (x.answers[m.id] || {}).ans === a).length;
  const missing = r.refs.filter((x) => x.answered < r.matches.length);
  setMain(`${flowSteps(ym, 'c_survey')}
    ${r.published ? `<div class="grid3" style="margin-bottom:16px"><div class="stat ${done === r.refs.length ? 'blue' : ''}"><div class="k">回答がそろった人</div><div class="v">${done}<small>／${r.refs.length}人</small></div><div class="bar"><i style="width:${r.refs.length ? Math.round((done / r.refs.length) * 100) : 0}%"></i></div></div>
      <div class="stat"><div class="k">締切</div><div class="v" style="font-size:22px">${dl(r.deadline)}</div><div class="small muted">${B.today > r.deadline ? '締め切りました' : '締切前日の朝に未回答者へ自動リマインド'}</div></div>
      <div class="stat"><div class="k">次にすること</div><div style="margin-top:6px"><button class="btn primary sm" onclick="go('c_assign','${ym}')">割当へ ›</button></div></div></div>`
      : '<div class="card warn"><span class="red b">この月の試合一覧はまだ公開していません。</span><button class="btn sm" style="margin-left:8px" onclick="go(\'c_matches\',\'' + ym + '\')">試合一覧へ</button></div>'}
    <div class="tbl" style="max-height:70vh"><table class="matrix"><thead><tr><th>審判員</th>${head2}</tr></thead><tbody>${body}</tbody>
      <tfoot><tr><td>○ の人数</td>${r.matches.map((m) => `<td class="b blue">${sum(m, '○')}</td>`).join('')}</tr><tr><td>△ の人数</td>${r.matches.map((m) => `<td class="red">${sum(m, '△')}</td>`).join('')}</tr></tfoot></table></div>
    <p class="small muted">○ 行ける　△ 条件付き　× 行けない　・ 未回答　（下線つきは備考あり：タップで表示）</p>
    ${notes.length ? `<h2>備考</h2><div class="list">${notes.map((n) => `<div class="li"><span class="b ${n.a.ans === '△' ? 'red' : ''}" style="width:20px">${h(n.a.ans)}</span><div class="main"><div class="t">${h(n.who)}　<span class="small muted">${dl(n.m.date)} ${card(n.m)}</span></div><div class="s">${h(n.a.note)}</div></div></div>`).join('')}</div>` : ''}
    ${missing.length && r.published ? `<h2>未回答のある審判員（${missing.length}名）</h2><div>${missing.map((x) => `<span class="tag">${h(x.name)}</span>`).join('')}</div>` : ''}`);
};

/* ───────── 委員会：割当 ───────── */
let BD = null, BD_FILTER = '';
ROUTES.c_assign = async (ym, keepScroll) => {
  head('割当');
  ym = comMonth(ym);
  const y = keepScroll ? window.scrollY : 0;
  BD = await withMonths(get('api_assignBoard', ym));
  BD.dirty = {};
  head('割当', null, monthNav('c_assign', ym));
  renderBoard();
  window.scrollTo(0, y);
  LEAVE = () => { if (Object.keys(BD.dirty).length && confirm('保存していない割当の変更があります。保存しますか？')) bdSaveAll(true); };
  LEAVE.dirty = () => BD && Object.keys(BD.dirty).length > 0;
};
function slotEmpty(s) { return !s || !s.kind || (s.kind === '強化' && !s.memberId); }
function renderBoard() {
  const ym = BD.month;
  const roles = B.consts.ROLES;
  const total = BD.matches.length * roles.length;
  const filled = BD.matches.reduce((n, m) => n + roles.filter((r) => !slotEmpty(m.slots[r])).length, 0);
  const list = BD.matches.map((m, i) => [m, i]).filter(([m]) => BD_FILTER !== 'empty' || roles.some((r) => slotEmpty(m.slots[r])));
  const nDirty = Object.keys(BD.dirty).length;
  setMain(`${flowSteps(ym, 'c_assign')}
    <div class="card ${BD.published ? 'pale' : ''}"><div class="row">
      <div style="flex:1;min-width:200px"><div class="b ${BD.published ? 'blue' : ''}">${BD.published ? '割当を公開済み' : 'まだ公開していません'}　<span class="muted" style="font-weight:400">${filled}／${total}枠 決定</span></div>
      <div class="small muted">${BD.published ? '変更を保存すると、外れた人と新しく入った人に変更通知メールが届きます。' : '保存しても、公開するまで審判員には見えず、通知もされません。'}</div></div>
      <button class="btn ${BD.published ? '' : 'primary'}" onclick="bdPublish()" ${BD.matches.length ? '' : 'disabled'}>${BD.published ? '未通知の変更を通知' : '公開して通知'}</button></div>
      <div class="bar"><i style="width:${total ? Math.round((filled / total) * 100) : 0}%"></i></div></div>
    ${!BD.listPublished ? '<div class="card warn small"><span class="red b">この月の試合一覧（稼働調査）がまだ公開されていません。</span>候補者は稼働調査で○△と答えた人だけです。</div>' : ''}
    <div class="row" style="margin:16px 0 10px"><button class="chip ${BD_FILTER ? '' : 'on'}" onclick="BD_FILTER='';renderBoard()">すべて（${BD.matches.length}）</button><button class="chip ${BD_FILTER ? 'on' : ''}" onclick="BD_FILTER='empty';renderBoard()">未定がある試合</button>
      <span class="spacer"></span><span class="small muted">枠をタップして人を選びます</span></div>
    ${list.length ? list.map(([m, i]) => bdCard(m, i)).join('') : empty(BD.matches.length ? 'すべての枠が決まっています' : 'この月の試合はありません')}
    <div class="actionbar" ${nDirty ? '' : 'hidden'}><div class="in"><span class="msg"><b class="blue">未保存の変更：${nDirty}試合</b></span><button class="btn" onclick="go('c_assign','${ym}')">元に戻す</button><button class="btn primary" onclick="bdSaveAll()">保存する</button></div></div>`);
}
function memberCount(id) { return BD.matches.reduce((n, m) => n + B.consts.ROLES.filter((r) => m.slots[r] && m.slots[r].kind === '強化' && m.slots[r].memberId === id).length, 0); }
function candOf(m, role, id) { return (m.cands[role] || []).find((c) => c.id === id); }
function slotView(m, role) {
  const s = m.slots[role] || {};
  if (s.kind === '強化' && s.memberId) {
    const c = candOf(m, role, s.memberId) || { name: '（候補外）', alerts: [] };
    const warn = [...(c.ans === '△' ? ['△' + (c.note ? '：' + c.note : '')] : []), ...c.alerts, ...localAlerts(m, role, s.memberId)];
    return { name: c.name, sub: c.grade || '', warn };
  }
  if (s.kind === '地区派遣') return { name: s.dname || '地区派遣', sub: s.dname ? (s.daffil || '地区派遣') : (s.assoc || m.assoc || '協会未選択') + 'に依頼', warn: [] };
  return { name: '', sub: '', warn: [] };
}
function localAlerts(m, role, id) {
  const other = B.consts.ROLES.find((r) => r !== role && m.slots[r] && m.slots[r].kind === '強化' && m.slots[r].memberId === id);
  return other ? ['同じ試合で' + other + 'にも入っています'] : [];
}
function bdCard(m, i) {
  const filled = B.consts.ROLES.filter((r) => !slotEmpty(m.slots[r])).length;
  return `<div class="mcard ${BD.dirty[m.id] ? 'dirty' : ''}" id="bd-${i}">
    <div class="mhead">${dateBox(m.date)}<div class="main"><div class="t">${card(m)}</div><div class="s">${h(m.ko)}　${h(m.comp)} ${h(m.name)}／${h(m.venue)}</div></div>
      <div style="text-align:right">${BD.dirty[m.id] ? '<span class="pill solid">未保存</span>' : `<span class="pill ${filled === 5 ? 'ok' : ''}">${filled}/5</span>`}</div></div>
    <div class="slots">${B.consts.ROLES.map((r) => { const v = slotView(m, r); return `<button class="slotbtn" onclick="bdPick(${i},'${r}')"><span class="r">${r}</span>
      ${v.name ? `<span class="n">${h(v.name)}${v.warn.length ? ' <span class="red">⚠</span>' : ''}</span>` : '<span class="n none">未定</span>'}
      ${v.sub ? `<span class="x">${h(v.sub)}</span>` : ''}${v.warn.length ? `<span class="w pc-only">${h(v.warn[0])}${v.warn.length > 1 ? ' ほか' : ''}</span>` : ''}</button>`; }).join('')}</div></div>`;
}
function bdSet(i, role, s) {
  const m = BD.matches[i];
  m.slots[role] = s; BD.dirty[m.id] = true;
  closeModal(); renderBoard();
}
function bdPick(i, role) {
  const m = BD.matches[i];
  const s = m.slots[role] || { kind: '' };
  const cands = (m.cands[role] || []).slice().sort((a, b) => (a.ans === '○' ? 0 : a.ans === '△' ? 1 : 2) - (b.ans === '○' ? 0 : b.ans === '△' ? 1 : 2) || a.alerts.length - b.alerts.length || memberCount(a.id) - memberCount(b.id));
  const candBtn = (c) => {
    const warn = [...c.alerts, ...localAlerts(m, role, c.id)];
    const on = s.kind === '強化' && s.memberId === c.id;
    return `<button class="cand ${on ? 'on' : ''}" onclick="bdSet(${i},'${role}',{kind:'強化',memberId:'${c.id}'})">
      ${role === 'アセッサー' ? '' : `<span class="ans ${c.ans === '○' ? 'o' : c.ans === '△' ? 't' : ''}">${h(c.ans || '—')}</span>`}
      <div class="main"><div class="t">${h(c.name)}${c.grade ? ` <span class="small muted" style="font-weight:400">${h(c.grade)}</span>` : ''}</div>
      ${c.ans === '△' && c.note ? `<div class="s red">△：${h(c.note)}</div>` : ''}${warn.map((a) => `<div class="s red">⚠ ${h(a)}</div>`).join('')}</div>
      <span class="small muted" style="white-space:nowrap">今月 ${memberCount(c.id)}件</span>${on ? '<span class="blue b">✓</span>' : ''}</button>`;
  };
  const dispatch = role === 'アセッサー' ? '' : `<div class="card ${s.kind === '地区派遣' ? 'blue' : ''}" style="margin-top:16px"><h3>地区協会へ派遣を依頼する</h3>
    <div class="field"><label>依頼先</label><select id="dp-assoc">${['', ...BD.assocs].map((a) => `<option ${a === (s.assoc || m.assoc) ? 'selected' : ''} value="${h(a)}">${a ? h(a) : '協会を選択'}</option>`).join('')}</select>${m.assoc ? `<div class="hint">会場の地区協会：${h(m.assoc)}</div>` : ''}</div>
    <div class="grid2"><div class="field"><label>派遣者の氏名（決まったら）</label><input id="dp-name" value="${h(s.dname || '')}"></div><div class="field"><label>所属</label><input id="dp-affil" value="${h(s.daffil || '')}"></div></div>
    <button class="btn wide" onclick="bdSet(${i},'${role}',{kind:'地区派遣',assoc:$('#dp-assoc').value,dname:$('#dp-name').value.trim(),daffil:$('#dp-affil').value.trim()})">地区派遣にする</button></div>`;
  openModal({ title: `${role}を選ぶ`, body: `<div class="small muted" style="margin-bottom:12px">${dl(m.date)} ${h(m.ko)}　${card(m)}／${h(m.venue)}</div>
    ${role === 'アセッサー' ? '' : '<div class="flabel">強化審判員（稼働調査で ○・△ の人）</div>'}
    ${cands.length ? cands.map(candBtn).join('') : `<p class="muted small">${role === 'アセッサー' ? 'アセッサーが登録されていません（マスタで登録）' : 'この試合に ○・△ と答えた人がいません'}</p>`}
    ${dispatch}`,
    foot: `<button class="btn ${s.kind ? 'danger' : ''}" onclick="bdSet(${i},'${role}',{kind:''})">未定にする</button><span class="spacer"></span><button class="btn" onclick="closeModal()">閉じる</button>` });
}
async function bdSaveAll(silent) {
  const ids = Object.keys(BD.dirty);
  let notified = 0;
  try {
    for (const id of ids) {
      const m = BD.matches.find((x) => x.id === id);
      const r = await call('api_saveAssign', m.id, m.slots);
      notified += r.notified || 0; delete BD.dirty[id];
    }
    toast(notified ? `保存し、${notified}名に変更通知を送りました` : '保存しました');
    if (!silent) ROUTES.c_assign(BD.month, true);
  } catch (e) { fail(e); if (!silent) renderBoard(); }
}
async function bdPublish() {
  if (Object.keys(BD.dirty).length) return toast('先に「保存する」を押してください', true);
  const msg = BD.published ? '保存済みの割当のうち、まだ通知していない変更を通知します。' : `${ymLabel(BD.month)}の割当を全員に公開し、割り当てた強化審判員・アセッサーに通知メールを送ります。`;
  if (!confirm(msg)) return;
  try { const r = await call('api_publishAssign', BD.month); toast(`公開しました（${r.notified}名に通知）`); go('c_assign', BD.month); } catch (e) { fail(e); }
}

/* ───────── 委員会：派遣依頼 ───────── */
ROUTES.c_dispatch = async (ym) => {
  head('派遣依頼');
  ym = comMonth(ym);
  const list = await withMonths(get('api_dispatch', ym));
  window.DP = list;
  head('派遣依頼', null, monthNav('c_dispatch', ym));
  setMain(`${flowSteps(ym, 'c_dispatch')}
    <p class="lead">割当で「地区派遣」にした役割を、会場のある地区協会ごとにまとめています。依頼メールは委員会から送ってください。派遣者が決まったら、割当画面でその枠をタップして氏名と所属を入力します。</p>
    ${list.length ? list.map((g, gi) => { const undecided = g.items.filter((x) => !x.dname).length; return `<div class="card"><div class="row" style="margin-bottom:8px"><div style="flex:1;min-width:180px"><h2 style="margin:0">${h(g.assoc)}</h2><div class="small muted">${h(g.person)} ${h(g.mail)}</div></div>
      ${undecided ? `<span class="pill ng">未定 ${undecided}</span>` : '<span class="pill ok">全員決定</span>'}</div>
      <div class="list">${g.items.map((x) => `<div class="li">${dateBox(x.date)}<div class="main"><div class="t">${h(x.role)}　<span style="font-weight:400">${card(x)}</span></div><div class="s">${h(x.ko)}　${h(x.venue)}／${h(x.comp)} ${h(x.name)}</div></div>
        <div style="text-align:right">${x.dname ? `<div class="b">${h(x.dname)}</div><div class="small muted">${h(x.daffil)}</div>` : '<span class="red small">派遣者 未定</span>'}</div></div>`).join('')}</div>
      <div class="row"><button class="btn sm" onclick="copyText(dpText(${gi}))">依頼文をコピー</button>${g.mail ? `<a class="btn sm primary" href="mailto:${h(g.mail)}?subject=${encodeURIComponent('審判員派遣のお願い（' + ymLabel(ym) + '）')}&body=${encodeURIComponent(dpText(gi))}">メールを作成</a>` : '<span class="small red">地区協会のメールが未登録です（マスタ）</span>'}</div></div>`; }).join('')
    : empty('この月の派遣依頼はありません')}`);
};
function dpText(gi) {
  const g = window.DP[gi];
  return `${g.assoc}\n${g.person ? g.person + ' 様' : 'ご担当者 様'}\n\nいつもお世話になっております。審判委員会です。\n下記の試合について、審判員の派遣をお願いいたします。\n\n` +
    g.items.map((x) => `・${dl(x.date)} ${x.ko}　${x.venue}\n　${x.comp} ${x.name}　${x.a} 対 ${x.b}\n　依頼する役割：${x.role}`).join('\n') +
    `\n\n派遣者が決まりましたら、氏名と所属をご連絡ください。\nよろしくお願いいたします。`;
}

/* ───────── 委員会：レポート一覧 ───────── */
let CR_FILTER = '';
ROUTES.c_reports = async (ym) => {
  head('アセスメントレポート');
  ym = ym || B.today.slice(0, 7);
  const list = await get('api_reports', ym);
  head('アセスメントレポート', null, monthNav('c_reports', ym));
  const n = (s) => list.filter((m) => m.status === s).length;
  const late = (m) => m.assessor && m.status !== '提出済' && m.date <= B.today;
  const shown = list.filter((m) => !CR_FILTER || (CR_FILTER === 'late' ? late(m) : m.status === CR_FILTER));
  setMain(`<div class="grid3 stats3" style="margin-bottom:12px"><div class="stat blue"><div class="k">提出済み</div><div class="v">${n('提出済')}<small>件</small></div></div>
      <div class="stat"><div class="k">下書き</div><div class="v">${n('下書き')}<small>件</small></div></div>
      <div class="stat"><div class="k">試合後で未提出</div><div class="v ${list.filter(late).length ? 'red' : ''}">${list.filter(late).length}<small>件</small></div></div></div>
    <div style="margin-bottom:8px">${[['', 'すべて'], ['late', '試合後で未提出'], ['提出済', '提出済み'], ['下書き', '下書き']].map(([k, l]) => `<button class="chip ${CR_FILTER === k ? 'on' : ''}" onclick="CR_FILTER='${k}';go('c_reports','${ym}')">${l}</button>`).join('')}</div>
    ${shown.length ? `<div class="list">${shown.map((m) => matchLi(m, `<div style="text-align:right"><div class="small muted">${h(m.assessor || '')}</div>${statusPill(m.status)}${m.submittedAt ? `<div class="small muted">${h(m.submittedAt.slice(5, 16))}</div>` : ''}</div>`, m.assessor ? `go('report','${m.id}')` : '')).join('')}</div>` : empty('該当するレポートはありません')}`);
};
ROUTES.c_report = (id) => ROUTES.report(id);

/* ───────── 委員会：体力テスト結果 ───────── */
ROUTES.c_fitness = async (ym) => {
  head('体力テスト結果');
  ym = ym || B.today.slice(0, 7);
  const [ft, r] = await Promise.all([get('api_fitness'), get('api_fitnessResults', ym)]);
  const months = [...new Set([B.today.slice(0, 7), ...ft.months])].sort().reverse();
  head('体力テスト結果', null, monthNav('c_fitness', ym, months));
  setMain(`<div class="card ${ym === B.today.slice(0, 7) ? 'warn' : 'pale'} small">${ym === B.today.slice(0, 7) ? '<b>今月分は入力期間中です。</b>審判員への公開は翌月1日です。' : '審判員にも公開されています。'}「修正」や未測定の名前から、委員会が記録を入力・修正できます。</div>
    ${rankTables(r, true)}`);
};
function cfEdit(memberId, month) {
  openModal({ title: `${ymLabel(month)}の記録を入力・修正`, body: fitForm({ date: '', yoyo: '', d: ['', '', '', '', '', ''] }, month), foot: `<button class="btn primary" onclick="ftSave('${memberId}','${month}')">保存</button>` });
  call('api_fitnessResults', month).then((r) => {
    const x = r.dash.find((y) => y.memberId === memberId) || r.yoyo.find((y) => y.memberId === memberId);
    if (x) { $('#ft-date').value = x.date || ''; $('#ft-yoyo').value = x.yoyo ?? ''; (x.d || []).forEach((v, i) => { if ($$('.ft-d')[i]) $$('.ft-d')[i].value = v ?? ''; }); ftCalc(); }
  }).catch(() => {});
}

/* ───────── 委員会：審判員カルテ ───────── */
ROUTES.c_karte = async (id) => {
  head('審判員カルテ');
  const r = await get('api_karte', id || '');
  if (!r.member) {
    window.KR = r.refs;
    setMain(`<div class="search"><input type="search" placeholder="名前でさがす" oninput="krFilter(this.value)"></div><div id="kr"></div>`);
    return krFilter('');
  }
  head('審判員カルテ', ['c_karte'], `<select onchange="go('c_karte',this.value)" style="width:auto;min-width:150px">${r.refs.map((x) => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${h(x.name)}${x.active ? '' : '（退会）'}</option>`).join('')}</select>`);
  const m = r.member, rep = r.reports;
  setMain(`<div class="card"><div class="b" style="font-size:20px">${h(m.name)}</div><div class="small muted">${[m.affil, m.grade, m.mail].filter(Boolean).map(h).join('　')}</div></div>
    ${annualStats(rep.annual) || ''}
    <h2>レポート（${rep.list.length}件）</h2>${rep.list.length ? `<div class="list">${rep.list.map((x) => matchLi(x, `<div style="text-align:right"><div class="small muted">${h(x.role)}</div><div class="b blue num" style="font-size:18px">${scoreText(x.score)}</div></div>`, `go('report','${x.id}')`)).join('')}</div>` : empty('レポートはまだありません')}
    <h2>割当履歴（${r.assignments.length}件）</h2>${r.assignments.length ? `<div class="list">${r.assignments.map((x) => matchLi(x, `<span class="pill">${h(x.role)}</span>`)).join('')}</div>` : empty('割当はありません')}
    <h2>体力テスト</h2>${r.fitness.length ? `<div class="tbl"><table><thead><tr><th>月</th><th class="num">Yo-Yo</th><th class="num">40m平均</th><th class="num">最速</th><th class="num">最遅</th></tr></thead><tbody>${r.fitness.map((x) => `<tr><td>${ymLabel(x.month)}</td><td class="num">${x.yoyo}</td><td class="num b">${fmt2(x.avg)}</td><td class="num">${fmt2(x.min)}</td><td class="num">${fmt2(x.max)}</td></tr>`).join('')}</tbody></table></div>` : empty('記録はありません')}`);
};
function krFilter(q) {
  const list = window.KR.filter((x) => !q || x.name.includes(q));
  $('#kr').innerHTML = list.length ? `<div class="list">${list.map((x) => `<a href="#" class="li" onclick="go('c_karte','${x.id}');return false;">${icon('karte')}<div class="main"><div class="t">${h(x.name)}</div>${x.active ? '' : '<div class="s">退会</div>'}</div><span class="chev">›</span></a>`).join('')}</div>` : empty('見つかりませんでした');
}

/* ───────── 委員会：マスタ ───────── */
let MS = null, MS_Q = '', MS_F = '';
const MASTER_TABS = ['メンバー', '会場', '地区協会', 'チーム', '設定'];
const MASTER_HELP = {
  'メンバー': '強化審判員・アセッサー・委員会のメンバーです。1人が複数の役割を持てます。保存すると個人ページのURLが自動で発行されます。退会した人は削除せず「在籍」を外してください。',
  '会場': '会場ごとに、所在地の地区協会を登録します。派遣依頼の宛先になります。',
  '地区協会': '派遣依頼の宛先です。',
  'チーム': '試合に出るチームです。ここに登録した名前は、試合一覧でチーム名を入れるときの候補になります。保存するとチーム専用の映像提供ページURLが発行されます。',
  '設定': 'PAGE_URL は、この画面（GitHub Pages）のURLです。メールに載せる個人ページURLの元になります。',
};
ROUTES.c_master = async (name) => {
  head('マスタ');
  name = name || 'メンバー';
  if (MS && MS.name !== name) { MS_Q = ''; MS_F = ''; }
  MS = await get('api_master', name);
  if (name === '会場') MS.assocs = (await get('api_master', '地区協会')).rows.map((r) => r['協会名']);
  renderMaster();
};
function msCols() {
  const cols = MS.headers.filter((k) => k !== 'トークン' && k !== '個人ページURL' && k !== 'ID' && !(MS.name === '設定' && k === '説明'));
  // チームは「所属リーグ」をチーム名のすぐ後ろに出す
  if (cols.includes('所属リーグ')) { cols.splice(cols.indexOf('所属リーグ'), 1); cols.splice(1, 0, '所属リーグ'); }
  return cols;
}
/* まとめて追加：Excel などから1行1件で貼り付ける（列はタブ区切り。同じ名前がすでにあれば飛ばす） */
function bulkCols() { return MS.name === 'チーム' ? ['チーム名', '所属リーグ'] : msCols().filter((k) => !MS.bools.includes(k)); }
function msBulk() {
  const cols = bulkCols();
  openModal({ title: MS.name + 'をまとめて追加', wide: true, body: `
    <p class="small">1行に1件ずつ貼り付けてください。Excel から列ごとコピーすると、次の順に読み取ります。2列目以降は空でもかまいません。</p>
    <div class="tbl"><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead></table></div>
    <textarea id="mb-text" style="min-height:240px" placeholder="${MS.name === 'チーム' ? '例）札幌大学　北海道学生サッカーリーグ1部' : ''}" oninput="msBulkPrev()"></textarea>
    <div id="mb-prev" class="small muted" style="margin-top:6px"></div>
    ${MS.name === 'メンバー' ? '<p class="small muted">メンバーは「審判員」「在籍」にチェックが入った状態で追加されます。アセッサー・委員会は追加後に1人ずつ設定してください。</p>' : ''}`,
    foot: `<button class="btn" onclick="closeModal()">やめる</button><button class="btn primary" onclick="msBulkSave()">追加する</button>` });
}
function msBulkRows() {
  const cols = bulkCols(), key = cols[0];
  const have = new Set(MS.rows.map((r) => String(r[key] || '').trim()));
  const seen = new Set(), add = [], dup = [];
  $('#mb-text').value.split(/\r?\n/).forEach((line) => {
    const c = line.split('\t').map((x) => x.trim());
    if (!c[0]) return;
    if (have.has(c[0]) || seen.has(c[0])) { dup.push(c[0]); return; }
    seen.add(c[0]);
    const o = {}; MS.headers.forEach((k) => (o[k] = MS.bools.includes(k) ? (k === '在籍' || k === '審判員') : ''));
    cols.forEach((k, i) => (o[k] = c[i] || ''));
    add.push(o);
  });
  return { add, dup };
}
function msBulkPrev() { const { add, dup } = msBulkRows(); $('#mb-prev').innerHTML = `追加 ${add.length}件${dup.length ? `　<span class="red">すでにある・重複のため飛ばす ${dup.length}件（${dup.slice(0, 5).map(h).join('、')}${dup.length > 5 ? '…' : ''}）</span>` : ''}`; }
async function msBulkSave() {
  const { add } = msBulkRows();
  if (!add.length) return toast('追加するものがありません', true);
  try { MS = Object.assign(await call('api_saveMaster', MS.name, MS.rows.concat(add)), { assocs: MS.assocs }); closeModal(); renderMaster(); toast(add.length + '件追加しました'); } catch (e) { fail(e); }
}
function renderMaster() {
  const name = MS.name;
  const tabs = `<div style="margin-bottom:8px">${MASTER_TABS.map((t) => `<button class="chip ${t === name ? 'on' : ''}" onclick="go('c_master','${t}')">${t}</button>`).join('')}</div>`;
  if (name === '設定') {
    setMain(`${tabs}<p class="lead">${MASTER_HELP[name]}</p><div class="card">${MS.rows.map((r, i) => `<div class="field"><label>${h(r['キー'])}</label><input value="${h(r['値'])}" oninput="MS.rows[${i}]['値']=this.value">${r['説明'] ? `<div class="hint">${h(r['説明'])}</div>` : ''}</div>`).join('')}
      <button class="btn primary" onclick="msSave()">保存</button></div>`);
    return;
  }
  const isM = name === 'メンバー';
  const first = msCols()[0];
  const roleP = (r) => ['審判員', 'アセッサー', '委員会'].filter((k) => r[k] === true || r[k] === 'TRUE').map((k) => `<span class="pill ${k === '審判員' ? 'ok' : ''}">${k}</span>`).join(' ');
  const active = (r) => r['在籍'] === true || r['在籍'] === 'TRUE';
  const cnt = (f) => MS.rows.filter((r) => f === '退会' ? !active(r) : active(r) && (r[f] === true || r[f] === 'TRUE')).length;
  setMain(`${tabs}<p class="lead">${MASTER_HELP[name]}</p>
    <div class="row" style="margin-bottom:8px"><div class="search" style="flex:1;min-width:200px;margin:0"><input type="search" placeholder="さがす" value="${h(MS_Q)}" oninput="MS_Q=this.value;msList()"></div>${Object.keys(MS.urls).length ? '<button class="btn" id="ms-copyall" onclick="msCopyAll()">URLをまとめてコピー</button>' : ''}<button class="btn" onclick="msBulk()">まとめて追加</button><button class="btn primary" onclick="msEdit(-1)">＋ 追加</button></div>
    ${isM ? `<div style="margin-bottom:4px">${[['', 'すべて'], ['審判員', '審判員'], ['アセッサー', 'アセッサー'], ['委員会', '委員会'], ['退会', '退会']].map(([k, l]) => `<button class="chip ${MS_F === k ? 'on' : ''}" onclick="MS_F='${k}';renderMaster()">${l}${k ? ` ${cnt(k)}` : ''}</button>`).join('')}</div>` : ''}
    <div id="ms-list"></div>`);
  window.msList = () => {
    const rs = MS.rows.map((r, i) => [r, i]).filter(([r]) => (!MS_Q || Object.values(r).join(' ').includes(MS_Q)) &&
      (!isM || !MS_F || (MS_F === '退会' ? !active(r) : active(r) && (r[MS_F] === true || r[MS_F] === 'TRUE'))));
    // まとめてコピーの対象：表示中の行のうちURLがある人（退会者は「退会」で絞ったときだけ）
    MS.shown = rs.filter(([r, i]) => MS.urls[i] && (!isM || MS_F === '退会' || active(r))).map(([, i]) => i);
    if ($('#ms-copyall')) $('#ms-copyall').textContent = `URLをまとめてコピー（${MS.shown.length}${isM ? '人' : '件'}）`;
    $('#ms-list').innerHTML = rs.length ? `<div class="list">${rs.map(([r, i]) => `<a href="#" class="li ${isM && !active(r) ? '' : ''}" onclick="msEdit(${i});return false;">
      <div class="main"><div class="t">${h(r[first]) || '<span class="muted">（名前なし）</span>'}${isM && !active(r) ? ' <span class="pill">退会</span>' : ''}</div>
      <div class="s">${msCols().slice(1).filter((k) => !MS.bools.includes(k) && r[k]).map((k) => h(r[k])).join('　')}</div>${isM ? `<div style="margin-top:2px">${roleP(r)}</div>` : ''}</div>
      ${MS.urls[i] ? `<button class="btn sm" onclick="event.preventDefault();event.stopPropagation();copyText(MS.urls[${i}])">URLをコピー</button>` : ''}<span class="chev">›</span></a>`).join('')}</div>` : empty('登録がありません');
  };
  msList();
}
// 「氏名・メール・URL」をタブ区切りでコピー（Excel やメールにそのまま貼れる）
function msCopyAll() {
  const first = msCols()[0];
  const lines = (MS.shown || []).map((i) => [MS.rows[i][first], MS.rows[i]['メール'] || '', MS.urls[i]].join('\t'));
  if (!lines.length) return toast('コピーできるURLがありません', true);
  copyText(lines.join('\n'));
}
function msEdit(i) {
  const isNew = i < 0;
  const r = isNew ? (() => { const o = {}; MS.headers.forEach((k) => (o[k] = MS.bools.includes(k) ? k === '在籍' : '')); return o; })() : MS.rows[i];
  const cols = msCols();
  const field = (k) => {
    if (MS.bools.includes(k)) return '';
    const list = MS.name === '会場' && k === '地区協会' ? `<select id="mf-${k}"><option value="">選択</option>${(MS.assocs || []).map((a) => `<option ${a === r[k] ? 'selected' : ''}>${h(a)}</option>`).join('')}</select>` : '';
    return `<div class="field"><label>${k}</label>${list || `<input id="mf-${k}" value="${h(r[k])}" ${k === 'メール' ? 'type="email" inputmode="email"' : ''}>`}</div>`;
  };
  const bools = MS.bools.length ? `<div class="field"><label>役割</label>${MS.bools.map((k) => `<label class="row" style="padding:8px 0;border-bottom:1px solid var(--line);cursor:pointer"><input type="checkbox" id="mf-${k}" ${r[k] === true || r[k] === 'TRUE' ? 'checked' : ''}><span>${k}${k === '在籍' ? '<span class="small muted">（外すと退会扱い。過去の記録は残ります）</span>' : ''}</span></label>`).join('')}</div>` : '';
  const url = !isNew && MS.urls[i] ? `<div class="card pale"><div class="small muted">${MS.name === 'チーム' ? '映像提供ページ' : '個人ページ'}のURL（本人にだけ送ってください）</div>
    <div class="row" style="margin-top:6px"><button class="btn sm primary" onclick="copyText(MS.urls[${i}])">URLをコピー</button><button class="btn sm ghost" onclick="msReissue(${i})">URLを作り直す</button></div></div>` : '';
  openModal({ title: isNew ? MS.name + 'を追加' : h(r[cols[0]] || '編集'), body: `${cols.map(field).join('')}${bools}${url}
    ${!isNew ? `<button class="btn danger sm" style="margin-top:8px" onclick="msDel(${i})">削除</button>` : ''}`,
    foot: `<button class="btn" onclick="closeModal()">やめる</button><button class="btn primary" onclick="msSaveOne(${i})">保存</button>` });
}
async function msSaveOne(i) {
  const r = i < 0 ? {} : Object.assign({}, MS.rows[i]);
  MS.headers.forEach((k) => { const el = $('#mf-' + k); if (!el) { if (r[k] === undefined) r[k] = ''; return; } r[k] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
  const rows = MS.rows.slice(); if (i < 0) rows.push(r); else rows[i] = r;
  try { MS = Object.assign(await call('api_saveMaster', MS.name, rows), { assocs: MS.assocs }); closeModal(); renderMaster(); toast('保存しました'); } catch (e) { fail(e); }
}
async function msDel(i) {
  if (MS.name === 'メンバー' && !confirm('削除すると、過去の記録に名前が表示されなくなります。退会した人は「在籍」を外すのがおすすめです。それでも削除しますか？')) return;
  if (MS.name !== 'メンバー' && !confirm('削除しますか？')) return;
  const rows = MS.rows.filter((_, j) => j !== i);
  try { MS = Object.assign(await call('api_saveMaster', MS.name, rows), { assocs: MS.assocs }); closeModal(); renderMaster(); toast('削除しました'); } catch (e) { fail(e); }
}
async function msReissue(i) {
  if (!confirm('今のURLは使えなくなり、新しいURLが発行されます。URLが漏れたときに使います。作り直しますか？')) return;
  const rows = MS.rows.slice(); rows[i] = Object.assign({}, rows[i], { 'トークン': '' });
  try { MS = Object.assign(await call('api_saveMaster', MS.name, rows), { assocs: MS.assocs }); closeModal(); renderMaster(); msEdit(i); toast('新しいURLを発行しました'); } catch (e) { fail(e); }
}
async function msSave() {
  try { MS = await call('api_saveMaster', MS.name, MS.rows); renderMaster(); toast('保存しました'); } catch (e) { fail(e); }
}

/* ───────── チーム：映像提供 ───────── */
let TM = null;
ROUTES.team = async () => { head('試合映像の提供'); TM = await get('api_teamHome'); renderTeam(); };
function renderTeam() {
  head(TM.team + '　試合映像の提供');
  const todo = TM.matches.filter((m) => !m.videos.length).length;
  const parts = B.consts.PARTS || ['試合全体'];
  setMain(`<div class="card pale"><p style="margin:0 0 6px"><b>試合映像のご提供ありがとうございます。</b></p>
    <ol class="small" style="margin:0;padding-left:20px"><li>YouTubeに<b>「限定公開」</b>でアップロード</li><li>そのURLを下の試合の欄に貼り付けて「登録」</li></ol>
    <p class="small" style="margin:8px 0 0"><b>Veo をお使いの場合</b>：試合を「公開」にした共有リンクをそのまま貼り付けても登録できます。できれば Veo からダウンロードした MP4 を YouTube に「限定公開」で上げていただくと、研修で場面ごとの解説に使えるので助かります（両方の登録もできます）。</p>
    <p class="small muted" style="margin:8px 0 0">映像が前半・後半などに分かれているときは、区分を選んで1本ずつ登録してください（見るときは自動でつないで再生されます）。映像は北海道の強化審判員の研修だけに使います。研修教材として使う場合があるため、登録した映像は削除しないようお願いします。</p></div>
    ${TM.matches.length ? `<h2>${todo ? `未登録 ${todo}試合` : 'すべて登録済みです'}</h2>${TM.matches.map((m, i) => `<div class="mcard"><div class="mhead">${dateBox(m.date)}<div class="main"><div class="t">${card(m)}</div><div class="s">${h(m.comp)} ${h(m.name)}</div></div>${m.videos.length ? `<span class="pill ok">${m.videos.length}本 登録済み</span>` : ''}</div>
      <div style="padding:12px 16px">
        ${m.videos.map((v) => `<div class="row" style="margin-bottom:8px"><span class="pill">${h(v.part)}</span><a class="small" href="${h(v.url)}" target="_blank" rel="noopener">${v.veo ? 'Veo' : 'YouTube'}で確認</a><span class="spacer"></span><button class="btn sm ghost" onclick="tmDel('${v.id}')">取り消す</button></div>`).join('')}
        <div class="row" style="flex-wrap:nowrap;gap:6px"><select id="tm-p-${i}" style="width:auto;flex:none">${parts.map((p) => `<option ${m.videos.some((v) => v.part === p) ? 'data-used="1"' : ''}>${p}</option>`).join('')}</select>
        <input id="tm-${i}" type="url" inputmode="url" placeholder="YouTube か Veo の URL" style="flex:1;min-width:0"><button class="btn primary" onclick="tmSave(${i})">${m.videos.length ? '追加' : '登録'}</button></div></div></div>`).join('')}`
    : empty('登録できる試合はまだありません')}`);
  // 区分は、まだ登録していないものを最初に選んでおく（同じ区分の YouTube と Veo を両方登録することもできる）
  TM.matches.forEach((m, i) => { const sel = $('#tm-p-' + i); if (sel) { const o = [...sel.options].find((x) => !x.dataset.used); if (o) sel.value = o.value; } });
}
async function tmSave(i) {
  if (!$('#tm-' + i).value.trim()) return toast('URLを貼り付けてください', true);
  try { TM = await call('api_teamSaveVideo', TM.matches[i].id, $('#tm-' + i).value, $('#tm-p-' + i).value); renderTeam(); toast('登録しました。ありがとうございます'); } catch (e) { fail(e); }
}
async function tmDel(id) {
  if (!confirm('この映像の登録を取り消しますか？')) return;
  try { TM = await call('api_teamDelVideo', id); renderTeam(); toast('取り消しました'); } catch (e) { fail(e); }
}

/* ───────── 起動 ───────── */
(async function init() {
  try {
    // 最初の画面がホームなら、起動情報とホームのデータを同時に取りに行く
    if (!START_PAGE || START_PAGE === 'home') fetchMemo('api_home', []).catch(() => {});
    B = await call('api_boot');
    try { if (localStorage.getItem('navhide') && B.ctx.kind !== 'team') navToggle(true); } catch (e) {}
    let page = START_PAGE, arg = START_ARG;
    if (page === 'c_report') page = 'report';
    go(page || (B.ctx.kind === 'team' ? 'team' : 'home'), arg || undefined);
  } catch (e) {
    $('#side').hidden = true; $('#tabbar').hidden = true; $('.wrap').style.marginLeft = '0';
    head('北海道 強化審判員システム');
    setMain(`<div class="card warn"><h2 style="margin-top:0">ページを開けませんでした</h2><p>${h((e && e.message) || e)}</p><p class="small muted" style="margin:0">メールに記載された個人ページのURLから開いてください。</p></div>`);
  }
})();
