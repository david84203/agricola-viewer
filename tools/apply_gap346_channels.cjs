/* ══════════════════════════════════════════════════
   卡片類型系統 工序 3（第十二節）：「—」346 張補頻道——把四份 sonnet 判讀落地

   規格：Dropbox 600_Project/烏嘎嘎桌遊/agricola-viewer/農家樂_卡片類型系統_規格_20260905.md 第十二節「落地順序」1～3
   輸入（Dropbox 同目錄，0907 sonnet 判讀，主對話抽驗＋退回重審過）：
     判讀A_疑漏標_結果_20260907.md   158 張有頻道但沒 get/cause → ①補 entry／②無產出不動／③判不出
     判讀B_沒頻道_結果_20260907.md   102 張 channels.json 沒收 → 建議標的（新增整張）／無可標／判不出
     判讀C_母層貨物_結果_20260907.md  43 張只掛母層 貨物·get → 第一種：換成葉頻道 get（from 沿用原 entry）／第二種與判不出：維持（規則層歸「任意貨物」）
     判讀D_改計分15張_結果_20260907.md 15 張 → 4 張 cards.json 紅利分數 無→有（翻卡圖裁定）
     頻道字彙表_20260907.md           46 條合法值；產出的每筆 entry 都對表驗，不准自創
   寫死：
     CONTAINER＝規格第十二節「此卡本身當動物容器」族（A ③ 9 張＋B 判不出 15 張＋B 無可標裡同機制 4 張）→ 比照飼育場 B011 標 圈地·attr[容量]；
              已有 馬廄／圈地 容量類 attr 的跳過（規則層已認得）
     EXTRA＝主對話比照同型卡補的 2 張（面具收藏家＝牧場領班「食客」→額外行動；編籃者＝木工坊建築工「建工坊」→打發展）
     ATTR／DIR＝判讀沒給、但字彙表要求的 attr（加強行動 attr、房間數 read 方向）

   做法：沿用 apply_round3_channels.cjs——純文字切塊，只重寫有動到的卡的 channels 區段；
         B 的新卡整塊 append 在檔尾（channels.json 順序本來就不是 cards.json 順序，append 最不動既有）；
         先用同一個 render 把全檔 channels 區段重畫一次比對原文，不是 byte 相同就中止。
         cards.json 只動那 4 張的 `"紅利分數": "無",` 一行，不 parse→stringify。

   用法：node tools/apply_gap346_channels.cjs [--dry] [--plan <md路徑>]
     --plan  把解析出的計畫（每張卡要加／換哪些 entry、信心、我的加碼）寫成 md 給人看
   ══════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const VIEWER = path.resolve(__dirname, '..');
const DROPBOX = 'D:/Dropbox/Lu_Agent/600_Project/烏嘎嘎桌遊/agricola-viewer';
const MD = {
  A: path.join(DROPBOX, '判讀A_疑漏標_結果_20260907.md'),
  B: path.join(DROPBOX, '判讀B_沒頻道_結果_20260907.md'),
  C: path.join(DROPBOX, '判讀C_母層貨物_結果_20260907.md'),
  D: path.join(DROPBOX, '判讀D_改計分15張_結果_20260907.md'),
  V: path.join(DROPBOX, '頻道字彙表_20260907.md'),
};
const CHANNELS = path.join(VIEWER, 'channels.json');
const CARDS = path.join(VIEWER, 'cards.json');
const EXCL = path.join(VIEWER, '..', 'agricola-online', 'exclusions_audit.json');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const PLAN_MD = argv.includes('--plan') ? argv[argv.indexOf('--plan') + 1] : null;
const die = (m) => { console.error('❌ 中止：' + m); process.exit(1); };
const S = (v) => JSON.stringify(v);

// ── 寫死的裁定 ──────────────────────────────────────────────────
// 「此卡本身當動物容器」族（規格第十二節判讀結果段）：46 條字彙沒有精確對應，比照飼育場 B011 標 圈地·attr[容量]，配合第 4 題規則歸動物養殖
const CONTAINER = {
  // A ③ 9 張（判讀 A 第二輪複核明列）＋網箱魚籠（① 另有 食物·get，容量部分判不出）
  'D148*': '馴養專家：房間空隙飼養 2 隻羊', E011: '寵物動物園：容納量＝房間板塊數', FR105: '改革家：每張職業卡容納 1 隻', G108: '牧羊犬：每格未使用區域 2 隻羊',
  '6157-5': '自用圈地：容納野豬牛＝羊數', '8680-2': '繁殖稻草：此卡居住 1 頭野豬', '5845-4': '休耕圈地：此卡無限羊', '4325-2': '依偎的豬：房屋＋圈外馬廄各 3 頭野豬',
  '8332-2': '穀物飼料：每塊已播種田 2 隻', '8524-3': '網箱魚籠：卡上每 1 食物容納 1 隻',
  // B 判不出裡的容器 15 張（判讀 B 複核後改判段明列 14 張＋動物魔術師）
  7254: '動物收容所：每張未建造主發容納 1 隻', A148: '羊毛工：容納＝已完成餵養階段數的羊', B012: '圍欄：容納 3 隻相同動物', B086: '松露搜索者：容納＝已完成餵養階段數的野豬',
  '舊版E58': '獸欄：圈養至多 2 隻', I102: '野生動物保留區：1 羊 1 豬 1 牛', K145: '林間牧地：任意數量野豬', '5335-5': '項圈鍊子：至多 2 隻相同動物',
  '5927-8': '牛棚：6 頭牛', '9284-8': '廢棄筒倉：4 羊或 3 豬', '11680-2': '開放式農舍：2 隻', '7013-2': '巴夫洛夫制約：無 VP 次發上各 1 隻',
  '6100-2': '忠心的動物：1 隻', '7014-5': '古生物學家：每剩餘收成階段 2 隻', '7255-6': '動物魔術師：依已打出卡數容納 8/5/3/2',
  // B 判「無可標」但機制跟 A ③ 的牧羊犬（未使用區域）／依偎的豬（房舍）一模一樣，同型同標
  // 0907 預審抓到、Lu 裁定「算」：主效果是別的，附帶「該區域／此卡可養 1 隻動物」
  11852: '獵犬的窩：放木頭的區域可飼養 1 隻動物', '8983-3': '鰻魚養殖場：該區域可容納 1 隻動物', WM057: '動物托兒所：新生動物可放到此卡上',
  FL063: '比利時牧羊犬：未使用區域 2 羊（同牧羊犬）', FR033: '兒童天地：房舍多容納 1 隻（同依偎的豬）', G071: '牛鈴：每格未使用區域 2 牛（同牧羊犬）', BI22: '抗爭歌手：每格未使用空地 1 隻（同牧羊犬）',
};
// 主對話比照同型卡加碼（判讀判「判不出」，但同批次已有同機制卡判出來了；列進校對檔給 Lu 看）
const EXTRA = {
  '9118-3': { add: [{ ch: '額外行動', role: ['cause'] }], why: '面具收藏家：付 2 食物拿 1 個食客＝多一次派遣，同牧場領班 12567（判①額外行動）' },
  C095: { add: [{ ch: '打發展', role: ['cause'], on: '行動' }], why: '編籃者：付石＋葦建造蘆葦工坊＝打主發，同木工坊建築工 9715／鐵皮屋工廠 12446-9（判①打發展）' },
  // 「其他玩家互動」堆 28 張沒人逐張判（Lu 裁定互動改卡文關鍵字），剔掉「傳給左手邊」那句後有 7 張傳遞卡掉回「—」；卡文的 get／cause 一看就有，比照 A ①補
  A003: { add: [{ ch: '打職業', role: ['cause'], on: '行動' }], why: '拆信刀：從手牌隨機打出 1 張職業卡不花費用' },
  B003: { add: [{ ch: '打職業', role: ['cause'], on: '行動' }], why: '月光酒：支付 2 食物打出隨機 1 張職業卡' },
  'B002*': { add: [{ ch: '圈柵欄', role: ['cause'], on: '行動' }, { ch: '減免資源', role: ['cause'] }], why: '迷你圈地：立即圈 1 格圈地、不須支付木頭' },
  FR056: { add: [{ ch: '麥子', role: ['get'], from: '供應' }, { ch: '蔬菜', role: ['get'], from: '供應' }], why: '澆水壺：已播種麥田菜田各再疊 1 個作物（同鳴響器 K127／花盆 I090 判①）' },
  G083: { add: [{ ch: '動物', role: ['get'], from: '供應' }], why: '度假禮物：棄乞討卡或從公用區拿任意 1 隻動物' },
  '7338-2': { add: [{ ch: '食物', role: ['get'], from: '供應' }], why: '梭哈：每棄 1 張手牌獲得 2 份食物' },
  // 迴力鏢 5807-15 純傳遞卡操作，沒有產出，留「—」
  // 校對檔第五節「資料打架」翻卡圖：懸賞金 7087-4 圖上明寫「此卡沒有紅利分數符號」＝頻道 分數·react+get 的 get 標錯，拿掉 get
  '7087-4': { fix: (e) => e.ch === '分數' && (e.role || []).includes('get'), to: { ch: '分數', role: ['react'], pool: '紅利分數' }, why: '懸賞金：卡圖明寫沒有紅利分數符號，分數只 react 不 get' },
  // 0907 預審 8 張 → Lu 裁定
  WA060: { fix: (e) => e.ch === '加強行動', to: { ch: '額外行動', role: ['cause'] }, why: '兩個孩子的媽：派到兩個不同格＝多一次派遣，不是同一行動做兩次（Lu：多一次派遣）' },
  '10846-3': { fix: (e) => e.ch === '圈柵欄', to: { ch: '額外行動', role: ['cause'] }, why: '獨輪駕駛者：柵欄放在行動格之間當道路移動人員，不是農莊圈柵欄（Lu：多一次派遣）' },
  WM070: { remove: (e) => ['打職業', '打發展'].includes(e.ch), why: '發條人：「視為職業卡與發展卡」只是給計數條件用，沒多打牌（Lu：不算連鎖）→ 留「—」' },
  '6940-2': { remove: (e) => e.ch === '打職業', why: '發條人專家：同發條人（Lu：不算連鎖）→ 留「—」' },
  WM022: { remove: (e) => e.ch === '貨物', add: ['磚頭', '蔬菜', '石頭', '麥子', '木頭', '蘆葦'].map((ch) => ({ ch, role: ['get'], from: '供應' })), why: '美食鑑賞家：堆疊每層指定種類（磚／菜／石／麥／木／葦），判讀 B 標母層貨物是標錯' },
};
// 校對檔第五節「資料打架」7 張翻卡圖（0907 主對話逐張看圖）：圖上有給分文字＋底部紅利分數符號的改「有」，同判讀 D 的判準
const BONUS_EXTRA = {
  I100: '客棧：你執行此行動可改為獲得 2 點紅利分數', BI07: '呂濱斯本紡織廠：支付建築資源換分 1 個 1 分', '5865-9': '醃肉：每轉換 1 頭野豬付 1 食物得 1 分紅利分數（最多 4）',
  '8271-6': '吃角子老虎機：擲 6 點獲得標記數的紅利分數', '8678-2': '向日葵農場：遊戲結束計分時每收割 1 個麥田 1 分紅利分數', '11992-4': '市場萎縮：遊戲結束計分時花食物購買紅利分數',
};
// 判讀沒給但字彙表要求的 attr
const ATTR = { '舊版E179': ['做兩次'] /* 商人：再執行該行動 1 次 */, WA060: ['加做行動'] /* 兩個孩子的媽：1 人派兩格＝多做一個行動 */ };
const DIR = { '11414-4': '無方向' /* 基因研究員：動物種類數 > 房間數，是比較不是多或少 */ };

// ── 字彙表 ─────────────────────────────────────────────────────
const vocab = {};
for (const line of fs.readFileSync(MD.V, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\| (\S+) \| \d+ \| ([^|]*)\| ([^|]*)\| ([^|]*)\| ([^|]*)\| ([^|]*)\|$/);
  if (!m) continue;
  const cut = (s) => s.trim().split(/\s+/).filter(Boolean);
  vocab[m[1]] = { role: cut(m[2]), attr: cut(m[3]), on: cut(m[4]), from: cut(m[5]), pool: cut(m[6]) };
}
if (Object.keys(vocab).length !== 46) die(`字彙表應 46 條，讀到 ${Object.keys(vocab).length}`);
const RES = new Set(['食物', '木頭', '磚頭', '石頭', '蘆葦', '建築資源', '麥子', '蔬菜', '作物', '羊', '野豬', '牛', '動物', '貨物']);
const ACT = new Set(['犁田', '播種', '打職業', '打發展', '擴建房舍', '圈柵欄', '翻修房舍', '增加家庭成員', '收割', '蓋馬廄', '烤麵包']);
const STATE = new Set(['居住空間', '餵養', '圈地', '馬廄', '房舍材質']);
function validate(id, e) {
  const v = vocab[e.ch] || die(`${id} 頻道不在字彙表：${S(e)}`);
  for (const r of e.role || []) if (!v.role.includes(r)) die(`${id} ${e.ch} 不准 role ${r}：${S(e)}`);
  for (const a of e.attr || []) if (!v.attr.includes(a)) die(`${id} ${e.ch} 不准 attr ${a}：${S(e)}`);
  if (e.on && !v.on.includes(e.on)) die(`${id} ${e.ch} 不准 on ${e.on}：${S(e)}`);
  if (e.from && !v.from.includes(e.from)) die(`${id} ${e.ch} 不准 from ${e.from}：${S(e)}`);
  if (e.pool && !v.pool.includes(e.pool)) die(`${id} ${e.ch} 不准 pool ${e.pool}：${S(e)}`);
  const keys = Object.keys(e); const want = ['ch', 'role', 'attr', 'on', 'from', 'pool'].filter((k) => k in e);
  if (S(keys) !== S(want)) die(`${id} entry key 順序不對：${S(e)}`);
  return e;
}

// ── 判讀 token → entry ─────────────────────────────────────────
// 判讀寫法五花八門：`動物·get(繁殖/任意)`、`木頭·get·from場格`、`分數·get[改計分](紅利分數)`、`減免資源·cause[替代]`、`居住空間·提供`、`餵養·attr免除`
function parseToken(id, tok) {
  const t = tok.trim().replace(/\s+/g, '');
  const m = t.match(/^([^·(\[]+)·(get|react|pay|read|cause|bind|attr[^·(\[]+|提供|免空|免除)(.*)$/);
  if (!m) die(`${id} 看不懂 token：${S(tok)}`);
  const ch = m[1]; let role = m[2]; const rest = m[3];
  const paren = (rest.match(/\(([^)]+)\)/) || [])[1];
  const bracket = (rest.match(/\[([^\]]+)\]/) || [])[1];
  const from = (rest.match(/·from([^·(\[]+)/) || [])[1];
  const on = (rest.match(/·on([^·(\[]+)/) || [])[1];
  const leftover = rest.replace(/\([^)]+\)|\[[^\]]+\]|·from[^·(\[]+|·on[^·(\[]+/g, '');
  if (leftover) die(`${id} token 有看不懂的尾巴 ${S(leftover)}：${S(tok)}`);
  let stateAttr = null;
  if (role.startsWith('attr')) { stateAttr = role.slice(4); role = null; } else if (['提供', '免空', '免除'].includes(role)) { stateAttr = role; role = null; }
  let e;
  if (stateAttr !== null || STATE.has(ch)) {
    if (!stateAttr) die(`${id} 狀態型頻道要給 attr：${S(tok)}`);
    e = { ch, role: [], attr: [stateAttr] };
  } else if (RES.has(ch)) {
    const norm = (v) => (v === '繁殖/任意' ? '繁殖' : v);
    if (role === 'get') e = { ch, role: ['get'], from: norm(from || paren || '供應') };
    else if (role === 'react') e = { ch, role: ['react'], from: norm(from || paren || '場格') };
    else if (role === 'pay' || role === 'read') e = { ch, role: [role] }; // 全檔 pay／read 都不帶 from
    else die(`${id} 資源頻道不接 ${role}：${S(tok)}`);
  } else if (ACT.has(ch)) {
    if (!['cause', 'react'].includes(role)) die(`${id} 行動頻道不接 ${role}：${S(tok)}`);
    e = { ch, role: [role], on: on || paren || '行動' };
  } else if (ch === '額外行動' || ch === '不卡格' || ch === '封田') e = { ch, role: ['cause'] };
  else if (ch === '加強行動') e = { ch, role: ['cause'], attr: ATTR[id] || die(`${id} 加強行動要指定 attr（做兩次／加做行動），寫進 ATTR`) };
  else if (ch === '減免資源') { e = { ch, role: ['cause'] }; if (bracket === '替代') e.attr = ['替代']; else if (bracket) die(`${id} 減免資源 attr 不認得 ${bracket}`); }
  else if (ch === '分數') e = { ch, role: ['get'], pool: paren || '紅利分數' }; // 全檔 分數·get 都是 ch/role/pool，不帶 attr
  else if (ch === '負分') die(`${id} 負分頻道判讀不該出現：${S(tok)}`);
  else if (['房間數', '家庭人數'].includes(ch)) e = { ch, role: ['read'], attr: [DIR[id] || die(`${id} ${ch}·read 要方向 attr，寫進 DIR`)] };
  else if (['手牌', '職業數', '發展數', '已播種田', '空田', '乞討'].includes(ch)) e = { ch, role: [role] };
  else die(`${id} 不知道怎麼組這個頻道：${S(tok)}`);
  // key 順序 ch, role, attr, on, from, pool（跟全檔一致）
  const ordered = {}; for (const k of ['ch', 'role', 'attr', 'on', 'from', 'pool']) if (k in e) ordered[k] = e[k];
  return validate(id, ordered);
}

// ── 讀判讀表 ───────────────────────────────────────────────────
function readTable(file, cols) {
  const rows = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.startsWith('| ')) continue;
    const cells = line.slice(1, -1).split('|').map((s) => s.trim());
    if (cells.length !== cols || cells[0] === '卡片ID' || /^-+$/.test(cells[0])) continue;
    rows.push(cells);
  }
  return rows;
}
const A = readTable(MD.A, 6), B = readTable(MD.B, 6), C = readTable(MD.C, 6), D = readTable(MD.D, 6);
if (A.length !== 158) die(`判讀 A 應 158 列，讀到 ${A.length}`);
if (B.length !== 102) die(`判讀 B 應 102 列，讀到 ${B.length}`);
if (C.length !== 43) die(`判讀 C 應 43 列，讀到 ${C.length}`);
if (D.length !== 15) die(`判讀 D 應 15 列，讀到 ${D.length}`);
const splitTokens = (s) => s.split(/[、；;]|,\s*/).map((x) => x.trim()).filter((x) => x && x !== '—');

// ── channels.json 切塊（沿用 apply_round3） ────────────────────────
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
const newBlock = (id, name, entries) => ({ key: id, lines: [` ${S(id)}: {`, `  "牌名": ${S(name)},`, ...renderRegion(entries, false), ' },'] });

const original = fs.readFileSync(CHANNELS);
const text = original.toString('utf8');
const { eol, blocks } = splitBlocks(text);
if (eol !== '\r\n') die('換行不是 CRLF，跟原檔約定不符');
if (!Buffer.from(joinBlocks(eol, blocks), 'utf8').equals(original)) die('自檢 1 失敗：零改動重建不是 byte 相同');
const oldJson = JSON.parse(text);
const byKey = {}; blocks.forEach((b) => { byKey[b.key] = b; });
const origBlockKeys = blocks.map((b) => b.key);
let badFmt = 0;
for (const b of blocks) {
  const r = channelsRange(b.lines) || die(`${b.key} 找不到 channels 區段`);
  const orig = b.lines.slice(r[0], r[1] + 1);
  const re = renderRegion(oldJson[b.key].channels, b.lines[r[1]] === '  ],');
  if (S(orig) !== S(re)) { badFmt++; if (badFmt <= 3) console.log(`格式不合：${b.key}\n  原 ${S(orig).slice(0, 200)}\n  畫 ${S(re).slice(0, 200)}`); }
}
if (badFmt) die(`自檢 2 失敗：${badFmt} 張卡的 channels 區段重畫後跟原文不同`);
console.log(`切塊自檢 ✅　${blocks.length} 張卡，零改動 byte 相同；channels 區段重畫全檔一致`);

// ── 組計畫 ─────────────────────────────────────────────────────
const cards = JSON.parse(fs.readFileSync(CARDS, 'utf8'));
const cardById = Object.fromEntries(cards.map((c) => [String(c['卡片ID'] ?? '').trim(), c]));
const excluded = (fs.existsSync(EXCL) ? JSON.parse(fs.readFileSync(EXCL, 'utf8')).excluded : null) || die('找不到排除卡名單（先到 agricola-online 跑 node audit_exclusions.cjs --json）');
const plan = {}; const planNote = {}; const newCards = []; const stat = {}; const warn = [];
const count = (k, n = 1) => { stat[k] = (stat[k] || 0) + n; };
const note = (id, s) => { (planNote[id] ||= []).push(s); };
const sameEntry = (a, b) => a.ch === b.ch && S(a.role || []) === S(b.role || []);
function entriesOf(id) {
  if (plan[id]) return plan[id];
  if (oldJson[id]) return (plan[id] = oldJson[id].channels.map((e) => ({ ...e })));
  const card = cardById[id] || die(`cards.json 沒有這張卡：${id}`);
  newCards.push({ id, name: card['牌名'] });
  return (plan[id] = []);
}
function addEntry(id, e, src) {
  const list = entriesOf(id);
  if (!e.role.length) { // 狀態型：同頻道已有就併 attr
    const ex = list.find((x) => x.ch === e.ch && !(x.role || []).length);
    if (ex) { if (ex.attr.includes(e.attr[0])) { warn.push(`${id} 已有 ${S(e)}，跳過`); return false; } ex.attr = [...ex.attr, ...e.attr]; count(`${src} 併 attr`); note(id, `${src} 併 ${e.ch}·[${e.attr}]`); return true; }
  }
  if (list.some((x) => sameEntry(x, e))) { warn.push(`${id} 已有 ${S(e)}，跳過`); return false; }
  list.push(e); count(`${src} 加`); note(id, `${src} 加 ${e.ch}·${e.role.join('+')}${e.attr ? '[' + e.attr + ']' : ''}${e.on ? '(on ' + e.on + ')' : ''}${e.from ? '(from ' + e.from + ')' : ''}${e.pool ? '(' + e.pool + ')' : ''}`);
  return true;
}
const lowConf = []; // 信心「低」的，校對檔列給 Lu
// A：① 補 entry
for (const [id, name, cls, ent, , conf] of A) {
  if (!cls.startsWith('①')) { count(cls.startsWith('②') ? 'A ②不動' : 'A ③判不出'); continue; }
  for (const tok of splitTokens(ent)) addEntry(id, parseToken(id, tok), 'A');
  if (/低/.test(conf)) lowConf.push(`${name}（${id}）A：${ent}`);
}
// B：建議標的（多半是整張新卡）
for (const [id, name, cls, ent, , conf] of B) {
  if (cls !== '建議標的') { count(cls === '無可標' ? 'B 無可標不動' : 'B 判不出'); continue; }
  for (const tok of splitTokens(ent)) addEntry(id, parseToken(id, tok), 'B');
  if (/^低/.test(conf)) lowConf.push(`${name}（${id}）B：${ent}`);
}
// C：第一種＝把 貨物·get 換成葉頻道 get（from 沿用）；其餘維持
for (const [id, name, cls, ent, , conf] of C) {
  if (cls !== '第一種') { count(cls === '第二種' ? 'C 維持母層' : 'C 判不出維持'); continue; }
  const list = entriesOf(id);
  const i = list.findIndex((e) => e.ch === '貨物' && (e.role || []).includes('get'));
  if (i < 0) die(`${id} 沒有 貨物·get，判讀 C 對不上`);
  const from = list[i].from;
  list.splice(i, 1); count('C 拿掉 貨物·get'); note(id, `C 拿掉 貨物·get(from ${from})`);
  for (const tok of splitTokens(ent)) {
    const e = parseToken(id, tok);
    if (!e.role.includes('get') || !RES.has(e.ch) || e.ch === '貨物') die(`${id} 判讀 C 只該給葉頻道 get：${S(tok)}`);
    e.from = from; addEntry(id, validate(id, e), 'C');
  }
  if (/中/.test(conf)) lowConf.push(`${name}（${id}）C 信心中：${ent}`);
}
// 容器族：圈地·attr[容量]；已有 馬廄／圈地 容量類 attr 的跳過
for (const id in CONTAINER) {
  const list = entriesOf(id);
  const covered = list.some((e) => ['馬廄', '圈地'].includes(e.ch) && (e.attr || []).some((a) => a === '容量' || a === '容量大'));
  if (covered) { count('容器 已有容量 attr 跳過'); note(id, `容器族：已有 馬廄／圈地 容量 attr，不動（${CONTAINER[id]}）`); continue; }
  if (addEntry(id, validate(id, { ch: '圈地', role: [], attr: ['容量'] }), '容器')) note(id, `　↳ ${CONTAINER[id]}`);
}
for (const id in EXTRA) {
  if (EXTRA[id].remove) { const list = entriesOf(id); const before = list.length; for (let i = list.length - 1; i >= 0; i--) if (EXTRA[id].remove(list[i])) list.splice(i, 1); if (list.length === before) die(`${id} 找不到要刪的 entry`); count('加碼 刪', before - list.length); note(id, `加碼 刪 ${before - list.length} 筆`); }
  for (const e of EXTRA[id].add || []) addEntry(id, validate(id, e), '加碼');
  if (EXTRA[id].fix) { const list = entriesOf(id); const i = list.findIndex(EXTRA[id].fix); if (i < 0) die(`${id} 找不到要修的 entry`); list[i] = validate(id, EXTRA[id].to); count('加碼 修'); note(id, `加碼 修 → ${S(EXTRA[id].to)}`); }
  note(id, `　↳ ${EXTRA[id].why}`);
}

// ── 守門 ───────────────────────────────────────────────────────
const touched = Object.keys(plan).filter((id) => !oldJson[id] ? plan[id].length > 0 : S(plan[id]) !== S(oldJson[id].channels));
const bad = touched.filter((id) => excluded[id] || excluded[id.replaceAll('*', '')]);
if (bad.length) die(`混到排除卡：${bad.join('、')}`);
for (const id of touched) for (const e of plan[id]) validate(id, e);
const emptyNew = newCards.filter((c) => !plan[c.id].length && !(EXTRA[c.id] || {}).remove).map((c) => c.id); // Lu 裁定刪光的（發條人×2）本來就該留「—」
if (emptyNew.length) die(`新卡沒 entry 卻被建了：${emptyNew}`);

// ── 寫回 channels.json 文字層 ─────────────────────────────────────
for (const id of touched) {
  if (!byKey[id]) continue;
  const b = byKey[id]; const r = channelsRange(b.lines);
  b.lines.splice(r[0], r[1] - r[0] + 1, ...renderRegion(plan[id], b.lines[r[1]] === '  ],'));
}
const appended = newCards.filter((c) => touched.includes(c.id));
for (const c of appended) blocks.push(newBlock(c.id, c.name, plan[c.id]));
const out = joinBlocks(eol, blocks);
let parsedOut;
try { parsedOut = JSON.parse(out); } catch (err) { die('產出不是合法 JSON：' + err.message); }
if (S(blocks.slice(0, origBlockKeys.length).map((b) => b.key)) !== S(origBlockKeys)) die('既有卡片順序變了');
const touchedSet = new Set(touched);
for (const id in oldJson) {
  if (!parsedOut[id]) die(`產出少了 ${id}`);
  if (oldJson[id].牌名 !== parsedOut[id].牌名) die(`${id} 牌名變了`);
  if (S(oldJson[id].effects) !== S(parsedOut[id].effects)) die(`${id} effects 變了`);
  if (!touchedSet.has(id) && S(oldJson[id].channels) !== S(parsedOut[id].channels)) die(`沒計畫動的卡被動到：${id}`);
  if (touchedSet.has(id) && S(plan[id]) !== S(parsedOut[id].channels)) die(`${id} 寫回結果跟計畫不同`);
}
for (const c of appended) { if (S(parsedOut[c.id]) !== S({ 牌名: c.name, channels: plan[c.id] })) die(`新卡 ${c.id} 寫回結果跟計畫不同`); }
if (Object.keys(parsedOut).length !== Object.keys(oldJson).length + appended.length) die('卡片張數對不上');
// 再切一次、再畫一次，確保新檔也過得了自己的格式守門（下一場才不會在自檢 2 卡住）
{ const { blocks: b2 } = splitBlocks(out); for (const b of b2) { const r = channelsRange(b.lines); if (S(b.lines.slice(r[0], r[1] + 1)) !== S(renderRegion(parsedOut[b.key].channels, b.lines[r[1]] === '  ],'))) die(`新檔重畫不一致：${b.key}`); } }

// ── cards.json：D 的 4 張 紅利分數 無→有（文字層，只動那一行） ─────────
const bonusD = D.filter((r) => /改為有/.test(r[4])).map((r) => r[0]);
if (bonusD.length !== 4) die(`判讀 D「改為有」應 4 張，讀到 ${bonusD.length}：${bonusD}`);
const bonusIds = [...bonusD, ...Object.keys(BONUS_EXTRA)];
if (new Set(bonusIds).size !== bonusIds.length) die('紅利分數名單有重複');
const cardsOrig = fs.readFileSync(CARDS);
const cardsText = cardsOrig.toString('utf8');
const ceol = cardsText.includes('\r\n') ? '\r\n' : '\n';
const clines = cardsText.split(ceol);
const bonusChanged = [];
for (const id of bonusIds) {
  const i = clines.findIndex((l) => l === `    "卡片ID": ${S(id)},`);
  if (i < 0) die(`cards.json 找不到 ${id}`);
  // 欄位順序每張不一樣（有的 紅利分數 在 卡片ID 前面），整塊掃：往上找 `  {`、往下找 `  },`／`  }`
  let s = i; while (s > 0 && clines[s] !== '  {') s--;
  let j = s; const hits = [];
  while (j < clines.length && clines[j] !== '  },' && clines[j] !== '  }') { if (clines[j] === '    "紅利分數": "無",') hits.push(j); j++; }
  if (hits.length !== 1) die(`${id} 區塊裡 紅利分數 "無" 找到 ${hits.length} 行（要恰好 1）`);
  clines[hits[0]] = '    "紅利分數": "有",';
  bonusChanged.push(id);
}
const cardsOut = clines.join(ceol);
{ const a = JSON.parse(cardsText), b = JSON.parse(cardsOut);
  if (a.length !== b.length) die('cards.json 張數變了');
  a.forEach((c, i) => { const d = b[i]; const ks = new Set([...Object.keys(c), ...Object.keys(d)]);
    for (const k of ks) if (S(c[k]) !== S(d[k])) { if (!(k === '紅利分數' && bonusIds.includes(String(c['卡片ID']).trim()) && c[k] === '無' && d[k] === '有')) die(`cards.json ${c['卡片ID']} 的 ${k} 不該變`); } }); }

// ── 報告 ───────────────────────────────────────────────────────
const oldN = Object.values(oldJson).reduce((s, c) => s + c.channels.length, 0);
const newN = Object.values(parsedOut).reduce((s, c) => s + c.channels.length, 0);
console.log(`計畫：${Object.entries(stat).map(([k, v]) => `${k} ${v}`).join('／')}`);
console.log(`動到 ${touched.length} 張卡（既有 ${touched.length - appended.length}＋新卡 ${appended.length}）；entry ${oldN} → ${newN}（+${newN - oldN}）`);
console.log(`cards.json 紅利分數 無→有：${bonusChanged.join('、')}`);
if (warn.length) console.log(`⚠ 跳過：\n  ${warn.join('\n  ')}`);
if (PLAN_MD) {
  const md = ['# 「—」346 張補頻道 落地計畫（腳本 tools/apply_gap346_channels.cjs 解析結果）', '', `- 動到 ${touched.length} 張卡（既有 ${touched.length - appended.length}＋新卡 ${appended.length}）；entry +${newN - oldN}`, `- cards.json 紅利分數 無→有：${bonusChanged.join('、')}`, `- 統計：${Object.entries(stat).map(([k, v]) => `${k} ${v}`).join('／')}`, '', '## 每張卡的改動', ''];
  for (const id of touched) md.push(`- **${(oldJson[id] || cardById[id] || {}).牌名 || cardById[id]?.['牌名']}**（${id}）${oldJson[id] ? '' : '　🆕 新卡'}\n  ${(planNote[id] || []).join('；')}`);
  md.push('', `## 信心低／中（判讀自己標的，共 ${lowConf.length}）`, '', ...lowConf.map((s) => `- ${s}`));
  md.push('', '## 主對話的加碼（判讀沒判出來、我比照同型卡補的）', '', ...Object.entries(CONTAINER).map(([id, why]) => `- 容器族 圈地·[容量]：${why}（${id}）`), ...Object.entries(EXTRA).map(([id, x]) => `- ${x.why}（${id}）`));
  md.push('', '## cards.json 紅利分數 無→有', '', ...bonusD.map((id) => `- 判讀 D 翻卡圖：${cardById[id]['牌名']}（${id}）`), ...Object.entries(BONUS_EXTRA).map(([id, why]) => `- 校對檔第五節翻卡圖：${why}（${id}）`));
  fs.writeFileSync(PLAN_MD, md.join('\n') + '\n', 'utf8');
  console.log(`→ ${PLAN_MD}`);
}
if (DRY) { console.log('--dry：不寫檔'); process.exit(0); }
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
fs.writeFileSync(path.join(VIEWER, `channels.backup_${stamp}_pre-gap346.json`), original);
fs.writeFileSync(CHANNELS, out, 'utf8');
fs.writeFileSync(CARDS, cardsOut, 'utf8');
console.log(`✅ 已寫入 channels.json（備份 channels.backup_${stamp}_pre-gap346.json）與 cards.json`);
