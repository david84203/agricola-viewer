/* ══════════════════════════════════════════════════
   農家樂 Agricola Card Viewer — app.js
   ══════════════════════════════════════════════════ */

const IMG_BASE = './images/';
const GRID_COLS = 3;
const GRID_ROWS = 3;

// Calibrated crop offsets (pixels in original image resolution)
const CROP = {
  offsetTop:    113,
  offsetBottom: 99,
  offsetLeft:   182,
  offsetRight:  164,
};

let allCards = [];
let filteredCards = [];
let imageCache = {};
let dupNonCanonical = new Set(); // IDs of non-canonical duplicate cards
let dupCardToPair = new Map();   // cardId → { pair, canonId }

// ── Load Data ──────────────────────────────────────
async function loadCards() {
  const [base, overrides, banGroups, dupPairs] = await Promise.all([
    fetch('./cards.json').then(r => r.json()),
    typeof adminLoadOverrides === 'function' ? adminLoadOverrides() : Promise.resolve({}),
    typeof loadBanlistFromFirestore === 'function' ? loadBanlistFromFirestore() : Promise.resolve(null),
    fetch('./duplicates.json').then(r => r.json()).catch(() => []),
  ]);

  // Build non-canonical duplicate set from localStorage state
  const dupState = (() => { try { return JSON.parse(localStorage.getItem('agricola_dups') || '{}'); } catch { return {}; } })();
  const allPairs = [...dupPairs, ...(dupState.custom || [])];
  allPairs.forEach(pair => {
    if ((dupState.dismissed || []).includes(pair.id)) return;
    const canon = (dupState.picked || {})[pair.id] || pair.defaultCanonical;
    if (!canon) return;
    pair.cards.forEach(id => {
      if (id !== canon) {
        dupNonCanonical.add(id);
        dupCardToPair.set(id, { pair, canonId: canon });
      }
    });
  });

  allCards = typeof adminApplyOverrides === 'function' ? adminApplyOverrides(base, overrides) : base;
  if (banGroups) {
    BANNED_GROUPS.length = 0;
    banGroups.forEach(g => BANNED_GROUPS.push(g));
  }

  populateDeckFilter();
  document.getElementById('totalCount').textContent = allCards.length;
  applyFilters();
}

const BGA_DECKS = ['A', 'B', 'C', 'D', 'E'];

// ── Deck filter options ────────────────────────────
function populateDeckFilter() {
  const decks = [...new Set(allCards.map(c => c['牌組'] || '').filter(Boolean))].sort();
  const sel = document.getElementById('deckSelect');

  const bgaOpt = document.createElement('option');
  bgaOpt.value = 'BGA';
  bgaOpt.textContent = 'BGA 牌組 (A/B/C/D/E)';
  sel.appendChild(bgaOpt);

  const sep = document.createElement('option');
  sep.disabled = true;
  sep.textContent = '──────────';
  sel.appendChild(sep);

  decks.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = `${d} 牌組`;
    sel.appendChild(opt);
  });
}

// ── Filters ────────────────────────────────────────
let activeType = 'all';
let activeDeck = 'all';
let searchQuery = '';
let excludeBanned = false;
let excludeDups = false;

// Card elements are created once and reused; only visibility is toggled on filter
const cardElMap = new Map(); // cardId → {el, card}
const canvasCardMap = new WeakMap(); // canvas → card

const lazyCanvasObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const canvas = entry.target;
    lazyCanvasObserver.unobserve(canvas);
    if (!canvas.dataset.drawn) {
      const card = canvasCardMap.get(canvas);
      if (card) drawCrop(canvas, card);
    }
  });
}, { rootMargin: '1200px' });

function applyFilters() {
  const q = searchQuery.toLowerCase();

  filteredCards = allCards.filter(c => {
    // type filter
    if (activeType !== 'all') {
      if (activeType === 'minor' && c.card_type !== 'minor' && c.card_type !== 'both') return false;
      if (activeType !== 'minor' && c.card_type !== activeType) return false;
    }
    // exclude banned toggle
    if (excludeBanned && BANNED_GROUPS.some(g => g.ids.includes(c['卡片ID']))) return false;
    // exclude non-canonical duplicates toggle
    if (excludeDups && dupNonCanonical.has(c['卡片ID'])) return false;
    // deck filter
    if (activeDeck !== 'all') {
      if (activeDeck === 'BGA') {
        if (!BGA_DECKS.includes(c['牌組'])) return false;
      } else {
        if (c['牌組'] !== activeDeck) return false;
      }
    }
    // search
    if (q) {
      const haystack = [c['牌名'], c['卡片ID'], c['說明'], c['先決條件'], c['費用']].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  renderGrid();
  document.getElementById('resultsInfo').textContent =
    filteredCards.length === allCards.length
      ? `共 ${allCards.length} 張卡牌`
      : `顯示 ${filteredCards.length} / ${allCards.length} 張`;
}

// ── Render Grid ────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('cardGrid');

  // First call: create all card elements once
  if (cardElMap.size === 0) {
    allCards.forEach((card, idx) => {
      const el = createCardEl(card, idx);
      cardElMap.set(card['卡片ID'], { el, card });
      grid.appendChild(el);
    });
  }

  // Toggle visibility only
  const filteredSet = new Set(filteredCards.map(c => c['卡片ID']));
  let count = 0;
  cardElMap.forEach(({ el, card }, id) => {
    const show = filteredSet.has(id);
    const wasHidden = el.hidden;
    el.hidden = !show;
    // Re-observe canvas if card just became visible and wasn't drawn yet
    if (show && wasHidden) {
      const canvas = el.querySelector('.card-canvas');
      if (canvas && !canvas.dataset.drawn) lazyCanvasObserver.observe(canvas);
    }
    if (show) count++;
  });

  // Empty state
  let emptyEl = grid.querySelector('.empty-state');
  if (count === 0) {
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.className = 'empty-state';
      emptyEl.innerHTML = `<div class="empty-icon">🌾</div><p>找不到符合條件的卡牌</p>`;
      grid.appendChild(emptyEl);
    }
  } else if (emptyEl) {
    emptyEl.remove();
  }
}

// ── Create Card Element ────────────────────────────
function createCardEl(card, idx) {
  const typeClass = `type-${card.card_type}`;
  const typeBadgeClass = `badge-${card.card_type}`;
  const typeName = card.card_type === 'minor' ? '次要發展卡'
                 : card.card_type === 'occupation' ? '職業卡'
                 : '<span class="badge-both-minor">次要及</span><span class="badge-both-occ">主要發展卡</span>';

  const isDupNonCanon = dupNonCanonical.has(card['卡片ID']);
  const banned = BANNED_GROUPS.some(g => g.ids.includes(card['卡片ID']));

  const div = document.createElement('div');
  div.className = `card-item ${typeClass}${isDupNonCanon ? ' card-dup-excluded' : ''}${banned ? ' card-banned-excluded' : ''}`;
  div.dataset.idx = idx;

  // Tags
  const vp = card['勝利點數'] && card['勝利點數'] !== '無';
  const bonus = card['紅利分數'] === '有';
  const pass = card['是否傳遞'] === '是';
  const tagsHtml = [
    banned ? `<span class="tag tag-ban">禁卡</span>` : '',
    vp    ? `<span class="tag tag-vp">VP:${card['勝利點數']}</span>` : '',
    bonus ? `<span class="tag tag-bonus">紅利分數</span>` : '',
    pass  ? `<span class="tag tag-pass">←傳遞←</span>` : '',
  ].join('');

  div.innerHTML = `
    <div class="card-thumb-wrap">
      <canvas class="card-canvas" data-img="${card.source_image}"
        data-col="${card.grid_col}" data-row="${card.grid_row}"></canvas>
      ${isDupNonCanon ? '<div class="card-dup-badge">重複</div>' : ''}
      ${banned ? '<div class="card-dup-badge card-ban-badge">禁卡</div>' : ''}
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span class="card-type-badge ${typeBadgeClass}">${typeName}</span>
        <span class="card-id">${card['卡片ID'] || ''}</span>
      </div>
      <div class="card-name">${card['牌名'] || '—'}</div>
      <div class="card-desc">${card['說明'] || ''}</div>
      ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}
    </div>
  `;

  div.addEventListener('click', () => {
    if (dupNonCanonical.has(card['卡片ID'])) openDupCompare(card);
    else openModal(card);
  });

  // Register canvas for lazy draw via IntersectionObserver
  const canvas = div.querySelector('.card-canvas');
  if (canvas) {
    canvasCardMap.set(canvas, card);
    lazyCanvasObserver.observe(canvas);
  }

  return div;
}

// ── Canvas Crop ────────────────────────────────────
// Each source image is a 3×3 grid of cards (sometimes fewer in last row).
// We draw the specific cell onto a canvas so it's natively responsive.
function drawCrop(canvas, card) {
  const key = IMG_BASE + card.source_image;

  const draw = (img) => {
    // Check if the image is a composite (from the older set named ...部分.jpg or 舊版)
    const isComposite = card.source_image.includes('部分.jpg') || card.source_image.includes('舊版');
    const isTTS = card.source_image.startsWith('FR') || card.source_image.startsWith('Gm') || card.source_image.startsWith('Go') || card.source_image.toLowerCase().startsWith('wa');

    const cols = card.grid_cols || (isComposite ? 10 : GRID_COLS);
    const rows = card.grid_rows || (isComposite ? 3 : GRID_ROWS);
    
    // Default crop offsets unless overridden
    const offsetLeft = card.crop_left !== undefined ? card.crop_left : (isComposite || isTTS ? 0 : CROP.offsetLeft);
    const offsetRight = card.crop_right !== undefined ? card.crop_right : (isComposite || isTTS ? 0 : CROP.offsetRight);
    const offsetTop = card.crop_top !== undefined ? card.crop_top : (isComposite || isTTS ? 0 : CROP.offsetTop);
    const offsetBottom = card.crop_bottom !== undefined ? card.crop_bottom : (isComposite || isTTS ? 0 : CROP.offsetBottom);

    const usableW = img.naturalWidth  - offsetLeft - offsetRight;
    const usableH = img.naturalHeight - offsetTop  - offsetBottom;
    const cellW = usableW / cols;
    const cellH = usableH / rows;
    const sx = offsetLeft + (card.grid_col || 0) * cellW;
    const sy = offsetTop  + (card.grid_row || 0) * cellH;

    canvas.width  = cellW;
    canvas.height = cellH;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, cellW, cellH, 0, 0, cellW, cellH);
    canvas.dataset.drawn = '1';
  };

  if (imageCache[key]) {
    draw(imageCache[key]);
  } else {
    const img = new Image();
    img.onload = () => {
      imageCache[key] = img;
      draw(img);
    };
    img.onerror = () => {
      // Draw placeholder
      canvas.width = 300; canvas.height = 220;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1d2437';
      ctx.fillRect(0,0,300,220);
      ctx.fillStyle = '#3d4f70';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('圖片未找到', 150, 110);
      ctx.fillText(imgFile, 150, 130);
    };
    img.src = key;
  }
}

// ── Duplicate Compare Modal ────────────────────────
function openDupCompare(nonCanonCard) {
  const info = dupCardToPair.get(nonCanonCard['卡片ID']);
  if (!info) { openModal(nonCanonCard); return; }
  const canonCard = allCards.find(c => c['卡片ID'] === info.canonId);
  if (!canonCard) { openModal(nonCanonCard); return; }

  // Inject overlay if not present
  let overlay = document.getElementById('dupCompareOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'dupCompareOverlay';
    overlay.className = 'dup-cmp-overlay-inline';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeDupCompare(); });
  }

  const cardHtml = (card, isCanon) => `
    <div class="dup-ci-card${isCanon ? ' dup-ci-canon' : ''}">
      <div class="dup-ci-thumb"><canvas data-card-id="${card['卡片ID']}"></canvas></div>
      <div class="dup-ci-label">${isCanon ? '✓ 選用此版本' : '✕ 此版本被取代'}</div>
      <div class="dup-ci-name">${card['牌名'] || '—'}</div>
      <div class="dup-ci-id">${card['卡片ID']}</div>
      <div class="dup-ci-desc">${card['說明'] || ''}</div>
    </div>`;

  overlay.innerHTML = `
    <div class="dup-ci-modal">
      <button class="dup-ci-close" id="dupCiClose">✕</button>
      <div class="dup-ci-header">重複卡牌比對</div>
      <div class="dup-ci-grid">
        ${cardHtml(canonCard, true)}
        <div class="dup-ci-vs">vs</div>
        ${cardHtml(nonCanonCard, false)}
      </div>
    </div>`;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('dupCiClose').addEventListener('click', closeDupCompare);

  // Draw canvases
  [canonCard, nonCanonCard].forEach(card => {
    const canvas = overlay.querySelector(`canvas[data-card-id="${card['卡片ID']}"]`);
    if (canvas) requestAnimationFrame(() => drawCrop(canvas, card));
  });
}

function closeDupCompare() {
  const overlay = document.getElementById('dupCompareOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Modal ──────────────────────────────────────────
function openModal(card) {
  const overlay = document.getElementById('modalOverlay');
  const typeBadgeClass = `badge-${card.card_type}`;

  document.getElementById('modalTitle').textContent = card['牌名'] || '—';
  document.getElementById('modalId').textContent = card['卡片ID'] || '';
  const isBanned = BANNED_GROUPS.some(g => g.ids.includes(card['卡片ID']));
  document.getElementById('modalBanBadge').style.display = isBanned ? '' : 'none';
  const badgeEl = document.getElementById('modalBadge');
  badgeEl.className = `modal-badge ${typeBadgeClass}`;
  if (card.card_type === 'both') {
    badgeEl.innerHTML = '<span class="badge-both-minor">次要及</span><span class="badge-both-occ">主要發展卡</span>';
  } else {
    badgeEl.textContent = card.card_type === 'minor' ? '次要發展卡' : '職業卡';
  }
  document.getElementById('modalDesc').textContent = card['說明'] || '—';

  // Fields
  const fieldsEl = document.getElementById('modalFields');
  fieldsEl.innerHTML = '';

  const fieldDefs = card.card_type === 'occupation'
    ? [
        ['需求人數', card['人數'] || card['需求人數']],
        ['紅利分數', card['紅利分數']],
        ['牌組', card['牌組']],
      ]
    : [
        ['先決條件', card['先決條件']],
        ['費用', card['費用']],
        ['是否傳遞', card['是否傳遞']],
        ['勝利點數', card['勝利點數'], 'vp'],
        ['紅利分數', card['紅利分數'], 'bonus'],
        ['牌組', card['牌組']],
      ];

  fieldDefs.forEach(([label, value, highlight]) => {
    if (!value) return;
    const row = document.createElement('div');
    row.className = 'field-row';
    const cls = highlight === 'vp' && value !== '無' ? 'highlight-vp'
              : highlight === 'bonus' && value === '有' ? 'highlight-bonus'
              : '';
    row.innerHTML = `
      <div class="field-label">${label}</div>
      <div class="field-value ${cls}">${value}</div>
    `;
    fieldsEl.appendChild(row);
  });

  // Draw modal canvas
  const modalCanvas = document.getElementById('modalCanvas');
  drawCrop(modalCanvas, card);

  // Admin edit button
  let editBtn = document.getElementById('modalAdminEditBtn');
  if (!editBtn) {
    editBtn = document.createElement('button');
    editBtn.id = 'modalAdminEditBtn';
    editBtn.className = 'admin-edit-card-btn';
    editBtn.textContent = '✏️ 編輯此卡';
    document.querySelector('.modal-info').appendChild(editBtn);
  }
  editBtn.style.display = (typeof isAdmin === 'function' && isAdmin()) ? '' : 'none';
  editBtn.onclick = () => openCardEditModal(card, allCards);

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

// ── Auth callback ──────────────────────────────────
function onAuthChange() {
  const admin = typeof isAdmin === 'function' && isAdmin();
  const banAdminBtn = document.getElementById('banAdminBtn');
  if (banAdminBtn) banAdminBtn.style.display = admin ? '' : 'none';
  const editBtn = document.getElementById('modalAdminEditBtn');
  if (editBtn) editBtn.style.display = admin ? '' : 'none';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  const banlistOpen = document.getElementById('banlistOverlay').classList.contains('open');
  if (!banlistOpen) document.body.style.overflow = '';
}

// ── Event Listeners ────────────────────────────────
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDupCompare(); }
});

// Filter chips (type, mutually exclusive)
document.querySelectorAll('.filter-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeType = chip.dataset.filter;
    applyFilters();
  });
});

// Exclude banned toggle (independent)
document.getElementById('excludeBanBtn').addEventListener('click', () => {
  excludeBanned = !excludeBanned;
  document.getElementById('excludeBanBtn').classList.toggle('active', excludeBanned);
  applyFilters();
});

// Exclude non-canonical duplicates toggle (independent)
document.getElementById('excludeDupBtn').addEventListener('click', () => {
  excludeDups = !excludeDups;
  document.getElementById('excludeDupBtn').classList.toggle('active', excludeDups);
  applyFilters();
});

// Deck select
document.getElementById('deckSelect').addEventListener('change', e => {
  activeDeck = e.target.value;
  applyFilters();
});

// Search
const searchInput = document.getElementById('searchInput');
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = searchInput.value.trim();
    applyFilters();
  }, 250);
});

document.getElementById('clearSearch').addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  applyFilters();
});

// ── Banlist ────────────────────────────────────────
const BANNED_GROUPS = [  // populated from Firestore on load; fallback hardcoded
  { label: '過強職業卡',     ids: ['FL049', 'A127', 'I251', 'I260', 'I234', 'I255'] },
  { label: '過強次要發展卡', ids: ['B010*', '906-8', 'A010', 'B021', 'A048', 'C031'] },
  { label: '過爛職業卡',     ids: ['A107', 'B140', 'A151', 'C144*', 'C111', 'D158*', 'B146', 'C157', 'B101', 'D140', 'A154', '舊版E158', '舊版E170', '舊版E155', 'I247'] },
  { label: '過爛次要發展卡', ids: ['C058', 'B052', 'B018', '舊版E17', '舊版E29', 'I093', '舊版E51'] },
  { label: '擾亂戰局',       ids: ['C093', 'C130', 'C003*'] },
];

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

    const section = document.createElement('div');
    section.className = 'banlist-section';
    section.innerHTML = `<div class="banlist-section-label">${label}（${cards.length} 張）</div>`;

    const grid = document.createElement('div');
    grid.className = 'banlist-grid';
    if (cards.length === 0) {
      grid.innerHTML = '<div class="banlist-empty">尚無禁卡</div>';
    }
    cards.forEach(card => {
      const item = document.createElement('div');
      item.className = 'banlist-card';
      item.style.cursor = 'pointer';
      item.innerHTML = `<canvas></canvas><div class="banlist-card-name">${card['牌名']}</div>`;
      item.addEventListener('click', () => openModal(card));
      grid.appendChild(item);
      requestAnimationFrame(() => {
        const canvas = item.querySelector('canvas');
        drawCrop(canvas, card);
        function applySize(retries) {
          if (canvas.dataset.drawn === '1') {
            canvas.style.width = '100%';
            canvas.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
          } else if (retries > 0) {
            requestAnimationFrame(() => applySize(retries - 1));
          }
        }
        applySize(60);
      });
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

document.getElementById('banlistBtn').addEventListener('click', openBanlist);
document.getElementById('banAdminBtn').addEventListener('click', () => openBanAdmin(allCards));
document.getElementById('banlistClose').addEventListener('click', closeBanlist);
document.getElementById('banlistOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeBanlist();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeBanlist();
});

// ── Init ───────────────────────────────────────────
loadCards();
