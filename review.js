/* ══════════════════════════════════════════════════
   農家樂 覆盤輪抽模擬 — review.js
   ══════════════════════════════════════════════════ */

const IMG_BASE   = './images/';
const GRID_COLS  = 3;
const GRID_ROWS  = 3;
const CROP_DEF   = { offsetTop: 113, offsetBottom: 99, offsetLeft: 182, offsetRight: 164 };
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';

const BGA_DECKS          = ['A', 'B', 'C', 'D', 'E'];
const BANLIST_CACHE_KEY  = 'agricola_banlist_cache';
const BANLIST_CACHE_TTL  = 24 * 60 * 60 * 1000;
const SCORE_ELO_CEILING  = 1300;

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
  職業牌：向左傳（A→B→C→D→A）
  playerIdx: 0=A, 1=B, 2=C, 3=D；round: 0~6
*/
function occPackKey(playerIdx, round) {
  return PLAYERS[(playerIdx + round) % 4];
}
/* 次要發展牌：反向（A→D→C→B→A） */
function minPackKey(playerIdx, round) {
  return PLAYERS[((playerIdx - round) % 4 + 4) % 4];
}

/* ── State ─────────────────────────────────────────*/
let allCards   = [];
let imageCache = {};

const rs = {
  phase: 'setup',  // setup | input | result
  bgaMode: false,

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

  // Slot Picker 當前狀態
  openSlot: null,  // { player, type('occ'|'min'), round }
};

/* ══════════════════════════════════════════════════
   Init
   ══════════════════════════════════════════════════ */
async function init() {
  const [data, dupInfo] = await Promise.all([
    fetch('./cards.json').then(r => r.json()),
    loadDupExclusions(),
    loadBanlist(),
  ]);
  allCards = data;
  dupExcludedIds = dupInfo;
  buildBannedIdMap();
  buildSetupScreen();
  bindGlobalEvents();
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

/* 取得 ELO 用於評分：禁卡/重複卡一律用預設，不套信心度收斂 */
function getAdjElo(cardId) {
  const special = getCardSpecialInfo(cardId);
  if (special) return special.eloPreset;
  const r    = rs.eloCache[cardId] || { elo: 1200, seenCount: 0 };
  const conf = Math.min(r.seenCount / 30, 1);
  return Math.min(conf * r.elo + (1 - conf) * 1200, SCORE_ELO_CEILING);
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
    });
  });

  document.getElementById('bgaModeToggle').addEventListener('change', e => {
    rs.bgaMode = e.target.checked;
    document.getElementById('bgaModeBar').classList.toggle('active', rs.bgaMode);
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
  });


}

function getPlayerName(p) {
  return rs.playerNames[p] || `玩家${p}`;
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
            <span class="card-count-badge" id="occCount${p}">0 / 9</span>
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
            <span class="card-count-badge" id="minCount${p}">0 / 9</span>
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
  if (list.length >= 9) return;
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
  if (list.length < 9) searchEl.focus();
}

function removeCardFromPack(player, type, cardId) {
  const key  = type === 'occ' ? 'occs' : 'minors';
  rs.packs[player][key] = rs.packs[player][key].filter(c => c['卡片ID'] !== cardId);
  renderPackList(player, type);
  updatePackCountBadge(player, type);
  updateStartBtn();
  refreshPackProgressRow();
}

function renderPackList(player, type) {
  const key    = type === 'occ' ? 'occs' : 'minors';
  const list   = rs.packs[player][key];
  const listEl = document.getElementById(`${type}List${player}`);
  if (list.length === 0) {
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
}

function updatePackCountBadge(player, type) {
  const key   = type === 'occ' ? 'occs' : 'minors';
  const count = rs.packs[player][key].length;
  const el    = document.getElementById(`${type}Count${player}`);
  el.textContent = `${count} / 9`;
  el.classList.toggle('full', count === 9);
  // 搜尋欄 disabled
  const searchEl = document.getElementById(`${type}Search${player}`);
  searchEl.disabled = count >= 9;
  searchEl.placeholder = count >= 9 ? '已選滿 9 張' : (type === 'occ' ? '搜尋職業牌名稱或 ID…' : '搜尋次要發展牌名稱或 ID…');
}

function buildPackProgressRow() {
  refreshPackProgressRow();
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
        <span class="pack-progress-occ">職業 ${occN}/9</span>
        <span class="pack-progress-sep">·</span>
        <span class="pack-progress-min">次要 ${minN}/9</span>
      </div>
    `;
    row.appendChild(cell);
  });
}

function isPackFull(player) {
  return rs.packs[player].occs.length === 9 && rs.packs[player].minors.length === 9;
}

function updateStartBtn() {
  const allFull = PLAYERS.every(isPackFull);
  document.getElementById('startInputBtn').disabled = !allFull;
}

/* ══════════════════════════════════════════════════
   啟動模擬流程 (分流各種模式)
   ══════════════════════════════════════════════════ */
async function startSimulation() {
  // 重設所有人的扣牌紀錄
  PLAYERS.forEach(p => {
    rs.picks[p] = { occ: Array(7).fill(null), min: Array(7).fill(null) };
  });

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
    for (let round = 0; round < 7; round++) {
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
  rs.draftState = { type: 'occ', round: 0, turn: 0 }; // turn: 0=A, 1=B, 2=C, 3=D
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
    const packKey = type === 'occ' ? occPackKey(playerIdx, round) : minPackKey(playerIdx, round);
    const card = getAiPick(packKey, type, player, round);
    rs.picks[player][type][round] = card;
    
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
    if (rs.draftState.round >= 7) {
      rs.draftState.round = 0;
      if (rs.draftState.type === 'occ') {
        rs.draftState.type = 'min';
      } else {
        rs.draftState.type = 'done';
      }
    }
  }
}

function getAiPick(packKey, type, player, round) {
  const packCards = type === 'occ' ? rs.packs[packKey].occs : rs.packs[packKey].minors;
  const takenIds = getTakenIdsFromPack(packKey, type, player, round);
  const available = packCards.filter(c => !takenIds.has(c['卡片ID']));
  
  if (available.length === 0) return null; // 不應發生

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

function renderActiveDraftScreen() {
  const { type, round, turn } = rs.draftState;
  const player = PLAYERS[turn];
  const playerIdx = PLAYERS.indexOf(player);
  const packKey = type === 'occ' ? occPackKey(playerIdx, round) : minPackKey(playerIdx, round);
  
  // Header
  document.getElementById('adRoundLabel').textContent = `${type === 'occ' ? '職業卡' : '次要發展卡'} 第 ${round + 1} / 7 輪`;
  document.getElementById('adTurnName').textContent = getPlayerName(player);
  document.getElementById('adTurnName').className = `ad-turn-name score-color-${player}`;
  
  // Board (該玩家這輪之前選的牌，共 7 格)
  const boardGrid = document.getElementById('adBoardGrid');
  boardGrid.innerHTML = '';
  for (let r = 0; r < 7; r++) {
    const slot = document.createElement('div');
    slot.className = 'ad-board-slot';
    const picked = rs.picks[player][type][r];
    if (picked) {
      slot.classList.add('has-card');
      slot.innerHTML = `<canvas></canvas>`;
      slot.title = picked['牌名'] || '';
      requestAnimationFrame(() => drawCrop(slot.querySelector('canvas'), picked, 1));
    } else {
      if (r === round) slot.innerHTML = `<span style="font-size:1.5rem;color:var(--gold);">?</span>`; // 當前要選的位子
    }
    boardGrid.appendChild(slot);
  }

  // Pack (傳來的牌包，扣除被前人選走的)
  const packCards = type === 'occ' ? rs.packs[packKey].occs : rs.packs[packKey].minors;
  const takenIds = getTakenIdsFromPack(packKey, type, player, round);
  const available = packCards.filter(c => !takenIds.has(c['卡片ID']));
  
  document.getElementById('adPackTitle').textContent = `來自 ${getPlayerName(packKey)} 的牌包`;
  const packGrid = document.getElementById('adPackGrid');
  packGrid.innerHTML = '';
  available.forEach(card => {
    const special = getCardSpecialInfo(card['卡片ID']);
    const cEl = document.createElement('div');
    cEl.className = 'ad-pack-card';
    cEl.innerHTML = `
      <canvas></canvas>
      <div class="ad-pack-card-name">${card['牌名'] || '—'}</div>
      ${special ? `<div class="slot-picker-special-tag ${special.type}">${getBanShortLabel(special)}</div>` : ''}
    `;
    cEl.addEventListener('click', () => {
      rs.picks[player][type][round] = card;
      advanceDraftState();
      nextDraftTurn();
    });
    packGrid.appendChild(cEl);
    requestAnimationFrame(() => drawCrop(cEl.querySelector('canvas'), card, 0.7));
  });
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
    const isDone   = i < rs.currentInputPlayerIdx;
    const isActive = i === rs.currentInputPlayerIdx;
    step.className = `input-progress-step${isDone ? ' done' : ''}${isActive ? ' active' : ''}`;
    step.innerHTML = `<span class="step-dot"></span>${getPlayerName(p)}`;
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

  for (let round = 0; round < 7; round++) {
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
        <div class="round-slot-round">第 ${round + 1} / 7 輪</div>
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
  const player = PLAYERS[rs.currentInputPlayerIdx];
  const total  = countPlayerPicks(player);
  document.getElementById('inputPickCount').innerHTML =
    `已選 <strong>${total}</strong> / 14 張`;
  document.getElementById('inputNextBtn').disabled = total < 14;
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
    `第 ${round + 1} / 7 輪 · ${packName}`;
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

/* 計算哪些牌已被「比這位玩家早拿到這包」的其他玩家選走 */
function getTakenIdsFromPack(packKey, type, currentPlayer, currentRound) {
  const takenIds = new Set();
  const playerIdx = PLAYERS.indexOf(currentPlayer);

  PLAYERS.forEach((otherPlayer, otherIdx) => {
    if (otherPlayer === currentPlayer) return;
    for (let r = 0; r < 7; r++) {
      const theirPackKey = type === 'occ' ? occPackKey(otherIdx, r) : minPackKey(otherIdx, r);
      if (theirPackKey !== packKey) continue;
      const theirPick = rs.picks[otherPlayer][type][r];
      if (!theirPick) continue;
      // 判斷對方「比這位玩家早」拿到這包
      // 方法：在這包的循環路徑中，對方的輪次是否在這位玩家之前
      if (isEarlierInPackPath(packKey, type, otherPlayer, r, currentPlayer, currentRound)) {
        takenIds.add(theirPick['卡片ID']);
      }
    }
  });

  return takenIds;
}

/* 判斷 (playerA, roundA) 是否比 (playerB, roundB) 更早持有同一個包 */
function isEarlierInPackPath(packKey, type, playerA, roundA, playerB, roundB) {
  // 這個包在路徑中的訪問順序：
  // 職業牌：包 packKey 的初始持有者 = packKey 對應的玩家（P_X 在 R1 持有 X 包）
  // 次要牌：同上
  // 之後按傳遞方向依次是下一位玩家

  // 找出 packKey 最初的持有者（round=0 時誰持有這包）
  const packOriginIdx = PLAYERS.indexOf(packKey);

  // 職業：傳遞順序 packOriginIdx, packOriginIdx-1, packOriginIdx-2, ...（向左傳）
  // 等價於：第 k 個持有者是 (packOriginIdx - k + 4) % 4
  // 次要：傳遞順序 packOriginIdx, packOriginIdx+1, packOriginIdx+2, ...（向右傳）
  // 等價於：第 k 個持有者是 (packOriginIdx + k) % 4

  function getHolderOrder(k) {
    if (type === 'occ') return (packOriginIdx - k + 8) % 4;
    else                return (packOriginIdx + k) % 4;
  }

  // 找 playerA 在這包路徑中的位置
  let posA = -1, posB = -1;
  for (let k = 0; k < 7; k++) {
    const holderIdx = getHolderOrder(k);
    if (holderIdx === PLAYERS.indexOf(playerA) && posA === -1) posA = k;
    if (holderIdx === PLAYERS.indexOf(playerB) && posB === -1) {
      // 如果同一個玩家第二次出現（包繞回來），要匹配 round
      if (k === posB) break;
      posB = k;
    }
  }
  // 更精確：用 round 來確認
  // playerA 在 roundA 持有這包，playerB 在 roundB 持有這包
  // 所以直接比較在包路徑中的絕對順序即可
  // 路徑中的出現次序 = 每 4 輪循環一次，找各自對應的最小 k
  function findPackPos(player, round) {
    const playerIdx = PLAYERS.indexOf(player);
    for (let k = 0; k < 7; k++) {
      if (getHolderOrder(k) === playerIdx) {
        // 確認 round 是否對應
        if (type === 'occ') {
          if (occPackKey(playerIdx, round) === packKey) {
            // 找到了，這個 k 就是這次的順序
            return k;
          }
        } else {
          if (minPackKey(playerIdx, round) === packKey) {
            return k;
          }
        }
      }
    }
    return 999;
  }

  const kA = findPackPos(playerA, roundA);
  const kB = findPackPos(playerB, roundB);
  return kA < kB;
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
    `;

    if (!isTaken) {
      div.addEventListener('click', () => selectCardForSlot(card));
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
      showResult();
    } else {
      renderInputScreen();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
          <div class="result-player-seat">位置 ${p}</div>
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
      <div class="result-hand-section">
        <div class="result-hand-label">職業牌</div>
        <div class="result-hand-thumbs" id="occHand${p}"></div>
      </div>
      <div class="result-hand-section">
        <div class="result-hand-label">次要發展牌</div>
        <div class="result-hand-thumbs" id="minHand${p}"></div>
      </div>
      <div class="result-analysis-section">
        <div class="result-analysis-label">選牌分析</div>
        <div class="result-analysis-calculating" id="analysis${p}">計算中…</div>
      </div>
    `;
    grid.appendChild(card);
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
      for (let round = 0; round < 7; round++) {
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
      .filter(x => x.special !== null);

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
              <div class="result-analysis-round">${r.phaseLabel} 第 ${r.roundNum} / 7 輪 · 得 ${r.roundScore} 分</div>
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
function showScreen(id) {
  document.querySelectorAll('.review-screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ══════════════════════════════════════════════════
   Global Events
   ══════════════════════════════════════════════════ */
function bindGlobalEvents() {
  // Mode selection
  document.querySelectorAll('input[name="draftMode"]').forEach(radio => {
    radio.addEventListener('change', e => {
      rs.mode = parseInt(e.target.value, 10);
      document.getElementById('modeOptions').style.display = rs.mode === 2 ? 'flex' : 'none';
      
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

  // 開始按鈕
  document.getElementById('startInputBtn').addEventListener('click', startSimulation);

  // Active Draft 防窺按鈕
  bindActiveDraftEvents();

  // Picker backdrop
  document.getElementById('pickerBackdrop').addEventListener('click', closeSlotPicker);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeSlotPicker();
      closeModal();
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

  // 重新輸入
  document.getElementById('resultRestartBtn').addEventListener('click', () => {
    rs.phase = 'setup';
    rs.currentInputPlayerIdx = 0;
    PLAYERS.forEach(p => {
      rs.picks[p] = { occ: Array(7).fill(null), min: Array(7).fill(null) };
    });
    showScreen('setupScreen');
  });

  // Modal
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
}

/* ══════════════════════════════════════════════════
   Canvas Crop（與 draft.js 相同邏輯）
   ══════════════════════════════════════════════════ */
function drawCrop(canvas, card, topFraction = 1) {
  if (!canvas || !card || !card.source_image) return;
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

    const oL = card.crop_left   !== undefined ? card.crop_left   : base.l;
    const oR = card.crop_right  !== undefined ? card.crop_right  : base.r;
    const oT = card.crop_top    !== undefined ? card.crop_top    : base.t;
    const oB = card.crop_bottom !== undefined ? card.crop_bottom : base.b;

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

/* ══════════════════════════════════════════════════
   Modal（與 draft.js 相同邏輯）
   ══════════════════════════════════════════════════ */
function openModal(card) {
  const typeName = card.card_type === 'minor' ? '次要發展卡'
                 : card.card_type === 'occupation' ? '職業卡'
                 : '次要發展卡及主要發展卡';
  document.getElementById('modalTitle').textContent = card['牌名'] || '—';
  document.getElementById('modalId').textContent    = card['卡片ID'] || '';
  document.getElementById('modalBadge').className   = `modal-badge badge-${card.card_type}`;
  document.getElementById('modalBadge').textContent = typeName;
  document.getElementById('modalDesc').textContent  = card['說明'] || '—';

  const fieldsEl  = document.getElementById('modalFields');
  fieldsEl.innerHTML = '';
  const fieldDefs = card.card_type === 'occupation'
    ? [['需求人數', card['需求人數']], ['紅利分數', card['紅利分數']], ['牌組', card['牌組']]]
    : [['先決條件', card['先決條件']], ['費用', card['費用']], ['是否傳遞', card['是否傳遞']],
       ['勝利點數', card['勝利點數'], 'vp'], ['紅利分數', card['紅利分數'], 'bonus'], ['牌組', card['牌組']]];

  fieldDefs.forEach(([label, value, hi]) => {
    if (!value) return;
    const cls = hi === 'vp' && value !== '無' ? 'highlight-vp'
              : hi === 'bonus' && value === '有' ? 'highlight-bonus' : '';
    const row = document.createElement('div');
    row.className = 'field-row';
    row.innerHTML = `<div class="field-label">${label}</div><div class="field-value ${cls}">${value}</div>`;
    fieldsEl.appendChild(row);
  });

  drawCrop(document.getElementById('modalCanvas'), card);
  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

/* ══════════════════════════════════════════════════
   Start
   ══════════════════════════════════════════════════ */
init();
