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

// 禁卡表（不進入輪抽池）
const BANNED_GROUPS = [
  { label: '過強職業',       ids: ['FL049', 'C093', 'C130', 'A127'] },
  { label: '過強次要發展卡', ids: ['C003*', 'B010*', '906-8', 'A010', 'B021', 'A048', 'C031'] },
  { label: '過爛職業',       ids: ['A107', 'B140', 'A151', 'C144*', 'C111', 'D158*', 'B146', 'C157', 'B101', 'D140', 'A154'] },
  { label: '過爛次要發展卡', ids: ['C058', 'B052', 'B018'] },
];
const BANNED_IDS = new Set(BANNED_GROUPS.flatMap(g => g.ids));

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
  appliedSimRounds: new Set(),
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
  raterLog: [],        // [{cardId, score}] accumulated across all rounds
  currentShown: [],    // cards shown this round (separate mode)
  currentOccShown: [], // occ cards shown this round (combined mode)
  currentMinShown: [], // min cards shown this round (combined mode)
};

// ── Init ───────────────────────────────────────────
async function init() {
  const res = await fetch('./cards.json');
  allCards = await res.json();
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
  document.getElementById('startDraft').addEventListener('click', startDraft);
  document.getElementById('continueBtn').addEventListener('click', startMinorPhase);
  document.getElementById('confirmBtn').addEventListener('click', confirmPick);
  document.getElementById('restartBtn').addEventListener('click', () => startDraft());
  document.getElementById('changeDecksBtn').addEventListener('click', () => showScreen('setupScreen'));
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('banlistBtn').addEventListener('click', openBanlist);
  document.getElementById('banlistClose').addEventListener('click', closeBanlist);
  document.getElementById('banlistOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeBanlist();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeBanlist(); }
  });
}

// ── Banlist Modal ──────────────────────────────────
function openBanlist() {
  const body = document.getElementById('banlistBody');
  if (!body.hasChildNodes()) renderBanlist(body);
  document.getElementById('banlistOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBanlist() {
  document.getElementById('banlistOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function renderBanlist(container) {
  BANNED_GROUPS.forEach(({ label, ids }) => {
    const cards = ids.map(id => allCards.find(c => c['卡片ID'] === id)).filter(Boolean);
    if (!cards.length) return;

    const section = document.createElement('div');
    section.className = 'banlist-section';
    section.innerHTML = `<div class="banlist-section-label">${label}（${cards.length} 張）</div>`;

    const grid = document.createElement('div');
    grid.className = 'banlist-grid';
    cards.forEach(card => {
      const item = document.createElement('div');
      item.className = 'banlist-card';
      item.innerHTML = `<canvas></canvas><div class="banlist-card-name">${card['牌名']}</div>`;
      grid.appendChild(item);
      requestAnimationFrame(() => {
        const canvas = item.querySelector('canvas');
        drawCrop(canvas, card.source_image, card.grid_col, card.grid_row);
        requestAnimationFrame(() => {
          if (canvas.width && canvas.height) {
            canvas.style.width = '100%';
            canvas.style.height = (item.offsetWidth * canvas.height / canvas.width) + 'px';
          }
        });
      });
    });

    section.appendChild(grid);
    container.appendChild(section);
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
  const checked = getCheckedDecks();
  if (checked.length === 0) {
    alert('請至少選擇一個牌組');
    return;
  }
  state.selectedDecks = checked;
  state.occPicks = [];
  state.minPicks = [];
  state.raterMode = document.getElementById('raterModeToggle').checked;
  state.raterLog = [];
  document.getElementById('uploadStatus').style.display = 'none';
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
    return matchType && state.selectedDecks.includes(c['牌組']) && !BANNED_IDS.has(c['卡片ID']);
  });

  if (pool.length < 36) {
    const typeName = cardType === 'occupation' ? '職業卡' : '次要發展卡';
    alert(`選擇的牌組中${typeName}不足（需至少 36 張，目前 ${pool.length} 張）`);
    return false;
  }

  const shuffled = shuffle(pool);
  state.packs = {
    A: shuffled.slice(0, 9),
    B: shuffled.slice(9, 18),
    C: shuffled.slice(18, 27),
    D: shuffled.slice(27, 36),
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
  showScreen('draftScreen');
  renderRound();
}

// ── Combined Mode Render ───────────────────────────
function renderCombinedRound() {
  const round = state.currentRound;
  const config = state.roundConfig[round];
  const packKey = config.pack;

  // Apply sim picks once per round for both occ and min packs
  if (!state.appliedSimRounds.has(round)) {
    [
      { pack: state.occPacks[packKey], removed: state.occRemovedIds[packKey] },
      { pack: state.minPacks[packKey], removed: state.minRemovedIds[packKey] },
    ].forEach(({ pack, removed }) => {
      const avail = pack.filter(c => !removed.has(c['卡片ID']));
      shuffle(avail).slice(0, config.simPicks).forEach(c => removed.add(c['卡片ID']));
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
    drawCrop(div.querySelector('.card-canvas'), card.source_image, card.grid_col, card.grid_row);
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
        requestAnimationFrame(() => drawCrop(div.querySelector('canvas'), card.source_image, card.grid_col, card.grid_row, 0.5));
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

  if (state.raterMode) {
    state.raterLog.push({
      picked: pickedOcc['卡片ID'],
      opponents: state.currentOccShown.filter(c => c['卡片ID'] !== pickedOcc['卡片ID']).map(c => c['卡片ID'])
    });
    state.raterLog.push({
      picked: pickedMin['卡片ID'],
      opponents: state.currentMinShown.filter(c => c['卡片ID'] !== pickedMin['卡片ID']).map(c => c['卡片ID'])
    });
  }

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
    shuffle(available).slice(0, config.simPicks).forEach(c => removed.add(c['卡片ID']));
    state.appliedSimRounds.add(round);
  }

  const toShow = state.packs[packKey].filter(c => !state.removedIds[packKey].has(c['卡片ID']));
  state.currentShown = toShow;

  // Update header
  const isOcc = state.phase === 'occupation';
  document.getElementById('phaseLabel').textContent = isOcc ? '職業牌輪抽' : '次要發展牌輪抽';
  document.getElementById('roundBadge').textContent = `第 ${round + 1} / 7 輪`;
  document.getElementById('packInfo').textContent = `包 ${packKey} · ${toShow.length} 張`;

  // Reset selection
  state.selectedCard = null;
  updateConfirmBar();
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
    drawCrop(div.querySelector('.card-canvas'), card.source_image, card.grid_col, card.grid_row);
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

  updateConfirmBar();
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

  if (state.raterMode) {
    state.raterLog.push({
      picked: card['卡片ID'],
      opponents: state.currentShown.filter(c => c['卡片ID'] !== card['卡片ID']).map(c => c['卡片ID'])
    });
  }

  state.removedIds[config.pack].add(card['卡片ID']);
  state.currentPicks.push(card);
  state.selectedCard = null;
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
    bar.appendChild(div);
    requestAnimationFrame(() => {
      drawCrop(div.querySelector('canvas'), card.source_image, card.grid_col, card.grid_row, 0.5);
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
      drawCrop(div.querySelector('canvas'), card.source_image, card.grid_col, card.grid_row);
    });
  });
}

// ── Result ─────────────────────────────────────────
function showResult() {
  showScreen('resultScreen');
  renderResultGrid('occResultGrid', state.occPicks);
  renderResultGrid('minResultGrid', state.minPicks);
  if (state.raterMode) uploadRatings();
}

async function uploadRatings() {
  const statusEl = document.getElementById('uploadStatus');
  statusEl.style.display = 'flex';
  statusEl.textContent = '評分資料上傳中…';
  statusEl.className = 'upload-status uploading';

  try {
    const K_PAIR = 1; // ELO K-factor per pairwise match

    // Collect all unique card IDs in this draft
    const uniqueIds = [...new Set(state.raterLog.flatMap(r => [r.picked, ...r.opponents]))];

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
    uniqueIds.forEach(id => { ratings[id] = { elo: 1000, seenCount: 0, pickCount: 0 }; });
    batchData.forEach(item => {
      if (item.found) {
        const id = item.found.name.split('/').pop();
        const f = item.found.fields || {};
        ratings[id] = {
          elo:       Number(f.elo?.integerValue       ?? f.elo?.doubleValue       ?? 1000),
          seenCount: Number(f.seenCount?.integerValue ?? 0),
          pickCount: Number(f.pickCount?.integerValue ?? 0),
        };
      }
    });

    // Compute ELO updates round by round (sequential, using pre-round ratings per round)
    state.raterLog.forEach(({ picked, opponents }) => {
      ratings[picked].seenCount++;
      ratings[picked].pickCount++;
      opponents.forEach(id => { ratings[id].seenCount++; });

      if (opponents.length === 0) return;
      const R_p = ratings[picked].elo;
      const deltas = {};

      opponents.forEach(oppId => {
        const R_o = ratings[oppId].elo;
        const E_p = 1 / (1 + Math.pow(10, (R_o - R_p) / 400));
        deltas[picked]  = (deltas[picked]  || 0) + K_PAIR * (1 - E_p);
        deltas[oppId]   = (deltas[oppId]   || 0) + K_PAIR * (0 - E_p);
      });

      Object.entries(deltas).forEach(([id, d]) => { ratings[id].elo += d; });
    });

    // Write all updated ratings back
    const writes = Object.entries(ratings).map(([cardId, { elo, seenCount, pickCount }]) => ({
      update: {
        name: `projects/project-hub-410cd/databases/(default)/documents/agricola_ratings/${cardId}`,
        fields: {
          elo:       { integerValue: `${Math.round(elo)}` },
          seenCount: { integerValue: `${seenCount}` },
          pickCount: { integerValue: `${pickCount}` },
        }
      }
    }));

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

    const totalMatches = state.raterLog.reduce((s, r) => s + r.opponents.length, 0);
    statusEl.textContent = `✓ ELO 更新完成（${state.raterLog.length} 輪 · ${totalMatches} 場對決）`;
    statusEl.className = 'upload-status done';
  } catch (err) {
    statusEl.textContent = `⚠ 上傳失敗：${err.message}`;
    statusEl.className = 'upload-status error';
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
      drawCrop(div.querySelector('canvas'), card.source_image, card.grid_col, card.grid_row);
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
function drawCrop(canvas, imgFile, col, row, topFraction = 1) {
  if (!canvas || !imgFile) return;
  const key = IMG_BASE + imgFile;

  const draw = (img) => {
    const usableW = img.naturalWidth  - CROP.offsetLeft - CROP.offsetRight;
    const usableH = img.naturalHeight - CROP.offsetTop  - CROP.offsetBottom;
    const cellW = usableW / GRID_COLS;
    const cellH = usableH / GRID_ROWS;
    const drawH = cellH * topFraction;
    canvas.width  = cellW;
    canvas.height = drawH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, CROP.offsetLeft + col * cellW, CROP.offsetTop + row * cellH, cellW, drawH, 0, 0, cellW, drawH);
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

  drawCrop(document.getElementById('modalCanvas'), card.source_image, card.grid_col, card.grid_row);
  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Init ───────────────────────────────────────────
init();
