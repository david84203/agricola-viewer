/* ══════════════════════════════════════════════════
   農家樂 Tier List — tierlist.js
   ══════════════════════════════════════════════════ */

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';
const IMG_BASE = './images/';
const GRID_COLS = 3, GRID_ROWS = 3;
const CROP = { offsetTop: 113, offsetBottom: 99, offsetLeft: 182, offsetRight: 164 };

const MIN_SEEN = 5;
const TIERS = ['S', 'A', 'B', 'C', 'D', 'E'];

// S: top 10%, A~E: 90% split equally (each 18%)
const TIER_BOUNDS = [0.10, 0.28, 0.46, 0.64, 0.82, 1.01];
function getTier(rankPct) {
  return TIERS[TIER_BOUNDS.findIndex(b => rankPct < b)];
}

let allCards = [];
let ratingsMap = {};   // cardId → { scoreSum, seenCount }
let imageCache = {};
let activeFilter = 'all';

// ── Init ───────────────────────────────────────────
async function init() {
  try {
    const [cards, ratings] = await Promise.all([
      fetch('./cards.json').then(r => r.json()),
      fetchAllRatings()
    ]);
    allCards = cards;
    ratingsMap = ratings;
    renderTierList();
  } catch (err) {
    document.getElementById('tierLoading').innerHTML =
      `<div style="color:var(--text3)">載入失敗：${err.message}</div>`;
  }
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

  const filtered = allCards.filter(c => {
    if (activeFilter === 'occupation') return c.card_type === 'occupation';
    if (activeFilter === 'minor') return c.card_type === 'minor' || c.card_type === 'both';
    return true;
  });

  const rated = [];
  const unrated = [];

  filtered.forEach(card => {
    const id = card['卡片ID'];
    const r = ratingsMap[id];
    if (r && r.seenCount >= MIN_SEEN) {
      rated.push({ card, elo: r.elo, seenCount: r.seenCount, pickCount: r.pickCount });
    } else {
      unrated.push({ card, seenCount: r?.seenCount ?? 0 });
    }
  });

  if (rated.length === 0 && unrated.length === 0) {
    document.getElementById('tierEmpty').style.display = 'block';
    return;
  }

  rated.sort((a, b) => b.elo - a.elo);

  const n = rated.length;
  const groups = { S: [], A: [], B: [], C: [], D: [], E: [] };
  rated.forEach((item, i) => {
    const tier = getTier(i / n);
    groups[tier].push(item);
  });

  const container = document.getElementById('tierContent');
  container.innerHTML = '';
  container.style.display = 'block';

  TIERS.forEach(tier => {
    if (groups[tier].length === 0) return;
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
    section.className = 'tier-section tier-section-unrated';
    section.innerHTML = `
      <div class="tier-header tier-unrated">
        <span class="tier-badge">?</span>
        <span class="tier-range">資料不足（需至少 ${MIN_SEEN} 筆）</span>
        <span class="tier-count">${unrated.length} 張</span>
      </div>
    `;
    container.appendChild(section);
  }

  const totalSeen = Object.values(ratingsMap).reduce((s, r) => s + r.seenCount, 0);
  document.getElementById('tierStats').textContent =
    `已上榜 ${rated.length} 張 · 資料不足 ${unrated.length} 張 · 累計 ${totalSeen.toLocaleString()} 次展示`;
}

function tierRangeLabel(tier) {
  const pcts = ['前 10%', '10–28%', '28–46%', '46–64%', '64–82%', '82–100%'];
  return pcts[TIERS.indexOf(tier)] || '';
}

function createTierCardEl(card, elo, seenCount, pickCount) {
  const pickRate = seenCount > 0 ? Math.round(pickCount / seenCount * 100) : 0;
  const div = document.createElement('div');
  div.className = 'tier-card';
  div.title = card['牌名'];
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
  requestAnimationFrame(() => {
    drawCrop(div.querySelector('canvas'), card.source_image, card.grid_col, card.grid_row);
  });
  return div;
}

// ── Canvas ─────────────────────────────────────────
function drawCrop(canvas, imgFile, col, row) {
  if (!canvas || !imgFile) return;
  const key = IMG_BASE + imgFile;
  const draw = (img) => {
    const usableW = img.naturalWidth - CROP.offsetLeft - CROP.offsetRight;
    const usableH = img.naturalHeight - CROP.offsetTop - CROP.offsetBottom;
    const cellW = usableW / GRID_COLS;
    const cellH = usableH / GRID_ROWS;
    canvas.width = cellW;
    canvas.height = cellH;
    canvas.getContext('2d').drawImage(img, CROP.offsetLeft + col * cellW, CROP.offsetTop + row * cellH, cellW, cellH, 0, 0, cellW, cellH);
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
