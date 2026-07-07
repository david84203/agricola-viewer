/* ══════════════════════════════════════════════════
   農家樂 覆盤輪抽模擬 — review.js
   ══════════════════════════════════════════════════ */

const IMG_BASE   = './images/';
const GRID_COLS  = 3;
const GRID_ROWS  = 3;
const CROP_DEF   = { offsetTop: 113, offsetBottom: 99, offsetLeft: 182, offsetRight: 164 };
const CROP_REF   = { width: 2040, height: 2807 };
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';

const BGA_DECKS          = ['A', 'B', 'C', 'D', 'E'];
const BANLIST_CACHE_KEY  = 'agricola_banlist_cache';
const BANLIST_CACHE_TTL  = 24 * 60 * 60 * 1000;
const SCORE_ELO_CEILING  = 1700;
const DRAFT_ROUNDS       = 7;   // 每人永遠選 7 張；handSize 是包牌大小可為 7~10

// 禁卡表（hardcode fallback，Firestore 載入後更新）
let BANNED_GROUPS = [
  { label: '過強職業卡',     eloPreset: 1300, ids: ['FL049','A127','I251','I260','I234','I255','8720-9','7873-7','7252-3','6022-5','舊版E198','K270','NL098','PI10','PI03','PI06','Z329','Ö03','Ö01','2913-2'] },
  { label: '過強次要發展卡', eloPreset: 1300, ids: ['B010*','906-8','A010','B021','A048','C031','6515-6','5869-10','5881-9','4988-8','I081','Z320','K138','K125','Ö13','Ö17','6044-7','Ö20','9244-5','12019-2'] },
  { label: '過爛職業卡',     eloPreset: 850,  ids: ['A107','A151','C144*','C111','D158*','B146','C157','B101','D140','A154','舊版E158','舊版E170','舊版E155','I247','舊版E198','舊版E171','5030-2','Ö05','K304','Ö02','5698-2','WM033','Ö09','6575-4','WA042','Z333','K317','FL053','A100','A132','B147','I224'] },
  { label: '過爛次要發展卡', eloPreset: 850,  ids: ['C058','B052','B018','舊版E17','舊版E29','I093','舊版E51','8315','6960-2','NL023','K109','FL016','FL028','Z324','FL021','NL025'] },
  { label: '擾亂戰局',       eloPreset: 1200, ids: ['C093','C130','C003*','B022','Ö04','PI17'] },
];
let BANNED_ID_MAP  = {};          // cardId → { label, eloPreset }
let dupExcludedIds = new Set();   // 重複卡 ID 集合

const PLAYERS = ['A', 'B', 'C', 'D'];
const PLAYER_COLORS = { A: 'dot-A', B: 'dot-B', C: 'dot-C', D: 'dot-D' };

/* ── 傳包公式 ──────────────────────────────────────
  職業牌：向右傳（A→B→C→D→A）
  round=0: 拿自己的包；round=1: 拿上家（D給A）的包
  playerIdx: 0=A, 1=B, 2=C, 3=D；round: 0~handSize-1
*/
function occPackKey(playerIdx, round) {
  return PLAYERS[((playerIdx - round) % 4 + 4) % 4];
}
/* 次要發展牌：依設定同向或反向 */
function minPackKey(playerIdx, round) {
  if (rs.draftFormat === 'combined' || rs.minDir === 'same') {
    return PLAYERS[((playerIdx - round) % 4 + 4) % 4]; // 同向（同 occ）
  }
  return PLAYERS[(playerIdx + round) % 4];             // 反向
}

/* ── State ─────────────────────────────────────────*/
let allCards   = [];
let imageCache = {};
let bgaIdMap   = {};  // ourCardId → bgaId, for non-ABCDE BGA cards

const rs = {
  phase: 'setup',  // setup | input | result
  mode: 1,         // 1=歷史紀錄 2=單人挑戰AI 3=四人單機 4=全AI
  humanSeat: 'A',  // 單人挑戰AI 時人類座位（預設 A，對應下拉選單第一項）
  aiStrategy: 'elo', // 'elo'=永遠最高ELO；'mimic'=模仿歷史玩家扣牌
  historyPicks: null, // 模仿模式用：開始前快照的歷史扣牌
  bgaMode: false,
  handSize: 9,
  draftFormat: 'separate', // 'separate' | 'combined'
  minDir: 'same',          // 'same' | 'reverse'（分開輪抽時有效；同時輪抽固定同向）

  playerNames: { A: '玩家A', B: '玩家B', C: '玩家C', D: '玩家D' },

  // 四包牌內容（設定階段填入）
  packs: {
    A: { occs: [], minors: [] },
    B: { occs: [], minors: [] },
    C: { occs: [], minors: [] },
    D: { occs: [], minors: [] },
  },

  // 輸入階段：目前在輸入哪位玩家
  currentInputPlayerIdx: 0,

  // 每位玩家每輪的扣牌（null = 尚未選）
  // picks[player].occ[0~6] = Card | null
  picks: {
    A: { occ: Array(7).fill(null), min: Array(7).fill(null) },
    B: { occ: Array(7).fill(null), min: Array(7).fill(null) },
    C: { occ: Array(7).fill(null), min: Array(7).fill(null) },
    D: { occ: Array(7).fill(null), min: Array(7).fill(null) },
  },

  // ELO 快取（結果頁面用）
  eloCache: {},

  // 匯入時找不到對照的 BGA 牌號
  missingBga: {
    A: { occ: [], min: [] },
    B: { occ: [], min: [] },
    C: { occ: [], min: [] },
    D: { occ: [], min: [] },
  },

  // Slot Picker 當前狀態
  openSlot: null,  // { player, type('occ'|'min'), round }
};

/* ══════════════════════════════════════════════════
   Init
   ══════════════════════════════════════════════════ */
function makeBookmarklet(fn) {
  return `javascript:(${fn.toString()})()`;
}

async function bgaFullImportBookmarklet() {
  try {
    const root = typeof gameui !== 'undefined' ? gameui : window.gameui;
    const logs = window.g_gamelogs || root?.g_gamelogs || root?.gamelogs || [];
    if (!root?.gamedatas?.players || !Array.isArray(logs) || !logs.length) {
      alert('找不到 BGA replay 資料，請在農家樂 replay 歷史頁執行');
      return;
    }

    const slots = ['A', 'B', 'C', 'D'];
    const normalizeId = id => {
      const s = String(id || '').trim();
      const m = s.match(/^([A-Z]+)(\d+)(\*?)$/);
      return m ? m[1] + m[2].padStart(3, '0') + m[3] : s;
    };
    const cleanName = value => {
      const div = document.createElement('div');
      div.innerHTML = String(value || '');
      return (div.textContent || div.innerText || String(value || '')).trim();
    };
    const asNum = value => {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };

    const playerList = Object.values(root.gamedatas.players).map(p => ({
      id: String(p.id),
      name: cleanName(p.name),
      no: asNum(p.player_no ?? p.no ?? p.player_table_order ?? 0),
    })).sort((a, b) => a.no - b.no).slice(0, 4);
    if (playerList.length !== 4) {
      alert('目前只支援 4 人 BGA 輪抽紀錄');
      return;
    }
    const playerToSlot = Object.fromEntries(playerList.map((p, i) => [p.id, slots[i]]));
    const playerNames = Object.fromEntries(playerList.map((p, i) => [slots[i], p.name || `玩家${slots[i]}`]));

    const handFromGamedatas = (gd, pid) => {
      const hand = gd?.players?.[pid]?.hand;
      if (!hand) return null;
      const cards = Array.isArray(hand) ? hand : Object.values(hand);
      const occs = [], minors = [];
      cards.forEach(c => {
        const type = String(c?.type || '').toLowerCase();
        const id = normalizeId(c?.numbering || c?.id);
        if (!id) return;
        if (type.includes('occupation')) occs.push(id);
        else if (!type.includes('major')) minors.push(id);
      });
      return { occs, minors };
    };

    const extractJson = (html, startBrace) => {
      let depth = 0, inStr = false, esc = false;
      for (let i = startBrace; i < html.length; i++) {
        const ch = html[i];
        if (inStr) {
          if (esc) esc = false;
          else if (ch === '\\') esc = true;
          else if (ch === '"') inStr = false;
        } else if (ch === '"') inStr = true;
        else if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (!depth) return html.slice(startBrace, i + 1);
        }
      }
      return null;
    };

    const url = new URL(location.href);
    const currentPid = url.searchParams.get('player') || String(root.player_id || '');
    const packs = {};
    const fetchErrors = [];

    for (const p of playerList) {
      const slot = playerToSlot[p.id];
      if (p.id === currentPid) {
        packs[slot] = handFromGamedatas(root.gamedatas, p.id);
        if (!packs[slot]) fetchErrors.push(`${p.name}：本頁 gamedatas 沒有手牌`);
        continue;
      }
      const u = new URL(location.href);
      u.searchParams.set('player', p.id);
      try {
        const res = await fetch(u.toString(), { credentials: 'include' });
        const html = await res.text();
        const idx = html.indexOf('completesetup(');
        const start = idx === -1 ? -1 : html.indexOf('{', idx);
        const raw = start === -1 ? null : extractJson(html, start);
        const gd = raw ? JSON.parse(raw) : null;
        packs[slot] = gd ? handFromGamedatas(gd, p.id) : null;
        if (!packs[slot]) fetchErrors.push(`${p.name}：HTTP ${res.status}，抓不到手牌`);
      } catch (e) {
        packs[slot] = null;
        fetchErrors.push(`${p.name}：${e.message}`);
      }
    }

    if (fetchErrors.length) {
      alert('有玩家視角抓取失敗，請重試一次，連續失敗請回報錯誤訊息：\n' + fetchErrors.join('\n'));
      return;
    }

    const handSize = Math.max(...slots.flatMap(s => [packs[s].occs.length, packs[s].minors.length]));
    const packWarnings = [];
    slots.forEach(s => {
      if (packs[s].occs.length !== handSize || packs[s].minors.length !== handSize) {
        packWarnings.push(`${playerNames[s]} 包牌：職業 ${packs[s].occs.length}/${handSize}，次發 ${packs[s].minors.length}/${handSize}`);
      }
    });

    const picks = Object.fromEntries(slots.map(s => [s, { occ: [], min: [] }]));
    const seen = new Set();
    const packets = logs.slice().sort((a, b) =>
      asNum(a.move_id) - asNum(b.move_id) ||
      asNum(a.packet_id) - asNum(b.packet_id) ||
      asNum(a.time) - asNum(b.time)
    );
    packets.forEach(packet => {
      (packet.data || []).forEach(event => {
        if (event?.type !== 'confirmDraftSelection') return;
        const args = event.args || {};
        const card = args.card || {};
        const playerId = String(args.player_id || card.pId || '');
        const slot = playerToSlot[playerId];
        if (!slot) return;
        const typeRaw = String(card.type || args.card_type || '').toLowerCase();
        const type = typeRaw.includes('occupation') || typeRaw.includes('職業') ? 'occ' : 'min';
        const id = normalizeId(card.numbering || card.id || args.card_id || args.card_name);
        if (!id) return;
        const key = `${event.uid || ''}|${playerId}|${type}|${id}|${packet.move_id || ''}`;
        if (seen.has(key)) return;
        seen.add(key);
        picks[slot][type].push(id);
      });
    });

    const rounds = Math.max(...slots.flatMap(s => [picks[s].occ.length, picks[s].min.length]));
    const pickWarnings = [];
    slots.forEach(s => {
      if (picks[s].occ.length !== rounds || picks[s].min.length !== rounds) {
        pickWarnings.push(`${playerNames[s]} 扣牌：職業 ${picks[s].occ.length}/${rounds}，次發 ${picks[s].min.length}/${rounds}`);
      }
    });

    const packSets = Object.fromEntries(slots.map(s => [s, {
      occ: new Set(packs[s].occs),
      min: new Set(packs[s].minors),
    }]));
    const countMisses = sign => {
      let miss = 0;
      slots.forEach((player, i) => {
        for (let r = 0; r < rounds; r++) {
          const packKey = slots[((i - sign * r) % 4 + 4) % 4];
          const o = picks[player].occ[r];
          const m = picks[player].min[r];
          if (o && !packSets[packKey].occ.has(o)) miss++;
          if (m && !packSets[packKey].min.has(m)) miss++;
        }
      });
      return miss;
    };
    const missSame = countMisses(1);
    const missOpp = countMisses(-1);
    const rotationNote = missSame === 0 ? null
      : (missOpp === 0 ? '注意：扣牌與包牌的傳遞方向相反，模擬器顯示的包牌輪轉可能不符'
        : `注意：有 ${missSame} 張扣牌不在預期包牌中，請檢查匯入結果`);

    const state = {
      handSize,
      draftFormat: 'combined',
      minDir: 'same',
      bgaMode: true,
      playerNames,
      packs,
      picks,
      source: {
        type: 'bga-full',
        table: new URL(location.href).searchParams.get('table') || '',
        url: location.href,
        importedAt: new Date().toISOString(),
        validation: { missSame, missOpp },
      },
    };

    const allWarnings = [...packWarnings, ...pickWarnings, ...(rotationNote ? [rotationNote] : [])];
    const out = JSON.stringify(state);
    const message = '已複製 BGA 完整匯入代碼（含四家初始手牌）！\n'
      + `玩家：${playerList.map(p => p.name).join(' / ')}\n`
      + `包牌：每人 ${handSize} 職業 + ${handSize} 次發\n`
      + `扣牌：每人 ${rounds} + ${rounds} 張\n`
      + (allWarnings.length ? '\n' + allWarnings.join('\n') + '\n' : '')
      + '\n回農家樂工具頁，點「匯出 / 匯入此局」貼上後按匯入。';
    navigator.clipboard.writeText(out)
      .then(() => alert(message))
      .catch(() => prompt('手動複製這段匯入代碼：', out));
  } catch (e) {
    alert('BGA 完整匯入失敗：' + e.message);
  }
}

async function init() {
  const fullImportLink = document.getElementById('bgaFullImportLink');
  if (fullImportLink) {
    fullImportLink.href = makeBookmarklet(bgaFullImportBookmarklet);
  }


  const [data, dupInfo] = await Promise.all([
    fetch('./cards.json').then(r => r.json()),
    loadDupExclusions(),
    loadBanlist(),
    loadBgaIdMap(),
    window.CardImages?.load?.() || Promise.resolve(),
  ]);
  allCards = data;
  dupExcludedIds = dupInfo;
  buildBannedIdMap();
  buildSetupScreen();
  bindGlobalEvents();
  refreshSessionLoadSelect();
  refreshHumanSeatSelect();
  restoreDraftState();
}

async function loadBgaIdMap() {
  try {
    const res = await fetch(`${FIRESTORE_BASE}/settings/bga_id_map`);
    const doc = await res.json();
    if (!doc.fields) return;
    const json = doc.fields.mapJson?.stringValue;
    if (json) bgaIdMap = JSON.parse(json);
  } catch {}
}

async function loadBanlist() {
  try {
    const cached = (() => {
      try {
        const s = JSON.parse(localStorage.getItem(BANLIST_CACHE_KEY));
        return s && Date.now() - s.cachedAt < BANLIST_CACHE_TTL ? s.data : null;
      } catch { return null; }
    })();
    let groups = cached;
    if (!groups) {
      const res = await fetch(`${FIRESTORE_BASE}/settings/banlist`);
      if (!res.ok) return;
      const doc = await res.json();
      groups = (doc.fields?.groups?.arrayValue?.values || []).map(g => ({
        label: g.mapValue.fields.label.stringValue,
        ids:   (g.mapValue.fields.ids.arrayValue.values || []).map(v => v.stringValue),
      }));
      if (groups.length) {
        localStorage.setItem(BANLIST_CACHE_KEY, JSON.stringify({ data: groups, cachedAt: Date.now() }));
      }
    }
    if (groups?.length) {
      const presetMap = {};
      BANNED_GROUPS.forEach(g => { presetMap[g.label] = g.eloPreset; });
      BANNED_GROUPS = groups.map(g => ({
        label:     g.label,
        ids:       g.ids,
        eloPreset: presetMap[g.label] ?? 1200,
      }));
    }
  } catch { /* 使用 hardcode fallback */ }
  buildBannedIdMap();
}

async function loadDupExclusions() {
  try {
    return (await DuplicateCards.loadDuplicateInfo()).excludedRefs;
  } catch { return new Set(); }
}

function buildBannedIdMap() {
  BANNED_ID_MAP = {};
  BANNED_GROUPS.forEach(g => {
    g.ids.forEach(id => { BANNED_ID_MAP[id] = { label: g.label, eloPreset: g.eloPreset }; });
  });
}

/* 取得卡牌特殊身份（禁卡 / 重複卡），沒有則回傳 null */
function getCardSpecialInfo(cardId) {
  const banInfo = BANNED_ID_MAP[cardId];
  if (banInfo) return { type: 'ban', label: banInfo.label, eloPreset: banInfo.eloPreset };
  if (dupExcludedIds.has(cardId)) return { type: 'dup', label: '重複卡', eloPreset: 1150 };
  return null;
}

function getBanShortLabel(special) {
  if (special.type === 'dup') return '重複卡';
  const map = {
    '過強職業卡': '禁｜過強', '過強次要發展卡': '禁｜過強',
    '過爛職業卡': '禁｜過爛', '過爛次要發展卡': '禁｜過爛',
    '擾亂戰局':   '禁｜擾亂',
  };
  return map[special.label] || '禁卡';
}

/* 取得 ELO 用於評分：
   BGA 牌組禁卡（A~E 牌組）且 eloCache 有資料 → 套信心度過渡到真實分，prior 用 eloPreset
   其餘禁卡/重複卡 → 維持預設分
   一般卡 → 套 seenCount 信心度 */
function getAdjElo(cardId) {
  const special = getCardSpecialInfo(cardId);
  if (special) {
    if (special.type === 'ban') {
      const card = allCards.find(c => c['卡片ID'] === cardId);
      if (card && BGA_DECKS.includes(card['牌組'])) {
        const cached = rs.eloCache[cardId];
        if (cached) {
          const eff  = cached.rankSeen ?? 0;
          const conf = Math.min(eff / 30, 1);
          return Math.min(conf * cached.elo + (1 - conf) * special.eloPreset, SCORE_ELO_CEILING);
        }
      }
    }
    return special.eloPreset;
  }
  const r    = rs.eloCache[cardId] || { elo: 1200, seenCount: 0 };
  const conf = Math.min(r.seenCount / 30, 1);
  return Math.min(conf * r.elo + (1 - conf) * 1200, SCORE_ELO_CEILING);
}

/* 計算玩家手牌平均 ELO（用 getAdjElo，與評分演算法同一套基準） */
function calcHandAvgElo(player) {
  const avg = ids => ids.length
    ? Math.round(ids.reduce((s, id) => s + getAdjElo(id), 0) / ids.length)
    : null;
  const occIds = rs.picks[player].occ.filter(Boolean).map(c => c['卡片ID']);
  const minIds = rs.picks[player].min.filter(Boolean).map(c => c['卡片ID']);
  // 前4扣：slice 在 filter 前，輪次才不會位移
  const first4Ids = [
    ...rs.picks[player].occ.slice(0, 4),
    ...rs.picks[player].min.slice(0, 4),
  ].filter(Boolean).map(c => c['卡片ID']);
  return { all: avg([...occIds, ...minIds]), occ: avg(occIds), min: avg(minIds), first4: avg(first4Ids) };
}

/* ══════════════════════════════════════════════════
   畫面一：設定包牌
   ══════════════════════════════════════════════════ */
function buildSetupScreen() {
  buildPackTabs();
  buildPackPanels();
  buildPackProgressRow();
  updateStartBtn();

  // 名稱輸入同步
  PLAYERS.forEach(p => {
    document.getElementById(`name${p}`).addEventListener('input', e => {
      rs.playerNames[p] = e.target.value.trim() || `玩家${p}`;
      refreshPackTabLabels();
      refreshPackProgressRow();
      refreshHumanSeatSelect();
      saveDraftState();
    });
  });

  document.getElementById('bgaModeToggle').addEventListener('change', e => {
    rs.bgaMode = e.target.checked;
    document.getElementById('bgaModeBar').classList.toggle('active', rs.bgaMode);
    if (rs.bgaMode) setDraftFormatCombined();
    // 切換模式時清空已選包牌（避免非法卡牌混入）
    PLAYERS.forEach(p => {
      rs.packs[p] = { occs: [], minors: [] };
      renderPackList(p, 'occ');
      renderPackList(p, 'min');
      updatePackCountBadge(p, 'occ');
      updatePackCountBadge(p, 'min');
    });
    refreshPackProgressRow();
    updateStartBtn();
    saveDraftState();
  });


}

function getPlayerName(p) {
  return rs.playerNames[p] || `玩家${p}`;
}

/* 座位下拉改用實際玩家名稱（value 仍是座位字母 A/B/C/D） */
function refreshHumanSeatSelect() {
  const sel = document.getElementById('humanSeatSelect');
  if (!sel) return;
  const cur = sel.value || rs.humanSeat || 'A';
  sel.innerHTML = PLAYERS.map(p => `<option value="${p}">${getPlayerName(p)}（${p}）</option>`).join('');
  sel.value = cur;
}

function buildPackTabs() {
  const tabsEl = document.getElementById('packTabs');
  tabsEl.innerHTML = '';
  PLAYERS.forEach((p, i) => {
    const btn = document.createElement('button');
    btn.className = `pack-tab${i === 0 ? ' active' : ''}`;
    btn.dataset.player = p;
    btn.innerHTML = `<span class="pack-tab-dot dot-${p}"></span><span class="tab-label">${getPlayerName(p)}的牌包</span>`;
    btn.addEventListener('click', () => switchPackTab(p));
    tabsEl.appendChild(btn);
  });
}

function refreshPackTabLabels() {
  document.querySelectorAll('#packTabs .pack-tab').forEach(btn => {
    const p = btn.dataset.player;
    btn.querySelector('.tab-label').textContent = `${getPlayerName(p)}的牌包`;
  });
}

function switchPackTab(player) {
  document.querySelectorAll('#packTabs .pack-tab').forEach(b => b.classList.toggle('active', b.dataset.player === player));
  document.querySelectorAll('#packPanels .pack-panel').forEach(p => p.classList.toggle('active', p.dataset.player === player));
}

function buildPackPanels() {
  const container = document.getElementById('packPanels');
  container.innerHTML = '';
  PLAYERS.forEach((p, i) => {
    const panel = document.createElement('div');
    panel.className = `pack-panel${i === 0 ? ' active' : ''}`;
    panel.dataset.player = p;
    panel.innerHTML = `
      <div class="pack-two-col">
        <div class="card-input-group" id="occGroup${p}">
          <div class="card-input-group-title">
            職業牌
            <span class="card-count-badge" id="occCount${p}">0 / ${rs.handSize}</span>
          </div>
          <div class="pack-search-wrap">
            <input class="pack-search-input" id="occSearch${p}" type="text"
              placeholder="搜尋職業牌名稱或 ID…" autocomplete="off" />
            <button class="pack-search-clear" id="occClear${p}" title="清除">✕</button>
            <div class="pack-search-results" id="occResults${p}"></div>
          </div>
          <ul class="pack-selected-list" id="occList${p}">
            <li class="pack-selected-empty">尚未選擇</li>
          </ul>
        </div>
        <div class="card-input-group" id="minGroup${p}">
          <div class="card-input-group-title">
            次要發展牌
            <span class="card-count-badge" id="minCount${p}">0 / ${rs.handSize}</span>
          </div>
          <div class="pack-search-wrap">
            <input class="pack-search-input" id="minSearch${p}" type="text"
              placeholder="搜尋次要發展牌名稱或 ID…" autocomplete="off" />
            <button class="pack-search-clear" id="minClear${p}" title="清除">✕</button>
            <div class="pack-search-results" id="minResults${p}"></div>
          </div>
          <ul class="pack-selected-list" id="minList${p}">
            <li class="pack-selected-empty">尚未選擇</li>
          </ul>
        </div>
      </div>
    `;
    container.appendChild(panel);
    bindPackSearchEvents(p, 'occ');
    bindPackSearchEvents(p, 'min');
  });
}

function bindPackSearchEvents(player, type) {
  const searchId = `${type}Search${player}`;
  const clearId  = `${type}Clear${player}`;
  const resultsId = `${type}Results${player}`;
  const searchEl  = document.getElementById(searchId);
  const clearEl   = document.getElementById(clearId);
  const resultsEl = document.getElementById(resultsId);

  searchEl.addEventListener('input', () => {
    const q = searchEl.value.trim();
    clearEl.classList.toggle('visible', q.length > 0);
    if (q.length === 0) { resultsEl.classList.remove('open'); return; }
    const matches = allCards.filter(c => {
      // 類型篩選
      const matchType = type === 'occ'
        ? c.card_type === 'occupation'
        : (c.card_type === 'minor' || c.card_type === 'both');
      if (!matchType) return false;
      // BGA 模式：只顯示 BGA 牌組（A/B/C/D/E），含重複卡與禁卡
      if (rs.bgaMode) {
        if (!BGA_DECKS.includes(c['牌組'])) return false;
      } else {
        // 一般模式：排除重複卡與禁卡
        if (dupExcludedIds.has(c['卡片ID'])) return false;
        if (BANNED_ID_MAP[c['卡片ID']]) return false;
      }
      const name = c['牌名'] || '';
      const id   = c['卡片ID'] || '';
      return name.includes(q) || id.toLowerCase().includes(q.toLowerCase());
    }).slice(0, 16);

    renderSearchResults(resultsEl, matches, player, type);
    resultsEl.classList.add('open');
  });

  searchEl.addEventListener('blur', () => {
    setTimeout(() => resultsEl.classList.remove('open'), 150);
  });

  clearEl.addEventListener('click', () => {
    searchEl.value = '';
    clearEl.classList.remove('visible');
    resultsEl.classList.remove('open');
    resultsEl.innerHTML = '';
  });
}

function renderSearchResults(container, cards, player, type) {
  const currentList = rs.packs[player][type === 'occ' ? 'occs' : 'minors'];
  const currentIds  = new Set(currentList.map(c => c['卡片ID']));
  container.innerHTML = '';
  if (cards.length === 0) {
    container.innerHTML = '<div class="pack-search-result-item" style="color:var(--text3)">找不到符合的牌</div>';
    return;
  }
  cards.forEach(card => {
    const item = document.createElement('div');
    item.className = `pack-search-result-item${currentIds.has(card['卡片ID']) ? ' already-in' : ''}`;
    const special = getCardSpecialInfo(card['卡片ID']);
    item.innerHTML = `
      <span class="pack-result-name">${card['牌名'] || '—'}</span>
      ${special ? `<span class="pack-result-special-badge ${special.type}">${getBanShortLabel(special)}</span>` : ''}
      <span class="pack-result-id">${card['卡片ID'] || ''}</span>
    `;
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      addCardToPack(player, type, card);
    });
    container.appendChild(item);
  });
}

function addCardToPack(player, type, card) {
  const key  = type === 'occ' ? 'occs' : 'minors';
  const list = rs.packs[player][key];
  if (list.length >= rs.handSize) return;
  if (list.some(c => c['卡片ID'] === card['卡片ID'])) return;
  list.push(card);
  renderPackList(player, type);
  updatePackCountBadge(player, type);
  updateStartBtn();
  refreshPackProgressRow();

  // 清除搜尋框
  const searchEl  = document.getElementById(`${type}Search${player}`);
  const clearEl   = document.getElementById(`${type}Clear${player}`);
  const resultsEl = document.getElementById(`${type}Results${player}`);
  searchEl.value = '';
  clearEl.classList.remove('visible');
  resultsEl.classList.remove('open');
  resultsEl.innerHTML = '';
  if (list.length < rs.handSize) searchEl.focus();
  saveDraftState();
}

function removeCardFromPack(player, type, cardId) {
  const key  = type === 'occ' ? 'occs' : 'minors';
  rs.packs[player][key] = rs.packs[player][key].filter(c => c['卡片ID'] !== cardId);
  renderPackList(player, type);
  updatePackCountBadge(player, type);
  updateStartBtn();
  refreshPackProgressRow();
  saveDraftState();
}

function renderPackList(player, type) {
  const key    = type === 'occ' ? 'occs' : 'minors';
  const list   = rs.packs[player][key];
  const listEl = document.getElementById(`${type}List${player}`);
  const missing = rs.missingBga[player][type];

  if (list.length === 0 && missing.length === 0) {
    listEl.innerHTML = '<li class="pack-selected-empty">尚未選擇</li>';
    return;
  }
  listEl.innerHTML = '';
  list.forEach((card, i) => {
    const li = document.createElement('li');
    li.className = 'pack-selected-item';
    li.innerHTML = `
      <span class="pack-selected-num">${i + 1}</span>
      <span class="pack-selected-name">${card['牌名'] || '—'}</span>
      <span class="pack-selected-id">${card['卡片ID'] || ''}</span>
      <button class="pack-selected-remove" data-id="${card['卡片ID']}" title="移除">✕</button>
    `;
    li.querySelector('.pack-selected-remove').addEventListener('click', () => {
      removeCardFromPack(player, type, card['卡片ID']);
    });
    listEl.appendChild(li);
  });

  // 缺牌占位列（純顯示，不塞入 rs.packs）
  missing.forEach(id => {
    const li = document.createElement('li');
    li.className = 'pack-card-row-missing';
    li.dataset.missingId = id;
    li.innerHTML = `<span>⚠ 缺牌：${id}（資料庫無對照）</span><button class="pack-missing-remove" title="移除">✕</button>`;
    li.querySelector('.pack-missing-remove').addEventListener('click', () => {
      rs.missingBga[player][type] = rs.missingBga[player][type].filter(x => x !== id);
      renderPackList(player, type);
      updatePackCountBadge(player, type);
      saveDraftState();
    });
    listEl.appendChild(li);
  });
}

function updatePackCountBadge(player, type) {
  const key   = type === 'occ' ? 'occs' : 'minors';
  const count = rs.packs[player][key].length;
  const hasMissing = rs.missingBga[player][type].length > 0;
  const el    = document.getElementById(`${type}Count${player}`);
  el.textContent = `${count} / ${rs.handSize}`;
  el.classList.toggle('full', count === rs.handSize);
  el.classList.toggle('has-missing', hasMissing);
  // 搜尋欄 disabled
  const searchEl = document.getElementById(`${type}Search${player}`);
  searchEl.disabled = count >= rs.handSize;
  searchEl.placeholder = count >= rs.handSize ? `已選滿 ${rs.handSize} 張` : (type === 'occ' ? '搜尋職業牌名稱或 ID…' : '搜尋次要發展牌名稱或 ID…');
}

function buildPackProgressRow() {
  refreshPackProgressRow();
}

function buildPackPanel(p) {
  renderPackList(p, 'occ');
  renderPackList(p, 'min');
  updatePackCountBadge(p, 'occ');
  updatePackCountBadge(p, 'min');
}

/* ── BGA Import ──────────────────────────────────── */
function normalizeBGAId(bgaId) {
  const m = bgaId.match(/^([A-Z]+)(\d+)(\*?)$/);
  if (!m) return bgaId;
  return m[1] + m[2].padStart(3, '0') + m[3];
}

function findCardByBGAId(bgaId) {
  const norm = normalizeBGAId(bgaId);
  const direct = allCards.find(c => {
    const id = c['卡片ID'] || '';
    return id === norm || id === norm + '*' || id.replace('*', '') === norm;
  });
  if (direct) return direct;
  // Check admin-mapped BGA IDs for non-ABCDE cards（星號兩側都要正規化比對）
  const ourId = Object.entries(bgaIdMap).find(([, v]) => {
    const vNorm = normalizeBGAId(String(v).trim().toUpperCase());
    return vNorm === norm || vNorm.replace('*', '') === norm.replace('*', '');
  })?.[0];
  if (!ourId) {
    // 最後嘗試用中文牌名比對（遊戲記錄書籤輸出的是牌名而非 ID）
    return allCards.find(c => (c['牌名'] || '').trim() === bgaId.trim()) || null;
  }
  return allCards.find(c => {
    const id = c['卡片ID'] || '';
    return id === ourId || id === ourId + '*' || id.replace('*', '') === ourId;
  }) || null;
}


function refreshPackProgressRow() {
  const row = document.getElementById('packProgressRow');
  row.innerHTML = '';
  PLAYERS.forEach(p => {
    const occN = rs.packs[p].occs.length;
    const minN = rs.packs[p].minors.length;
    const cell = document.createElement('div');
    cell.className = 'pack-progress-cell';
    cell.innerHTML = `
      <div class="pack-progress-label"><span class="player-color-dot dot-${p}"></span>${getPlayerName(p)}的牌包</div>
      <div class="pack-progress-counts">
        <span class="pack-progress-occ">職業 ${occN}/${rs.handSize}</span>
        <span class="pack-progress-sep">·</span>
        <span class="pack-progress-min">次要 ${minN}/${rs.handSize}</span>
      </div>
    `;
    row.appendChild(cell);
  });
}

function isPackFull(player) {
  return rs.packs[player].occs.length === rs.handSize && rs.packs[player].minors.length === rs.handSize;
}

function updateStartBtn() {
  const allFull = PLAYERS.every(isPackFull);
  document.getElementById('startInputBtn').disabled = !allFull;
  // 有任何一包有牌就可以儲存
  const hasAny = PLAYERS.some(p => rs.packs[p].occs.length || rs.packs[p].minors.length);
  const saveBtn = document.getElementById('sessionSaveBtn');
  if (saveBtn) saveBtn.disabled = !hasAny;
  updateViewResultBtn();
}

/* 是否存在已保存的歷史紀錄（第一手歷史輸入的那局） */
function updateViewResultBtn() {
  const btn = document.getElementById('viewResultBtn');
  if (btn) btn.style.display = getHistoryRecord() ? 'block' : 'none';
}

/* 載入獨立保存的歷史紀錄並直接查看評分結果（不受模擬模式覆蓋影響） */
async function viewHistoryResult() {
  const rec = getHistoryRecord();
  if (!rec) return;
  applyState(rec);   // 把歷史紀錄載回畫面（含四家原始扣牌）
  document.getElementById('globalLoading').style.display = 'flex';
  const allIds = PLAYERS.flatMap(p => [
    ...rs.packs[p].occs.map(c => c['卡片ID']),
    ...rs.packs[p].minors.map(c => c['卡片ID']),
  ]);
  await fetchElo(allIds);
  preloadAllPackImages();
  document.getElementById('globalLoading').style.display = 'none';
  showResult();
}

/* ══════════════════════════════════════════════════
   儲存 / 載入牌組
   ══════════════════════════════════════════════════ */
const SESSION_LS_KEY  = 'review_saved_sessions';
const SESSION_MAX     = 10;

function getSavedSessions() {
  try { return JSON.parse(localStorage.getItem(SESSION_LS_KEY)) || []; } catch { return []; }
}

function saveCurrentSession() {
  const hasAny = PLAYERS.some(p => rs.packs[p].occs.length || rs.packs[p].minors.length);
  if (!hasAny) return;

  const d    = new Date();
  const date = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  const names = PLAYERS.map(p => rs.playerNames[p] || `玩家${p}`).join('+');
  const label = `${names} ${date}`;

  const session = {
    id:          Date.now(),
    label,
    savedAt:     Date.now(),
    handSize:    rs.handSize,
    draftFormat: rs.draftFormat,
    minDir:      rs.minDir,
    bgaMode:     rs.bgaMode,
    playerNames: { ...rs.playerNames },
    packs: Object.fromEntries(PLAYERS.map(p => [p, {
      occs:   rs.packs[p].occs.map(c => c['卡片ID']),
      minors: rs.packs[p].minors.map(c => c['卡片ID']),
    }])),
    picks: Object.fromEntries(PLAYERS.map(p => [p, {
      occ: rs.picks[p].occ.map(c => c ? c['卡片ID'] : null),
      min: rs.picks[p].min.map(c => c ? c['卡片ID'] : null),
    }])),
  };

  let sessions = getSavedSessions();
  sessions.unshift(session);
  if (sessions.length > SESSION_MAX) sessions = sessions.slice(0, SESSION_MAX);
  try { localStorage.setItem(SESSION_LS_KEY, JSON.stringify(sessions)); } catch {}

  refreshSessionLoadSelect();
  const btn = document.getElementById('sessionSaveBtn');
  if (btn) { btn.textContent = '✓ 已儲存'; setTimeout(() => { btn.textContent = '💾 儲存此局'; }, 1800); }
}

function loadSession(id) {
  const session = getSavedSessions().find(s => s.id === +id);
  if (!session) return;
  // session 結構與 applyState 相容（packs/picks 皆為卡片ID）；含扣牌的存檔可直接重看結果
  applyState(session);
  saveDraftState();
  // 若載入的是一局完整對局，更新「原始紀錄」，讓模仿歷史以這局為藍本（與匯入行為一致）
  const complete = PLAYERS.every(p =>
    rs.picks[p].occ.filter(Boolean).length === DRAFT_ROUNDS &&
    rs.picks[p].min.filter(Boolean).length === DRAFT_ROUNDS);
  if (complete) saveHistoryRecord();
}

function deleteCurrentSession() {
  const sel = document.getElementById('sessionLoadSelect');
  if (!sel?.value) return;
  if (!confirm('確定刪除此筆紀錄？')) return;
  const id = +sel.value;
  let sessions = getSavedSessions().filter(s => s.id !== id);
  try { localStorage.setItem(SESSION_LS_KEY, JSON.stringify(sessions)); } catch {}
  refreshSessionLoadSelect();
}

function refreshSessionLoadSelect() {
  const sel = document.getElementById('sessionLoadSelect');
  if (!sel) return;
  const sessions = getSavedSessions();
  sel.innerHTML = '<option value="">📂 載入已儲存牌組…</option>' +
    sessions.map(s => {
      return `<option value="${s.id}">${s.label}</option>`;
    }).join('');
  const del = document.getElementById('sessionDeleteBtn');
  if (del) del.style.display = 'none';
}

/* ── 自動暫存（牌包＋扣牌＋設定，重整或返回設定都不消失）─── */
const DRAFT_AUTOSAVE_KEY = 'review_autosave_state';
// 歷史紀錄：第一手用「歷史紀錄輸入」完成的那局，獨立保存，模擬模式不會覆蓋
const HISTORY_RECORD_KEY = 'review_history_record';

function saveHistoryRecord() {
  try { localStorage.setItem(HISTORY_RECORD_KEY, JSON.stringify(buildState())); } catch {}
}
function getHistoryRecord() {
  try { return JSON.parse(localStorage.getItem(HISTORY_RECORD_KEY)); } catch { return null; }
}

function buildState() {
  return {
    handSize:    rs.handSize,
    draftFormat: rs.draftFormat,
    minDir:      rs.minDir,
    bgaMode:     rs.bgaMode,
    playerNames: { ...rs.playerNames },
    packs: Object.fromEntries(PLAYERS.map(p => [p, {
      occs:   rs.packs[p].occs.map(c => c['卡片ID']),
      minors: rs.packs[p].minors.map(c => c['卡片ID']),
    }])),
    picks: Object.fromEntries(PLAYERS.map(p => [p, {
      occ: rs.picks[p].occ.map(c => c ? c['卡片ID'] : null),
      min: rs.picks[p].min.map(c => c ? c['卡片ID'] : null),
    }])),
    missingBga: Object.fromEntries(PLAYERS.map(p => [p, {
      occ: [...rs.missingBga[p].occ],
      min: [...rs.missingBga[p].min],
    }])),
  };
}

function saveDraftState() {
  try { localStorage.setItem(DRAFT_AUTOSAVE_KEY, JSON.stringify(buildState())); } catch {}
}

function restoreDraftState() {
  let state;
  try { state = JSON.parse(localStorage.getItem(DRAFT_AUTOSAVE_KEY)); } catch { return; }
  if (state) applyState(state);
}

/* 把一份 state（牌包＋扣牌＋設定）套進畫面，匯入與自動還原共用 */
function applyState(state) {
  if (!state) return;
  const byId = id => (id ? allCards.find(c => c['卡片ID'] === id) || findCardByBGAId(String(id)) || null : null);

  if (state.handSize)    rs.handSize    = state.handSize;
  if (state.draftFormat) rs.draftFormat = state.draftFormat;
  if (state.minDir)      rs.minDir      = state.minDir;
  rs.bgaMode = state.bgaMode || false;
  if (state.playerNames) rs.playerNames = { ...rs.playerNames, ...state.playerNames };

  // 每次 apply 先清空缺牌記錄，再重新填入
  PLAYERS.forEach(p => {
    rs.missingBga[p].occ = [];
    rs.missingBga[p].min = [];
  });

  PLAYERS.forEach(p => {
    const sp = state.packs?.[p] || { occs: [], minors: [] };

    rs.packs[p].occs = (sp.occs || []).map(id => {
      const c = byId(id);
      if (!c && id) rs.missingBga[p].occ.push(id);
      return c;
    }).filter(Boolean);

    rs.packs[p].minors = (sp.minors || []).map(id => {
      const c = byId(id);
      if (!c && id) rs.missingBga[p].min.push(id);
      return c;
    }).filter(Boolean);

    const pk = state.picks?.[p];
    rs.picks[p].occ = pk ? (pk.occ || []).map(byId) : Array(DRAFT_ROUNDS).fill(null);
    rs.picks[p].min = pk ? (pk.min || []).map(byId) : Array(DRAFT_ROUNDS).fill(null);
  });

  // 合併 state 裡已存的缺牌記錄（去重）
  if (state.missingBga) {
    PLAYERS.forEach(p => {
      const sm = state.missingBga[p];
      if (!sm) return;
      rs.missingBga[p].occ = [...new Set([...rs.missingBga[p].occ, ...(sm.occ || [])])];
      rs.missingBga[p].min = [...new Set([...rs.missingBga[p].min, ...(sm.min || [])])];
    });
  }

  // 同步設定 UI
  document.querySelectorAll('#handSizeSelect .hand-size-btn').forEach(b =>
    b.classList.toggle('selected', +b.dataset.size === rs.handSize));
  document.querySelectorAll('#draftFormatSelect .draft-fmt-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.format === rs.draftFormat));
  const minDirGroup = document.getElementById('minDirGroup');
  if (minDirGroup) minDirGroup.style.display = rs.draftFormat === 'combined' ? 'none' : '';
  document.querySelectorAll('#minDirSelect .draft-dir-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.dir === rs.minDir));
  const toggle = document.getElementById('bgaModeToggle');
  if (toggle) toggle.checked = rs.bgaMode;
  document.getElementById('bgaModeBar')?.classList.toggle('active', rs.bgaMode);
  PLAYERS.forEach(p => {
    const el = document.getElementById(`name${p}`);
    if (el) el.value = rs.playerNames[p] === `玩家${p}` ? '' : (rs.playerNames[p] || '');
  });

  // 重建牌包面板
  buildPackTabs();
  PLAYERS.forEach(p => buildPackPanel(p));
  refreshPackTabLabels();
  refreshPackProgressRow();
  refreshHumanSeatSelect();
  updateStartBtn();
}

/* ── 清除重製 ─────────────────────────────────────────── */
function resetAll() {
  if (!confirm('確定要清除所有牌包與扣牌，回到空白狀態嗎？')) return;
  PLAYERS.forEach(p => {
    rs.packs[p].occs   = [];
    rs.packs[p].minors = [];
    rs.picks[p].occ    = Array(DRAFT_ROUNDS).fill(null);
    rs.picks[p].min    = Array(DRAFT_ROUNDS).fill(null);
    rs.playerNames[p]  = `玩家${p}`;
  });
  rs.bgaMode = false;
  try { localStorage.removeItem(DRAFT_AUTOSAVE_KEY); } catch {}
  try { localStorage.removeItem(HISTORY_RECORD_KEY); } catch {}
  const toggle = document.getElementById('bgaModeToggle');
  if (toggle) toggle.checked = false;
  document.getElementById('bgaModeBar')?.classList.remove('active');
  PLAYERS.forEach(p => {
    const el = document.getElementById(`name${p}`);
    if (el) el.value = '';
  });
  buildPackTabs();
  PLAYERS.forEach(p => buildPackPanel(p));
  refreshPackTabLabels();
  refreshPackProgressRow();
  refreshHumanSeatSelect();
  updateStartBtn();
}

/* ── 分享文字碼（跨電腦匯出／匯入整局）──────────────── */
const SHARE_CODE_PREFIX = 'AGRI1:';

// UTF-8 安全的 base64（牌名含中文，需先轉 byte 再編碼）
function utf8ToB64(str) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}
function b64ToUtf8(b64) {
  return new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
}

function encodeShareCode() {
  return SHARE_CODE_PREFIX + utf8ToB64(JSON.stringify(buildState()));
}

function decodeShareCode(text) {
  let raw = (text || '').trim();
  if (!raw) return null;
  if (raw.startsWith(SHARE_CODE_PREFIX)) raw = raw.slice(SHARE_CODE_PREFIX.length);
  try {
    const state = JSON.parse(b64ToUtf8(raw.trim()));
    if (state && state.packs && state.picks) return state;
  } catch {}
  // 容錯：也接受未編碼的純 JSON
  try {
    const state = JSON.parse(raw);
    if (state && state.packs) return state;
  } catch {}
  return null;
}

function getStateCardIds(state) {
  const ids = [];
  PLAYERS.forEach(p => {
    ids.push(...(state.packs?.[p]?.occs || []));
    ids.push(...(state.packs?.[p]?.minors || []));
    ids.push(...(state.picks?.[p]?.occ || []).filter(Boolean));
    ids.push(...(state.picks?.[p]?.min || []).filter(Boolean));
  });
  return [...new Set(ids)];
}

function findMissingStateCardIds(state) {
  return getStateCardIds(state).filter(id => {
    if (!id) return false;
    if (allCards.find(c => c['卡片ID'] === id)) return false;
    return !findCardByBGAId(String(id));
  });
}

function shouldPreserveCurrentPacksForHistoryImport(state) {
  if (state?.source?.type !== 'bga-history') return false;
  const incomingSize = state.handSize || DRAFT_ROUNDS;
  const currentHasFullerPacks = PLAYERS.every(p =>
    rs.packs[p].occs.length > incomingSize &&
    rs.packs[p].minors.length > incomingSize
  );
  const incomingHasPicks = PLAYERS.every(p =>
    (state.picks?.[p]?.occ || []).filter(Boolean).length === DRAFT_ROUNDS &&
    (state.picks?.[p]?.min || []).filter(Boolean).length === DRAFT_ROUNDS
  );
  return currentHasFullerPacks && incomingHasPicks;
}

function openShareDialog(mode) {
  const ta        = document.getElementById('shareCodeArea');
  const titleEl   = document.getElementById('shareDialogTitle');
  const stepsEl   = document.getElementById('shareDialogSteps');
  const copyBtn   = document.getElementById('shareCopyBtn');
  const importBtn = document.getElementById('shareImportBtn');

  document.getElementById('shareDialogMsg').textContent = '';

  if (mode === 'import') {
    if (titleEl)   titleEl.textContent = '📥 匯入 BGA 對局';
    if (stepsEl)   stepsEl.innerHTML   = '<div class="bga-step bga-step-primary">貼上 ⚡ 書籤複製的代碼或朋友的分享碼，按「匯入」</div>';
    ta.value = '';
    ta.placeholder = '貼上 ⚡ 書籤複製的代碼或朋友的分享碼';
    if (copyBtn)   copyBtn.style.display   = 'none';
    if (importBtn) importBtn.style.display = '';
  } else {
    if (titleEl)   titleEl.textContent = '🔗 匯出此局';
    if (stepsEl)   stepsEl.innerHTML   = '<div class="bga-step bga-step-primary">按「複製代碼」把這段文字傳給朋友，對方開本頁按「📥 匯入 BGA 對局」貼上即可還原整局</div>';
    ta.value = encodeShareCode();
    ta.placeholder = '';
    if (copyBtn)   copyBtn.style.display   = '';
    if (importBtn) importBtn.style.display = 'none';
  }

  document.getElementById('shareOverlay').style.display = 'flex';
}

function closeShareDialog() {
  document.getElementById('shareOverlay').style.display = 'none';
}

function openBgaHelpModal() {
  document.getElementById('bgaHelpOverlay').style.display = 'flex';
}

function closeBgaHelpModal() {
  document.getElementById('bgaHelpOverlay').style.display = 'none';
}

async function copyShareCode() {
  const ta = document.getElementById('shareCodeArea');
  if (!ta.value.trim()) { document.getElementById('shareDialogMsg').textContent = '沒有可複製的代碼'; return; }
  try {
    await navigator.clipboard.writeText(ta.value);
  } catch {
    ta.select(); document.execCommand('copy');
  }
  document.getElementById('shareDialogMsg').textContent = '✓ 已複製，貼給朋友即可';
}

function importShareCode() {
  const ta  = document.getElementById('shareCodeArea');
  const msg = document.getElementById('shareDialogMsg');
  const state = decodeShareCode(ta.value);
  if (!state) { msg.textContent = '✗ 代碼無法辨識，請確認完整複製'; return; }
  const missing = findMissingStateCardIds(state);
  const preserveCurrentPacks = shouldPreserveCurrentPacksForHistoryImport(state);
  const stateToApply = preserveCurrentPacks
    ? {
        ...state,
        handSize: rs.handSize,
        packs: Object.fromEntries(PLAYERS.map(p => [p, {
          occs: rs.packs[p].occs.map(c => c['卡片ID']),
          minors: rs.packs[p].minors.map(c => c['卡片ID']),
        }])),
      }
    : state;
  applyState(stateToApply);
  saveDraftState();
  // 如果 picks 已齊全（e.g. BGA 歷史匯入），存為歷史紀錄讓「查看結果」按鈕出現
  const picksComplete = PLAYERS.every(p =>
    rs.picks[p].occ.filter(Boolean).length === DRAFT_ROUNDS &&
    rs.picks[p].min.filter(Boolean).length === DRAFT_ROUNDS
  );
  if (picksComplete) {
    saveHistoryRecord();
    updateViewResultBtn();
  }
  closeShareDialog();
  if (preserveCurrentPacks) {
    alert('已匯入 BGA 歷史扣牌紀錄，並保留目前完整的 10+10 初始手牌。');
    return;
  }
  if (missing.length) {
    alert(`匯入完成，${missing.length} 張找不到對照，已標示在牌包空缺處，可至 BGA 牌組管理補對照。`);
  }
}

/* ══════════════════════════════════════════════════
   啟動模擬流程 (分流各種模式)
   ══════════════════════════════════════════════════ */
async function startSimulation() {
  // 單人挑戰 AI：先讀取座位與 AI 策略（須在重設扣牌前，才能快照歷史）
  if (rs.mode === 2) {
    rs.humanSeat  = document.getElementById('humanSeatSelect')?.value || rs.humanSeat || 'A';
    rs.aiStrategy = document.getElementById('aiStrategySelect')?.value || 'elo';
  }

  // 模式 1（歷史輸入）保留先前扣牌以便續編；AI／單機模式則重設
  if (rs.mode !== 1) {
    // 模仿歷史：藍本一律取「最初匯入/輸入的那局」鎖死的原始紀錄，
    // 避免被先前的單人挑戰扣牌覆蓋（換座位重玩時其他三家才會重現原局）。
    // 若沒有獨立原始紀錄，才退而用目前工作區的扣牌。
    if (rs.mode === 2 && rs.aiStrategy === 'mimic') {
      const byId = id => (id ? allCards.find(c => c['卡片ID'] === id) || findCardByBGAId(String(id)) || null : null);
      const src = getHistoryRecord()?.picks;
      rs.historyPicks = src
        ? Object.fromEntries(PLAYERS.map(p => [p, {
            occ: (src[p]?.occ || []).map(byId),
            min: (src[p]?.min || []).map(byId),
          }]))
        : Object.fromEntries(PLAYERS.map(p => [p, {
            occ: rs.picks[p].occ.slice(),
            min: rs.picks[p].min.slice(),
          }]));
    } else {
      rs.historyPicks = null;
    }
    PLAYERS.forEach(p => {
      rs.picks[p] = { occ: Array(DRAFT_ROUNDS).fill(null), min: Array(DRAFT_ROUNDS).fill(null) };
    });
  }

  // 預載圖片
  preloadAllPackImages();

  // 顯示 Loading
  document.getElementById('globalLoading').style.display = 'flex';

  // 預載 ELO
  const allIds = PLAYERS.flatMap(p => [
    ...rs.packs[p].occs.map(c => c['卡片ID']),
    ...rs.packs[p].minors.map(c => c['卡片ID']),
  ]);
  await fetchElo(allIds);
  document.getElementById('globalLoading').style.display = 'none';

  // 依據模式分流
  if (rs.mode === 1) {
    rs.phase = 'input';
    rs.currentInputPlayerIdx = 0;
    showScreen('inputScreen');
    renderInputScreen();
  } else if (rs.mode === 4) {
    runAllAiDraft();
  } else {
    // 模式 2 (單人挑戰 AI) 或 模式 3 (四人單機)
    startActiveDraft();
  }
}

function runAllAiDraft() {
  // 全 AI 瞬間跑完
  for (let type of ['occ', 'min']) {
    for (let round = 0; round < DRAFT_ROUNDS; round++) {
      for (let p of PLAYERS) {
        const playerIdx = PLAYERS.indexOf(p);
        const packKey = type === 'occ' ? occPackKey(playerIdx, round) : minPackKey(playerIdx, round);
        const card = getAiPick(packKey, type, p, round);
        rs.picks[p][type][round] = card;
      }
    }
  }
  showResult();
}

/* ── 動態輪抽引擎 (Active Draft) ────────────────────── */
function startActiveDraft() {
  rs.phase = 'draft';
  // 同時輪抽：每輪同時抽職業＋次發；分開輪抽：先 7 輪職業再 7 輪次發
  const startType = rs.draftFormat === 'combined' ? 'combined' : 'occ';
  rs.draftState = { type: startType, round: 0, turn: 0 }; // turn: 0=A, 1=B, 2=C, 3=D
  showScreen('activeDraftScreen');
  nextDraftTurn();
}

async function nextDraftTurn() {
  if (rs.draftState.type === 'done') {
    showResult();
    return;
  }

  const { type, round, turn } = rs.draftState;
  const player = PLAYERS[turn];

  const isHumanTurn = rs.mode === 3 || (rs.mode === 2 && player === rs.humanSeat);

  if (!isHumanTurn) {
    // AI 回合
    const playerIdx = PLAYERS.indexOf(player);
    if (type === 'combined') {
      // 同時抽：職業與次發各選一張最高 ELO
      rs.picks[player].occ[round] = getAiPick(occPackKey(playerIdx, round), 'occ', player, round);
      rs.picks[player].min[round] = getAiPick(minPackKey(playerIdx, round), 'min', player, round);
    } else {
      const packKey = type === 'occ' ? occPackKey(playerIdx, round) : minPackKey(playerIdx, round);
      rs.picks[player][type][round] = getAiPick(packKey, type, player, round);
    }

    // 短暫延遲營造思考感
    await new Promise(r => setTimeout(r, 100));
    advanceDraftState();
    nextDraftTurn();
  } else {
    // 人類回合
    if (rs.mode === 3) {
      // 模式 3 需要防窺遮罩
      document.getElementById('adPassNextName').textContent = getPlayerName(player);
      document.getElementById('adPassOverlay').style.display = 'flex';
    } else {
      renderActiveDraftScreen();
    }
  }
}

function advanceDraftState() {
  rs.draftState.turn++;
  if (rs.draftState.turn >= 4) {
    rs.draftState.turn = 0;
    rs.draftState.round++;
    if (rs.draftState.round >= DRAFT_ROUNDS) {
      rs.draftState.round = 0;
      // occ → min（分開輪抽的第二階段）；min 或 combined 結束後即 done
      rs.draftState.type = rs.draftState.type === 'occ' ? 'min' : 'done';
    }
  }
}

function getAiPick(packKey, type, player, round) {
  const packCards = type === 'occ' ? rs.packs[packKey].occs : rs.packs[packKey].minors;
  const takenIds = getTakenIdsFromPack(packKey, type, player, round);
  const available = packCards.filter(c => !takenIds.has(c['卡片ID']));

  if (available.length === 0) return null; // 不應發生

  // 模仿歷史：優先扣下原玩家當時扣的那張；若已被拿走則 fall back 到最高 ELO
  if (rs.aiStrategy === 'mimic' && player !== rs.humanSeat) {
    const histId = rs.historyPicks?.[player]?.[type]?.[round]?.['卡片ID'];
    if (histId) {
      const match = available.find(c => c['卡片ID'] === histId);
      if (match) return match;
    }
  }

  // 找最高 ELO，若有多張相同 ELO，隨機選一張
  let maxElo = -Infinity;
  let bestCards = [];
  
  available.forEach(c => {
    const elo = getAdjElo(c['卡片ID']);
    if (elo > maxElo) {
      maxElo = elo;
      bestCards = [c];
    } else if (elo === maxElo) {
      bestCards.push(c);
    }
  });

  const rndIdx = Math.floor(Math.random() * bestCards.length);
  return bestCards[rndIdx];
}

/* 建立一張可點選的牌包卡片元素 */
function makeAdPackCard(card, { selected = false, onClick }) {
  const special = getCardSpecialInfo(card['卡片ID']);
  const cEl = document.createElement('div');
  cEl.className = 'ad-pack-card' + (selected ? ' selected' : '');
  cEl.innerHTML = `
    <canvas></canvas>
    <div class="ad-pack-card-name">${card['牌名'] || '—'}</div>
    ${special ? `<div class="slot-picker-special-tag ${special.type}">${getBanShortLabel(special)}</div>` : ''}
    <button class="ad-card-info-btn" title="查看詳情">ℹ</button>
  `;
  cEl.addEventListener('click', e => {
    if (e.target.closest('.ad-card-info-btn')) return;
    onClick(e);
  });
  cEl.querySelector('.ad-card-info-btn').addEventListener('click', e => {
    e.stopPropagation();
    openModal(card);
  });
  requestAnimationFrame(() => drawCrop(cEl.querySelector('canvas'), card, 0.7));
  return cEl;
}

/* 建立一個「已扣下的牌」格子 */
function makeAdBoardSlot(picked, isCurrent) {
  const slot = document.createElement('div');
  slot.className = 'ad-board-slot';
  if (picked) {
    slot.classList.add('has-card');
    slot.innerHTML = `<canvas></canvas><div class="ad-board-card-name">${picked['牌名'] || ''}</div>`;
    slot.title = picked['牌名'] || '';
    requestAnimationFrame(() => drawCrop(slot.querySelector('canvas'), picked, 0.55));
  } else if (isCurrent) {
    slot.innerHTML = `<span style="font-size:1.5rem;color:var(--gold);">?</span>`;
  }
  return slot;
}

function renderActiveDraftScreen() {
  if (rs.draftState.type === 'combined') { renderCombinedDraftScreen(); return; }

  const { type, round, turn } = rs.draftState;
  const player = PLAYERS[turn];
  const playerIdx = PLAYERS.indexOf(player);
  const packKey = type === 'occ' ? occPackKey(playerIdx, round) : minPackKey(playerIdx, round);

  // Header
  document.getElementById('adRoundLabel').textContent = `${type === 'occ' ? '職業卡' : '次要發展卡'} 第 ${round + 1} / ${DRAFT_ROUNDS} 輪`;
  document.getElementById('adTurnName').textContent = getPlayerName(player);
  document.getElementById('adTurnName').className = `ad-turn-name score-color-${player}`;

  // Board (該玩家這輪之前選的牌，共 7 格)
  const boardGrid = document.getElementById('adBoardGrid');
  boardGrid.innerHTML = '';
  for (let r = 0; r < DRAFT_ROUNDS; r++) {
    const picked = rs.picks[player][type][r];
    boardGrid.appendChild(makeAdBoardSlot(picked, r === round));
  }

  // Pack (傳來的牌包，扣除被前人選走的)
  const packCards = type === 'occ' ? rs.packs[packKey].occs : rs.packs[packKey].minors;
  const takenIds = getTakenIdsFromPack(packKey, type, player, round);
  const available = packCards.filter(c => !takenIds.has(c['卡片ID']));

  document.getElementById('adPackTitle').textContent = `來自 ${getPlayerName(packKey)} 的牌包`;
  const packGrid = document.getElementById('adPackGrid');
  packGrid.style.display = '';
  packGrid.innerHTML = '';
  available.forEach(card => {
    packGrid.appendChild(makeAdPackCard(card, {
      onClick: () => {
        rs.picks[player][type][round] = card;
        advanceDraftState();
        nextDraftTurn();
      },
    }));
  });
}

/* 同時輪抽：同畫面擺出職業包＋次發包，各選一張再按確認換人 */
function renderCombinedDraftScreen() {
  const { round, turn } = rs.draftState;
  const player = PLAYERS[turn];
  const playerIdx = PLAYERS.indexOf(player);

  document.getElementById('adRoundLabel').textContent = `同時輪抽 第 ${round + 1} / ${DRAFT_ROUNDS} 輪`;
  document.getElementById('adTurnName').textContent = getPlayerName(player);
  document.getElementById('adTurnName').className = `ad-turn-name score-color-${player}`;

  // Board：上排職業、下排次發（7+7 在 7 欄 grid 自然成兩列）
  const boardGrid = document.getElementById('adBoardGrid');
  boardGrid.innerHTML = '';
  ['occ', 'min'].forEach(type => {
    for (let r = 0; r < DRAFT_ROUNDS; r++) {
      const picked = rs.picks[player][type][r];
      boardGrid.appendChild(makeAdBoardSlot(picked, r === round && !picked));
    }
  });

  // 兩個牌包並列
  document.getElementById('adPackTitle').textContent = '同時抽：各選一張職業 + 一張次發';
  const packGrid = document.getElementById('adPackGrid');
  packGrid.style.display = 'block';   // 改成區塊堆疊，內層各自用 grid
  packGrid.innerHTML = '';

  const buildSection = (type) => {
    const packKey = type === 'occ' ? occPackKey(playerIdx, round) : minPackKey(playerIdx, round);
    const wrap = document.createElement('div');
    wrap.className = 'ad-combined-section';
    const head = document.createElement('div');
    head.className = 'ad-combined-head';
    head.textContent = `${type === 'occ' ? '職業包' : '次發包'}（來自 ${getPlayerName(packKey)}）`;
    const grid = document.createElement('div');
    grid.className = 'ad-pack-grid';

    const packCards = type === 'occ' ? rs.packs[packKey].occs : rs.packs[packKey].minors;
    const takenIds  = getTakenIdsFromPack(packKey, type, player, round);
    const selectedId = rs.picks[player][type][round]?.['卡片ID'];
    packCards.filter(c => !takenIds.has(c['卡片ID'])).forEach(card => {
      grid.appendChild(makeAdPackCard(card, {
        selected: card['卡片ID'] === selectedId,
        onClick: () => { rs.picks[player][type][round] = card; renderCombinedDraftScreen(); },
      }));
    });
    wrap.appendChild(head);
    wrap.appendChild(grid);
    return wrap;
  };

  packGrid.appendChild(buildSection('occ'));
  packGrid.appendChild(buildSection('min'));

  // 確認按鈕：兩張都選了才可換人
  const bothPicked = rs.picks[player].occ[round] && rs.picks[player].min[round];
  const confirm = document.createElement('button');
  confirm.className = 'ad-combined-confirm';
  confirm.disabled = !bothPicked;
  confirm.textContent = bothPicked ? '✓ 完成本輪，換下一位' : '請各選一張職業與次發';
  confirm.addEventListener('click', () => { advanceDraftState(); nextDraftTurn(); });
  packGrid.appendChild(confirm);
}

function bindActiveDraftEvents() {
  document.getElementById('adPassReadyBtn').addEventListener('click', () => {
    document.getElementById('adPassOverlay').style.display = 'none';
    renderActiveDraftScreen();
  });
}

function preloadAllPackImages() {
  PLAYERS.forEach(p => {
    [...rs.packs[p].occs, ...rs.packs[p].minors].forEach(card => {
      if (!card.source_image) return;
      const key = IMG_BASE + card.source_image;
      if (imageCache[key]) return;
      const img = new Image();
      img.onload = () => { imageCache[key] = img; };
      img.src = key;
    });
  });
}

function renderInputScreen() {
  const player = PLAYERS[rs.currentInputPlayerIdx];
  renderInputProgress();
  renderInputHeader(player);
  renderAllSlots(player);
  updateNextBtn();
}

function renderInputProgress() {
  const el = document.getElementById('inputProgress');
  el.innerHTML = '';
  PLAYERS.forEach((p, i) => {
    const step = document.createElement('div');
    const isActive = i === rs.currentInputPlayerIdx;
    const hasPicks = countPlayerPicks(p) > 0;
    step.className = `input-progress-step${hasPicks && !isActive ? ' done' : ''}${isActive ? ' active' : ''}`;
    step.innerHTML = `<span class="step-dot"></span>${getPlayerName(p)}`;
    step.style.cursor = 'pointer';
    step.addEventListener('click', () => {
      rs.currentInputPlayerIdx = i;
      renderInputScreen();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    el.appendChild(step);
  });
}

function renderInputHeader(player) {
  document.getElementById('inputPlayerName').textContent = `${getPlayerName(player)} 的扣牌紀錄`;
  const badge = document.getElementById('inputPlayerBadge');
  badge.textContent = player;
  badge.className = `input-phase-player-badge badge-player-${player}`;
}

function renderAllSlots(player) {
  renderSlots(player, 'occ');
  renderSlots(player, 'min');
}

function renderSlots(player, type) {
  const grid      = document.getElementById(type === 'occ' ? 'occSlots' : 'minSlots');
  const playerIdx = PLAYERS.indexOf(player);
  grid.innerHTML  = '';

  for (let round = 0; round < DRAFT_ROUNDS; round++) {
    const packKey  = type === 'occ' ? occPackKey(playerIdx, round) : minPackKey(playerIdx, round);
    const packName = `${getPlayerName(packKey)}的牌包`;
    const picked   = rs.picks[player][type][round];
    const phaseLabel = type === 'occ' ? '職業卡輪抽' : '次要發展卡輪抽';

    const slot = document.createElement('div');
    slot.className = `round-slot${picked ? ' has-pick' : ''}`;
    slot.dataset.player = player;
    slot.dataset.type   = type;
    slot.dataset.round  = round;

    slot.innerHTML = `
      <div class="round-slot-header">
        <div class="round-slot-round">第 ${round + 1} / ${DRAFT_ROUNDS} 輪</div>
        <div class="round-slot-pack">${packName}</div>
      </div>
      <div class="round-slot-body">
        ${picked
          ? `<div class="round-slot-picked">
               <canvas></canvas>
               <div class="round-slot-picked-name">${picked['牌名'] || '—'}</div>
             </div>
             <button class="round-slot-clear" title="清除選擇">✕</button>`
          : `<div class="round-slot-empty">點此選牌</div>`
        }
      </div>
    `;

    // 點擊格子 → 開啟 picker
    slot.querySelector('.round-slot-body').addEventListener('click', () => {
      openSlotPicker(player, type, round, slot);
    });

    // 清除按鈕
    slot.querySelector('.round-slot-clear')?.addEventListener('click', e => {
      e.stopPropagation();
      rs.picks[player][type][round] = null;
      renderSlots(player, type);
      updateNextBtn();
      saveDraftState();
    });

    grid.appendChild(slot);

    // 畫已選牌縮圖
    if (picked) {
      requestAnimationFrame(() => {
        drawCrop(slot.querySelector('canvas'), picked, 0.6);
      });
    }
  }
}

function updateNextBtn() {
  const player   = PLAYERS[rs.currentInputPlayerIdx];
  const total    = countPlayerPicks(player);
  const isLast   = rs.currentInputPlayerIdx >= PLAYERS.length - 1;
  const allDone  = PLAYERS.every(p => countPlayerPicks(p) === DRAFT_ROUNDS * 2);
  document.getElementById('inputPickCount').innerHTML =
    `已選 <strong>${total}</strong> / ${DRAFT_ROUNDS * 2} 張`;
  const btn = document.getElementById('inputNextBtn');
  btn.disabled = false;
  btn.textContent = isLast ? '查看結果 →' : '下一位玩家 →';
  if (isLast) btn.disabled = !allDone;
}

function countPlayerPicks(player) {
  return rs.picks[player].occ.filter(Boolean).length
       + rs.picks[player].min.filter(Boolean).length;
}

/* ── Slot Picker ──────────────────────────────────── */
function openSlotPicker(player, type, round, slotEl) {
  rs.openSlot = { player, type, round };
  const playerIdx = PLAYERS.indexOf(player);
  const packKey   = type === 'occ' ? occPackKey(playerIdx, round) : minPackKey(playerIdx, round);
  const packCards = type === 'occ' ? rs.packs[packKey].occs : rs.packs[packKey].minors;
  const packName  = `${getPlayerName(packKey)}的牌包`;

  // 已被其他玩家從這包選走的牌
  const takenIds = getTakenIdsFromPack(packKey, type, player, round);

  document.getElementById('slotPickerTitle').textContent =
    `第 ${round + 1} / ${DRAFT_ROUNDS} 輪 · ${packName}`;
  document.getElementById('slotPickerSearch').value = '';

  renderPickerCards(packCards, takenIds);

  // 定位 picker
  const rect = slotEl.getBoundingClientRect();
  const picker = document.getElementById('slotPicker');
  picker.style.display = 'flex';
  document.getElementById('pickerBackdrop').style.display = 'block';

  // 計算位置，避免超出視窗
  const pickerW = 320;
  const pickerH = 400;
  let left = rect.left;
  let top  = rect.bottom + 8;
  if (left + pickerW > window.innerWidth - 10) left = window.innerWidth - pickerW - 10;
  if (top  + pickerH > window.innerHeight - 10) top  = rect.top - pickerH - 8;
  if (top < 10) top = 10;
  picker.style.left = `${left}px`;
  picker.style.top  = `${top}px`;

  document.getElementById('slotPickerSearch').focus();
  slotEl.classList.add('open');
}

/* 計算第 currentRound 輪之前，這包牌已被拿走的卡（含玩家自己前一圈拿的）
   牌包每輪往下傳一位，所以「路徑順位」就等於「輪次 round」：
   第 r 輪（r < currentRound）持有這包的人選掉的牌，就是已被拿走的。 */
function getTakenIdsFromPack(packKey, type, currentPlayer, currentRound) {
  const takenIds = new Set();
  const packIdx  = PLAYERS.indexOf(packKey);
  // 反向傳遞只在「分開輪抽 + 次發反向」時成立，其餘皆同向
  const reverseDir = type === 'min' && rs.draftFormat !== 'combined' && rs.minDir === 'reverse';
  for (let r = 0; r < currentRound; r++) {
    // 反推第 r 輪誰持有這包
    const holderIdx = reverseDir
      ? ((packIdx - r) % 4 + 4) % 4
      : (packIdx + r) % 4;
    const pick = rs.picks[PLAYERS[holderIdx]][type][r];
    if (pick) takenIds.add(pick['卡片ID']);
  }
  return takenIds;
}

function renderPickerCards(cards, takenIds, filter = '') {
  const grid = document.getElementById('slotPickerGrid');
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? cards.filter(c => (c['牌名'] || '').includes(filter.trim()) || (c['卡片ID'] || '').toLowerCase().includes(q))
    : cards;

  grid.innerHTML = '';
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="slot-picker-empty">找不到符合的牌</div>';
    return;
  }

  filtered.forEach(card => {
    const isTaken = takenIds.has(card['卡片ID']);
    const div = document.createElement('div');
    div.className = `slot-picker-card${isTaken ? ' taken' : ''}`;
    const special = getCardSpecialInfo(card['卡片ID']);
    div.innerHTML = `
      <canvas></canvas>
      <div class="slot-picker-card-name">${card['牌名'] || '—'}</div>
      ${isTaken ? '<div class="slot-picker-taken-label">已被選</div>' : ''}
      ${special && !isTaken ? `<div class="slot-picker-special-tag ${special.type}">${getBanShortLabel(special)}</div>` : ''}
      <button class="ad-card-info-btn" title="查看詳情">ℹ</button>
    `;

    div.querySelector('.ad-card-info-btn').addEventListener('click', e => {
      e.stopPropagation();
      openModal(card);
    });
    if (!isTaken) {
      div.addEventListener('click', e => {
        if (e.target.closest('.ad-card-info-btn')) return;
        selectCardForSlot(card);
      });
    }

    grid.appendChild(div);
    requestAnimationFrame(() => {
      drawCrop(div.querySelector('canvas'), card, 0.6);
    });
  });
}

function selectCardForSlot(card) {
  const { player, type, round } = rs.openSlot;
  rs.picks[player][type][round] = card;
  closeSlotPicker();
  renderSlots(player, type);
  updateNextBtn();
  saveDraftState();
}

function closeSlotPicker() {
  document.getElementById('slotPicker').style.display = 'none';
  document.getElementById('pickerBackdrop').style.display = 'none';
  document.querySelectorAll('.round-slot.open').forEach(s => s.classList.remove('open'));
  rs.openSlot = null;
}

/* ── Next Player / Finish ─────────────────────────── */
function bindInputNextBtn() {
  document.getElementById('inputNextBtn').addEventListener('click', () => {
    rs.currentInputPlayerIdx++;
    if (rs.currentInputPlayerIdx >= 4) {
      saveHistoryRecord();   // 歷史紀錄輸入完成 → 存進獨立槽（模擬模式不會覆蓋）
      showResult();
    } else {
      renderInputScreen();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  document.getElementById('inputBackBtn').addEventListener('click', () => {
    rs.currentInputPlayerIdx = 0;
    showScreen('setupScreen');
  });
}

/* ══════════════════════════════════════════════════
   ELO 抓取
   ══════════════════════════════════════════════════ */
async function fetchElo(cardIds) {
  rs.eloCache = {};
  if (!cardIds.length) return;
  try {
    const res = await fetch(`${FIRESTORE_BASE}:batchGet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documents: cardIds.map(id =>
          `projects/project-hub-410cd/databases/(default)/documents/agricola_ratings/${id}`)
      })
    });
    const data = await res.json();
    data.forEach(item => {
      if (item.found) {
        const id = item.found.name.split('/').pop();
        const f  = item.found.fields || {};
        rs.eloCache[id] = {
          elo:       Number(f.elo?.integerValue ?? f.elo?.doubleValue ?? 1200),
          seenCount: Number(f.seenCount?.integerValue ?? 0),
          rankSeen:  Number(f.rankSeen?.integerValue  ?? 0),
        };
      }
    });
  } catch { /* fail silently */ }
}

/* ══════════════════════════════════════════════════
   畫面三：評分結果
   ══════════════════════════════════════════════════ */
function showResult() {
  rs.phase = 'result';
  showScreen('resultScreen');
  buildResultCards();
  calculateAllScores();
  saveDraftState();
}

function buildResultCards() {
  const grid = document.getElementById('resultPlayerGrid');
  grid.innerHTML = '';
  PLAYERS.forEach(p => {
    const card = document.createElement('div');
    card.className = 'result-player-card';
    card.id = `resultCard${p}`;
    card.innerHTML = `
      <div class="result-player-header">
        <div class="result-rank-badge" id="rankBadge${p}">…</div>
        <div class="result-player-info">
          <div class="result-player-name">${getPlayerName(p)}</div>
          <div class="result-player-seat">位置 ${p} <button class="ph-open-btn" type="button">🔍 手牌大圖</button></div>
        </div>
        <div class="result-score-wrap">
          <div class="result-score-num score-color-${p}" id="scoreNum${p}">—</div>
          <div class="result-score-unit">分</div>
        </div>
      </div>
      <div class="result-score-bar-wrap">
        <div class="result-score-bar-track">
          <div class="result-score-bar-fill fill-${p}" id="scoreFill${p}" style="width:0%"></div>
        </div>
      </div>
      <div class="result-avg-elo" id="avgElo${p}">
        <span class="result-avg-elo-label">手牌平均 ELO</span>
        <b>…</b>
        <span class="result-avg-elo-divider">·</span>
        <span class="result-avg-elo-label">前4扣</span>
        <b class="avg-elo-first4">…</b>
      </div>
      <div class="result-hand-section">
        <div class="result-hand-label">職業牌 <span class="hand-avg-elo" id="occAvgElo${p}"></span></div>
        <div class="result-hand-thumbs" id="occHand${p}"></div>
      </div>
      <div class="result-hand-section">
        <div class="result-hand-label">次要發展牌 <span class="hand-avg-elo" id="minAvgElo${p}"></span></div>
        <div class="result-hand-thumbs" id="minHand${p}"></div>
      </div>
      <div class="result-analysis-section">
        <div class="result-analysis-label">選牌分析</div>
        <div class="result-analysis-calculating" id="analysis${p}">計算中…</div>
      </div>
    `;
    grid.appendChild(card);
    const header = card.querySelector('.result-player-header');
    header.classList.add('ph-clickable');
    header.title = '點擊查看手牌大圖';
    header.addEventListener('click', () => openPlayerHand(p));
    card.querySelector('.ph-open-btn').addEventListener('click', e => {
      e.stopPropagation();
      openPlayerHand(p);
    });
    renderHandThumbs(p, 'occ');
    renderHandThumbs(p, 'min');
  });
}

function renderHandThumbs(player, type) {
  const el = document.getElementById(`${type}Hand${player}`);
  el.innerHTML = '';
  rs.picks[player][type].forEach(card => {
    const div = document.createElement('div');
    div.className = 'result-hand-thumb';
    if (card) {
      const special = getCardSpecialInfo(card['卡片ID']);
      div.innerHTML = `
        <canvas></canvas>
        ${special ? `<div class="hand-special-badge ${special.type}">${getBanShortLabel(special)}</div>` : ''}
      `;
      div.title = `${card['牌名'] || '—'}${special ? ` (預設ELO ${special.eloPreset})` : ''}`;
      div.addEventListener('click', () => openModal(card));
      requestAnimationFrame(() => drawCrop(div.querySelector('canvas'), card, 1));
    }
    el.appendChild(div);
  });
}

/* ── 評分演算法 ───────────────────────────────────── */
async function calculateAllScores() {
  // 等 ELO 資料載入（最多 5 秒）
  const deadline = Date.now() + 5000;
  while (Object.keys(rs.eloCache).length === 0 && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 200));
  }

  const REFERENCE_GAP     = 150;
  const NEAR_TIE_TOLERANCE = 20;

  const cardById = {};
  allCards.forEach(c => { cardById[c['卡片ID']] = c; });

  // 為每位玩家計算
  const scores = {};
  PLAYERS.forEach(p => {
    const playerIdx = PLAYERS.indexOf(p);
    const rounds = [];

    // 7 輪職業 + 7 輪次要
    ['occ', 'min'].forEach(type => {
      for (let round = 0; round < DRAFT_ROUNDS; round++) {
        const picked = rs.picks[p][type][round];
        if (!picked) continue;

        const packKey   = type === 'occ' ? occPackKey(playerIdx, round) : minPackKey(playerIdx, round);
        const packCards = type === 'occ' ? rs.packs[packKey].occs : rs.packs[packKey].minors;

        // 計算此輪「可見的牌」= 包內容 − 在此之前持有這包的玩家選走的牌
        const takenIds  = getTakenIdsFromPack(packKey, type, p, round);
        const available = packCards.filter(c => !takenIds.has(c['卡片ID']));

        rounds.push({
          picked:    picked['卡片ID'],
          opponents: available.filter(c => c['卡片ID'] !== picked['卡片ID']).map(c => c['卡片ID']),
          roundNum:  round + 1,
          phaseLabel: type === 'occ' ? '職業卡輪抽' : '次要發展卡輪抽',
        });
      }
    });

    const roundDetails = rounds.map(({ picked, opponents, roundNum, phaseLabel }) => {
      const all       = [picked, ...opponents];
      const maxElo    = Math.max(...all.map(getAdjElo));
      const pickedElo = getAdjElo(picked);
      const gap       = maxElo - pickedElo;
      const eff       = gap <= NEAR_TIE_TOLERANCE
        ? 1
        : Math.min(1, Math.max(0, 1 - (gap - NEAR_TIE_TOLERANCE) / REFERENCE_GAP));
      const bestId    = all.find(id => getAdjElo(id) === maxElo);
      return { picked, bestId, gap: Math.round(gap), roundScore: Math.round(eff * 100), efficiency: eff, roundNum, phaseLabel };
    });

    const total = roundDetails.length
      ? Math.round(roundDetails.reduce((s, r) => s + r.efficiency, 0) / roundDetails.length * 100)
      : 0;

    scores[p] = { total, roundDetails };
  });

  // 排名
  const ranking = PLAYERS.slice().sort((a, b) => scores[b].total - scores[a].total);
  const rankEmojis = ['🥇', '🥈', '🥉', '4th'];

  ranking.forEach((p, i) => {
    document.getElementById(`rankBadge${p}`).textContent = rankEmojis[i];
    document.getElementById(`resultCard${p}`).classList.add(`rank-${i + 1}`);
  });

  // 顯示分數與分析
  PLAYERS.forEach(p => {
    const { total, roundDetails } = scores[p];

    // 分數
    document.getElementById(`scoreNum${p}`).textContent = total;
    setTimeout(() => {
      document.getElementById(`scoreFill${p}`).style.width = `${total}%`;
    }, 50);

    // 手牌平均 ELO
    const handAvg = calcHandAvgElo(p);
    document.querySelector(`#avgElo${p} b:first-of-type`).textContent = handAvg.all ?? '—';
    document.querySelector(`#avgElo${p} .avg-elo-first4`).textContent = handAvg.first4 ?? '—';
    document.getElementById(`occAvgElo${p}`).textContent = handAvg.occ != null ? `· 平均 ${handAvg.occ}` : '';
    document.getElementById(`minAvgElo${p}`).textContent = handAvg.min != null ? `· 平均 ${handAvg.min}` : '';

    // 分析：最差的最多 3 輪
    const worst = roundDetails
      .filter(r => r.roundScore < 60 && r.picked !== r.bestId)
      .sort((a, b) => a.roundScore - b.roundScore)
      .slice(0, 3);

    const analysisEl = document.getElementById(`analysis${p}`);
    const nameOf = id => cardById[id]?.['牌名'] || id;

    // 使用預設 ELO 的牌清單
    const allPickedIds = [
      ...rs.picks[p].occ.filter(Boolean).map(c => c['卡片ID']),
      ...rs.picks[p].min.filter(Boolean).map(c => c['卡片ID']),
    ];
    const presetEloItems = allPickedIds
      .map(id => ({ id, special: getCardSpecialInfo(id) }))
      .filter(x => {
        if (!x.special) return false;
        // BGA 牌組禁卡已進評分系統（eloCache 有文件）→ 不再列入「使用預設」清單
        if (x.special.type === 'ban') {
          const card = allCards.find(c => c['卡片ID'] === x.id);
          if (card && BGA_DECKS.includes(card['牌組']) && rs.eloCache[x.id]) return false;
        }
        return true;
      });

    const presetHtml = presetEloItems.length
      ? `<div class="result-preset-elo-section">
           <div class="result-preset-elo-title">📌 使用預設 ELO 的牌</div>
           <ul class="result-preset-elo-list">
             ${presetEloItems.map(({ id, special }) =>
               `<li>
                 <span class="result-preset-elo-badge ${special.type}">${getBanShortLabel(special)}</span>
                 <span class="result-preset-elo-name">${nameOf(id)}</span>
                 <span class="result-preset-elo-val">ELO ${special.eloPreset}</span>
               </li>`
             ).join('')}
           </ul>
         </div>`
      : '';

    if (worst.length === 0) {
      analysisEl.outerHTML = `
        <div id="analysis${p}">
          <div class="result-analysis-none">✓ 選牌決策良好，無明顯失誤</div>
          ${presetHtml}
        </div>`;
      return;
    }

    analysisEl.outerHTML = `
      <div id="analysis${p}">
        <ul class="result-analysis-list">
          ${worst.map(r => `
            <li class="result-analysis-item">
              <div class="result-analysis-round">${r.phaseLabel} 第 ${r.roundNum} / ${DRAFT_ROUNDS} 輪 · 得 ${r.roundScore} 分</div>
              選了「<strong>${nameOf(r.picked)}</strong>」，
              但「<strong>${nameOf(r.bestId)}</strong>」評分更高（ELO 差約 ${r.gap} 分）
            </li>
          `).join('')}
        </ul>
        ${presetHtml}
      </div>
    `;
  });
}

/* ══════════════════════════════════════════════════
   畫面切換
   ══════════════════════════════════════════════════ */
function showScreen(id, pushHistory = true) {
  document.querySelectorAll('.review-screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (pushHistory) history.pushState({ screen: id }, '', '');
}

window.addEventListener('popstate', e => {
  const screen = e.state?.screen;
  // 只處理往 setup 方向的返回；其餘一律回 setupScreen
  showScreen(screen === 'inputScreen' || screen === 'activeDraftScreen' ? screen : 'setupScreen', false);
});

function setDraftFormatCombined() {
  rs.draftFormat = 'combined';
  document.querySelectorAll('#draftFormatSelect .draft-fmt-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.format === 'combined');
  });
  document.getElementById('minDirGroup').style.display = 'none';
}

/* ══════════════════════════════════════════════════
   Global Events
   ══════════════════════════════════════════════════ */
function bindGlobalEvents() {
  // Draft format selection (分開 / 同時)
  document.querySelectorAll('#draftFormatSelect .draft-fmt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#draftFormatSelect .draft-fmt-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      rs.draftFormat = btn.dataset.format;
      // 同時輪抽不需要方向選擇器
      document.getElementById('minDirGroup').style.display = rs.draftFormat === 'combined' ? 'none' : '';
      saveDraftState();
    });
  });

  // Min direction selection (同向 / 反向)
  document.querySelectorAll('#minDirSelect .draft-dir-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#minDirSelect .draft-dir-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      rs.minDir = btn.dataset.dir;
      saveDraftState();
    });
  });

  // Hand size selection
  document.querySelectorAll('#handSizeSelect .hand-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#handSizeSelect .hand-size-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      rs.handSize = parseInt(btn.dataset.size, 10);
      // 從 sessionStorage 備份還原，再 trim 到新尺寸（保留 BGA 匯入資料）
      const _backup = (() => { try { return JSON.parse(sessionStorage.getItem('bga_import_backup')); } catch { return null; } })();
      PLAYERS.forEach(p => {
        const src = _backup?.[p];
        rs.packs[p].occs   = (src?.occs   || rs.packs[p].occs).slice(0, rs.handSize);
        rs.packs[p].minors = (src?.minors || rs.packs[p].minors).slice(0, rs.handSize);
      });
      PLAYERS.forEach(p => buildPackPanel(p));
      refreshPackProgressRow();
      updateStartBtn();
      saveDraftState();
    });
  });

  // Mode selection
  document.querySelectorAll('input[name="draftMode"]').forEach(radio => {
    radio.addEventListener('change', e => {
      rs.mode = parseInt(e.target.value, 10);
      document.getElementById('modeOptions').style.display = rs.mode === 2 ? 'flex' : 'none';
      if (rs.mode === 2) refreshHumanSeatSelect();
      
      // Update start button text
      const btn = document.getElementById('startInputBtn');
      if (rs.mode === 1) btn.innerHTML = '✦ 開始輸入扣牌紀錄';
      else if (rs.mode === 2) btn.innerHTML = '✦ 開始挑戰 AI';
      else if (rs.mode === 3) btn.innerHTML = '✦ 開始四人單機輪抽';
      else btn.innerHTML = '⚡ 全 AI 自動扣牌';
    });
  });
  document.getElementById('humanSeatSelect').addEventListener('change', e => {
    rs.humanSeat = e.target.value;
  });
  document.getElementById('aiStrategySelect')?.addEventListener('change', e => {
    rs.aiStrategy = e.target.value;
    document.getElementById('mimicHint').style.display = e.target.value === 'mimic' ? 'block' : 'none';
  });

  // 開始按鈕
  document.getElementById('startInputBtn').addEventListener('click', startSimulation);
  document.getElementById('viewResultBtn')?.addEventListener('click', viewHistoryResult);

  // 儲存 / 載入牌組
  document.getElementById('sessionSaveBtn').addEventListener('click', saveCurrentSession);
  document.getElementById('sessionLoadSelect').addEventListener('change', e => {
    const id = e.target.value;
    document.getElementById('sessionDeleteBtn').style.display = id ? '' : 'none';
    if (id) loadSession(id);
  });
  document.getElementById('sessionDeleteBtn').addEventListener('click', deleteCurrentSession);

  // Active Draft 防窺按鈕
  bindActiveDraftEvents();

  // Picker backdrop
  document.getElementById('pickerBackdrop').addEventListener('click', closeSlotPicker);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const modalWasOpen = document.getElementById('modalOverlay').classList.contains('open');
      closeSlotPicker();
      closeModal();
      if (!modalWasOpen) closePlayerHand();
    }
  });

  // Picker 搜尋
  document.getElementById('slotPickerSearch').addEventListener('input', e => {
    if (!rs.openSlot) return;
    const { player, type, round } = rs.openSlot;
    const playerIdx = PLAYERS.indexOf(player);
    const packKey   = type === 'occ' ? occPackKey(playerIdx, round) : minPackKey(playerIdx, round);
    const packCards = type === 'occ' ? rs.packs[packKey].occs : rs.packs[packKey].minors;
    const takenIds  = getTakenIdsFromPack(packKey, type, player, round);
    renderPickerCards(packCards, takenIds, e.target.value);
  });

  // 下一位玩家按鈕
  bindInputNextBtn();

  // 重新選擇模式（保留牌包與扣牌，方便返回後繼續編輯／換模式）
  document.getElementById('resultRestartBtn').addEventListener('click', () => {
    rs.phase = 'setup';
    rs.currentInputPlayerIdx = 0;
    updateViewResultBtn();
    showScreen('setupScreen');
  });

  // Modal
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // 玩家手牌大圖
  document.getElementById('playerHandClose').addEventListener('click', closePlayerHand);
  document.getElementById('playerHandOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closePlayerHand();
  });

  // BGA Import（快速匯入 dialog 已移除，改由 shareDialog import 模式處理）

  // 匯出 / 匯入此局
  document.getElementById('shareOpenBtn')?.addEventListener('click', () => openShareDialog('export'));
  document.getElementById('bgaPasteImportBtn')?.addEventListener('click', () => openShareDialog('import'));
  document.getElementById('bgaHelpBtn')?.addEventListener('click', openBgaHelpModal);
  document.getElementById('bgaHelpClose')?.addEventListener('click', closeBgaHelpModal);
  document.getElementById('bgaHelpOkBtn')?.addEventListener('click', closeBgaHelpModal);
  document.getElementById('bgaHelpOverlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeBgaHelpModal();
  });
  document.getElementById('resetAllBtn')?.addEventListener('click', resetAll);
  document.getElementById('shareCloseBtn')?.addEventListener('click', closeShareDialog);
  document.getElementById('shareCancelBtn')?.addEventListener('click', closeShareDialog);
  document.getElementById('shareCopyBtn')?.addEventListener('click', copyShareCode);
  document.getElementById('shareImportBtn')?.addEventListener('click', importShareCode);
  document.getElementById('shareOverlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeShareDialog();
  });
}

/* ══════════════════════════════════════════════════
   Canvas Crop（與 draft.js 相同邏輯）
   ══════════════════════════════════════════════════ */
function drawCrop(canvas, card, topFraction = 1, forceSheet = false) {
  if (!canvas || !card || !card.source_image) return;
  if (!forceSheet) {
    const singleCardPath = window.CardImages?.getPath?.(card);
    if (singleCardPath) {
      window.CardImages.draw(canvas, singleCardPath, topFraction, () => drawCrop(canvas, card, topFraction, true));
      return;
    }
  }
  const key = IMG_BASE + card.source_image;

  const draw = (img) => {
    const isComposite = card.source_image.includes('部分.jpg') || card.source_image.includes('舊版');
    const src = card.source_image;
    const isNLtmpl = /^NL\d/i.test(src) || /^FL/i.test(src) || /^G\d/i.test(src);
    const isOdeck  = /^O[mo]/i.test(src);
    const isTTS    = src.startsWith('FR') || src.startsWith('Gm') || src.startsWith('Go')
                  || src.toLowerCase().startsWith('wa') || src.toLowerCase().startsWith('wm')
                  || src.toLowerCase().startsWith('bi') || src.toLowerCase().startsWith('z');

    const cols = card.grid_cols || (isComposite ? 10 : GRID_COLS);
    const rows = card.grid_rows || (isComposite ? 3  : GRID_ROWS);

    let base;
    if (isOdeck || isTTS || isComposite) base = { l: 0, t: 0, r: 0, b: 0 };
    else if (isNLtmpl)                   base = { l: 182, t: 114, r: 166, b: 101 };
    else                                 base = { l: CROP_DEF.offsetLeft, t: CROP_DEF.offsetTop, r: CROP_DEF.offsetRight, b: CROP_DEF.offsetBottom };

    const scaleCropX = (value) => value === 0 ? 0 : value * img.naturalWidth / CROP_REF.width;
    const scaleCropY = (value) => value === 0 ? 0 : value * img.naturalHeight / CROP_REF.height;
    const oL = scaleCropX(card.crop_left   !== undefined ? card.crop_left   : base.l);
    const oR = scaleCropX(card.crop_right  !== undefined ? card.crop_right  : base.r);
    const oT = scaleCropY(card.crop_top    !== undefined ? card.crop_top    : base.t);
    const oB = scaleCropY(card.crop_bottom !== undefined ? card.crop_bottom : base.b);

    const usableW = img.naturalWidth  - oL - oR;
    const usableH = img.naturalHeight - oT - oB;
    const cellW   = usableW / cols;
    const cellH   = usableH / rows;
    const drawH   = cellH * topFraction;

    canvas.width  = cellW;
    canvas.height = drawH;
    const ctx = canvas.getContext('2d');
    const sx  = oL + (card.grid_col || 0) * cellW;
    const sy  = oT + (card.grid_row || 0) * cellH;
    ctx.drawImage(img, sx, sy, cellW, drawH, 0, 0, cellW, drawH);
  };

  if (imageCache[key]) {
    draw(imageCache[key]);
  } else {
    const img = new Image();
    img.onload = () => { imageCache[key] = img; draw(img); };
    img.onerror = () => {
      canvas.width = 120; canvas.height = Math.round(90 * topFraction);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1d2437';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    img.src = key;
  }
}

/* ── 玩家手牌大圖 ─────────────────────────────────── */
function openPlayerHand(p) {
  document.getElementById('playerHandTitle').textContent =
    `${getPlayerName(p)}（位置 ${p}）的手牌`;
  const body = document.getElementById('playerHandBody');
  body.innerHTML = '';

  [['occ', '職業牌'], ['min', '次要發展牌']].forEach(([type, label]) => {
    const cards = rs.picks[p][type].filter(Boolean);
    if (!cards.length) return;
    const section = document.createElement('div');
    section.className = 'ph-section';
    section.innerHTML = `<div class="ph-section-label">${label}（${cards.length} 張）</div>`;
    const grid = document.createElement('div');
    grid.className = 'ph-grid';

    cards.forEach(card => {
      const special = getCardSpecialInfo(card['卡片ID']);
      const item = document.createElement('div');
      item.className = 'ph-card';
      item.innerHTML = `
        <div class="ph-thumb">
          <canvas></canvas>
          ${special ? `<div class="hand-special-badge ${special.type}">${getBanShortLabel(special)}</div>` : ''}
        </div>
        <div class="ph-name">${card['牌名'] || '—'}</div>
        <div class="ph-elo">ELO ${Math.round(getAdjElo(card['卡片ID']))}</div>
      `;
      item.addEventListener('click', () => openModal(card));
      grid.appendChild(item);
      requestAnimationFrame(() => drawCrop(item.querySelector('canvas'), card, 1));
    });

    section.appendChild(grid);
    body.appendChild(section);
  });

  document.getElementById('playerHandOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePlayerHand() {
  document.getElementById('playerHandOverlay').classList.remove('open');
  if (!document.getElementById('modalOverlay').classList.contains('open')) {
    document.body.style.overflow = '';
  }
}

/* ══════════════════════════════════════════════════
   Modal（與 draft.js 相同邏輯）
   ══════════════════════════════════════════════════ */
function openModal(card) {
  document.getElementById('modalTitle').textContent = card['牌名'] || '—';
  document.getElementById('modalId').textContent    = card['卡片ID'] || '';
  CardModal.renderTypeBadge(document.getElementById('modalBadge'), card);
  document.getElementById('modalDesc').textContent  = card['說明'] || '—';

  const fieldsEl  = document.getElementById('modalFields');
  CardModal.renderFields(fieldsEl, CardModal.fieldDefs(card));

  drawCrop(document.getElementById('modalCanvas'), card);
  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  const handOpen = document.getElementById('playerHandOverlay').classList.contains('open');
  if (!handOpen) document.body.style.overflow = '';
}

/* ══════════════════════════════════════════════════
   Start
   ══════════════════════════════════════════════════ */
init();
