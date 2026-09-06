/* ══════════════════════════════════════════════════
   卡片類型系統 工序 3（第三輪）：把規格第十一節的裁定寫進 channels.json

   規格：Dropbox 600_Project/烏嘎嘎桌遊/agricola-viewer/農家樂_卡片類型系統_規格_20260905.md 第十一節
   輸入（兩份 sonnet 判定檔，第四節「機器讀取」的 js 陣列）：
     農家樂_卡片類型_加強行動重篩_20260906.md   → TRIGGERED（觸發式）：加強行動 entry 拿掉、改標 額外行動·cause（Q7）
     農家樂_卡片類型_房間家庭方向_20260906.md   → DIRECTION：房間數／家庭人數·read 補 attr 多／少／無方向（Q13）；判不出不動
   寫死：Q4 六張頻道漏標補 entry、Q5 頂樓 WM060 木頭·get(供應) 改 木頭·pay（個人供應區消耗）

   做法：純文字切塊（沿用 apply_family_channels.cjs），只重寫「有動到的卡」的 channels 區段；
   先用同一個 render 把全檔 3359 張的 channels 區段重畫一次比對原文，不是 byte 相同就中止（格式守門）。

   用法：node tools/apply_round3_channels.cjs [--dry]
   ══════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const VIEWER = path.resolve(__dirname, '..');
const DROPBOX = 'D:/Dropbox/Lu_Agent/600_Project/烏嘎嘎桌遊/agricola-viewer';
const MD_A = path.join(DROPBOX, '農家樂_卡片類型_加強行動重篩_20260906.md');
const MD_B = path.join(DROPBOX, '農家樂_卡片類型_房間家庭方向_20260906.md');
const CHANNELS = path.join(VIEWER, 'channels.json');
const EXCL = path.join(VIEWER, '..', 'agricola-online', 'exclusions_audit.json');
const DRY = process.argv.includes('--dry');
const die = (m) => { console.error('❌ 中止：' + m); process.exit(1); };
const S = (v) => JSON.stringify(v);

// ── 判定檔第四節：抓 ```js 圍欄裡指定變數 ─────────────────────────
const warnedMissing = new Set();
function readJsVar(file, name) {
  if (!fs.existsSync(file)) { if (!warnedMissing.has(file)) console.log(`⚠ 找不到 ${path.basename(file)}，這部分跳過`); warnedMissing.add(file); return null; }
  const md = fs.readFileSync(file, 'utf8');
  const blocks = [...md.matchAll(/```js\s*([\s\S]*?)```/g)].map((m) => m[1]);
  for (const b of blocks) {
    if (!new RegExp(`(^|\\s)(const|let|var)?\\s*${name}\\s*=`).test(b) && !b.includes(name)) continue;
    try {
      const val = new Function(`${b.replace(/^\s*(const|let|var)\s+/gm, 'var ')}\n; return typeof ${name} !== 'undefined' ? ${name} : undefined;`)();
      if (val !== undefined) return val;
    } catch (e) { /* 試下一個 */ }
  }
  die(`${path.basename(file)} 第四節找不到 ${name}`);
}

// ── 計畫 ───────────────────────────────────────────────────────
const TRIGGERED = readJsVar(MD_A, 'TRIGGERED');
const KEEP = readJsVar(MD_A, 'KEEP');
const UNSURE = readJsVar(MD_A, 'UNSURE');
const DIRECTION = readJsVar(MD_B, 'DIRECTION');

const Q4_ADD = { // 預審檔 A 節查到的頻道漏標（Q4）；照同型卡既有標法
  '4799-2': [{ ch: '犁田', role: ['cause'], on: '行動' }],                                       // 未來計畫：獎勵含 1 塊農田
  '11003-3': [{ ch: '蔬菜', role: ['get'], from: '供應' }],                                      // 農民的聚餐：或 1 份蔬菜
  'E137': [{ ch: '蘆葦', role: ['get'], from: '供應' }],                                         // 亞麻農夫：額外 1 綑蘆葦
  'D042*': [{ ch: '蔬菜', role: ['get'], from: '供應' }, { ch: '犁田', role: ['cause'], on: '行動' }], // 獎學金：蔬菜／田
  '6327-3': [{ ch: '圈柵欄', role: ['react'], on: '行動' }, { ch: '打發展', role: ['react'], on: '行動' }], // 遲到的建築工人：建柵欄／購主發
  '4253-2': [{ ch: '食物', role: ['get'], from: '場格' }],                                       // 備用柵欄柱：比照森林旅社 B042
};
const Q5_REPLACE = { // 頂樓：木頭是從個人供應區拿去放新房間＝消耗，不是取得
  'WM060': { match: (e) => e.ch === '木頭' && (e.role || []).includes('get'), to: { ch: '木頭', role: ['pay'] } },
};

// ── channels.json 切塊 ─────────────────────────────────────────
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
// channels 區段：從 `  "channels": [` 到 `  ]`／`  ],`（含）
function channelsRange(lines) {
  const ci = lines.findIndex((l) => l === '  "channels": [' || l === '  "channels": []' || l === '  "channels": [],');
  if (ci < 0) return null;
  if (lines[ci] !== '  "channels": [') return [ci, ci]; // 空 channels 單行（施肥專家那 2 張）
  let cj = ci + 1;
  while (cj < lines.length && lines[cj] !== '  ]' && lines[cj] !== '  ],') cj++;
  if (cj >= lines.length) return null;
  return [ci, cj];
}
// 一筆 entry 依 key 順序畫回原格式（ch／on／from／pool 是字串、role／attr 是多行陣列）
function renderEntry(e, isLast) {
  const keys = Object.keys(e);
  const out = ['   {'];
  keys.forEach((k, idx) => {
    const comma = idx === keys.length - 1 ? '' : ',';
    const v = e[k];
    if (Array.isArray(v) && !v.length) out.push(`    ${S(k)}: []${comma}`); // 原檔空陣列寫成一行
    else if (Array.isArray(v)) {
      out.push(`    ${S(k)}: [`);
      v.forEach((x, i) => out.push(`     ${S(x)}${i === v.length - 1 ? '' : ','}`));
      out.push(`    ]${comma}`);
    } else out.push(`    ${S(k)}: ${S(v)}${comma}`);
  });
  out.push(isLast ? '   }' : '   },');
  return out;
}
function renderRegion(entries, trailingComma) {
  if (!entries.length) return [trailingComma ? '  "channels": [],' : '  "channels": []'];
  const out = ['  "channels": ['];
  entries.forEach((e, i) => out.push(...renderEntry(e, i === entries.length - 1)));
  out.push(trailingComma ? '  ],' : '  ]');
  return out;
}

const original = fs.readFileSync(CHANNELS);
const text = original.toString('utf8');
const { eol, blocks } = splitBlocks(text);
if (eol !== '\r\n') die('換行不是 CRLF，跟原檔約定不符');
if (!Buffer.from(joinBlocks(eol, blocks), 'utf8').equals(original)) die('自檢 1 失敗：零改動重建不是 byte 相同');
const oldJson = JSON.parse(text);
const byKey = {}; blocks.forEach((b) => { byKey[b.key] = b; });
const origBlockKeys = blocks.map((b) => b.key); // 順序要拿文字層比，物件 key 會把整數樣式的 ID 重排

// 自檢 2：全檔每張卡的 channels 區段用 renderRegion 重畫，必須跟原文逐行相同（保證 render 格式忠實）
let badFmt = 0;
for (const b of blocks) {
  const r = channelsRange(b.lines);
  if (!r) die(`${b.key} 找不到 channels 區段`);
  const orig = b.lines.slice(r[0], r[1] + 1);
  const re = renderRegion(oldJson[b.key].channels, b.lines[r[1]] === '  ],');
  if (S(orig) !== S(re)) { badFmt++; if (badFmt <= 3) console.log(`格式不合：${b.key}\n  原 ${S(orig).slice(0, 200)}\n  畫 ${S(re).slice(0, 200)}`); }
}
if (badFmt) die(`自檢 2 失敗：${badFmt} 張卡的 channels 區段重畫後跟原文不同`);
console.log(`切塊自檢 ✅　${blocks.length} 張卡，零改動 byte 相同；channels 區段重畫全檔一致`);

// ── 套裁定到 parsed entries ────────────────────────────────────
const excluded = (fs.existsSync(EXCL) ? JSON.parse(fs.readFileSync(EXCL, 'utf8')).excluded : null) || die('找不到排除卡名單');
const plan = {}; // id → 新 entries 陣列
const stat = {}; const count = (k, n = 1) => { stat[k] = (stat[k] || 0) + n; };
const entriesOf = (id) => { if (!plan[id]) { if (!oldJson[id]) die(`channels.json 沒有這張卡：${id}`); plan[id] = oldJson[id].channels.map((e) => ({ ...e })); } return plan[id]; };
const sameEntry = (a, b) => a.ch === b.ch && S(a.role || []) === S(b.role || []);
const warn = [];

if (TRIGGERED) {
  const all = [...TRIGGERED, ...KEEP, ...UNSURE];
  if (new Set(all).size !== all.length) die('重篩檔三個陣列有重複 ID');
  for (const id of TRIGGERED) {
    const list = entriesOf(id);
    const i = list.findIndex((e) => e.ch === '加強行動');
    if (i < 0) die(`${id} 沒有 加強行動 entry，重篩檔對不上`);
    list.splice(i, 1); count('加強行動 拿掉');
    if (!list.some((e) => e.ch === '額外行動' && (e.role || []).includes('cause'))) { list.push({ ch: '額外行動', role: ['cause'] }); count('額外行動 加'); } else count('額外行動 已有跳過');
  }
  console.log(`重篩：觸發式 ${TRIGGERED.length}／自己的格 ${KEEP.length}／判不出 ${UNSURE.length}（判不出不動，等 Lu）`);
}
if (DIRECTION) {
  let n = 0, skip = [];
  for (const id in DIRECTION) for (const ch in DIRECTION[id]) {
    const v = DIRECTION[id][ch];
    if (!['多', '少', '無方向', '判不出'].includes(v)) die(`${id} ${ch} 方向值不合法：${v}`);
    if (v === '判不出') { skip.push(`${id} ${ch}`); continue; }
    const list = entriesOf(id);
    const e = list.find((x) => x.ch === ch && (x.role || []).includes('read'));
    if (!e) die(`${id} 沒有 ${ch}·read entry，方向檔對不上`);
    if ((e.attr || []).some((a) => ['多', '少', '無方向'].includes(a))) { count('方向 已有跳過'); continue; }
    // attr 放在 role 之後、on/from/pool 之前（照全檔既有 key 順序）
    const rebuilt = {}; for (const k of Object.keys(e)) { rebuilt[k] = e[k]; if (k === 'role' && !e.attr) rebuilt.attr = [v]; }
    if (e.attr) rebuilt.attr = [...e.attr, v];
    Object.keys(e).forEach((k) => delete e[k]); Object.assign(e, rebuilt);
    n++; count(`方向 ${v}`);
  }
  console.log(`方向：補 ${n} 筆；判不出 ${skip.length} 筆不動${skip.length ? '：' + skip.join('、') : ''}`);
}
for (const id in Q4_ADD) for (const e of Q4_ADD[id]) {
  const list = entriesOf(id);
  if (list.some((x) => sameEntry(x, e))) { warn.push(`${id} 已有 ${S(e)}，跳過`); continue; }
  list.push(e); count('Q4 補 entry');
}
for (const id in Q5_REPLACE) {
  const list = entriesOf(id);
  const i = list.findIndex(Q5_REPLACE[id].match);
  if (i < 0) { warn.push(`${id} 找不到要換的 entry，跳過`); continue; }
  list[i] = Q5_REPLACE[id].to; count('Q5 換 entry');
}

// ── 守門：動到的卡不可是排除卡 ────────────────────────────────────
const touched = Object.keys(plan).filter((id) => S(plan[id]) !== S(oldJson[id].channels));
const bad = touched.filter((id) => excluded[id] || excluded[id.replaceAll('*', '')]);
if (bad.length) die(`混到排除卡：${bad.join('、')}`);

// ── 寫回文字層 ───────────────────────────────────────────────────
for (const id of touched) {
  const b = byKey[id];
  const r = channelsRange(b.lines);
  b.lines.splice(r[0], r[1] - r[0] + 1, ...renderRegion(plan[id], b.lines[r[1]] === '  ],'));
}
const out = joinBlocks(eol, blocks);
let parsedOut;
try { parsedOut = JSON.parse(out); } catch (err) { die('產出不是合法 JSON：' + err.message); }
if (S(blocks.map((b) => b.key)) !== S(origBlockKeys)) die('卡片順序變了');
const touchedSet = new Set(touched);
for (const id in oldJson) {
  if (!parsedOut[id]) die(`產出少了 ${id}`);
  if (oldJson[id].牌名 !== parsedOut[id].牌名) die(`${id} 牌名變了`);
  if (S(oldJson[id].effects) !== S(parsedOut[id].effects)) die(`${id} effects 變了`);
  if (!touchedSet.has(id) && S(oldJson[id].channels) !== S(parsedOut[id].channels)) die(`沒計畫動的卡被動到：${id}`);
  if (touchedSet.has(id) && S(plan[id]) !== S(parsedOut[id].channels)) die(`${id} 寫回結果跟計畫不同`);
}
const oldN = Object.values(oldJson).reduce((s, c) => s + c.channels.length, 0);
const newN = Object.values(parsedOut).reduce((s, c) => s + c.channels.length, 0);
console.log(`計畫：${Object.entries(stat).map(([k, v]) => `${k} ${v}`).join('／')}`);
console.log(`動到 ${touched.length} 張卡；entry ${oldN} → ${newN}（${newN - oldN >= 0 ? '+' : ''}${newN - oldN}）`);
if (warn.length) console.log(`⚠ 跳過：\n  ${warn.join('\n  ')}`);
if (DRY) { console.log('--dry：不寫檔'); process.exit(0); }
if (!touched.length) { console.log('沒有要動的卡，不寫檔。'); process.exit(0); }
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const bak = path.join(VIEWER, `channels.backup_${stamp}_pre-round3.json`);
fs.writeFileSync(bak, original);
fs.writeFileSync(CHANNELS, out, 'utf8');
console.log(`備份：${bak}\n✅ 已寫入 ${CHANNELS}`);
