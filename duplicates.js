/* ══════════════════════════════════════════════════
   農家樂 重複卡牌管理 — duplicates.js
   ══════════════════════════════════════════════════ */

const IMG_BASE = './images/';
const GRID_COLS = 3, GRID_ROWS = 3;
const CROP = { offsetTop: 113, offsetBottom: 99, offsetLeft: 182, offsetRight: 164 };
const LS_KEY = 'agricola_dups';

let allCards = [];
let basePairs = [];   // from duplicates.json
let imageCache = {};
let activeTab = 'confirmed';  // default for read-only; admin defaults to 'all'

// picked: { [pairId]: canonicalCardId }
// dismissed: Set of pairId
// custom: [{id, label, cards, defaultCanonical, type:'custom'}]
let state = { picked: {}, dismissed: [], custom: [] };

let selectedA = null, selectedB = null;

// ── Init ───────────────────────────────────────────
async function init() {
  const [cards, pairs] = await Promise.all([
    fetch('./cards.json').then(r => r.json()),
    fetch('./duplicates.json').then(r => r.json()),
  ]);
  allCards = cards;
  basePairs = pairs;
  loadState();
  render();
  setupEvents();
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) state = { picked: {}, dismissed: [], custom: [], ...JSON.parse(raw) };
  } catch {}
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// ── Computed ───────────────────────────────────────
function getAllPairs() {
  return [...basePairs, ...state.custom];
}

function isDismissed(id) { return state.dismissed.includes(id); }
function isPending(id) { return !isDismissed(id) && !state.picked[id]; }
function getCanonical(pair) { return state.picked[pair.id] || pair.defaultCanonical; }

function getExcluded() {
  const excluded = new Set();
  getAllPairs().forEach(pair => {
    if (isDismissed(pair.id)) return;
    const canon = getCanonical(pair);
    if (!canon) return;
    pair.cards.forEach(id => { if (id !== canon) excluded.add(id); });
  });
  return excluded;
}

// ── Render ─────────────────────────────────────────
function render() {
  const pairs = getAllPairs();
  const dismissed = pairs.filter(p => isDismissed(p.id));
  const pending   = pairs.filter(p => isPending(p.id));
  const confirmed = pairs.filter(p => !isDismissed(p.id) && state.picked[p.id]);
  const excluded  = getExcluded();

  document.getElementById('dupStats').textContent =
    `${pairs.length} 組配對 ｜ ${pending.length} 待確認 ｜ ${excluded.size} 張非主要版本將排除`;

  let visible;
  if (activeTab === 'pending')   visible = pending;
  else if (activeTab === 'confirmed') visible = confirmed;
  else if (activeTab === 'dismissed') visible = dismissed;
  else visible = pairs;

  const list = document.getElementById('dupList');
  list.innerHTML = '';

  if (visible.length === 0) {
    list.innerHTML = '<div class="dup-empty">此分類無配對</div>';
    return;
  }

  visible.forEach(pair => {
    const el = createPairEl(pair);
    list.appendChild(el);
  });
}

function createPairEl(pair) {
  const dismissed = isDismissed(pair.id);
  const canon = getCanonical(pair);
  const div = document.createElement('div');
  div.className = 'dup-pair' + (dismissed ? ' dup-pair-dismissed' : '');
  div.dataset.id = pair.id;

  const typeTag = pair.type === 'effect' ? '<span class="dup-type-tag tag-effect">效果相同</span>'
                : pair.type === 'custom'  ? '<span class="dup-type-tag tag-custom">手動新增</span>'
                : '<span class="dup-type-tag tag-name">同名</span>';

  const admin = typeof isAdmin === 'function' && isAdmin();
  div.innerHTML = `
    <div class="dup-pair-header">
      <span class="dup-pair-label">${pair.label}</span>
      ${typeTag}
      ${admin ? `<div class="dup-pair-actions">
        ${dismissed
          ? `<button class="dup-btn-restore" data-id="${pair.id}">↩ 復原</button>`
          : `<button class="dup-btn-dismiss" data-id="${pair.id}">✕ 這不是重複</button>`
        }
        ${pair.type === 'custom' ? `<button class="dup-btn-delete" data-id="${pair.id}">🗑 刪除</button>` : ''}
      </div>` : ''}
    </div>
    <div class="dup-cards-row"></div>
  `;

  const row = div.querySelector('.dup-cards-row');
  pair.cards.forEach((cardId, i) => {
    const card = allCards.find(c => c['卡片ID'] === cardId);
    if (!card) {
      const missing = document.createElement('div');
      missing.className = 'dup-card-wrap';
      missing.innerHTML = `<div class="dup-card-missing">找不到：${cardId}</div>`;
      row.appendChild(missing);
    } else {
      row.appendChild(createCardWrap(pair, card, dismissed));
    }
    if (i < pair.cards.length - 1) {
      const vs = document.createElement('div');
      vs.className = 'dup-vs';
      vs.textContent = 'vs';
      row.appendChild(vs);
    }
  });

  return div;
}

function createCardWrap(pair, card, dismissed) {
  const canon = getCanonical(pair);
  const isCanon = card['卡片ID'] === canon;
  const wrap = document.createElement('div');
  wrap.className = 'dup-card-wrap' + (isCanon ? ' dup-card-canon' : ' dup-card-alt');

  const typeLabel = card.card_type === 'minor' ? '次發' : card.card_type === 'occupation' ? '職業' : '雙色';

  wrap.innerHTML = `
    <div class="dup-card-thumb"><canvas></canvas></div>
    <div class="dup-card-info">
      <div class="dup-card-name">${card['牌名']}</div>
      <div class="dup-card-meta">${card['卡片ID']} ｜ ${card['牌組']} ｜ ${typeLabel}</div>
      <div class="dup-card-desc">${card['說明'] || '—'}</div>
    </div>
    ${!dismissed && (typeof isAdmin === 'function' && isAdmin()) ? `
    <div class="dup-card-footer">
      <label class="dup-radio-wrap">
        <input type="radio" name="canon_${pair.id}" value="${card['卡片ID']}" ${isCanon ? 'checked' : ''} />
        <span class="dup-radio-label ${isCanon ? 'dup-radio-active' : ''}">✓ 主要版本</span>
      </label>
    </div>` : isCanon && !dismissed ? `
    <div class="dup-card-footer">
      <span class="dup-radio-label dup-radio-active">✓ 主要版本</span>
    </div>` : ''}
  `;

  requestAnimationFrame(() => {
    const canvas = wrap.querySelector('canvas');
    if (canvas) drawCrop(canvas, card);
  });

  if (!dismissed) {
    wrap.querySelector('input[type=radio]').addEventListener('change', e => {
      if (e.target.checked) {
        state.picked[pair.id] = card['卡片ID'];
        saveState();
        render();
      }
    });
  }

  return wrap;
}

// ── Canvas ─────────────────────────────────────────
function drawCrop(canvas, card) {
  if (!canvas || !card?.source_image) return;
  const key = IMG_BASE + card.source_image;
  const isComposite = card.source_image.includes('部分.jpg');
  const cols = card.grid_cols || (isComposite ? 10 : GRID_COLS);
  const rows = card.grid_rows || (isComposite ? 3 : GRID_ROWS);
  const oL = card.crop_left   !== undefined ? card.crop_left   : (isComposite ? 0 : CROP.offsetLeft);
  const oR = card.crop_right  !== undefined ? card.crop_right  : (isComposite ? 0 : CROP.offsetRight);
  const oT = card.crop_top    !== undefined ? card.crop_top    : (isComposite ? 0 : CROP.offsetTop);
  const oB = card.crop_bottom !== undefined ? card.crop_bottom : (isComposite ? 0 : CROP.offsetBottom);

  const draw = (img) => {
    const cellW = (img.naturalWidth  - oL - oR) / cols;
    const cellH = (img.naturalHeight - oT - oB) / rows;
    canvas.width  = cellW;
    canvas.height = cellH;
    canvas.getContext('2d').drawImage(img,
      oL + (card.grid_col || 0) * cellW, oT + (card.grid_row || 0) * cellH,
      cellW, cellH, 0, 0, cellW, cellH);
  };

  if (imageCache[key]) { draw(imageCache[key]); return; }
  const img = new Image();
  img.onload = () => { imageCache[key] = img; draw(img); };
  img.onerror = () => { canvas.width = 120; canvas.height = 90; };
  img.src = key;
}

// ── Events ─────────────────────────────────────────
function setupEvents() {
  // Tabs
  document.querySelectorAll('.dup-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.dup-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      render();
    });
  });

  // Delegated: dismiss / restore / delete buttons
  document.getElementById('dupList').addEventListener('click', e => {
    const id = e.target.dataset.id;
    if (!id) return;
    if (e.target.classList.contains('dup-btn-dismiss')) {
      if (!state.dismissed.includes(id)) state.dismissed.push(id);
      delete state.picked[id];
      saveState(); render();
    } else if (e.target.classList.contains('dup-btn-restore')) {
      state.dismissed = state.dismissed.filter(x => x !== id);
      saveState(); render();
    } else if (e.target.classList.contains('dup-btn-delete')) {
      state.custom = state.custom.filter(p => p.id !== id);
      state.dismissed = state.dismissed.filter(x => x !== id);
      delete state.picked[id];
      saveState(); render();
    }
  });

  // Add pair dialog
  document.getElementById('addPairBtn').addEventListener('click', () => {
    selectedA = null; selectedB = null;
    document.getElementById('searchA').value = '';
    document.getElementById('searchB').value = '';
    document.getElementById('selectedA').textContent = '（未選擇）';
    document.getElementById('selectedB').textContent = '（未選擇）';
    document.getElementById('resultsA').innerHTML = '';
    document.getElementById('resultsB').innerHTML = '';
    document.getElementById('addDialog').style.display = 'flex';
  });

  document.getElementById('cancelAdd').addEventListener('click', () => {
    document.getElementById('addDialog').style.display = 'none';
  });

  document.getElementById('confirmAdd').addEventListener('click', () => {
    if (!selectedA || !selectedB) return alert('請選擇兩張卡牌');
    if (selectedA['卡片ID'] === selectedB['卡片ID']) return alert('不能選同一張牌');
    const id = 'c' + Date.now();
    const label = selectedA['牌名'] + '／' + selectedB['牌名'];
    state.custom.push({ id, label, cards: [selectedA['卡片ID'], selectedB['卡片ID']], defaultCanonical: selectedA['卡片ID'], type: 'custom' });
    saveState();
    document.getElementById('addDialog').style.display = 'none';
    activeTab = 'all';
    document.querySelectorAll('.dup-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'all'));
    render();
  });

  setupSearch('searchA', 'resultsA', card => {
    selectedA = card;
    document.getElementById('selectedA').textContent = card['牌名'] + '（' + card['卡片ID'] + '）';
    document.getElementById('resultsA').innerHTML = '';
  });
  setupSearch('searchB', 'resultsB', card => {
    selectedB = card;
    document.getElementById('selectedB').textContent = card['牌名'] + '（' + card['卡片ID'] + '）';
    document.getElementById('resultsB').innerHTML = '';
  });
}

function setupSearch(inputId, resultsId, onSelect) {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    results.innerHTML = '';
    if (!q) return;
    allCards.filter(c => (c['牌名'] || '').toLowerCase().includes(q)).slice(0, 8).forEach(card => {
      const el = document.createElement('div');
      el.className = 'dup-search-item';
      el.textContent = card['牌名'] + '（' + card['卡片ID'] + ' · ' + card['牌組'] + '）';
      el.addEventListener('click', () => { onSelect(card); input.value = ''; });
      results.appendChild(el);
    });
  });
}

// ── Export for draft/tierlist ──────────────────────
// Called by draft.js and tierlist.js to get excluded card IDs
function getExcludedCardIds() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Set();
    const s = JSON.parse(raw);
    const excluded = new Set();

    const fetchPairs = async () => {};  // pairs loaded separately by those pages

    // We export a sync version: read state + basePairs from window if available
    const pairs = window._dupBasePairs || [];
    const custom = s.custom || [];
    const dismissed = s.dismissed || [];
    const picked = s.picked || {};

    [...pairs, ...custom].forEach(pair => {
      if (dismissed.includes(pair.id)) return;
      const canon = picked[pair.id] || pair.defaultCanonical;
      if (!canon) return;
      pair.cards.forEach(id => { if (id !== canon) excluded.add(id); });
    });
    return excluded;
  } catch { return new Set(); }
}

window.getExcludedCardIds = getExcludedCardIds;

// ── Auth callback ──────────────────────────────────
function onAuthChange() {
  const admin = typeof isAdmin === 'function' && isAdmin();

  // 工具列：非管理員隱藏新增按鈕和操作型頁籤
  const toolbar = document.querySelector('.dup-toolbar');
  if (toolbar) toolbar.style.display = admin ? '' : 'none';

  // 頁籤：非管理員只顯示「已確認」
  document.querySelectorAll('.dup-tab').forEach(tab => {
    const t = tab.dataset.tab;
    tab.style.display = (!admin && t !== 'confirmed') ? 'none' : '';
  });

  if (!admin && activeTab !== 'confirmed') {
    activeTab = 'confirmed';
    document.querySelectorAll('.dup-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === 'confirmed');
    });
  } else if (admin && activeTab === 'confirmed') {
    activeTab = 'all';
    document.querySelectorAll('.dup-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === 'all');
    });
  }

  render();
}

init();
