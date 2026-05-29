/* ══════════════════════════════════════════════════
   農家樂 Tier List — tierlist.js
   ══════════════════════════════════════════════════ */

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';
const IMG_BASE = './images/';
const GRID_COLS = 3, GRID_ROWS = 3;
const CROP = { offsetTop: 113, offsetBottom: 99, offsetLeft: 182, offsetRight: 164 };

const MIN_SEEN = 5;
const TIERS = ['S', 'A', 'B', 'C', 'D', 'E'];
const TIER_BOUNDS = [0.08, 0.25, 0.60, 0.82, 0.95, 1.01];

const BANNED_GROUPS = [
  { label: '過強職業',       ids: ['FL049', 'C093', 'C130', 'A127'] },
  { label: '過強次要發展卡', ids: ['C003*', 'B010*', '906-8', 'A010', 'B021', 'A048', 'C031'] },
  { label: '過爛職業',       ids: ['A107', 'B140', 'A151', 'C144*', 'C111', 'D158*', 'B146', 'C157', 'B101', 'D140', 'A154'] },
  { label: '過爛次要發展卡', ids: ['C058', 'B052', 'B018'] },
];
const BANNED_IDS = new Set(BANNED_GROUPS.flatMap(g => g.ids));

function getTier(rankPct) {
  return TIERS[TIER_BOUNDS.findIndex(b => rankPct < b)];
}

let allCards = [];
let ratingsMap = {};
let imageCache = {};
let activeFilter = 'all';
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
    ]);
    allCards = cards.filter(c => !dupExcluded.has(c['卡片ID']));
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
async function fetchAllRatings() {
  const map = {};
  let pageToken = null;
  do {
    let url = `${FIRESTORE_BASE}/agricola_ratings?pageSize=300`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url);
    const data = await res.json();
    (data.documents || []).forEach(doc => {
      const cardId = doc.name.split('/').pop();
      const elo      = Number(doc.fields?.elo?.integerValue      ?? doc.fields?.elo?.doubleValue      ?? 1000);
      const seenCount = Number(doc.fields?.seenCount?.integerValue ?? 0);
      const pickCount = Number(doc.fields?.pickCount?.integerValue ?? 0);
      map[cardId] = { elo, seenCount, pickCount };
    });
    pageToken = data.nextPageToken ?? null;
  } while (pageToken);
  return map;
}

// ── Render ─────────────────────────────────────────
function renderTierList() {
  document.getElementById('tierLoading').style.display = 'none';

  const typeOk = c => {
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
    section.className = 'tier-section';
    section.innerHTML = `
      <div class="tier-header tier-${tier.toLowerCase()}">
        <span class="tier-badge">${tier}</span>
        <span class="tier-range">${tierRangeLabel(tier)}</span>
        <span class="tier-count">${groups[tier].length} 張</span>
      </div>
      <div class="tier-card-grid"></div>
    `;
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
  banSection.className = 'tier-ban-section';
  banSection.innerHTML = `<div class="tier-ban-title">🚫 禁卡</div>`;

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
      requestAnimationFrame(() => drawCrop(el.querySelector('canvas'), card));
      grid.appendChild(el);
    });
    banSection.appendChild(group);
  });

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
  requestAnimationFrame(() => drawCrop(div.querySelector('canvas'), card));
  return div;
}

// ── Canvas ─────────────────────────────────────────
function drawCrop(canvas, card) {
  if (!canvas || !card?.source_image) return;
  const key = IMG_BASE + card.source_image;
  const isComposite = card.source_image.includes('部分.jpg');
  const isFR = card.source_image.startsWith('FR');
  const cols = card.grid_cols || (isComposite ? 10 : GRID_COLS);
  const rows = card.grid_rows || (isComposite ? 3 : GRID_ROWS);
  const oL = card.crop_left   !== undefined ? card.crop_left   : (isComposite || isFR ? 0 : CROP.offsetLeft);
  const oR = card.crop_right  !== undefined ? card.crop_right  : (isComposite || isFR ? 0 : CROP.offsetRight);
  const oT = card.crop_top    !== undefined ? card.crop_top    : (isComposite || isFR ? 0 : CROP.offsetTop);
  const oB = card.crop_bottom !== undefined ? card.crop_bottom : (isComposite || isFR ? 0 : CROP.offsetBottom);

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
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilter = chip.dataset.filter;
    renderTierList();
  });
});

document.getElementById('refreshBtn').addEventListener('click', async () => {
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
