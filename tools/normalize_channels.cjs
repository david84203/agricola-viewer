#!/usr/bin/env node
/**
 * channels.json 字彙正規化（卡片類型系統 工序 1）　2026-09-05
 * 規格：Dropbox/Lu_Agent/600_Project/烏嘎嘎桌遊/agricola-viewer/農家樂_卡片類型系統_規格_20260905.md 第七節
 *
 * 做什麼（只動字彙，不動內容、不刪不加 entry）：
 *   1. role 只留骨幹 6 種（cause／react／get／pay／read／bind），其餘 26 種頻道自創詞搬到 attr
 *      錯字版 react獲得／react消除 → role react ＋ attr 獲得／消除
 *   2. 「格綁定:X」6 條頻道 → ch "格綁定" ＋ attr ["X"]
 *   3. 「尚未打出職業卡／發展卡」→ ch 職業數／發展數 ＋ attr ["尚未打出"]
 *   4. src 拆兩欄：from（資源從哪來）／pool（分數哪一池）
 *   entry 形狀：{ch, role:[骨幹], attr?:[…], on?, from?, pool?}
 *
 * 🔴 絕不 JSON.parse→stringify 整檔重寫（整數樣式 key 會被重排洗牌）。
 *    全程純文字切塊、逐 entry 解析再重排版；解析器＋排版器先過「零改動＝byte 相同原檔」自檢，
 *    任一守門不過就 exit(1) 不寫檔。跑第二次會偵測到已正規化、不動檔案。
 *
 * 用法：node tools/normalize_channels.cjs [--dry]
 */
const fs = require('fs');
const path = require('path');

const VIEWER = path.resolve(__dirname, '..');
const CHANNELS = path.join(VIEWER, 'channels.json');
const DRY = process.argv.includes('--dry');

const BACKBONE = ['cause', 'react', 'get', 'pay', 'read', 'bind'];
const BACKBONE_SET = new Set(BACKBONE);
const TYPO = { 'react獲得': ['react', '獲得'], 'react消除': ['react', '消除'] };
const FROM = new Set(['供應', '場格', '任意', '繁殖', '全部', '卡面歸還', 'pay']);
const POOL = new Set(['紅利分數', '基本計分', '勝利點數', '負分標記', '基本扣分']);
const BIND_PREFIX = '格綁定:';
const UNPLAYED = { '尚未打出職業卡': '職業數', '尚未打出發展卡': '發展數' };

const EXPECT_ENTRIES = 7624;
const EXPECT_CH_BEFORE = 50;
const EXPECT_CH_AFTER = 43;

const die = (msg) => { console.error('❌ 中止：' + msg); process.exit(1); };
const S = (v) => JSON.stringify(v);

// ── 1. 頂層切塊（沿用 apply_score_channel.cjs 的做法）────────────────
function splitBlocks(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(eol);
  if (lines[0] !== '{') die('第一行不是 "{"');
  if (lines[lines.length - 1] !== '}') die('最後一行不是 "}"（檔尾不可有換行）');
  const blocks = [];
  let i = 1;
  while (i < lines.length - 1) {
    const m = lines[i].match(/^ "(.+)": \{$/);
    if (!m) die(`第 ${i + 1} 行不是頂層 key：${S(lines[i])}`);
    let j = i;
    while (j < lines.length - 1 && lines[j] !== ' }' && lines[j] !== ' },') j++;
    if (j >= lines.length - 1) die(`key ${m[1]} 找不到結尾`);
    blocks.push({ key: m[1], lines: lines.slice(i, j + 1) });
    i = j + 1;
  }
  return { eol, blocks };
}
function joinBlocks(eol, blocks) {
  const out = ['{'];
  blocks.forEach((b, idx) => {
    const body = b.lines.slice();
    body[body.length - 1] = idx === blocks.length - 1 ? ' }' : ' },';
    out.push(...body);
  });
  out.push('}');
  return out.join(eol);
}

// ── 2. 區塊內逐 entry 解析／排版（嚴格：任何沒見過的行型就中止）──────
// 回傳 {head:[…], entries:[{lines, obj}], tail:[…]}；head 含 "牌名" 與 "channels": [，tail 從 "  ]" 起（含 effects）
function parseBlock(blk) {
  const L = blk.lines;
  // 2 張卡（4548-3、8735-4 附近）channels 是空陣列 "  \"channels\": []"：整塊原封不動
  if (L.some(l => l === '  "channels": []' || l === '  "channels": [],')) return { head: L, entries: [], tail: [] };
  const ci = L.findIndex(l => l === '  "channels": [');
  if (ci < 0) die(`${blk.key} 找不到 "channels": [`);
  let cj = ci + 1;
  while (cj < L.length && L[cj] !== '  ]' && L[cj] !== '  ],') cj++;
  if (cj >= L.length) die(`${blk.key} 找不到 channels 收尾`);
  const entries = [];
  let i = ci + 1;
  while (i < cj) {
    if (L[i] !== '   {') die(`${blk.key} 第 ${i} 行預期 "   {"：${S(L[i])}`);
    let j = i + 1;
    while (j < cj && L[j] !== '   }' && L[j] !== '   },') j++;
    if (j >= cj) die(`${blk.key} entry 找不到收尾`);
    const lines = L.slice(i, j + 1);
    entries.push({ lines, obj: parseEntry(blk.key, lines) });
    i = j + 1;
  }
  return { head: L.slice(0, ci + 1), entries, tail: L.slice(cj) };
}
function str(key, line) {
  const m = line.match(/^    "(\w+)": (".*"),?$/);
  if (!m) die(`${key} 看不懂的行：${S(line)}`);
  return [m[1], JSON.parse(m[2])];
}
function parseEntry(key, lines) {
  const o = {};
  let i = 1;
  const last = lines.length - 1;
  while (i < last) {
    const l = lines[i];
    const arr = l.match(/^    "(\w+)": \[(\]?),?$/);
    if (arr) {
      const name = arr[1];
      const items = [];
      if (arr[2] === ']') { i++; }
      else {
        i++;
        while (i < last && lines[i] !== '    ]' && lines[i] !== '    ],') {
          const m = lines[i].match(/^     (".*"),?$/);
          if (!m) die(`${key} 陣列項看不懂：${S(lines[i])}`);
          items.push(JSON.parse(m[1]));
          i++;
        }
        if (i >= last) die(`${key} 陣列 ${name} 找不到收尾`);
        i++;
      }
      if (name in o) die(`${key} 重複欄位 ${name}`);
      o[name] = items;
      continue;
    }
    const [k, v] = str(key, l);
    if (k in o) die(`${key} 重複欄位 ${k}`);
    o[k] = v;
    i++;
  }
  return o;
}
// 排版：欄位照物件插入順序，字串用 JSON.stringify，陣列一項一行（空陣列 []）
function renderEntry(o, isLast) {
  const keys = Object.keys(o);
  const out = ['   {'];
  keys.forEach((k, idx) => {
    const comma = idx === keys.length - 1 ? '' : ',';
    const v = o[k];
    if (Array.isArray(v)) {
      if (!v.length) { out.push(`    ${S(k)}: []${comma}`); return; }
      out.push(`    ${S(k)}: [`);
      v.forEach((x, i) => out.push(`     ${S(x)}${i === v.length - 1 ? '' : ','}`));
      out.push(`    ]${comma}`);
    } else {
      out.push(`    ${S(k)}: ${S(v)}${comma}`);
    }
  });
  out.push(isLast ? '   }' : '   },');
  return out;
}
function renderBlock(parsed) {
  const out = parsed.head.slice();
  parsed.entries.forEach((e, i) => out.push(...renderEntry(e.obj, i === parsed.entries.length - 1)));
  out.push(...parsed.tail);
  return out;
}

// ── 3. 正規化一筆 entry ─────────────────────────────────────────────
function normalize(key, e) {
  const allowed = new Set(['ch', 'role', 'on', 'src']);
  for (const k in e) if (!allowed.has(k)) die(`${key} entry 有不認得的欄位 ${k}（已經正規化過？）`);
  const o = { ch: e.ch, role: [], attr: [] };
  for (const r of e.role || []) {
    if (BACKBONE_SET.has(r)) { if (!o.role.includes(r)) o.role.push(r); }
    else if (TYPO[r]) { const [ro, at] = TYPO[r]; if (!o.role.includes(ro)) o.role.push(ro); o.attr.push(at); }
    else o.attr.push(r);
  }
  if (e.ch.startsWith(BIND_PREFIX)) { o.ch = '格綁定'; o.attr.push(e.ch.slice(BIND_PREFIX.length)); }
  if (UNPLAYED[e.ch]) {
    if (!(o.role.length === 1 && o.role[0] === 'read')) die(`${key} ${e.ch} 的 role 不是純 read：${S(e.role)}`);
    o.ch = UNPLAYED[e.ch]; o.attr.push('尚未打出');
  }
  if (!o.attr.length) delete o.attr;
  if ('on' in e) o.on = e.on;
  if ('src' in e) {
    if (FROM.has(e.src)) o.from = e.src;
    else if (POOL.has(e.src)) o.pool = e.src;
    else die(`${key} 不認得的 src：${S(e.src)}`);
  }
  return o;
}

// ── 4. 統計 ─────────────────────────────────────────────────────────
function count(map, k) { map[k] = (map[k] || 0) + 1; }
function inventory(entryObjs) {
  const inv = { entries: 0, ch: {}, role: {}, attr: {}, from: {}, pool: {}, src: {} };
  for (const e of entryObjs) {
    inv.entries++;
    count(inv.ch, e.ch);
    (e.role || []).forEach(r => count(inv.role, r));
    (e.attr || []).forEach(a => count(inv.attr, a));
    if (e.from) count(inv.from, e.from);
    if (e.pool) count(inv.pool, e.pool);
    if (e.src) count(inv.src, e.src);
  }
  return inv;
}
const fmt = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('、');

// ── 5. 主流程 ───────────────────────────────────────────────────────
const original = fs.readFileSync(CHANNELS);
const text = original.toString('utf8');
const { eol, blocks } = splitBlocks(text);
if (eol !== '\r\n') die(`換行不是 CRLF（${S(eol)}），跟原檔格式約定不符`);

// 5a. 自檢：頂層切塊 + 逐 entry 解析→排版，零改動必須 byte 相同
const parsedBlocks = blocks.map(b => ({ key: b.key, p: parseBlock(b) }));
for (const { key, p } of parsedBlocks) {
  p.entries.forEach((e, i) => {
    const re = renderEntry(e.obj, i === p.entries.length - 1);
    if (re.join('\n') !== e.lines.join('\n'))
      die(`自檢失敗：${key} 第 ${i + 1} 筆 entry 解析再排版跟原文不同\n原文：\n${e.lines.join('\n')}\n重排：\n${re.join('\n')}`);
  });
}
const roundtrip = Buffer.from(joinBlocks(eol, parsedBlocks.map(({ key, p }) => ({ key, lines: renderBlock(p) }))), 'utf8');
if (!roundtrip.equals(original)) die('自檢失敗：零改動時重建出來的檔案跟原檔不是 byte 相同');
const before = inventory(parsedBlocks.flatMap(({ p }) => p.entries.map(e => e.obj)));
console.log(`切塊自檢 ✅　${blocks.length} 張卡／${before.entries} entry／${Object.keys(before.ch).length} 頻道，零改動可重建 byte 相同原檔`);

// 5b. 已正規化偵測（沒有 src、沒有格綁定:、沒有尚未打出、role 全骨幹）
const alreadyDone = parsedBlocks.every(({ p }) => p.entries.every(({ obj: e }) =>
  !('src' in e) && !e.ch.startsWith(BIND_PREFIX) && !UNPLAYED[e.ch] && (e.role || []).every(r => BACKBONE_SET.has(r))));
if (alreadyDone) { console.log('channels.json 已經是正規化後的形狀，不動檔案。'); process.exit(0); }

if (before.entries !== EXPECT_ENTRIES) die(`entry 數 ${before.entries} ≠ 期望 ${EXPECT_ENTRIES}`);
if (Object.keys(before.ch).length !== EXPECT_CH_BEFORE) die(`頻道數 ${Object.keys(before.ch).length} ≠ 期望 ${EXPECT_CH_BEFORE}`);

// 5c. 正規化
let expectedAttr = 0;
for (const { p } of parsedBlocks) for (const { obj: e } of p.entries) {
  expectedAttr += (e.role || []).filter(r => !BACKBONE_SET.has(r)).length;
  if (e.ch.startsWith(BIND_PREFIX)) expectedAttr++;
  if (UNPLAYED[e.ch]) expectedAttr++;
}
const newBlocks = parsedBlocks.map(({ key, p }) => {
  const entries = p.entries.map(e => ({ obj: normalize(key, e.obj) }));
  return { key, lines: renderBlock({ head: p.head, entries, tail: p.tail }) };
});
const out = joinBlocks(eol, newBlocks);

// 5d. 產出守門
let parsedOut;
try { parsedOut = JSON.parse(out); } catch (err) { die('產出不是合法 JSON：' + err.message); }
const oldJson = JSON.parse(text);
const afterObjs = [];
for (const id in oldJson) {
  const a = oldJson[id], b = parsedOut[id];
  if (!b) die(`產出少了卡 ${id}`);
  if (a.牌名 !== b.牌名) die(`${id} 牌名變了`);
  if (S(a.effects) !== S(b.effects)) die(`${id} effects 變了`);
  if (a.channels.length !== b.channels.length) die(`${id} entry 數變了`);
  if (S(Object.keys(a)) !== S(Object.keys(b))) die(`${id} 欄位順序變了`);
  afterObjs.push(...b.channels);
}
if (Object.keys(parsedOut).length !== Object.keys(oldJson).length) die('產出卡數不同');
if (S(Object.keys(parsedOut)) !== S(Object.keys(oldJson))) die('產出卡片順序不同');
const after = inventory(afterObjs);
if (after.entries !== EXPECT_ENTRIES) die(`產出 entry 數 ${after.entries} ≠ ${EXPECT_ENTRIES}`);
if (Object.keys(after.ch).length !== EXPECT_CH_AFTER) die(`產出頻道數 ${Object.keys(after.ch).length} ≠ 期望 ${EXPECT_CH_AFTER}：${fmt(after.ch)}`);
const badRole = Object.keys(after.role).filter(r => !BACKBONE_SET.has(r));
if (badRole.length) die(`產出 role 還有非骨幹：${badRole.join('、')}`);
if (Object.keys(after.src).length) die('產出還有 src 欄');
const attrTotal = Object.values(after.attr).reduce((s, n) => s + n, 0);
if (attrTotal !== expectedAttr) die(`attr 總數 ${attrTotal} ≠ 應搬入 ${expectedAttr}`);
const srcTotal = Object.values(before.src).reduce((s, n) => s + n, 0);
const fpTotal = Object.values(after.from).reduce((s, n) => s + n, 0) + Object.values(after.pool).reduce((s, n) => s + n, 0);
if (srcTotal !== fpTotal) die(`from＋pool ${fpTotal} ≠ 原 src ${srcTotal}`);
for (const e of afterObjs) if (!e.role.length && !(e.attr && e.attr.length)) die(`有 entry role 與 attr 都空：${S(e)}`);

console.log('');
console.log(`before　role ${Object.keys(before.role).length} 種：${fmt(before.role)}`);
console.log(`before　src ${Object.keys(before.src).length} 種：${fmt(before.src)}`);
console.log('');
console.log(`after 　role ${Object.keys(after.role).length} 種：${fmt(after.role)}`);
console.log(`after 　attr ${Object.keys(after.attr).length} 種（共 ${attrTotal}）：${fmt(after.attr)}`);
console.log(`after 　from ${Object.keys(after.from).length} 種：${fmt(after.from)}`);
console.log(`after 　pool ${Object.keys(after.pool).length} 種：${fmt(after.pool)}`);
console.log(`after 　頻道 ${Object.keys(after.ch).length}：${fmt(after.ch)}`);
console.log(`after 　entry ${after.entries}／卡 ${Object.keys(parsedOut).length}`);

if (DRY) { console.log('\n--dry：不寫檔'); process.exit(0); }

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const bak = path.join(VIEWER, `channels.backup_${stamp}_pre-normalize.json`);
fs.writeFileSync(bak, original);
fs.writeFileSync(CHANNELS, out, 'utf8');
console.log(`\n備份：${bak}\n✅ 已寫入 ${CHANNELS}`);
