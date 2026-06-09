/* ══════════════════════════════════════════════════
   農家樂 Ranking Mode — rank.js
   ══════════════════════════════════════════════════ */

const RANK_IMG_BASE      = './images/';
const RANK_FS_BASE       = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';
const RANK_CARDS_PER_ROUND = 7;
const RANK_TARGET        = 100;
const RANK_K_PAIR        = 8;
const RANK_STORAGE_KEY   = 'agricola_rank_count';

let rankAllCards  = [];
let rankImageCache = {};
let rankBannedIds = new Set();
let rankDupExclusions = new Set();

let rankState = {
  roundCount: 0,
  occCards: [],      // 9 occupation cards shown this round
  minCards: [],      // 9 minor cards shown this round
  occRankings: [],   // card IDs in rank order for occ
  minRankings: [],   // card IDs in rank order for minor
};

// ── Init ──────────────────────────────────────────
async function rankInit() {
  document.getElementById('startRankBtn').addEventListener('click', startRankRound);
  document.getElementById('confirmRankBtn').addEventListener('click', confirmRanking);
  document.getElementById('rankModalClose').addEventListener('click', closeRankModal);
  document.getElementById('rankModalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('rankModalOverlay')) closeRankModal();
  });
  document.getElementById('rankResultNextBtn').addEventListener('click', closeRankResultAndContinue);

  // 先載禁卡表與重複卡清單，再過濾卡庫，避免 race（過濾時清單尚未就緒）
  await Promise.all([loadRankBanlist(), loadRankDupExclusions()]);
  await loadRankCards();

  const raterId = typeof getRaterId === 'function' ? getRaterId() : null;
  if (raterId) {
    const saved = localStorage.getItem(RANK_STORAGE_KEY + '_' + raterId);
    rankState.roundCount = saved ? parseInt(saved, 10) : 0;
    updateRankProgress();
  }
}

// Called by auth.js when login state changes
function onAuthChange() {
  const raterUser = typeof isRater === 'function' && isRater();
  document.getElementById('rankLoginHint').style.display = raterUser ? 'none' : '';
  document.getElementById('startRankBtn').disabled = !raterUser;

  if (raterUser) {
    const raterId = getRaterId();
    const saved = localStorage.getItem(RANK_STORAGE_KEY + '_' + raterId);
    rankState.roundCount = saved ? parseInt(saved, 10) : 0;
    updateRankProgress();
  }
}

// ── Load banned cards ─────────────────────────────
async function loadRankBanlist() {
  const hardcoded = [
    'FL049','A127','I251','I260','I234','I255','8720-9','7873-7','7252-3','6022-5','舊版E198','K270','NL098','PI10','PI03','PI06','Z329','Ö03','Ö01','2913-2',
    'B010*','906-8','A010','B021','A048','C031','6515-6','5869-10','5881-9','4988-8','I081','Z320','K138','K125','Ö13','Ö17','6044-7','Ö20','9244-5','12019-2',
    'A107','B140','A151','C144*','C111','D158*','B146','C157','B101','D140','A154','舊版E158','舊版E170','舊版E155','I247','舊版E171','5030-2','Ö05','K304','Ö02','5698-2','WM033','Ö09','6575-4','WA042','Z333','K317','FL053','A100','A132','B147','I224',
    'C058','B052','B018','舊版E17','舊版E29','I093','舊版E51','8315','6960-2','NL023','K109','FL016','FL028','Z324','FL021','NL025',
    'C093','C130','C003*','B022','Ö04','PI17',
  ];
  rankBannedIds = new Set(hardcoded);

  try {
    const res = await fetch(`${RANK_FS_BASE}/settings/banlist`);
    if (!res.ok) return;
    const doc = await res.json();
    (doc.fields?.groups?.arrayValue?.values || []).forEach(g => {
      (g.mapValue.fields.ids?.arrayValue?.values || []).forEach(v => rankBannedIds.add(v.stringValue));
    });
  } catch {}
}

async function loadRankDupExclusions() {
  try {
    rankDupExclusions = (await DuplicateCards.loadDuplicateInfo()).excludedRefs;
  } catch { rankDupExclusions = new Set(); }
}

// 與 draft.js / duplicate-utils 一致的複合 key（重複卡可能以此 key 被排除）
function rankGetCardKey(card) {
  return [card['卡片ID'] || '', card.source_image || '', card.position ?? ''].join('|');
}

// ── Load cards ────────────────────────────────────
async function loadRankCards() {
  try {
    const res = await fetch('./cards.json');
    const data = await res.json();
    rankAllCards = data.filter(c => {
      const id = c['卡片ID'];
      if (!id) return false;
      if (rankBannedIds.has(id)) return false;
      // 重複卡：純 ID 與複合 key 都要比對，跟輪抽一致
      if (rankDupExclusions.has(id)) return false;
      if (rankDupExclusions.has(rankGetCardKey(c))) return false;
      return c.card_type === 'occupation' || c.card_type === 'minor' || c.card_type === 'both';
    });
  } catch {}
}

// ── Progress UI ───────────────────────────────────
function updateRankProgress() {
  const n = rankState.roundCount;
  const pct = Math.min(100, Math.round(n / RANK_TARGET * 100));
  document.getElementById('rankProgressCount').textContent = `${n} / ${RANK_TARGET} 輪`;
  document.getElementById('rankProgressFill').style.width = `${pct}%`;
  document.getElementById('rankProgressHint').textContent =
    n >= RANK_TARGET ? '已達成目標！感謝貢獻，歡迎繼續' : `還需 ${RANK_TARGET - n} 輪達成目標`;
}

// ── Shuffle helper ────────────────────────────────
function rankShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Start round ───────────────────────────────────
async function startRankRound() {
  // 'both'（烤爐/廚房等）實為次要發展卡，只歸入次要牌庫，避免跑到職業排，也避免同一張同時出現在兩排
  const occPool = rankAllCards.filter(c => c.card_type === 'occupation');
  const minPool = rankAllCards.filter(c => c.card_type === 'minor' || c.card_type === 'both');

  if (occPool.length < RANK_CARDS_PER_ROUND || minPool.length < RANK_CARDS_PER_ROUND) {
    alert('牌庫不足，無法開始');
    return;
  }

  rankState.occCards    = rankShuffle(occPool).slice(0, RANK_CARDS_PER_ROUND);
  rankState.minCards    = rankShuffle(minPool).slice(0, RANK_CARDS_PER_ROUND);
  rankState.occRankings = [];
  rankState.minRankings = [];

  renderRankingScreen();
  showRankScreen('rankingScreen');
  window.scrollTo({ top: 0, behavior: 'smooth' }); // 新一輪拉回最上方，方便從職業牌重新點選
}

// ── Render ────────────────────────────────────────
function renderRankingScreen() {
  document.getElementById('rankRoundLabel').textContent = `第 ${rankState.roundCount + 1} 輪`;
  document.getElementById('rankProgressInline').textContent = `${rankState.roundCount} / ${RANK_TARGET}`;
  document.getElementById('rankOccStatus').textContent = `0 / ${RANK_CARDS_PER_ROUND}`;
  document.getElementById('rankMinStatus').textContent = `0 / ${RANK_CARDS_PER_ROUND}`;
  document.getElementById('confirmRankBtn').disabled = true;
  document.getElementById('confirmRankBtn').textContent = '確認本輪';

  const occRow = document.getElementById('rankOccRow');
  const minRow = document.getElementById('rankMinRow');
  occRow.innerHTML = '';
  minRow.innerHTML = '';
  // 清掉上一輪排滿時加上的 all-ranked，否則新一輪整排牌會殘留變暗
  occRow.classList.remove('all-ranked');
  minRow.classList.remove('all-ranked');

  rankState.occCards.forEach(card => occRow.appendChild(createRankCardEl(card, 'occ')));
  rankState.minCards.forEach(card => minRow.appendChild(createRankCardEl(card, 'min')));
}

function createRankCardEl(card, type) {
  const div = document.createElement('div');
  div.className = 'draft-card rank-card';
  div.dataset.cardId = card['卡片ID'];
  div.dataset.rankType = type;

  div.innerHTML = `
    <div class="rank-badge" style="display:none"></div>
    <div class="draft-card-thumb">
      <canvas class="card-canvas"></canvas>
    </div>
    <div class="draft-card-body">
      <div class="draft-card-name">${card['牌名'] || '—'}</div>
      <div class="draft-card-id">${card['卡片ID'] || ''}</div>
    </div>
    <button class="draft-card-info-btn" title="查看詳情">ℹ</button>
  `;

  rankDrawCrop(div.querySelector('.card-canvas'), card);

  div.addEventListener('click', e => {
    if (e.target.closest('.draft-card-info-btn')) return;
    handleRankClick(card['卡片ID'], type);
  });
  div.querySelector('.draft-card-info-btn').addEventListener('click', e => {
    e.stopPropagation();
    openRankModal(card);
  });

  return div;
}

// ── Click to rank ─────────────────────────────────
function handleRankClick(cardId, type) {
  const rankings = type === 'occ' ? rankState.occRankings : rankState.minRankings;
  const existingIdx = rankings.indexOf(cardId);

  if (existingIdx !== -1) {
    rankings.splice(existingIdx);
  } else if (rankings.length < RANK_CARDS_PER_ROUND) {
    rankings.push(cardId);
  }

  updateRankBadges();
  updateRankStatusBar();
}

function updateRankBadges() {
  document.querySelectorAll('.rank-card').forEach(el => {
    const id   = el.dataset.cardId;
    const type = el.dataset.rankType;
    const rankings = type === 'occ' ? rankState.occRankings : rankState.minRankings;
    const rank = rankings.indexOf(id);
    const badge = el.querySelector('.rank-badge');

    if (rank !== -1) {
      badge.style.display = 'flex';
      badge.textContent = rank + 1;
      badge.dataset.rank = rank + 1;
      el.classList.add('ranked');
    } else {
      badge.style.display = 'none';
      delete badge.dataset.rank;
      el.classList.remove('ranked');
    }
  });

  // Dim unranked cards in a completed row
  ['occ', 'min'].forEach(type => {
    const row = document.getElementById(type === 'occ' ? 'rankOccRow' : 'rankMinRow');
    const rankings = type === 'occ' ? rankState.occRankings : rankState.minRankings;
    row.classList.toggle('all-ranked', rankings.length === RANK_CARDS_PER_ROUND);
  });
}

function updateRankStatusBar() {
  const o = rankState.occRankings.length;
  const m = rankState.minRankings.length;
  document.getElementById('rankOccStatus').textContent = `${o} / ${RANK_CARDS_PER_ROUND}`;
  document.getElementById('rankMinStatus').textContent = `${m} / ${RANK_CARDS_PER_ROUND}`;

  const allDone = o === RANK_CARDS_PER_ROUND && m === RANK_CARDS_PER_ROUND;
  document.getElementById('confirmRankBtn').disabled = !allDone;
}

// ── Confirm & upload ──────────────────────────────
async function confirmRanking() {
  const btn = document.getElementById('confirmRankBtn');
  btn.disabled = true;
  btn.textContent = '上傳中…';

  try {
    const result = await uploadRankingElo();

    rankState.roundCount++;
    rankState.cardType = rankState.cardType === 'occupation' ? 'minor' : 'occupation';

    const raterId = typeof getRaterId === 'function' ? getRaterId() : null;
    if (raterId) {
      localStorage.setItem(RANK_STORAGE_KEY + '_' + raterId, rankState.roundCount);
    }

    updateRankProgress();
    btn.textContent = '✓ 已上傳';

    showRankResult(result);
  } catch (err) {
    console.error('Ranking upload failed:', err);
    btn.disabled = false;
    btn.textContent = '上傳失敗，重試';
  }
}

// ── ELO upload ────────────────────────────────────
async function uploadRankingElo() {
  const occRanked = rankState.occRankings;
  const minRanked = rankState.minRankings;
  const allIds    = [...occRanked, ...minRanked];
  const raterId   = typeof getRaterId === 'function' ? getRaterId() : 'unknown';

  // Fetch current ratings for all 18 cards
  const batchRes = await fetch(`${RANK_FS_BASE}:batchGet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documents: allIds.map(id =>
        `projects/project-hub-410cd/databases/(default)/documents/agricola_ratings/${id}`)
    })
  });
  const batchData = await batchRes.json();

  const ratings = {};
  allIds.forEach(id => { ratings[id] = { elo: 1200, seenCount: 0, pickCount: 0 }; });
  batchData.forEach(item => {
    if (item.found) {
      const id = item.found.name.split('/').pop();
      const f  = item.found.fields || {};
      ratings[id] = {
        elo:       Number(f.elo?.integerValue       ?? f.elo?.doubleValue       ?? 1200),
        seenCount: Number(f.seenCount?.integerValue ?? 0),
        pickCount: Number(f.pickCount?.integerValue ?? 0),
      };
    }
  });

  // 記錄變動前的 ELO（四捨五入後，與寫入 Firestore 的整數一致）
  const eloBefore = {};
  allIds.forEach(id => { eloBefore[id] = Math.round(ratings[id].elo); });

  // Apply rankings independently for each type
  function applyRanking(ranked) {
    ranked.forEach((id, i) => {
      ratings[id].seenCount++;
      if (i === 0) ratings[id].pickCount++;
    });
    // C(9,2) = 36 pairwise comparisons
    for (let i = 0; i < ranked.length; i++) {
      for (let j = i + 1; j < ranked.length; j++) {
        const wId = ranked[i];
        const lId = ranked[j];
        const E_w = 1 / (1 + Math.pow(10, (ratings[lId].elo - ratings[wId].elo) / 400));
        ratings[wId].elo += RANK_K_PAIR * (1 - E_w);
        ratings[lId].elo += RANK_K_PAIR * (0 - E_w);
      }
    }
  }

  applyRanking(occRanked);
  applyRanking(minRanked);

  // Build writes
  const writes = Object.entries(ratings).map(([cardId, { elo, seenCount, pickCount }]) => ({
    update: {
      name: `projects/project-hub-410cd/databases/(default)/documents/agricola_ratings/${cardId}`,
      fields: {
        elo:       { integerValue: `${Math.min(2000, Math.max(500, Math.round(elo)))}` },
        seenCount: { integerValue: `${seenCount}` },
        pickCount: { integerValue: `${pickCount}` },
        lastRater: { stringValue: raterId },
      }
    }
  }));

  // Session record
  writes.push({
    update: {
      name: `projects/project-hub-410cd/databases/(default)/documents/agricola_rank_sessions/${raterId}_${Date.now()}`,
      fields: {
        raterId:      { stringValue: raterId },
        timestamp:    { stringValue: new Date().toISOString() },
        occRankings:  { arrayValue: { values: occRanked.map(id => ({ stringValue: id })) } },
        minRankings:  { arrayValue: { values: minRanked.map(id => ({ stringValue: id })) } },
      }
    }
  });

  const res = await fetch(`${RANK_FS_BASE}:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes })
  });
  if (!res.ok) throw new Error(`Firestore commit failed: ${res.status}`);

  // 回傳本輪每張牌的 ELO 變動，供回饋面板顯示
  const cardMap = {};
  [...rankState.occCards, ...rankState.minCards].forEach(c => { cardMap[c['卡片ID']] = c; });
  const buildResults = ranked => ranked.map((id, i) => {
    const after = Math.min(2000, Math.max(500, Math.round(ratings[id].elo)));
    return {
      cardId: id,
      name:   cardMap[id]?.['牌名'] || id,
      rank:   i + 1,
      before: eloBefore[id],
      after,
      delta:  after - eloBefore[id],
    };
  });
  return { occResults: buildResults(occRanked), minResults: buildResults(minRanked) };
}

// ── Card image crop (mirrors draft.js drawCrop) ───
function rankDrawCrop(canvas, card) {
  if (!canvas || !card || !card.source_image) return;
  const key = RANK_IMG_BASE + card.source_image;

  const GRID_COLS = 3, GRID_ROWS = 3;
  const CROP_BASE = { l: 182, t: 113, r: 164, b: 99 };

  const draw = (img) => {
    const src = card.source_image;
    const isComposite = src.includes('部分.jpg') || src.includes('舊版');
    const isNLtmpl = /^NL\d/i.test(src) || /^FL/i.test(src) || /^G\d/i.test(src);
    const isOdeck  = /^O[mo]/i.test(src);
    const isTTS    = src.startsWith('FR')  || src.startsWith('Gm') || src.startsWith('Go') ||
                     /^wa/i.test(src)      || /^wm/i.test(src)     || /^bi/i.test(src)     || /^z/i.test(src);

    const cols = card.grid_cols || (isComposite ? 10 : GRID_COLS);
    const rows = card.grid_rows || (isComposite ? 3  : GRID_ROWS);

    let base;
    if (isOdeck || isTTS || isComposite) base = { l: 0, t: 0, r: 0, b: 0 };
    else if (isNLtmpl)                   base = { l: 182, t: 114, r: 166, b: 101 };
    else                                 base = CROP_BASE;

    let sx, sy, cellW, cellH;
    if (src.startsWith('Zm')) {
      const cols_x = [16, 388, 760];
      const rows_y = [30, 651, 1274];
      cellW = 342; cellH = 558;
      sx = cols_x[card.grid_col || 0];
      sy = rows_y[card.grid_row || 0];
    } else {
      const oL = card.crop_left   !== undefined ? card.crop_left   : base.l;
      const oR = card.crop_right  !== undefined ? card.crop_right  : base.r;
      const oT = card.crop_top    !== undefined ? card.crop_top    : base.t;
      const oB = card.crop_bottom !== undefined ? card.crop_bottom : base.b;
      cellW = (img.naturalWidth  - oL - oR) / cols;
      cellH = (img.naturalHeight - oT - oB) / rows;
      sx = oL + (card.grid_col || 0) * cellW;
      sy = oT + (card.grid_row || 0) * cellH;
    }

    canvas.width  = cellW;
    canvas.height = cellH;
    canvas.getContext('2d').drawImage(img, sx, sy, cellW, cellH, 0, 0, cellW, cellH);
  };

  if (rankImageCache[key]) {
    draw(rankImageCache[key]);
  } else {
    const img = new Image();
    img.onload = () => { rankImageCache[key] = img; draw(img); };
    img.onerror = () => {
      canvas.width = 180; canvas.height = 130;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1d2437';
      ctx.fillRect(0, 0, 180, 130);
      ctx.fillStyle = '#555';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('圖片載入失敗', 90, 70);
    };
    img.src = key;
  }
}

// ── Modal ─────────────────────────────────────────
function openRankModal(card) {
  document.getElementById('rankModalTitle').textContent = card['牌名'] || '—';
  document.getElementById('rankModalId').textContent = card['卡片ID'] || '';
  document.getElementById('rankModalDesc').textContent = card['說明'] || card['效果'] || '';

  const fieldsEl = document.getElementById('rankModalFields');
  fieldsEl.innerHTML = '';
  const showFields = ['費用', '勝利點數', '人數限制'];
  showFields.forEach(key => {
    if (card[key]) {
      const row = document.createElement('div');
      row.className = 'modal-field-row';
      row.innerHTML = `<span class="modal-field-label">${key}</span><span class="modal-field-value">${card[key]}</span>`;
      fieldsEl.appendChild(row);
    }
  });

  const canvas = document.getElementById('rankModalCanvas');
  rankDrawCrop(canvas, card);

  document.getElementById('rankModalOverlay').classList.add('open');
}

function closeRankModal() {
  document.getElementById('rankModalOverlay').classList.remove('open');
}

// ── 本輪 ELO 變動回饋 ──────────────────────────────
function showRankResult({ occResults, minResults }) {
  const fmtDelta = d => {
    if (d > 0) return `<span class="rank-delta up">▲ +${d}</span>`;
    if (d < 0) return `<span class="rank-delta down">▼ ${d}</span>`;
    return `<span class="rank-delta flat">±0</span>`;
  };
  const rowsHtml = list => list.map(r => `
    <div class="rank-result-row">
      <span class="rank-result-rank" data-rank="${r.rank}">${r.rank}</span>
      <span class="rank-result-name" title="${r.name}">${r.name}</span>
      <span class="rank-result-elo">${r.before} → <strong>${r.after}</strong></span>
      ${fmtDelta(r.delta)}
    </div>`).join('');

  document.getElementById('rankResultOcc').innerHTML = rowsHtml(occResults);
  document.getElementById('rankResultMin').innerHTML = rowsHtml(minResults);
  document.getElementById('rankResultOverlay').classList.add('open');
}

function closeRankResultAndContinue() {
  document.getElementById('rankResultOverlay').classList.remove('open');
  startRankRound();
}

// ── Screen switch ─────────────────────────────────
function showRankScreen(id) {
  document.querySelectorAll('.rank-screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

// ── Boot ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', rankInit);
