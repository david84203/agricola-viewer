/* ══════════════════════════════════════════════════
   1111 頻道標記補角色第二批：房舍材質 122＋居住空間 39 個空 role 落地（非排除卡）
   輸入：Dropbox 600_Project/烏嘎嘎桌遊/agricola-viewer/role_fill_1111b/output.md（sonnet 判讀，主對話抽驗＋改判過）
   判法（Lu 1111 同意補）：房舍材質 看你住什麼房 → read，直接改材質／翻修成某材質 → get；
   居住空間 attr 提供 → get，免空 → read。
   做法：抄 apply_role_fill_1111.cjs 的純文字切塊＋全檔重畫自檢，不 parse→stringify 寫回。
   用法：node tools/apply_role_fill_1111b.cjs [--dry]
   ══════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const VIEWER = path.resolve(__dirname, '..');
const OUT_MD = 'D:/Dropbox/Lu_Agent/600_Project/烏嘎嘎桌遊/agricola-viewer/role_fill_1111b/output.md';
const CHANNELS = path.join(VIEWER, 'channels.json');
const DRY = process.argv.includes('--dry');
const EXPECT_ROWS = 161;
const die = (m) => { console.error('❌ 中止：' + m); process.exit(1); };
const S = (v) => JSON.stringify(v);
const ROLES = new Set(['read', 'get', 'pay', 'react', 'cause']);

// ── 主對話抽驗改判（id|頻道 → role） ─────────────────────────────
// 「一旦／當你翻修至X（若打出時已是X則立即生效）」＝看狀態門檻 → read，跟女僕、筒倉女孩一致；
// 野豬起始家寫明「已住磚屋不給」才是真的看變化 → 維持 react
const OVERRIDE = {
  'K298|房舍材質': 'read',    // 牧童
  '6091-2|房舍材質': 'read',  // 契約僕人
};
// Lu 1111 裁定：工會會長卡文跟房子材質無關，標記掛錯 → 刪
const DROP = new Set(['舊版E341|房舍材質']);

// ── 切塊工具（照抄 apply_gap346_channels.cjs） ───────────────────
function splitBlocks(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(eol);
  if (lines[0] !== '{') die('第一行不是 "{"');
  if (lines[lines.length - 1] !== '}') die('最後一行不是 "}"');
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
  blocks.forEach((b, idx) => { const body = b.lines.slice(); body[body.length - 1] = idx === blocks.length - 1 ? ' }' : ' },'; out.push(...body); });
  out.push('}');
  return out.join(eol);
}
function channelsRange(lines) {
  const ci = lines.findIndex((l) => l === '  "channels": [' || l === '  "channels": []' || l === '  "channels": [],');
  if (ci < 0) return null;
  if (lines[ci] !== '  "channels": [') return [ci, ci];
  let cj = ci + 1;
  while (cj < lines.length && lines[cj] !== '  ]' && lines[cj] !== '  ],') cj++;
  if (cj >= lines.length) return null;
  return [ci, cj];
}
function renderEntry(e, isLast) {
  const keys = Object.keys(e);
  const out = ['   {'];
  keys.forEach((k, idx) => {
    const comma = idx === keys.length - 1 ? '' : ',';
    const v = e[k];
    if (Array.isArray(v) && !v.length) out.push(`    ${S(k)}: []${comma}`);
    else if (Array.isArray(v)) { out.push(`    ${S(k)}: [`); v.forEach((x, i) => out.push(`     ${S(x)}${i === v.length - 1 ? '' : ','}`)); out.push(`    ]${comma}`); }
    else out.push(`    ${S(k)}: ${S(v)}${comma}`);
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

// ── 讀原檔＋自檢 ─────────────────────────────────────────────────
const original = fs.readFileSync(CHANNELS);
const text = original.toString('utf8');
const { eol, blocks } = splitBlocks(text);
if (!Buffer.from(joinBlocks(eol, blocks), 'utf8').equals(original)) die('自檢 1 失敗：零改動重建不是 byte 相同');
const oldJson = JSON.parse(text);
for (const b of blocks) {
  const r = channelsRange(b.lines) || die(`${b.key} 找不到 channels 區段`);
  if (S(b.lines.slice(r[0], r[1] + 1)) !== S(renderRegion(oldJson[b.key].channels, b.lines[r[1]] === '  ],'))) die(`自檢 2 失敗：${b.key} 重畫不同`);
}
console.log(`切塊自檢 ✅ ${blocks.length} 張卡`);

// ── 組計畫 ─────────────────────────────────────────────────────
const plan = {}; const stat = {};
const count = (k) => { stat[k] = (stat[k] || 0) + 1; };
const entriesOf = (id) => plan[id] || (oldJson[id] ? (plan[id] = oldJson[id].channels.map((e) => ({ ...e }))) : die(`channels.json 沒有 ${id}`));

const rows = fs.readFileSync(OUT_MD, 'utf8').split(/\r?\n/).filter((l) => /^\| \d+ \|/.test(l))
  .map((l) => l.split('|').slice(1, -1).map((s) => s.trim()));
if (rows.length !== EXPECT_ROWS) die(`output.md 應 ${EXPECT_ROWS} 列，讀到 ${rows.length}`);

for (const [no, id, name, ch, roleTxt] of rows) {
  if (oldJson[id]?.牌名 !== name) die(`#${no} ${id} 牌名對不上：${name}`);
  const es = entriesOf(id);
  const hits = es.filter((e) => e.ch === ch && !(e.role || []).length);
  if (hits.length !== 1) die(`#${no} ${id} ${name} ${ch}：空 role entry 有 ${hits.length} 個`);
  if (DROP.has(`${id}|${ch}`)) { es.splice(es.indexOf(hits[0]), 1); count(`${ch} 刪（掛錯）`); continue; }
  const txt = OVERRIDE[`${id}|${ch}`] || roleTxt;
  if (txt === '?') die(`#${no} ${id} ${ch} 是 ? 但沒有改判`);
  const role = txt.split('/');
  if (!role.every((r) => ROLES.has(r))) die(`#${no} ${id} role 不合法：${txt}`);
  hits[0].role = role; count(`${ch}·${txt}`);
}
const unused = Object.keys(OVERRIDE).filter((k) => !rows.some(([, id, , ch]) => `${id}|${ch}` === k));
if (unused.length) die(`OVERRIDE 沒對到列：${unused.join(",")}`);

// ── 寫回＋驗 ───────────────────────────────────────────────────
const touched = Object.keys(plan).filter((id) => S(plan[id]) !== S(oldJson[id].channels));
for (const b of blocks) {
  if (!touched.includes(b.key)) continue;
  const r = channelsRange(b.lines);
  b.lines.splice(r[0], r[1] - r[0] + 1, ...renderRegion(plan[b.key], b.lines[r[1]] === '  ],'));
}
const out = joinBlocks(eol, blocks);
let parsedOut;
try { parsedOut = JSON.parse(out); } catch (err) { die('產出不是合法 JSON：' + err.message); }
if (S(Object.keys(parsedOut)) !== S(Object.keys(oldJson))) die('卡片順序／張數變了');
for (const id in oldJson) {
  if (oldJson[id].牌名 !== parsedOut[id].牌名) die(`${id} 牌名變了`);
  const want = touched.includes(id) ? plan[id] : oldJson[id].channels;
  if (S(want) !== S(parsedOut[id].channels)) die(`${id} 寫回結果不對`);
}
const empty = rows.filter(([, id, , ch]) => parsedOut[id].channels.some((e) => e.ch === ch && !(e.role || []).length));
if (empty.length) die(`仍有空 role：${empty.map((r) => r[1] + r[3]).join(',')}`);

console.log(`動到 ${touched.length} 張卡`);
for (const k of Object.keys(stat).sort()) console.log(`  ${k}: ${stat[k]}`);
if (DRY) { console.log('（--dry，不寫檔）'); process.exit(0); }
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
fs.writeFileSync(path.join(VIEWER, `channels.backup_${stamp}_pre-rolefill1111b.json`), original);
fs.writeFileSync(CHANNELS, out, 'utf8');
console.log('✅ 已寫回 channels.json');
