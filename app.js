/* ───────── 基本 ───────── */
let B = null;            // 起動時の情報（本人・ロール・定数）
let CUR = '';            // 表示中のページ
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
  const j = await res.json().catch(() => ({ ok: false, error: 'サーバーの応答を読み取れませんでした。' }));
  if (!j.ok) throw new Error(j.error || 'エラーが発生しました。');
  return j.result;
}
function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = 'toast'), err ? 6000 : 2500);
}
function fail(e) { toast((e && e.message) || String(e), true); }
function setMain(html) { $('#main').innerHTML = html; }
function md(d) { return d ? Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)) : ''; }
function dl(d) { if (!d) return ''; const w = new Date(d + 'T00:00:00').getDay(); return md(d) + '(' + WD[w] + ')'; }
function ymLabel(ym) { return ym ? ym.slice(0, 4) + '年' + Number(ym.slice(5, 7)) + '月' : ''; }
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
  const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('コピーしました'); } catch (e) { toast('コピーできませんでした', true); }
  ta.remove();
}
function openModal(html) { $('#modal-body').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { destroyPlayer('modal'); $('#modal').hidden = true; $('#modal-body').innerHTML = ''; }
function monthSelect(id, months, cur, onchange) {
  return `<select id="${id}" onchange="${onchange}">${months.map((m) => `<option value="${m}" ${m === cur ? 'selected' : ''}>${ymLabel(m)}</option>`).join('')}</select>`;
}
function badge(status) {
  const cls = status === '提出済' ? 'ok' : status === '下書き' || status === '未作成' ? 'ng' : '';
  return `<span class="badge ${cls}">${h(status)}</span>`;
}

/* ───────── ナビゲーション ───────── */
function navItems() {
  const c = B.ctx, items = [];
  if (c.kind === 'team') return [['チーム', [['team', '映像の提供']]]];
  const mine = [['home', 'マイページ']];
  if (c.ref) mine.push(['survey', '稼働調査'], ['myreports', 'レポート'], ['fitness', '体力テスト']);
  items.push(['個人', mine]);
  if (c.asr) items.push(['アセッサー', [['assess', '担当試合']]]);
  items.push(['共有', [['table', '割当表'], ['videos', '試合映像'], ['cases', '事例ライブラリ']]]);
  if (c.com) items.push(['委員会', [['c_matches', '試合一覧'], ['c_survey', '稼働状況'], ['c_assign', '割当'], ['c_dispatch', '派遣依頼'],
    ['c_reports', 'レポート'], ['c_fitness', '体力テスト結果'], ['c_karte', '審判員カルテ'], ['c_master', 'マスタ']]]);
  return items;
}
const PARENT = { myreport: 'myreports', report: 'assess', video: 'videos', c_report: 'c_reports' };
function renderNav() {
  let on = PARENT[CUR] || CUR;
  if (CUR === 'report') on = B.ctx.asr ? 'assess' : 'c_reports';
  $('#nav').innerHTML = navItems().map(([g, list]) => `<span class="grp">${g}</span>` +
    list.map(([k, label]) => `<a href="#" class="${k === on ? 'on' : ''}" onclick="go('${k}');return false;">${label}</a>`).join('')).join('');
}
function go(page, arg) {
  if (!ROUTES[page]) page = B.ctx.kind === 'team' ? 'team' : 'home';
  CUR = page; renderNav(); destroyPlayer('main');
  try { const q = new URLSearchParams({ t: TOKEN, p: page }); if (arg) q.set('a', arg); history.replaceState(null, '', '?' + q.toString()); } catch (e) {}
  setMain('<p class="muted">読み込み中…</p>');
  window.scrollTo(0, 0);
  Promise.resolve(ROUTES[page](arg)).catch((e) => { setMain(`<p class="alert">${h((e && e.message) || e)}</p>`); });
}

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
    const pv = { playsinline: 1, rel: 0, modestbranding: 1 };
    if (opt.start) pv.start = opt.start;
    if (opt.end) pv.end = opt.end;
    PLAYERS[slot] = { yt: new YT.Player(elId, { videoId: yt, playerVars: pv }), id: yt };
  } else {
    el.innerHTML = `<iframe src="https://www.youtube.com/embed/${yt}?playsinline=1&start=${opt.start || 0}${opt.end ? '&end=' + opt.end : ''}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    PLAYERS[slot] = { el: el, id: yt };
  }
}
function destroyPlayer(slot) { const p = PLAYERS[slot]; if (p && p.yt && p.yt.destroy) { try { p.yt.destroy(); } catch (e) {} } delete PLAYERS[slot]; }
function curTime(slot = 'main') { const p = PLAYERS[slot]; return p && p.yt && p.yt.getCurrentTime ? Math.floor(p.yt.getCurrentTime()) : 0; }
function seek(sec, slot = 'main') {
  const p = PLAYERS[slot]; if (!p) return;
  if (p.yt && p.yt.seekTo) { p.yt.seekTo(sec, true); if (p.yt.playVideo) p.yt.playVideo(); }
  else if (p.el) p.el.innerHTML = `<iframe src="https://www.youtube.com/embed/${p.id}?autoplay=1&playsinline=1&start=${sec}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
  if (slot === 'main') $('#player-anchor') && $('#player-anchor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function pausePlayer(slot = 'main') { const p = PLAYERS[slot]; if (p && p.yt && p.yt.pauseVideo) p.yt.pauseVideo(); }

/* Key Incidents の「時間」→ 映像の秒（キックオフ位置・後半開始位置が登録されている場合） */
function kiToSec(time, video, halfLen) {
  if (!video || video.ko === null) return null;
  const m = String(time || '').replace(/[＋]/g, '+').match(/(\d+)\s*(?:\+\s*(\d+))?/);
  if (!m) return null;
  const base = Number(m[1]), extra = Number(m[2] || 0), half = halfLen || 45;
  if (base <= half) return video.ko + Math.max(0, base - 1 + extra) * 60;
  if (video.h2 === null) return null;
  return video.h2 + Math.max(0, base - half - 1 + extra) * 60;
}

/* ───────── 個人：マイページ ───────── */
ROUTES.home = async () => {
  const r = await call('api_home');
  const n = r.notices.map((x) => `<a class="notice" href="#" onclick="go('${x.page}');return false;">${h(x.text)}</a>`).join('');
  const up = r.upcoming.length ? `<div class="tbl-wrap"><table><tr><th>日付</th><th>KO</th><th>大会・試合</th><th>対戦</th><th>会場</th><th>担当</th></tr>${r.upcoming.map((m) =>
    `<tr><td>${dl(m.date)}</td><td>${h(m.ko)}</td><td>${h(m.comp)}<div class="small muted">${h(m.name)}</div></td><td>${card(m)}</td><td>${h(m.venue)}</td><td><b>${h(m.role)}</b></td></tr>`).join('')}</table></div>`
    : '<p class="muted">公開されている今後の担当試合はありません。</p>';
  setMain(`<h1>${h(B.ctx.name)} さん</h1><p class="lead">${[B.ctx.ref && '強化審判員', B.ctx.asr && 'アセッサー', B.ctx.com && '委員会'].filter(Boolean).join('・')}</p>
    ${n ? `<h2>お知らせ</h2>${n}` : ''}<h2>今後の担当試合</h2>${up}`);
};

/* ───────── 個人：稼働調査 ───────── */
let SV = null;
ROUTES.survey = async (ym) => {
  SV = await call('api_survey', ym || '');
  if (!SV.month || !SV.matches.length) return setMain('<h1>稼働調査</h1><p class="muted">公開中の稼働調査はありません。毎月10日に翌月の試合一覧が公開されます。</p>');
  const rows = SV.matches.map((m, i) => `<div class="card">
    <div class="row"><b>${dl(m.date)} ${h(m.ko)}</b><span class="muted small">${h(m.venue)}</span></div>
    <div class="small">${h(m.comp)} ${h(m.name)}</div><div>${card(m)}</div>
    <div class="row" style="margin-top:8px">
      <div class="seg">${['○', '△', '×'].map((a) => `<button class="${m.ans === a ? 'on' : ''}" ${SV.open ? '' : 'disabled'} onclick="svSet(${i},'${a}',this)">${a}</button>`).join('')}</div>
      <input placeholder="備考（△の理由など）" value="${h(m.note)}" ${SV.open ? '' : 'disabled'} oninput="SV.matches[${i}].note=this.value" style="flex:1;min-width:160px">
    </div></div>`).join('');
  const answered = SV.matches.filter((m) => m.ans).length;
  setMain(`<h1>${ymLabel(SV.month)}の稼働調査</h1>
    <p class="lead">試合ごとに ○（行ける）／△（条件付き）／×（行けない）を選んでください。締切：${md(SV.deadline)}　${SV.open ? '' : '<b>締切を過ぎたため変更できません</b>'}</p>
    <p class="small" id="sv-count">${answered}／${SV.matches.length}試合 回答済み</p>
    ${rows}
    ${SV.open ? `<div class="sticky-actions"><button class="btn primary" onclick="svSave()">回答を保存</button><span class="small muted" style="align-self:center">保存すると締切までは何度でも変更できます</span></div>` : ''}`);
};
function svSet(i, a, el) {
  const m = SV.matches[i]; m.ans = m.ans === a ? '' : a;
  el.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.textContent === m.ans));
  $('#sv-count').textContent = SV.matches.filter((x) => x.ans).length + '／' + SV.matches.length + '試合 回答済み';
}
async function svSave() {
  try { await call('api_saveSurvey', SV.month, SV.matches.map((m) => ({ id: m.id, ans: m.ans, note: m.note }))); toast('保存しました'); }
  catch (e) { fail(e); }
}

/* ───────── 共有：割当表 ───────── */
ROUTES.table = async (ym) => {
  const r = await call('api_assignTable', ym || '');
  if (!r.month) return setMain('<h1>割当表</h1><p class="muted">公開されている割当はまだありません。</p>');
  const roles = B.consts.ROLES;
  const body = r.matches.map((m) => `<tr class="${roles.some((x) => m['mine_' + x]) ? 'me' : ''}"><td>${dl(m.date)}<div class="small muted">${h(m.ko)}</div></td>
    <td>${h(m.comp)}<div class="small muted">${h(m.name)}</div></td><td>${card(m)}<div class="small muted">${h(m.venue)}</div></td>
    ${roles.map((x) => `<td class="${m['mine_' + x] ? '' : ''}">${m['mine_' + x] ? '<b>' + h(m.slots[x]) + '</b>' : h(m.slots[x])}</td>`).join('')}</tr>`).join('');
  setMain(`<div class="row"><h1>割当表</h1><span class="spacer"></span>${monthSelect('tb-m', r.months, r.month, "go('table',this.value)")}</div>
    ${r.published ? '' : '<p class="alert">この月の割当はまだ公開していません（委員会のみ表示）</p>'}
    <div class="tbl-wrap"><table><tr><th>日付</th><th>大会・試合</th><th>対戦・会場</th>${roles.map((x) => `<th>${x}</th>`).join('')}</tr>${body}</table></div>`);
};

/* ───────── 個人：レポートと年間評価 ───────── */
ROUTES.myreports = async () => {
  const r = await call('api_myReports');
  const annual = r.annual.length ? r.annual.map((a) => `<div class="card hl" style="display:inline-block;min-width:180px;margin-right:8px">
      <div class="small muted">${a.year}年 年間評価</div><div class="score">${a.avg.toFixed(2)}</div><div class="small muted">${a.n}試合の平均</div></div>`).join('')
    : '<p class="muted">まだレポートはありません。</p>';
  const list = r.list.map((m) => `<tr><td>${dl(m.date)}</td><td>${h(m.comp)}</td><td>${card(m)}</td><td>${h(m.role)}</td>
    <td class="num">${m.score === null ? '—' : m.score.toFixed(1)}</td><td><a href="#" onclick="go('myreport','${m.id}');return false;">開く</a></td></tr>`).join('');
  setMain(`<h1>アセスメントレポート</h1><p class="lead">年間評価は、その年に受けたレポートの評価点（例外の評価点があればそちら）の平均です。</p>
    ${annual}${r.list.length ? `<h2>受け取ったレポート</h2><div class="tbl-wrap"><table><tr><th>日付</th><th>大会</th><th>対戦</th><th>担当</th><th class="num">評価点</th><th></th></tr>${list}</table></div>` : ''}`);
};

function sectionRO(role, sec, crewName) {
  const C = B.consts;
  if (role === '第4審') return `<h3>第4の審判員 ${h(crewName || '')}</h3><p class="pre">${h(sec.comment || '（記載なし）')}</p>`;
  const items = role === '主審' ? C.REF_ITEMS : C.AR_ITEMS;
  const it = sec.items || {};
  const body = items.map((x) => role === '主審'
    ? `<div class="item-head">${x.k}　${h(x.t)}</div><div class="grid2"><div><div class="small muted">良かった点</div><p class="pre">${h((it[x.k] || {}).good || '')}</p></div><div><div class="small muted">課題点</div><p class="pre">${h((it[x.k] || {}).bad || '')}</p></div></div>`
    : `<div class="item-head">${x.k}　${h(x.t)}</div><p class="pre">${h(it[x.k] || '')}</p>`).join('');
  const ad = sec.exception !== '' && sec.exception !== undefined && sec.exception !== null ? sec.exception : sec.score;
  return `<h3>${h(role)} ${h(crewName || '')}</h3>
    <div class="row" style="gap:24px;margin:8px 0"><div><div class="small muted">評価点</div><div class="score">${ad !== undefined && ad !== '' ? Number(ad).toFixed(1) : '—'}</div></div>
    <dl class="kv"><dt>難易度</dt><dd>${h(sec.diff || '')}</dd><dt>全体のパフォーマンス</dt><dd>${h(sec.perf || '')}</dd>${sec.exception !== '' && sec.exception !== undefined ? `<dt>例外の評価点</dt><dd>${h(sec.exception)}</dd>` : ''}</dl></div>
    ${body}
    ${role === '主審' ? `<div class="item-head">アドバイス</div><p class="pre">${h(sec.advice || '')}</p>` : ''}
    <div class="item-head">難易度の理由</div><p class="pre">${h(sec.reason || '')}</p>
    ${sec.note ? `<div class="item-head">特記事項</div><p class="pre">${h(sec.note)}</p>` : ''}`;
}
function infoRO(match, info, assessor, date) {
  const sc = info.sc || {};
  const t = (a, b) => (a === '' || a === undefined ? '-' : a) + ' - ' + (b === '' || b === undefined ? '-' : b);
  const total = (k) => ['1', '2', 'e1', 'e2'].reduce((s, x) => s + (Number(sc[k + x]) || 0), 0);
  return `<dl class="kv"><dt>大会</dt><dd>${h(match.comp)} ${h(match.name)}</dd><dt>試合日</dt><dd>${dl(match.date)} ${h(match.ko)}</dd>
    <dt>会場</dt><dd>${h(match.venue)}</dd><dt>対戦</dt><dd>${card(match)}</dd>
    <dt>結果</dt><dd><b>${total('a')} - ${total('b')}</b>　（前半 ${t(sc.a1, sc.b1)}／後半 ${t(sc.a2, sc.b2)}${sc.ae1 !== undefined && sc.ae1 !== '' ? `／延長前半 ${t(sc.ae1, sc.be1)}／延長後半 ${t(sc.ae2, sc.be2)}` : ''}${sc.apk !== undefined && sc.apk !== '' ? `／PK ${t(sc.apk, sc.bpk)}` : ''}）</dd>
    <dt>試合時間</dt><dd>${h(info.time || '')}分${info.ext ? '（延長 ' + h(info.ext) + '分）' : ''}</dd>
    <dt>アセッサー</dt><dd>${h(assessor || '')}</dd><dt>記入日</dt><dd>${h(date || info.date || '')}</dd></dl>
    ${info.ops ? `<div class="item-head">運営上の問題点</div><p class="pre">${h(info.ops)}</p>` : ''}`;
}
function kiRO(ki, videos, halfLen) {
  const list = (ki || []).filter((k) => k && (k.time || k.text));
  if (!list.length) return '';
  const v = (videos || []).find((x) => x.ko !== null);
  return `<h3>Key Incidents</h3><table><tr><th>時間</th><th>内容</th><th></th></tr>${list.map((k) => {
    const s = kiToSec(k.time, v, halfLen);
    return `<tr><td>${h(k.time)}</td><td class="pre">${h(k.text)}</td><td>${s !== null ? `<a href="#" onclick="go('video','${v.id}@${s}');return false;">映像</a>` : ''}</td></tr>`;
  }).join('')}</table>`;
}

ROUTES.myreport = async (matchId) => {
  const r = await call('api_myReport', matchId);
  const half = r.info.time ? Number(r.info.time) / 2 : 45;
  setMain(`<p><a href="#" onclick="go('myreports');return false;">← レポート一覧</a></p><h1>アセスメントレポート</h1>
    <div class="card">${infoRO(r.match, r.info, r.assessor, r.date)}</div>
    ${r.roles.map((role) => `<div class="card">${sectionRO(role, r.sections[role])}</div>`).join('')}
    ${r.videos.length ? `<p>${r.videos.map((v) => `<a class="btn sm" href="#" onclick="go('video','${v.id}');return false;">試合映像（${h(v.team)}提供）</a>`).join(' ')}</p>` : ''}
    <div class="card">${kiRO(r.ki, r.videos, half) || '<p class="muted">Key Incidentsはありません。</p>'}</div>`);
};

/* ───────── 個人：体力テスト ───────── */
let FT = null;
ROUTES.fitness = async () => {
  FT = await call('api_fitness');
  const c = FT.current || { date: '', yoyo: '', d: ['', '', '', '', '', ''] };
  const hist = FT.history.map((x) => `<tr><td>${ymLabel(x.month)}</td><td class="num">${x.yoyo}</td><td class="num">${fmt2(x.avg)}</td><td class="num">${fmt2(x.min)}</td><td class="num">${fmt2(x.max)}</td></tr>`).join('');
  setMain(`<h1>体力テスト</h1><p class="lead">${ymLabel(FT.month)}分の入力締切：${md(FT.deadline)}。全体の結果は翌月1日に公開されます。</p>
    ${B.ctx.ref ? `<div class="card">${fitForm(c, FT.month)}<div class="row" style="margin-top:12px"><button class="btn primary" onclick="ftSave()">保存</button>${FT.current ? '<span class="badge ok">入力済み</span>' : ''}</div></div>` : ''}
    ${hist ? `<h2>自分の推移</h2><div class="tbl-wrap"><table><tr><th>月</th><th class="num">Yo-Yo（本）</th><th class="num">40m平均</th><th class="num">最速</th><th class="num">最遅</th></tr>${hist}</table></div>` : ''}
    <h2>全体の結果</h2>${FT.months.length ? `<div class="row">${monthSelect('ft-m', FT.months, FT.months[0], 'ftResults(this.value)')}</div><div id="ft-res"></div>` : '<p class="muted">公開されている結果はまだありません。</p>'}`);
  if (FT.months.length) ftResults(FT.months[0]);
};
function fitForm(c, month) {
  return `<div class="row"><div><label class="f">測定日</label><input type="date" id="ft-date" value="${h(c.date)}" min="${month}-01" max="${month}-31"></div>
    <div><label class="f">Yo-Yoテスト（本）</label><input type="number" id="ft-yoyo" min="0" step="1" value="${c.yoyo ?? ''}" style="width:110px"></div></div>
    <label class="f">40mダッシュ（秒）</label>
    <div class="row">${[0, 1, 2, 3, 4, 5].map((i) => `<input type="number" class="ft-d" step="0.01" min="0" placeholder="${i + 1}本目" value="${c.d[i] ?? ''}" oninput="ftCalc()" style="width:86px">`).join('')}</div>
    <p class="small" id="ft-calc"></p>`;
}
function ftCalc() {
  const d = $$('.ft-d').map((e) => Number(e.value)).filter((x) => x > 0);
  const lo = B.consts.warnLo, hi = B.consts.warnHi;
  const warn = d.some((x) => x < lo || x > hi) ? `<span class="alert">　${lo}秒未満または${hi}秒超の記録があります。入力ミスがないか確認してください。</span>` : '';
  $('#ft-calc').innerHTML = d.length ? `平均 <b>${(d.reduce((a, b) => a + b, 0) / d.length).toFixed(2)}</b>　最速 ${Math.min(...d).toFixed(2)}　最遅 ${Math.max(...d).toFixed(2)}${d.length < 6 ? '（' + d.length + '本入力）' : ''}${warn}` : '';
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
  const edit = (x) => editable ? `<td><a href="#" onclick="cfEdit('${x.memberId}','${r.month}');return false;">修正</a></td>` : '';
  const yoyo = r.yoyo.map((x) => `<tr class="${x.memberId === me ? 'me' : ''}"><td class="num">${x.rank}</td><td>${h(x.name)}</td><td class="num">${x.yoyo}</td>${edit(x)}</tr>`).join('');
  const dash = r.dash.map((x) => `<tr class="${x.memberId === me ? 'me' : ''}"><td class="num">${x.rank}</td><td>${h(x.name)}</td>${x.d.map((v) => `<td class="num">${fmt2(v)}</td>`).join('')}<td class="num"><b>${fmt2(x.avg)}</b></td><td class="num">${fmt2(x.min)}</td><td class="num">${fmt2(x.max)}</td>${edit(x)}</tr>`).join('');
  const miss = r.missing.map((x) => editable ? `<a href="#" class="tag" onclick="cfEdit('${x.memberId}','${r.month}');return false;">${h(x.name)}</a>` : `<span class="tag">${h(x.name)}</span>`).join('');
  return `<div class="grid2"><div><h3>Yo-Yoテスト</h3><table><tr><th class="num">順位</th><th>氏名</th><th class="num">本数</th>${editable ? '<th></th>' : ''}</tr>${yoyo || '<tr><td colspan="3" class="muted">記録なし</td></tr>'}</table></div>
    <div></div></div>
    <h3>40mダッシュ（平均の速い順）</h3><div class="tbl-wrap"><table><tr><th class="num">順位</th><th>氏名</th>${[1, 2, 3, 4, 5, 6].map((i) => `<th class="num">${i}本目</th>`).join('')}<th class="num">平均</th><th class="num">最速</th><th class="num">最遅</th>${editable ? '<th></th>' : ''}</tr>${dash || '<tr><td colspan="10" class="muted">記録なし</td></tr>'}</table></div>
    ${r.missing.length ? `<h3>未測定</h3><div>${miss}</div>` : ''}`;
}
async function ftResults(ym) {
  try { const r = await call('api_fitnessResults', ym); $('#ft-res').innerHTML = rankTables(r, false); } catch (e) { $('#ft-res').innerHTML = `<p class="alert">${h(e.message)}</p>`; }
}

/* ───────── アセッサー：担当試合 ───────── */
ROUTES.assess = async () => {
  const list = await call('api_myAssessments');
  setMain(`<h1>担当試合（アセッサー）</h1><p class="lead">試合が終わったらアセスメントレポートを作成して提出してください。提出すると担当審判員と委員会に届きます。</p>
    ${list.length ? `<div class="tbl-wrap"><table><tr><th>日付</th><th>大会</th><th>対戦</th><th>会場</th><th>状態</th><th></th></tr>${list.map((m) =>
      `<tr><td>${dl(m.date)} ${h(m.ko)}</td><td>${h(m.comp)}<div class="small muted">${h(m.name)}</div></td><td>${card(m)}</td><td>${h(m.venue)}</td><td>${badge(m.status)}</td>
      <td><a href="#" onclick="go('report','${m.id}');return false;">${m.status === '提出済' ? '見る' : '入力する'}</a></td></tr>`).join('')}</table></div>` : '<p class="muted">担当試合はありません。</p>'}`);
};

/* ───────── アセスメントレポート（入力・閲覧） ───────── */
let RP = null;
function getPath(o, p) { return p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o); }
function setPath(o, p, v) { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach((k) => { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
function ta(path, max, ph) { return `<textarea data-k="${path}" data-max="${max}" oninput="cnt(this)" placeholder="${h(ph || '')}"></textarea><span class="cnt">0／${max}</span>`; }
function cnt(el) { const n = Array.from(el.value).length, max = Number(el.dataset.max); const c = el.nextElementSibling; c.textContent = n + '／' + max; c.classList.toggle('over', n > max); }

function scoreOptions(role) {
  const s = RP.form.s[role] || {};
  const sel = $(`[data-k="s.${role}.score"]`);
  if (!sel) return;
  const r = s.perf && s.diff ? B.consts.RANGES[s.perf][s.diff] : null;
  const cur = sel.value;
  let opts = '<option value="">—</option>';
  if (r) for (let v = Math.round(r[0] * 10); v <= Math.round(r[1] * 10); v++) opts += `<option value="${(v / 10).toFixed(1)}">${(v / 10).toFixed(1)}</option>`;
  sel.innerHTML = opts;
  if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
  $(`#rng-${role}`).textContent = r ? `範囲 ${r[0].toFixed(1)}〜${r[1].toFixed(1)}` : '難易度とパフォーマンスを選ぶと点数を選べます';
}
function onEval(role) { RP.form = collectReport(); scoreOptions(role); }

function roleForm(role, crew) {
  const C = B.consts, L = C.LIMITS;
  const who = `<p class="small muted">${h(crew.name)}${crew.affil ? '（' + h(crew.affil) + '）' : ''}</p>`;
  if (role === '第4審') return who + `<label class="f">コメント・アドバイス</label>${ta('s.第4審.comment', L.fourth)}`;
  const items = role === '主審'
    ? C.REF_ITEMS.map((x) => `<div class="item-head">${x.k}　${h(x.t)}</div><div class="item-desc">${h(x.d)}</div>
        <div class="grid2"><div><label class="f">良かった点</label>${ta(`s.${role}.items.${x.k}.good`, L.good)}</div><div><label class="f">課題点</label>${ta(`s.${role}.items.${x.k}.bad`, L.bad)}</div></div>`).join('')
    : C.AR_ITEMS.map((x) => `<div class="item-head">${x.k}　${h(x.t)}</div><label class="f">良かった点、課題点、アドバイス</label>${ta(`s.${role}.items.${x.k}`, L.ar)}`).join('');
  return who + items + `<h3>総合評価</h3>
    <div class="row">
      <div><label class="f">難易度</label><select data-k="s.${role}.diff" onchange="onEval('${role}')"><option value="">—</option><option>やさしい</option><option>ふつう</option><option>むずかしい</option></select></div>
      <div><label class="f">全体のパフォーマンス</label><select data-k="s.${role}.perf" onchange="onEval('${role}')"><option value="">—</option><option>良い</option><option>普通</option><option>悪い</option></select></div>
      <div><label class="f">評価点</label><select data-k="s.${role}.score"><option value="">—</option></select></div>
      <div><label class="f">例外の評価点</label><input type="number" step="0.1" min="0" max="10" data-k="s.${role}.exception" style="width:100px"></div>
    </div><p class="small muted" id="rng-${role}"></p>
    ${role === '主審' ? `<label class="f">アドバイス（課題点解決のための具体的な方法）</label>${ta(`s.${role}.advice`, L.advice)}` : ''}
    <label class="f">難易度の理由</label>${ta(`s.${role}.reason`, L.reason)}
    <label class="f">特記事項（評価点が8.0未満、または例外の評価点のときは理由を必ず記入）</label>${ta(`s.${role}.note`, L.note)}`;
}

function collectReport() {
  const d = {};
  $$('#rp-form [data-k]').forEach((el) => setPath(d, el.dataset.k, el.value));
  d.ki = [0, 1, 2, 3, 4].map((i) => ((d.ki || {})[i]) || { time: '', text: '' });
  return d;
}
function fillReport(data) {
  $$('#rp-form [data-k]').forEach((el) => {
    let v = getPath(data, el.dataset.k);
    if (el.dataset.k.startsWith('s.') && el.dataset.k.endsWith('.score')) return;
    if (v !== undefined && v !== null) el.value = v;
    if (el.tagName === 'TEXTAREA' && el.dataset.max) cnt(el);
  });
  B.consts.OFFICIAL_ROLES.forEach((role) => {
    const sel = $(`[data-k="s.${role}.score"]`); if (!sel) return;
    RP.form = collectReport(); scoreOptions(role);
    const v = getPath(data, `s.${role}.score`); if (v) sel.value = v;
  });
  rpTotals();
}
function rpTotals() {
  const g = (k) => Number(($(`[data-k="info.sc.${k}"]`) || {}).value) || 0;
  const a = g('a1') + g('a2') + g('ae1') + g('ae2'), b = g('b1') + g('b2') + g('be1') + g('be2');
  if ($('#rp-total')) $('#rp-total').textContent = a + ' - ' + b;
}
function rpTab(k) { $$('#rp-form .pane').forEach((p) => (p.hidden = p.dataset.pane !== k)); $$('#rp-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === k)); }

ROUTES.report = async (matchId) => {
  RP = await call('api_reportGet', matchId);
  RP.id = matchId;
  const crew = RP.crew;
  const evalRoles = B.consts.OFFICIAL_ROLES.filter((r) => crew[r].evaluated);
  const back = B.ctx.asr && !B.ctx.com ? `<a href="#" onclick="go('assess');return false;">← 担当試合</a>` : `<a href="#" onclick="go('c_reports','${RP.match.ym}');return false;">← レポート一覧</a>`;
  if (!RP.editable) {
    const d = RP.data || {}; const half = d.info && d.info.time ? Number(d.info.time) / 2 : 45;
    setMain(`<p>${back}</p><div class="row"><h1>アセスメントレポート</h1>${badge(RP.status)}<span class="spacer"></span>
      ${B.ctx.com && RP.status === '提出済' ? `<button class="btn warn sm" onclick="rpRevert()">アセッサーに差し戻す</button>` : ''}</div>
      ${RP.status === '未作成' ? '<p class="muted">まだ作成されていません。</p>' : `
      <div class="card">${infoRO(RP.match, d.info || {}, RP.assessor, '')}</div>
      ${evalRoles.map((r) => `<div class="card">${sectionRO(r, (d.s || {})[r] || {}, crew[r].name)}</div>`).join('')}
      <div class="card">${kiRO(d.ki, RP.videos, half) || '<p class="muted">Key Incidentsはありません。</p>'}</div>
      ${d.p3 ? `<div class="card"><h3>委員会への報告</h3><p class="small muted">審判員には表示されません</p><p class="pre">${h(d.p3)}</p></div>` : ''}`}`);
    return;
  }
  const L = B.consts.LIMITS;
  const tabs = [['info', '試合情報'], ...evalRoles.map((r) => [r, r === '第4審' ? '第4の審判員' : r]), ['ki', 'Key Incidents'], ['p3', '委員会への報告']];
  const notEval = B.consts.OFFICIAL_ROLES.filter((r) => !crew[r].evaluated).map((r) => `${r}：${crew[r].kind === '地区派遣' ? '地区派遣のため評価対象外' : '割当なし'}`).join('　');
  const sc = (k) => `<input type="number" min="0" data-k="info.sc.${k}" oninput="rpTotals()" style="width:64px">`;
  setMain(`<p>${back}</p><div class="row"><h1>アセスメントレポート</h1>${badge(RP.status)}</div>
    <p class="lead">${dl(RP.match.date)} ${h(RP.match.comp)} ${h(RP.match.name)}　${card(RP.match)}（${h(RP.match.venue)}）</p>
    ${notEval ? `<p class="small muted">${notEval}</p>` : ''}
    <div class="tabs" id="rp-tabs">${tabs.map(([k, l], i) => `<button data-t="${k}" class="${i ? '' : 'on'}" onclick="rpTab('${k}')">${l}</button>`).join('')}</div>
    <div id="rp-form">
      <div class="pane" data-pane="info">
        <div class="row"><div><label class="f">記入日</label><input type="date" data-k="info.date"></div>
        <div><label class="f">試合時間（分）</label><input type="number" data-k="info.time" style="width:90px" placeholder="90"></div>
        <div><label class="f">延長（分）</label><input type="number" data-k="info.ext" style="width:90px"></div></div>
        <h3>試合結果　<span id="rp-total" class="score" style="font-size:20px"></span></h3>
        <table style="max-width:420px"><tr><th></th><th>${h(RP.match.a)}</th><th>${h(RP.match.b)}</th></tr>
          <tr><td>前半</td><td>${sc('a1')}</td><td>${sc('b1')}</td></tr><tr><td>後半</td><td>${sc('a2')}</td><td>${sc('b2')}</td></tr>
          <tr><td>延長前半</td><td>${sc('ae1')}</td><td>${sc('be1')}</td></tr><tr><td>延長後半</td><td>${sc('ae2')}</td><td>${sc('be2')}</td></tr>
          <tr><td>PK</td><td>${sc('apk')}</td><td>${sc('bpk')}</td></tr></table>
        <label class="f">運営上の問題点</label>${ta('info.ops', L.ops)}
      </div>
      ${evalRoles.map((r) => `<div class="pane" data-pane="${r}" hidden>${roleForm(r, crew[r])}</div>`).join('')}
      <div class="pane" data-pane="ki" hidden><p class="small muted">重大な出来事（最大5項目）。時間は「35」「45+2」のように分で入力すると、映像の該当場面へのリンクになります。</p>
        ${[0, 1, 2, 3, 4].map((i) => `<div class="row" style="align-items:flex-start;margin-top:8px"><input data-k="ki.${i}.time" placeholder="時間" style="width:80px"><div style="flex:1">${ta(`ki.${i}.text`, L.ki, '内容')}</div></div>`).join('')}</div>
      <div class="pane" data-pane="p3" hidden><p class="small muted">退場などの重大な事態の報告、審判員に関する委員会への報告、事務連絡。<b>審判員には表示されません。</b></p><textarea data-k="p3" style="min-height:160px"></textarea></div>
    </div>
    <div id="rp-errs"></div>
    <div class="sticky-actions"><button class="btn" onclick="rpSave(false)">途中保存</button><button class="btn primary" onclick="rpSave(true)">提出する</button></div>`);
  RP.form = RP.data || {};
  if (!getPath(RP.form, 'info.date')) setPath(RP.form, 'info.date', B.today);
  fillReport(RP.form);
};
async function rpSave(submit) {
  const data = collectReport();
  if (submit && !confirm('提出すると担当審判員と委員会に届き、変更できなくなります。提出しますか？')) return;
  try {
    const r = await call('api_reportSave', RP.id, data, submit);
    if (!r.ok) { $('#rp-errs').innerHTML = `<ul class="errs">${r.errors.map((e) => `<li>${h(e)}</li>`).join('')}</ul>`; toast('入力内容を確認してください', true); return; }
    $('#rp-errs').innerHTML = '';
    toast(submit ? '提出しました' : '途中保存しました');
    if (submit) go('report', RP.id);
  } catch (e) { fail(e); }
}
async function rpRevert() {
  if (!confirm('このレポートを下書きに戻し、アセッサーが修正できるようにしますか？（年間評価の計算からも一時的に外れます）')) return;
  try { await call('api_reportRevert', RP.id); toast('差し戻しました'); go('report', RP.id); } catch (e) { fail(e); }
}

/* ───────── 共有：試合映像 ───────── */
let VL = [];
ROUTES.videos = async () => {
  VL = await call('api_videos');
  setMain(`<h1>試合映像</h1><p class="lead">チームから提供された試合映像です。アセッサーのコメントをタップすると、その場面から再生できます。</p>
    <input placeholder="大会名・チーム名で絞り込み" oninput="vlFilter(this.value)" style="width:100%;max-width:360px;margin-bottom:12px"><div id="vl"></div>`);
  vlFilter('');
};
function vlFilter(q) {
  const list = VL.filter((v) => !q || [v.match.comp, v.match.a, v.match.b, v.team].join(' ').includes(q));
  $('#vl').innerHTML = list.length ? `<div class="tbl-wrap"><table><tr><th>日付</th><th>大会</th><th>対戦</th><th>提供</th><th class="num">コメント</th></tr>${list.map((v) =>
    `<tr style="cursor:pointer" onclick="go('video','${v.id}')"><td>${dl(v.match.date)}</td><td>${h(v.match.comp)}<div class="small muted">${h(v.match.name)}</div></td><td>${card(v.match)}</td><td>${h(v.team)}</td><td class="num">${v.comments}</td></tr>`).join('')}</table></div>`
    : '<p class="muted">映像はまだありません。</p>';
}

let VD = null;
ROUTES.video = async (arg) => {
  const [vid, at] = String(arg || '').split('@');
  VD = await call('api_video', vid);
  const v = VD.video, m = VD.match;
  const crew = B.consts.OFFICIAL_ROLES.map((r) => VD.crew[r].name ? `${r}：${h(VD.crew[r].name)}` : '').filter(Boolean).join('　');
  setMain(`<p><a href="#" onclick="go('videos');return false;">← 試合映像</a></p>
    <h1 id="player-anchor">${card(m)}</h1><p class="lead">${dl(m.date)} ${h(m.comp)} ${h(m.name)}／${h(m.venue)}／${h(v.team)}提供
      ${VD.others.map((o) => `　<a href="#" onclick="go('video','${o.id}');return false;">${h(o.team)}提供の映像</a>`).join('')}</p>
    <div class="vlayout"><div>
      <div class="player-wrap"><div id="yt-main"></div></div>
      <p class="small muted">${crew}</p>
      <div class="small" id="marks"></div>
      <div id="case-area"></div>
    </div><div>
      <div class="row"><h2 style="margin:0">コメント</h2><span class="spacer"></span>${VD.canComment ? `<button class="btn sm primary" onclick="cmOpen()">＋ この場面にコメント</button>` : ''}</div>
      <div id="cm-form"></div>
      <div id="cm-filter" class="row" style="margin:8px 0"></div>
      <div class="clist" id="clist"></div>
    </div></div>`);
  renderMarks(); renderComments(); renderCaseArea();
  await mountPlayer('main', 'yt-main', v.yt, { start: at ? Number(at) : 0 });
};
function renderMarks() {
  const v = VD.video;
  const edit = VD.canCase;
  $('#marks').innerHTML = `キックオフ位置：<b>${v.ko === null ? '未設定' : `<a href="#" onclick="seek(${v.ko});return false;">${fmtSec(v.ko)}</a>`}</b>
    ${edit ? `<button class="btn link small" onclick="setMark('ko')">［現在位置に設定］</button>` : ''}
    　後半開始位置：<b>${v.h2 === null ? '未設定' : `<a href="#" onclick="seek(${v.h2});return false;">${fmtSec(v.h2)}</a>`}</b>
    ${edit ? `<button class="btn link small" onclick="setMark('h2')">［現在位置に設定］</button>` : ''}
    <div class="muted small">この2つを設定すると、レポートのKey Incidents（分）から映像の場面へ飛べます。</div>`;
}
async function setMark(k) {
  const v = VD.video; v[k] = curTime();
  try { await call('api_setMarks', v.id, v.ko, v.h2); renderMarks(); toast('設定しました'); } catch (e) { fail(e); }
}
let CM_FILTER = '';
function renderComments() {
  const targets = [...new Set(VD.comments.map((c) => c.target).filter(Boolean))];
  $('#cm-filter').innerHTML = targets.length > 1 ? ['', ...targets].map((t) => `<button class="tag ${CM_FILTER === t ? 'on' : ''}" onclick="CM_FILTER='${t}';renderComments()">${t || 'すべて'}</button>`).join('') : '';
  const list = VD.comments.filter((c) => !CM_FILTER || c.target === CM_FILTER);
  $('#clist').innerHTML = list.length ? list.map((c) => `<div class="citem" onclick="seek(${c.sec})">
      <div><span class="ctime">${fmtSec(c.sec)}</span>${c.target ? `<span class="badge">${h(c.target)}</span> ` : ''}${c.cat ? `<span class="small muted">${h(c.cat)}</span> ` : ''}${c.eval ? `<span class="badge ${c.eval === '良い' ? 'ok' : 'ng'}">${h(c.eval)}</span>` : ''}</div>
      <div class="pre">${h(c.text)}</div>
      <div class="small muted">${h(c.by)}　${h(c.at)}${(c.byId === VD.me || VD.com) ? `　<a href="#" onclick="event.stopPropagation();cmDel('${c.id}');return false;">削除</a>` : ''}</div></div>`).join('')
    : '<p class="muted small" style="padding:8px 0">コメントはまだありません。</p>';
}
function catOptions(target) {
  const C = B.consts;
  const list = target === '主審' ? C.REF_ITEMS : (target === '副審1' || target === '副審2') ? C.AR_ITEMS : [];
  return '<option value="">—</option>' + list.map((x) => `<option>${x.k} ${h(x.t)}</option>`).join('');
}
function cmOpen() {
  pausePlayer();
  const s = curTime();
  $('#cm-form').innerHTML = `<div class="card hl">
    <div class="row"><div><label class="f">時間</label><input id="cm-t" value="${fmtSec(s)}" style="width:90px"></div>
    <div><label class="f">対象</label><select id="cm-target" onchange="$('#cm-cat').innerHTML=catOptions(this.value)">${['主審', '副審1', '副審2', '第4審', 'チーム全体'].map((x) => `<option>${x}</option>`).join('')}</select></div>
    <div><label class="f">分類</label><select id="cm-cat">${catOptions('主審')}</select></div>
    <div><label class="f">評価</label><select id="cm-eval"><option value="">—</option><option>良い</option><option>課題</option></select></div></div>
    <label class="f">コメント</label><textarea id="cm-text"></textarea>
    <div class="row" style="margin-top:8px"><button class="btn primary sm" onclick="cmSave()">追加</button><button class="btn sm" onclick="$('#cm-form').innerHTML=''">やめる</button></div></div>`;
  $('#cm-text').focus();
}
async function cmSave() {
  const sec = parseSec($('#cm-t').value);
  if (sec === null) return toast('時間は 12:34 の形で入力してください', true);
  try {
    VD.comments = await call('api_addComment', VD.video.id, { sec, target: $('#cm-target').value, cat: $('#cm-cat').value, eval: $('#cm-eval').value, text: $('#cm-text').value });
    $('#cm-form').innerHTML = ''; renderComments(); toast('追加しました');
  } catch (e) { fail(e); }
}
async function cmDel(id) {
  if (!confirm('このコメントを削除しますか？')) return;
  try { await call('api_delComment', id); VD.comments = VD.comments.filter((c) => c.id !== id); renderComments(); } catch (e) { fail(e); }
}
function renderCaseArea() {
  const list = VD.cases.map((c) => `<div class="citem" onclick="seek(${c.start})"><span class="ctime">${fmtSec(c.start)}〜${fmtSec(c.end)}</span><b>${h(c.title)}</b> ${c.tags.map((t) => `<span class="tag">${h(t)}</span>`).join('')}</div>`).join('');
  $('#case-area').innerHTML = `<div class="row" style="margin-top:16px"><h2 style="margin:0">この映像の事例</h2><span class="spacer"></span>${VD.canCase ? `<button class="btn sm" onclick="caseForm()">＋ 事例に登録</button>` : ''}</div>
    <div id="case-form"></div>${list || '<p class="muted small">登録された事例はありません。</p>'}`;
}
function caseFormHtml(x, withTimes) {
  const tags = B.consts.tags;
  return `<div class="card hl">
    ${withTimes ? `<div class="row"><div><label class="f">開始</label><input id="cs-s" value="${fmtSec(x.start)}" style="width:90px"> <button class="btn link small" onclick="$('#cs-s').value=fmtSec(curTime())">［現在位置］</button></div>
    <div><label class="f">終了</label><input id="cs-e" value="${fmtSec(x.end)}" style="width:90px"> <button class="btn link small" onclick="$('#cs-e').value=fmtSec(curTime())">［現在位置］</button></div></div>` : ''}
    <label class="f">タイトル</label><input id="cs-title" value="${h(x.title || '')}" style="width:100%">
    <label class="f">テーマタグ</label><div id="cs-tags">${tags.map((t) => `<button class="tag ${(x.tags || []).includes(t) ? 'on' : ''}" onclick="this.classList.toggle('on')">${h(t)}</button>`).join('')}</div>
    <label class="f">正しい判定</label><input id="cs-correct" value="${h(x.correct || '')}" style="width:100%" placeholder="例：直接FK＋警告">
    <label class="f">解説</label><textarea id="cs-text">${h(x.text || '')}</textarea>
    <label class="f">研修資料のURL（任意：GoogleドライブのPDFやスライドなど）</label><input id="cs-mat" value="${h(x.material || '')}" style="width:100%">
    <p class="small muted">事例ライブラリでは、担当審判員の名前は表示されません。</p>
    <div class="row"><button class="btn primary sm" onclick="caseSave('${x.id || ''}','${x.videoId || VD.video.id}',${withTimes ? 'null' : x.start},${withTimes ? 'null' : x.end})">保存</button></div></div>`;
}
function caseForm() { pausePlayer(); const s = curTime(); $('#case-form').innerHTML = caseFormHtml({ start: Math.max(0, s - 10), end: s + 10 }, true); }
async function caseSave(id, videoId, start, end) {
  const x = { id, videoId, title: $('#cs-title').value, correct: $('#cs-correct').value, text: $('#cs-text').value, material: $('#cs-mat').value,
    tags: $$('#cs-tags .tag.on').map((b) => b.textContent) };
  x.start = start !== null ? start : parseSec($('#cs-s').value); x.end = end !== null ? end : parseSec($('#cs-e').value);
  if (x.start === null || x.end === null) return toast('時間は 12:34 の形で入力してください', true);
  try {
    await call('api_addCase', x); toast('保存しました');
    if (CUR === 'video') { VD = await call('api_video', VD.video.id); renderCaseArea(); } else { closeModal(); go('cases'); }
  } catch (e) { fail(e); }
}

/* ───────── 共有：事例ライブラリ ───────── */
let CS = { list: [], tag: '', comp: '', q: '' };
ROUTES.cases = async () => {
  CS.list = await call('api_cases');
  const comps = [...new Set(CS.list.map((c) => c.comp).filter(Boolean))];
  setMain(`<h1>事例ライブラリ</h1><p class="lead">判断の難しい場面を集めた教材です。タグで絞り込み、場面を再生して正しい判定と解説を確認できます。</p>
    <div id="cs-tagbar" style="margin-bottom:8px"></div>
    <div class="row" style="margin-bottom:12px"><select onchange="CS.comp=this.value;csRender()"><option value="">すべての大会</option>${comps.map((c) => `<option>${h(c)}</option>`).join('')}</select>
    <input placeholder="キーワード" oninput="CS.q=this.value;csRender()"></div><div id="cs-list"></div>`);
  csRender();
};
function csRender() {
  $('#cs-tagbar').innerHTML = ['', ...B.consts.tags].map((t) => `<button class="tag ${CS.tag === t ? 'on' : ''}" onclick="CS.tag='${t}';csRender()">${t || 'すべて'}</button>`).join('');
  const list = CS.list.filter((c) => (!CS.tag || c.tags.includes(CS.tag)) && (!CS.comp || c.comp === CS.comp) && (!CS.q || (c.title + c.text + c.correct).includes(CS.q)));
  $('#cs-list').innerHTML = list.length ? list.map((c) => `<div class="card" style="cursor:pointer" onclick="csOpen('${c.id}')">
      <div class="row"><b>${h(c.title)}</b><span class="spacer"></span><span class="small muted">${h(c.comp)} ${c.date ? dl(c.date) : ''}</span></div>
      <div>${c.tags.map((t) => `<span class="tag">${h(t)}</span>`).join('')}</div>
      ${c.correct ? `<div class="small">正しい判定：${h(c.correct)}</div>` : ''}</div>`).join('') : '<p class="muted">該当する事例はありません。</p>';
}
async function csOpen(id) {
  const c = CS.list.find((x) => x.id === id);
  const mine = c.byId === B.ctx.id || B.ctx.com;
  openModal(`<h2 style="margin-top:0">${h(c.title)}</h2><div>${c.tags.map((t) => `<span class="tag">${h(t)}</span>`).join('')}</div>
    <div class="player-wrap" style="margin:8px 0"><div id="yt-modal"></div></div>
    <div class="row small"><span class="muted">${fmtSec(c.start)}〜${fmtSec(c.end)}</span><button class="btn link small" onclick="seek(${c.start},'modal')">［もう一度再生］</button></div>
    ${c.correct ? `<div class="item-head">正しい判定</div><p>${h(c.correct)}</p>` : ''}
    ${c.text ? `<div class="item-head">解説</div><p class="pre">${h(c.text)}</p>` : ''}
    ${c.material ? `<p><a href="${h(c.material)}" target="_blank" rel="noopener">研修資料を開く</a></p>` : ''}
    <p class="small muted">登録：${h(c.by)}　${h(c.at)}</p>
    ${mine ? `<div class="row"><button class="btn sm" onclick="csEdit('${c.id}')">編集</button><button class="btn sm warn" onclick="csDel('${c.id}')">削除</button></div><div id="case-form"></div>` : ''}`);
  await mountPlayer('modal', 'yt-modal', c.yt, { start: c.start, end: c.end });
}
function csEdit(id) { const c = CS.list.find((x) => x.id === id); $('#case-form').innerHTML = caseFormHtml(c, false); }
async function csDel(id) {
  if (!confirm('この事例を削除しますか？')) return;
  try { await call('api_delCase', id); closeModal(); go('cases'); } catch (e) { fail(e); }
}

/* ───────── 委員会：試合一覧 ───────── */
let CM = null;
async function monthsCom() { return await call('api_months'); }
function monthBar(page, months, cur) {
  return `<div class="row">${monthSelect('mb', months.map((m) => m.ym), cur, `go('${page}',this.value)`)}
    <input type="month" title="別の月を開く" onchange="if(this.value)go('${page}',this.value)" style="width:150px"></div>`;
}
function defaultMonth(months) { const next = B.today.slice(0, 7); const n = months.map((m) => m.ym); const nm = (() => { let y = Number(next.slice(0, 4)), m = Number(next.slice(5)) + 1; if (m > 12) { m = 1; y++; } return y + '-' + String(m).padStart(2, '0'); })(); return n.includes(nm) ? nm : n[0]; }

ROUTES.c_matches = async (ym) => {
  const months = await monthsCom();
  ym = ym || defaultMonth(months);
  CM = await call('api_matches', ym);
  const st = CM.listPublished ? `<span class="badge ok">一覧公開済み</span>` : `<span class="badge">一覧未公開</span>`;
  const rows = CM.matches.map((m, i) => `<tr><td>${dl(m.date)}</td><td>${h(m.ko)}</td><td>${h(m.comp)}<div class="small muted">${h(m.name)}</div></td><td>${card(m)}</td>
    <td>${h(m.venue)}${m.venue && !m.assoc ? '<div class="alert">会場マスタ未登録</div>' : `<div class="small muted">${h(m.assoc)}</div>`}</td>
    <td><a href="#" onclick="cmEdit(${i});return false;">編集</a>　<a href="#" onclick="cmDelMatch('${m.id}');return false;">削除</a></td></tr>`).join('');
  setMain(`<div class="row"><h1>試合一覧</h1><span class="spacer"></span>${monthBar('c_matches', months, ym)}</div>
    <div class="row" style="margin:8px 0">${st}<span class="small muted">稼働調査の締切：${md(CM.deadline)}</span><span class="spacer"></span>
      <button class="btn ${CM.listPublished ? '' : 'primary'}" onclick="cmPublish()" ${CM.matches.length ? '' : 'disabled'}>${CM.listPublished ? '回答依頼メールを再送' : '一覧を公開して回答依頼'}</button></div>
    <p class="small muted">毎月10日の朝に、翌月の一覧が未公開なら自動で公開し、審判員へ回答依頼メールを送ります。</p>
    <div class="tbl-wrap"><table><tr><th>日付</th><th>KO</th><th>大会・試合名</th><th>対戦</th><th>会場</th><th></th></tr>${rows || '<tr><td colspan="6" class="muted">この月の試合はまだありません。</td></tr>'}</table></div>
    <div class="row" style="margin-top:12px"><button class="btn" onclick="cmEdit(-1)">＋ 試合を追加</button><button class="btn" onclick="cmPaste()">Excelから貼り付けて追加</button></div>
    <datalist id="dl-venue">${CM.venues.map((v) => `<option value="${h(v)}">`).join('')}</datalist>
    <datalist id="dl-team">${CM.teams.map((v) => `<option value="${h(v)}">`).join('')}</datalist>
    <datalist id="dl-comp">${CM.comps.map((v) => `<option value="${h(v)}">`).join('')}</datalist>`);
};
function cmEdit(i) {
  const m = i >= 0 ? CM.matches[i] : { date: CM.month + '-', ko: '', comp: '', name: '', venue: '', a: '', b: '' };
  openModal(`<h2 style="margin-top:0">${i >= 0 ? '試合を編集' : '試合を追加'}</h2>
    <div class="row"><div><label class="f">試合日</label><input type="date" id="me-date" value="${h(m.date)}"></div><div><label class="f">キックオフ</label><input type="time" id="me-ko" value="${h(m.ko)}"></div></div>
    <label class="f">大会名</label><input id="me-comp" list="dl-comp" value="${h(m.comp)}" style="width:100%">
    <label class="f">試合名（節・回戦）</label><input id="me-name" value="${h(m.name)}" style="width:100%">
    <label class="f">会場</label><input id="me-venue" list="dl-venue" value="${h(m.venue)}" style="width:100%">
    <div class="grid2"><div><label class="f">チームA</label><input id="me-a" list="dl-team" value="${h(m.a)}" style="width:100%"></div><div><label class="f">チームB</label><input id="me-b" list="dl-team" value="${h(m.b)}" style="width:100%"></div></div>
    <div class="row" style="margin-top:12px"><button class="btn primary" onclick="cmSaveOne('${m.id || ''}')">保存</button></div>`);
}
async function cmSaveOne(id) {
  const x = { id, date: $('#me-date').value, ko: $('#me-ko').value, comp: $('#me-comp').value.trim(), name: $('#me-name').value.trim(), venue: $('#me-venue').value.trim(), a: $('#me-a').value.trim(), b: $('#me-b').value.trim() };
  try { const r = await call('api_saveMatches', [x]); if (r.errors.length) return toast(r.errors[0], true); closeModal(); toast('保存しました'); go('c_matches', x.date.slice(0, 7)); } catch (e) { fail(e); }
}
function cmPaste() {
  openModal(`<h2 style="margin-top:0">Excelから貼り付けて追加</h2>
    <p class="small">Excelで次の順に列を並べ、見出しを除いてコピーし、下に貼り付けてください。<br><b>大会名　試合名　試合日　キックオフ　会場　チームA　チームB</b></p>
    <textarea id="pt" style="min-height:200px" placeholder="例）北海道リーグ	第10節	2026/11/3	13:00	札幌サッカーアミューズメントパーク	チームA	チームB"></textarea>
    <div class="row" style="margin-top:12px"><button class="btn primary" onclick="cmPasteSave()">追加する</button></div><div id="pt-err"></div>`);
}
async function cmPasteSave() {
  const list = $('#pt').value.split(/\r?\n/).filter((l) => l.trim()).map((l) => { const c = l.split('\t').map((s) => s.trim()); return { comp: c[0], name: c[1], date: c[2], ko: c[3], venue: c[4], a: c[5], b: c[6] }; });
  try {
    const r = await call('api_saveMatches', list);
    if (r.errors.length) $('#pt-err').innerHTML = `<ul class="errs">${r.errors.map((e) => `<li>${h(e)}</li>`).join('')}</ul>`;
    toast(r.saved + '試合を追加しました');
    if (!r.errors.length) { closeModal(); go('c_matches', CM.month); }
  } catch (e) { fail(e); }
}
async function cmDelMatch(id) {
  if (!confirm('この試合を削除しますか？（稼働調査の回答と割当も削除されます）')) return;
  try { await call('api_deleteMatch', id); toast('削除しました'); go('c_matches', CM.month); } catch (e) { fail(e); }
}
async function cmPublish() {
  if (!confirm(`${ymLabel(CM.month)}の試合一覧を公開し、全強化審判員に稼働調査の回答依頼メールを送ります。よろしいですか？`)) return;
  try { await call('api_publishList', CM.month); toast('公開してメールを送りました'); go('c_matches', CM.month); } catch (e) { fail(e); }
}

/* ───────── 委員会：稼働状況 ───────── */
ROUTES.c_survey = async (ym) => {
  const months = await monthsCom();
  ym = ym || defaultMonth(months);
  const r = await call('api_surveyStatus', ym);
  const cls = (a) => a === '○' ? 'style="color:var(--blue);font-weight:700"' : a === '△' ? 'style="color:var(--accent)"' : 'class="muted"';
  const head = r.matches.map((m) => `<th title="${h(m.comp + ' ' + m.a + '対' + m.b)}">${dl(m.date)}<div class="small">${h(m.a).slice(0, 4)}<br>${h(m.b).slice(0, 4)}</div></th>`).join('');
  const body = r.refs.map((x) => `<tr><td>${h(x.name)} <span class="small ${x.answered < r.matches.length ? 'alert' : 'muted'}">${x.answered}/${r.matches.length}</span></td>${r.matches.map((m) => { const a = x.answers[m.id] || {}; return `<td ${cls(a.ans)} title="${h(a.note || '')}">${h(a.ans || '・')}${a.note ? '*' : ''}</td>`; }).join('')}</tr>`).join('');
  const cnt = r.matches.map((m) => `<td class="small">${r.refs.filter((x) => (x.answers[m.id] || {}).ans === '○').length}/${r.refs.filter((x) => (x.answers[m.id] || {}).ans === '△').length}</td>`).join('');
  const missing = r.refs.filter((x) => x.answered < r.matches.length);
  setMain(`<div class="row"><h1>稼働状況</h1><span class="spacer"></span>${monthBar('c_survey', months, ym)}</div>
    <p class="lead">${r.published ? `締切 ${md(r.deadline)}。* は備考あり（マウスを乗せると表示）。最下段は ○/△ の人数。` : 'この月の試合一覧はまだ公開していません。'}</p>
    ${r.matches.length ? `<div class="tbl-wrap"><table class="matrix"><tr><th>審判員</th>${head}</tr>${body}<tr><td class="small muted">○/△</td>${cnt}</tr></table></div>` : ''}
    ${missing.length && r.published ? `<h2>未回答のある審判員（${missing.length}名）</h2><div>${missing.map((x) => `<span class="tag">${h(x.name)}</span>`).join('')}</div><p class="small muted">締切前日の朝に自動でリマインドメールが送られます。</p>` : ''}`);
};

/* ───────── 委員会：割当 ───────── */
let BD = null;
ROUTES.c_assign = async (ym) => {
  const months = await monthsCom();
  ym = ym || defaultMonth(months);
  const y = window.scrollY;
  BD = await call('api_assignBoard', ym);
  setMain(`<div class="row"><h1>割当</h1><span class="spacer"></span>${monthBar('c_assign', months, ym)}</div>
    <div class="row" style="margin:8px 0">${BD.published ? '<span class="badge ok">割当公開済み</span><span class="small muted">変更を保存すると、外れた人と新しく入った人に変更通知メールが届きます</span>' : '<span class="badge">割当未公開</span><span class="small muted">保存してもまだ通知されません</span>'}
      <span class="spacer"></span><button class="btn ${BD.published ? '' : 'primary'}" onclick="bdPublish()" ${BD.matches.length ? '' : 'disabled'}>${BD.published ? '未通知の変更を通知' : '割当を公開して通知'}</button></div>
    <p class="small muted">強化審判員の候補は、その試合に○または△と回答した人だけです。<span class="alert">⚠</span> は確認が必要な割当です（保存はできます）。</p>
    ${BD.matches.map((m, i) => `<div class="card" id="bd-${i}">
      <div class="row"><b>${dl(m.date)} ${h(m.ko)}</b><span>${card(m)}</span><span class="small muted">${h(m.comp)} ${h(m.name)}／${h(m.venue)}${m.assoc ? '（' + h(m.assoc) + '）' : ''}</span></div>
      <div style="margin-top:6px">${B.consts.ROLES.map((r) => `<div class="slot" id="sl-${i}-${r}">${slotHtml(i, r)}</div>`).join('')}</div>
      <div class="row" style="margin-top:8px"><span class="spacer"></span><button class="btn sm primary" onclick="bdSave(${i})">この試合を保存</button></div></div>`).join('') || '<p class="muted">この月の試合はありません。</p>'}`);
  window.scrollTo(0, y);
};
function slotHtml(i, role) {
  const m = BD.matches[i];
  const s = m.slots[role] || (m.slots[role] = { kind: '' });
  const kinds = role === 'アセッサー' ? [['', '未定'], ['強化', '割り当てる']] : [['', '未定'], ['強化', '強化審判員'], ['地区派遣', '地区協会へ派遣依頼']];
  const kindSel = `<select onchange="bdKind(${i},'${role}',this.value)">${kinds.map(([v, l]) => `<option value="${v}" ${s.kind === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  let right = '';
  if (s.kind === '強化') {
    const cands = m.cands[role] || [];
    const cur = cands.find((c) => c.id === s.memberId);
    right = `<select onchange="bdMember(${i},'${role}',this.value)" style="width:100%"><option value="">— 選択 —</option>${cands.map((c) =>
      `<option value="${c.id}" ${c.id === s.memberId ? 'selected' : ''}>${h(c.name)}${c.grade ? '（' + h(c.grade) + '）' : ''} ${c.ans}${c.alerts.length ? ' ⚠' : ''}</option>`).join('')}</select>
      ${!cands.length ? `<div class="small muted">${role === 'アセッサー' ? 'アセッサーが登録されていません' : '○△の回答者がいません'}</div>` : ''}
      ${cur ? `<div class="cand-alerts">${cur.ans === '△' ? `<div class="alert">△ 回答${cur.note ? '：' + h(cur.note) : ''}</div>` : ''}${cur.alerts.map((a) => `<div class="alert">⚠ ${h(a)}</div>`).join('')}</div>` : ''}`;
  } else if (s.kind === '地区派遣') {
    right = `<div class="row"><select onchange="BD.matches[${i}].slots['${role}'].assoc=this.value">${['', ...BD.assocs].map((a) => `<option ${a === (s.assoc || m.assoc) ? 'selected' : ''} value="${h(a)}">${a ? h(a) : '協会を選択'}</option>`).join('')}</select>
      <input placeholder="派遣者の氏名（決まったら）" value="${h(s.dname || '')}" oninput="BD.matches[${i}].slots['${role}'].dname=this.value" style="flex:1;min-width:140px">
      <input placeholder="所属" value="${h(s.daffil || '')}" oninput="BD.matches[${i}].slots['${role}'].daffil=this.value" style="width:120px"></div>`;
  }
  return `<b class="small">${role}</b>${kindSel}<div>${right}</div>`;
}
function bdKind(i, role, v) { const s = BD.matches[i].slots[role]; s.kind = v; if (v === '地区派遣' && !s.assoc) s.assoc = BD.matches[i].assoc; $(`#sl-${i}-${role}`).innerHTML = slotHtml(i, role); }
function bdMember(i, role, v) { BD.matches[i].slots[role].memberId = v; $(`#sl-${i}-${role}`).innerHTML = slotHtml(i, role); }
async function bdSave(i) {
  const m = BD.matches[i];
  try {
    const r = await call('api_saveAssign', m.id, m.slots);
    toast(r.notified ? `保存し、${r.notified}名に変更通知を送りました` : '保存しました');
    go('c_assign', BD.month);
  } catch (e) { fail(e); }
}
async function bdPublish() {
  const msg = BD.published ? '保存済みの割当のうち、まだ通知していない変更を通知します。' : `${ymLabel(BD.month)}の割当を全員に公開し、割り当てた強化審判員・アセッサーに通知メールを送ります。`;
  if (!confirm(msg + '\n（画面上で保存していない試合の変更は含まれません）')) return;
  try { const r = await call('api_publishAssign', BD.month); toast(`公開しました（${r.notified}名に通知）`); go('c_assign', BD.month); } catch (e) { fail(e); }
}

/* ───────── 委員会：派遣依頼 ───────── */
ROUTES.c_dispatch = async (ym) => {
  const months = await monthsCom();
  ym = ym || defaultMonth(months);
  const list = await call('api_dispatch', ym);
  window.DP = list;
  setMain(`<div class="row"><h1>地区協会への派遣依頼</h1><span class="spacer"></span>${monthBar('c_dispatch', months, ym)}</div>
    <p class="lead">割当で「地区協会へ派遣依頼」にした役割を、会場のある地区協会ごとにまとめています。メールは委員会から送ってください。派遣者が決まったら、割当画面で氏名と所属を入力します。</p>
    ${list.length ? list.map((g, gi) => `<div class="card"><div class="row"><h2 style="margin:0">${h(g.assoc)}</h2><span class="small muted">${h(g.person)} ${h(g.mail)}</span><span class="spacer"></span>
      <button class="btn sm" onclick="copyText(dpText(${gi}))">依頼文をコピー</button>${g.mail ? `<a class="btn sm" href="mailto:${h(g.mail)}?subject=${encodeURIComponent('審判員派遣のお願い（' + ymLabel(ym) + '）')}&body=${encodeURIComponent(dpText(gi))}">メールを作成</a>` : ''}</div>
      <table><tr><th>日時</th><th>会場</th><th>試合</th><th>役割</th><th>派遣者</th></tr>${g.items.map((x) => `<tr><td>${dl(x.date)} ${h(x.ko)}</td><td>${h(x.venue)}</td><td>${h(x.comp)} ${h(x.name)}<div class="small">${card(x)}</div></td><td>${h(x.role)}</td><td>${x.dname ? h(x.dname) + '<div class="small muted">' + h(x.daffil) + '</div>' : '<span class="muted">未定</span>'}</td></tr>`).join('')}</table></div>`).join('')
    : '<p class="muted">この月の派遣依頼はありません。</p>'}`);
};
function dpText(gi) {
  const g = window.DP[gi];
  return `${g.assoc}\n${g.person ? g.person + ' 様' : 'ご担当者 様'}\n\nいつもお世話になっております。審判委員会です。\n下記の試合について、審判員の派遣をお願いいたします。\n\n` +
    g.items.map((x) => `・${dl(x.date)} ${x.ko}　${x.venue}\n　${x.comp} ${x.name}　${x.a} 対 ${x.b}\n　依頼する役割：${x.role}`).join('\n') +
    `\n\n派遣者が決まりましたら、氏名と所属をご連絡ください。\nよろしくお願いいたします。`;
}

/* ───────── 委員会：レポート一覧 ───────── */
ROUTES.c_reports = async (ym) => {
  const months = await monthsCom();
  ym = ym || B.today.slice(0, 7);
  const list = await call('api_reports', ym);
  setMain(`<div class="row"><h1>アセスメントレポート</h1><span class="spacer"></span>${monthBar('c_reports', months, ym)}</div>
    <div class="tbl-wrap"><table><tr><th>日付</th><th>大会</th><th>対戦</th><th>アセッサー</th><th>状態</th><th></th></tr>${list.map((m) =>
      `<tr><td>${dl(m.date)}</td><td>${h(m.comp)}<div class="small muted">${h(m.name)}</div></td><td>${card(m)}</td><td>${h(m.assessor)}</td><td>${badge(m.status)}${m.submittedAt ? `<div class="small muted">${h(m.submittedAt)}</div>` : ''}</td>
      <td>${m.assessor ? `<a href="#" onclick="go('report','${m.id}');return false;">開く</a>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">この月の試合はありません。</td></tr>'}</table></div>`);
};
ROUTES.c_report = (id) => ROUTES.report(id);

/* ───────── 委員会：体力テスト結果 ───────── */
ROUTES.c_fitness = async (ym) => {
  const ft = await call('api_fitness');
  const months = [...new Set([B.today.slice(0, 7), ...ft.months])].sort().reverse();
  ym = ym || months[0];
  const r = await call('api_fitnessResults', ym);
  setMain(`<div class="row"><h1>体力テスト結果</h1><span class="spacer"></span>${monthSelect('cf-m', months, ym, "go('c_fitness',this.value)")}</div>
    <p class="lead">${ym === B.today.slice(0, 7) ? '今月分は入力期間中です（審判員への公開は翌月1日）。' : '審判員にも公開されています。'}「修正」または未測定の名前から、委員会が記録を入力・修正できます。</p>
    ${rankTables(r, true)}`);
};
function cfEdit(memberId, month) {
  openModal(`<h2 style="margin-top:0">${ymLabel(month)}の記録を入力・修正</h2>${fitForm({ date: '', yoyo: '', d: ['', '', '', '', '', ''] }, month)}
    <div class="row" style="margin-top:12px"><button class="btn primary" onclick="ftSave('${memberId}','${month}')">保存</button></div>`);
  call('api_fitnessResults', month).then((r) => {
    const x = r.dash.find((y) => y.memberId === memberId);
    if (x) { $('#ft-date').value = x.date; $('#ft-yoyo').value = x.yoyo; $$('.ft-d').forEach((e, i) => (e.value = x.d[i] ?? '')); ftCalc(); }
  }).catch(() => {});
}

/* ───────── 委員会：審判員カルテ ───────── */
ROUTES.c_karte = async (id) => {
  const r = await call('api_karte', id || '');
  const sel = `<select onchange="go('c_karte',this.value)"><option value="">審判員を選択</option>${r.refs.map((x) => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${h(x.name)}${x.active ? '' : '（退会）'}</option>`).join('')}</select>`;
  if (!r.member) return setMain(`<div class="row"><h1>審判員カルテ</h1><span class="spacer"></span>${sel}</div><p class="muted">審判員を選んでください。</p>`);
  const m = r.member, rep = r.reports;
  setMain(`<div class="row"><h1>審判員カルテ</h1><span class="spacer"></span>${sel}</div>
    <div class="card"><h2 style="margin-top:0">${h(m.name)}</h2><dl class="kv"><dt>所属</dt><dd>${h(m.affil)}</dd><dt>級</dt><dd>${h(m.grade)}</dd><dt>メール</dt><dd>${h(m.mail)}</dd></dl></div>
    <h2>年間評価</h2>${rep.annual.map((a) => `<div class="card hl" style="display:inline-block;min-width:160px;margin-right:8px"><div class="small muted">${a.year}年</div><div class="score">${a.avg.toFixed(2)}</div><div class="small muted">${a.n}試合</div></div>`).join('') || '<p class="muted">レポートはまだありません。</p>'}
    ${rep.list.length ? `<h2>レポート</h2><div class="tbl-wrap"><table><tr><th>日付</th><th>大会</th><th>対戦</th><th>担当</th><th class="num">評価点</th><th></th></tr>${rep.list.map((x) => `<tr><td>${dl(x.date)}</td><td>${h(x.comp)}</td><td>${card(x)}</td><td>${h(x.role)}</td><td class="num">${x.score === null ? '—' : x.score.toFixed(1)}</td><td><a href="#" onclick="go('report','${x.id}');return false;">開く</a></td></tr>`).join('')}</table></div>` : ''}
    <h2>割当履歴（${r.assignments.length}件）</h2>${r.assignments.length ? `<div class="tbl-wrap"><table><tr><th>日付</th><th>大会</th><th>対戦</th><th>担当</th></tr>${r.assignments.map((x) => `<tr><td>${dl(x.date)}</td><td>${h(x.comp)}</td><td>${card(x)}</td><td>${h(x.role)}</td></tr>`).join('')}</table></div>` : '<p class="muted">割当はありません。</p>'}
    <h2>体力テスト</h2>${r.fitness.length ? `<div class="tbl-wrap"><table><tr><th>月</th><th class="num">Yo-Yo</th><th class="num">40m平均</th><th class="num">最速</th><th class="num">最遅</th></tr>${r.fitness.map((x) => `<tr><td>${ymLabel(x.month)}</td><td class="num">${x.yoyo}</td><td class="num">${fmt2(x.avg)}</td><td class="num">${fmt2(x.min)}</td><td class="num">${fmt2(x.max)}</td></tr>`).join('')}</table></div>` : '<p class="muted">記録はありません。</p>'}`);
};

/* ───────── 委員会：マスタ ───────── */
let MS = null;
const MASTER_TABS = ['メンバー', '会場', '地区協会', 'チーム', '設定'];
const MASTER_HELP = {
  'メンバー': '強化審判員・アセッサー・委員会のメンバーです。1人が複数の役割を持てます。保存すると、個人ページのURLが自動で発行されます。退会した人は「在籍」を外してください（行を消すと過去の記録の名前が表示されなくなります）。',
  '会場': '会場ごとに、所在地の地区協会を登録します。派遣依頼の宛先になります。',
  '地区協会': '派遣依頼の宛先です。',
  'チーム': '映像を提供してくれるチームです。保存すると、チーム専用の映像提供ページURLが発行されます。チーム名は試合一覧のチーム名と同じにしてください。',
  '設定': 'PAGE_URLは、この画面（GitHub Pages）のURLです。メールに載せる個人ページURLの元になります。',
};
ROUTES.c_master = async (name) => {
  name = name || 'メンバー';
  MS = await call('api_master', name);
  renderMaster();
};
function renderMaster() {
  const name = MS.name;
  const cols = MS.headers.filter((k) => k !== 'トークン' && !(name === '設定' && k === '説明'));
  const tabs = `<div class="tabs">${MASTER_TABS.map((t) => `<button class="${t === name ? 'on' : ''}" onclick="go('c_master','${t}')">${t}</button>`).join('')}</div>`;
  const hasUrl = name === 'メンバー' || name === 'チーム';
  const cell = (r, i, k) => {
    if (MS.bools.includes(k)) return `<td style="text-align:center"><input type="checkbox" ${r[k] === true || r[k] === 'TRUE' ? 'checked' : ''} onchange="MS.rows[${i}]['${k}']=this.checked"></td>`;
    if (name === '設定' && k === 'キー') return `<td><b>${h(r[k])}</b><div class="small muted">${h(r['説明'])}</div></td>`;
    if (name === 'メンバー' && k === 'ID') return `<td class="small muted">${h(r[k]) || '新規'}</td>`;
    const w = k === 'メール' || k === '値' || k === '所在地' ? 'min-width:200px' : k === '級' ? 'width:70px' : 'min-width:110px';
    const list = name === '会場' && k === '地区協会' ? 'list="dl-assoc"' : '';
    return `<td><input value="${h(r[k])}" ${list} oninput="MS.rows[${i}]['${k}']=this.value" style="width:100%;${w}"></td>`;
  };
  setMain(`<h1>マスタ</h1>${tabs}<p class="lead">${MASTER_HELP[name]}</p>
    <div class="tbl-wrap"><table><tr>${cols.map((k) => `<th>${k}</th>`).join('')}${hasUrl ? '<th>個人ページURL</th>' : ''}${name !== '設定' ? '<th></th>' : ''}</tr>
    ${MS.rows.map((r, i) => `<tr>${cols.map((k) => cell(r, i, k)).join('')}${hasUrl ? `<td>${MS.urls[i] ? `<button class="btn sm" onclick="copyText(MS.urls[${i}])">コピー</button>` : '<span class="small muted">保存後に発行</span>'}</td>` : ''}${name !== '設定' ? `<td><a href="#" onclick="MS.rows.splice(${i},1);renderMaster();return false;">削除</a></td>` : ''}</tr>`).join('')}</table></div>
    ${name === '会場' ? `<datalist id="dl-assoc"></datalist>` : ''}
    <div class="sticky-actions">${name !== '設定' ? `<button class="btn" onclick="msAdd()">＋ 行を追加</button>` : ''}<button class="btn primary" onclick="msSave()">保存</button></div>`);
  if (name === '会場') call('api_master', '地区協会').then((a) => { $('#dl-assoc').innerHTML = a.rows.map((r) => `<option value="${h(r['協会名'])}">`).join(''); }).catch(() => {});
}
function msAdd() { const o = {}; MS.headers.forEach((k) => (o[k] = MS.bools.includes(k) ? (k === '在籍') : '')); MS.rows.push(o); renderMaster(); }
async function msSave() {
  try { MS = await call('api_saveMaster', MS.name, MS.rows); renderMaster(); toast('保存しました'); } catch (e) { fail(e); }
}

/* ───────── チーム：映像提供 ───────── */
let TM = null;
ROUTES.team = async () => { TM = await call('api_teamHome'); renderTeam(); };
function renderTeam() {
  setMain(`<h1>${h(TM.team)}　試合映像の提供</h1>
    <p class="lead">試合映像のご提供ありがとうございます。YouTubeに<b>「限定公開」</b>でアップロードし、そのURLを試合ごとに貼り付けて「登録」を押してください。映像は北海道の強化審判員の研修だけに使います。審判員の研修教材として使う場合があるため、登録した映像は削除しないようお願いします。</p>
    ${TM.matches.length ? `<div class="tbl-wrap"><table><tr><th>日付</th><th>大会</th><th>対戦</th><th>映像URL</th></tr>${TM.matches.map((m, i) => `<tr><td>${dl(m.date)}</td><td>${h(m.comp)}<div class="small muted">${h(m.name)}</div></td><td>${card(m)}</td>
      <td>${m.video ? `<span class="badge ok">登録済み</span> <a href="${h(m.video.url)}" target="_blank" rel="noopener">確認</a>　<a href="#" onclick="tmDel('${m.video.id}');return false;">削除</a>`
        : `<div class="row"><input id="tm-${i}" placeholder="https://youtu.be/..." style="min-width:220px;flex:1"><button class="btn sm primary" onclick="tmSave(${i})">登録</button></div>`}</td></tr>`).join('')}</table></div>`
    : '<p class="muted">登録できる試合はまだありません。</p>'}`);
}
async function tmSave(i) {
  try { TM = await call('api_teamSaveVideo', TM.matches[i].id, $('#tm-' + i).value); renderTeam(); toast('登録しました。ありがとうございます'); } catch (e) { fail(e); }
}
async function tmDel(id) {
  if (!confirm('この映像の登録を取り消しますか？')) return;
  try { TM = await call('api_teamDelVideo', id); renderTeam(); toast('取り消しました'); } catch (e) { fail(e); }
}

/* ───────── 起動 ───────── */
(async function init() {
  try {
    B = await call('api_boot');
    $('#who').textContent = B.ctx.kind === 'team' ? B.ctx.name : B.ctx.name + ' さん';
    let page = START_PAGE, arg = START_ARG;
    if (page === 'c_report') page = 'report';
    go(page || (B.ctx.kind === 'team' ? 'team' : 'home'), arg || undefined);
  } catch (e) {
    $('#nav').innerHTML = '';
    setMain(`<div class="card"><h1>ページを開けませんでした</h1><p>${h((e && e.message) || e)}</p><p class="small muted">メールに記載された個人ページのURLから開いてください。</p></div>`);
  }
})();
