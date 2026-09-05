#!/usr/bin/env node
/* eslint-disable no-console */
/*
   卡片類型系統 工序 3.5：從 LUGA 引擎（agricola-online/play.js）的表撈三個新類型的候選名單
   → 出一份「卡名＋來源一句」的 md 給 Lu 劃掉錯的（Lu 0905 grill 定案：加三類變 13 類）。

   三類：
     減免資源  ＝ 蓋房／翻修／馬廄／柵欄／打牌時少付資源（引擎：*_DISCOUNT_CARDS 等表）
     不卡格    ＝ 行動格已被佔據仍可派人（引擎：canIgnoreOccupied 常駐白名單＋occupiedActionChoices 顯式選項）
     加強行動  ＝ 同一行動做兩次或貨物加倍（引擎沒有單一表，散在巨人／巨石像／各卡；主要靠卡文關鍵字）
   外加第四節：卡文寫「連續派遣」但目前沒標「行動加速」的漏標（套索 B024* 那種）。

   用法：node tools/extract_engine_families.cjs [--play <play.js>] [--out <md>] [--exclusions <json>]
   輸入：../agricola-online/play.js、cards.json、card-profile.json（目前類型）、exclusions_audit.json（排除卡）
   輸出：md 一份（預設寫到 Dropbox 600_Project/烏嘎嘎桌遊/agricola-viewer/）。只讀不改任何 json。
*/
const fs = require('fs');
const path = require('path');

const VIEWER = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const argOf = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const PLAY = path.resolve(argOf('--play') || path.join(VIEWER, '..', 'agricola-online', 'play.js'));
const EXCL = path.resolve(argOf('--exclusions') || path.join(VIEWER, '..', 'agricola-online', 'exclusions_audit.json'));
const OUT = path.resolve(argOf('--out') || 'D:/Dropbox/Lu_Agent/600_Project/烏嘎嘎桌遊/agricola-viewer/農家樂_卡片類型_三新類候選_20260905.md');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
for (const p of [PLAY, EXCL]) if (!fs.existsSync(p)) { console.error(`✗ 找不到 ${p}`); process.exit(1); }

const src = fs.readFileSync(PLAY, 'utf8');
const lines = src.split('\n');
const cards = readJson(path.join(VIEWER, 'cards.json'));
const profile = readJson(path.join(VIEWER, 'card-profile.json'));
const excluded = readJson(EXCL).excluded || {};

// ── 卡片 ID 對照：引擎用 cleanCardId（去 *），viewer 的 ID 可能帶 * ──
const byId = {};
const byClean = {};
for (const c of cards) {
  const id = String(c['卡片ID'] ?? '').trim();
  if (!id) continue;
  byId[id] = c;
  const clean = id.replaceAll('*', '');
  if (!byClean[clean] || id.endsWith('*')) byClean[clean] = id; // 同 clean 多筆時偏好帶 * 的（引擎那份）
}
const resolve = (raw) => {
  const s = String(raw).trim();
  if (byId[s]) return s;
  const clean = s.replaceAll('*', '');
  return byClean[clean] || null;
};

// ── 從 play.js 切出一個 const 區塊（純文字，找到多個或找不到就中止不猜）──
function block(name) {
  const starts = lines.map((l, i) => (l.startsWith(`const ${name} = `) ? i : -1)).filter((i) => i >= 0);
  if (starts.length !== 1) { console.error(`✗ ${name} 在 play.js 找到 ${starts.length} 處，中止`); process.exit(1); }
  const s = starts[0];
  if (/;\s*$/.test(lines[s])) return lines.slice(s, s + 1);
  let e = s + 1;
  while (e < lines.length && !/^[\]\}\)]/.test(lines[e])) e++;
  return lines.slice(s, e + 1);
}
function fnBody(name) {
  const starts = lines.map((l, i) => (l.startsWith(`function ${name}(`) ? i : -1)).filter((i) => i >= 0);
  if (starts.length !== 1) { console.error(`✗ function ${name} 找到 ${starts.length} 處，中止`); process.exit(1); }
  let e = starts[0] + 1;
  while (e < lines.length && lines[e] !== '}') e++;
  return { start: starts[0] + 1, body: lines.slice(starts[0], e + 1) };
}
// 物件表的第一層 key（2 空白縮排）；陣列表的 id: 欄；Set 的字串
function tableIds(name) {
  const b = block(name);
  const ids = new Set();
  if (/= \[/.test(b[0])) {
    for (const l of b) for (const m of l.matchAll(/\bid:\s*'([^']+)'/g)) ids.add(m[1]);
  } else if (/= new Set\(/.test(b[0])) {
    for (const m of b.join('\n').matchAll(/'([^']+)'/g)) ids.add(m[1]);
  } else {
    for (const l of b) { const m = l.match(/^  (?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_舊版]+))\s*:/); if (m) ids.add(m[1] ?? m[2] ?? m[3]); }
  }
  return { ids: [...ids], span: `play.js:${lines.indexOf(b[0]) + 1}` };
}
// 從一段文字（含註解）挑出長得像卡片 ID 的 token，再拿 cards.json 驗
const ID_RE = /舊版[A-Z]{1,2}\d{2,3}|Ö\d{2}|\b[A-Z]{1,2}[a-z]?\d{2,3}\*?|\b\d{3,5}(?:-\d{1,2})?\*?/g;
const idsInText = (text) => [...new Set([...text.matchAll(ID_RE)].map((m) => m[0]).map(resolve).filter(Boolean))];

// ── 收集：family → id → Set<來源> ──
const fam = { 減免資源: {}, 不卡格: {}, 加強行動: {}, 連續派遣: {} };
const add = (f, raw, why) => {
  const id = resolve(raw);
  if (!id) { unresolved.push(`${f}:${raw}:${why}`); return; }
  (fam[f][id] ||= new Set()).add(why);
};
const unresolved = [];

// 1) 減免資源：引擎表
const DISCOUNT_TABLES = [
  'ROOM_SET_PRICE_CARDS', 'ROOM_DISCOUNT_CARDS', 'ANY_BUILD_DISCOUNT_CARDS', 'ALT_BUILD_COST_CARDS', 'BUILD_COST_SWAP_CARDS',
  'RENOVATION_DISCOUNT_CARDS', 'STABLE_DISCOUNT_CARDS', 'FENCE_FREE_WOOD_CARDS', 'FREE_FENCE_CARD_IDS',
  'DEV_COST_DISCOUNT_CARDS', 'DEV_FOOD_DISCOUNT_CARDS',
];
for (const t of DISCOUNT_TABLES) {
  const { ids, span } = tableIds(t);
  for (const id of ids) add('減免資源', id, `${t}（${span}）`);
}

// 2) 不卡格：canIgnoreOccupied 白名單＋occupiedActionChoices 顯式選項（程式碼字串 vs 只在註解出現分開標）
for (const fn of ['canIgnoreOccupied', 'occupiedActionChoices']) {
  const { body } = fnBody(fn);
  const code = body.map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  const inCode = new Set(idsInText(code));
  for (const id of idsInText(body.join('\n'))) add('不卡格', id, inCode.has(id) ? `${fn}()` : `${fn}() 註解提及（程式碼沒直接比對這個 ID，可能走別的旗標或是反例）`);
}

// 3) 加強行動：引擎沒有單一表（巨人／巨石像／週日工作者各自硬寫）。0905 試過掃 play.js 註解同一行
//    有「兩次／兩倍」的卡，9 張全是雜訊（陶瓷鳥「換成雙」、大農莊「2 倍食物」），所以只靠卡文，
//    另外把引擎已知硬寫的三張錨定進 A 節。
for (const [id, why] of [['6105-6', '巨人：pendingGiantRepeat 派遣核心'], ['Cz20', '巨石像：pendingGiantRepeat 派遣核心'], ['WM048', '週日工作者：巨人同款重複行動']]) add('加強行動', id, why);

// 4) 卡文關鍵字（三類＋連續派遣）
const TEXT_RE = {
  減免資源: /減免|減少支付|少支付|少付|僅須支付|只須支付|只需支付|不須支付|不需支付|無須支付|無需支付|免費(建造|擴建|翻修|蓋|打出\d?張?(次要|主要|發展))|減少.{0,8}(費用|花費)|(費用|花費).{0,8}(減少|減免|可減)|支付.{0,6}較少|減少牌面費用/,
  不卡格: /即使.{0,14}佔據|即使.{0,14}佔領|(使用|派遣|派|進入).{0,10}已被.{0,6}佔據|視為未被佔|無視.{0,4}佔|不論.{0,12}佔據|無論.{0,12}佔據|被佔據時仍|被佔據.{0,4}仍可/,
  加強行動: /(執行|使用|進行|行動)(該格|該行動|此行動|上述|以下)?[^。，,]{0,6}(2|兩|二)次|(2|兩|二)倍|雙倍|再執行(1|一)次|額外執行(一|1)?次?/,
  連續派遣: /連續派遣|連續.{0,6}派遣|接著.{0,4}再派|派遣.{0,4}之後.{0,6}立刻/,
};
// 命中但一看就不是的（次數上限、倍數分數）：命中點前後 14 字視窗裡出現就丟掉
const TEXT_REJECT = {
  加強行動: /(遊戲中|每回合|一場遊戲|至多|最多|以下效果|以下能力|上述能力)[^。]{0,10}(2|兩|二)次|(2|兩|二)倍的?(勝利|紅利|分|數量)|轉換|兩倍，則/,
};
for (const c of cards) {
  const id = String(c['卡片ID'] ?? '').trim();
  const text = String(c['說明'] ?? '');
  for (const f of Object.keys(TEXT_RE)) {
    const m = text.match(TEXT_RE[f]);
    if (m && TEXT_REJECT[f] && TEXT_REJECT[f].test(text.slice(Math.max(0, m.index - 14), m.index + m[0].length + 14))) continue;
    if (m) add(f, id, `卡文【${m[0].replace(/\d+(\/\d+)*/g, 'N')}】「…${text.slice(Math.max(0, m.index - 8), m.index + m[0].length + 8).replace(/\s+/g, ' ')}…」`);
  }
}

// ── 出報表 ──
const isEngine = (why) => !why.startsWith('卡文');
const curTypes = (id) => (profile[id]?.types || []).join('／') || '—';
const desc = (id) => String(byId[id]?.['說明'] ?? '').replace(/\s+/g, ' ');
const row = (id, whys) => {
  const c = byId[id];
  return `- [ ] **${c['牌名']}**（${id}・${c['類型']}）　目前類型：${curTypes(id)}\n  來源：${[...whys].join('；')}\n  卡文：${desc(id)}`;
};
const md = [];
const stat = {};
const section = (title, f, filterFn, hint) => {
  const all = Object.entries(fam[f]).filter(([id]) => !excluded[id] && !excluded[id.replaceAll('*', '')]).filter(filterFn || (() => true));
  const eng = all.filter(([, w]) => [...w].some(isEngine));
  const txt = all.filter(([, w]) => ![...w].some(isEngine));
  const nExcl = Object.keys(fam[f]).length - all.length;
  stat[title] = { 引擎: eng.length, 只有卡文: txt.length, 已排除: nExcl };
  md.push(`## ${title}（引擎 ${eng.length} ＋ 只有卡文 ${txt.length}；排除卡已濾掉 ${nExcl}）`, '', `> ${hint}`, '');
  if (eng.length) { md.push(`### A. 引擎表裡有的（可信度高）`, ''); for (const [id, w] of eng.sort((a, b) => a[0].localeCompare(b[0]))) md.push(row(id, w)); md.push(''); }
  if (txt.length) {
    // 按命中的關鍵字分組，Lu 可以整組劃掉（例：「免費建造馬廄」那組是打出時送一棟，不是減免）
    const groups = {};
    for (const [id, w] of txt) { const key = ([...w][0].match(/【([^】]+)】/) || [])[1] || '其他'; (groups[key] ||= []).push([id, w]); }
    md.push(`### B. 只有卡文關鍵字命中（要看一眼；按關鍵字分組，可整組劃掉）`, '');
    for (const [key, rows] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
      md.push(`#### 「${key}」（${rows.length} 張）`, '');
      for (const [id, w] of rows.sort((a, b) => a[0].localeCompare(b[0]))) md.push(row(id, w));
      md.push('');
    }
  }
};
md.push(`# 農家樂 卡片類型 三個新類候選名單（${new Date().toISOString().slice(0, 10)}）`, '',
  '怎麼看：每一節先看 A（引擎裡登記在表的，多半對），再掃 B（只靠卡文關鍵字撈的，會有誤抓）。',
  '**回我要劃掉的卡名或 ID 就好**，其餘視為通過；通過的會做成 channels.json 的新頻道，再重跑 card-profile。',
  '「目前類型」是現在推導出來的，供你看這張卡從哪一類搬過來（「—」＝目前推不出）。', '');
section('一、減免資源', '減免資源', null, '定義：蓋房／翻修／馬廄／柵欄／打發展卡時少付資源。A 節是引擎 11 張減免表的 key；B 節是卡文有「減免／少付／免費」等字。');
section('二、不卡格', '不卡格', null, '定義：行動格已被佔據仍可派人。A 節來自 canIgnoreOccupied（常駐白名單）與 occupiedActionChoices（付費／單次的顯式選項）；「註解提及」那種是程式碼裡只出現在說明文字，多半是反例或走別的旗標，要看。');
section('三、加強行動', '加強行動', null, '定義：同一行動做兩次或貨物加倍。引擎沒有單一表（各卡硬寫），A 節只有引擎已知的三張錨點；B 節靠卡文，已濾掉「遊戲中使用 2 次」那類次數上限，剩下的仍會有誤抓，直接劃掉。');
section('四、連續派遣漏標（目前沒標「行動加速」）', '連續派遣', ([id]) => !(profile[id]?.types || []).includes('行動加速'), '定義維持＝連續派遣。這節是卡文寫連續派遣、但目前沒被歸到「行動加速」的卡（套索 B024* 那種漏標）。');
if (unresolved.length) md.push('## 附：引擎裡提到但 cards.json 對不到的 ID', '', ...unresolved.map((u) => `- ${u}`), '');
md.unshift(`統計：${Object.entries(stat).map(([k, v]) => `${k} 引擎 ${v.引擎}／只有卡文 ${v.只有卡文}`).join('；')}`, '');
md.splice(0, 0, md.splice(2, 1)[0]); // 標題移回第一行
fs.writeFileSync(OUT, md.join('\n'), 'utf8');
console.log(`✓ 寫出 ${OUT}`);
console.log(JSON.stringify(stat, null, 1));
if (unresolved.length) console.log(`對不到的 ID ${unresolved.length} 筆（已列在檔尾）`);
