/* ══════════════════════════════════════════════════
   卡片類型系統 工序 3：從 channels.json 推導每張卡的
   「類型／路線／代價／combo」→ card-profile.json

   規格：Dropbox 600_Project/烏嘎嘎桌遊/agricola-viewer/農家樂_卡片類型系統_規格_20260905.md
        第三～七節（判定規則全在那裡，改規則先改規格再改這裡）。

   用法：node tools/build_card_profile.cjs [--report <md路徑>] [--exclusions <json路徑>] [--dry]
     --report      另出抽樣校對檔（每類 N 張＋「—」全列）給 Lu 掃；--sample N 預設 10
     --exclusions  排除卡名單，預設 ../agricola-online/exclusions_audit.json
                   （一定要先跑 agricola-online 的 audit_exclusions.cjs --json，不可手打）
     --dry         只印統計不寫檔

   輸入：channels.json（工序 1 之後的形狀 {ch, role, attr?, on?, from?, pool?}）
        cards.json ＋ reference-cards.json（主發 10 張）
        card-profile-overrides.json（人工覆寫，沒有就當空；`_` 開頭的 key 忽略）
   輸出：card-profile.json  一張卡一行，順序照 cards.json → reference-cards.json，重跑 diff 才看得懂

   規則摘要（細節見規格）：
   - 類型只看 role 含 get／cause（bind 視同 cause）；母層 貨物 一律忽略，
     建築資源／作物／動物 只在同卡沒有對應葉頻道 get 時才算。
   - 路線只看 read／react，以及「沒有 role 只有 attr」的狀態型 entry（房舍材質·石、馬廄·圈內…）。
   - 終局計分／即時得分＝cards.json 紅利分數 欄「有」或「有 (依條件)」＋卡文有沒有「遊戲結束」，不看頻道（第十一節 Q10）。
   - 排序：命中 entry 數多者在前，同數依規格表順序；main＝第一個。全空＝「—」進待補清單。
   - combo：本卡 cause／get 的頻道 → 其他卡 react 的張數（to）；本卡 react 的頻道 → 其他卡 cause／get 的張數（from）。
   ══════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const VIEWER = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const argOf = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
const DRY = argv.includes('--dry');
const REPORT = argOf('--report');
const SAMPLE = Number(argOf('--sample')) || 10; // 校對檔每類抽幾張
const EXCL = path.resolve(argOf('--exclusions') || path.join(VIEWER, '..', 'agricola-online', 'exclusions_audit.json'));
const OUT = path.join(VIEWER, 'card-profile.json');
const OVR = path.join(VIEWER, 'card-profile-overrides.json');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const cid = (c) => String(c['卡片ID'] ?? '').trim();

// ── 規格第三節：類型（順序＝同數時的先後）────────────────────────
// 0905 grill 定 10 類；0905 晚 Lu 加三類（減免資源／不卡格／加強行動）成 13 類，裁定見 三新類裁定_20260905.md
// 0906 晚 grill 第三輪（規格第十一節）：+即時得分 成 14 類；行動加速拔掉格綁定（Q6）；居住空間·提供 → 家庭成長（Q9）
// 0907 「—」346 張補頻道（規格第十二節）：+任意貨物 成 15 類；動物養殖認 馬廄／圈地 容量 attr；對手互動改用卡文關鍵字
const TYPE_ORDER = ['食物引擎', '建材供給', '擴建房舍', '動物養殖', '農耕播種', '家庭成長', '行動加速', '減免資源', '不卡格', '加強行動', '打牌連鎖', '任意貨物', '終局計分', '即時得分', '對手互動'];
const LEAF = { 建築資源: ['木頭', '磚頭', '石頭', '蘆葦'], 作物: ['麥子', '蔬菜'], 動物: ['羊', '野豬', '牛'] };
// 每條規則：[頻道集合, 判定函式(entry)→bool]
const has = (e, r) => (e.role || []).includes(r);
const attrHas = (e, a) => (e.attr || []).includes(a);
const isCause = (e) => has(e, 'cause') || has(e, 'bind');
const isGet = (e) => has(e, 'get');
const TYPE_RULES = {
  食物引擎: (e) => (e.ch === '食物' && isGet(e)) || (e.ch === '烤麵包' && isCause(e)),
  建材供給: (e) => ['木頭', '磚頭', '石頭', '蘆葦', '建築資源'].includes(e.ch) && isGet(e),
  擴建房舍: (e) => ['擴建房舍', '翻修房舍'].includes(e.ch) && isCause(e),
  動物養殖: (e) => (['羊', '野豬', '牛', '動物'].includes(e.ch) && isGet(e))
    || (['蓋馬廄', '圈柵欄'].includes(e.ch) && isCause(e))
    || (['馬廄', '圈地'].includes(e.ch) && !has(e, 'read') && (attrHas(e, '容量') || attrHas(e, '容量大')))
    || e.ch === '飼養空間', // 1111 Lu：卡片自帶容量從 圈地[容量] 移到 飼養空間，照樣算多養動物；// 0907 Lu：多養動物的容量備註要認得；1102 wave2：結算時「看」容量（read）不算多養
  農耕播種: (e) => (['犁田', '播種', '收割', '封田'].includes(e.ch) && isCause(e))
    || (['麥子', '蔬菜', '作物'].includes(e.ch) && isGet(e)),
  家庭成長: (e) => (e.ch === '增加家庭成員' && isCause(e)) || (e.ch === '居住空間' && (attrHas(e, '免空') || attrHas(e, '提供'))), // Q9：提供 19 張全是家庭成員居住空間
  行動加速: (e) => e.ch === '額外行動' && isCause(e), // Q6：格綁定·bind 不算；Q7：觸發式已從加強行動改標成額外行動
  減免資源: (e) => e.ch === '減免資源' && isCause(e), // attr 替代＝可用另一種資源付（不開第 14 類）
  不卡格: (e) => e.ch === '不卡格' && isCause(e),
  加強行動: (e) => e.ch === '加強行動' && isCause(e), // attr 做兩次／加做行動
  打牌連鎖: (e) => ['打職業', '打發展'].includes(e.ch) && isCause(e),
  // 終局計分／即時得分：不看頻道（下面用 紅利分數 欄＋卡文關鍵字，Q10）；對手互動：暫空
};
// Q10：紅利分數欄「有」→ 卡文含「遊戲結束」＝終局計分，不含＝即時得分；
// 含「遊戲結束」但「立即」6 字內就接「分」（豪華暖爐那種）＝兩類都標。
// 0906 抽驗 25 張：純即時／純終局 20/20 對；原本「含立即就雙標」5/5 錯（立即多半修飾別的動作），故收緊成緊鄰。
const scoreTypes = (card) => {
  const bonus = String(card['紅利分數'] ?? '').trim();
  if (!(bonus === '有' || bonus.startsWith('有 '))) return [];
  const text = String(card['說明'] ?? '').replace(/\s+/g, '');
  if (!text.includes('遊戲結束')) return ['即時得分'];
  // 0907 Lu 裁定：雙標廢掉。含「遊戲結束」但「立即」6 字內接「分」（豪華暖爐：剩幾回合立刻拿幾分，「遊戲結束」講的是翻修限制）＝純即時
  return /立即.{0,6}分/.test(text) ? ['即時得分'] : ['終局計分'];
};

// ── 規格第四節：路線（0906 第十一節：+翻修流、+小戶流 成 9 條）──────────
// 0907 Lu 裁定蓋屋路線：石屋流＝卡要求「住石屋」才生效（要早翻石／石屋起家）；磚屋流＝要求「住磚屋」或「磚或石都行」（翻到磚就夠）；
// 要求「住木屋」是限制條件不是流派（初始就是木屋），木／三種都行 一律不算。舊名「木屋／磚屋流」改「磚屋流」。
const ROUTE_ORDER = ['石屋流', '磚屋流', '翻修流', '動物流', '農耕流', '大家庭流', '大房子流', '小戶流', '多牌流'];
const isRR = (e) => has(e, 'read') || has(e, 'react');
const isState = (e) => !(e.role || []).length; // 只有 attr 的狀態型 entry（房舍材質·石、馬廄·圈內…）
const isRead = (e) => has(e, 'read');
const isReact = (e) => has(e, 'react');
// 房間數／家庭人數·read 的方向 attr（多／少／無方向；0906 sonnet 從卡文補，判定檔 房間家庭方向_20260906.md）
// 沒方向或無方向＝兩邊都不算（Q13：「多」才算大房子流／大家庭流，「少」才算小戶流）
const ROUTE_RULES = {
  石屋流: (e) => e.ch === '房舍材質' && attrHas(e, '石') && !attrHas(e, '磚') && !attrHas(e, '木'), // 只認「只能石屋」；Q11：翻修·react 不算
  磚屋流: (e) => e.ch === '房舍材質' && attrHas(e, '磚') && !attrHas(e, '木'), // 磚、石或磚
  翻修流: (e) => e.ch === '翻修房舍' && isReact(e), // Q11／Q15：只認 react；翻修·cause 靠 combo 行連
  動物流: (e) => (['羊', '野豬', '牛', '動物'].includes(e.ch) && isRR(e))
    || (['馬廄', '圈地'].includes(e.ch) && (isRR(e) || isState(e)))
    || (['圈柵欄', '蓋馬廄'].includes(e.ch) && isReact(e)),
  農耕流: (e) => (['犁田', '播種', '收割', '烤麵包'].includes(e.ch) && isReact(e))
    || (['已播種田', '空田', '封田', '農田'].includes(e.ch) && (isRR(e) || isState(e)))
    || (['麥子', '蔬菜', '作物'].includes(e.ch) && isRR(e)),
  大家庭流: (e) => (e.ch === '家庭人數' && isRead(e) && attrHas(e, '多')) || (e.ch === '增加家庭成員' && isReact(e)) || (e.ch === '居住空間' && attrHas(e, '免空')),
  大房子流: (e) => (e.ch === '房間數' && isRead(e) && attrHas(e, '多')) || (e.ch === '擴建房舍' && isReact(e)),
  小戶流: (e) => (['房間數', '家庭人數'].includes(e.ch) && isRead(e) && attrHas(e, '少')) // Q13
    || (e.ch === '居住空間' && (attrHas(e, '提供') || attrHas(e, '免空'))),
  多牌流: (e) => (['職業數', '發展數', '手牌'].includes(e.ch) && isRead(e) && !attrHas(e, '尚未打出')) // 「尚未打出職業卡」是「少」，不算多牌流（0906 預審抓到，同型 29 張）
    || (['打職業', '打發展'].includes(e.ch) && isReact(e)),
};
// Q12：cards.json 先決條件欄一律推路線（關鍵字；channels.json 零星的 read entry 不動）
function prereqRoutes(prereq) {
  const p = String(prereq ?? '').replace(/\s+/g, '');
  if (!p || p === '無' || p === '見下文') return [];
  const out = new Set();
  const few = /至多|只有|恰好|仍|尚未|沒有/.test(p);
  const num = (re) => { const m = p.match(re); return m ? Number(m[1]) : null; };
  if (/羊|野豬|牛|動物|馬廄|圈地|柵欄/.test(p) && !/沒有/.test(p)) out.add('動物流');
  // 0907 Lu 裁定：先決只往「多」推，「只有／恰好 2」是趁早打的限制不是小戶流；3 房 3 人是基本盤，門檻 4 以上（實際只有 5 的條件）
  if (/石屋/.test(p) && !/磚屋|木屋/.test(p)) out.add('石屋流');
  if (/磚屋/.test(p) && !/木屋/.test(p)) out.add('磚屋流');
  const rooms = num(/(\d+)間/); // 「3間房間」「恰好兩間石屋」
  if (rooms !== null && rooms >= 4 && !few) out.add('大房子流');
  const members = num(/(\d+)(位|名)(成人)?(家庭)?成員/); // 「5位家庭成員」；「家庭成員在「X」行動格上」不算
  if (members !== null && members >= 4 && !few) out.add('大家庭流');
  if (/職業卡|發展卡|已打出的卡片/.test(p) && !few) out.add('多牌流'); // 「尚未打出職業卡」「至多1張職業卡」是「少」，不算多牌流
  if (/田|麥|菜|播種/.test(p) && !/沒有/.test(p)) out.add('農耕流');
  return [...out];
}

// ── 讀檔 ───────────────────────────────────────────────────────
if (!fs.existsSync(EXCL)) {
  console.error(`✗ 找不到排除卡名單 ${EXCL}\n  先到 agricola-online 跑：node audit_exclusions.cjs --json`);
  process.exit(1);
}
const audit = readJson(EXCL);
const excluded = audit.excluded || {};
const channels = readJson(path.join(VIEWER, 'channels.json'));
const baseCards = readJson(path.join(VIEWER, 'cards.json'));
const refCards = fs.existsSync(path.join(VIEWER, 'reference-cards.json')) ? readJson(path.join(VIEWER, 'reference-cards.json')) : [];
const overridesRaw = fs.existsSync(OVR) ? readJson(OVR) : {};
const overrides = Object.fromEntries(Object.entries(overridesRaw).filter(([k]) => !k.startsWith('_')));
// 1102 Lu 裁定：「—」裡真的沒產出的卡標「無直接效果」；只在推導為空時套用（日後補了頻道就自動讓位）
// 名單由 tools/apply_wave2_score.cjs 從 wave2_work/1102/dash_out.md 產生
const NO_EFFECT = new Set(fs.existsSync(path.join(__dirname, 'no_effect_ids.json')) ? readJson(path.join(__dirname, 'no_effect_ids.json')) : []);

// 1103 藍圖 2：LUGA 實戰單卡統計（tools/build_match_stats.cjs 產；沒有就不顯示）
const MATCH = path.join(VIEWER, 'card-match-stats.json');
const matchStats = fs.existsSync(MATCH) ? readJson(MATCH) : {};

const allCards = baseCards.concat(refCards);
const cards = allCards.filter((c) => cid(c) && !excluded[cid(c)]);
const nExcluded = allCards.length - cards.length;

// ── 類型／路線判定 ──────────────────────────────────────────────
function rank(order, counts) {
  return order.filter((k) => counts[k] > 0).sort((a, b) => (counts[b] - counts[a]) || (order.indexOf(a) - order.indexOf(b)));
}
function deriveTypes(card, entries) {
  const counts = Object.fromEntries(TYPE_ORDER.map((t) => [t, 0]));
  const leafGet = new Set(entries.filter(isGet).map((e) => e.ch));
  for (const e of entries) {
    if (e.ch === '貨物') continue; // 母層一律忽略
    if (LEAF[e.ch] && isGet(e) && LEAF[e.ch].some((l) => leafGet.has(l))) continue; // 有葉頻道就不算母層
    for (const t of Object.keys(TYPE_RULES)) if (TYPE_RULES[t](e)) counts[t]++;
  }
  for (const t of scoreTypes(card)) counts[t] = 1;
  // 0907 任意貨物（Lu）：只有母層 貨物·get、同卡沒有任何葉頻道 get ＝ 卡文寫「任意貨物」沒指明種類
  if (entries.some((e) => e.ch === '貨物' && isGet(e)) && !entries.some((e) => !['貨物', '分數', '負分', '乞討'].includes(e.ch) && isGet(e))) counts['任意貨物'] = 1; // 1102：分數·get 不是貨物，不擋；1111：負分／乞討·get 也不是
  if (isInteract(card)) counts['對手互動'] = 1;
  return rank(TYPE_ORDER, counts);
}
// 0907 對手互動（Lu 2A）：不等互動頻道，先用卡文關鍵字；「傳給左手邊玩家」是傳遞卡的特性不算互動，先剔掉那句
// 0907 抽驗 19 張：另剔「將這張牌傳給」變體、「即使已被其他玩家佔據」（不卡格句型，不是互動）
// 1111 Lu 2A：補「任何玩家／任一玩家」（生日賀卡等約 60 張漏抓）；「被任何玩家佔據」同樣是不卡格句型，剔掉
const PASS_RE = /將(其|此卡|這張牌)傳給你?左手邊的玩家[^。]*。?|即使已?被(其他|任何)玩家佔據|已被任何玩家佔據/g;
// 1111 Lu「打牌時要盯著對手」也算互動：補「其他N位玩家」（冒險家漏抓）
const INTERACT_RE = /其[他它]\d*位?玩家|所有玩家|每位玩家|任意玩家|任何玩家|任一玩家|對手|左手邊|右手邊/;
const isInteract = (card) => INTERACT_RE.test(String(card['說明'] ?? '').replace(PASS_RE, ''));
function deriveRoutes(card, entries) {
  const counts = Object.fromEntries(ROUTE_ORDER.map((r) => [r, 0]));
  for (const e of entries) for (const r of ROUTE_ORDER) if (ROUTE_RULES[r](e)) counts[r]++;
  for (const r of prereqRoutes(card['先決條件'])) counts[r]++;
  return rank(ROUTE_ORDER, counts);
}
function deriveCost(card, entries) {
  const pay = [...new Set(entries.filter((e) => has(e, 'pay')).map((e) => e.ch))];
  const norm = (v) => { const s = String(v ?? '').trim(); return (!s || s === '無') ? null : s; };
  const beg = entries.some((e) => e.ch === '乞討' && ['受罰', '獲得', '加罰'].some((a) => attrHas(e, a)));
  const feed = entries.some((e) => e.ch === '餵養' && attrHas(e, '加重'));
  return { pay, prereq: norm(card['先決條件']), face: norm(card['費用']), beg, feed };
}

// ── combo 索引：頻道 → 哪些卡 cause/get（src）、哪些卡 react ─────────
const srcIdx = {}, reactIdx = {};
const entriesOf = (id) => (channels[id] && channels[id].channels) || [];
const inScope = new Set(cards.map(cid));
for (const id of inScope) {
  for (const e of entriesOf(id)) {
    if (isCause(e) || isGet(e)) (srcIdx[e.ch] ||= new Set()).add(id);
    if (isReact(e) || has(e, 'pay')) (reactIdx[e.ch] ||= new Set()).add(id); // 0906 規格第 24 題：替代卡的 pay 視同 react 連 combo
  }
}
function deriveCombo(id, entries) {
  const combo = {};
  for (const e of entries) {
    if (isCause(e) || isGet(e)) {
      const n = [...(reactIdx[e.ch] || [])].filter((x) => x !== id).length;
      if (n) (combo[e.ch] ||= {}).to = n;
    }
    if (isReact(e) || has(e, 'pay')) { // 0906 規格第 24 題：pay 視同 react
      const n = [...(srcIdx[e.ch] || [])].filter((x) => x !== id).length;
      if (n) (combo[e.ch] ||= {}).from = n;
    }
  }
  return combo;
}

// ── 1103 藍圖 2：特性（Lu 的舊 25 類補進來的 5 類，role read 純標籤，見 apply_trait_channels.cjs）──
const TRAIT_ORDER = ['任務卡', '烹飪工具', '卡片農田', '飼養空間', '晚生不生']; // 1111 Lu：動物飼養空間 改名 飼養空間
const deriveTraits = (entries) => TRAIT_ORDER.filter((t) => entries.some((e) => e.ch === t));

// ── 1103 藍圖 2：推薦搭配前 10 張（Lu 1103 定 10 張；同日晚重寫，舊版「我產出＝你吃」把同類卡互推、木頭被當泛用丟掉）──
// 觸發點＝頻道＋時機（on 行動／行動格、from 場格…），兩卡要在「同一個觸發點」上才算真搭配：
//   疊加 1 分：兩卡 react 同一觸發點（伐木工＋木頭推車＋石斧都吃「用木頭累積格」）
//   開路 2 分：一張 cause 出另一張 react 的觸發點（森林主人開木頭格 → 伐木工；行動格 cause 也觸發「行動」react）
//   同一頻道只取較高那種，不重複加（否則泛用 react 卡靠「又疊又開」灌分）
//   同打法 3 分：兩張都標 居住空間·免空（收穫魔像、雙生子之母、農場幹事）
//   打法衝突＝不推：免空卡 vs「增加家庭成員·cause 卻沒標免空」的卡（要空房間；維納斯神像、友愛之家）
// 以上合計是主分，主分 0 不推。同主分才看副分：資源接力（我 get 的＝你 pay 的，食物／分數太泛不算）；
// 再同分比專注度（對方整張卡有幾成在跟我連），再比稀有度 Σ1/觸發點張數，再照卡片順序。同名卡（別的版本）不推。
const BEST_N = 10, PLAIN_RES = new Set(['食物', '分數', '負分']);
const tkey = (e) => `${e.ch}|${e.on || ''}|${e.from || ''}`;
const isNoRoom = (es) => es.some((e) => e.ch === '居住空間' && attrHas(e, '免空'));
const needsRoom = (es) => !isNoRoom(es) && es.some((e) => e.ch === '增加家庭成員' && isCause(e));
// 「每當其他玩家…」的 react 是別人觸發、不是跟我疊加（森林維護員、擅取木材者），不進觸發點索引
// 有上限的動作（Lu 1103：田 5 塊就滿分，第 6 塊只能填空地分）：兩張都「多做這個動作」的卡是替代品不互推；
// 加速卡該配的是「犁田時拿獎勵」（農田夢想家）與「吃空田」（花園設計師）的卡
const CAPPED = new Set(['犁田', '翻修房舍', '蓋馬廄', '圈柵欄']); // Lu 1103 擴大：翻修最多 2 次、馬廄 4 個、柵欄 15 根
const FIELD_STATE = new Set(['空田', '農田']);
const FILL_SPACE = new Set(['犁田', '擴建房舍', '蓋馬廄', '圈柵欄']); // 會把未使用區域變成已使用的動作
const OTHERS_REACT_RE = /(每當|每次|當)(其他|其它)玩家/;
const cardById = new Map(cards.map((c) => [cid(c), c]));
const bestIdx = { react: {}, cause: {} };
const bestMeta = {};
for (const id of inScope) {
  const es = entriesOf(id);
  const othersReact = OTHERS_REACT_RE.test(String(cardById.get(id)['說明'] ?? '').replace(/\s+/g, ''));
  const m = { react: new Set(), cause: new Set(), get: new Set(), pay: new Set(), accel: new Set(), noRoom: isNoRoom(es), needRoom: needsRoom(es), n: es.length || 1 };
  for (const e of es) {
    if (isReact(e) && !othersReact) m.react.add(tkey(e));
    if (FIELD_STATE.has(e.ch) && isRead(e) && !othersReact) m.react.add(`${e.ch}||`); // 看空田／農田數的卡也吃「多犁出來的田」
    if (isCause(e)) {
      m.cause.add(tkey(e));
      if (e.on === '行動格') m.cause.add(`${e.ch}|行動|${e.from || ''}`); // 用行動格＝也做了那個行動
      if (CAPPED.has(e.ch)) m.accel.add(e.ch);
      if (e.ch === '犁田') for (const f of FIELD_STATE) m.cause.add(`${f}||`); // 犁出來的是空田
      if (FILL_SPACE.has(e.ch)) m.cause.add('已使用空間||');
    }
    if (e.ch === '未使用區域' && isRead(e) && attrHas(e, '少') && !othersReact) m.react.add('已使用空間||'); // 土地研究員／土地登記：農莊填越滿越好
    if (isGet(e) && !PLAIN_RES.has(e.ch)) m.get.add(e.ch);
    if (has(e, 'pay') && !PLAIN_RES.has(e.ch)) m.pay.add(e.ch);
  }
  bestMeta[id] = m;
  for (const k of m.react) (bestIdx.react[k] ||= new Set()).add(id);
  for (const k of m.cause) (bestIdx.cause[k] ||= new Set()).add(id);
}
const noRoomIds = [...inScope].filter((id) => bestMeta[id].noRoom);
function deriveBest(id) {
  const me = bestMeta[id], myName = byIdName.get(id);
  const score = new Map(); // otherId -> { ch: 最高連結分, rare }
  const link = (set, k, pts) => {
    if (!set) return;
    const ch = k.split('|')[0];
    for (const o of set) {
      if (o === id) continue;
      const s = score.get(o) || { ch: {}, rare: 0 };
      if ((s.ch[ch] || 0) < pts) s.ch[ch] = pts;
      s.rare += 1 / set.size;
      score.set(o, s);
    }
  };
  for (const k of me.react) { link(bestIdx.react[k], k, 1); link(bestIdx.cause[k], k, 2); }
  for (const k of me.cause) link(bestIdx.react[k], k, 2);
  const rows = [];
  const cand = new Set(score.keys());
  if (me.noRoom) for (const o of noRoomIds) if (o !== id) cand.add(o);
  for (const o of cand) {
    const om = bestMeta[o];
    if (byIdName.get(o) === myName) continue;
    if ((me.noRoom && om.needRoom) || (me.needRoom && om.noRoom)) continue;
    if ([...me.accel].some((c) => om.accel.has(c))) continue; // 兩張都加速同一個有上限的動作＝替代品
    const s = score.get(o) || { ch: {}, rare: 0 };
    const main = Object.values(s.ch).reduce((a, b) => a + b, 0) + (me.noRoom && om.noRoom ? 3 : 0);
    if (!main) continue;
    let sub = 0;
    for (const r of me.get) if (om.pay.has(r)) sub++;
    for (const r of me.pay) if (om.get.has(r)) sub++;
    const focus = (Object.keys(s.ch).length + sub) / om.n; // 對方整張卡有幾成繞著跟我的連結（伐木工 2/2 勝過木匠的長凳 2/5）
    rows.push([o, main, sub, focus, s.rare]);
  }
  return rows.sort((a, b) => (b[1] - a[1]) || (b[2] - a[2]) || (b[3] - a[3]) || (b[4] - a[4]) || (cardOrder.get(a[0]) - cardOrder.get(b[0])))
    .slice(0, BEST_N).map(([o]) => o);
}
const cardOrder = new Map(cards.map((c, i) => [cid(c), i]));
const byIdName = new Map(cards.map((c) => [cid(c), c['牌名']]));

// ── 主流程 ─────────────────────────────────────────────────────
const profile = {};
const stats = { type: {}, main: {}, route: {}, none: [], noChannel: [], dual: 0, overridden: 0, trait: {}, best: 0 };
for (const card of cards) {
  const id = cid(card);
  const entries = entriesOf(id);
  let types = deriveTypes(card, entries);
  let routes = deriveRoutes(card, entries);
  if (!types.length && NO_EFFECT.has(id)) { types = ['無直接效果']; stats.noEffect = (stats.noEffect || 0) + 1; }
  const ov = overrides[id];
  if (ov) {
    stats.overridden++;
    if (Array.isArray(ov.types)) types = ov.types;
    if (Array.isArray(ov.routes)) routes = ov.routes;
  }
  const dual = !card.reference && String(card['類型'] ?? '').includes('主要發展卡');
  const p = {
    name: card['牌名'],
    types, main: types[0] || null, routes,
    cost: deriveCost(card, entries),
    combo: deriveCombo(id, entries),
    dual,
  };
  const traits = deriveTraits(entries);
  if (traits.length) p.traits = traits;
  const best = deriveBest(id, entries);
  if (best.length) p.best = best.map((o) => byIdName.get(o)); // 視窗直接列卡名
  if (matchStats[id]) p.match = matchStats[id];
  for (const t of traits) stats.trait[t] = (stats.trait[t] || 0) + 1;
  if (best.length) stats.best++;
  if (card.reference) p.reference = true;
  if (ov && ov.note) p.note = ov.note;
  profile[id] = p;

  for (const t of types) stats.type[t] = (stats.type[t] || 0) + 1;
  if (p.main) stats.main[p.main] = (stats.main[p.main] || 0) + 1;
  for (const r of routes) stats.route[r] = (stats.route[r] || 0) + 1;
  if (!types.length) (entries.length ? stats.none : stats.noChannel).push(id);
  if (dual) stats.dual++;
}

// ── 統計 ───────────────────────────────────────────────────────
const fmt = (o, order) => order.filter((k) => o[k]).map((k) => `${k} ${o[k]}`).join('　');
console.log(`卡：${allCards.length}（cards.json ${baseCards.length}＋參考 ${refCards.length}）－排除 ${nExcluded} ＝ ${cards.length}；有頻道資料 ${cards.filter((c) => entriesOf(cid(c)).length).length}`);
console.log(`排除名單：${Object.keys(excluded).length} 張（${audit.generatedAt || '?'}）；覆寫 ${stats.overridden} 張`);
console.log(`類型（含多標）：${fmt(stats.type, TYPE_ORDER)}`);
console.log(`主類型：${fmt(stats.main, TYPE_ORDER)}`);
console.log(`路線（含多標）：${fmt(stats.route, ROUTE_ORDER)}`);
console.log(`「—」：${stats.none.length + stats.noChannel.length} 張（有頻道但推不出 ${stats.none.length}／完全沒頻道資料 ${stats.noChannel.length}）；無直接效果 ${stats.noEffect || 0}；雙色卡 ${stats.dual}`);
const typeCountDist = {}; for (const p of Object.values(profile)) typeCountDist[p.types.length] = (typeCountDist[p.types.length] || 0) + 1;
console.log(`每張類型數分布：${JSON.stringify(typeCountDist)}`);
console.log(`特性：${fmt(stats.trait, TRAIT_ORDER)}；有「推薦搭配」名單 ${stats.best} 張`);

if (DRY) process.exit(0);

// ── 寫 card-profile.json：一張一行，順序固定 ─────────────────────
const lines = cards.map((c) => `  ${JSON.stringify(cid(c))}: ${JSON.stringify(profile[cid(c)])}`);
fs.writeFileSync(OUT, `{\n${lines.join(',\n')}\n}\n`, 'utf8');
console.log(`→ ${OUT}（${cards.length} 張）`);

// ── 抽樣校對檔 ─────────────────────────────────────────────────
if (REPORT) {
  // 固定種子，重跑抽到同一批
  let seed = 20260905;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const sample = (arr, n) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  const byId = Object.fromEntries(cards.map((c) => [cid(c), c]));
  const desc = (id) => String(byId[id]['說明'] ?? '').replace(/\s+/g, ' ').slice(0, 80);
  const costTxt = (p) => [p.cost.pay.length ? `pay ${p.cost.pay.join('／')}` : '', p.cost.prereq ? `先決「${p.cost.prereq}」` : '', p.cost.face ? `費用 ${p.cost.face}` : '', p.cost.beg ? '會吃乞討' : '', p.cost.feed ? '餵養變重' : ''].filter(Boolean).join('；') || '—';
  const row = (id) => { const p = profile[id]; return `- [ ] **${p.name}**（${id}）　類型：${p.types.join('／') || '—'}　路線：${p.routes.join('／') || '—'}　代價：${costTxt(p)}${p.dual ? '　🔁可當主發' : ''}\n  ${desc(id)}…`; };
  const chTxt = (id) => entriesOf(id).map((e) => `${e.ch}${e.role && e.role.length ? '·' + e.role.join('+') : ''}${e.attr ? '(' + e.attr.join('/') + ')' : ''}`).join('、');

  const md = [];
  md.push(`# 農家樂 卡片類型 抽樣校對（${new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)}）`, '');
  md.push(`> 工序 3 推導腳本 \`tools/build_card_profile.cjs\` 的產出。每類抽 ${SAMPLE} 張（固定種子，重跑同一批）＋「—」全列。`, '> 打勾＝對；分錯的在該行後面寫「應為 X」，我會收進 `card-profile-overrides.json`，不改規則。', '');
  md.push('## 統計', '', `- 母數 ${cards.length} 張（排除 ${nExcluded}）；「—」${stats.none.length + stats.noChannel.length} 張`, `- 主類型：${fmt(stats.main, TYPE_ORDER)}`, `- 路線：${fmt(stats.route, ROUTE_ORDER)}`, '');
  md.push(`## 一、類型抽樣（每類 ${SAMPLE} 張）`, '');
  for (const t of TYPE_ORDER) {
    const pool = cards.map(cid).filter((id) => profile[id].types.includes(t));
    md.push(`### ${t}（共 ${pool.length} 張）`, '');
    if (!pool.length) md.push('（暫無卡）', '');
    else md.push(...sample(pool, SAMPLE).map(row), '');
  }
  md.push(`## 二、路線抽樣（每條 ${SAMPLE} 張）`, '');
  for (const r of ROUTE_ORDER) {
    const pool = cards.map(cid).filter((id) => profile[id].routes.includes(r));
    md.push(`### ${r}（共 ${pool.length} 張）`, '');
    md.push(...sample(pool, SAMPLE).map(row), '');
  }
  md.push(`## 三、「—」全列：有頻道資料但推不出類型（${stats.none.length} 張）`, '', '> 這些卡的頻道只有 read／react／pay／狀態，沒有 get／cause。看一眼：是真的沒產出（純條件卡）、還是頻道漏標。', '');
  for (const id of stats.none) md.push(`- [ ] **${profile[id].name}**（${id}）　頻道：${chTxt(id)}　路線：${profile[id].routes.join('／') || '—'}\n  ${desc(id)}…`);
  md.push('', `## 四、「—」全列：完全沒有頻道資料（${stats.noChannel.length} 張）`, '', '> channels.json 沒這張卡。要嘛補標，要嘛用覆寫檔直接給類型。', '');
  for (const id of stats.noChannel) md.push(`- [ ] **${profile[id].name}**（${id}）${byId[id]['類型'] ? '　' + byId[id]['類型'] : ''}\n  ${desc(id)}…`);
  // 資料互相打架：頻道標了 分數·get pool 紅利分數，cards.json 的 紅利分數 欄卻不是「有」
  const clash = cards.map(cid).filter((id) => !profile[id].types.some((t) => t === '終局計分' || t === '即時得分') && entriesOf(id).some((e) => e.ch === '分數' && isGet(e) && e.pool === '紅利分數'));
  md.push('', `## 五、資料打架：頻道標「紅利分數」但 cards.json 紅利分數欄不是「有」（${clash.length} 張）`, '', '> 二選一：改 cards.json 的欄位，或頻道標錯。翻卡圖為準。', '');
  for (const id of clash) md.push(`- [ ] **${profile[id].name}**（${id}）　紅利分數欄「${byId[id]['紅利分數'] ?? ''}」\n  ${desc(id)}…`);
  fs.writeFileSync(REPORT, md.join('\n') + '\n', 'utf8');
  console.log(`→ ${REPORT}`);
}
