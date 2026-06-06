/* ══════════════════════════════════════════════════
   農家樂 Tier List — tierlist.js
   ══════════════════════════════════════════════════ */

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';
const IMG_BASE = './images/';
const GRID_COLS = 3, GRID_ROWS = 3;

const RATINGS_CACHE_KEY = 'agricola_ratings_cache';
const RATINGS_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours
const CROP = { offsetTop: 113, offsetBottom: 99, offsetLeft: 182, offsetRight: 164 };

const MIN_SEEN = 5;
const TIERS = ['S', 'A', 'B', 'C', 'D', 'E'];
const TIER_BOUNDS = [0.08, 0.25, 0.60, 0.82, 0.95, 1.01];

let BANNED_GROUPS = [
  { label: '過強職業卡',     ids: ['FL049', 'A127', 'I251', 'I260', 'I234', 'I255', '8720-9', '7873-7', '7252-3', '6022-5', '舊版E198', 'K270', 'NL098', 'PI10', 'PI03', 'PI06', 'Z329', 'Ö03', 'Ö01'] },
  { label: '過強次要發展卡', ids: ['B010*', '906-8', 'A010', 'B021', 'A048', 'C031', '6515-6', '5869-10', '5881-9', '4988-8', 'I081', 'Z320', 'K138', 'K125', 'Ö13', 'Ö17'] },
  { label: '過爛職業卡',     ids: ['A107', 'B140', 'A151', 'C144*', 'C111', 'D158*', 'B146', 'C157', 'B101', 'D140', 'A154', '舊版E158', '舊版E170', '舊版E155', 'I247', '舊版E198', '舊版E171', '5030-2', 'Ö05', 'K304', 'Ö02', '5698-2', 'WM033', 'Ö09', '6575-4', 'WA042', 'Z333', 'K317'] },
  { label: '過爛次要發展卡', ids: ['C058', 'B052', 'B018', '舊版E17', '舊版E29', 'I093', '舊版E51', '8315', '6960-2', 'NL023', 'K109', 'FL016', 'FL028', 'Z324'] },
  { label: '擾亂戰局',       ids: ['C093', 'C130', 'C003*'] },
];
let BANNED_IDS = new Set(BANNED_GROUPS.flatMap(g => g.ids));

const BANLIST_CACHE_KEY = 'agricola_banlist_cache';
const BANLIST_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (shared with draft.js)

const BGA_CACHE_KEY = 'agricola_bga_cache';
const BGA_CACHE_TTL = 24 * 60 * 60 * 1000;
const BGA_DECKS = ['A', 'B', 'C', 'D', 'E'];
let bgaExtraIds = new Set();

async function loadBgaIds() {
  try {
    const cached = (() => {
      try {
        const s = JSON.parse(localStorage.getItem(BGA_CACHE_KEY));
        return s && Date.now() - s.cachedAt < BGA_CACHE_TTL ? s.data : null;
      } catch { return null; }
    })();
    const ids = cached ?? await fetch(`${FIRESTORE_BASE}/settings/bga_cards`)
      .then(r => r.json())
      .then(doc => (doc.fields?.ids?.arrayValue?.values || []).map(v => v.stringValue).filter(Boolean));
    bgaExtraIds = new Set(ids);
    if (!cached) localStorage.setItem(BGA_CACHE_KEY, JSON.stringify({ data: ids, cachedAt: Date.now() }));
  } catch {}
}

function isCardBga(card) {
  return BGA_DECKS.includes(card['牌組']) || bgaExtraIds.has(card['卡片ID']);
}

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
      BANNED_GROUPS = groups;
      BANNED_IDS = new Set(BANNED_GROUPS.flatMap(g => g.ids));
    }
  } catch { /* 使用 hardcode fallback */ }
}

function getCardKey(card) {
  return [card['卡片ID'] || '', card.source_image || '', card.position ?? ''].join('|');
}

function getTier(rankPct) {
  return TIERS[TIER_BOUNDS.findIndex(b => rankPct < b)];
}

let allCards = [];
let ratingsMap = {};
let imageCache = {};
let activeFilter = 'all';
let activeBga = false;
let activeDecks = new Set();

// ── Duplicate exclusions ───────────────────────────
async function loadDupExclusions() {
  try {
    const pairs = await fetch('./duplicates.json').then(r => r.json());
    const raw = localStorage.getItem('agricola_dups');
    const s = raw ? JSON.parse(raw) : { picked: {}, dismissed: [], custom: [] };
    const allPairs = [...pairs, ...(s.custom || [])];
    const excluded = new Set();
    allPairs.forEach(pair => {
      if ((s.dismissed || []).includes(pair.id)) return;
      const canon = (s.picked || {})[pair.id] || pair.defaultCanonical;
      if (!canon) return;
      pair.cards.forEach(id => { if (id !== canon) excluded.add(id); });
    });
    return excluded;
  } catch { return new Set(); }
}

// ── Init ───────────────────────────────────────────
async function init() {
  try {
    const [cards, ratings, dupExcluded] = await Promise.all([
      fetch('./cards.json').then(r => r.json()),
      fetchAllRatings(),
      loadDupExclusions(),
      loadBanlist(),
      loadBgaIds(),
    ]);
    allCards = cards.filter(c => !dupExcluded.has(c['卡片ID']) && !dupExcluded.has(getCardKey(c)));
    ratingsMap = ratings;
    populateDeckFilter();
    renderTierList();
  } catch (err) {
    document.getElementById('tierLoading').innerHTML =
      `<div style="color:var(--text3)">載入失敗：${err.message}</div>`;
  }
}

// ── Deck Filter ─────────────────────────────────────
function populateDeckFilter() {
  const decks = [...new Set(allCards.map(c => c['牌組']).filter(Boolean))].sort();
  activeDecks = new Set(decks);
  const row = document.getElementById('deckFilterRow');
  decks.forEach(deck => {
    const btn = document.createElement('button');
    btn.className = 'deck-chip active';
    btn.textContent = deck;
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      if (btn.classList.contains('active')) activeDecks.add(deck);
      else activeDecks.delete(deck);
      renderTierList();
    });
    row.appendChild(btn);
  });
}

// ── Fetch Firestore ────────────────────────────────
function getCachedRatings() {
  try {
    const s = JSON.parse(localStorage.getItem(RATINGS_CACHE_KEY));
    if (s && Date.now() - s.cachedAt < RATINGS_CACHE_TTL) return s.data;
  } catch {}
  return null;
}

async function fetchAllRatings() {
  const cached = getCachedRatings();
  if (cached) return cached;

  const map = {};
  let pageToken = null;
  do {
    let url = `${FIRESTORE_BASE}/agricola_ratings?pageSize=300`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url);
    const data = await res.json();
    (data.documents || []).forEach(doc => {
      const cardId = doc.name.split('/').pop();
      const elo       = Number(doc.fields?.elo?.integerValue      ?? doc.fields?.elo?.doubleValue      ?? 1200);
      const seenCount = Number(doc.fields?.seenCount?.integerValue ?? 0);
      const pickCount = Number(doc.fields?.pickCount?.integerValue ?? 0);
      map[cardId] = { elo, seenCount, pickCount };
    });
    pageToken = data.nextPageToken ?? null;
  } while (pageToken);

  try { localStorage.setItem(RATINGS_CACHE_KEY, JSON.stringify({ data: map, cachedAt: Date.now() })); } catch {}
  return map;
}

// ── Render ─────────────────────────────────────────
function renderTierList() {
  document.getElementById('tierLoading').style.display = 'none';

  const typeOk = c => {
    if (activeBga && !isCardBga(c)) return false;
    if (activeFilter === 'occupation') return c.card_type === 'occupation';
    if (activeFilter === 'minor') return c.card_type === 'minor' || c.card_type === 'both';
    return true;
  };

  const eligible = allCards.filter(c =>
    !BANNED_IDS.has(c['卡片ID']) && activeDecks.has(c['牌組']) && typeOk(c)
  );

  const rated = [], unrated = [];
  eligible.forEach(card => {
    const r = ratingsMap[card['卡片ID']];
    if (r && r.seenCount >= MIN_SEEN) {
      rated.push({ card, elo: r.elo, seenCount: r.seenCount, pickCount: r.pickCount });
    } else {
      unrated.push(card);
    }
  });

  document.getElementById('tierEmpty').style.display = 'none';

  rated.sort((a, b) => b.elo - a.elo);
  const n = rated.length;
  const groups = { S: [], A: [], B: [], C: [], D: [], E: [] };
  rated.forEach((item, i) => { groups[getTier(i / n)].push(item); });

  const container = document.getElementById('tierContent');
  container.innerHTML = '';
  container.style.display = 'block';

  TIERS.forEach(tier => {
    if (!groups[tier].length) return;
    const section = document.createElement('div');
    section.className = 'tier-section collapsed';
    section.innerHTML = `
      <div class="tier-header tier-${tier.toLowerCase()}">
        <span class="tier-collapse-arrow">▼</span>
        <span class="tier-badge">${tier}</span>
        <span class="tier-range">${tierRangeLabel(tier)}</span>
        <span class="tier-count">${groups[tier].length} 張</span>
      </div>
      <div class="tier-card-grid"></div>
    `;
    section.querySelector('.tier-header').addEventListener('click', () => {
      section.classList.toggle('collapsed');
      if (!section.classList.contains('collapsed')) drawPendingCanvases(section);
    });
    const grid = section.querySelector('.tier-card-grid');
    groups[tier].forEach(({ card, elo, seenCount, pickCount }) => {
      grid.appendChild(createTierCardEl(card, elo, seenCount, pickCount));
    });
    container.appendChild(section);
  });

  if (unrated.length > 0) {
    const section = document.createElement('div');
    section.className = 'tier-section';
    section.innerHTML = `
      <div class="tier-header tier-unrated">
        <span class="tier-badge">?</span>
        <span class="tier-range">資料不足（需至少 ${MIN_SEEN} 筆）</span>
        <span class="tier-count">${unrated.length} 張</span>
      </div>
    `;
    container.appendChild(section);
  }

  renderBanSection(container, typeOk);

  const totalSeen = Object.values(ratingsMap).reduce((s, r) => s + r.seenCount, 0);
  document.getElementById('tierStats').textContent =
    `已上榜 ${rated.length} 張 · 資料不足 ${unrated.length} 張 · 累計 ${totalSeen.toLocaleString()} 次展示`;
}

function renderBanSection(container, typeOk) {
  const banSection = document.createElement('div');
  banSection.className = 'tier-ban-section collapsed';

  const title = document.createElement('div');
  title.className = 'tier-ban-title';
  title.innerHTML = `<span class="tier-collapse-arrow">▼</span>🚫 禁卡`;
  title.addEventListener('click', () => {
    banSection.classList.toggle('collapsed');
    if (!banSection.classList.contains('collapsed')) drawPendingCanvases(banSection);
  });
  banSection.appendChild(title);

  const body = document.createElement('div');
  body.className = 'tier-ban-body';

  let hasAny = false;
  BANNED_GROUPS.forEach(({ label, ids }) => {
    const cards = ids
      .map(id => allCards.find(c => c['卡片ID'] === id))
      .filter(c => c && typeOk(c) && activeDecks.has(c['牌組']));
    if (!cards.length) return;
    hasAny = true;

    const group = document.createElement('div');
    group.className = 'tier-ban-group';
    group.innerHTML = `<div class="tier-ban-label">${label}（${cards.length} 張）</div><div class="tier-ban-grid"></div>`;
    const grid = group.querySelector('.tier-ban-grid');
    cards.forEach(card => {
      const el = document.createElement('div');
      el.className = 'tier-ban-card';
      el.innerHTML = `<div class="tier-card-thumb"><canvas></canvas></div><div class="tier-ban-name">${card['牌名']}</div>`;
      el.addEventListener('click', () => openModal(card));
      el.querySelector('canvas')._pendingCard = card;
      grid.appendChild(el);
    });
    body.appendChild(group);
  });

  banSection.appendChild(body);
  if (hasAny) container.appendChild(banSection);
}

function tierRangeLabel(tier) {
  const pcts = ['前 8%', '8–25%', '25–60%', '60–82%', '82–95%', '95–100%'];
  return pcts[TIERS.indexOf(tier)] || '';
}

// ── Card elements ──────────────────────────────────
function createTierCardEl(card, elo, seenCount, pickCount) {
  const pickRate = seenCount > 0 ? Math.round(pickCount / seenCount * 100) : 0;
  const div = document.createElement('div');
  div.className = 'tier-card';
  div.innerHTML = `
    <div class="tier-card-thumb"><canvas></canvas></div>
    <div class="tier-card-info">
      <div class="tier-card-name">${card['牌名'] || '—'}</div>
      <div class="tier-card-meta">
        <span class="tier-card-score">${Math.round(elo)}</span>
        <span class="tier-card-seen">${pickRate}% · ${seenCount}次</span>
      </div>
    </div>
  `;
  div.addEventListener('click', () => openModal(card));
  div.querySelector('canvas')._pendingCard = card;
  return div;
}

// ── Canvas ─────────────────────────────────────────
function drawPendingCanvases(container) {
  container.querySelectorAll('canvas').forEach(canvas => {
    if (canvas._pendingCard) {
      drawCrop(canvas, canvas._pendingCard);
      canvas._pendingCard = null;
    }
  });
}

function drawCrop(canvas, card) {
  if (!canvas || !card?.source_image) return;
  const key = IMG_BASE + card.source_image;
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
  const oL = card.crop_left   !== undefined ? card.crop_left   : base.l;
  const oR = card.crop_right  !== undefined ? card.crop_right  : base.r;
  const oT = card.crop_top    !== undefined ? card.crop_top    : base.t;
  const oB = card.crop_bottom !== undefined ? card.crop_bottom : base.b;

  const draw = (img) => {
    const cellW = (img.naturalWidth  - oL - oR) / cols;
    const cellH = (img.naturalHeight - oT - oB) / rows;
    canvas.width  = cellW;
    canvas.height = cellH;
    canvas.getContext('2d').drawImage(img,
      oL + (card.grid_col || 0) * cellW,
      oT + (card.grid_row || 0) * cellH,
      cellW, cellH, 0, 0, cellW, cellH);
  };

  if (imageCache[key]) { draw(imageCache[key]); return; }
  const img = new Image();
  img.onload = () => { imageCache[key] = img; draw(img); };
  img.onerror = () => {
    canvas.width = 180; canvas.height = 130;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1d2437';
    ctx.fillRect(0, 0, 180, 130);
  };
  img.src = key;
}

// ── Modal ──────────────────────────────────────────
function openModal(card) {
  const typeName = card.card_type === 'minor' ? '次要發展卡'
    : card.card_type === 'occupation' ? '職業卡' : '次要發展卡及主要發展卡';
  document.getElementById('modalTitle').textContent = card['牌名'] || '—';
  document.getElementById('modalId').textContent = card['卡片ID'] || '';
  document.getElementById('modalBadge').className = `modal-badge badge-${card.card_type}`;
  document.getElementById('modalBadge').textContent = typeName;
  document.getElementById('modalDesc').textContent = card['說明'] || '—';

  const fieldsEl = document.getElementById('modalFields');
  fieldsEl.innerHTML = '';
  const fieldDefs = card.card_type === 'occupation'
    ? [['需求人數', card['人數'] || card['需求人數']], ['紅利分數', card['紅利分數']], ['牌組', card['牌組']]]
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

// ── Events ─────────────────────────────────────────
document.querySelectorAll('.chip[data-filter]').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip[data-filter]').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilter = chip.dataset.filter;
    renderTierList();
  });
});

document.getElementById('bgaChip').addEventListener('click', () => {
  activeBga = !activeBga;
  document.getElementById('bgaChip').classList.toggle('active', activeBga);
  renderTierList();
});

document.getElementById('refreshBtn').addEventListener('click', async () => {
  localStorage.removeItem(RATINGS_CACHE_KEY);
  document.getElementById('tierContent').style.display = 'none';
  document.getElementById('tierEmpty').style.display = 'none';
  document.getElementById('tierLoading').style.display = 'flex';
  ratingsMap = await fetchAllRatings();
  renderTierList();
});

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Start ──────────────────────────────────────────
init();
