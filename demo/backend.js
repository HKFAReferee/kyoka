// 自動生成：非公開リポジトリ kyoka-system の tools/build-demo.js で作る。直接編集しない

// ブラウザの中で Apps Script を動かすための最小の模擬（スプレッドシートはメモリ上、この端末の localStorage に保存）
var STORE_KEY = 'kyoka-demo-v1';
// デモの「今日」は毎月5日に固定（来月の稼働調査が締切15日の前で、委員会のホームの「来月」に出るように）。時刻は今の時刻
var RealDate_ = Date;
var DEMO_SHIFT_ = (function () { var t = new RealDate_(RealDate_.now() + 9 * 3600 * 1000); return (t.getUTCDate() - 5) * 86400000; })();
class DemoDate_ extends RealDate_ {
  constructor(...a) { if (a.length === 0) super(RealDate_.now() - DEMO_SHIFT_); else super(...a); }
  static now() { return RealDate_.now() - DEMO_SHIFT_; }
}
Date = DemoDate_;
function pad_(n) { return String(n).padStart(2, '0'); }
function fmt_(d, tz, f) {
  var t = new Date(d.getTime() + 9 * 3600 * 1000);
  return f.replace('yyyy', t.getUTCFullYear()).replace('MM', pad_(t.getUTCMonth() + 1)).replace('dd', pad_(t.getUTCDate()))
    .replace('HH', pad_(t.getUTCHours())).replace('mm', pad_(t.getUTCMinutes())).replace('ss', pad_(t.getUTCSeconds()));
}
function Range_(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
Range_.prototype.getValues = function () { var o = []; for (var i = 0; i < this.nr; i++) { var row = []; for (var j = 0; j < this.nc; j++) row.push(this.sh.get(this.r + i, this.c + j)); o.push(row); } return o; };
Range_.prototype.setValues = function (v) { var s = this; v.forEach(function (row, i) { row.forEach(function (x, j) { s.sh.set(s.r + i, s.c + j, x); }); }); return this; };
Range_.prototype.setValue = function (v) { this.sh.set(this.r, this.c, v); return this; };
Range_.prototype.clearContent = function () { for (var i = 0; i < this.nr; i++) for (var j = 0; j < this.nc; j++) this.sh.set(this.r + i, this.c + j, ''); return this; };
Range_.prototype.getNumRows = function () { return this.nr; };
['setNumberFormats', 'setNumberFormat', 'setFontWeight', 'setBackground', 'insertCheckboxes'].forEach(function (k) { Range_.prototype[k] = function () { return this; }; });
function Sheet_(name, data) { this.name = name; this.data = data || []; }
Sheet_.prototype.get = function (r, c) { var v = (this.data[r - 1] || [])[c - 1]; return v === undefined || v === null ? '' : v; };
Sheet_.prototype.set = function (r, c, v) { while (this.data.length < r) this.data.push([]); this.data[r - 1][c - 1] = v; };
Sheet_.prototype.getLastRow = function () { for (var i = this.data.length; i > 0; i--) if ((this.data[i - 1] || []).some(function (x) { return x !== '' && x !== undefined && x !== null; })) return i; return 0; };
Sheet_.prototype.getLastColumn = function () { return Math.max.apply(null, [0].concat(this.data.map(function (r) { return r.length; }))); };
Sheet_.prototype.getMaxRows = function () { return Math.max(1000, this.data.length); };
Sheet_.prototype.getDataRange = function () { return new Range_(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); };
Sheet_.prototype.getRange = function (r, c, nr, nc) { return new Range_(this, r, c, nr || 1, nc || 1); };
Sheet_.prototype.deleteRow = function (r) { this.data.splice(r - 1, 1); };
Sheet_.prototype.setFrozenRows = function () {};
var SS_ = { sheets: [], getId: function () { return 'DEMO'; },
  getSheetByName: function (n) { return this.sheets.find(function (s) { return s.name === n; }) || null; },
  insertSheet: function (n) { var s = new Sheet_(n); this.sheets.push(s); return s; },
  getSheets: function () { return this.sheets; }, deleteSheet: function (s) { this.sheets = this.sheets.filter(function (x) { return x !== s; }); } };
var PROPS_ = {}, MAILS_ = [];
var SpreadsheetApp = { getActiveSpreadsheet: function () { return SS_; }, openById: function () { return SS_; }, getUi: function () { throw new Error('no ui'); } };
var Utilities = { formatDate: fmt_, getUuid: function () { return (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function () { return (Math.random() * 16 | 0).toString(16); }); } };
var PropertiesService = { getScriptProperties: function () { return { getProperty: function (k) { return k in PROPS_ ? PROPS_[k] : null; }, setProperty: function (k, v) { PROPS_[k] = v; } }; } };
var LockService = { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } };
var MailApp = { sendEmail: function (o) { MAILS_.push(o); } };
var ScriptApp = {};
var ContentService = { createTextOutput: function (s) { return { s: s, setMimeType: function () { return this; } }; }, MimeType: { JSON: 'json' } };

// ===== Code.gs =====
/**
 * 北海道 強化審判員システム — 共通処理・初期設定・定期処理・メール
 * Google Apps Script（スプレッドシートにバインドし、ウェブアプリ＝APIとして公開する）
 */
const APP_NAME = '北海道 強化審判員システム';
const TZ = 'Asia/Tokyo';

const SHEETS = {
  '設定':       ['キー', '値', '説明'],
  'メンバー':   ['ID', '氏名', '所属', '級', 'メール', '審判員', 'アセッサー', '委員会', '在籍', 'トークン', '個人ページURL'],
  '地区協会':   ['協会名', '担当者', 'メール'],
  '会場':       ['会場名', '所在地', '地区協会'],
  'チーム':     ['チーム名', '担当者', 'メール', 'トークン', '所属リーグ'],
  '月管理':     ['対象月', '一覧公開日時', '割当公開日時'],
  '試合':       ['試合ID', '対象月', '大会名', '試合名', '試合日', 'キックオフ', '会場', 'チームA', 'チームB'],
  '稼働調査':   ['試合ID', 'メンバーID', '回答', '備考', '回答日時'],
  '割当':       ['割当ID', '試合ID', '役割', '区分', 'メンバーID', '派遣者氏名', '派遣者所属', '依頼先協会', '通知済ID', '更新日時'],
  'レポート':   ['試合ID', 'アセッサーID', '状態', '記入日', '提出日時', '内容JSON'],
  '評価':       ['試合ID', '試合日', '役割', 'メンバーID', '採用評価点'],
  '体力テスト': ['メンバーID', '測定月', '測定日', 'YoYo', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', '平均', '最速', '最遅', '入力日時'],
  '試合映像':   ['映像ID', '試合ID', '提供チーム', 'URL', '動画ID', 'KO位置秒', '後半開始秒', '登録日時', '登録者ID', '区分', '長さ秒'],
  '映像コメント': ['コメントID', '映像ID', '秒', '対象', '分類', '評価', 'コメント', '記入者ID', '日時'],
  '事例':       ['事例ID', '映像ID', '開始秒', '終了秒', 'タイトル', 'タグ', '正しい判定', '解説', '資料URL', '登録者ID', '日時'],
};
const BOOL_COLS = ['審判員', 'アセッサー', '委員会', '在籍'];

const DEFAULT_SETTINGS = [
  ['PAGE_URL', '', 'GitHub PagesのURL（例：https://○○.github.io/kyoka/）。メールに載せる個人ページURLの元になる'],
  ['テスト送信先', '', '入力すると、すべてのメールをこのアドレスにだけ送る（本番前のテスト用）'],
  ['事例タグ', 'オフサイド,ハンド,ファウルの基準,アドバンテージ,警告・退場,PK・ペナルティーエリア,ポジショニングと動き,マネジメント,チームワーク', '事例ライブラリのテーマタグ（カンマ区切り）'],
  ['40m警告下限', '4', '40mのタイムがこの秒数未満なら入力時に警告'],
  ['40m警告上限', '9', '40mのタイムがこの秒数を超えたら入力時に警告'],
];

const ROLES = ['主審', '副審1', '副審2', '第4審', 'アセッサー'];
const OFFICIAL_ROLES = ['主審', '副審1', '副審2', '第4審'];

// アセスメントレポート様式の項目
const REF_ITEMS = [
  { k: 'A', t: '競技規則の解釈と適用', d: '規則と精神の解釈と適用（警告・退場を含む）が的確で、かつ基準が一貫していたか。アドバンテージの適用が積極的で、かつ的確か。' },
  { k: 'B', t: 'マネジメント', d: 'ゲームをコントロールする上でのマネジメントが適切か。FK、CK、対立などのマネジメントの技術が的確か。シグナル、ジェスチャー、コミュニケーションスキルが的確か。' },
  { k: 'C', t: 'パーソナリティ', d: '自信・冷静さ・毅然さ・明快さ・リーダーシップなど主審に求められることを行ったか。周囲に影響を受けることなく、主審の権威を示し、公平・公正に取り組んだか。' },
  { k: 'D', t: 'ポジショニングと動き', d: 'サッカーを理解した上でその状況に応じたポジションと動きであったか。そのゲームに見合った動きの量と質、スピードなどが確保されていたか。' },
  { k: 'E', t: 'チームワーク', d: '第4の審判員・副審との協力関係がうまくいったか。レフェリーチームの対応が的確か、副審のシグナルに適切に対応していたか。' },
];
const AR_ITEMS = [
  { k: 'A', t: 'オフサイドの判定' }, { k: 'B', t: 'その他の判定' }, { k: 'C', t: 'ポジショニングと動き' },
  { k: 'D', t: 'シグナル' }, { k: 'E', t: 'チームワーク' }, { k: 'F', t: '態度とメンタリティー' },
];
// 評価点の範囲：パフォーマンス × 難易度
const RANGES = {
  '良い': { 'やさしい': [8.0, 8.4], 'ふつう': [8.5, 8.9], 'むずかしい': [9.0, 10.0] },
  '普通': { 'やさしい': [7.5, 7.9], 'ふつう': [8.0, 8.4], 'むずかしい': [8.5, 8.9] },
  '悪い': { 'やさしい': [7.0, 7.4], 'ふつう': [7.5, 7.9], 'むずかしい': [7.5, 8.4] },
};
const LIMITS = { good: 350, bad: 350, ar: 350, advice: 350, reason: 150, note: 350, ops: 150, ki: 100, fourth: 200 };

/* ───────── API（画面はGitHub Pages、ここはデータの出し入れだけ） ─────────
 * 画面から POST {fn, t, args} を受け取り、api_ で始まる関数だけを実行して JSON を返す。
 * Content-Type は text/plain で送られてくる（ブラウザの事前確認を避けるため）。
 */

function doPost(e) {
  let out;
  try {
    DEMO_ = false; CACHE_ = {};
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const fn = String(req.fn || '');
    if (!/^api_[a-zA-Z]+$/.test(fn) || typeof globalThis[fn] !== 'function') throw new Error('不正なリクエストです。');
    out = { ok: true, result: globalThis[fn].apply(null, [req.t].concat(req.args || [])) };
  } catch (err) {
    out = { ok: false, error: (err && err.message) || String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, app: APP_NAME })).setMimeType(ContentService.MimeType.JSON);
}

/* ───────── スプレッドシート操作 ───────── */

let CACHE_ = {};

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SSID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function sh_(name) {
  const s = ss_().getSheetByName(name);
  if (!s) throw new Error('シート「' + name + '」がありません。メニューの「初期設定」を実行してください。');
  return s;
}

function norm_(v) {
  if (v instanceof Date) {
    if (v.getFullYear() < 1901) return Utilities.formatDate(v, TZ, 'HH:mm');
    const t = Utilities.formatDate(v, TZ, 'HH:mm');
    return Utilities.formatDate(v, TZ, t === '00:00' ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm');
  }
  return v;
}

function rows_(name) {
  if (CACHE_[name]) return CACHE_[name];
  CACHE_[name] = demoFilter_(name, readRows_(name));
  return CACHE_[name];
}
function readRows_(name) {
  const values = sh_(name).getDataRange().getValues();
  const head = values.shift() || [];
  const out = [];
  values.forEach(function (r, i) {
    if (!r.some(function (c) { return c !== '' && c !== null && c !== false; })) return;
    const o = { _row: i + 2 };
    head.forEach(function (k, j) { o[k] = norm_(r[j]); });
    out.push(o);
  });
  return out;
}

/* デモ：ID が DEMO で始まるメンバー・試合（と、その稼働調査・割当・レポートなど）はデモ用。
 * デモの人がアクセスしたときはデモのデータだけ、それ以外のときはデモ以外のデータだけを見せる。月管理は「DEMO:対象月」の行がデモ用 */
let DEMO_ = false;
const DEMO_KEY_ = { 'メンバー': 'ID', '試合': '試合ID', '稼働調査': '試合ID', '割当': '試合ID', 'レポート': '試合ID', '評価': '試合ID', '試合映像': '試合ID', '体力テスト': 'メンバーID' };
function isDemoId_(v) { return /^DEMO/.test(String(v || '')); }
function demoFilter_(name, list) {
  const key = DEMO_KEY_[name];
  if (key) return list.filter(function (r) { return isDemoId_(r[key]) === DEMO_; });
  if (name === '月管理') return list.filter(function (r) { return isDemoId_(r['対象月']) === DEMO_; }).map(function (r) { if (DEMO_) r['対象月'] = String(r['対象月']).replace(/^DEMO:/, ''); return r; });
  return list;
}

function clean_(o) {
  const c = {};
  Object.keys(o).forEach(function (k) { if (k !== '_row') c[k] = o[k]; });
  return c;
}

function rowValues_(name, obj) {
  return SHEETS[name].map(function (k) {
    if (name === 'メンバー' && k === '個人ページURL') return memberUrl_(obj['トークン']);
    if (name === '月管理' && k === '対象月' && DEMO_) return 'DEMO:' + obj[k];
    const v = obj[k];
    if (v === undefined || v === null) return '';
    if (BOOL_COLS.indexOf(k) >= 0 && name === 'メンバー') return truthy_(v);
    return v;
  });
}

function textFormat_(name, range) {
  // 日付や時刻が勝手に変換されないよう、真偽値以外の列を書式なしテキストにする
  const head = SHEETS[name];
  const fmts = [head.map(function (k) { return (name === 'メンバー' && BOOL_COLS.indexOf(k) >= 0) ? 'General' : '@'; })];
  const n = range.getNumRows();
  const all = [];
  for (let i = 0; i < n; i++) all.push(fmts[0]);
  range.setNumberFormats(all);
}

// メンバーシートの「個人ページURL」列は書き込むたびに トークン と PAGE_URL から作り直す（手で入力しない）
function memberUrl_(token) { return token && setting_('PAGE_URL') ? pageUrl_(token) : ''; }
function refreshMemberUrls_() {
  ensureHead_('メンバー');
  const list = rows_('メンバー');
  if (!list.length) return;
  const col = SHEETS['メンバー'].indexOf('個人ページURL') + 1;
  const s = sh_('メンバー');
  list.forEach(function (r) { s.getRange(r._row, col).setValue(memberUrl_(r['トークン'])); });
  delete CACHE_['メンバー'];
}

// 列を後から足したとき、既存のシートの見出しをそろえる
const HEAD_OK_ = {};
function ensureHead_(name) {
  if (HEAD_OK_[name]) return;
  const s = sh_(name), head = SHEETS[name];
  const cur = s.getRange(1, 1, 1, head.length).getValues()[0];
  if (head.some(function (k, i) { return cur[i] !== k; })) s.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#E8F4FB');
  HEAD_OK_[name] = true;
}

function append_(name, obj) {
  ensureHead_(name);
  const s = sh_(name);
  const r = s.getLastRow() + 1;
  const range = s.getRange(r, 1, 1, SHEETS[name].length);
  textFormat_(name, range);
  range.setValues([rowValues_(name, obj)]);
  delete CACHE_[name];
}

function update_(name, row, obj) {
  ensureHead_(name);
  const range = sh_(name).getRange(row, 1, 1, SHEETS[name].length);
  textFormat_(name, range);
  range.setValues([rowValues_(name, obj)]);
  delete CACHE_[name];
}

function deleteRows_(name, rowNums) {
  const s = sh_(name);
  rowNums.slice().sort(function (a, b) { return b - a; }).forEach(function (r) { s.deleteRow(r); });
  delete CACHE_[name];
}

function rewrite_(name, objs) {
  ensureHead_(name);
  // 見えていないデモの行は残す
  if (!DEMO_ && (DEMO_KEY_[name] || name === '月管理')) {
    const key = DEMO_KEY_[name] || '対象月';
    objs = objs.concat(readRows_(name).filter(function (r) { return isDemoId_(r[key]); }).map(clean_));
  }
  const s = sh_(name);
  const n = SHEETS[name].length;
  const last = s.getLastRow();
  if (last > 1) s.getRange(2, 1, last - 1, n).clearContent();
  if (objs.length) {
    const range = s.getRange(2, 1, objs.length, n);
    textFormat_(name, range);
    range.setValues(objs.map(function (o) { return rowValues_(name, o); }));
  }
  delete CACHE_[name];
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ───────── 小物 ───────── */

function truthy_(v) { return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1' || v === '○' || v === '◯'; }
function uid_() { return (DEMO_ ? 'DEMO' : '') + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function token_() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8); }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function ym_(d) { return String(d || '').slice(0, 7); }
function addMonth_(ym, n) {
  let y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) + n;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return y + '-' + (m < 10 ? '0' : '') + m;
}
function lastDay_(ym) { return new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate(); }
function surveyDeadline_(ym) { return addMonth_(ym, -1) + '-15'; } // この日まで回答できる
function len_(s) { return Array.from(String(s || '')).length; }
function num_(v) { const n = Number(v); return (v === '' || v === null || v === undefined || isNaN(n)) ? null : n; }
function dayDiff_(a, b) { return Math.abs((Date.parse(a) - Date.parse(b)) / 86400000); }

function setting_(key) {
  const r = rows_('設定').find(function (x) { return x['キー'] === key; });
  return r ? String(r['値'] || '').trim() : '';
}
function tags_() { return setting_('事例タグ').split(/[,、]/).map(function (s) { return s.trim(); }).filter(String); }

function members_() { return rows_('メンバー'); }
function member_(id) { return members_().find(function (m) { return m.ID === id; }); }
function memberName_(id) { const m = member_(id); return m ? m['氏名'] : (id ? '（削除済）' : ''); }
function activeRefs_() { return members_().filter(function (m) { return truthy_(m['在籍']) && truthy_(m['審判員']); }); }
function committee_() { return members_().filter(function (m) { return truthy_(m['在籍']) && truthy_(m['委員会']); }); }
function match_(id) { return rows_('試合').find(function (m) { return m['試合ID'] === id; }); }
function monthRow_(ym) { return rows_('月管理').find(function (r) { return r['対象月'] === ym; }); }
function listPublished_(ym) { const r = monthRow_(ym); return !!(r && r['一覧公開日時']); }
function assignPublished_(ym) { const r = monthRow_(ym); return !!(r && r['割当公開日時']); }

function setMonth_(ym, key, value) {
  const r = monthRow_(ym);
  if (r) { const o = clean_(r); o[key] = value; update_('月管理', r._row, o); }
  else { const o = { '対象月': ym }; o[key] = value; append_('月管理', o); }
}

function venueAssoc_(venue) {
  const v = rows_('会場').find(function (r) { return r['会場名'] === venue; });
  return v ? v['地区協会'] : '';
}

function ctx_(t) {
  if (!t) throw new Error('個人用のURLから開いてください。');
  const m = readRows_('メンバー').find(function (r) { return r['トークン'] === t && truthy_(r['在籍']); });
  DEMO_ = !!(m && isDemoId_(m.ID)); CACHE_ = {};   // デモの人ならデモのデータだけを見る
  if (m) return { kind: 'member', id: m.ID, name: m['氏名'], ref: truthy_(m['審判員']), asr: truthy_(m['アセッサー']), com: truthy_(m['委員会']) };
  const tm = rows_('チーム').find(function (r) { return r['トークン'] === t; });
  if (tm) return { kind: 'team', name: tm['チーム名'] };
  throw new Error('このURLは無効です。委員会にお問い合わせください。');
}
function need_(c, flag) {
  if (c.kind !== 'member' || (flag && !c[flag])) throw new Error('この操作の権限がありません。');
}

/* ───────── メール ───────── */

function pageUrl_(token, page, arg) {
  let base = setting_('PAGE_URL');
  if (!base) return '（設定シートのPAGE_URLが未設定です）';
  if (!/\/$/.test(base) && !/\.html$/.test(base)) base += '/';
  return base + '?t=' + encodeURIComponent(token) + (page ? '&p=' + page : '') + (arg ? '&a=' + encodeURIComponent(arg) : '');
}

function mail_(to, subject, body) {
  if (!to) return;
  const test = setting_('テスト送信先');
  let sub = '【強化審判員】' + subject;
  if (test) { sub = '[TEST 本来の宛先:' + to + '] ' + sub; to = test; }
  MailApp.sendEmail({ to: to, subject: sub, body: body + '\n\n――\n' + APP_NAME + '\n※このメールは送信専用です。', name: APP_NAME });
}

function mailMember_(m, subject, lines, page, arg) {
  if (!m || !m['メール']) return;
  mail_(m['メール'], subject, m['氏名'] + ' 様\n\n' + lines.join('\n') + '\n\n個人管理ページ：\n' + pageUrl_(m['トークン'], page, arg));
}

/* ───────── 月次の処理 ───────── */

function publishList_(ym) {
  setMonth_(ym, '一覧公開日時', now_());
  const dl = surveyDeadline_(ym);
  activeRefs_().forEach(function (m) {
    mailMember_(m, ym.replace('-', '年') + '月の稼働調査のお願い',
      [ym.replace('-', '年') + '月の試合一覧を公開しました。', '試合ごとに○△×を回答してください。', '締切：' + dl.replace(/-/g, '/')], 'survey');
  });
}

function remindSurvey_(ym) {
  if (!listPublished_(ym)) return;
  const ids = rows_('試合').filter(function (r) { return r['対象月'] === ym; }).map(function (r) { return r['試合ID']; });
  if (!ids.length) return;
  const ans = rows_('稼働調査');
  activeRefs_().forEach(function (m) {
    const n = ans.filter(function (a) { return a['メンバーID'] === m.ID && ids.indexOf(a['試合ID']) >= 0 && a['回答']; }).length;
    if (n < ids.length) mailMember_(m, '稼働調査の締切は明日です',
      [ym.replace('-', '年') + '月の稼働調査に、まだ回答していない試合があります（' + n + '／' + ids.length + '試合回答済み）。', '締切：' + surveyDeadline_(ym).replace(/-/g, '/')], 'survey');
  });
}

function remindFitness_(ym) {
  const done = rows_('体力テスト').filter(function (r) { return r['測定月'] === ym; }).map(function (r) { return r['メンバーID']; });
  activeRefs_().forEach(function (m) {
    if (done.indexOf(m.ID) < 0) mailMember_(m, '体力テストの入力締切は明日です',
      [ym.replace('-', '年') + '月の体力テストがまだ入力されていません。', '締切：' + ym.replace(/-/g, '/') + '/' + lastDay_(ym)], 'fitness');
  });
}

/**
 * 割当の通知：前回通知した人（通知済ID）と今の担当者を比べ、変わった人にだけ送る。
 * 1人1通にまとめる。
 */
function notifyAssign_(matchIds, firstPublish) {
  const rows = rows_('割当').filter(function (r) { return matchIds.indexOf(r['試合ID']) >= 0; });
  const people = {}; // id -> 'new' | 'change'
  const touched = [];
  rows.forEach(function (r) {
    const now = r['区分'] === '強化' ? (r['メンバーID'] || '') : '';
    const before = r['通知済ID'] || '';
    if (now === before) return;
    if (now) people[now] = (firstPublish && !before) ? (people[now] || 'new') : 'change';
    if (before) people[before] = 'change';
    touched.push(r);
  });
  touched.forEach(function (r) {
    const o = clean_(r);
    o['通知済ID'] = r['区分'] === '強化' ? (r['メンバーID'] || '') : '';
    update_('割当', r._row, o);
  });
  Object.keys(people).forEach(function (id) {
    const m = member_(id);
    if (!m || !truthy_(m['在籍'])) return;
    if (people[id] === 'new') mailMember_(m, '割当が決定しました', ['割当が決定しました。', '個人管理ページで担当試合を確認してください。'], 'home');
    else mailMember_(m, '割当が変更されました', ['割当が変更されました。', '個人管理ページで担当試合を確認してください。'], 'home');
  });
  return Object.keys(people).length;
}

/* ───────── 定期処理（毎朝） ───────── */

function dailyJob() {
  const t = today_();
  const d = Number(t.slice(8, 10));
  const cur = ym_(t);
  const next = addMonth_(cur, 1);
  if (d === 10 && !listPublished_(next) && rows_('試合').some(function (r) { return r['対象月'] === next; })) publishList_(next);
  if (d === 14) remindSurvey_(next);
  if (d === lastDay_(cur) - 1) remindFitness_(cur);
}

/* ───────── 初期設定 ───────── */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('強化審判員システム')
    .addItem('① 初期設定（シート作成）', 'setup')
    .addItem('② 毎朝の自動処理をオンにする', 'installTrigger')
    .addItem('URLを発行（未発行の人・チーム）', 'issueTokens')
    .addSeparator()
    .addItem('デモデータを作る（作り直す）', 'setupDemo')
    .addItem('デモデータを消す', 'removeDemo')
    .addToUi();
}

function setup() {
  const ss = ss_();
  PropertiesService.getScriptProperties().setProperty('SSID', ss.getId());
  Object.keys(SHEETS).forEach(function (name) {
    let s = ss.getSheetByName(name);
    if (!s) s = ss.insertSheet(name);
    const head = SHEETS[name];
    s.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#E8F4FB');
    s.setFrozenRows(1);
    textFormat_(name, s.getRange(2, 1, s.getMaxRows() - 1, head.length));
    if (name === 'メンバー') {
      BOOL_COLS.forEach(function (k) {
        const c = head.indexOf(k) + 1;
        s.getRange(2, c, s.getMaxRows() - 1, 1).insertCheckboxes();
      });
    }
  });
  const exist = rows_('設定').map(function (r) { return r['キー']; });
  DEFAULT_SETTINGS.forEach(function (row) { if (exist.indexOf(row[0]) < 0) append_('設定', { 'キー': row[0], '値': row[1], '説明': row[2] }); });
  const first = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
  issueTokens();
  try { SpreadsheetApp.getUi().alert('初期設定が終わりました。「メンバー」シートに委員会のメンバーを登録し、メニューの「URLを発行」を実行してください。'); } catch (e) {}
}

function issueTokens() {
  ['メンバー', 'チーム'].forEach(function (name) {
    const key = name === 'メンバー' ? '氏名' : 'チーム名';
    const all = rows_(name);
    // 名前のない行に入ってしまったIDやトークンは消す（空の行は発行の対象外）
    const blanks = all.filter(function (r) { return !String(r[key] || '').trim() && (r.ID || r['トークン']); });
    if (blanks.length) {
      const s = sh_(name);
      blanks.forEach(function (r) {
        if (name === 'メンバー') s.getRange(r._row, SHEETS[name].indexOf('ID') + 1).setValue('');
        s.getRange(r._row, SHEETS[name].indexOf('トークン') + 1).setValue('');
      });
      delete CACHE_[name];
    }
    const rs = rows_(name).filter(function (r) { return String(r[key] || '').trim(); });
    let maxNo = 0;
    if (name === 'メンバー') rs.forEach(function (r) { const n = Number(String(r.ID || '').replace(/\D/g, '')); if (n > maxNo) maxNo = n; });
    rs.forEach(function (r) {
      const o = clean_(r);
      let changed = false;
      if (name === 'メンバー' && !o.ID) { maxNo++; o.ID = 'M' + ('000' + maxNo).slice(-3); changed = true; }
      if (!o['トークン']) { o['トークン'] = token_(); changed = true; }
      if (name === 'メンバー' && o['在籍'] === '') { o['在籍'] = true; changed = true; }
      if (changed) update_(name, r._row, o);
    });
  });
  refreshMemberUrls_();
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === 'dailyJob') ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger('dailyJob').timeBased().everyDays(1).atHour(8).inTimezone(TZ).create();
  try { SpreadsheetApp.getUi().alert('毎朝8時の自動処理（稼働調査の公開・リマインド、体力テストのリマインド）をオンにしました。'); } catch (e) {}
}

// ===== Api.gs =====
/**
 * 北海道 強化審判員システム — 画面から呼ばれる処理（API）
 * すべて先頭の引数 t（個人URLのトークン）で本人とロールを確認する。
 */

/* ───────── 共通 ───────── */

function api_boot(t) {
  const c = ctx_(t);
  return {
    ctx: c,
    today: today_(),
    consts: {
      REF_ITEMS: REF_ITEMS, AR_ITEMS: AR_ITEMS, RANGES: RANGES, LIMITS: LIMITS, OFFICIAL_ROLES: OFFICIAL_ROLES, ROLES: ROLES,
      PARTS: PARTS, tags: tags_(), warnLo: Number(setting_('40m警告下限') || 4), warnHi: Number(setting_('40m警告上限') || 9),
    },
  };
}

function matchView_(m) {
  if (!m) return null;
  return { id: m['試合ID'], ym: m['対象月'], comp: m['大会名'], name: m['試合名'], date: m['試合日'], ko: m['キックオフ'],
    venue: m['会場'], a: m['チームA'], b: m['チームB'] };
}

function slotsOf_(matchId) {
  const out = {};
  rows_('割当').filter(function (r) { return r['試合ID'] === matchId; }).forEach(function (r) {
    out[r['役割']] = { kind: r['区分'], memberId: r['メンバーID'], name: r['区分'] === '強化' ? memberName_(r['メンバーID']) : r['派遣者氏名'],
      affil: r['区分'] === '強化' ? ((member_(r['メンバーID']) || {})['所属'] || '') : r['派遣者所属'], assoc: r['依頼先協会'] };
  });
  return out;
}

function sortByDate_(a, b) { return (a.date + ' ' + a.ko).localeCompare(b.date + ' ' + b.ko); }

/* ───────── 審判員：マイページ ───────── */

function api_home(t) {
  const c = ctx_(t); need_(c);
  const today = today_();
  const mine = rows_('割当').filter(function (r) { return r['区分'] === '強化' && r['メンバーID'] === c.id; });
  const upcoming = [];
  mine.forEach(function (r) {
    const m = match_(r['試合ID']);
    if (!m || m['試合日'] < today || !assignPublished_(m['対象月'])) return;
    const v = matchView_(m); v.role = r['役割']; upcoming.push(v);
  });
  upcoming.sort(sortByDate_);
  const res = { upcoming: upcoming, notices: [] };
  if (c.ref) {
    const s = api_survey(t);
    if (s.open) {
      const answered = s.matches.filter(function (m) { return m.ans; }).length;
      if (answered < s.matches.length) res.notices.push({ page: 'survey', text: s.month.replace('-', '年') + '月の稼働調査：' + answered + '／' + s.matches.length + '試合回答済み（締切 ' + s.deadline.slice(5).replace('-', '/') + '）' });
    }
    const cur = ym_(today);
    if (!rows_('体力テスト').some(function (r) { return r['メンバーID'] === c.id && r['測定月'] === cur; }))
      res.notices.push({ page: 'fitness', text: cur.replace('-', '年') + '月の体力テストが未入力です（締切 ' + cur.slice(5) + '/' + lastDay_(cur) + '）' });
  }
  if (c.asr) {
    const pending = api_myAssessments(t).filter(function (x) { return x.status !== '提出済' && x.date <= today; });
    if (pending.length) res.notices.push({ page: 'assess', text: '未提出のアセスメントレポートが' + pending.length + '件あります' });
  }
  if (c.com) res.com = comSummary_(today);
  return res;
}

// 委員会のホーム：今月・来月の進み具合と、手が止まっているもの
function comSummary_(today) {
  const cur = ym_(today);
  const allM = rows_('試合'), asg = rows_('割当'), ans = rows_('稼働調査'), reps = rows_('レポート');
  const refs = activeRefs_();
  const months = [cur, addMonth_(cur, 1)].map(function (ym) {
    const ms = allM.filter(function (m) { return m['対象月'] === ym; });
    const ids = ms.map(function (m) { return m['試合ID']; });
    const a = asg.filter(function (r) { return ids.indexOf(r['試合ID']) >= 0; });
    let empty = 0;
    ids.forEach(function (id) {
      ROLES.forEach(function (role) {
        const r = a.find(function (x) { return x['試合ID'] === id && x['役割'] === role; });
        if (!r || !r['区分'] || (r['区分'] === '強化' && !r['メンバーID'])) empty++;
      });
    });
    const unanswered = refs.filter(function (rf) {
      return ids.some(function (id) { return !ans.some(function (x) { return x['試合ID'] === id && x['メンバーID'] === rf.ID && x['回答']; }); });
    }).length;
    return { ym: ym, matches: ms.length, list: listPublished_(ym), assign: assignPublished_(ym), deadline: surveyDeadline_(ym),
      refs: refs.length, unanswered: ms.length ? unanswered : 0, slots: ms.length * ROLES.length, empty: empty };
  });
  let reportsPending = 0, dispatchPending = 0;
  asg.forEach(function (r) {
    const m = allM.find(function (x) { return x['試合ID'] === r['試合ID']; });
    if (!m) return;
    if (r['役割'] === 'アセッサー' && r['区分'] === '強化' && r['メンバーID'] && m['試合日'] <= today) {
      const rep = reps.find(function (x) { return x['試合ID'] === r['試合ID']; });
      if (!rep || rep['状態'] !== '提出済') reportsPending++;
    }
    if (r['区分'] === '地区派遣' && !r['派遣者氏名'] && m['試合日'] >= today) dispatchPending++;
  });
  return { months: months, reportsPending: reportsPending, dispatchPending: dispatchPending };
}

/* ───────── 審判員：稼働調査 ───────── */

function openSurveyMonth_() {
  const today = today_();
  const months = rows_('月管理').filter(function (r) { return r['一覧公開日時']; }).map(function (r) { return r['対象月']; }).sort();
  const open = months.filter(function (ym) { return today <= surveyDeadline_(ym); });
  return { open: open.length ? open[open.length - 1] : '', latest: months.length ? months[months.length - 1] : '' };
}

function api_survey(t, ym) {
  const c = ctx_(t); need_(c, 'ref');
  const o = openSurveyMonth_();
  const month = ym || o.open || o.latest;
  if (!month || !listPublished_(month)) return { month: month || '', open: false, matches: [], deadline: '' };
  const ans = rows_('稼働調査').filter(function (a) { return a['メンバーID'] === c.id; });
  const matches = rows_('試合').filter(function (m) { return m['対象月'] === month; }).map(function (m) {
    const v = matchView_(m);
    const a = ans.find(function (x) { return x['試合ID'] === v.id; });
    v.ans = a ? a['回答'] : ''; v.note = a ? a['備考'] : '';
    return v;
  }).sort(sortByDate_);
  return { month: month, open: today_() <= surveyDeadline_(month), deadline: surveyDeadline_(month), matches: matches };
}

function api_saveSurvey(t, ym, answers) {
  const c = ctx_(t); need_(c, 'ref');
  if (today_() > surveyDeadline_(ym)) throw new Error('稼働調査の締切を過ぎています。変更は委員会に連絡してください。');
  return withLock_(function () {
    const all = rows_('稼働調査');
    answers.forEach(function (a) {
      if (['○', '△', '×', ''].indexOf(a.ans) < 0) return;
      const m = match_(a.id);
      if (!m || m['対象月'] !== ym) return;
      const ex = all.find(function (x) { return x['試合ID'] === a.id && x['メンバーID'] === c.id; });
      const o = { '試合ID': a.id, 'メンバーID': c.id, '回答': a.ans, '備考': String(a.note || '').slice(0, 200), '回答日時': now_() };
      if (ex) { if (ex['回答'] !== o['回答'] || ex['備考'] !== o['備考']) update_('稼働調査', ex._row, o); }
      else if (a.ans) append_('稼働調査', o);
    });
    return true;
  });
}

/* ───────── 割当表（全員） ───────── */

function api_assignTable(t, ym) {
  const c = ctx_(t); need_(c);
  const months = rows_('月管理').filter(function (r) { return r['割当公開日時'] || c.com; }).map(function (r) { return r['対象月']; }).sort().reverse();
  const month = ym || months.find(function (x) { return assignPublished_(x); }) || months[0] || '';
  if (!month || (!assignPublished_(month) && !c.com)) return { months: months, month: month, matches: [], published: false };
  const matches = rows_('試合').filter(function (m) { return m['対象月'] === month; }).map(function (m) {
    const v = matchView_(m); const s = slotsOf_(v.id);
    v.slots = {};
    ROLES.forEach(function (r) {
      const x = s[r];
      v.slots[r] = !x || !x.kind ? '未定' : x.kind === '強化' ? (x.name || '未定') : '地区派遣';
      v['mine_' + r] = !!(x && x.kind === '強化' && x.memberId === c.id);
    });
    return v;
  }).sort(sortByDate_);
  return { months: months, month: month, matches: matches, published: assignPublished_(month) };
}

/* ───────── 審判員：自分のレポートと年間評価 ───────── */

function api_myReports(t, memberId) {
  const c = ctx_(t); need_(c);
  const id = (c.com && memberId) ? memberId : c.id;
  const list = rows_('評価').filter(function (r) { return r['メンバーID'] === id; }).map(function (r) {
    const v = matchView_(match_(r['試合ID'])) || { id: r['試合ID'], date: r['試合日'] };
    v.role = r['役割']; v.score = num_(r['採用評価点']);
    return v;
  }).sort(sortByDate_).reverse();
  const years = {};
  list.forEach(function (x) {
    const y = String(x.date).slice(0, 4);
    if (x.score === null) return;
    years[y] = years[y] || { sum: 0, n: 0 };
    years[y].sum += x.score; years[y].n++;
  });
  const annual = Object.keys(years).sort().reverse().map(function (y) { return { year: y, avg: Math.round(years[y].sum / years[y].n * 100) / 100, n: years[y].n }; });
  return { list: list, annual: annual };
}

function api_myReport(t, matchId) {
  const c = ctx_(t); need_(c);
  const ev = rows_('評価').filter(function (r) { return r['試合ID'] === matchId && r['メンバーID'] === c.id; });
  const rep = rows_('レポート').find(function (r) { return r['試合ID'] === matchId; });
  if (!rep || rep['状態'] !== '提出済') throw new Error('レポートはまだ提出されていません。');
  if (!ev.length && !c.com) throw new Error('このレポートを見る権限がありません。');
  const data = JSON.parse(rep['内容JSON'] || '{}');
  const roles = ev.map(function (r) { return r['役割']; });
  const sections = {};
  roles.forEach(function (r) { sections[r] = (data.s || {})[r] || {}; });
  return {
    match: matchView_(match_(matchId)), assessor: memberName_(rep['アセッサーID']), date: rep['記入日'],
    info: data.info || {}, ki: data.ki || [], sections: sections, roles: roles, videos: videosOfMatch_(matchId),
  };
}

/* ───────── 体力テスト ───────── */

function fitnessView_(r) {
  return { memberId: r['メンバーID'], month: r['測定月'], date: r['測定日'], yoyo: num_(r['YoYo']),
    d: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'].map(function (k) { return num_(r[k]); }),
    avg: num_(r['平均']), min: num_(r['最速']), max: num_(r['最遅']) };
}

function api_fitness(t) {
  const c = ctx_(t); need_(c);
  const cur = ym_(today_());
  const mine = rows_('体力テスト').filter(function (r) { return r['メンバーID'] === c.id; }).map(fitnessView_)
    .sort(function (a, b) { return b.month.localeCompare(a.month); });
  return { month: cur, deadline: cur + '-' + lastDay_(cur), current: mine.find(function (x) { return x.month === cur; }) || null, history: mine, months: resultMonths_(c) };
}

function resultMonths_(c) {
  const cur = ym_(today_());
  const set = {};
  rows_('体力テスト').forEach(function (r) { if (r['測定月'] < cur || c.com) set[r['測定月']] = 1; });
  return Object.keys(set).sort().reverse();
}

function api_fitnessSave(t, rec) {
  const c = ctx_(t); need_(c);
  let memberId = c.id, month = ym_(today_());
  if (rec.memberId && rec.memberId !== c.id) { need_(c, 'com'); memberId = rec.memberId; month = rec.month || month; }
  else if (!c.ref) throw new Error('審判員として登録されていません。');
  const d = (rec.d || []).map(Number);
  if (d.length !== 6 || d.some(function (x) { return !(x > 0); })) throw new Error('40mダッシュは6本すべて入力してください。');
  const yoyo = Number(rec.yoyo);
  if (!(yoyo >= 0) || Math.floor(yoyo) !== yoyo) throw new Error('Yo-Yoテストの本数を整数で入力してください。');
  if (!rec.date || ym_(rec.date) !== month) throw new Error('測定日は' + month.replace('-', '年') + '月の日付を入力してください。');
  const avg = Math.round(d.reduce(function (s, x) { return s + x; }, 0) / 6 * 100) / 100;
  const o = { 'メンバーID': memberId, '測定月': month, '測定日': rec.date, 'YoYo': yoyo,
    '平均': avg, '最速': Math.min.apply(null, d), '最遅': Math.max.apply(null, d), '入力日時': now_() };
  d.forEach(function (x, i) { o['D' + (i + 1)] = Math.round(x * 100) / 100; });
  return withLock_(function () {
    const ex = rows_('体力テスト').find(function (r) { return r['メンバーID'] === memberId && r['測定月'] === month; });
    if (ex) update_('体力テスト', ex._row, o); else append_('体力テスト', o);
    return fitnessView_(o);
  });
}

function rank_(list, key, asc) {
  const sorted = list.filter(function (x) { return x[key] !== null; }).sort(function (a, b) { return asc ? a[key] - b[key] : b[key] - a[key]; });
  let prev = null, rank = 0;
  sorted.forEach(function (x, i) { if (x[key] !== prev) { rank = i + 1; prev = x[key]; } x.rank = rank; });
  return sorted;
}

function api_fitnessResults(t, ym) {
  const c = ctx_(t); need_(c);
  const cur = ym_(today_());
  if (ym >= cur && !c.com) throw new Error('この月の結果は締切後（翌月1日）に公開されます。');
  const recs = rows_('体力テスト').filter(function (r) { return r['測定月'] === ym; }).map(fitnessView_);
  const refs = activeRefs_();
  const byId = {}; recs.forEach(function (r) { byId[r.memberId] = r; });
  const base = refs.map(function (m) { const r = byId[m.ID]; return r ? Object.assign({ name: m['氏名'] }, r) : null; }).filter(Boolean);
  recs.forEach(function (r) { if (!refs.some(function (m) { return m.ID === r.memberId; })) base.push(Object.assign({ name: memberName_(r.memberId) }, r)); });
  const yoyo = rank_(base.map(function (x) { return Object.assign({}, x); }), 'yoyo', false);
  const dash = rank_(base.map(function (x) { return Object.assign({}, x); }), 'avg', true);
  const missing = refs.filter(function (m) { return !byId[m.ID]; }).map(function (m) { return { name: m['氏名'], memberId: m.ID }; });
  return { month: ym, yoyo: yoyo, dash: dash, missing: missing };
}

/* ───────── アセッサー：担当試合とレポート ───────── */

function api_myAssessments(t) {
  const c = ctx_(t); need_(c, 'asr');
  const reps = rows_('レポート');
  return rows_('割当').filter(function (r) { return r['役割'] === 'アセッサー' && r['区分'] === '強化' && r['メンバーID'] === c.id; })
    .map(function (r) {
      const m = match_(r['試合ID']);
      if (!m || !assignPublished_(m['対象月'])) return null;
      const v = matchView_(m);
      const rep = reps.find(function (x) { return x['試合ID'] === v.id; });
      v.status = rep ? rep['状態'] : '未作成';
      return v;
    }).filter(Boolean).sort(sortByDate_).reverse();
}

function crew_(matchId) {
  const s = slotsOf_(matchId);
  const out = {};
  OFFICIAL_ROLES.forEach(function (r) {
    const x = s[r] || {};
    out[r] = { kind: x.kind || '', memberId: x.memberId || '', name: x.name || '', affil: x.affil || '', evaluated: x.kind === '強化' && !!x.memberId };
  });
  return out;
}

function api_reportGet(t, matchId) {
  const c = ctx_(t); need_(c);
  const s = slotsOf_(matchId);
  const assessorId = s['アセッサー'] && s['アセッサー'].kind === '強化' ? s['アセッサー'].memberId : '';
  if (!c.com && !(c.asr && assessorId === c.id)) throw new Error('このレポートを開く権限がありません。');
  const rep = rows_('レポート').find(function (r) { return r['試合ID'] === matchId; });
  return {
    match: matchView_(match_(matchId)), crew: crew_(matchId), assessor: memberName_(assessorId),
    status: rep ? rep['状態'] : '未作成', submittedAt: rep ? rep['提出日時'] : '',
    data: rep ? JSON.parse(rep['内容JSON'] || '{}') : {},
    editable: (!rep || rep['状態'] !== '提出済') && assessorId === c.id,
    videos: videosOfMatch_(matchId),
  };
}

function adopted_(sec) {
  const ex = num_(sec.exception);
  return ex !== null ? ex : num_(sec.score);
}

function validateReport_(data, crew) {
  const e = [];
  const lim = function (v, n, label) { if (len_(v) > n) e.push(label + 'が' + n + '字を超えています（' + len_(v) + '字）'); };
  const info = data.info || {};
  lim(info.ops, LIMITS.ops, '運営上の問題点');
  (data.ki || []).forEach(function (k, i) { lim(k.text, LIMITS.ki, 'Key Incidents ' + (i + 1)); });
  const s = data.s || {};
  ['主審', '副審1', '副審2'].forEach(function (role) {
    if (!crew[role].evaluated) return;
    const x = s[role] || {};
    const items = x.items || {};
    if (role === '主審') REF_ITEMS.forEach(function (it) { lim((items[it.k] || {}).good, LIMITS.good, role + ' ' + it.k + ' 良かった点'); lim((items[it.k] || {}).bad, LIMITS.bad, role + ' ' + it.k + ' 課題点'); });
    else AR_ITEMS.forEach(function (it) { lim(items[it.k], LIMITS.ar, role + ' ' + it.k); });
    if (role === '主審') lim(x.advice, LIMITS.advice, '主審 アドバイス');
    lim(x.reason, LIMITS.reason, role + ' 難易度の理由');
    lim(x.note, LIMITS.note, role + ' 特記事項');
    if (!x.diff || !x.perf) { e.push(role + '：難易度と全体のパフォーマンスを選んでください'); return; }
    const ex = num_(x.exception), sc = num_(x.score);
    if (ex === null && sc === null) { e.push(role + '：評価点を選んでください'); return; }
    if (ex !== null && (ex < 0 || ex > 10)) e.push(role + '：例外の評価点は0〜10で入力してください');
    if (ex === null) {
      const r = RANGES[x.perf][x.diff];
      if (sc < r[0] - 1e-9 || sc > r[1] + 1e-9) e.push(role + '：評価点が範囲（' + r[0] + '〜' + r[1] + '）の外です。例外の評価点を使ってください');
    }
    const ad = adopted_(x);
    if ((ex !== null || ad < 8.0) && !String(x.note || '').trim()) e.push(role + '：評価点が8.0未満または例外のときは、特記事項に理由を書いてください');
  });
  if (crew['第4審'].evaluated) lim((s['第4審'] || {}).comment, LIMITS.fourth, '第4の審判員 コメント');
  return e;
}

function api_reportSave(t, matchId, data, submit) {
  const c = ctx_(t); need_(c, 'asr');
  const s = slotsOf_(matchId);
  if (!(s['アセッサー'] && s['アセッサー'].kind === '強化' && s['アセッサー'].memberId === c.id)) throw new Error('この試合のアセッサーではありません。');
  const crew = crew_(matchId);
  const m = match_(matchId);
  return withLock_(function () {
    const rep = rows_('レポート').find(function (r) { return r['試合ID'] === matchId; });
    if (rep && rep['状態'] === '提出済') throw new Error('提出済みのレポートは変更できません。修正が必要なときは委員会に差し戻しを依頼してください。');
    if (submit) {
      const errs = validateReport_(data, crew);
      if (errs.length) return { ok: false, errors: errs };
    }
    const o = { '試合ID': matchId, 'アセッサーID': c.id, '状態': submit ? '提出済' : '下書き', '記入日': (data.info || {}).date || today_(),
      '提出日時': submit ? now_() : '', '内容JSON': JSON.stringify(data) };
    if (rep) update_('レポート', rep._row, o); else append_('レポート', o);
    if (!submit) return { ok: true, status: '下書き' };
    // 評価を記録（年間評価の元データ）
    const old = rows_('評価').filter(function (r) { return r['試合ID'] === matchId; }).map(function (r) { return r._row; });
    if (old.length) deleteRows_('評価', old);
    const notify = [];
    OFFICIAL_ROLES.forEach(function (role) {
      if (!crew[role].evaluated) return;
      const sec = (data.s || {})[role] || {};
      append_('評価', { '試合ID': matchId, '試合日': m['試合日'], '役割': role, 'メンバーID': crew[role].memberId, '採用評価点': role === '第4審' ? '' : adopted_(sec) });
      notify.push(crew[role].memberId);
    });
    const label = m['試合日'].slice(5).replace('-', '/') + ' ' + m['大会名'] + ' ' + m['チームA'] + ' 対 ' + m['チームB'];
    notify.filter(function (id, i) { return notify.indexOf(id) === i; }).forEach(function (id) {
      mailMember_(member_(id), 'アセスメントレポートが届きました', [label, 'のアセスメントレポートが提出されました。'], 'myreport', matchId);
    });
    committee_().forEach(function (cm) {
      mailMember_(cm, 'アセスメントレポートが提出されました', [label, 'アセッサー：' + c.name], 'c_report', matchId);
    });
    return { ok: true, status: '提出済' };
  });
}

/* ───────── 委員会：試合一覧 ───────── */

function api_months(t) {
  const c = ctx_(t); need_(c, 'com');
  const set = {};
  rows_('試合').forEach(function (r) { set[r['対象月']] = 1; });
  rows_('月管理').forEach(function (r) { set[r['対象月']] = 1; });
  const cur = ym_(today_());
  set[cur] = 1; set[addMonth_(cur, 1)] = 1;
  return Object.keys(set).filter(String).sort().reverse().map(function (ym) {
    return { ym: ym, list: listPublished_(ym), assign: assignPublished_(ym), deadline: surveyDeadline_(ym) };
  });
}

function api_matches(t, ym) {
  const c = ctx_(t); need_(c, 'com');
  const venues = rows_('会場').map(function (r) { return r['会場名']; });
  const matches = rows_('試合').filter(function (m) { return m['対象月'] === ym; }).map(function (m) {
    const v = matchView_(m); v.assoc = venueAssoc_(v.venue); return v;
  }).sort(sortByDate_);
  const teams = rows_('チーム').map(function (r) { return r['チーム名']; });
  const comps = {}; rows_('試合').forEach(function (r) { comps[r['大会名']] = 1; });
  return { month: ym, matches: matches, venues: venues, teams: teams, comps: Object.keys(comps),
    listPublished: listPublished_(ym), assignPublished: assignPublished_(ym), deadline: surveyDeadline_(ym) };
}

function normDate_(s) {
  s = String(s || '').trim().replace(/[年月\.]/g, '/').replace(/日/g, '').replace(/-/g, '/');
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return '';
  return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
}
function normTime_(s) {
  const m = String(s || '').trim().replace('：', ':').match(/^(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}

function api_saveMatches(t, list) {
  const c = ctx_(t); need_(c, 'com');
  const errs = [];
  return withLock_(function () {
    let n = 0, skipped = 0;
    list.forEach(function (x, i) {
      const date = normDate_(x.date), ko = normTime_(x.ko);
      if (!date || !x.a || !x.b || !x.comp) { errs.push((i + 1) + '行目：大会名・試合日・チームA・チームBは必須です'); return; }
      const o = { '試合ID': x.id || uid_(), '対象月': ym_(date), '大会名': x.comp, '試合名': x.name || '', '試合日': date, 'キックオフ': ko,
        '会場': x.venue || '', 'チームA': x.a, 'チームB': x.b };
      const ex = x.id ? match_(x.id) : null;
      // 新しく追加する行で、同じ日・同じ対戦がもうあれば飛ばす（同じCSVを2回取り込んでも重ならない）
      if (!ex && rows_('試合').some(function (r) { return r['試合日'] === date && r['チームA'] === x.a && r['チームB'] === x.b; })) { skipped++; return; }
      if (ex) update_('試合', ex._row, o); else append_('試合', o);
      n++;
    });
    return { saved: n, skipped: skipped, errors: errs };
  });
}

function api_deleteMatch(t, id) {
  const c = ctx_(t); need_(c, 'com');
  return withLock_(function () {
    const m = match_(id);
    if (!m) return true;
    if (rows_('レポート').some(function (r) { return r['試合ID'] === id; })) throw new Error('レポートがある試合は削除できません。');
    if (rows_('試合映像').some(function (r) { return r['試合ID'] === id; })) throw new Error('映像が登録されている試合は削除できません。');
    const asg = rows_('割当').filter(function (r) { return r['試合ID'] === id; });
    // 公開済みの割当がある場合は、外れた人に変更通知
    if (assignPublished_(m['対象月'])) {
      asg.forEach(function (r) { if (r['区分'] === '強化') { const o = clean_(r); o['区分'] = ''; o['メンバーID'] = ''; update_('割当', r._row, o); } });
      notifyAssign_([id], false);
    }
    deleteRows_('割当', rows_('割当').filter(function (r) { return r['試合ID'] === id; }).map(function (r) { return r._row; }));
    deleteRows_('稼働調査', rows_('稼働調査').filter(function (r) { return r['試合ID'] === id; }).map(function (r) { return r._row; }));
    deleteRows_('試合', [match_(id)._row]);
    return true;
  });
}

function api_publishList(t, ym) {
  const c = ctx_(t); need_(c, 'com');
  if (!rows_('試合').some(function (r) { return r['対象月'] === ym; })) throw new Error('試合が登録されていません。');
  return withLock_(function () { publishList_(ym); return true; });
}

/* ───────── 委員会：稼働状況 ───────── */

function api_surveyStatus(t, ym) {
  const c = ctx_(t); need_(c, 'com');
  const matches = rows_('試合').filter(function (m) { return m['対象月'] === ym; }).map(matchView_).sort(sortByDate_);
  const ids = matches.map(function (m) { return m.id; });
  const ans = rows_('稼働調査').filter(function (a) { return ids.indexOf(a['試合ID']) >= 0; });
  const refs = activeRefs_().map(function (m) {
    const a = {};
    ans.filter(function (x) { return x['メンバーID'] === m.ID; }).forEach(function (x) { a[x['試合ID']] = { ans: x['回答'], note: x['備考'] }; });
    return { id: m.ID, name: m['氏名'], answers: a, answered: Object.keys(a).filter(function (k) { return a[k].ans; }).length };
  });
  return { month: ym, matches: matches, refs: refs, deadline: surveyDeadline_(ym), published: listPublished_(ym) };
}

/* ───────── 委員会：割当 ───────── */

function alertsFor_(memberId, match, role, allAsg) {
  const out = [];
  const myOthers = allAsg.filter(function (r) { return r['区分'] === '強化' && r['メンバーID'] === memberId && r['試合ID'] !== match['試合ID']; });
  const same = allAsg.filter(function (r) { return r['区分'] === '強化' && r['メンバーID'] === memberId && r['試合ID'] === match['試合ID'] && r['役割'] !== role; });
  if (same.length) out.push('同じ試合で' + same[0]['役割'] + 'に割当済み');
  const card = [match['チームA'], match['チームB']].sort().join('|');
  const year = String(match['試合日']).slice(0, 4);
  myOthers.forEach(function (r) {
    const m = match_(r['試合ID']); if (!m) return;
    if (m['試合日'] === match['試合日']) out.push('同日に別の試合（' + r['役割'] + '）');
    if (role === 'アセッサー' || r['役割'] === 'アセッサー') return;
    const card2 = [m['チームA'], m['チームB']].sort().join('|');
    const md = m['試合日'].slice(5).replace('-', '/');
    if (card2 === card && String(m['試合日']).slice(0, 4) === year) out.push('同一カードを今シーズン担当済み（' + md + '）');
    else if (dayDiff_(m['試合日'], match['試合日']) <= 61) {
      const teams = [match['チームA'], match['チームB']].filter(function (x) { return x === m['チームA'] || x === m['チームB']; });
      if (teams.length) out.push(teams.join('・') + 'を2か月以内に担当（' + md + '）');
    }
  });
  return out.filter(function (x, i) { return out.indexOf(x) === i; });
}

function api_assignBoard(t, ym) {
  const c = ctx_(t); need_(c, 'com');
  const allAsg = rows_('割当');
  const ans = rows_('稼働調査');
  const refs = activeRefs_();
  const asrs = members_().filter(function (m) { return truthy_(m['在籍']) && truthy_(m['アセッサー']); });
  const matches = rows_('試合').filter(function (m) { return m['対象月'] === ym; }).map(function (m) {
    const v = matchView_(m);
    v.assoc = venueAssoc_(v.venue);
    v.slots = {};
    allAsg.filter(function (r) { return r['試合ID'] === v.id; }).forEach(function (r) {
      v.slots[r['役割']] = { kind: r['区分'], memberId: r['メンバーID'], dname: r['派遣者氏名'], daffil: r['派遣者所属'], assoc: r['依頼先協会'] };
    });
    v.cands = {};
    OFFICIAL_ROLES.forEach(function (role) {
      v.cands[role] = refs.map(function (rf) {
        const a = ans.find(function (x) { return x['試合ID'] === v.id && x['メンバーID'] === rf.ID; });
        return { id: rf.ID, name: rf['氏名'], grade: rf['級'], ans: a ? a['回答'] : '', note: a ? a['備考'] : '', alerts: alertsFor_(rf.ID, m, role, allAsg) };
      }).filter(function (x) { return x.ans === '○' || x.ans === '△' || (v.slots[role] && v.slots[role].memberId === x.id); });
    });
    v.cands['アセッサー'] = asrs.map(function (a) { return { id: a.ID, name: a['氏名'], ans: '', alerts: alertsFor_(a.ID, m, 'アセッサー', allAsg) }; });
    return v;
  }).sort(sortByDate_);
  const assocs = rows_('地区協会').map(function (r) { return r['協会名']; });
  return { month: ym, matches: matches, assocs: assocs, published: assignPublished_(ym), listPublished: listPublished_(ym) };
}

function api_saveAssign(t, matchId, slots) {
  const c = ctx_(t); need_(c, 'com');
  const m = match_(matchId);
  if (!m) throw new Error('試合が見つかりません。');
  return withLock_(function () {
    const exist = rows_('割当').filter(function (r) { return r['試合ID'] === matchId; });
    ROLES.forEach(function (role) {
      const s = slots[role] || {};
      const kind = s.kind === '強化' || s.kind === '地区派遣' ? s.kind : '';
      if (role === 'アセッサー' && kind === '地区派遣') throw new Error('アセッサーは地区派遣にできません。');
      const ex = exist.find(function (r) { return r['役割'] === role; });
      const o = { '割当ID': ex ? ex['割当ID'] : uid_(), '試合ID': matchId, '役割': role, '区分': kind,
        'メンバーID': kind === '強化' ? (s.memberId || '') : '', '派遣者氏名': kind === '地区派遣' ? (s.dname || '') : '',
        '派遣者所属': kind === '地区派遣' ? (s.daffil || '') : '',
        '依頼先協会': kind === '地区派遣' ? (s.assoc || venueAssoc_(m['会場'])) : '',
        '通知済ID': ex ? ex['通知済ID'] : '', '更新日時': now_() };
      if (ex) update_('割当', ex._row, o);
      else if (kind) append_('割当', o);
    });
    let notified = 0;
    if (assignPublished_(m['対象月'])) notified = notifyAssign_([matchId], false);
    return { notified: notified };
  });
}

function api_publishAssign(t, ym) {
  const c = ctx_(t); need_(c, 'com');
  return withLock_(function () {
    const first = !assignPublished_(ym);
    setMonth_(ym, '割当公開日時', now_());
    const ids = rows_('試合').filter(function (m) { return m['対象月'] === ym; }).map(function (m) { return m['試合ID']; });
    return { notified: notifyAssign_(ids, first) };
  });
}

function api_dispatch(t, ym) {
  const c = ctx_(t); need_(c, 'com');
  const assocMail = {};
  rows_('地区協会').forEach(function (r) { assocMail[r['協会名']] = { mail: r['メール'], person: r['担当者'] }; });
  const groups = {};
  rows_('割当').filter(function (r) { return r['区分'] === '地区派遣'; }).forEach(function (r) {
    const m = match_(r['試合ID']);
    if (!m || m['対象月'] !== ym) return;
    const k = r['依頼先協会'] || '（協会未設定）';
    groups[k] = groups[k] || [];
    groups[k].push({ id: m['試合ID'], date: m['試合日'], ko: m['キックオフ'], venue: m['会場'], comp: m['大会名'], name: m['試合名'],
      a: m['チームA'], b: m['チームB'], role: r['役割'], dname: r['派遣者氏名'], daffil: r['派遣者所属'] });
  });
  return Object.keys(groups).sort().map(function (k) {
    return { assoc: k, mail: (assocMail[k] || {}).mail || '', person: (assocMail[k] || {}).person || '',
      items: groups[k].sort(function (a, b) { return (a.date + a.ko + a.role).localeCompare(b.date + b.ko + b.role); }) };
  });
}

/* ───────── 委員会：レポート一覧・差し戻し ───────── */

function api_reports(t, ym) {
  const c = ctx_(t); need_(c, 'com');
  const reps = rows_('レポート');
  return rows_('試合').filter(function (m) { return m['対象月'] === ym; }).map(function (m) {
    const v = matchView_(m);
    const s = slotsOf_(v.id);
    v.assessor = s['アセッサー'] && s['アセッサー'].kind === '強化' ? s['アセッサー'].name : '';
    const rep = reps.find(function (r) { return r['試合ID'] === v.id; });
    v.status = rep ? rep['状態'] : (v.assessor ? '未作成' : 'アセッサーなし');
    v.submittedAt = rep ? rep['提出日時'] : '';
    return v;
  }).sort(sortByDate_);
}

function api_reportRevert(t, matchId) {
  const c = ctx_(t); need_(c, 'com');
  return withLock_(function () {
    const rep = rows_('レポート').find(function (r) { return r['試合ID'] === matchId; });
    if (!rep) return true;
    const o = clean_(rep); o['状態'] = '下書き'; o['提出日時'] = '';
    update_('レポート', rep._row, o);
    deleteRows_('評価', rows_('評価').filter(function (r) { return r['試合ID'] === matchId; }).map(function (r) { return r._row; }));
    return true;
  });
}

/* ───────── 委員会：審判員カルテ ───────── */

function api_karte(t, memberId) {
  const c = ctx_(t); need_(c, 'com');
  const refs = members_().filter(function (m) { return truthy_(m['審判員']); }).map(function (m) { return { id: m.ID, name: m['氏名'], active: truthy_(m['在籍']) }; });
  if (!memberId) return { refs: refs };
  const m = member_(memberId);
  const asg = rows_('割当').filter(function (r) { return r['区分'] === '強化' && r['メンバーID'] === memberId; }).map(function (r) {
    const v = matchView_(match_(r['試合ID'])); if (!v) return null; v.role = r['役割']; return v;
  }).filter(Boolean).sort(sortByDate_).reverse();
  const rep = api_myReports(t, memberId);
  const fit = rows_('体力テスト').filter(function (r) { return r['メンバーID'] === memberId; }).map(fitnessView_).sort(function (a, b) { return b.month.localeCompare(a.month); });
  return { refs: refs, member: { id: m.ID, name: m['氏名'], affil: m['所属'], grade: m['級'], mail: m['メール'] }, assignments: asg, reports: rep, fitness: fit };
}

/* ───────── 委員会：マスタ ───────── */

const MASTER_EDITABLE = ['メンバー', '会場', '地区協会', 'チーム', '設定'];

function api_master(t, name) {
  const c = ctx_(t); need_(c, 'com');
  if (MASTER_EDITABLE.indexOf(name) < 0) throw new Error('編集できない表です。');
  // 個人ページURL列が古い・空のとき（列を足した直後や PAGE_URL を変えたとき）は作り直す
  if (name === 'メンバー' && rows_(name).some(function (r) { return r['個人ページURL'] !== memberUrl_(r['トークン']); })) refreshMemberUrls_();
  const rows = rows_(name).map(clean_);
  const urls = {};
  if (name === 'メンバー' || name === 'チーム') rows.forEach(function (r, i) { if (r['トークン']) urls[i] = pageUrl_(r['トークン']); });
  return { name: name, headers: SHEETS[name], rows: rows, urls: urls, bools: name === 'メンバー' ? BOOL_COLS : [] };
}

function api_saveMaster(t, name, rows) {
  const c = ctx_(t); need_(c, 'com');
  if (DEMO_) throw new Error('デモではマスタを保存できません（本番のデータを守るため）。');
  if (MASTER_EDITABLE.indexOf(name) < 0) throw new Error('編集できない表です。');
  return withLock_(function () {
    const head = SHEETS[name];
    let list = rows.map(function (r) { const o = {}; head.forEach(function (k) { o[k] = r[k] === undefined ? '' : r[k]; }); return o; })
      .filter(function (o) { return head.some(function (k) { return k !== 'トークン' && BOOL_COLS.indexOf(k) < 0 && String(o[k]).trim() !== ''; }); });
    if (name === 'メンバー') {
      let maxNo = 0;
      list.forEach(function (o) { const n = Number(String(o.ID || '').replace(/\D/g, '')); if (n > maxNo) maxNo = n; });
      const ids = {};
      list.forEach(function (o) {
        if (!o['氏名']) throw new Error('氏名が空の行があります。');
        if (!o.ID || ids[o.ID]) { maxNo++; o.ID = 'M' + ('000' + maxNo).slice(-3); }
        ids[o.ID] = 1;
        if (!o['トークン']) o['トークン'] = token_();
        BOOL_COLS.forEach(function (k) { o[k] = truthy_(o[k]); });
      });
      if (!list.some(function (o) { return o['委員会'] && o['在籍'] && o['トークン'] === t; })) throw new Error('自分の委員会権限を外すことはできません。');
    }
    if (name === 'チーム') list.forEach(function (o) { if (!o['トークン']) o['トークン'] = token_(); });
    if (name === '設定') {
      const cur = rows_('設定');
      list = cur.map(function (r) { const n = rows.find(function (x) { return x['キー'] === r['キー']; }); const o = clean_(r); if (n) o['値'] = n['値']; return o; });
    }
    rewrite_(name, list);
    if (name === '設定') refreshMemberUrls_();
    if (name === 'メンバー') {
      const s = sh_('メンバー');
      BOOL_COLS.forEach(function (k) { s.getRange(2, head.indexOf(k) + 1, Math.max(list.length, 1), 1).insertCheckboxes(); });
    }
    return api_master(t, name);
  });
}

/* ───────── 試合映像・コメント・事例 ───────── */

function ytId_(url) {
  const s = String(url || '').trim();
  const m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/live\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : '';
}
/* Veo の共有リンク（試合を「公開」にしたもの）。外から操作できないので、画面では Veo の画面を開くだけ */
function isVeo_(url) { return /^https?:\/\/([a-z0-9-]+\.)*veo\.(co|com)\//i.test(String(url || '').trim()); }
// 貼り付けた URL を調べる：YouTube なら動画ID、Veo なら '' を返す。どちらでもなければエラー
const URL_ERR = 'YouTube か Veo の URL を貼り付けてください（例：https://youtu.be/xxxxxxxxxxx）。';
function videoUrl_(url) {
  const yt = ytId_(url);
  if (yt) return yt;
  if (isVeo_(url)) return '';
  throw new Error(URL_ERR);
}
// 同じ組か：同じ試合・同じ出どころ・同じ種類（YouTube 同士／Veo 同士）
function sameKind_(r, yt) { return !r['動画ID'] === !yt; }

/* 1試合の映像が複数に分かれているときの区分。画面ではこの順に続けて再生する（同じ試合・同じ出どころの映像が1組） */
const PARTS = ['試合全体', '前半', '前半①', '前半②', '前半③', '後半', '後半①', '後半②', '後半③', '延長', 'PK'];
function part_(p) { return PARTS.indexOf(p) >= 0 ? p : '試合全体'; }
function videoView_(r) {
  return { id: r['映像ID'], matchId: r['試合ID'], team: r['提供チーム'], url: r['URL'], yt: r['動画ID'], ko: num_(r['KO位置秒']), h2: num_(r['後半開始秒']), at: r['登録日時'],
    byId: r['登録者ID'] || '', by: r['登録者ID'] ? memberName_(r['登録者ID']) : '', part: part_(r['区分']), dur: num_(r['長さ秒']), veo: !r['動画ID'] };
}
function byPart_(a, b) { return PARTS.indexOf(a.part) - PARTS.indexOf(b.part) || String(a.at).localeCompare(String(b.at)); }
// その映像と同じ組（同じ試合・同じ出どころ）の映像を区分の順に
function setOf_(v) {
  return rows_('試合映像').filter(function (r) { return r['試合ID'] === v.matchId && r['提供チーム'] === v.team && sameKind_(r, v.yt); }).map(videoView_).sort(byPart_);
}

/* メンバー（審判員・アセッサー・委員会）が映像を登録する：チームから受け取った映像など */
function api_videoMatches(t) {
  const c = ctx_(t); need_(c);
  const today = today_();
  return rows_('試合').filter(function (m) { return m['試合日'] && m['試合日'] <= today; }).map(matchView_).sort(sortByDate_).reverse().slice(0, 300);
}
function api_addVideo(t, matchId, source, url, part) {
  const c = ctx_(t); need_(c);
  const m = match_(matchId);
  if (!m) throw new Error('試合を選んでください。');
  const yt = videoUrl_(url);
  const src = String(source || '').trim().slice(0, 60);
  if (!src) throw new Error('映像の出どころ（チーム名など）を入力してください。');
  return withLock_(function () {
    const ex = rows_('試合映像').find(function (r) { return r['試合ID'] === matchId && (yt ? r['動画ID'] === yt : String(r['URL']).trim() === String(url).trim()); });
    if (ex) throw new Error('この試合には同じ映像がすでに登録されています。');
    const id = uid_();
    const p = part_(part);
    if (rows_('試合映像').some(function (r) { return r['試合ID'] === matchId && r['提供チーム'] === src && sameKind_(r, yt) && part_(r['区分']) === p; })) throw new Error('この試合・出どころの「' + p + '」はすでに登録されています。');
    append_('試合映像', { '映像ID': id, '試合ID': matchId, '提供チーム': src, 'URL': String(url).trim(), '動画ID': yt, 'KO位置秒': '', '後半開始秒': '', '登録日時': now_(), '登録者ID': c.id, '区分': p, '長さ秒': '' });
    return { id: id, veo: !yt };
  });
}
/* 間違えて登録した映像を直す（登録した人か委員会）。試合・出どころ・区分・URL を変えられる */
function api_editVideo(t, videoId, x) {
  const c = ctx_(t); need_(c);
  return withLock_(function () {
    const r = rows_('試合映像').find(function (y) { return y['映像ID'] === videoId; });
    if (!r) throw new Error('映像が見つかりません。');
    if (!c.com && r['登録者ID'] !== c.id) throw new Error('登録した人か委員会だけが直せます。');
    const m = match_(x.matchId);
    if (!m) throw new Error('試合を選んでください。');
    const yt = videoUrl_(x.url);
    const src = String(x.source || '').trim().slice(0, 60);
    if (!src) throw new Error('映像の出どころ（チーム名など）を入力してください。');
    const p = part_(x.part);
    if (rows_('試合映像').some(function (y) { return y['映像ID'] !== videoId && y['試合ID'] === x.matchId && y['提供チーム'] === src && sameKind_(y, yt) && part_(y['区分']) === p; }))
      throw new Error('この試合・出どころの「' + p + '」はほかに登録されています。');
    const o = clean_(r);
    const newVideo = o['動画ID'] !== yt || (!yt && String(o['URL']).trim() !== String(x.url).trim());
    o['試合ID'] = x.matchId; o['提供チーム'] = src; o['区分'] = p; o['URL'] = String(x.url).trim(); o['動画ID'] = yt;
    if (newVideo) { o['長さ秒'] = ''; o['KO位置秒'] = ''; o['後半開始秒'] = ''; }   // 別の動画になったら、長さと位置は測り直し
    update_('試合映像', r._row, o);
    return { id: videoId, newVideo: newVideo, veo: !yt };
  });
}
/* 削除。事例ライブラリで使われている映像は、委員会が「事例ごと削除」を選んだときだけ消せる */
function api_delVideo(t, videoId, withCases) {
  const c = ctx_(t); need_(c);
  return withLock_(function () {
    const r = rows_('試合映像').find(function (x) { return x['映像ID'] === videoId; });
    if (!r) return true;
    if (!c.com && r['登録者ID'] !== c.id) throw new Error('登録した人か委員会だけが削除できます。');
    const cases = rows_('事例').filter(function (x) { return x['映像ID'] === videoId; });
    if (cases.length && !(c.com && withCases)) throw new Error('この映像は事例ライブラリで' + cases.length + '件使われているため削除できません。' + (c.com ? '' : '委員会に相談してください。'));
    if (cases.length) deleteRows_('事例', cases.map(function (x) { return x._row; }));
    deleteRows_('映像コメント', rows_('映像コメント').filter(function (x) { return x['映像ID'] === videoId; }).map(function (x) { return x._row; }));
    deleteRows_('試合映像', [r._row]);
    return true;
  });
}

function videosOfMatch_(matchId) {
  return rows_('試合映像').filter(function (r) { return r['試合ID'] === matchId; }).map(videoView_);
}

function api_videos(t) {
  const c = ctx_(t); need_(c);
  const cm = {}; rows_('映像コメント').forEach(function (r) { cm[r['映像ID']] = (cm[r['映像ID']] || 0) + 1; });
  return rows_('試合映像').map(function (r) {
    const v = videoView_(r); v.match = matchView_(match_(v.matchId)); v.comments = cm[v.id] || 0; return v;
  }).filter(function (v) { return v.match; }).sort(function (a, b) { return sortByDate_(a.match, b.match); }).reverse();
}

function commentView_(r) {
  return { id: r['コメントID'], videoId: r['映像ID'], sec: num_(r['秒']), target: r['対象'], cat: r['分類'], eval: r['評価'], text: r['コメント'], by: memberName_(r['記入者ID']), byId: r['記入者ID'], at: r['日時'] };
}
function caseView_(r) {
  return { id: r['事例ID'], videoId: r['映像ID'], start: num_(r['開始秒']), end: num_(r['終了秒']), title: r['タイトル'],
    tags: String(r['タグ'] || '').split(',').filter(String), correct: r['正しい判定'], text: r['解説'], material: r['資料URL'],
    by: memberName_(r['登録者ID']), byId: r['登録者ID'], at: r['日時'] };
}

function api_video(t, videoId) {
  const c = ctx_(t); need_(c);
  const r = rows_('試合映像').find(function (x) { return x['映像ID'] === videoId; });
  if (!r) throw new Error('映像が見つかりません。');
  const v = videoView_(r);
  const parts = setOf_(v), ids = parts.map(function (x) { return x.id; });
  // ほかの出どころの映像（組ごとに先頭の1本）
  const others = [];
  const all = videosOfMatch_(v.matchId).sort(byPart_);
  all.forEach(function (x) { if (!x.veo && x.team !== v.team && !others.some(function (o) { return o.team === x.team; })) others.push(x); });
  return {
    video: v, parts: parts, match: matchView_(match_(v.matchId)), crew: crew_(v.matchId), others: others, team: v.team,
    veo: all.filter(function (x) { return x.veo; }),
    comments: rows_('映像コメント').filter(function (x) { return ids.indexOf(x['映像ID']) >= 0; }).map(commentView_),
    cases: rows_('事例').filter(function (x) { return ids.indexOf(x['映像ID']) >= 0; }).map(caseView_),
    canComment: c.asr || c.com, canCase: c.asr || c.com, me: c.id, com: c.com, canDelete: c.com || (!!v.byId && v.byId === c.id),
  };
}

/* キックオフ・後半開始の位置。組の中のどれか1本に「その映像の何秒か」で持つ（同じ組のほかの映像からは消す） */
function api_setMark(t, videoId, which, sec) {
  const c = ctx_(t); need_(c);
  if (!c.asr && !c.com) throw new Error('権限がありません。');
  const col = which === 'h2' ? '後半開始秒' : 'KO位置秒';
  return withLock_(function () {
    const r = rows_('試合映像').find(function (x) { return x['映像ID'] === videoId; });
    if (!r) throw new Error('映像が見つかりません。');
    setOf_(videoView_(r)).forEach(function (x) {
      const row = rows_('試合映像').find(function (y) { return y['映像ID'] === x.id; });
      const o = clean_(row);
      const v = x.id === videoId && sec !== null && sec !== '' ? Math.max(0, Math.round(Number(sec))) : '';
      if (String(o[col]) !== String(v)) { o[col] = v; update_('試合映像', row._row, o); }
    });
    return true;
  });
}
/* 映像の長さ（秒）。画面で再生したときに分かるので、だれが開いても記録する */
function api_setDuration(t, videoId, sec) {
  const c = ctx_(t);
  const n = Math.round(Number(sec));
  if (!(n > 0)) return false;
  return withLock_(function () {
    const r = rows_('試合映像').find(function (x) { return x['映像ID'] === videoId; });
    if (!r || Math.abs((num_(r['長さ秒']) || 0) - n) <= 1) return false;
    const o = clean_(r); o['長さ秒'] = n; update_('試合映像', r._row, o); return true;
  });
}

function api_addComment(t, videoId, x) {
  const c = ctx_(t); need_(c);
  if (!c.asr && !c.com) throw new Error('コメントはアセッサーが入力できます。');
  if (!String(x.text || '').trim()) throw new Error('コメントを入力してください。');
  if (len_(x.text) > 500) throw new Error('コメントは500字以内にしてください。');
  return withLock_(function () {
    append_('映像コメント', { 'コメントID': uid_(), '映像ID': videoId, '秒': Math.max(0, Math.round(Number(x.sec) || 0)), '対象': x.target || '',
      '分類': x.cat || '', '評価': x.eval || '', 'コメント': x.text, '記入者ID': c.id, '日時': now_() });
    return api_video(t, videoId).comments;
  });
}

function api_delComment(t, id) {
  const c = ctx_(t); need_(c);
  return withLock_(function () {
    const r = rows_('映像コメント').find(function (x) { return x['コメントID'] === id; });
    if (!r) return true;
    if (r['記入者ID'] !== c.id && !c.com) throw new Error('自分のコメントだけ削除できます。');
    deleteRows_('映像コメント', [r._row]); return true;
  });
}

function api_addCase(t, x) {
  const c = ctx_(t); need_(c);
  if (!c.asr && !c.com) throw new Error('事例は委員会とアセッサーが登録できます。');
  const start = Math.round(Number(x.start)), end = Math.round(Number(x.end));
  if (!(end > start)) throw new Error('終了時間は開始時間より後にしてください。');
  if (!String(x.title || '').trim()) throw new Error('タイトルを入力してください。');
  return withLock_(function () {
    const o = { '事例ID': x.id || uid_(), '映像ID': x.videoId, '開始秒': start, '終了秒': end, 'タイトル': x.title, 'タグ': (x.tags || []).join(','),
      '正しい判定': x.correct || '', '解説': x.text || '', '資料URL': x.material || '', '登録者ID': c.id, '日時': now_() };
    const ex = x.id ? rows_('事例').find(function (r) { return r['事例ID'] === x.id; }) : null;
    if (ex) {
      if (ex['登録者ID'] !== c.id && !c.com) throw new Error('自分が登録した事例だけ編集できます。');
      o['登録者ID'] = ex['登録者ID']; update_('事例', ex._row, o);
    } else append_('事例', o);
    return true;
  });
}

function api_delCase(t, id) {
  const c = ctx_(t); need_(c);
  return withLock_(function () {
    const r = rows_('事例').find(function (x) { return x['事例ID'] === id; });
    if (!r) return true;
    if (r['登録者ID'] !== c.id && !c.com) throw new Error('自分が登録した事例だけ削除できます。');
    deleteRows_('事例', [r._row]); return true;
  });
}

function api_cases(t) {
  const c = ctx_(t); need_(c);
  const vids = {}; rows_('試合映像').forEach(function (r) { vids[r['映像ID']] = r; });
  return rows_('事例').map(function (r) {
    const x = caseView_(r);
    const v = vids[x.videoId];
    if (!v) return null;
    const m = match_(v['試合ID']);
    x.yt = v['動画ID']; x.comp = m ? m['大会名'] : ''; x.date = m ? m['試合日'] : '';
    // 担当審判員の名前は出さない
    return x;
  }).filter(Boolean).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
}

/* ───────── チーム：映像提供 ───────── */

function api_teamHome(t) {
  const c = ctx_(t);
  if (c.kind !== 'team') throw new Error('チーム用のURLから開いてください。');
  const vids = rows_('試合映像').filter(function (r) { return r['提供チーム'] === c.name && !r['登録者ID']; });
  const today = today_();
  const matches = rows_('試合').filter(function (m) { return (m['チームA'] === c.name || m['チームB'] === c.name) && m['試合日'] <= today; })
    .map(function (m) {
      const v = matchView_(m);
      v.videos = vids.filter(function (x) { return x['試合ID'] === v.id; }).map(videoView_).sort(byPart_);
      return v;
    }).sort(sortByDate_).reverse();
  return { team: c.name, matches: matches };
}

function api_teamSaveVideo(t, matchId, url, part) {
  const c = ctx_(t);
  if (c.kind !== 'team') throw new Error('チーム用のURLから開いてください。');
  const m = match_(matchId);
  if (!m || (m['チームA'] !== c.name && m['チームB'] !== c.name)) throw new Error('自チームの試合だけ登録できます。');
  const yt = videoUrl_(url);
  return withLock_(function () {
    const p = part_(part);
    const ex = rows_('試合映像').find(function (r) { return r['試合ID'] === matchId && r['提供チーム'] === c.name && !r['登録者ID'] && sameKind_(r, yt) && part_(r['区分']) === p; });
    const o = { '映像ID': ex ? ex['映像ID'] : uid_(), '試合ID': matchId, '提供チーム': c.name, 'URL': String(url).trim(), '動画ID': yt,
      'KO位置秒': ex ? ex['KO位置秒'] : '', '後半開始秒': ex ? ex['後半開始秒'] : '', '登録日時': now_(), '登録者ID': '', '区分': p,
      '長さ秒': ex && ex['動画ID'] === yt ? ex['長さ秒'] : '' };
    if (ex) update_('試合映像', ex._row, o); else append_('試合映像', o);
    return api_teamHome(t);
  });
}

function api_teamDelVideo(t, videoId) {
  const c = ctx_(t);
  if (c.kind !== 'team') throw new Error('チーム用のURLから開いてください。');
  return withLock_(function () {
    const r = rows_('試合映像').find(function (x) { return x['映像ID'] === videoId && x['提供チーム'] === c.name && !x['登録者ID']; });
    if (!r) return api_teamHome(t);
    if (rows_('事例').some(function (x) { return x['映像ID'] === videoId; })) throw new Error('この映像は事例ライブラリで使われているため削除できません。委員会にご相談ください。');
    deleteRows_('映像コメント', rows_('映像コメント').filter(function (x) { return x['映像ID'] === videoId; }).map(function (x) { return x._row; }));
    deleteRows_('試合映像', [r._row]);
    return api_teamHome(t);
  });
}

// ===== Demo.gs =====
/**
 * デモデータ：委員会・審判員・アセッサーの流れ（稼働調査 → 割当 → アセスメントレポート）を試すための架空のデータ。
 * ID が DEMO で始まる行がデモ用で、本番のメンバーには見えない（Code.gs の demoFilter_）。デモの人にも本番のデータは見えない。
 * メールアドレスは空にしてあるのでメールは送られない（試したいときはメンバーシートのデモの人にアドレスを入れる）。
 */
const DEMO_PEOPLE_ = [
  { ID: 'DEMO01', 氏名: 'デモ 委員', 委員会: true, アセッサー: false, 審判員: false, 級: '' },
  { ID: 'DEMO02', 氏名: 'デモ 審判A', 審判員: true, 級: '1級' },
  { ID: 'DEMO03', 氏名: 'デモ アセッサー', アセッサー: true, 級: '' },
  { ID: 'DEMO04', 氏名: 'デモ 審判B', 審判員: true, 級: '1級' },
  { ID: 'DEMO05', 氏名: 'デモ 審判C', 審判員: true, 級: '2級' },
  { ID: 'DEMO06', 氏名: 'デモ 審判D', 審判員: true, 級: '2級' },
  { ID: 'DEMO07', 氏名: 'デモ 審判E', 審判員: true, 級: '2級' },
];

function setupDemo() {
  removeDemo(true);
  DEMO_ = true; CACHE_ = {};
  const tok = {};
  DEMO_PEOPLE_.forEach(function (p) {
    tok[p.ID] = token_();
    append_('メンバー', { 'ID': p.ID, '氏名': p['氏名'], '所属': 'デモ', '級': p['級'], 'メール': '', '審判員': !!p['審判員'], 'アセッサー': !!p['アセッサー'],
      '委員会': !!p['委員会'], '在籍': true, 'トークン': tok[p.ID] });
  });
  const venue = (readRows_('会場')[0] || {})['会場名'] || '';
  const day = function (n) { return Utilities.formatDate(new Date(Date.now() + n * 86400000), TZ, 'yyyy-MM-dd'); };
  const addMatch = function (id, date, name, a, b, ko) {
    append_('試合', { '試合ID': id, '対象月': ym_(date), '大会名': 'デモリーグ', '試合名': name, '試合日': date, 'キックオフ': ko, '会場': venue, 'チームA': a, 'チームB': b });
  };
  // 終わった試合（割当公開済み）：1つは提出済みのレポート、1つはアセッサーがこれから書く
  addMatch('DEMO-P1', day(-13), '第1節', 'デモFC', 'サンプルSC', '13:00');
  addMatch('DEMO-P2', day(-6), '第2節', 'テスト大学', '見本ユナイテッド', '11:00');
  // 稼働調査の月：締切（前月15日）まで5日以上ある月
  const today = today_();
  const sym = addMonth_(ym_(today), Number(today.slice(8, 10)) <= 10 ? 1 : 2);
  [['DEMO-S1', '05', '第3節', 'デモFC', 'テスト大学', '13:00'], ['DEMO-S2', '12', '第4節', 'サンプルSC', '見本ユナイテッド', '11:00'],
   ['DEMO-S3', '19', '第5節', 'デモFC', '見本ユナイテッド', '14:00'], ['DEMO-S4', '26', '第6節', 'サンプルSC', 'テスト大学', '13:00']]
    .forEach(function (x) { addMatch(x[0], sym + '-' + x[1], x[2], x[3], x[4], x[5]); });
  setMonth_(sym, '一覧公開日時', now_());

  // 終わった試合の稼働調査は回答済みにしておく（締切後なので直接書く）
  ['DEMO-P1', 'DEMO-P2'].forEach(function (mid, i) {
    ['DEMO02', 'DEMO04', 'DEMO05', 'DEMO06', 'DEMO07'].forEach(function (id, j) {
      append_('稼働調査', { '試合ID': mid, 'メンバーID': id, '回答': (i + j) % 5 === 4 ? '×' : '○', '備考': '', '回答日時': now_() });
    });
  });
  const com = tok.DEMO01, asr = tok.DEMO03;
  const k = function (id) { return { kind: '強化', memberId: id }; };
  api_saveAssign(com, 'DEMO-P1', { '主審': k('DEMO02'), '副審1': k('DEMO04'), '副審2': k('DEMO05'), '第4審': k('DEMO06'), 'アセッサー': k('DEMO03') });
  api_saveAssign(com, 'DEMO-P2', { '主審': k('DEMO04'), '副審1': k('DEMO02'), '副審2': k('DEMO07'), '第4審': { kind: '' }, 'アセッサー': k('DEMO03') });
  [ym_(day(-13)), ym_(day(-6))].filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (ym) { setMonth_(ym, '一覧公開日時', now_()); api_publishAssign(com, ym); });
  const r = api_reportSave(asr, 'DEMO-P1', {
    info: { date: day(-12), time: '90', sc: { a1: '1', b1: '0', a2: '1', b2: '1' }, ops: '特になし' },
    ki: [{ time: '23', text: 'PA内の接触。ノーファウルの判断は妥当' }, { time: '67', text: '反スポーツ的行為で警告。位置・判断ともに良い' }, { time: '', text: '' }, { time: '', text: '' }, { time: '', text: '' }],
    s: {
      '主審': { items: { A: { good: '判定基準が最後まで一貫していた', bad: 'アドバンテージ後の振り返りが遅い場面があった' }, D: { good: '展開を予測した動きができていた', bad: '' } },
        diff: 'ふつう', perf: '良い', score: '8.7', exception: '', advice: 'ロングボールの展開を早めに予測し、斜めの動きを増やすとさらに良くなる', reason: '拮抗した試合を落ち着いてコントロールした', note: '' },
      '副審1': { items: { A: 'オフサイドの判定は正確だった', C: '最終ラインの維持ができていた' }, diff: 'ふつう', perf: '普通', score: '8.2', exception: '', reason: '', note: '' },
      '副審2': { items: { A: '難しいオフサイドを正確に判定した' }, diff: 'ふつう', perf: '良い', score: '8.6', exception: '', reason: '', note: '' },
      '第4審': { comment: '交代の管理とテクニカルエリアの対応が適切だった' },
    },
    p3: '（委員会への報告：審判員には見えません）',
  }, true);
  if (!r.ok) throw new Error('デモのレポートを作れませんでした：' + (r.errors || []).join(' / '));
  // 稼働調査：審判B〜Eは回答済み、審判Aは未回答（自分で試す）
  const sv = api_survey(tok.DEMO04, sym);
  ['DEMO04', 'DEMO05', 'DEMO06', 'DEMO07'].forEach(function (id, j) {
    api_saveSurvey(tok[id], sym, sv.matches.map(function (m, i) { return { id: m.id, ans: (i + j) % 4 === 3 ? '×' : ((i + j) % 4 === 2 ? '△' : '○'), note: (i + j) % 4 === 2 ? '午後からなら可' : '' }; }));
  });
  DEMO_ = false; CACHE_ = {};
  const urls = [['委員会', tok.DEMO01, 'home'], ['審判員（デモ 審判A）', tok.DEMO02, 'survey'], ['アセッサー（デモ アセッサー）', tok.DEMO03, 'home']]
    .map(function (x) { return x[0] + '：\n' + pageUrl_(x[1], x[2]); }).join('\n\n');
  try {
    SpreadsheetApp.getUi().alert('デモデータを作りました',
      '稼働調査と割当は ' + sym.replace('-', '年') + '月 の試合で試せます（委員会の画面では月を ' + Number(sym.slice(5)) + '月 に切り替えてください）。\n\n' +
      '次の URL をそれぞれ開いて試してください（メンバーシートの「デモ」の行の個人ページURLと同じです）。\n\n' + urls +
      '\n\n本番のメンバーにはデモの試合・人は見えません。メールは送られません。終わったらメニューの「デモデータを消す」を実行してください。', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {}
  return tok;
}

// デモの行をすべて消す（本番の行には触れない）
function removeDemo(quiet) {
  const was = DEMO_;
  DEMO_ = false;
  Object.keys(SHEETS).forEach(function (name) {
    const keys = ['ID', '試合ID', 'メンバーID', '映像ID', '対象月'].filter(function (k) { return SHEETS[name].indexOf(k) >= 0; });
    if (!keys.length) return;
    const rows = readRows_(name).filter(function (r) { return keys.some(function (k) { return isDemoId_(r[k]); }); }).map(function (r) { return r._row; });
    if (rows.length) deleteRows_(name, rows);
  });
  CACHE_ = {}; DEMO_ = was;
  if (quiet !== true) { try { SpreadsheetApp.getUi().alert('デモデータを消しました。'); } catch (e) {} }
}


// 画面から呼ぶ入口
function demoSave_(tok) {
  var st = { sheets: SS_.sheets.map(function (s) { return [s.name, s.data]; }), props: PROPS_, tok: tok || demoState_().tok };
  try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch (e) {}
}
function demoState_() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || {}; } catch (e) { return {}; } }
function demoInit_(pageUrl, reset) {
  var st = reset ? {} : demoState_();
  if (st.sheets && st.tok) {
    SS_.sheets = st.sheets.map(function (x) { return new Sheet_(x[0], x[1]); }); PROPS_ = st.props || {};
    return st.tok;
  }
  SS_.sheets = []; PROPS_ = {};
  setup();
  var s = readRows_('設定').find(function (r) { return r['キー'] === 'PAGE_URL'; });
  if (s) update_('設定', s._row, { 'キー': 'PAGE_URL', '値': pageUrl, '説明': s['説明'] });
  CACHE_ = {};
  var tok = setupDemo();
  CACHE_ = {}; DEMO_ = false;
  demoSave_(tok);
  return tok;
}
function demoPost_(body) {
  MAILS_.length = 0;
  var out = doPost({ postData: { contents: body } }).s;
  var req = JSON.parse(body);
  if (!/^api_(boot|home|survey|assignTable|myReports|myReport|fitness|fitnessResults|myAssessments|months|matches|surveyStatus|assignBoard|dispatch|reports|karte|master|videos|cases|videoMatches|teamHome|video|reportGet)$/.test(req.fn)) demoSave_();
  return out;
}
self.DEMO = { init: demoInit_, post: demoPost_ };
