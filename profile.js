/* ══════════════════════════════════════════════════
   農家樂 Profile — profile.js
   評分者個人分析頁（解鎖條件：500 場評分）
   ══════════════════════════════════════════════════ */

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';
const IMG_BASE = './images/';
const GRID_COLS = 3, GRID_ROWS = 3;
const CROP = { offsetTop: 113, offsetBottom: 99, offsetLeft: 182, offsetRight: 164 };
const MIN_SEEN_TIER  = 5;  // minimum raterLog appearances to be assigned a tier
const MIN_SEEN_HATE  = 10; // minimum appearances required to appear in "disliked" list
const TIERS = ['S', 'A', 'B', 'C', 'D', 'E'];
const TIER_BOUNDS = [0.08, 0.25, 0.60, 0.82, 0.95, 1.01];
const UNLOCK_THRESHOLD = 500;

let imageCache = {};
let gAnalytics = null; // global after compute

// ── Tier Helper ────────────────────────────────────
function getTier(rankPct) {
  return TIERS[TIER_BOUNDS.findIndex(b => rankPct < b)];
}

// ── Canvas Crop (from draft.js) ────────────────────
function drawCrop(canvas, card, topFraction = 1) {
  if (!canvas || !card || !card.source_image) return;
  const key = IMG_BASE + card.source_image;
  const draw = img => {
    const isComposite = card.source_image.includes('部分.jpg') || card.source_image.includes('舊版');
    const isFR = card.source_image.startsWith('FR') || card.source_image.startsWith('Gm') ||
      card.source_image.startsWith('Go') || /^wa/i.test(card.source_image) || /^wm/i.test(card.source_image);
    const cols = card.grid_cols || (isComposite ? 10 : GRID_COLS);
    const rows = card.grid_rows || (isComposite ? 3  : GRID_ROWS);
    const oL = card.crop_left   !== undefined ? card.crop_left   : (isComposite || isFR ? 0 : CROP.offsetLeft);
    const oR = card.crop_right  !== undefined ? card.crop_right  : (isComposite || isFR ? 0 : CROP.offsetRight);
    const oT = card.crop_top    !== undefined ? card.crop_top    : (isComposite || isFR ? 0 : CROP.offsetTop);
    const oB = card.crop_bottom !== undefined ? card.crop_bottom : (isComposite || isFR ? 0 : CROP.offsetBottom);
    const cellW = (img.naturalWidth  - oL - oR) / cols;
    const cellH = (img.naturalHeight - oT - oB) / rows;
    const drawH = cellH * topFraction;
    canvas.width  = cellW;
    canvas.height = drawH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, oL + (card.grid_col || 0) * cellW, oT + (card.grid_row || 0) * cellH,
      cellW, drawH, 0, 0, cellW, drawH);
  };
  if (imageCache[key]) {
    draw(imageCache[key]);
  } else {
    const img = new Image();
    img.onload = () => { imageCache[key] = img; draw(img); };
    img.onerror = () => {
      canvas.width = 100; canvas.height = Math.round(75 * topFraction);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1d2437'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    img.src = key;
  }
}

// ── Data Fetching ──────────────────────────────────

async function fetchSessions(raterId) {
  const sessions = [];
  let lastTimestamp = null;

  while (true) {
    const query = {
      structuredQuery: {
        from: [{ collectionId: 'agricola_sessions' }],
        where: { fieldFilter: { field: { fieldPath: 'raterId' }, op: 'EQUAL', value: { stringValue: raterId } } },
        orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'ASCENDING' }],
        limit: 300,
      }
    };
    if (lastTimestamp) {
      query.structuredQuery.startAt = { before: false, values: [{ stringValue: lastTimestamp }] };
    }

    const res  = await fetch(`${FIRESTORE_BASE}:runQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });
    const data = await res.json();
    const docs = (Array.isArray(data) ? data : []).filter(d => d.document);

    for (const d of docs) {
      const f = d.document.fields || {};
      sessions.push({
        timestamp: f.timestamp?.stringValue || '',
        draftMode: f.draftMode?.stringValue || 'separate',
        picks: (f.picks?.arrayValue?.values || []).map(v => v.stringValue),
        raterLog: (f.raterLog?.arrayValue?.values || []).map(v => {
          const vf = v.mapValue?.fields || {};
          return {
            picked: vf.picked?.stringValue || '',
            opponents: (vf.opponents?.arrayValue?.values || []).map(o => o.stringValue),
          };
        }),
      });
    }

    if (docs.length < 300) break;
    lastTimestamp = docs[docs.length - 1].document.fields?.timestamp?.stringValue;
    if (!lastTimestamp) break;
  }

  return sessions;
}

async function fetchAllRatings() {
  const map = {};
  let pageToken = null;
  do {
    let url = `${FIRESTORE_BASE}/agricola_ratings?pageSize=300`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const data = await fetch(url).then(r => r.json());
    (data.documents || []).forEach(doc => {
      const id = doc.name.split('/').pop();
      const f  = doc.fields || {};
      map[id] = {
        elo:       Number(f.elo?.integerValue       ?? f.elo?.doubleValue       ?? 1000),
        seenCount: Number(f.seenCount?.integerValue ?? 0),
        pickCount: Number(f.pickCount?.integerValue ?? 0),
      };
    });
    pageToken = data.nextPageToken ?? null;
  } while (pageToken);
  return map;
}

// ── Tier Map ───────────────────────────────────────

function computeTierMap(ratingsMap, cards) {
  const rated = cards
    .map(c => ({ id: c['卡片ID'], r: ratingsMap[c['卡片ID']] }))
    .filter(x => x.r && x.r.seenCount >= MIN_SEEN_TIER)
    .sort((a, b) => b.r.elo - a.r.elo);
  const n = rated.length;
  const tierMap = {};
  rated.forEach(({ id }, i) => { tierMap[id] = getTier(i / n); });
  return tierMap;
}

// ── Analytics Engine ───────────────────────────────

function computeAnalytics(sessions, cards, ratingsMap, tierMap) {
  const cardMeta = {};
  cards.forEach(c => { cardMeta[c['卡片ID']] = c; });

  const eloOf = id => ratingsMap[id]?.elo ?? 1000;

  // ── pick / seen counts ──
  const pickCounts = {}, seenCounts = {};
  sessions.forEach(s => {
    s.raterLog.forEach(({ picked, opponents }) => {
      pickCounts[picked] = (pickCounts[picked] || 0) + 1;
      seenCounts[picked] = (seenCounts[picked] || 0) + 1;
      opponents.forEach(id => { seenCounts[id] = (seenCounts[id] || 0) + 1; });
    });
  });

  // ── per-session score (current ELO) ──
  const sessionScores = [];
  sessions.forEach((s, idx) => {
    const rounds = s.raterLog.filter(r => r.opponents.length > 0);
    if (rounds.length === 0) return;
    const effs = rounds.map(({ picked, opponents }) => {
      const all = [picked, ...opponents];
      const maxElo = Math.max(...all.map(eloOf));
      return maxElo > 0 ? eloOf(picked) / maxElo : 1;
    });
    sessionScores.push({
      score: Math.round(effs.reduce((a, b) => a + b, 0) / effs.length * 100),
      timestamp: s.timestamp,
      picks: s.picks,
    });
  });
  const avgScore = sessionScores.length > 0
    ? Math.round(sessionScores.reduce((s, x) => s + x.score, 0) / sessionScores.length)
    : null;

  // ── 慧眼指數 ──
  let gemCount = 0, mistakeCount = 0;
  sessions.forEach(s => {
    s.raterLog.forEach(({ picked, opponents }) => {
      if (opponents.length === 0) return;
      const all = [picked, ...opponents];
      const maxElo = Math.max(...all.map(eloOf));
      const pickedElo = eloOf(picked);
      const pickedTier = tierMap[picked];

      // 撿寶: 沒選最高 ELO 但選的牌其實是 A/S
      if (pickedElo < maxElo && (pickedTier === 'S' || pickedTier === 'A')) gemCount++;

      // 踩雷: 手邊有 S tier 但選了 D/E tier
      const hasSInOpp = opponents.some(id => tierMap[id] === 'S');
      if (hasSInOpp && (pickedTier === 'D' || pickedTier === 'E')) mistakeCount++;
    });
  });

  // ── 牌型偏好 ──
  let occPrecise = 0, occTotal = 0, occEloSum = 0;
  let minPrecise = 0, minTotal = 0, minEloSum = 0;
  sessions.forEach(s => {
    s.raterLog.forEach(({ picked, opponents }) => {
      const card = cardMeta[picked];
      if (!card) return;
      const isOcc = card.card_type === 'occupation';
      const isMin = card.card_type === 'minor' || card.card_type === 'both';
      if (!isOcc && !isMin) return;

      const all = [picked, ...opponents];
      const maxElo = Math.max(...all.map(eloOf));
      const elo = eloOf(picked);
      if (isOcc) { occTotal++; occEloSum += elo; if (elo >= maxElo) occPrecise++; }
      else        { minTotal++; minEloSum += elo; if (elo >= maxElo) minPrecise++; }
    });
  });

  // ── common pairs ──
  const pairCounts = {};
  sessions.forEach(s => {
    const p = s.picks || [];
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        const key = [p[i], p[j]].sort().join('|||');
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    }
  });
  const topPairs = Object.entries(pairCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([k, count]) => { const [a, b] = k.split('|||'); return { a, b, count }; });

  // ── pick priority (avg round) ──
  const prSums = {}, prCounts = {};
  sessions.forEach(s => {
    s.raterLog.forEach(({ picked }, idx) => {
      prSums[picked]   = (prSums[picked]   || 0) + (idx + 1);
      prCounts[picked] = (prCounts[picked] || 0) + 1;
    });
  });
  const pickPriority = Object.keys(prSums)
    .filter(id => prCounts[id] >= 10)
    .map(id => ({ id, avgRound: prSums[id] / prCounts[id], count: prCounts[id] }))
    .sort((a, b) => a.avgRound - b.avgRound);

  return {
    totalSessions: sessions.length,
    sessionScores,
    avgScore,
    pickCounts,
    seenCounts,
    gemCount,
    mistakeCount,
    occPrecision: occTotal > 0 ? occPrecise / occTotal : null,
    minPrecision: minTotal > 0 ? minPrecise / minTotal : null,
    occAvgElo: occTotal > 0 ? occEloSum / occTotal : null,
    minAvgElo: minTotal > 0 ? minEloSum / minTotal : null,
    topPairs,
    pickPriority,
    cardMeta,
    ratingsMap,
    tierMap,
  };
}

// ── Card Rank List ─────────────────────────────────

function buildFavList(containerId, cardType, excludeS) {
  const { pickCounts, cardMeta, tierMap } = gAnalytics;
  const isOcc = cardType === 'occupation';

  const items = Object.entries(pickCounts)
    .filter(([id]) => {
      const c = cardMeta[id];
      if (!c) return false;
      if (isOcc && c.card_type !== 'occupation') return false;
      if (!isOcc && c.card_type !== 'minor' && c.card_type !== 'both') return false;
      if (excludeS && tierMap[id] === 'S') return false;
      return true;
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  renderCardList(containerId, items.map(([id, count]) => ({ id, value: count })),
    item => `${item.value} 次`);
}

function buildHateList(containerId, cardType, excludeE) {
  const { pickCounts, seenCounts, cardMeta, tierMap } = gAnalytics;
  const isOcc = cardType === 'occupation';

  const items = Object.keys(seenCounts)
    .filter(id => {
      const c = cardMeta[id];
      if (!c) return false;
      if (isOcc && c.card_type !== 'occupation') return false;
      if (!isOcc && c.card_type !== 'minor' && c.card_type !== 'both') return false;
      if (seenCounts[id] < MIN_SEEN_HATE) return false;
      if (excludeE && tierMap[id] === 'E') return false;
      return true;
    })
    .map(id => {
      const seen = seenCounts[id];
      const picked = pickCounts[id] || 0;
      return { id, value: (seen - picked) / seen, seen };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 20);

  renderCardList(containerId, items, item => `${Math.round(item.value * 100)}% 放棄率`);
}

function renderCardList(containerId, items, labelFn) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  const { cardMeta, tierMap } = gAnalytics;

  items.forEach((item, i) => {
    const card = cardMeta[item.id];
    const name = card?.['牌名'] || item.id;
    const tier = tierMap[item.id] || '?';

    const row = document.createElement('div');
    row.className = 'rank-row';
    row.innerHTML = `
      <span class="rank-no">#${i + 1}</span>
      <div class="rank-thumb"><canvas></canvas></div>
      <div class="rank-info">
        <span class="rank-name">${name}</span>
        <span class="rank-id">${item.id}</span>
      </div>
      <span class="tier-pip tier-${tier.toLowerCase()}">${tier}</span>
      <span class="rank-val">${labelFn(item)}</span>
    `;
    if (card) requestAnimationFrame(() => drawCrop(row.querySelector('canvas'), card, 0.5));
    el.appendChild(row);
  });

  if (items.length === 0) {
    el.innerHTML = '<div class="rank-empty">資料不足</div>';
  }
}

// ── Score Chart ────────────────────────────────────

function renderScoreChart() {
  const { sessionScores } = gAnalytics;
  if (sessionScores.length < 2) return;

  const W    = 700;
  const H    = 200;
  const PAD  = { t: 12, r: 60, b: 28, l: 36 };
  const pW   = W - PAD.l - PAD.r;
  const pH   = H - PAD.t - PAD.b;
  const scores = sessionScores.map(s => s.score);
  const n    = scores.length;

  const xOf = i => PAD.l + (i / Math.max(n - 1, 1)) * pW;
  const yOf = v => PAD.t + pH - (Math.max(0, Math.min(100, v)) / 100) * pH;

  const svg = document.getElementById('scoreChart');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.height = 'auto';
  svg.innerHTML = '';

  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => {
    const e = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  };

  // Grid
  [25, 50, 75, 100].forEach(v => {
    const y = yOf(v);
    svg.appendChild(el('line', { x1: PAD.l, x2: PAD.l + pW, y1: y, y2: y,
      stroke: v === 50 ? '#3a4e66' : '#253044', 'stroke-width': 1, 'stroke-dasharray': '4 3' }));
    const t = el('text', { x: PAD.l - 4, y: y + 4, 'text-anchor': 'end', 'font-size': 10, fill: '#6b7e99' });
    t.textContent = v; svg.appendChild(t);
  });

  // Raw data polyline (faint)
  svg.appendChild(el('polyline', {
    points: scores.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' '),
    fill: 'none', stroke: '#2e4a66', 'stroke-width': 1, opacity: 0.6,
  }));

  // Moving average (window = min(20, n/5))
  const WIN = Math.max(3, Math.min(20, Math.floor(n / 5)));
  const maPoints = scores.map((_, i) => {
    const s = Math.max(0, i - Math.floor(WIN / 2));
    const e = Math.min(n, s + WIN);
    const avg = scores.slice(s, e).reduce((a, b) => a + b, 0) / (e - s);
    return `${xOf(i)},${yOf(avg)}`;
  });
  svg.appendChild(el('polyline', {
    points: maPoints.join(' '), fill: 'none', stroke: '#4a9eda', 'stroke-width': 2.5,
  }));

  // Average dashed line
  const avg = scores.reduce((a, b) => a + b, 0) / n;
  const avgY = yOf(avg);
  svg.appendChild(el('line', { x1: PAD.l, x2: PAD.l + pW, y1: avgY, y2: avgY,
    stroke: '#f0c040', 'stroke-width': 1.5, 'stroke-dasharray': '8 4' }));
  const avgLbl = el('text', { x: PAD.l + pW + 4, y: avgY + 4, 'font-size': 11, fill: '#f0c040' });
  avgLbl.textContent = `avg ${Math.round(avg)}`; svg.appendChild(avgLbl);

  // X axis labels
  [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1].forEach(i => {
    const t = el('text', { x: xOf(i), y: H - 4, 'text-anchor': 'middle', 'font-size': 10, fill: '#6b7e99' });
    t.textContent = `#${i + 1}`; svg.appendChild(t);
  });
}

// ── 慧眼指數 ──────────────────────────────────────

function renderGem() {
  const { gemCount, mistakeCount, totalSessions, sessionScores } = gAnalytics;
  const rounds = sessionScores.reduce((s, x) => s + (x.picks?.length || 0), 0);
  const gemRate    = rounds > 0 ? ((gemCount / rounds) * 100).toFixed(1) : '—';
  const mistakeRate = rounds > 0 ? ((mistakeCount / rounds) * 100).toFixed(1) : '—';

  document.getElementById('gemContent').innerHTML = `
    <div class="gem-row">
      <div class="gem-item good">
        <div class="gem-val">${gemCount}</div>
        <div class="gem-lbl">撿寶次數</div>
        <div class="gem-sub">（${gemRate}% 的輪次）</div>
        <div class="gem-desc">沒選最高 ELO，但選的牌其實是 A/S tier</div>
      </div>
      <div class="gem-item bad">
        <div class="gem-val">${mistakeCount}</div>
        <div class="gem-lbl">踩雷次數</div>
        <div class="gem-sub">（${mistakeRate}% 的輪次）</div>
        <div class="gem-desc">手邊有 S tier 卻選了 D/E tier</div>
      </div>
    </div>
  `;
}

// ── 牌型偏好 ──────────────────────────────────────

function renderTypePref() {
  const { occPrecision, minPrecision, occAvgElo, minAvgElo, ratingsMap } = gAnalytics;
  const fmt = v => v !== null ? `${Math.round(v * 100)}%` : '—';
  const fmtElo = v => v !== null ? Math.round(v) : '—';

  const diff = occPrecision !== null && minPrecision !== null
    ? occPrecision - minPrecision : null;
  const bias = diff === null ? '' : diff > 0.02 ? '你對職業牌更謹慎選擇' : diff < -0.02 ? '你對次要發展牌更謹慎選擇' : '職業 / 次發判斷力相近';

  document.getElementById('typePrefContent').innerHTML = `
    <table class="pref-table">
      <thead><tr><th></th><th>職業牌</th><th>次要發展牌</th></tr></thead>
      <tbody>
        <tr><td>精準率</td><td>${fmt(occPrecision)}</td><td>${fmt(minPrecision)}</td></tr>
        <tr><td>選牌平均 ELO</td><td>${fmtElo(occAvgElo)}</td><td>${fmtElo(minAvgElo)}</td></tr>
      </tbody>
    </table>
    ${bias ? `<div class="pref-bias">${bias}</div>` : ''}
    <div class="pref-note">精準率 = 在同輪選了最高 ELO 牌的比例</div>
  `;
}

// ── Best / Worst Sessions ──────────────────────────

function renderExtremes() {
  const { sessionScores, cardMeta } = gAnalytics;
  if (sessionScores.length === 0) { document.getElementById('extremesContent').innerHTML = '<p class="rank-empty">資料不足</p>'; return; }

  const sorted = [...sessionScores].sort((a, b) => b.score - a.score);
  const best   = sorted.slice(0, 3);
  const worst  = sorted.slice(-3).reverse();

  function buildSection(title, items) {
    const rows = items.map((s, i) => {
      const date = s.timestamp ? new Date(s.timestamp).toLocaleDateString('zh-TW') : '—';
      const thumbs = (s.picks || []).map(id => {
        const c = cardMeta[id];
        return `<div class="ext-thumb" title="${c?.['牌名'] || id}"><canvas data-id="${id}"></canvas></div>`;
      }).join('');
      return `
        <div class="ext-session">
          <div class="ext-meta">
            <span class="ext-rank">#${i + 1}</span>
            <span class="ext-score ${s.score >= 80 ? 'hi' : s.score <= 50 ? 'lo' : ''}">${s.score} 分</span>
            <span class="ext-date">${date}</span>
          </div>
          <div class="ext-picks">${thumbs}</div>
        </div>`;
    }).join('');
    return `<div class="ext-group"><div class="ext-group-title">${title}</div>${rows}</div>`;
  }

  const wrap = document.getElementById('extremesContent');
  wrap.innerHTML = buildSection('🏆 最強局 Top 3', best) + buildSection('💀 最弱局 Bottom 3', worst);

  // Draw thumbnails
  wrap.querySelectorAll('canvas[data-id]').forEach(canvas => {
    const card = cardMeta[canvas.dataset.id];
    if (card) requestAnimationFrame(() => drawCrop(canvas, card, 0.5));
  });
}

// ── Common Pairs ──────────────────────────────────

function renderPairs() {
  const { topPairs, cardMeta, tierMap } = gAnalytics;
  const el = document.getElementById('pairsContent');
  el.innerHTML = '';

  topPairs.forEach(({ a, b, count }) => {
    const cA = cardMeta[a], cB = cardMeta[b];
    const nameA = cA?.['牌名'] || a;
    const nameB = cB?.['牌名'] || b;
    const tierA = tierMap[a] || '?', tierB = tierMap[b] || '?';

    const item = document.createElement('div');
    item.className = 'pair-item';
    item.innerHTML = `
      <div class="pair-card">
        <div class="pair-thumb"><canvas data-slot="a"></canvas></div>
        <span class="tier-pip tier-${tierA.toLowerCase()}">${tierA}</span>
        <span class="pair-name">${nameA}</span>
      </div>
      <span class="pair-plus">+</span>
      <div class="pair-card">
        <div class="pair-thumb"><canvas data-slot="b"></canvas></div>
        <span class="tier-pip tier-${tierB.toLowerCase()}">${tierB}</span>
        <span class="pair-name">${nameB}</span>
      </div>
      <span class="pair-count">${count} 次</span>
    `;
    if (cA) requestAnimationFrame(() => drawCrop(item.querySelector('canvas[data-slot="a"]'), cA, 0.5));
    if (cB) requestAnimationFrame(() => drawCrop(item.querySelector('canvas[data-slot="b"]'), cB, 0.5));
    el.appendChild(item);
  });

  if (topPairs.length === 0) el.innerHTML = '<div class="rank-empty">資料不足</div>';
}

// ── Pick Priority ─────────────────────────────────

function renderPickPriority() {
  const { pickPriority, cardMeta, tierMap } = gAnalytics;

  const occItems = pickPriority.filter(x => cardMeta[x.id]?.card_type === 'occupation').slice(0, 10);
  const minItems = pickPriority.filter(x => {
    const t = cardMeta[x.id]?.card_type;
    return t === 'minor' || t === 'both';
  }).slice(0, 10);

  function buildList(containerId, items) {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    items.forEach(({ id, avgRound, count }) => {
      const card = cardMeta[id];
      const tier = tierMap[id] || '?';
      const row = document.createElement('div');
      row.className = 'priority-row';
      row.innerHTML = `
        <div class="priority-thumb"><canvas></canvas></div>
        <div class="priority-info">
          <span class="priority-name">${card?.['牌名'] || id}</span>
          <span class="priority-sub">看過 ${count} 次</span>
        </div>
        <span class="tier-pip tier-${tier.toLowerCase()}">${tier}</span>
        <span class="priority-round">第 ${avgRound.toFixed(1)} 輪</span>
      `;
      if (card) requestAnimationFrame(() => drawCrop(row.querySelector('canvas'), card, 0.5));
      el.appendChild(row);
    });
    if (items.length === 0) el.innerHTML = '<div class="rank-empty">資料不足</div>';
  }

  buildList('priorityOccEarly', occItems);
  buildList('priorityMinEarly', minItems);
}

// ── Toggle Handlers ────────────────────────────────

function bindToggles() {
  document.getElementById('favOccExcS').addEventListener('change', e =>
    buildFavList('favOccList', 'occupation', e.target.checked));
  document.getElementById('favMinExcS').addEventListener('change', e =>
    buildFavList('favMinList', 'minor', e.target.checked));
  document.getElementById('hateOccExcE').addEventListener('change', e =>
    buildHateList('hateOccList', 'occupation', e.target.checked));
  document.getElementById('hateMinExcE').addEventListener('change', e =>
    buildHateList('hateMinList', 'minor', e.target.checked));
}

// ── Main Render ────────────────────────────────────

function renderProfile(raterId) {
  document.getElementById('profileContent').style.display = '';

  document.getElementById('overviewName').textContent = raterId;
  document.getElementById('statSessions').textContent = gAnalytics.totalSessions;
  document.getElementById('statAvgScore').textContent = gAnalytics.avgScore !== null ? `${gAnalytics.avgScore} 分` : '—';
  document.getElementById('statGems').textContent    = gAnalytics.gemCount;
  document.getElementById('statMistakes').textContent = gAnalytics.mistakeCount;

  buildFavList('favOccList', 'occupation', false);
  buildFavList('favMinList', 'minor',      false);
  buildHateList('hateOccList', 'occupation', false);
  buildHateList('hateMinList', 'minor',      false);

  renderScoreChart();
  renderGem();
  renderTypePref();
  renderExtremes();
  renderPairs();
  renderPickPriority();

  bindToggles();
}

// ── Init ───────────────────────────────────────────

function setLoading(msg) {
  document.getElementById('profileLoadingMsg').textContent = msg;
}

async function init() {
  // Wait for auth.js to mount
  await new Promise(r => {
    if (document.readyState === 'complete') { r(); return; }
    window.addEventListener('load', r);
  });

  const auth = typeof getAuth === 'function' ? getAuth() : null;

  if (!auth || !isRater()) {
    document.getElementById('profileLoading').style.display = 'none';
    document.getElementById('profileAuthRequired').style.display = '';
    document.getElementById('profileLoginBtn').addEventListener('click', openLoginModal);
    return;
  }

  const raterId = getRaterId();

  try {
    setLoading('統計評分場次…');
    // Count sessions first
    const countRes = await fetch(`${FIRESTORE_BASE}:runAggregationQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredAggregationQuery: {
          structuredQuery: {
            from: [{ collectionId: 'agricola_sessions' }],
            where: { fieldFilter: { field: { fieldPath: 'raterId' }, op: 'EQUAL', value: { stringValue: raterId } } }
          },
          aggregations: [{ count: {}, alias: 'count' }]
        }
      })
    });
    const countData = await countRes.json();
    const count = Number(countData[0]?.result?.aggregateFields?.count?.integerValue ?? 0);

    if (count < UNLOCK_THRESHOLD) {
      document.getElementById('profileLoading').style.display = 'none';
      document.getElementById('profileLocked').style.display = '';
      const pct = Math.min(count / UNLOCK_THRESHOLD * 100, 100);
      document.getElementById('profileLockFill').style.width  = `${pct}%`;
      document.getElementById('profileLockCount').textContent = `${count} / ${UNLOCK_THRESHOLD} 場`;
      return;
    }

    setLoading('載入評分紀錄…');
    const [sessions, cards, ratingsMap] = await Promise.all([
      fetchSessions(raterId),
      fetch('./cards.json').then(r => r.json()),
      fetchAllRatings(),
    ]);

    setLoading('計算分析數據…');
    const tierMap = computeTierMap(ratingsMap, cards);
    gAnalytics = computeAnalytics(sessions, cards, ratingsMap, tierMap);

    document.getElementById('profileLoading').style.display = 'none';
    renderProfile(raterId);

  } catch (err) {
    document.getElementById('profileLoadingMsg').textContent = `載入失敗：${err.message}`;
  }
}

document.addEventListener('DOMContentLoaded', init);

// Re-init after login
function onAuthChange() {
  const auth = typeof getAuth === 'function' ? getAuth() : null;
  if (auth && isRater() && document.getElementById('profileAuthRequired').style.display !== 'none') {
    document.getElementById('profileAuthRequired').style.display = 'none';
    document.getElementById('profileLoading').style.display = '';
    init();
  }
}
