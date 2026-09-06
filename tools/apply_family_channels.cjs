#!/usr/bin/env node
/* eslint-disable no-console */
/*
   卡片類型系統 工序 3.7：把三個新類（減免資源／不卡格／加強行動）塞進 channels.json
   ＋ 連續派遣漏標 6 張補「額外行動」。

   依據（Lu 裁定，塞頻道照它，不重問）：
     Dropbox 600_Project/烏嘎嘎桌遊/agricola-viewer/農家樂_卡片類型_三新類裁定_20260905.md
   候選名單（沒列在「劃掉」的視為通過）：
     農家樂_卡片類型_三新類候選_20260905.md          （減免 A／B、不卡格 A／B、加強行動、連續派遣）
     農家樂_卡片類型_加強行動第二族候選_20260906.md    （「用某格多做一個行動」233 張，Lu 劃掉的填 FAMILY2_DROP）

   entry 形狀（跟既有「額外行動」一樣，不帶 on）：
     { ch: "減免資源", role: ["cause"], attr?: ["替代"] }   替代＝可用另一種資源付（Lu：不開第 14 類）
     { ch: "不卡格",   role: ["cause"] }
     { ch: "加強行動", role: ["cause"], attr: ["做兩次"] | ["加做行動"] }   第一族／第二族
     { ch: "額外行動", role: ["cause"] }                                   連續派遣漏標

   🔴 channels.json 不可 JSON.parse→stringify 整檔重寫（整數樣式 key 會被重排洗牌）。
      全程純文字切塊；零改動先自檢 byte 相同；任一守門不過就 exit(1) 不寫檔。
   可重跑：同卡已有同頻道 entry 就跳過（第二族劃完再跑一次只會補第二族）。

   用法：node tools/apply_family_channels.cjs [--dry] [--exclusions <json>]
*/
const fs = require('fs');
const path = require('path');

const VIEWER = path.resolve(__dirname, '..');
const DROPBOX = 'D:/Dropbox/Lu_Agent/600_Project/烏嘎嘎桌遊/agricola-viewer';
const MD1 = path.join(DROPBOX, '農家樂_卡片類型_三新類候選_20260905.md');
const MD2 = path.join(DROPBOX, '農家樂_卡片類型_加強行動第二族候選_20260906.md');
const CHANNELS = path.join(VIEWER, 'channels.json');
const argv = process.argv.slice(2);
const argOf = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const DRY = argv.includes('--dry');
const EXCL = path.resolve(argOf('--exclusions') || path.join(VIEWER, '..', 'agricola-online', 'exclusions_audit.json'));

const die = (msg) => { console.error('❌ 中止：' + msg); process.exit(1); };
const S = (v) => JSON.stringify(v);
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
for (const p of [MD1, MD2, CHANNELS, EXCL]) if (!fs.existsSync(p)) die(`找不到 ${p}`);

// ══ 裁定（照 三新類裁定_20260905.md 逐字抄；改裁定先改那份檔） ══════════════
const RULING = {
  減免A_drop: ['11972-3'],
  減免A_alt_extra: ['10229-6', 'D095', 'WM011', 'Ö08', '2924-2'], // 外加 來源含 BUILD_COST_SWAP_CARDS／ALT_BUILD_COST_CARDS 的
  減免B_free_keep: ['10390-2', '2254-3', '7203-4'],                // 「免費建造」組只留 3 張，其餘 44 張劃掉
  減免B_rest_drop: ['Cz22', '5757-4', '5922-12', '6311-4', '8293-12', '9074-4', '9200-10', 'A013', 'B088', 'G042', 'WM005',
    '5753-2', 'E159', 'FL041', 'WM056', '6333-4', '6511-2', '8337-3', '舊版E151', '舊版E178', '舊版E191', 'E127',
    'B002*', 'B016*', 'G009', 'E002', '8549-2', '4727-8'],
  減免B_rest_alt: ['10157-10', '5387-12', '7092-3', '4298-4', '8816-2', 'C149*', '10616-4', '4418-8', 'WM112', '10785-3',
    '12164-2', '8679-2', 'FR065', 'WM042', 'E027', '3762-7'],
  減免_special_pass: ['FR112', 'D016', '7331-3', '11093-2'],       // 特別通過（本來就在候選內，這裡只驗它們真的在）
  不卡格A_drop: ['545-5', 'A129', '11887-6'],
  不卡格B_keep: ['11093-2'],
  不卡格_extra: ['G056'],                                          // 補進：替補者
  加強行動_keep: ['6105-6', 'Cz20', 'WM048', '6971-5', '9675-3', '10520-2', 'Cz21', 'G056', 'A024*', 'B025*', 'B108*', 'A073'],
  加強行動_drop_count: 9,
  連續派遣_add: ['11145-2', '5957-6', '6282-4', 'B024*', 'D024', 'WA034'],
};
// 第二族：Lu 劃掉的填這裡（卡片 ID）。null＝還沒裁定 → 整族先不塞，其他三類照做。
// 第二族「不算」54 張（sonnet 判、Lu 0906 看過判不出 2 張皆算；判定檔：農家樂_卡片類型_加強行動第二族判定_20260906.md）
const FAMILY2_DROP = [
  '4909-15', '4982', '10332-6', 'B055', 'B062*', 'E067', '11479-4', '11877', '5006-9', '6403-3', 'E024', 'Ö21', 'PI09', '4391', '9695', 'A097', 'B026', 'B054', 'FL001', 'K266', 'WA012', '10130-8', '11323-2', '12188-3', '5908-3', '5982-3', '8544-4', '8551-3', '9160-3', '9169-2', '12116', '6940-2', '8790-2', '8795-4', 'Cz14', 'FL042', 'I243', '5701-2', '11725-2', '9650-2', 'FR066', 'G115', '10492-6', '5917-6', 'D074', 'FR094', '4274-3', 'A109', '10159-2', '12331-2', '4253-2', 'A088*', 'FR080', '10815-6',
];
// 替代卡「讀那種材料」（裁定：頻道記 attr 替代並讀那種材料）：既有資料的慣例是消耗走 pay，
// 這裡只補「目前完全沒有 pay entry」且卡文材料明確的；退還馬廄／棄手牌那種沒有對應資源頻道的不補。
// 磨坊工人 D088* 已有 麥子·get，同頻道不疊第二筆，略。
const SUB_PAY = {
  'Ö08': ['木頭'], '2924-2': ['石頭'], '4298-4': ['蘆葦'], FR065: ['動物'], '10492-6': ['建築資源', '蘆葦'], 5041: ['建築資源'],
  '6965-4': ['磚頭'], '7223-3': ['石頭'], '舊版E36': ['磚頭'], '舊版E37': ['磚頭'], 'A016*': ['磚頭'], 'A123*': ['木頭'],
  'B145*': ['木頭'], 'C056*': ['磚頭'], G001: ['磚頭', '石頭'], G053: ['石頭'], K136: ['木頭'],
};

// ══ 1. 解析候選 md ═══════════════════════════════════════════════════
// 回傳 [{section:'一', sub:'A'|'B', group, id, name, why}]
function parseMd1() {
  const lines = fs.readFileSync(MD1, 'utf8').split(/\r?\n/);
  const rows = [];
  let section = null, sub = null, group = null, cur = null;
  for (const l of lines) {
    let m;
    if ((m = l.match(/^## ([一二三四])、/))) { section = m[1]; sub = null; group = null; continue; }
    if ((m = l.match(/^### ([AB])\./))) { sub = m[1]; group = null; continue; }
    if ((m = l.match(/^#### 「(.+?)」/))) { group = m[1]; continue; }
    if ((m = l.match(/^- \[[ xX]\] \*\*(.+?)\*\*（(.+?)・/))) { cur = { section, sub, group, id: m[2], name: m[1], why: '' }; rows.push(cur); continue; }
    if (cur && (m = l.match(/^  來源：(.*)$/))) cur.why = m[1];
  }
  return rows;
}
function parseMd2() {
  const lines = fs.readFileSync(MD2, 'utf8').split(/\r?\n/);
  const rows = [];
  let inScope = false, group = null;
  for (const l of lines) {
    let m;
    if (/^## 一、候選/.test(l)) { inScope = true; continue; }
    if (/^## 附/.test(l)) { inScope = false; continue; }
    if (!inScope) continue;
    if ((m = l.match(/^### (.+?)（\d+ 張）/))) { group = m[1]; continue; }
    if ((m = l.match(/^- \[[ xX]\] \*\*(.+?)\*\*（(.+?)・/))) rows.push({ group, id: m[2], name: m[1] });
  }
  return rows;
}
const md1 = parseMd1();
const md2 = parseMd2();
const ids1 = new Set(md1.map((r) => r.id));
if (new Set(md2.map((r) => r.id)).size !== md2.length) die('第二族候選有重複 ID');
const need = (list, pool, label) => { const miss = list.filter((id) => !pool.has(id)); if (miss.length) die(`${label}：裁定檔列的 ID 不在候選名單裡 ${miss.join('、')}`); };

// ══ 2. 套裁定 → 每張卡要加的 entry ═══════════════════════════════════
// plan: id → [{ch, role, attr?}]
const plan = {};
const stat = {};
const count = (k, n = 1) => { stat[k] = (stat[k] || 0) + n; };
// 同卡同頻道只放一筆（替補者 G056 同時在不卡格 A 節與補進名單），統計只算真的加進去的
const addEntry = (id, e, statKey) => { const l = (plan[id] ||= []); if (l.some((x) => x.ch === e.ch)) return false; l.push(e); if (statKey) count(statKey); return true; };

// 一、減免資源
const A1 = md1.filter((r) => r.section === '一' && r.sub === 'A');
const B1free = md1.filter((r) => r.section === '一' && r.sub === 'B' && r.group === '免費建造');
const B1rest = md1.filter((r) => r.section === '一' && r.sub === 'B' && r.group !== '免費建造');
if (A1.length !== 107 || B1free.length !== 47 || B1rest.length !== 97) die(`減免候選數不對：A ${A1.length}／免費建造 ${B1free.length}／其餘 ${B1rest.length}（期望 107／47／97）`);
need(RULING.減免A_drop, new Set(A1.map((r) => r.id)), '減免A劃掉');
need(RULING.減免A_alt_extra, new Set(A1.map((r) => r.id)), '減免A替代');
need(RULING.減免B_free_keep, new Set(B1free.map((r) => r.id)), '減免B免費建造留');
need(RULING.減免B_rest_drop, new Set(B1rest.map((r) => r.id)), '減免B其餘劃掉');
need(RULING.減免B_rest_alt, new Set(B1rest.map((r) => r.id)), '減免B其餘替代');
need(RULING.減免_special_pass, ids1, '減免特別通過');
const altSet = new Set([...RULING.減免A_alt_extra, ...RULING.減免B_rest_alt,
  ...A1.filter((r) => /BUILD_COST_SWAP_CARDS|ALT_BUILD_COST_CARDS/.test(r.why)).map((r) => r.id)]);
const dropA = new Set(RULING.減免A_drop), keepFree = new Set(RULING.減免B_free_keep), dropRest = new Set(RULING.減免B_rest_drop);
const discountIds = [
  ...A1.filter((r) => !dropA.has(r.id)).map((r) => r.id),
  ...B1free.filter((r) => keepFree.has(r.id)).map((r) => r.id),
  ...B1rest.filter((r) => !dropRest.has(r.id)).map((r) => r.id),
];
for (const id of new Set(discountIds)) {
  const e = { ch: '減免資源', role: ['cause'] };
  if (altSet.has(id)) { e.attr = ['替代']; count('減免資源·替代'); }
  addEntry(id, e, '減免資源');
}
for (const id of altSet) if (!discountIds.includes(id)) die(`替代名單裡的 ${id} 沒通過減免？`);
for (const id of Object.keys(SUB_PAY)) {
  if (!altSet.has(id)) die(`SUB_PAY 的 ${id} 不在替代名單`);
  for (const ch of SUB_PAY[id]) addEntry(id, { ch, role: ['pay'] }, '替代材料·pay');
}

// 二、不卡格
const A2 = md1.filter((r) => r.section === '二' && r.sub === 'A');
const B2 = md1.filter((r) => r.section === '二' && r.sub === 'B');
if (A2.length !== 56 || B2.length !== 5) die(`不卡格候選數不對：A ${A2.length}／B ${B2.length}（期望 56／5）`);
need(RULING.不卡格A_drop, new Set(A2.map((r) => r.id)), '不卡格A劃掉');
need(RULING.不卡格B_keep, new Set(B2.map((r) => r.id)), '不卡格B留');
const dropA2 = new Set(RULING.不卡格A_drop), keepB2 = new Set(RULING.不卡格B_keep);
for (const id of [...A2.filter((r) => !dropA2.has(r.id)).map((r) => r.id), ...B2.filter((r) => keepB2.has(r.id)).map((r) => r.id), ...RULING.不卡格_extra]) {
  addEntry(id, { ch: '不卡格', role: ['cause'] }, '不卡格');
}

// 三、加強行動 第一族（做兩次／加倍）：裁定檔明列「留」12 張
const C3 = md1.filter((r) => r.section === '三');
if (C3.length !== 21) die(`加強行動候選數 ${C3.length} ≠ 21`);
const keep3 = new Set(RULING.加強行動_keep);
const c3ids = new Set(C3.map((r) => r.id));
const keepNotInMd = [...keep3].filter((id) => !c3ids.has(id)); // 替補者 G056 不在候選（從不卡格節補進）
const dropped3 = C3.filter((r) => !keep3.has(r.id));
if (dropped3.length !== RULING.加強行動_drop_count) die(`加強行動劃掉 ${dropped3.length} 張 ≠ 裁定檔 ${RULING.加強行動_drop_count}：${dropped3.map((r) => r.name).join('、')}`);
for (const id of keep3) addEntry(id, { ch: '加強行動', role: ['cause'], attr: ['做兩次'] }, '加強行動·做兩次');

// 三、加強行動 第二族（用某格多做一個行動）
let fam2 = [];
if (FAMILY2_DROP === null) {
  console.log(`⚠ 第二族 ${md2.length} 張 Lu 還沒劃（FAMILY2_DROP 是 null），這次不塞；劃完填進去再跑一次即可。`);
} else {
  need(FAMILY2_DROP, new Set(md2.map((r) => r.id)), '第二族劃掉');
  const drop2 = new Set(FAMILY2_DROP);
  fam2 = md2.filter((r) => !drop2.has(r.id));
  for (const r of fam2) {
    const prior = (plan[r.id] || []).find((e) => e.ch === '加強行動');
    if (prior) { if (!prior.attr.includes('加做行動')) prior.attr.push('加做行動'); }
    else addEntry(r.id, { ch: '加強行動', role: ['cause'], attr: ['加做行動'] });
    count('加強行動·加做行動');
  }
}

// 四、連續派遣漏標 → 額外行動
for (const id of RULING.連續派遣_add) addEntry(id, { ch: '額外行動', role: ['cause'] }, '額外行動');

// ══ 3. 守門：排除卡、卡庫 ═══════════════════════════════════════════
const audit = readJson(EXCL);
const excluded = audit.excluded || {};
if (Object.keys(excluded).length < 300) die(`排除名單只有 ${Object.keys(excluded).length} 筆，看起來不對（要跑 audit_exclusions.cjs --json）`);
const planIds = Object.keys(plan);
const bad = planIds.filter((id) => excluded[id] || excluded[id.replaceAll('*', '')]);
if (bad.length) die(`混到排除卡 ${bad.length} 張：${bad.join('、')}`);
const cards = readJson(path.join(VIEWER, 'cards.json'));
const cardById = {};
for (const c of cards) cardById[String(c['卡片ID'] ?? '').trim()] = c;
const missing = planIds.filter((id) => !cardById[id]);
if (missing.length) die(`卡庫查無此卡：${missing.join('、')}`);

// ══ 4. channels.json 純文字切塊（沿用 apply_score_channel.cjs）═══════════
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
function renderEntry(e, isLast) {
  const out = ['   {', `    "ch": ${S(e.ch)},`, '    "role": [', ...e.role.map((r, i) => `     ${S(r)}${i === e.role.length - 1 ? '' : ','}`), `    ]${e.attr ? ',' : ''}`];
  if (e.attr) out.push('    "attr": [', ...e.attr.map((a, i) => `     ${S(a)}${i === e.attr.length - 1 ? '' : ','}`), '    ]');
  out.push(isLast ? '   }' : '   },');
  return out;
}

const original = fs.readFileSync(CHANNELS);
const text = original.toString('utf8');
const { eol, blocks } = splitBlocks(text);
if (eol !== '\r\n') die('換行不是 CRLF，跟原檔約定不符');
if (!Buffer.from(joinBlocks(eol, blocks), 'utf8').equals(original)) die('自檢失敗：零改動時重建的檔案跟原檔不是 byte 相同');
console.log(`切塊自檢 ✅　${blocks.length} 張卡，零改動可重建 byte 相同原檔`);
const oldJson = JSON.parse(text);
const byKey = {}; blocks.forEach((b) => { byKey[b.key] = b; });
const origBlockKeys = blocks.map((b) => b.key);

// ══ 5. 寫入（已有同頻道 entry 的跳過） ═════════════════════════════════
let added = 0, touched = 0, created = 0, skipped = 0;
const attrConflicts = [];
for (const id of planIds) {
  const existing = new Set(((oldJson[id] || {}).channels || []).map((e) => e.ch));
  const list = plan[id].filter((e) => {
    if (!existing.has(e.ch)) return true;
    skipped++;
    const old = oldJson[id].channels.find((x) => x.ch === e.ch);
    if (S(old.attr || []) !== S(e.attr || []) || !(old.role || []).includes('cause')) attrConflicts.push(`${id} ${e.ch} 既有 ${S(old)} vs 想加 ${S(e)}`);
    return false;
  });
  if (!list.length) continue;
  const blk = byKey[id];
  if (blk) {
    const ci = blk.lines.findIndex((l) => l === '  "channels": [');
    if (ci < 0) die(`${id} 找不到 "channels": [`);
    let cj = ci + 1;
    while (cj < blk.lines.length && blk.lines[cj] !== '  ]' && blk.lines[cj] !== '  ],') cj++;
    if (cj >= blk.lines.length) die(`${id} 找不到 channels 收尾`);
    const add = [];
    if (blk.lines[cj - 1] === '  "channels": [') die(`${id} channels 是空陣列（格式不同），要手處理`);
    if (blk.lines[cj - 1] !== '   }') die(`${id} channels 最後一筆收尾不是 "   }"：${S(blk.lines[cj - 1])}`);
    blk.lines[cj - 1] = '   },';
    list.forEach((e, i) => add.push(...renderEntry(e, i === list.length - 1)));
    blk.lines.splice(cj, 0, ...add);
    touched++;
  } else {
    const L = [` "${id}": {`, `  "牌名": ${S(cardById[id]['牌名'])},`, '  "channels": ['];
    list.forEach((e, i) => L.push(...renderEntry(e, i === list.length - 1)));
    L.push('  ]', ' }');
    blocks.push({ key: id, lines: L });
    byKey[id] = blocks[blocks.length - 1];
    created++;
  }
  added += list.length;
}

// ══ 6. 產出守門 ═══════════════════════════════════════════════════════
const out = joinBlocks(eol, blocks);
let parsedOut;
try { parsedOut = JSON.parse(out); } catch (err) { die('產出不是合法 JSON：' + err.message); }
for (const id in oldJson) {
  const a = oldJson[id], b = parsedOut[id];
  if (!b) die(`產出少了卡 ${id}`);
  if (a.牌名 !== b.牌名) die(`${id} 牌名變了`);
  if (S(a.effects) !== S(b.effects)) die(`${id} effects 變了`);
  if (S(a.channels) !== S(b.channels.slice(0, a.channels.length))) die(`${id} 既有 entry 被動到`);
}
const oldKeys = Object.keys(oldJson), newKeys = Object.keys(parsedOut);
// 順序用文字層的 block key 驗（JSON.parse 會把整數樣式 key 重排，不能拿它比）
if (S(blocks.slice(0, origBlockKeys.length).map((b) => b.key)) !== S(origBlockKeys)) die('既有卡片順序變了');
const oldN = oldKeys.reduce((s, id) => s + oldJson[id].channels.length, 0);
const newN = newKeys.reduce((s, id) => s + parsedOut[id].channels.length, 0);
if (newN - oldN !== added) die(`entry 增量 ${newN - oldN} ≠ 計畫 ${added}`);
for (const id of planIds) for (const e of plan[id]) if (!parsedOut[id].channels.some((x) => x.ch === e.ch)) die(`${id} 產出裡沒有 ${e.ch}`);

// ══ 7. 報告 ═══════════════════════════════════════════════════════════
console.log(`計畫：${Object.entries(stat).map(([k, v]) => `${k} ${v}`).join('／')}`);
console.log(`減免資源：A ${A1.length}－劃 ${dropA.size}；免費建造留 ${keepFree.size}／${B1free.length}；其餘 ${B1rest.length}－劃 ${dropRest.size}（裁定檔寫 27，實列 ${RULING.減免B_rest_drop.length}）`);
console.log(`加強行動第一族：留 ${keep3.size}（其中不在候選、由不卡格節補進：${keepNotInMd.join('、') || '無'}）／劃 ${dropped3.length}`);
console.log(`寫入：既有卡加 entry ${touched} 張／新增卡片節點 ${created} 張／共 ${added} entry／已存在跳過 ${skipped}`);
if (attrConflicts.length) console.log(`⚠ 已存在但形狀不同（沒動，要人看）：\n  ${attrConflicts.join('\n  ')}`);
const nCh = new Set(newKeys.flatMap((id) => parsedOut[id].channels.map((e) => e.ch))).size;
console.log(`產出：卡 ${newKeys.length}／entry ${newN}／頻道 ${nCh}`);

if (DRY) { console.log('--dry：不寫檔'); process.exit(0); }
if (!added) { console.log('沒有要加的 entry，不動檔案。'); process.exit(0); }
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const bak = path.join(VIEWER, `channels.backup_${stamp}_pre-family.json`);
fs.writeFileSync(bak, original);
fs.writeFileSync(CHANNELS, out, 'utf8');
console.log(`備份：${bak}\n✅ 已寫入 ${CHANNELS}`);
