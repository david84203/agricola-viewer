/* ══════════════════════════════════════════════════
   農家樂 Draft Simulator — draft.js
   ══════════════════════════════════════════════════ */

const IMG_BASE = './images/';
const GRID_COLS = 3;
const GRID_ROWS = 3;
const CROP = {
  offsetTop:    113,
  offsetBottom: 99,
  offsetLeft:   182,
  offsetRight:  164,
};

const BGA_DECKS = ['A', 'B', 'C', 'D', 'E'];
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';

// 禁卡表（不進入輪抽池）— 從 Firestore 載入後會覆蓋此預設值
let BANNED_GROUPS = [
  { label: '過強職業卡',     ids: ['FL049', 'A127', 'I251', 'I260', 'I234', 'I255', '8720-9', '7873-7', '7252-3', '6022-5', '舊版E198', 'K270', 'NL098', 'PI10', 'PI03', 'PI06', 'Z329', 'Ö03', 'Ö01', '2913-2'] },
  { label: '過強次要發展卡', ids: ['B010*', '906-8', 'A010', 'B021', 'A048', 'C031', '6515-6', '5869-10', '5881-9', '4988-8', 'I081', 'Z320', 'K138', 'K125', 'Ö13', 'Ö17', '6044-7', 'Ö20', '9244-5', '12019-2'] },
  { label: '過爛職業卡',     ids: ['A107', 'A151', 'C144*', 'C111', 'D158*', 'B146', 'C157', 'B101', 'D140', 'A154', '舊版E158', '舊版E170', '舊版E155', 'I247', '舊版E198', '舊版E171', '5030-2', 'Ö05', 'K304', 'Ö02', '5698-2', 'WM033', 'Ö09', '6575-4', 'WA042', 'Z333', 'K317', 'FL053', 'A100', 'A132', 'B147', 'I224'] },
  { label: '過爛次要發展卡', ids: ['C058', 'B052', 'B018', '舊版E17', '舊版E29', 'I093', '舊版E51', '8315', '6960-2', 'NL023', 'K109', 'FL016', 'FL028', 'Z324', 'FL021', 'NL025'] },
  { label: '擾亂戰局',       ids: ['C093', 'C130', 'C003*', 'B022', 'Ö04', 'PI17'] },
];
let BANNED_IDS = new Set(BANNED_GROUPS.flatMap(g => g.ids));

const BANLIST_CACHE_KEY  = 'agricola_banlist_cache';
const BANLIST_CACHE_TTL  = 24 * 60 * 60 * 1000; // 24 hours
const PROGRESS_CACHE_KEY = 'agricola_progress_cache';
const PROGRESS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function loadBanlist() {
  try {
    let groups = null;
    const cached = (() => {
      try {
        const s = JSON.parse(localStorage.getItem(BANLIST_CACHE_KEY));
        return s && Date.now() - s.cachedAt < BANLIST_CACHE_TTL ? s.data : null;
      } catch { return null; }
    })();

    if (cached) {
      groups = cached;
    } else {
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
      const hardcodedIds = BANNED_IDS; // capture before overwrite
      BANNED_GROUPS = groups;
      BANNED_IDS = new Set([...hardcodedIds, ...BANNED_GROUPS.flatMap(g => g.ids)]);
    }
  } catch { /* 使用 hardcode fallback */ }
}

function getCardKey(card) {
  return [card['卡片ID'] || '', card.source_image || '', card.position ?? ''].join('|');
}

// Round configs: simPicks = how many cards to randomly remove at the START of this round
const OCC_ROUNDS = [
  { pack: 'A', simPicks: 0 },  // R1: your pack, fresh
  { pack: 'B', simPicks: 1 },  // R2: P2 already picked 1
  { pack: 'C', simPicks: 2 },  // R3: P2, P3 each picked 1
  { pack: 'D', simPicks: 3 },  // R4: P2, P3, P4 each picked 1
  { pack: 'A', simPicks: 3 },  // R5: your pack returns, 3 more removed by others
  { pack: 'B', simPicks: 3 },  // R6: pack B returns, 3 more removed
  { pack: 'C', simPicks: 3 },  // R7: pack C returns, 3 more removed
];

// Minor: reverse direction (packs come from the other side)
const MIN_ROUNDS = [
  { pack: 'A', simPicks: 0 },  // R1: your pack, fresh
  { pack: 'D', simPicks: 1 },  // R2: P4 already picked 1
  { pack: 'C', simPicks: 2 },  // R3: P4, P3 each picked 1
  { pack: 'B', simPicks: 3 },  // R4: P4, P3, P2 each picked 1
  { pack: 'A', simPicks: 3 },  // R5: your pack returns, 3 more removed
  { pack: 'D', simPicks: 3 },  // R6: pack D returns, 3 more removed
  { pack: 'C', simPicks: 3 },  // R7: pack C returns, 3 more removed
];

// Combined mode: same left-pass direction for both types together
const COMBINED_ROUNDS = OCC_ROUNDS; // same pack order, but packs contain both types

let allCards = [];
let imageCache = {};

let state = {
  phase: 'setup',        // setup | occupation | transition | minor | result | combined
  draftMode: 'separate', // 'separate' | 'combined'
  selectedDecks: [],
  packs: {},             // { A: Card[], B: Card[], C: Card[], D: Card[] }
  removedIds: {},        // { A: Set<id>, B: Set<id>, ... }
  // combined mode: separate occ/minor packs with same pack keys
  occPacks: {}, minPacks: {},
  occRemovedIds: {}, minRemovedIds: {},
  packSize: 9,
  appliedSimRounds: new Set(),
  eloCache: {},          // { cardId: { elo, seenCount, pickCount, rankSeen } } — loaded at draft start for sim picks
  sTierIds: new Set(),   // Tier S 卡片ID（全卡庫前 8%）— sim picks 對這些卡信心度 100%
  currentRound: 0,
  occPicks: [],
  minPicks: [],
  selectedCard: null,       // for separate mode
  selectedOcc: null,        // for combined mode
  selectedMin: null,        // for combined mode
  roundConfig: null,
  currentPicks: null,
  // Rater mode
  raterMode: false,
  // Player mode (records personal session, never feeds ELO/Tier list)
  playerMode: false,
  shownLog: [],        // [{picked, opponents[]}] all rounds, used for score + rater upload
  comboTags: [],       // [{from, to, phase, round}] — "picked `to` because already holding `from`"
  pendingComboFrom: [],// 卡片ID[] — currently toggled combo-source cards for the active selection
  currentShown: [],    // cards shown this round (separate mode)
  currentOccShown: [], // occ cards shown this round (combined mode)
  currentMinShown: [], // min cards shown this round (combined mode)
};

// ── Duplicate exclusions ───────────────────────────
async function loadDupExclusions() {
  try {
    return (await DuplicateCards.loadDuplicateInfo()).excludedRefs;
  } catch { return new Set(); }
}

// ── Auth callback ──────────────────────────────────
function onAuthChange() {
  const rater   = typeof isRater === 'function' && isRater();
  const player  = typeof isPlayer === 'function' && isPlayer();
  const tracked = rater || player; // 兩者皆會累積個人輪抽紀錄

  document.getElementById('raterWrap').style.display          = rater ? '' : 'none';
  document.getElementById('raterLoginHint').style.display      = tracked ? 'none' : '';
  document.getElementById('playerModeNote').style.display      = player ? '' : 'none';
  document.getElementById('raterProgressWrap').style.display   = tracked ? '' : 'none';
  if (!tracked) return;
  loadRaterProgress();
}

// ── Rater mode lock (forces "separate" draft mode) ─
function applyRaterModeLock(locked) {
  const options = document.querySelectorAll('#modeSelect .mode-option');
  options.forEach(el => {
    el.classList.toggle('locked', locked && el.dataset.mode === 'combined');
  });
  if (locked) {
    options.forEach(o => o.classList.remove('selected'));
    document.querySelector('#modeSelect .mode-option[data-mode="separate"]')?.classList.add('selected');
    state.draftMode = 'separate';
  }
  const note = document.getElementById('raterModeNote');
  if (note) note.style.display = locked ? '' : 'none';
}

// ── Rater deck lock (forces "all decks") ───────────
function applyRaterDeckLock(locked) {
  document.querySelectorAll('#deckCheckboxes .deck-checkbox-label').forEach(el => {
    el.classList.toggle('locked', locked);
    if (locked) el.classList.add('checked');
  });
  document.querySelectorAll('.preset-btn').forEach(btn => { btn.disabled = locked; });
  const note = document.getElementById('raterDeckNote');
  if (note) note.style.display = locked ? '' : 'none';
}

async function loadRaterProgress() {
  const countEl = document.getElementById('raterProgressCount');
  const fillEl  = document.getElementById('raterProgressFill');
  const hintEl  = document.getElementById('raterProgressHint');
  const raterId = getRaterId();
  if (!raterId) return;

  try {
    let count = null;
    try {
      const s = JSON.parse(localStorage.getItem(PROGRESS_CACHE_KEY));
      if (s && s.raterId === raterId && Date.now() - s.cachedAt < PROGRESS_CACHE_TTL) count = s.count;
    } catch {}

    if (count === null) {
      const res = await fetch(`${FIRESTORE_BASE}:runAggregationQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredAggregationQuery: {
            structuredQuery: {
              from: [{ collectionId: 'agricola_sessions' }],
              where: {
                fieldFilter: {
                  field: { fieldPath: 'raterId' },
                  op: 'EQUAL',
                  value: { stringValue: raterId }
                }
              }
            },
            aggregations: [{ count: {}, alias: 'count' }]
          }
        })
      });
      const data = await res.json();
      count = Number(data[0]?.result?.aggregateFields?.count?.integerValue ?? 0);
      localStorage.setItem(PROGRESS_CACHE_KEY, JSON.stringify({ raterId, count, cachedAt: Date.now() }));
    }

    const unlockAt = 100;
    const pct = Math.min(count / unlockAt * 100, 100);
    countEl.textContent = `${count} / ${unlockAt} 場`;
    fillEl.style.width  = `${pct}%`;

    if (count >= unlockAt) {
      hintEl.innerHTML  = '🎉 個人分析已解鎖！<a href="profile.html" class="progress-profile-link">→ 查看個人分析</a>';
      hintEl.className  = 'rater-progress-hint unlocked';
    } else {
      hintEl.textContent = `還差 ${unlockAt - count} 場解鎖個人數據分析`;
      hintEl.className   = 'rater-progress-hint';
    }
  } catch (err) {
    countEl.textContent = `— / 100 場`;
  }
}

// ── Init ───────────────────────────────────────────
async function init() {
  const [cardsData, dupExcluded] = await Promise.all([
    fetch('./cards.json').then(r => r.json()),
    loadDupExclusions(),
    loadBanlist(),
  ]);
  allCards = cardsData.filter(c =>
    !dupExcluded.has(c['卡片ID']) &&
    !dupExcluded.has(getCardKey(c)) &&
    !BANNED_IDS.has(c['卡片ID'])
  );
  buildDeckCheckboxes();
  buildModeSelect();
  bindEvents();
}

// ── Mode Select ────────────────────────────────────
function buildModeSelect() {
  document.querySelectorAll('#modeSelect .mode-option').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#modeSelect .mode-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      state.draftMode = el.dataset.mode;
    });
  });
}

// ── Deck Checkboxes ────────────────────────────────
function buildDeckCheckboxes() {
  const decks = [...new Set(allCards.map(c => c['牌組']).filter(Boolean))].sort();
  const container = document.getElementById('deckCheckboxes');

  decks.forEach(deck => {
    const isBGA = BGA_DECKS.includes(deck);
    const label = document.createElement('label');
    label.className = 'deck-checkbox-label checked';
    label.dataset.deck = deck;
    label.innerHTML = `
      <span class="deck-tag">${deck}</span>
      ${isBGA ? '<span class="bga-badge">BGA</span>' : ''}
    `;
    label.addEventListener('click', () => {
      label.classList.toggle('checked');
    });
    container.appendChild(label);
  });
}

function getCheckedDecks() {
  return [...document.querySelectorAll('#deckCheckboxes .deck-checkbox-label.checked')]
    .map(el => el.dataset.deck);
}

function setAllChecked(checked) {
  document.querySelectorAll('#deckCheckboxes .deck-checkbox-label').forEach(el => {
    el.classList.toggle('checked', checked);
  });
}

function setBGAChecked() {
  document.querySelectorAll('#deckCheckboxes .deck-checkbox-label').forEach(el => {
    el.classList.toggle('checked', BGA_DECKS.includes(el.dataset.deck));
  });
}

// ── Events ─────────────────────────────────────────
function bindEvents() {
  document.getElementById('presetBGA').addEventListener('click', setBGAChecked);
  document.getElementById('presetAll').addEventListener('click', () => setAllChecked(true));
  document.getElementById('presetNone').addEventListener('click', () => setAllChecked(false));
  document.querySelectorAll('#packSizeSelect .pack-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#packSizeSelect .pack-size-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.packSize = parseInt(btn.dataset.size, 10);
      const n = state.packSize;
      document.getElementById('combinedModeDesc').textContent =
        `每包各含 ${n} 張職業＋${n} 張次要，每輪各選 1 張，固定向左傳`;
    });
  });
  document.getElementById('startDraft').addEventListener('click', startDraft);
  document.getElementById('continueBtn').addEventListener('click', startMinorPhase);
  document.getElementById('confirmBtn').addEventListener('click', confirmPick);
  document.getElementById('restartBtn').addEventListener('click', () => startDraft());
  document.getElementById('changeDecksBtn').addEventListener('click', () => showScreen('setupScreen'));
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}


// ── Shuffle ────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Start Draft ────────────────────────────────────
function startDraft() {
  // 評分者輪抽不再灌 ELO，與玩家一樣可自由選牌組/模式；資料僅進個人分析
  state.raterMode  = typeof isRater === 'function' && isRater();
  state.playerMode = !state.raterMode && typeof isPlayer === 'function' && isPlayer();

  const checked = getCheckedDecks();
  if (checked.length === 0) {
    alert('請至少選擇一個牌組');
    return;
  }
  state.selectedDecks = checked;

  state.occPicks = [];
  state.minPicks = [];
  state.shownLog = [];
  state.comboTags = [];
  state.pendingComboFrom = [];
  document.getElementById('uploadStatus').style.display = 'none';
  document.getElementById('draftScore').style.display = 'none';
  document.getElementById('draftScoreAnalysis').style.display = 'none';
  if (state.draftMode === 'combined') {
    startCombinedPhase();
  } else {
    startOccupationPhase();
  }
}

function buildPacks(cardType) {
  const pool = allCards.filter(c => {
    const matchType = cardType === 'occupation'
      ? c.card_type === 'occupation'
      : (c.card_type === 'minor' || c.card_type === 'both');
    return matchType && state.selectedDecks.includes(c['牌組']);
  });

  const minPool = 4 * state.packSize;
  if (pool.length < minPool) {
    const typeName = cardType === 'occupation' ? '職業卡' : '次要發展卡';
    alert(`選擇的牌組中${typeName}不足（需至少 ${minPool} 張，目前 ${pool.length} 張）`);
    return false;
  }

  const n = state.packSize;
  const shuffled = shuffle(pool);
  state.packs = {
    A: shuffled.slice(0,     n),
    B: shuffled.slice(n,   2*n),
    C: shuffled.slice(2*n, 3*n),
    D: shuffled.slice(3*n, 4*n),
  };
  state.removedIds = {
    A: new Set(), B: new Set(), C: new Set(), D: new Set(),
  };
  state.appliedSimRounds = new Set();
  return true;
}

function startCombinedPhase() {
  if (!buildPacks('occupation')) return;
  state.occPacks = state.packs;
  state.occRemovedIds = state.removedIds;

  if (!buildPacks('minor')) return;
  state.minPacks = state.packs;
  state.minRemovedIds = state.removedIds;

  state.phase = 'combined';
  state.currentRound = 0;
  state.roundConfig = COMBINED_ROUNDS;
  state.appliedSimRounds = new Set();
  state.selectedOcc = null;
  state.selectedMin = null;

  fetchEloForDraft();

  showScreen('draftScreen');
  renderCombinedRound();
}

function startOccupationPhase() {
  if (!buildPacks('occupation')) return;
  state.phase = 'occupation';
  state.currentRound = 0;
  state.roundConfig = OCC_ROUNDS;
  state.currentPicks = state.occPicks;
  state.selectedCard = null;
  fetchEloForDraft();
  showScreen('draftScreen');
  renderRound();
}

function startMinorPhase() {
  if (!buildPacks('minor')) return;
  state.phase = 'minor';
  state.currentRound = 0;
  state.roundConfig = MIN_ROUNDS;
  state.currentPicks = state.minPicks;
  state.selectedCard = null;
  fetchEloForDraft();
  showScreen('draftScreen');
  renderRound();
}

// ── ELO-weighted sim picks ─────────────────────────
const RATINGS_CACHE_KEY = 'agricola_ratings_cache_v2'; // 與 tierlist.js 共用同一份快取
const RATINGS_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours（與 tierlist.js 一致）
const SIM_MIN_SEEN = 5;       // 與 tierlist MIN_SEEN 一致：列入分級所需最低輪抽場數
const SIM_S_TIER_PCT = 0.08;  // 與 tierlist TIER_BOUNDS 一致：前 8% 為 Tier S

async function fetchEloForDraft() {
  state.eloCache = {};
  state.sTierIds = new Set();
  try {
    let map = null;
    try {
      const s = JSON.parse(localStorage.getItem(RATINGS_CACHE_KEY));
      if (s && Date.now() - s.cachedAt < RATINGS_CACHE_TTL) map = s.data;
    } catch {}

    if (!map) {
      map = {};
      let pageToken = null;
      do {
        let url = `${FIRESTORE_BASE}/agricola_ratings?pageSize=300`;
        if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
        const res = await fetch(url);
        const data = await res.json();
        (data.documents || []).forEach(doc => {
          const id = doc.name.split('/').pop();
          const f = doc.fields || {};
          map[id] = {
            elo:       Number(f.elo?.integerValue       ?? f.elo?.doubleValue ?? 1200),
            seenCount: Number(f.seenCount?.integerValue ?? 0),
            pickCount: Number(f.pickCount?.integerValue ?? 0),
            rankSeen:  Number(f.rankSeen?.integerValue  ?? 0),
          };
        });
        pageToken = data.nextPageToken ?? null;
      } while (pageToken);
      try { localStorage.setItem(RATINGS_CACHE_KEY, JSON.stringify({ data: map, cachedAt: Date.now() })); } catch {}
    }

    state.eloCache = map;
    state.sTierIds = computeSTierIds(map);
  } catch { /* fail silently — sim picks fall back to uniform random */ }
}

// 與 tierlist.js 相同的混合分數排名，取非禁卡前 8% 作為 Tier S
function computeSTierIds(map) {
  const score = r => {
    if (!r.seenCount) return r.elo;
    const pickRate = r.pickCount / r.seenCount;
    const prior = 1200 + (pickRate - 0.11) * 450; // 0.11 ≈ 1/9（9張包隨機基準）
    const conf = Math.min(r.seenCount / 30, 1);
    return conf * r.elo + (1 - conf) * prior;
  };
  const rated = Object.entries(map)
    .filter(([id, r]) => r.seenCount >= SIM_MIN_SEEN && !BANNED_IDS.has(id))
    .sort((a, b) => score(b[1]) - score(a[1]));
  return new Set(rated.slice(0, Math.ceil(rated.length * SIM_S_TIER_PCT)).map(([id]) => id));
}

function simPickWeighted(avail, count) {
  if (count <= 0 || avail.length === 0) return [];
  const pool = avail.map(c => {
    const id = c['卡片ID'];
    const r = state.eloCache[id];
    // Tier S 全信任 ELO；其餘依有效場數（輪抽 seenCount + 快排 rankSeen）建立信心度
    const effGames = r ? (r.seenCount + (r.rankSeen || 0)) : 0;
    const confidence = state.sTierIds.has(id) ? 1 : Math.min(effGames / 30, 1);
    const elo = r ? Math.max(r.elo ?? 1200, 100) : 1200;
    const effElo = 1200 + (elo - 1200) * confidence;
    const w = Math.pow(10, (effElo - 1200) / 250); // 加陡的 ELO 式權重：高 250 分 → 10 倍中籤率（1500分S牌漏網率約6%）
    return { c, w };
  });
  const result = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const total = pool.reduce((s, x) => s + x.w, 0);
    let rand = Math.random() * total;
    let idx = 0;
    while (idx < pool.length - 1) {
      if (rand < pool[idx].w) break;
      rand -= pool[idx].w;
      idx++;
    }
    result.push(pool.splice(idx, 1)[0].c);
  }
  return result;
}

// ── Combined Mode Render ───────────────────────────
function renderCombinedRound() {
  const round = state.currentRound;
  const config = state.roundConfig[round];
  const packKey = config.pack;

  document.getElementById('comboTagWrap').style.display = 'none';

  // Apply sim picks once per round for both occ and min packs
  if (!state.appliedSimRounds.has(round)) {
    [
      { pack: state.occPacks[packKey], removed: state.occRemovedIds[packKey] },
      { pack: state.minPacks[packKey], removed: state.minRemovedIds[packKey] },
    ].forEach(({ pack, removed }) => {
      const avail = pack.filter(c => !removed.has(c['卡片ID']));
      simPickWeighted(avail, config.simPicks).forEach(c => removed.add(c['卡片ID']));
    });
    state.appliedSimRounds.add(round);
  }

  const occShow = state.occPacks[packKey].filter(c => !state.occRemovedIds[packKey].has(c['卡片ID']));
  const minShow = state.minPacks[packKey].filter(c => !state.minRemovedIds[packKey].has(c['卡片ID']));
  state.currentOccShown = occShow;
  state.currentMinShown = minShow;

  document.getElementById('phaseLabel').textContent = '同時輪抽';
  document.getElementById('roundBadge').textContent = `第 ${round + 1} / 7 輪`;
  document.getElementById('packInfo').textContent = `包 ${packKey} · 職業 ${occShow.length} + 次發 ${minShow.length}`;

  state.selectedOcc = null;
  state.selectedMin = null;
  updateCombinedConfirmBar();
  renderCombinedPickedBar();

  const grid = document.getElementById('draftCardGrid');
  grid.className = 'draft-card-grid combined-mode';
  grid.innerHTML = '';

  // Section label - Occupation
  const occLabel = document.createElement('div');
  occLabel.className = 'combined-section-label';
  occLabel.textContent = `職業牌（${occShow.length} 張）`;
  grid.appendChild(occLabel);

  const occGrid = document.createElement('div');
  occGrid.className = 'combined-sub-grid';
  occShow.forEach(card => occGrid.appendChild(createCombinedCardEl(card, 'occ')));
  grid.appendChild(occGrid);

  // Section label - Minor
  const minLabel = document.createElement('div');
  minLabel.className = 'combined-section-label';
  minLabel.textContent = `次要發展牌（${minShow.length} 張）`;
  grid.appendChild(minLabel);

  const minGrid = document.createElement('div');
  minGrid.className = 'combined-sub-grid';
  minShow.forEach(card => minGrid.appendChild(createCombinedCardEl(card, 'min')));
  grid.appendChild(minGrid);
}

function createCombinedCardEl(card, slot) {
  const div = document.createElement('div');
  div.className = 'draft-card';

  div.innerHTML = `
    <div class="draft-card-thumb">
      <canvas class="card-canvas"></canvas>
    </div>
    <div class="draft-card-body">
      <div class="draft-card-name">${card['牌名'] || '—'}</div>
      <div class="draft-card-id">${card['卡片ID'] || ''}</div>
    </div>
    <button class="draft-card-info-btn" title="查看詳情">ℹ</button>
  `;

  div.addEventListener('click', e => {
    if (e.target.closest('.draft-card-info-btn')) return;
    selectCombinedCard(card, div, slot);
  });
  div.querySelector('.draft-card-info-btn').addEventListener('click', e => {
    e.stopPropagation();
    openModal(card);
  });

  requestAnimationFrame(() => {
    drawCrop(div.querySelector('.card-canvas'), card);
  });

  return div;
}

function selectCombinedCard(card, el, slot) {
  const prevKey = slot === 'occ' ? 'selectedOcc' : 'selectedMin';
  const prevId = state[prevKey]?.['卡片ID'];

  // Deselect previous in same slot
  document.querySelectorAll(`.draft-card.selected-${slot}`).forEach(c => {
    c.classList.remove(`selected-${slot}`, 'selected');
    c.querySelector('.selected-badge')?.remove();
  });

  if (prevId === card['卡片ID']) {
    state[prevKey] = null;
  } else {
    state[prevKey] = card;
    el.classList.add(`selected-${slot}`, 'selected');
    const badge = document.createElement('div');
    badge.className = 'selected-badge';
    badge.textContent = slot === 'occ' ? '職業已選' : '次發已選';
    el.appendChild(badge);
  }

  updateCombinedConfirmBar();
}

function updateCombinedConfirmBar() {
  const btn = document.getElementById('confirmBtn');
  const nameEl = document.getElementById('confirmName');
  const occ = state.selectedOcc;
  const min = state.selectedMin;

  if (occ && min) {
    nameEl.innerHTML = `職業：<strong>${occ['牌名']}</strong>　次發：<strong>${min['牌名']}</strong>`;
    btn.disabled = false;
  } else {
    const parts = [];
    if (!occ) parts.push('選職業牌');
    if (!min) parts.push('選次要發展牌');
    nameEl.textContent = `尚需：${parts.join('、')}`;
    btn.disabled = true;
  }
}

function renderCombinedPickedBar() {
  const bar = document.getElementById('pickedBar');
  bar.innerHTML = '';

  // Show occ picks + min picks interleaved as pairs
  const total = Math.max(state.occPicks.length, state.minPicks.length);
  for (let i = 0; i < 7; i++) {
    const pair = document.createElement('div');
    pair.className = 'combined-pick-pair';

    const occCard = state.occPicks[i];
    const minCard = state.minPicks[i];

    [occCard, minCard].forEach((card, j) => {
      const div = document.createElement('div');
      div.className = `picked-thumb ${card ? '' : 'empty'}`;
      if (card) {
        div.title = card['牌名'];
        div.innerHTML = '<canvas></canvas>';
        div.addEventListener('click', () => openModal(card));
        requestAnimationFrame(() => drawCrop(div.querySelector('canvas'), card, 0.5));
      } else {
        div.textContent = j === 0 ? '職' : '次';
      }
      pair.appendChild(div);
    });

    bar.appendChild(pair);
  }
}

function confirmCombinedPick() {
  if (!state.selectedOcc || !state.selectedMin) return;

  const pickedOcc = state.selectedOcc;
  const pickedMin = state.selectedMin;
  const config = state.roundConfig[state.currentRound];
  const packKey = config.pack;

  state.shownLog.push({
    picked: pickedOcc['卡片ID'],
    opponents: state.currentOccShown.filter(c => c['卡片ID'] !== pickedOcc['卡片ID']).map(c => c['卡片ID'])
  });
  state.shownLog.push({
    picked: pickedMin['卡片ID'],
    opponents: state.currentMinShown.filter(c => c['卡片ID'] !== pickedMin['卡片ID']).map(c => c['卡片ID'])
  });

  state.occRemovedIds[packKey].add(pickedOcc['卡片ID']);
  state.minRemovedIds[packKey].add(pickedMin['卡片ID']);
  state.occPicks.push(pickedOcc);
  state.minPicks.push(pickedMin);
  state.selectedOcc = null;
  state.selectedMin = null;
  state.currentRound++;

  if (state.currentRound >= 7) {
    showResult();
    return;
  }
  renderCombinedRound();
}

// ── Render Round ───────────────────────────────────
function renderRound() {
  const round = state.currentRound;
  const config = state.roundConfig[round];
  const packKey = config.pack;

  // Apply sim picks exactly once per round
  if (!state.appliedSimRounds.has(round)) {
    const pack = state.packs[packKey];
    const removed = state.removedIds[packKey];
    const available = pack.filter(c => !removed.has(c['卡片ID']));
    simPickWeighted(available, config.simPicks).forEach(c => removed.add(c['卡片ID']));
    state.appliedSimRounds.add(round);
  }

  const toShow = state.packs[packKey].filter(c => !state.removedIds[packKey].has(c['卡片ID']));
  state.currentShown = toShow;

  // Update header
  const isOcc = state.phase === 'occupation';
  document.getElementById('phaseLabel').textContent = isOcc ? '職業牌輪抽' : '次要發展牌輪抽';
  document.getElementById('roundBadge').textContent = `第 ${round + 1} / 7 輪`;
  document.getElementById('packInfo').textContent = `包 ${packKey} · ${toShow.length} 張`;

  // Show occupation picks reference during minor phase
  const occRefSection = document.getElementById('occRefSection');
  const pickedBarLabel = document.getElementById('pickedBarLabel');
  if (state.phase === 'minor') {
    occRefSection.style.display = '';
    pickedBarLabel.textContent = '已選次要發展牌';
    renderOccRefBar();
  } else {
    occRefSection.style.display = 'none';
    pickedBarLabel.textContent = '已選手牌';
  }

  // Reset selection
  state.selectedCard = null;
  state.pendingComboFrom = [];
  updateConfirmBar();
  renderComboTagPicker();
  renderPickedBar();

  // Render cards
  const grid = document.getElementById('draftCardGrid');
  grid.className = 'draft-card-grid single-mode';
  grid.innerHTML = '';
  toShow.forEach(card => grid.appendChild(createDraftCardEl(card)));
}

// ── Create Draft Card ──────────────────────────────
function createDraftCardEl(card) {
  const div = document.createElement('div');
  div.className = 'draft-card';

  div.innerHTML = `
    <div class="draft-card-thumb">
      <canvas class="card-canvas"></canvas>
    </div>
    <div class="draft-card-body">
      <div class="draft-card-name">${card['牌名'] || '—'}</div>
      <div class="draft-card-id">${card['卡片ID'] || ''}</div>
    </div>
    <button class="draft-card-info-btn" title="查看詳情">ℹ</button>
  `;

  div.addEventListener('click', e => {
    if (e.target.closest('.draft-card-info-btn')) return;
    selectCard(card, div);
  });

  div.querySelector('.draft-card-info-btn').addEventListener('click', e => {
    e.stopPropagation();
    openModal(card);
  });

  requestAnimationFrame(() => {
    drawCrop(div.querySelector('.card-canvas'), card);
  });

  return div;
}

// ── Select & Confirm ───────────────────────────────
function selectCard(card, el) {
  // Deselect previous
  document.querySelectorAll('.draft-card.selected').forEach(c => {
    c.classList.remove('selected');
    const badge = c.querySelector('.selected-badge');
    if (badge) badge.remove();
  });

  if (state.selectedCard?.['卡片ID'] === card['卡片ID']) {
    state.selectedCard = null;
  } else {
    state.selectedCard = card;
    el.classList.add('selected');
    const badge = document.createElement('div');
    badge.className = 'selected-badge';
    badge.textContent = '已選';
    el.appendChild(badge);
  }

  state.pendingComboFrom = [];
  updateConfirmBar();
  renderComboTagPicker();
}

// ── Combo Tag Picker (separate mode only) ─────────
// Lets a rater optionally mark "I picked this because I already hold X" —
// raw events are stored alongside the session for later synergy analysis.
function getComboTagCandidates() {
  return state.phase === 'minor' ? [...state.occPicks, ...state.minPicks] : [...state.occPicks];
}

function renderComboTagPicker() {
  const wrap = document.getElementById('comboTagWrap');
  const list = document.getElementById('comboTagList');
  const candidates = getComboTagCandidates();

  if (!(state.raterMode || state.playerMode) || !state.selectedCard || candidates.length === 0) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = '';
  list.innerHTML = '';
  candidates.forEach(card => {
    const id = card['卡片ID'];
    const chip = document.createElement('div');
    chip.className = `combo-tag-chip${state.pendingComboFrom.includes(id) ? ' checked' : ''}`;
    chip.innerHTML = `<canvas></canvas><span class="combo-tag-chip-name">${card['牌名'] || '—'}</span>`;
    chip.addEventListener('click', () => {
      const idx = state.pendingComboFrom.indexOf(id);
      if (idx === -1) state.pendingComboFrom.push(id);
      else state.pendingComboFrom.splice(idx, 1);
      renderComboTagPicker();
    });
    list.appendChild(chip);
    requestAnimationFrame(() => drawCrop(chip.querySelector('canvas'), card, 0.5));
  });
}

function updateConfirmBar() {
  const btn = document.getElementById('confirmBtn');
  const nameEl = document.getElementById('confirmName');
  if (state.selectedCard) {
    nameEl.innerHTML = `已選：<strong>${state.selectedCard['牌名']}</strong>`;
    btn.disabled = false;
  } else {
    nameEl.textContent = '尚未選擇';
    btn.disabled = true;
  }
}

function confirmPick() {
  if (state.phase === 'combined') { confirmCombinedPick(); return; }
  if (!state.selectedCard) return;

  const card = state.selectedCard;
  const config = state.roundConfig[state.currentRound];

  state.shownLog.push({
    picked: card['卡片ID'],
    opponents: state.currentShown.filter(c => c['卡片ID'] !== card['卡片ID']).map(c => c['卡片ID'])
  });

  state.pendingComboFrom.forEach(fromId => {
    state.comboTags.push({ from: fromId, to: card['卡片ID'], phase: state.phase, round: state.currentRound });
  });

  state.removedIds[config.pack].add(card['卡片ID']);
  state.currentPicks.push(card);
  state.selectedCard = null;
  state.pendingComboFrom = [];
  state.currentRound++;

  if (state.currentRound >= 7) {
    if (state.phase === 'occupation') {
      showTransition();
    } else {
      showResult();
    }
    return;
  }

  renderRound();
}

// ── Occ Reference Bar (shown during minor phase) ──
function renderOccRefBar() {
  const bar = document.getElementById('occRefBar');
  bar.innerHTML = '';
  state.occPicks.forEach(card => {
    const div = document.createElement('div');
    div.className = 'picked-thumb occ-ref-thumb';
    div.title = card['牌名'];
    div.innerHTML = '<canvas></canvas>';
    div.addEventListener('click', () => openModal(card));
    bar.appendChild(div);
    requestAnimationFrame(() => drawCrop(div.querySelector('canvas'), card, 0.5));
  });
}

// ── Picked Bar ─────────────────────────────────────
function renderPickedBar() {
  const bar = document.getElementById('pickedBar');
  bar.innerHTML = '';
  const picks = state.currentPicks;

  picks.forEach(card => {
    const div = document.createElement('div');
    div.className = 'picked-thumb';
    div.title = card['牌名'];
    div.innerHTML = '<canvas></canvas>';
    div.addEventListener('click', () => openModal(card));
    bar.appendChild(div);
    requestAnimationFrame(() => {
      drawCrop(div.querySelector('canvas'), card, 0.5);
    });
  });

  for (let i = picks.length; i < 7; i++) {
    const div = document.createElement('div');
    div.className = 'picked-thumb empty';
    div.textContent = i + 1;
    bar.appendChild(div);
  }
}

// ── Transition ─────────────────────────────────────
function showTransition() {
  showScreen('transitionScreen');
  const grid = document.getElementById('occMiniGrid');
  grid.innerHTML = '';
  state.occPicks.forEach(card => {
    const div = document.createElement('div');
    div.className = 'occ-mini-thumb';
    div.title = card['牌名'];
    div.innerHTML = '<canvas></canvas>';
    grid.appendChild(div);
    requestAnimationFrame(() => {
      drawCrop(div.querySelector('canvas'), card);
    });
  });
}

// ── Result ─────────────────────────────────────────
function showResult() {
  showScreen('resultScreen');
  renderResultGrid('occResultGrid', state.occPicks);
  renderResultGrid('minResultGrid', state.minPicks);
  // 評分者與玩家輪抽都只記個人場次（excludeFromElo），ELO 一律改由「快速牌力排序」產生
  if (state.raterMode) uploadPlayerSession('rater');
  else if (state.playerMode) uploadPlayerSession('player');
  calculateScore();
}

// ⚠ 已停用：輪抽不再產生 ELO（牌力評分一律改由「快速牌力排序」rank.js 提供）。
// 此函式保留僅供參考，已無任何呼叫處；防呆 early-return 確保即使被誤呼叫也不會寫入 agricola_ratings。
async function uploadRatings() {
  console.warn('uploadRatings 已停用：輪抽不再灌 ELO，請使用快速牌力排序');
  return;
  /* eslint-disable no-unreachable */
  const statusEl = document.getElementById('uploadStatus');
  statusEl.style.display = 'flex';
  statusEl.textContent = '評分資料上傳中…';
  statusEl.className = 'upload-status uploading';

  try {
    const K_PAIR = 8; // ELO K-factor per pairwise match（從 16 調降，避免低樣本卡在尚未輸過的情況下被結構性不對稱機制衝到異常高分）

    // Collect all unique card IDs in this draft
    const uniqueIds = [...new Set(state.shownLog.flatMap(r => [r.picked, ...r.opponents]))];

    // Batch-fetch current ELO for all involved cards
    const batchRes = await fetch(`${FIRESTORE_BASE}:batchGet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documents: uniqueIds.map(id =>
          `projects/project-hub-410cd/databases/(default)/documents/agricola_ratings/${id}`)
      })
    });
    const batchData = await batchRes.json();

    const ratings = {};
    const existingIds = new Set();
    uniqueIds.forEach(id => { ratings[id] = { elo: 1200, seenCount: 0, pickCount: 0 }; });
    batchData.forEach(item => {
      if (item.found) {
        const id = item.found.name.split('/').pop();
        const f = item.found.fields || {};
        existingIds.add(id);
        ratings[id] = {
          elo:       Number(f.elo?.integerValue       ?? f.elo?.doubleValue       ?? 1200),
          seenCount: Number(f.seenCount?.integerValue ?? 0),
          pickCount: Number(f.pickCount?.integerValue ?? 0),
        };
      }
    });

    // 評分者權重（從 Firestore settings/calc_params 載入，預設 1.0；查無時行為與過去完全一致）
    const raterId = getRaterId() || 'unknown';
    let raterWeight = 1;
    try {
      const wRes = await fetch(`${FIRESTORE_BASE}/settings/calc_params`);
      if (wRes.ok) {
        const wf = (await wRes.json()).fields?.weights?.mapValue?.fields?.[raterId];
        const wv = wf?.doubleValue ?? wf?.integerValue;
        if (wv != null && Number(wv) > 0) raterWeight = Number(wv);
      }
    } catch {}
    const K_eff = K_PAIR * raterWeight;

    // 快照初始值，供增量寫入計算淨變化（解決多人同時評分互相覆蓋）
    const eloInit = {}, seenInit = {}, pickInit = {};
    uniqueIds.forEach(id => { eloInit[id] = ratings[id].elo; seenInit[id] = ratings[id].seenCount; pickInit[id] = ratings[id].pickCount; });

    // Compute ELO updates round by round (sequential, using pre-round ratings per round)
    state.shownLog.forEach(({ picked, opponents }) => {
      ratings[picked].seenCount++;
      ratings[picked].pickCount++;
      opponents.forEach(id => { ratings[id].seenCount++; });

      if (opponents.length === 0) return;
      const R_p = ratings[picked].elo;
      const deltas = {};

      opponents.forEach(oppId => {
        const R_o = ratings[oppId].elo;
        const E_p = 1 / (1 + Math.pow(10, (R_o - R_p) / 400));
        deltas[picked]  = (deltas[picked]  || 0) + K_eff * (1 - E_p);
        deltas[oppId]   = (deltas[oppId]   || 0) + K_eff * (0 - E_p);
      });

      Object.entries(deltas).forEach(([id, d]) => { ratings[id].elo += d; });
    });

    const totalMatches = state.shownLog.reduce((s, r) => s + r.opponents.length, 0);

    // 增量寫入：只疊加本場變化量，不覆蓋整份 → 多人同時評分也不會互相蓋掉
    const RBASE = 'projects/project-hub-410cd/databases/(default)/documents/agricola_ratings';
    const writes = uniqueIds.map(cardId => {
      const name  = `${RBASE}/${cardId}`;
      const dElo  = ratings[cardId].elo       - eloInit[cardId];
      const dSeen = ratings[cardId].seenCount - seenInit[cardId];
      const dPick = ratings[cardId].pickCount - pickInit[cardId];
      if (existingIds.has(cardId)) {
        const tf = [{ fieldPath: 'elo', increment: { doubleValue: dElo } }];
        if (dSeen) tf.push({ fieldPath: 'seenCount', increment: { integerValue: `${dSeen}` } });
        if (dPick) tf.push({ fieldPath: 'pickCount', increment: { integerValue: `${dPick}` } });
        return {
          update: { name, fields: { lastRater: { stringValue: raterId } } },
          updateMask: { fieldPaths: ['lastRater'] },
          updateTransforms: tf,
        };
      }
      // 新卡：文件不存在，increment 的 base 會是 0，故直接設定 1200+變化的絕對值
      return {
        update: { name, fields: {
          elo:       { integerValue: `${Math.min(2000, Math.max(500, Math.round(1200 + dElo)))}` },
          seenCount: { integerValue: `${dSeen}` },
          pickCount: { integerValue: `${dPick}` },
          lastRater: { stringValue: raterId },
        } }
      };
    });

    // Per-rater session record
    writes.push({
      update: {
        name: `projects/project-hub-410cd/databases/(default)/documents/agricola_sessions/${raterId}_${Date.now()}`,
        fields: {
          raterId:      { stringValue: raterId },
          timestamp:    { stringValue: new Date().toISOString() },
          draftMode:    { stringValue: state.draftMode },
          totalRounds:  { integerValue: `${state.shownLog.length}` },
          totalMatches: { integerValue: `${totalMatches}` },
          picks: {
            arrayValue: {
              values: [...state.occPicks, ...state.minPicks].map(c => ({ stringValue: c['卡片ID'] }))
            }
          },
          raterLog: {
            arrayValue: {
              values: state.shownLog.map(({ picked, opponents }) => ({
                mapValue: {
                  fields: {
                    picked:    { stringValue: picked },
                    opponents: { arrayValue: { values: opponents.map(id => ({ stringValue: id })) } }
                  }
                }
              }))
            }
          },
          comboTags: {
            arrayValue: {
              values: state.comboTags.map(({ from, to, phase, round }) => ({
                mapValue: {
                  fields: {
                    from:  { stringValue: from },
                    to:    { stringValue: to },
                    phase: { stringValue: phase },
                    round: { integerValue: `${round}` },
                  }
                }
              }))
            }
          }
        }
      }
    });

    for (let i = 0; i < writes.length; i += 500) {
      const res = await fetch(`${FIRESTORE_BASE}:commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes: writes.slice(i, i + 500) })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
    }

    localStorage.removeItem(PROGRESS_CACHE_KEY);
    localStorage.removeItem('agricola_ratings_cache');
    statusEl.textContent = `✓ ELO 更新完成（${state.shownLog.length} 輪）`;
    statusEl.className = 'upload-status done';
  } catch (err) {
    statusEl.textContent = `⚠ 上傳失敗：${err.message}`;
    statusEl.className = 'upload-status error';
  }
}

// 個人場次：玩家與評分者輪抽共用，只記錄個人場次（用於個人分析），不更新 ELO / Tier list
// role：'player' 或 'rater'，excludeFromElo 一律 true，確保任何重算流程都不會納入
async function uploadPlayerSession(role = 'player') {
  const statusEl = document.getElementById('uploadStatus');
  statusEl.style.display = 'flex';
  statusEl.textContent = '紀錄上傳中…';
  statusEl.className = 'upload-status uploading';

  try {
    const totalMatches = state.shownLog.reduce((s, r) => s + r.opponents.length, 0);
    const playerId = getRaterId() || 'unknown';

    const write = {
      update: {
        name: `projects/project-hub-410cd/databases/(default)/documents/agricola_sessions/${playerId}_${Date.now()}`,
        fields: {
          raterId:      { stringValue: playerId },
          role:         { stringValue: role },
          excludeFromElo: { booleanValue: true },
          timestamp:    { stringValue: new Date().toISOString() },
          draftMode:    { stringValue: state.draftMode },
          totalRounds:  { integerValue: `${state.shownLog.length}` },
          totalMatches: { integerValue: `${totalMatches}` },
          picks: {
            arrayValue: {
              values: [...state.occPicks, ...state.minPicks].map(c => ({ stringValue: c['卡片ID'] }))
            }
          },
          raterLog: {
            arrayValue: {
              values: state.shownLog.map(({ picked, opponents }) => ({
                mapValue: {
                  fields: {
                    picked:    { stringValue: picked },
                    opponents: { arrayValue: { values: opponents.map(id => ({ stringValue: id })) } }
                  }
                }
              }))
            }
          },
          comboTags: {
            arrayValue: {
              values: state.comboTags.map(({ from, to, phase, round }) => ({
                mapValue: {
                  fields: {
                    from:  { stringValue: from },
                    to:    { stringValue: to },
                    phase: { stringValue: phase },
                    round: { integerValue: `${round}` },
                  }
                }
              }))
            }
          }
        }
      }
    };

    const res = await fetch(`${FIRESTORE_BASE}:commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: [write] })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    localStorage.removeItem(PROGRESS_CACHE_KEY);
    statusEl.textContent = `✓ 紀錄已儲存（${state.shownLog.length} 輪，已計入個人分析，不影響 ELO）`;
    statusEl.className = 'upload-status done';
  } catch (err) {
    statusEl.textContent = `⚠ 上傳失敗：${err.message}`;
    statusEl.className = 'upload-status error';
  }
}

async function calculateScore() {
  const scoreEl = document.getElementById('draftScore');
  const analysisEl = document.getElementById('draftScoreAnalysis');
  scoreEl.style.display = 'flex';
  scoreEl.textContent = '得分計算中…';
  scoreEl.className = 'draft-score calculating';
  analysisEl.style.display = 'none';

  try {
    const rounds = state.shownLog.filter(r => r.opponents.length > 0);
    if (rounds.length === 0) {
      scoreEl.style.display = 'none';
      return;
    }

    const uniqueIds = [...new Set(rounds.flatMap(r => [r.picked, ...r.opponents]))];
    const batchRes = await fetch(`${FIRESTORE_BASE}:batchGet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documents: uniqueIds.map(id =>
          `projects/project-hub-410cd/databases/(default)/documents/agricola_ratings/${id}`)
      })
    });
    const batchData = await batchRes.json();

    const ratingMap = {};
    uniqueIds.forEach(id => { ratingMap[id] = { elo: 1200, seenCount: 0 }; });
    batchData.forEach(item => {
      if (item.found) {
        const id = item.found.name.split('/').pop();
        const f = item.found.fields || {};
        ratingMap[id] = {
          elo:       Number(f.elo?.integerValue ?? f.elo?.doubleValue ?? 1200),
          seenCount: Number(f.seenCount?.integerValue ?? 0),
        };
      }
    });

    // 樣本數不足的卡牌，原始 ELO 容易被結構性機制衝出異常值，往基準值收斂以避免污染最佳/最差判斷
    // 另夾一道天花板：樣本充足卡牌目前實測最高約 1288，超過 1300 多半是尚未自然修正的幽靈高分
    const SCORE_ELO_CEILING = 1300;
    const eloMap = {};
    uniqueIds.forEach(id => {
      const { elo, seenCount } = ratingMap[id];
      const conf = Math.min(seenCount / 30, 1);
      eloMap[id] = Math.min(conf * elo + (1 - conf) * 1200, SCORE_ELO_CEILING);
    });

    const REFERENCE_GAP = 150; // 視為「明顯選差」的 ELO 差距基準（取自全卡庫中段 50% 的典型差距）
    const NEAR_TIE_TOLERANCE = 20; // 包內最佳/次佳常常只差 20~30 分（接近評分系統雜訊水準），落在此範圍內視為勢均力敵，不扣分
    const cardById = {};
    allCards.forEach(c => { cardById[c['卡片ID']] = c; });

    const roundDetails = rounds.map(({ picked, opponents }) => {
      const all = [picked, ...opponents];
      const maxElo = Math.max(...all.map(id => eloMap[id]));
      const pickedElo = eloMap[picked];
      const gap = maxElo - pickedElo;
      const efficiency = gap <= NEAR_TIE_TOLERANCE
        ? 1
        : Math.min(1, Math.max(0, 1 - (gap - NEAR_TIE_TOLERANCE) / REFERENCE_GAP));
      const bestId = all.find(id => eloMap[id] === maxElo);
      return { picked, bestId, gap: Math.round(gap), roundScore: Math.round(efficiency * 100), efficiency };
    });

    const score = Math.round(roundDetails.reduce((s, r) => s + r.efficiency, 0) / roundDetails.length * 100);
    scoreEl.textContent = `本局得分：${score} 分`;
    scoreEl.className = 'draft-score done';

    const worst = roundDetails
      .map((r, i) => ({ ...r, idx: i + 1 }))
      .filter(r => r.roundScore < 60 && r.picked !== r.bestId)
      .sort((a, b) => a.roundScore - b.roundScore)
      .slice(0, 3);

    if (worst.length > 0) {
      const nameOf = id => cardById[id]?.['牌名'] || id;
      analysisEl.innerHTML = `
        <div class="draft-score-analysis-title">這幾次選擇拉低了分數：</div>
        <ul class="draft-score-analysis-list">
          ${worst.map(r => `
            <li class="draft-score-analysis-item">
              <span class="draft-score-analysis-idx">第 ${r.idx} 次選擇</span>
              <span>選了「<strong>${nameOf(r.picked)}</strong>」，但「<strong>${nameOf(r.bestId)}</strong>」評分明顯更高（差距約 ${r.gap} 分），這次只拿到 ${r.roundScore} 分</span>
            </li>
          `).join('')}
        </ul>
      `;
      analysisEl.style.display = 'block';
    }
  } catch (err) {
    scoreEl.textContent = `得分計算失敗：${err.message}`;
    scoreEl.className = 'draft-score error';
  }
}

function renderResultGrid(gridId, cards) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = '';
  cards.forEach(card => {
    const div = document.createElement('div');
    div.className = 'result-card';
    div.title = card['牌名'];
    div.innerHTML = `
      <div class="result-card-thumb"><canvas></canvas></div>
      <div class="result-card-info">
        <div class="result-card-name">${card['牌名'] || '—'}</div>
        <div class="result-card-id">${card['卡片ID'] || ''}</div>
      </div>
    `;
    div.addEventListener('click', () => openModal(card));
    grid.appendChild(div);
    requestAnimationFrame(() => {
      drawCrop(div.querySelector('canvas'), card);
    });
  });
}

// ── Screen Management ──────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.draft-screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Canvas Crop ────────────────────────────────────
// topFraction: 1 = full card, 0.5 = top half only
function drawCrop(canvas, card, topFraction = 1) {
  if (!canvas || !card || !card.source_image) return;
  const key = IMG_BASE + card.source_image;

  const draw = (img) => {
    const isComposite = card.source_image.includes('部分.jpg') || card.source_image.includes('舊版');
    const src = card.source_image;
    const isNLtmpl = /^NL\d/i.test(src) || /^FL/i.test(src) || /^G\d/i.test(src);
    const isOdeck  = /^O[mo]/i.test(src);
    const isTTS    = src.startsWith('FR') || src.startsWith('Gm') || src.startsWith('Go') || src.toLowerCase().startsWith('wa') || src.toLowerCase().startsWith('wm') || src.toLowerCase().startsWith('bi') || src.toLowerCase().startsWith('z');

    const cols = card.grid_cols || (isComposite ? 10 : GRID_COLS);
    const rows = card.grid_rows || (isComposite ? 3 : GRID_ROWS);

    let base;
    if (isOdeck || isTTS || isComposite) base = { l: 0, t: 0, r: 0, b: 0 };
    else if (isNLtmpl)                   base = { l: 182, t: 114, r: 166, b: 101 };
    else                                 base = { l: CROP.offsetLeft, t: CROP.offsetTop, r: CROP.offsetRight, b: CROP.offsetBottom };

    let sx, sy, cellW, cellH;
    if (src.startsWith('Zm')) {
      const cols_x = [16, 388, 760];
      const rows_y = [30, 651, 1274];
      cellW = 342;
      cellH = 558;
      sx = cols_x[card.grid_col || 0];
      sy = rows_y[card.grid_row || 0];
    } else {
      const offsetLeft   = card.crop_left   !== undefined ? card.crop_left   : base.l;
      const offsetRight  = card.crop_right  !== undefined ? card.crop_right  : base.r;
      const offsetTop    = card.crop_top    !== undefined ? card.crop_top    : base.t;
      const offsetBottom = card.crop_bottom !== undefined ? card.crop_bottom : base.b;

      const usableW = img.naturalWidth  - offsetLeft - offsetRight;
      const usableH = img.naturalHeight - offsetTop  - offsetBottom;
      cellW = usableW / cols;
      cellH = usableH / rows;
      sx = offsetLeft + (card.grid_col || 0) * cellW;
      sy = offsetTop + (card.grid_row || 0) * cellH;
    }
    const drawH = cellH * topFraction;
    
    canvas.width  = cellW;
    canvas.height = drawH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, cellW, drawH, 0, 0, cellW, drawH);
  };

  if (imageCache[key]) {
    draw(imageCache[key]);
  } else {
    const img = new Image();
    img.onload = () => { imageCache[key] = img; draw(img); };
    img.onerror = () => {
      canvas.width = 180; canvas.height = Math.round(130 * topFraction);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1d2437';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    img.src = key;
  }
}

// ── Modal ──────────────────────────────────────────
function openModal(card) {
  const typeName = card.card_type === 'minor' ? '次要發展卡'
                 : card.card_type === 'occupation' ? '職業卡'
                 : '次要發展卡及主要發展卡';

  document.getElementById('modalTitle').textContent = card['牌名'] || '—';
  document.getElementById('modalId').textContent = card['卡片ID'] || '';
  const isBanned = BANNED_GROUPS.some(g => g.ids.includes(card['卡片ID']));
  document.getElementById('modalBanBadge').style.display = isBanned ? '' : 'none';
  document.getElementById('modalBadge').className = `modal-badge badge-${card.card_type}`;
  document.getElementById('modalBadge').textContent = typeName;
  document.getElementById('modalDesc').textContent = card['說明'] || '—';

  const fieldsEl = document.getElementById('modalFields');
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

// ── Init ───────────────────────────────────────────
init();
