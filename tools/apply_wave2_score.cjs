/* ══════════════════════════════════════════════════
   分數頻道 wave2（結算型 339 張）＋「—」85 張收尾：把 1102 預審＋Lu 裁定落地到 channels.json

   輸入（Dropbox 600_Project/烏嘎嘎桌遊/agricola-viewer/wave2_work/1102/）：
     w2_out_0.md      第 1 組 28 張（Lu 0905 裁定＋修正 A 已翻成新格式）
     w2_out_1～3.md   sonnet 預審 311 張：| id | 牌名 | 結論 | 分數型 | 依據 | 理由 |（分數型／依據欄＝定稿值）
     dash_out.md      「—」85 張：| id | 牌名 | 判 | 補的 entry | 推成類型 | 理由 |（A 無直接效果／B 補 entry／C 判不出）
   裁定：農家樂_分數頻道wave2_與「—」收尾_待裁定_20261102.md（Lu 11/02 三題＋存疑預設）

   翻譯規則（0905 正規化後格式；key 順序 ch, role, attr, on, from, pool）：
     分數型 get        → {ch:分數, role:[get], pool:紅利分數}（勝利點數 pool 照 wave2_work/gen.cjs 判法）
     分數型 改計分     → {ch:分數, role:[], attr:[改計分], pool:基本計分}
     ※ 不帶 on:"結算"：既有 289 筆 分數 entry 沒有一筆帶 on，頻道圖會拿 on 當口味把 wave2 拆成另一組
     依據 X·read[...]   → {ch:X, role:[read], attr?:[...]}；房間數／家庭人數 一定帶方向
     房舍材質          → attr-only 狀態 entry（既有 120 筆都這樣）
     分數·read[池]      → {ch:分數, role:[read], pool:池}
     ?缺口              → 不落頻道（只進計畫檔）
     同頻道已有 read 或 attr-only entry → 跳過（attr 不同列警告，不改既有）

   用法：node tools/apply_wave2_score.cjs [--dry] [--plan <md路徑>]
   ══════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const VIEWER = path.resolve(__dirname, '..');
const W2 = 'D:/Dropbox/Lu_Agent/600_Project/烏嘎嘎桌遊/agricola-viewer/wave2_work/1102';
const CHANNELS = path.join(VIEWER, 'channels.json');
const CARDS = path.join(VIEWER, 'cards.json');
const EXCL = path.join(VIEWER, '..', 'agricola-online', 'exclusions_audit.json');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const PLAN_MD = argv.includes('--plan') ? argv[argv.indexOf('--plan') + 1] : null;
const die = (m) => { console.error('❌ 中止：' + m); process.exit(1); };
const S = (v) => JSON.stringify(v);

// ── Lu 11/02 裁定與存疑預設 ─────────────────────────────────────
// 裁定①：跟別人比較的一律無方向（含最多／最少）；只跟自己比的單人計數（男管家房>人、恰好 3 人…）保留多／少
// 既有 entry（0906 方向判讀）若是跟別人比，也一併改（只改 attr，不刪 entry）
const DIR_FIX = {
  'B136*': { 房間數: '無方向', why: '管家：有最多房間的玩家' },
  G028: { 家庭人數: '無方向', why: '易怒者：最少家庭成員的玩家' },
  '6596-8': { 家庭人數: '無方向', why: '賭場經理：剩餘配件最少的玩家' },
  9806: { 房間數: '無方向', why: '空洞騎士：空房＋空田＋空圈地最多的玩家' },
  D157: { 家庭人數: '無方向', why: '派對發起人：唯一擁有 5 位家庭成員' },
  NL087: { 家庭人數: '無方向', why: '遠方公主：最後 1 位增加第 5 位家庭成員的玩家' },
};
// 存疑預設（待裁定檔「其餘存疑」表）
const KIND_FIX = { '8767-4': 'get' }; // 混合礦晶粉：羊或牛分數再算一次＝額外 get，不是改計分
const BASIS_FIX = { '6327-3': [] }; // 遲到的建築工人：只留缺口，不掛頻道
// 裁定②：「省食物」＝食物引擎，dash 判 A 的餵養減輕／少付／略過餵養卡統一補 食物·get
const FEED_SAVE = {
  Cz22: '聖經：收成時少付食物', '舊版E181': '廚師：其餘家人只付 1 食物', E159: '吝嗇老頭：每位家人少付 1 食物',
  FL041: '炸物廚師：2 位成人少付 1 食物（其餘多付）', WM085: '水果蛋糕：下次收成每人少 1 食物', NL116: '馬鈴薯食用者：蔬菜換的食物每人只付 1',
  I244: '無業遊民：略過下個收成（含餵養）', FL027: '特拉普斯特啤酒：付 1 麥略過收割餵養繁殖', '742-6': '偷懶農夫：13 格空地時跳過餵養',
  '9293-3': '圍棋棋手：沒用回合格就跳過收成三步驟',
};
// dash 存疑預設：B 改無直接效果
const DASH_TO_NONE = { Cz16: '馬車堡：放柵欄是計分技巧，不歸動物養殖（存疑預設）' };

// ── 字彙：既有 channels.json 實測的形狀＋wave2 新開 ──────────────
const RES = new Set(['食物', '木頭', '磚頭', '石頭', '蘆葦', '建築資源', '麥子', '蔬菜', '作物', '羊', '野豬', '牛', '動物', '貨物']);
const READ_OK = new Set([...RES, '房間數', '家庭人數', '職業數', '發展數', '手牌', '已播種田', '空田', '乞討', '負分', '分數', '圈地', '馬廄', '餵養', '農田', '未使用區域', '柵欄']);
const NEW_CH = new Set(['農田', '未使用區域', '柵欄']); // Lu 9/4 裁定①
const STATE_ATTR = { 房舍材質: ['木', '石', '磚'], 圈地: ['數量', '空', '大小', '容量'], 馬廄: ['不限', '容量大', '圈內', '圈外', '特殊', '有動物', '空', '無法居住'] };
const DIRS = ['多', '少', '無方向'];
const POOLS = ['紅利分數', '勝利點數', '基本計分'];
const order = (e) => { const o = {}; for (const k of ['ch', 'role', 'attr', 'on', 'from', 'pool']) if (k in e) o[k] = e[k]; return o; };

function basisEntry(id, tok) {
  const m = tok.match(/^([^·\[]+)·read(?:\[([^\]]+)\])?$/);
  if (!m) die(`${id} 依據看不懂：${S(tok)}`);
  const ch = m[1]; const attr = m[2] ? m[2].split(',').map((s) => s.trim()) : [];
  if (!READ_OK.has(ch) && ch !== '房舍材質') die(`${id} 依據頻道不在字彙：${ch}`);
  if (ch === '房舍材質') {
    if (!attr.length || attr.some((a) => !STATE_ATTR.房舍材質.includes(a))) die(`${id} 房舍材質 attr 不對：${tok}`);
    const want = ['木', '石', '磚'].filter((a) => attr.includes(a)); // 既有檔慣例順序
    return { ch, role: [], attr: want.length === 1 ? want : sortLikeExisting(want) };
  }
  if (ch === '分數') { if (attr.length !== 1 || !POOLS.includes(attr[0])) die(`${id} 分數·read 要指定池：${tok}`); return { ch, role: ['read'], pool: attr[0] }; }
  if (['房間數', '家庭人數'].includes(ch)) {
    let d = attr[0];
    if (DIR_FIX[id] && DIR_FIX[id][ch]) d = DIR_FIX[id][ch];
    if (attr.length !== 1 || !DIRS.includes(d)) die(`${id} ${ch} 要恰好一個方向：${tok}`);
    return { ch, role: ['read'], attr: [d] };
  }
  if (STATE_ATTR[ch]) {
    for (const a of attr) if (!STATE_ATTR[ch].includes(a)) die(`${id} ${ch} attr 不認得 ${a}`);
    return attr.length ? { ch, role: ['read'], attr } : { ch, role: ['read'] };
  }
  if (attr.length) die(`${id} ${ch}·read 不該帶 attr：${tok}`);
  return { ch, role: ['read'] };
}
// 房舍材質多材質的既有寫法：石+磚 寫 ["石","磚"]、木+磚 寫 ["木","磚"]、三種寫 ["木","石","磚"]
function sortLikeExisting(a) { const k = a.join(''); return { 石磚: ['石', '磚'], 木磚: ['木', '磚'], 木石磚: ['木', '石', '磚'], 木石: ['木', '石'] }[k] || a; }

// dash B「補的 entry」欄
function dashEntry(id, tok) {
  const t = tok.trim();
  let m;
  if ((m = t.match(/^(\S+)·get(?:<(\S+))?$/)) && RES.has(m[1])) return { ch: m[1], role: ['get'], from: m[2] || '供應' };
  if ((m = t.match(/^(犁田|播種|擴建房舍|打發展|打職業|圈柵欄|翻修房舍)·cause(?:@(行動|行動格))?$/))) return { ch: m[1], role: ['cause'], on: m[2] || '行動' };
  if ((m = t.match(/^(額外行動|不卡格)·cause$/))) return { ch: m[1], role: ['cause'] };
  if (t === '減免資源·cause') return { ch: '減免資源', role: ['cause'] };
  if (t === '減免資源·cause+[替代]') return { ch: '減免資源', role: ['cause'], attr: ['替代'] };
  if ((m = t.match(/^圈地·((?:\[[^\]]+\]\+?)+)$/))) return { ch: '圈地', role: [], attr: [...m[1].matchAll(/\[([^\]]+)\]/g)].map((x) => x[1]) };
  die(`${id} dash entry 看不懂：${S(tok)}`);
}

// ── 讀表 ───────────────────────────────────────────────────────
function readTable(file, cols) {
  const rows = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.startsWith('| ')) continue;
    const cells = line.slice(1, line.trimEnd().length - 1).split('|').map((s) => s.trim());
    if (cells[0] === 'id' || /^-+$/.test(cells[0])) continue;
    if (cells.length !== cols) die(`${path.basename(file)} 欄數不對：${line}`);
    rows.push(cells);
  }
  return rows;
}
const W = [0, 1, 2, 3].flatMap((i) => readTable(path.join(W2, `w2_out_${i}.md`), 6));
if (W.length !== 339 || new Set(W.map((r) => r[0])).size !== 339) die(`wave2 應 339 張不重複，讀到 ${W.length}`);
const DASH = readTable(path.join(W2, 'dash_out.md'), 6);
if (DASH.length !== 85) die(`dash 應 85 張，讀到 ${DASH.length}`);
for (const id of [...Object.keys(DIR_FIX), ...Object.keys(KIND_FIX), ...Object.keys(BASIS_FIX)]) if (!W.find((r) => r[0] === id)) die(`裁定表的 ${id} 不在 wave2 名單`);
for (const id of [...Object.keys(FEED_SAVE), ...Object.keys(DASH_TO_NONE)]) if (!DASH.find((r) => r[0] === id)) die(`裁定表的 ${id} 不在 dash 名單`);
for (const id of Object.keys(FEED_SAVE)) if (DASH.find((r) => r[0] === id)[2] !== 'A') die(`${id} 原判不是 A`);

// ── channels.json 切塊（同 apply_gap346_channels.cjs） ─────────────
function splitBlocks(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(eol);
  if (lines[0] !== '{') die('第一行不是 "{"');
  if (lines[lines.length - 1] !== '}') die('最後一行不是 "}"（檔尾不可有換行）');
  const blocks = []; let i = 1;
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
  return cj >= lines.length ? null : [ci, cj];
}
function renderEntry(e, isLast) {
  const keys = Object.keys(e); const out = ['   {'];
  keys.forEach((k, idx) => {
    const comma = idx === keys.length - 1 ? '' : ','; const v = e[k];
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
const newBlock = (id, name, entries) => ({ key: id, lines: [` ${S(id)}: {`, `  "牌名": ${S(name)},`, ...renderRegion(entries, false), ' },'] });

const original = fs.readFileSync(CHANNELS);
const text = original.toString('utf8');
const { eol, blocks } = splitBlocks(text);
if (eol !== '\r\n') die('換行不是 CRLF');
if (!Buffer.from(joinBlocks(eol, blocks), 'utf8').equals(original)) die('自檢 1 失敗：零改動重建不是 byte 相同');
const oldJson = JSON.parse(text);
const byKey = Object.fromEntries(blocks.map((b) => [b.key, b]));
const origBlockKeys = blocks.map((b) => b.key);
let badFmt = 0;
for (const b of blocks) {
  const r = channelsRange(b.lines) || die(`${b.key} 找不到 channels 區段`);
  if (S(b.lines.slice(r[0], r[1] + 1)) !== S(renderRegion(oldJson[b.key].channels, b.lines[r[1]] === '  ],'))) badFmt++;
}
if (badFmt) die(`自檢 2 失敗：${badFmt} 張卡 channels 區段重畫後跟原文不同`);
console.log(`切塊自檢 ✅　${blocks.length} 張卡，零改動 byte 相同；channels 區段重畫全檔一致`);

// ── 組計畫 ─────────────────────────────────────────────────────
const cards = JSON.parse(fs.readFileSync(CARDS, 'utf8'));
const cardById = Object.fromEntries(cards.map((c) => [String(c['卡片ID'] ?? '').trim(), c]));
const excluded = (fs.existsSync(EXCL) ? JSON.parse(fs.readFileSync(EXCL, 'utf8')).excluded : null) || die('找不到排除卡名單（先到 agricola-online 跑 node audit_exclusions.cjs --json）');
if (Object.keys(excluded).length !== 379) die(`排除卡應 379，讀到 ${Object.keys(excluded).length}`);
const plan = {}; const notes = {}; const newCards = []; const stat = {}; const warn = []; const gaps = {};
const count = (k, n = 1) => { stat[k] = (stat[k] || 0) + n; };
const note = (id, s) => { (notes[id] ||= []).push(s); };
const fmt = (e) => `${e.ch}·${[...e.role, ...(e.attr || []).map((a) => `[${a}]`)].join('+')}${e.on ? '@' + e.on : ''}${e.from ? '<' + e.from : ''}${e.pool ? '{' + e.pool + '}' : ''}`;
function entriesOf(id) {
  if (plan[id]) return plan[id];
  if (oldJson[id]) return (plan[id] = oldJson[id].channels.map((e) => ({ ...e })));
  const card = cardById[id] || die(`cards.json 沒有這張卡：${id}`);
  newCards.push({ id, name: card['牌名'] });
  return (plan[id] = []);
}
function addEntry(id, e, src) {
  e = order(e);
  const list = entriesOf(id);
  const isReadLike = (x) => (x.role || []).includes('read') || !(x.role || []).length;
  // 依據（read／狀態）：同頻道已有 read 或 attr-only → 跳過；分數只認同 pool 的 read
  if (src === '依據') {
    const ex = e.ch === '分數' ? list.find((x) => x.ch === '分數' && (x.role || []).includes('read') && x.pool === e.pool) : list.find((x) => x.ch === e.ch && isReadLike(x));
    if (ex) {
      if (DIR_FIX[id] && DIR_FIX[id][e.ch] && S(ex.attr) !== S([DIR_FIX[id][e.ch]])) { const before = fmt(ex); ex.attr = [DIR_FIX[id][e.ch]]; count('依據 改方向'); note(id, `依據 改 ${before} → ${fmt(ex)}`); return true; }
      if (e.attr &&S([...(ex.attr || [])].sort()) !== S([...e.attr].sort())) warn.push(`${id} ${cardById[id]?.['牌名']}：${e.ch} 既有 ${fmt(ex)}，預審要 ${fmt(e)}（attr 不同，維持既有）`);
      count('依據 已有跳過'); return false;
    }
  } else if (list.some((x) => x.ch === e.ch && S(x.role || []) === S(e.role) && S(x.attr || []) === S(e.attr || []) && (x.pool || '') === (e.pool || ''))) { warn.push(`${id} 已有 ${fmt(e)}，跳過`); count(`${src} 已有跳過`); return false; }
  list.push(e); count(`${src} 加`); note(id, `${src} 加 ${fmt(e)}`);
  return true;
}

const scoreCards = {}; // id → 分數型（給計畫檔）
for (const [id, name, , kind0, basis0] of W) {
  const kind = KIND_FIX[id] || kind0;
  scoreCards[id] = kind;
  if (kind === '退場') { count('wave2 退場'); continue; }
  if (!['get', '改計分', '改計分+get'].includes(kind)) die(`${id} 分數型看不懂：${kind}`);
  if (cardById[id]['牌名'] !== name) warn.push(`${id} 牌名不同：表「${name}」cards「${cardById[id]['牌名']}」`);
  const toks = basis0.split(/\s+/).filter((x) => x && x !== '—');
  const basis = BASIS_FIX[id] ? [] : toks.filter((t) => !t.startsWith('?'));
  const gap = toks.filter((t) => t.startsWith('?')); if (gap.length) gaps[id] = gap;
  if (BASIS_FIX[id]) { gaps[id] = toks.filter((t) => t.startsWith('?')); note(id, `依據照存疑預設只留缺口（原 ${basis0}）`); }
  const text = String(cardById[id]['說明'] ?? '');
  const pool = (basis.includes('分數·read[勝利點數]') && /勝利點數/.test(text) && /買回|加總/.test(text)) ? '勝利點數' : '紅利分數'; // 同 gen.cjs 第 44～46 行
  if (kind.startsWith('改計分')) addEntry(id, { ch: '分數', role: [], attr: ['改計分'], pool: '基本計分' }, '分數');
  if (kind.endsWith('get')) {
    const list = entriesOf(id);
    if (list.some((x) => x.ch === '分數' && (x.role || []).includes('get'))) { count('分數 get 已有跳過'); note(id, '已有 分數·get，不重加'); }
    else addEntry(id, { ch: '分數', role: ['get'], pool }, '分數');
  }
  for (const t of basis) addEntry(id, basisEntry(id, t), '依據');
  if (DIR_FIX[id]) note(id, `　↳ 方向改：${DIR_FIX[id].why}`);
}

// dash：A／C → 無直接效果名單；B → 補 entry；裁定② 的 A → 補 食物·get
const NO_EFFECT = [];
for (const [id, name, cls, ent] of DASH) {
  if (FEED_SAVE[id]) { addEntry(id, { ch: '食物', role: ['get'], from: '供應' }, 'dash'); note(id, `　↳ 裁定②省食物：${FEED_SAVE[id]}`); continue; }
  if (DASH_TO_NONE[id]) { NO_EFFECT.push(id); note(id, `改無直接效果：${DASH_TO_NONE[id]}`); continue; }
  if (cls === 'A' || cls === 'C') { NO_EFFECT.push(id); continue; }
  if (cls !== 'B') die(`${id} dash 判別看不懂：${cls}`);
  for (const tok of ent.split('；')) {
    const e = dashEntry(id, tok);
    if (e.ch === '圈地' && !e.role.length) { // 狀態型：同頻道 attr-only 就換成新 attr 組
      const list = entriesOf(id); const ex = list.find((x) => x.ch === '圈地' && !(x.role || []).length);
      if (ex) { const before = fmt(ex); ex.attr = e.attr; count('dash 改'); note(id, `dash 改 ${before} → ${fmt(ex)}`); continue; }
    }
    addEntry(id, e, 'dash');
  }
}

// ── 守門 ───────────────────────────────────────────────────────
const touched = Object.keys(plan).filter((id) => !oldJson[id] ? plan[id].length > 0 : S(plan[id]) !== S(oldJson[id].channels));
const bad = [...touched, ...NO_EFFECT].filter((id) => excluded[id] || excluded[id.replaceAll('*', '')]);
if (bad.length) die(`混到排除卡：${bad.join('、')}`);
let deletions = 0;
for (const id of touched) if (oldJson[id]) for (const e of oldJson[id].channels) if (!plan[id].some((x) => x.ch === e.ch && S(x.role) === S(e.role))) deletions++;
if (deletions) die(`有既有 entry 被刪：${deletions}`);
const emptyNew = newCards.filter((c) => !plan[c.id].length).map((c) => c.id);
if (emptyNew.length) warn.push(`新卡沒 entry（不建塊）：${emptyNew.join('、')}`);

// ── 寫回 ───────────────────────────────────────────────────────
for (const id of touched) {
  if (!byKey[id]) continue;
  const b = byKey[id]; const r = channelsRange(b.lines);
  b.lines.splice(r[0], r[1] - r[0] + 1, ...renderRegion(plan[id], b.lines[r[1]] === '  ],'));
}
const appended = newCards.filter((c) => touched.includes(c.id));
for (const c of appended) blocks.push(newBlock(c.id, c.name, plan[c.id]));
const out = joinBlocks(eol, blocks);
let parsedOut; try { parsedOut = JSON.parse(out); } catch (err) { die('產出不是合法 JSON：' + err.message); }
if (S(blocks.slice(0, origBlockKeys.length).map((b) => b.key)) !== S(origBlockKeys)) die('既有卡片順序變了');
const touchedSet = new Set(touched);
for (const id in oldJson) {
  if (!parsedOut[id]) die(`產出少了 ${id}`);
  if (oldJson[id].牌名 !== parsedOut[id].牌名) die(`${id} 牌名變了`);
  if (S(oldJson[id].effects) !== S(parsedOut[id].effects)) die(`${id} effects 變了`);
  if (!touchedSet.has(id) && S(oldJson[id].channels) !== S(parsedOut[id].channels)) die(`沒計畫動的卡被動到：${id}`);
  if (touchedSet.has(id) && S(plan[id]) !== S(parsedOut[id].channels)) die(`${id} 寫回結果跟計畫不同`);
}
for (const c of appended) if (S(parsedOut[c.id]) !== S({ 牌名: c.name, channels: plan[c.id] })) die(`新卡 ${c.id} 寫回結果跟計畫不同`);
if (Object.keys(parsedOut).length !== Object.keys(oldJson).length + appended.length) die('卡片張數對不上');
{ const { blocks: b2 } = splitBlocks(out); for (const b of b2) { const r = channelsRange(b.lines); if (S(b.lines.slice(r[0], r[1] + 1)) !== S(renderRegion(parsedOut[b.key].channels, b.lines[r[1]] === '  ],'))) die(`新檔重畫不一致：${b.key}`); } }

// ── 報告 ───────────────────────────────────────────────────────
const oldN = Object.values(oldJson).reduce((s, c) => s + c.channels.length, 0);
const newN = Object.values(parsedOut).reduce((s, c) => s + c.channels.length, 0);
console.log(`計畫：${Object.entries(stat).map(([k, v]) => `${k} ${v}`).join('／')}`);
console.log(`動到 ${touched.length} 張卡（既有 ${touched.length - appended.length}＋新卡 ${appended.length}）；entry ${oldN} → ${newN}（+${newN - oldN}）；刪除 0`);
console.log(`無直接效果名單 ${NO_EFFECT.length} 張`);
if (warn.length) console.log(`⚠ ${warn.length} 則：\n  ${warn.join('\n  ')}`);
fs.writeFileSync(path.join(VIEWER, 'tools', 'no_effect_ids.json'), JSON.stringify(NO_EFFECT, null, 1).replace(/\n/g, '\r\n'), 'utf8');
if (PLAN_MD) {
  const nm = (id) => (oldJson[id] || {}).牌名 || cardById[id]?.['牌名'];
  const md = ['# 分數頻道 wave2＋「—」收尾 落地計畫（tools/apply_wave2_score.cjs 產出）', '',
    `- 動到 ${touched.length} 張卡（既有 ${touched.length - appended.length}＋新卡 ${appended.length}）；entry +${newN - oldN}；刪除 0`,
    `- 統計：${Object.entries(stat).map(([k, v]) => `${k} ${v}`).join('／')}`,
    `- 無直接效果 ${NO_EFFECT.length} 張；wave2 退場 ${Object.values(scoreCards).filter((k) => k === '退場').length} 張`, '',
    '## Lu 11/02 裁定套用', '', '### ① 比較型改無方向', '', ...Object.entries(DIR_FIX).map(([id, x]) => `- ${x.why}（${id}）`),
    '', '### ② 省食物＝食物引擎（補 食物·get）', '', ...Object.entries(FEED_SAVE).map(([id, s]) => `- ${s}（${id}）`),
    '', '### 存疑預設', '', '- 混合礦晶粉 8767-4：改計分 → get', '- 遲到的建築工人 6327-3：依據只留缺口', ...Object.entries(DASH_TO_NONE).map(([id, s]) => `- ${s}（${id}）`),
    '', `## 警告（${warn.length}）`, '', ...warn.map((s) => `- ${s}`),
    '', '## 無直接效果名單', '', NO_EFFECT.map((id) => `${nm(id)}（${id}）`).join('、'),
    '', '## 缺口（?，不落頻道）', '', ...Object.entries(gaps).map(([id, g]) => `- ${nm(id)}（${id}）：${g.join(' ')}`),
    '', '## 每張卡的改動', ''];
  for (const id of touched) md.push(`- **${nm(id)}**（${id}）${oldJson[id] ? '' : '　🆕'}：${(notes[id] || []).join('；')}`);
  fs.writeFileSync(PLAN_MD, md.join('\n') + '\n', 'utf8');
  console.log(`→ ${PLAN_MD}`);
}
if (DRY) { console.log('--dry：不寫 channels.json'); process.exit(0); }
fs.writeFileSync(CHANNELS, out, 'utf8');
console.log('✅ 已寫入 channels.json（git 可還原，不另存備份）');
