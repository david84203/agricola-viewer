#!/usr/bin/env node
/* eslint-disable no-console */
/*
   卡片類型系統 工序 3.6：撈「加強行動」第二族——「用某個行動格時，多做一個行動」的候選名單
   → 出一份 md 給 Lu 劃掉錯的（Lu 0906 把加強行動定義擴成「做兩次／加倍 ＋ 用某格多做一個行動」；
     「用某格多拿一份貨」不算）。

   為什麼不從 channels.json 撈：0906 實測「on: 行動 ＋ cause 行動類頻道」命中 737 張，一半是減免與
   打出時一次性效果（南瓜補丁、埃及神賽特…），而石頭商人 G052 那種只標了 react 完全撈不到——
   `on: 行動` 在原料層只是「行動類頻道」的記號，不是「被行動觸發」。訊號在卡文句型：
     觸發：「每當／每次 你 使用／執行 某行動格（或打出某卡、以行動取得某貨）時」
     後果：同一句裡出現行動動詞（執行／犁／播種／烤麵包／擴建／建造／翻修／打出…張／圈柵欄／馬廄／增加家庭成員）
   兩者都中才算候選；後果只有「獲得／拿取」貨物的自然落選（＝多拿一份貨那族）。

   用法：node tools/extract_extra_action_candidates.cjs [--out <md>] [--exclusions <json>]
   輸入：cards.json、card-profile.json（目前類型）、exclusions_audit.json（排除卡 379）
   輸出：md 一份（預設寫到 Dropbox 600_Project/烏嘎嘎桌遊/agricola-viewer/）。只讀不改任何 json。
*/
const fs = require('fs');
const path = require('path');

const VIEWER = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const argOf = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const EXCL = path.resolve(argOf('--exclusions') || path.join(VIEWER, '..', 'agricola-online', 'exclusions_audit.json'));
const OUT = path.resolve(argOf('--out') || 'D:/Dropbox/Lu_Agent/600_Project/烏嘎嘎桌遊/agricola-viewer/農家樂_卡片類型_加強行動第二族候選_20260906.md');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
if (!fs.existsSync(EXCL)) { console.error(`✗ 找不到排除卡名單 ${EXCL}（跑 agricola-online 的 audit_exclusions.cjs --json）`); process.exit(1); }

const cards = readJson(path.join(VIEWER, 'cards.json'));
const profile = readJson(path.join(VIEWER, 'card-profile.json'));
const excluded = readJson(EXCL).excluded || {};
const isExcluded = (id) => Boolean(excluded[id] || excluded[id.replaceAll('*', '')]);

// ── 裁定檔第三節已經定過的（不再問；列在檔尾供對照）──
const RULED_KEEP = new Set(['6105-6', 'Cz20', 'WM048', '6971-5', '9675-3', '10520-2', 'Cz21', 'G056', 'A024*', 'B025*', 'B108*', 'A073']);
const RULED_DROP_NAMES = new Set(['果食者', '資本家', '飽食家庭', '犯罪編號24601', '起司商人', '都市重建', '獎勵金', '羊群與牧羊人', '地主']);

// ── 句型 ──
// 觸發：每當／每次／當 … 使用／執行／派遣／以行動／以家庭成員 … 行動格／行動
const TRIG_USE = /(每當|每次|每回合|當|只要|在你)[^。]{0,10}?(使用|執行|派遣[^。]{0,12}?(至|到|執行|前往)|以行動|以家庭成員|藉由[^。]{0,6}?行動)[^。]{0,32}?(累積行動格|行動格|行動)/;
// 觸發：每（當你）打出 … 職業卡／發展卡
const TRIG_PLAY = /(每當|每次|每|當)[^。]{0,6}?打出[^。]{0,10}?(職業卡|發展卡|次要發展卡|主要發展卡|職業|發展)/;
// 觸發：每當你以行動取得／獲得 某貨（石頭商人那型）
const TRIG_TAKE = /(每當|每次|當)你[^。]{0,8}?(以行動|藉由行動|透過行動|從[^。]{0,8}?行動格|使用[^。]{0,10}?累積)[^。]{0,10}?(取得|獲得|拿取|收集)/;
// 後果：行動動詞（只有「獲得／拿」貨物的不算）
const CONSEQ = /(執行[^。]{0,4}?(「|1次|一次|1個|一個|額外)|犁\d?塊?田?|犁田|播種|烤麵包|烤成麵包|擴建|建造|建設|翻修|打出\d?[張]?[^。]{0,6}?(職業|發展|卡)|圈(上|起|地|入)|柵欄|馬廄|增加家庭成員|收割|(另|再|多)[^。]{0,4}?(一|1)次)/;

const sentences = (t) => String(t || '').replace(/\s+/g, ' ').split(/(?<=[。；])/).map((s) => s.trim()).filter(Boolean);

// 分組鍵：讓 Lu 可以整組劃掉。行動格名稱寫法不一（「犁1塊農田」「犁一塊田」『犁1塊田』…），收斂成標準格名
const GOODS = /木頭|磚|蘆葦|石頭|羊|野豬|牛|麥子|蔬菜|小麥|穀物|食物|建築資源|動物/;
function canon(name) {
  if (/臨時工/.test(name)) return '臨時工';
  if (/犁/.test(name)) return /播種/.test(name) ? '犁田（含犁田和/或播種）' : '犁田';
  if (/播種|烤麵包/.test(name)) return '播種／烤麵包';
  if (/職業/.test(name)) return '打職業格（用該格時）';
  if (/發展/.test(name)) return '打發展格（用該格時）';
  if (/擴建/.test(name)) return '擴建房舍';
  if (/馬廄/.test(name)) return '蓋馬廄';
  if (/柵欄/.test(name)) return '圈柵欄';
  if (/翻修/.test(name)) return '翻修房舍';
  if (/增加家庭成員/.test(name)) return '增加家庭成員';
  if (/賣藝|寶藝/.test(name)) return '賣藝';
  if (/釣魚/.test(name)) return '釣魚';
  if (/起始玩家/.test(name)) return '起始玩家';
  if (GOODS.test(name)) return '拿貨的累積格（木／磚／蘆／石／羊／豬／牛／麥／菜）';
  return null;
}
function groupOf(sent, trig, trigText) {
  if (/臨時工/.test(trigText)) return '臨時工';
  if (trig === 'PLAY') return (/職業/.test(trigText) ? '打職業（打出職業卡時）' : '打發展（打出發展卡時）');
  if (trig === 'TAKE') return '拿貨的累積格（木／磚／蘆／石／羊／豬／牛／麥／菜）';
  const q = trigText.match(/[「『]([^」』]{1,16})[」』]/);
  if (q) { const k = canon(q[1]); if (k) return k; return `「${q[1]}」`; }
  if (/累積行動格/.test(trigText) && GOODS.test(trigText)) return '拿貨的累積格（木／磚／蘆／石／羊／豬／牛／麥／菜）';
  if (/累積行動格/.test(trigText)) return '任一累積行動格';
  return '任一行動（泛用）';
}

const hits = {}; // id → {group, sent}
const anchorsExpect = ['G052', 'A023', 'B091*', 'B087*', '9649', 'G097', 'G110', 'A024*', 'B025*', 'B108*', 'A073'];
for (const c of cards) {
  const id = String(c['卡片ID'] ?? '').trim();
  if (!id || isExcluded(id)) continue;
  for (const s of sentences(c['說明'])) {
    let trig = null;
    let m = s.match(TRIG_USE); if (m) trig = 'USE';
    if (!trig) { m = s.match(TRIG_PLAY); if (m) trig = 'PLAY'; }
    if (!trig) { m = s.match(TRIG_TAKE); if (m) trig = 'TAKE'; }
    if (trig) {
      const rest = s.slice(m.index + m[0].length);
      if (CONSEQ.test(rest) && !hits[id]) hits[id] = { group: groupOf(s, trig, m[0]), sent: s };
    }
  }
}

// ── 出報表 ──
const byId = {}; for (const c of cards) byId[String(c['卡片ID']).trim()] = c;
const curTypes = (id) => (profile[id]?.types || []).join('／') || '—';
const desc = (id) => String(byId[id]?.['說明'] ?? '').replace(/\s+/g, ' ');
const ruled = (id) => RULED_KEEP.has(id) || RULED_DROP_NAMES.has(byId[id]?.['牌名']);
const row = (id, why) => `- [ ] **${byId[id]['牌名']}**（${id}・${byId[id]['類型']}）　目前類型：${curTypes(id)}\n  命中句：${why}\n  卡文：${desc(id)}`;

const cand = Object.entries(hits).filter(([id]) => !ruled(id));
const groups = {};
for (const [id, h] of cand) (groups[h.group] ||= []).push([id, h.sent]);
const ruledHit = Object.keys(hits).filter(ruled);

const md = [];
md.push(`# 農家樂 卡片類型 加強行動第二族候選（用某格多做一個行動）（${new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)}）`, '',
  `統計：候選 ${cand.length} 張（分 ${Object.keys(groups).length} 組）；已裁定不重列 ${ruledHit.length} 張；排除卡已濾。`, '',
  '怎麼看：撈法是卡文句型「每當你使用某格／打出某卡／以行動取得某貨時 → 同一句有行動動詞（執行／犁／播種／烤／擴建／建造／翻修／打出…張／圈柵欄／馬廄／增加家庭成員）」。',
  '「用某格多拿一份貨」的卡（後果只有獲得／拿取）已自然落選；但同一句同時有「拿貨」和「做行動」的會進來（魚肉餡餅那種），要看。',
  '按觸發格分組，整組不算就整組劃。**回我要劃掉的卡名或 ID 就好**，其餘視為通過，通過的做成「加強行動」頻道 entry。',
  '「目前類型」是現在推導的，供你看它從哪一類搬過來（「—」＝目前推不出）。', '');
md.push(`## 一、候選（${cand.length} 張，按觸發格分組）`, '');
for (const [key, rows] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
  md.push(`### ${key}（${rows.length} 張）`, '');
  for (const [id, sent] of rows.sort((a, b) => a[0].localeCompare(b[0]))) md.push(row(id, sent));
  md.push('');
}
md.push(`## 附：裁定檔已定、這次句型也有撈到的（${ruledHit.length} 張，不用再看，只證明撈法有抓到錨點）`, '',
  ...ruledHit.sort().map((id) => `- ${byId[id]['牌名']}（${id}）${RULED_KEEP.has(id) ? '留' : '劃掉'}`), '');

fs.writeFileSync(OUT, md.join('\n'), 'utf8');
console.log(`✓ 寫出 ${OUT}`);
console.log(`候選 ${cand.length}／組數 ${Object.keys(groups).length}／已裁定命中 ${ruledHit.length}`);
for (const [k, v] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) console.log(`  ${k}: ${v.length}`);
const miss = anchorsExpect.filter((a) => !hits[a]);
console.log(miss.length ? `✗ 錨點沒撈到：${miss.join('、')}` : `✓ 錨點 ${anchorsExpect.length} 張全撈到`);
