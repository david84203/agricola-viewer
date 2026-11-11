/* ══════════════════════════════════════════════════
   1111 頻道標記補角色：圈地／馬廄／分數／負分／乞討／餵養 255 個空 role 落地＋11/2 的 13 筆不一致（改 9）
   ＋「動物飼養空間」改名「飼養空間」，卡片自帶容量的 圈地 entry 移過去（Lu 1111 裁定）

   輸入：Dropbox 600_Project/烏嘎嘎桌遊/agricola-viewer/role_fill_1111/output.md（sonnet 判讀，主對話抽驗＋改判過）
   Lu 1111 裁定：
     ① 13 筆照建議（改 9、維持 4）
     ② 分數頻道「?」（不列入計分／視為已使用之類，會改計分但本身不給分）→ read；外飛地 → get（馬廄算圈地內馬廄得分）
     ③ 卡片能養動物 → 不是圈地，歸「飼養空間」（圈地、馬廄、卡片、農田住動物、馴養員都算提供飼養空間）
        「動物仍計入計分」不算分數（動物本來就計分），除非像標本剝製師那樣改了怎麼算 → 托兒所／畜欄／動物研究員 刪 分數 entry；
        大公羊／綿羊信差／波坦金農場 會多算分 → get
   做法：抄 apply_gap346_channels.cjs 的純文字切塊＋全檔重畫自檢，不 parse→stringify 寫回。
   用法：node tools/apply_role_fill_1111.cjs [--dry]
   ══════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const VIEWER = path.resolve(__dirname, '..');
const OUT_MD = 'D:/Dropbox/Lu_Agent/600_Project/烏嘎嘎桌遊/agricola-viewer/role_fill_1111/output.md';
const CHANNELS = path.join(VIEWER, 'channels.json');
const DRY = process.argv.includes('--dry');
const die = (m) => { console.error('❌ 中止：' + m); process.exit(1); };
const S = (v) => JSON.stringify(v);
const OLD_HOUSE = '動物飼養空間', HOUSE = '飼養空間';
const ROLES = new Set(['read', 'get', 'pay', 'react', 'cause']);

// ── Lu 1111 裁定（寫死） ─────────────────────────────────────────
const SCORE_Q_GET = new Set(['11670-4']);                                  // 外飛地
const SCORE_GET = new Set(['WM102', '8368-4', '10609-2']);                 // 大公羊、綿羊信差、波坦金農場
const SCORE_DROP = new Set(['WM057', '4443-7', '10710-7']);                // 動物托兒所、畜欄、動物研究員
const Q_READ = new Set(['12159-2']);                                       // 草原牧人 圈地「?」→ read
// 讓既有馬廄／圈地多養動物的卡：馬廄／圈地 entry 是 read（看你有幾個），但本身也提供飼養空間 → 補 飼養空間（Lu ③ 的定義）
const HOUSE_ADD = { 8498: '豬圈', B115: '鐵匠大師', D011: '草坪肥料', E012: '動物寢具', 'A012*': '飲水槽', 'C089*': '馬廄工頭', '11670-4': '外飛地' };
const FIX13 = [ // [id, ch, role(null=不動), attr]
  ['A038*', '房舍材質', null, ['木', '磚']],
  ['舊版E173', '房舍材質', null, ['石', '磚']],
  ['E154', '房舍材質', null, ['石']],
  ['B098*', '圈地', ['read'], ['數量', '容量']],
  ['C136', '圈地', ['read'], ['容量']],
  ['10815-6', '馬廄', ['read'], ['無法居住', '特殊']],
  ['9806', '圈地', ['read'], ['空']],
  ['12218', '圈地', ['read'], ['大小', '數量']],
  ['8819-12', '圈地', ['read'], ['數量']],
];

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
if (rows.length !== 255) die(`output.md 應 255 列，讀到 ${rows.length}`);

for (const [no, id, name, ch, roleTxt] of rows) {
  const es = entriesOf(id);
  const hits = es.filter((e) => e.ch === ch && !(e.role || []).length);
  if (hits.length !== 1) die(`#${no} ${id} ${name} ${ch}：空 role entry 有 ${hits.length} 個`);
  const e = hits[0];
  if (ch === '分數' && SCORE_DROP.has(id)) { es.splice(es.indexOf(e), 1); count('分數 刪（動物照常計分）'); continue; }
  if (ch === '圈地' && roleTxt === 'get') { // 卡片自帶容量 → 飼養空間
    es.splice(es.indexOf(e), 1); count('圈地 移飼養空間');
    if (!es.some((x) => x.ch === OLD_HOUSE || x.ch === HOUSE)) { es.push({ ch: HOUSE, role: ['read'] }); count('飼養空間 新增'); }
    continue;
  }
  let role;
  if (ch === '分數' && SCORE_GET.has(id)) role = ['get'];
  else if (roleTxt === '?') {
    if (ch === '分數') role = SCORE_Q_GET.has(id) ? ['get'] : ['read'];
    else if (Q_READ.has(id)) role = ['read'];
    else die(`#${no} ${id} ${ch} 是 ? 但沒有裁定`);
  } else role = roleTxt.split('/');
  if (!role.every((r) => ROLES.has(r))) die(`#${no} ${id} role 不合法：${roleTxt}`);
  e.role = role; count(`${ch}·${role.join('/')}`);
}
for (const [id, ch, role, attr] of FIX13) {
  const hits = entriesOf(id).filter((e) => e.ch === ch);
  if (hits.length !== 1) die(`13 筆 ${id} ${ch}：找到 ${hits.length} 個`);
  if (role) hits[0].role = role;
  hits[0].attr = attr; count('13 筆改');
}
for (const [id, name] of Object.entries(HOUSE_ADD)) {
  if (oldJson[id]?.牌名 !== name) die(`HOUSE_ADD ${id} 牌名不是 ${name}`);
  const es = entriesOf(id);
  if (!es.some((x) => x.ch === OLD_HOUSE || x.ch === HOUSE)) { es.push({ ch: HOUSE, role: ['read'] }); count('飼養空間 新增（加容量卡）'); }
}
// 改名：動物飼養空間 → 飼養空間（所有卡）
for (const id in oldJson) {
  if (oldJson[id].channels.some((e) => e.ch === OLD_HOUSE)) entriesOf(id).forEach((e) => { if (e.ch === OLD_HOUSE) { e.ch = HOUSE; count('改名'); } });
}

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
const empty = rows.filter(([, id, , ch]) => (parsedOut[id].channels.find((e) => e.ch === ch) || { role: ['x'] }).role.length === 0);
if (empty.length) die(`仍有空 role：${empty.map((r) => r[1] + r[3]).join(',')}`);
if (Object.values(parsedOut).some((c) => c.channels.some((e) => e.ch === OLD_HOUSE))) die('還有舊名 動物飼養空間');

console.log(`動到 ${touched.length} 張卡`);
for (const k of Object.keys(stat).sort()) console.log(`  ${k}: ${stat[k]}`);
if (DRY) { console.log('（--dry，不寫檔）'); process.exit(0); }
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
fs.writeFileSync(path.join(VIEWER, `channels.backup_${stamp}_pre-rolefill1111.json`), original);
fs.writeFileSync(CHANNELS, out, 'utf8');
console.log('✅ 已寫回 channels.json');
