/* ══════════════════════════════════════════════════
   農家樂 Agricola Card Viewer — app.js
   ══════════════════════════════════════════════════ */

// 卡圖檔 CDN 單一開關（sprite sheet 用）：圖已搬 Cloudflare。回滾＝設 localStorage hv-card-cdn 指回 './'。
const CARD_IMG_CDN = localStorage.getItem('hv-card-cdn') || 'https://agricola-cards.pages.dev/';
const IMG_BASE = CARD_IMG_CDN + 'images/';
const GRID_COLS = 3;
const GRID_ROWS = 3;

// Calibrated crop offsets (pixels in original image resolution)
const CROP = {
  offsetTop:    113,
  offsetBottom: 99,
  offsetLeft:   182,
  offsetRight:  164,
};
const CROP_REF = { width: 2040, height: 2807 };

let allCards = [];
let filteredCards = [];
let imageCache = {};

const LATEST_COUNT = 18;
let latestCards = [];
let latestKeySet = new Set();
let allElsBuilt = false;
let dupNonCanonical = new Set(); // IDs of non-canonical duplicate cards
let dupCardToPair = new Map();   // cardId → { pair, canonId }
let dupCanonicalMap = new Map(); // cardId → [{ pair, replacedIds }]
let bgaExtraIds = new Set();     // manually marked BGA card IDs
let effectsById = new Map();     // 卡片ID → 結構化卡效（effects.json，載入失敗則靜默降級為空）
let onlineImplMap = new Map();    // 卡片ID → 線上實作機制中文（online-implemented.json；GM/YOYO 專用徽章）

// ── Load Data ──────────────────────────────────────
async function loadCards() {
  const implViewer = typeof isImplStatusViewer === 'function' && isImplStatusViewer();
  const [base, overrides, banGroups, dupPairs, bgaData, effectsData, onlineImplData] = await Promise.all([
    fetch('./cards.json').then(r => r.json()),
    typeof adminLoadOverrides === 'function' ? adminLoadOverrides() : Promise.resolve({}),
    typeof loadBanlistFromFirestore === 'function' ? loadBanlistFromFirestore() : Promise.resolve(null),
    fetch('./duplicates.json').then(r => r.json()).catch(() => []),
    typeof loadBgaFromFirestore === 'function' ? loadBgaFromFirestore() : Promise.resolve([]),
    fetch('./effects.json').then(r => r.json()).catch(() => []),
    // 線上已實作清單：僅 GM/YOYO 需要，非白名單不抓（比照 impl-status 的私有原則）
    implViewer ? fetch('./online-implemented.json').then(r => r.json()).catch(() => null) : Promise.resolve(null),
    window.CardImages?.load?.() || Promise.resolve(),
    (implViewer && typeof ensureImplStatus === 'function') ? ensureImplStatus() : Promise.resolve(null),
  ]);
  effectsById = new Map((effectsData || []).map(e => [e.cardId, e]));
  onlineImplMap = new Map(onlineImplData && onlineImplData.cards ? Object.entries(onlineImplData.cards) : []);

  allCards = typeof adminApplyOverrides === 'function' ? adminApplyOverrides(base, overrides) : base;

  latestCards = allCards.slice(-LATEST_COUNT).reverse();
  latestKeySet = new Set(latestCards.map(getCardKey));

  const dupInfo = await DuplicateCards.loadDuplicateInfo(allCards, dupPairs);
  dupNonCanonical = dupInfo.nonCanonicalKeys;
  dupCardToPair = dupInfo.cardToPair;
  dupCanonicalMap = dupInfo.canonicalMap;

  if (banGroups) {
    BANNED_GROUPS.length = 0;
    banGroups.forEach(g => BANNED_GROUPS.push(g));
  }
  bgaExtraIds = new Set(bgaData || []);

  populateDeckFilter();
  if (typeof renderImplStatusFilterControl === 'function') renderImplStatusFilterControl();
  document.getElementById('totalCount').textContent = allCards.length;
  const _bannedKeys = new Set(allCards.filter(c => BANNED_GROUPS.some(g => g.ids.includes(c['卡片ID']))).map(getCardKey));
  const _excluded = new Set([..._bannedKeys, ...dupNonCanonical]);
  document.getElementById('netCount').textContent = allCards.length - _excluded.size;
  applyFilters();
}

const BGA_DECKS = ['A', 'B', 'C', 'D', 'E'];
function isCardBga(card) {
  return BGA_DECKS.includes(card['牌組']) || bgaExtraIds.has(card['卡片ID']);
}

// ── Deck filter options ────────────────────────────
function populateDeckFilter() {
  const decks = [...new Set(allCards.map(c => c['牌組'] || '').filter(Boolean))].sort();
  const sel = document.getElementById('deckSelect');

  const bgaOpt = document.createElement('option');
  bgaOpt.value = 'BGA';
  bgaOpt.textContent = 'BGA 牌組';
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
let activeDeck = 'latest';
let searchQuery = '';
let excludeBanned = false;
let excludeDups = false;
let activeImplStatus = 'all'; // 卡牌實作狀態篩選（白名單專用，見 impl-status.js）

// ── 牌力評分（ELO / Tier）─────────────────────────
// 預設不顯示、不抓資料；使用者選「牌力排序」才懶載入。
// 快取與 tierlist 共用同一把 key，零額外 Firestore 成本。
const RATINGS_FS_BASE = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';
const RATINGS_CACHE_KEY = 'agricola_ratings_cache_v5'; // v5：BGA 禁卡種分＋顯示邏輯調整後刷新快取
const RATINGS_CACHE_TTL = 2 * 60 * 60 * 1000;
const RATING_MIN_SEEN = 5;
const RATING_TIERS = ['S', 'A', 'B', 'C', 'D', 'E'];
const RATING_TIER_BOUNDS = [0.08, 0.25, 0.60, 0.82, 0.95, 1.01];

let activeSort = 'default';
let domSorted = false;          // DOM 目前是否已被牌力排序重排
let ratingsMap = null;          // 卡片ID → { elo, seenCount, pickCount, rankSeen }
let ratingsLoading = null;      // 載入中的 Promise（避免重複抓）
let tierMap = new Map();        // 卡片ID → 'S'..'E'（完整牌池排名）
let ratingScoreMap = new Map(); // 卡片ID → 綜合分數（排序用）

function ratingTierGet(pct) {
  return RATING_TIERS[RATING_TIER_BOUNDS.findIndex(b => pct < b)];
}
function ratingCompositeScore({ elo, seenCount, pickCount }) {
  if (!seenCount) return elo;
  const pickRate = pickCount / seenCount;
  const prior = 1200 + (pickRate - 0.11) * 450; // 0.11 ≈ 1/9（9張包隨機基準）
  const conf = Math.min(seenCount / 30, 1);
  return conf * elo + (1 - conf) * prior;
}
function isCardBannedById(id) {
  return BANNED_GROUPS.some(g => g.ids.includes(id));
}

async function fetchAllRatings() {
  try {
    const s = JSON.parse(localStorage.getItem(RATINGS_CACHE_KEY));
    if (s && Date.now() - s.cachedAt < RATINGS_CACHE_TTL) return s.data;
  } catch {}

  const map = {};
  let pageToken = null;
  do {
    let url = `${RATINGS_FS_BASE}/agricola_ratings?pageSize=300`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url);
    const data = await res.json();
    (data.documents || []).forEach(doc => {
      const cardId = doc.name.split('/').pop();
      const elo       = Number(doc.fields?.elo?.integerValue      ?? doc.fields?.elo?.doubleValue ?? 1200);
      const seenCount = Number(doc.fields?.seenCount?.integerValue ?? 0);
      const pickCount = Number(doc.fields?.pickCount?.integerValue ?? 0);
      const rankSeen  = Number(doc.fields?.rankSeen?.integerValue  ?? 0);
      map[cardId] = { elo, seenCount, pickCount, rankSeen };
    });
    pageToken = data.nextPageToken ?? null;
  } while (pageToken);

  try { localStorage.setItem(RATINGS_CACHE_KEY, JSON.stringify({ data: map, cachedAt: Date.now() })); } catch {}
  return map;
}

// 以完整牌池（排除禁卡）計算 canonical Tier，與牌力排行頁一致
function buildTierMap() {
  const rated = [];
  allCards.forEach(card => {
    const id = card['卡片ID'];
    if (isCardBannedById(id)) return;
    const r = ratingsMap[id];
    if (r && r.seenCount >= RATING_MIN_SEEN) rated.push({ id, score: ratingCompositeScore(r) });
  });
  rated.sort((a, b) => b.score - a.score);
  const n = rated.length;
  tierMap = new Map();
  ratingScoreMap = new Map();
  rated.forEach((item, i) => {
    tierMap.set(item.id, ratingTierGet(i / n));
    ratingScoreMap.set(item.id, item.score);
  });
}

async function ensureRatings() {
  if (ratingsMap) return;
  if (!ratingsLoading) {
    ratingsLoading = (async () => {
      ratingsMap = await fetchAllRatings();
      buildTierMap();
      applyRatingBadges();
    })();
  }
  await ratingsLoading;
}

// 把 ELO/Tier 徽章注入每張已建立的卡片（只跑一次；顯示與否由 grid 的 .show-rating class 控制）
function applyRatingBadges() {
  cardElMap.forEach(({ el, card }) => {
    const wrap = el.querySelector('.card-thumb-wrap');
    if (!wrap) return;
    let badge = wrap.querySelector('.card-rating');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'card-rating';
      wrap.appendChild(badge);
    }
    const id = card['卡片ID'];
    const r = ratingsMap[id];
    if (isCardBannedById(id)) {
      badge.className = 'card-rating rating-banned';
      badge.innerHTML = `<span class="rating-tier">🚫</span>`;
    } else if (r && r.seenCount >= RATING_MIN_SEEN) {
      const tier = tierMap.get(id) || '?';
      badge.className = `card-rating rating-tier-${tier.toLowerCase()}`;
      badge.innerHTML = `<span class="rating-tier">${tier}</span><span class="rating-elo">${Math.round(r.elo)}</span>`;
    } else {
      badge.className = 'card-rating rating-na';
      badge.innerHTML = `<span class="rating-tier">?</span>`;
    }
  });
}

function ratingSortValue(card) {
  const id = card['卡片ID'];
  return ratingScoreMap.has(id) ? ratingScoreMap.get(id) : null; // 未上榜/禁卡 → null（排到最後）
}

// Card elements are created once and reused; only visibility is toggled on filter
const cardElMap = new Map(); // unique card key → {el, card}
const canvasCardMap = new WeakMap(); // canvas → card

function getCardKey(card) {
  return [card['卡片ID'] || '', card.source_image || '', card.position ?? ''].join('|');
}

function getCardId(card) {
  return card?.['卡片ID'] || '';
}

function isPreciseCardRef(ref) {
  return String(ref || '').includes('|');
}

function resolveCardRef(ref) {
  if (!ref) return null;
  const value = String(ref);
  if (isPreciseCardRef(value)) {
    const [id, source, position] = value.split('|');
    return allCards.find(c => getCardKey(c) === value)
      || allCards.find(c =>
        getCardId(c) === id
        && (c.source_image || '') === source
        && String(c.position ?? '') === position
      );
  }
  return allCards.find(c => getCardId(c) === value);
}

function isCardCanonical(card, canonicalRef) {
  return isPreciseCardRef(canonicalRef)
    ? getCardKey(card) === canonicalRef
    : getCardId(card) === canonicalRef;
}

function getCanonicalReplacedIds(card) {
  const entries = dupCanonicalMap.get(getCardKey(card)) || [];
  return [...new Set(entries.flatMap(entry => entry.replacedRefs))];
}

function getReplacedCardsText(card) {
  return getCanonicalReplacedIds(card)
    .map(ref => {
      const replaced = resolveCardRef(ref);
      return replaced ? `${replaced['牌名'] || '未命名'}（${replaced['卡片ID']}）` : ref;
    })
    .join('、');
}

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
    if (excludeDups && dupNonCanonical.has(getCardKey(c))) return false;
    // impl status filter（白名單專用；非白名單一律忽略此篩選）
    if (activeImplStatus !== 'all' && typeof isImplStatusViewer === 'function' && isImplStatusViewer()) {
      if (activeImplStatus === 'online') {
        // 線上已實作＝online-implemented.json 白名單（play.js 自動真相）；ID 帶星號要先去掉
        if (!onlineImplMap.has(String(c['卡片ID']).replace(/\*$/, ''))) return false;
      } else if (String(getImplStatus(c['卡片ID'])) !== activeImplStatus) return false;
    }
    // deck filter
    if (activeDeck === 'latest') {
      if (!latestKeySet.has(getCardKey(c))) return false;
    } else if (activeDeck !== 'all') {
      if (activeDeck === 'BGA') {
        if (!BGA_DECKS.includes(c['牌組']) && !bgaExtraIds.has(c['卡片ID'])) return false;
      } else {
        if (c['牌組'] !== activeDeck) return false;
      }
    }
    // search
    if (q) {
      // 「人數」要一起搜：職業卡的 1+/3+/4+ 原本擠在先決條件欄，2026-08-06 清到人數欄後
      // 若不加進來，打「3+」就搜不到那批職業卡了。
      const haystack = [c['牌名'], c['卡片ID'], c['說明'], c['先決條件'], c['費用'], c['人數']].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // 最新模式預設排序：新→舊
  if (activeDeck === 'latest' && activeSort === 'default') {
    const order = new Map(latestCards.map((c, i) => [getCardKey(c), i]));
    filteredCards.sort((a, b) => order.get(getCardKey(a)) - order.get(getCardKey(b)));
  }

  // 牌力排序（選了才生效；未上榜的牌固定排到最後）
  if (activeSort !== 'default') {
    const dir = activeSort === 'elo_asc' ? 1 : -1;
    filteredCards.sort((a, b) => {
      const sa = ratingSortValue(a), sb = ratingSortValue(b);
      if (sa === null && sb === null) return 0;
      if (sa === null) return 1;
      if (sb === null) return -1;
      return (sa - sb) * dir;
    });
  }

  renderGrid();
  document.getElementById('resultsInfo').textContent =
    activeDeck === 'latest'
      ? `最新加入的 ${filteredCards.length} 張卡牌（共 ${allCards.length} 張）`
      : filteredCards.length === allCards.length
        ? `共 ${allCards.length} 張卡牌`
        : `顯示 ${filteredCards.length} / ${allCards.length} 張`;
}

// ── Render Grid ────────────────────────────────────

// 「最新」模式只建最新 N 張的元素；其他模式第一次進入時補建全部（一次性）
function ensureCardEls() {
  const grid = document.getElementById('cardGrid');
  if (allElsBuilt) return;

  if (activeDeck === 'latest') {
    latestCards.forEach(card => {
      const key = getCardKey(card);
      if (cardElMap.has(key)) return;
      const el = createCardEl(card, allCards.indexOf(card));
      cardElMap.set(key, { el, card });
      grid.appendChild(el);
    });
    return;
  }

  const frag = document.createDocumentFragment();
  allCards.forEach((card, idx) => {
    const key = getCardKey(card);
    let entry = cardElMap.get(key);
    if (!entry) {
      entry = { el: createCardEl(card, idx), card };
      cardElMap.set(key, entry);
    }
    frag.appendChild(entry.el);
  });
  grid.appendChild(frag);
  allElsBuilt = true;
}

function renderGrid() {
  const grid = document.getElementById('cardGrid');
  ensureCardEls();

  // Toggle visibility only
  const filteredSet = new Set(filteredCards.map(c => getCardKey(c)));
  let count = 0;
  cardElMap.forEach(({ el, card }) => {
    const show = filteredSet.has(getCardKey(card));
    const wasHidden = el.hidden;
    el.hidden = !show;
    // Re-observe canvas if card just became visible and wasn't drawn yet
    if (show && wasHidden) {
      const canvas = el.querySelector('.card-canvas');
      if (canvas && !canvas.dataset.drawn) lazyCanvasObserver.observe(canvas);
    }
    if (show) count++;
  });

  // 牌力排序或最新模式時重排 DOM；切回全部預設時還原原始順序
  if (activeSort !== 'default' || activeDeck === 'latest') {
    const frag = document.createDocumentFragment();
    filteredCards.forEach(c => {
      const entry = cardElMap.get(getCardKey(c));
      if (entry) frag.appendChild(entry.el); // appendChild 會把既有節點搬到新位置
    });
    grid.appendChild(frag);
    domSorted = true;
  } else if (domSorted) {
    const frag = document.createDocumentFragment();
    allCards.forEach(c => {
      const entry = cardElMap.get(getCardKey(c));
      if (entry) frag.appendChild(entry.el);
    });
    grid.appendChild(frag);
    domSorted = false;
  }

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

  const isDupNonCanon = dupNonCanonical.has(getCardKey(card));
  const replacedCount = getCanonicalReplacedIds(card).length;
  const banned = BANNED_GROUPS.some(g => g.ids.includes(card['卡片ID']));
  const bga = isCardBga(card);

  const div = document.createElement('div');
  div.className = `card-item ${typeClass}${isDupNonCanon ? ' card-dup-excluded' : ''}${banned ? ' card-banned-excluded' : ''}`;
  div.dataset.idx = idx;

  // Tags
  const vp = card['勝利點數'] && card['勝利點數'] !== '無';
  const bonus = card['紅利分數'] === '有';
  const minus = card['負分標記'] === '有';
  const pass = card['是否傳遞'] === '是';
  const tagsHtml = [
    bga   ? `<span class="tag tag-bga">BGA</span>` : '',
    banned ? `<span class="tag tag-ban">禁卡</span>` : '',
    vp    ? `<span class="tag ${String(card['勝利點數']).startsWith('-') ? 'tag-vp-neg' : 'tag-vp'}">VP:${card['勝利點數']}</span>` : '',
    bonus ? `<span class="tag tag-bonus">紅利分數</span>` : '',
    minus ? `<span class="tag tag-minus">負分標記</span>` : '',
    pass  ? `<span class="tag tag-pass">←傳遞←</span>` : '',
    replacedCount ? `<span class="tag tag-replaces">取代 ${replacedCount} 張</span>` : '',
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

  if (typeof renderImplStatusBadge === 'function') renderImplStatusBadge(card, div);

  div.addEventListener('click', () => {
    if (dupNonCanonical.has(getCardKey(card))) openDupCompare(card);
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
function drawCrop(canvas, card, forceSheet = false) {
  if (!canvas || !card) return;
  if (!forceSheet) {
    const singleCardPath = window.CardImages?.getPath?.(card);
    if (singleCardPath) {
      window.CardImages.draw(canvas, singleCardPath, 1, () => drawCrop(canvas, card, true));
      return;
    }
  }
  const key = IMG_BASE + card.source_image;

  const draw = (img) => {
    // Check if the image is a composite (from the older set named ...部分.jpg or 舊版)
    const isComposite = card.source_image.includes('部分.jpg') || card.source_image.includes('舊版');
    const src = card.source_image;
    // NL/FL 同人頁(2040×2807)：卡格自 x213/y114 起、間距≈565/864
    // G4(UGG 同人頁，2040×2807)與 NL/FL 同人頁共用同一裁切邊界
    const isNLtmpl = /^NL\d/i.test(src) || /^FL/i.test(src) || /^G\d/i.test(src);
    // O 牌組(Om/Oo，1116×1860)：卡片滿版，均分即可
    const isOdeck = /^O[mo]/i.test(src);
    const isTTS = src.startsWith('FR') || src.startsWith('Gm') || src.startsWith('Go') || src.toLowerCase().startsWith('wa') || src.toLowerCase().startsWith('wm') || src.toLowerCase().startsWith('bi') || src.toLowerCase().startsWith('z');

    const cols = card.grid_cols || (isComposite ? 10 : GRID_COLS);
    const rows = card.grid_rows || (isComposite ? 3 : GRID_ROWS);

    // 依模板決定預設裁切邊界（per-card crop_* 仍最優先）
    let base;
    if (isOdeck || isTTS || isComposite) base = { l: 0, t: 0, r: 0, b: 0 };
    else if (isNLtmpl)       base = { l: 182, t: 114, r: 166, b: 101 };
    else                     base = { l: CROP.offsetLeft, t: CROP.offsetTop, r: CROP.offsetRight, b: CROP.offsetBottom };

    const scaleCropX = (value) => value === 0 ? 0 : value * img.naturalWidth / CROP_REF.width;
    const scaleCropY = (value) => value === 0 ? 0 : value * img.naturalHeight / CROP_REF.height;

    let sx, sy, cellW, cellH;
    {
      // Zm(1/2).jpg 過去曾用一組硬編碼像素校正(cols_x/rows_y，對應 2040×2807 參照尺寸)，
      // 但實際圖檔是 720×1200 滿版無邊距的 3×3 均分表，套用舊校正會裁到相鄰卡/留白過多，
      // 故 Zm 與 Zo 一致走下方 base(0,0,0,0) 均分裁切。
      const offsetLeft   = scaleCropX(card.crop_left   !== undefined ? card.crop_left   : base.l);
      const offsetRight  = scaleCropX(card.crop_right  !== undefined ? card.crop_right  : base.r);
      const offsetTop    = scaleCropY(card.crop_top    !== undefined ? card.crop_top    : base.t);
      const offsetBottom = scaleCropY(card.crop_bottom !== undefined ? card.crop_bottom : base.b);

      const usableW = img.naturalWidth  - offsetLeft - offsetRight;
      const usableH = img.naturalHeight - offsetTop  - offsetBottom;
      cellW = usableW / cols;
      cellH = usableH / rows;
      sx = offsetLeft + (card.grid_col || 0) * cellW;
      sy = offsetTop  + (card.grid_row || 0) * cellH;
    }

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
      ctx.fillText(card.source_image || '', 150, 130);
    };
    img.src = key;
  }
}

// ── Duplicate Compare Modal ────────────────────────
function openDupCompare(nonCanonCard) {
  const info = dupCardToPair.get(getCardKey(nonCanonCard));
  if (!info) { openModal(nonCanonCard); return; }
  const canonCard = resolveCardRef(info.canonId);
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
      <div class="dup-ci-thumb"><canvas data-card-key="${getCardKey(card)}"></canvas></div>
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
    const canvas = overlay.querySelector(`canvas[data-card-key="${getCardKey(card)}"]`);
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

  document.getElementById('modalTitle').textContent = card['牌名'] || '—';
  document.getElementById('modalId').textContent = card['卡片ID'] || '';
  const isBanned = BANNED_GROUPS.some(g => g.ids.includes(card['卡片ID']));
  document.getElementById('modalBanBadge').style.display = isBanned ? '' : 'none';
  const bgaBadge = document.getElementById('modalBgaBadge');
  if (bgaBadge) bgaBadge.style.display = isCardBga(card) ? '' : 'none';
  const badgeEl = document.getElementById('modalBadge');
  CardModal.renderTypeBadge(badgeEl, card);
  document.getElementById('modalDesc').textContent = card['說明'] || '—';

  // Fields
  const fieldsEl = document.getElementById('modalFields');
  const fieldDefs = CardModal.fieldDefs(card);

  const replacedCardsText = getReplacedCardsText(card);
  if (replacedCardsText) fieldDefs.push(['取代卡牌', replacedCardsText, 'replace']);

  // 牌力資訊（僅在使用者已啟用牌力排序、資料載入後顯示）
  if (ratingsMap) {
    const rid = card['卡片ID'];
    const rr = ratingsMap[rid];
    if (isCardBannedById(rid)) {
      fieldDefs.push(['牌力', '禁卡']);
    } else if (rr && rr.seenCount >= RATING_MIN_SEEN) {
      fieldDefs.push(['牌力 Tier', tierMap.get(rid) || '—']);
      fieldDefs.push(['ELO 分數', String(Math.round(rr.elo))]);
    }
  }
  CardModal.renderFields(fieldsEl, fieldDefs);

  // 結構化卡效（純顯示；沒有編碼的卡完全不顯示）
  const effRec = effectsById.get(card['卡片ID']);
  const effBadge = document.getElementById('modalEffectsBadge');
  const effWrap = document.getElementById('modalEffectsWrap');
  if (effBadge) effBadge.style.display = effRec ? '' : 'none';
  if (effWrap) {
    effWrap.style.display = effRec ? '' : 'none';
    if (effRec) CardModal.renderEffects(document.getElementById('modalEffectsBody'), effRec);
  }

  // 線上已實作徽章（GM/YOYO 專用；自動取自 online-implemented.json，反映 play.js 真實實作）
  const onlineBadge = document.getElementById('modalOnlineImplBadge');
  if (onlineBadge) {
    // online-implemented.json 的 key 是 play.js 的 cleanCardId（無星號），cards.json 的 ID 帶尾綴 *，比對前先去星號
    const mech = (typeof isImplStatusViewer === 'function' && isImplStatusViewer())
      ? onlineImplMap.get(String(card['卡片ID']).replace(/\*$/, '')) : null;
    onlineBadge.style.display = mech ? '' : 'none';
    if (mech) onlineBadge.title = `線上機制：${mech}`;
  }

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

  // 卡牌功能實作狀態編輯（白名單專用，DOM 層級不渲染非白名單）
  if (typeof renderImplStatusEditor === 'function') renderImplStatusEditor(card);

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

// ── Auth callback ──────────────────────────────────
function onAuthChange() {
  const admin = typeof isAdmin === 'function' && isAdmin();
  const banAdminBtn = document.getElementById('banAdminBtn');
  if (banAdminBtn) banAdminBtn.style.display = admin ? '' : 'none';
  const bgaAdminBtn = document.getElementById('bgaAdminBtn');
  if (bgaAdminBtn) bgaAdminBtn.style.display = admin ? '' : 'none';
  const editBtn = document.getElementById('modalAdminEditBtn');
  if (editBtn) editBtn.style.display = admin ? '' : 'none';

  // 卡牌功能實作狀態：篩選器與徽章跟著登入狀態顯示/隱藏
  if (typeof renderImplStatusFilterControl === 'function') renderImplStatusFilterControl();
  const viewer = typeof isImplStatusViewer === 'function' && isImplStatusViewer();
  const implEditor = document.getElementById('implStatusEditor');
  if (implEditor && !viewer) implEditor.remove();
  if (viewer && typeof ensureImplStatus === 'function') {
    ensureImplStatus().then(() => { if (typeof refreshAllImplStatusBadges === 'function') refreshAllImplStatusBadges(); });
  } else {
    implStatusMap = null; // 登出/切換身份後清掉記憶體中的快取，縱深防禦
    if (typeof refreshAllImplStatusBadges === 'function') refreshAllImplStatusBadges();
    if (typeof applyFilters === 'function') applyFilters();
  }
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

// Sort select（選牌力排序才懶載入評分、顯示徽章）
const sortSelect = document.getElementById('sortSelect');
if (sortSelect) {
  sortSelect.addEventListener('change', async e => {
    activeSort = e.target.value;
    const grid = document.getElementById('cardGrid');
    if (activeSort !== 'default') {
      // 牌力排序跨整個資料庫才有意義，自動切換到「全部」牌組
      if (activeDeck !== 'all') {
        activeDeck = 'all';
        document.getElementById('deckSelect').value = 'all';
      }
      sortSelect.disabled = true;
      try { await ensureRatings(); }
      catch (err) { console.error('載入牌力資料失敗', err); }
      finally { sortSelect.disabled = false; }
      grid.classList.add('show-rating');
    } else {
      grid.classList.remove('show-rating');
    }
    applyFilters();
  });
}

// Search
const searchInput = document.getElementById('searchInput');
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = searchInput.value.trim();
    if (searchQuery && activeDeck === 'latest') {
      activeDeck = 'all';
      document.getElementById('deckSelect').value = 'all';
    }
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
  { label: '過強職業卡',     ids: ['FL049', 'A127', 'I251', 'I260', 'I234', 'I255', '8720-9', '7873-7', '7252-3', '6022-5', '舊版E198', 'K270', 'NL098', 'PI10', 'PI03', 'PI06', 'Z329', 'Ö03', 'Ö01'] },
  { label: '過強次要發展卡', ids: ['B010*', '906-8', 'A010', 'B021', 'A048', 'C031', '6515-6', '5869-10', '5881-9', '4988-8', 'I081', 'Z320', 'K138', 'K125', 'Ö13', 'Ö17'] },
  { label: '過爛職業卡',     ids: ['A107', 'A151', 'C144*', 'C111', 'D158*', 'B146', 'C157', 'B101', 'D140', 'A154', '舊版E158', '舊版E170', '舊版E155', 'I247', '舊版E198', '舊版E171', '5030-2', 'Ö05', 'K304', 'Ö02', '5698-2', 'WM033', 'Ö09', '6575-4', 'WA042', 'Z333', 'K317'] },
  { label: '過爛次要發展卡', ids: ['C058', 'B052', 'B018', '舊版E17', '舊版E29', 'I093', '舊版E51', '8315', '6960-2', 'NL023', 'K109', 'FL016', 'FL028', 'Z324'] },
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
      item.innerHTML = `<div class="banlist-card-thumb"><canvas></canvas></div><div class="banlist-card-name">${card['牌名']}</div>`;
      item.addEventListener('click', () => openModal(card));
      grid.appendChild(item);
      requestAnimationFrame(() => drawCrop(item.querySelector('canvas'), card));
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

document.getElementById('banlistBtn').addEventListener('click', openBanlist);
document.getElementById('banAdminBtn').addEventListener('click', () => openBanAdmin(allCards));
document.getElementById('bgaAdminBtn').addEventListener('click', () => openBgaAdmin(allCards));
document.getElementById('banlistClose').addEventListener('click', closeBanlist);
document.getElementById('banlistOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeBanlist();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeBanlist();
});

// ── Init ───────────────────────────────────────────
loadCards();
