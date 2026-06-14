/* ══════════════════════════════════════════════════
   農家樂 Profile — profile.js
   評分者個人分析頁（解鎖條件：500 場評分）
   ══════════════════════════════════════════════════ */

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';
const IMG_BASE = './images/';
const GRID_COLS = 3, GRID_ROWS = 3;
const CROP = { offsetTop: 113, offsetBottom: 99, offsetLeft: 182, offsetRight: 164 };
const CROP_REF = { width: 2040, height: 2807 };
const MIN_SEEN_TIER  = 5;  // minimum raterLog appearances to be assigned a tier
const MIN_SEEN_HATE  = 10; // minimum appearances required to appear in "disliked" list
const TIERS = ['S', 'A', 'B', 'C', 'D', 'E'];
const TIER_BOUNDS = [0.08, 0.25, 0.60, 0.82, 0.95, 1.01];
const UNLOCK_THRESHOLD = 500;       // 完整解鎖所需場次
const MIN_UNLOCK_THRESHOLD = 100;   // 進入個人分析頁所需最低場次

// 各分析卡片的解鎖門檻（場次數）── 樣本需求越大的越晚解鎖
const SECTION_TIERS = {
  overview:        100,
  favHate:         100,
  scoreChart:      100,
  gem:             100,
  typePref:        200,
  scoreEnginePref: 200,
  stability:       200,
  extremes:        300,
  pickPriority:    300,
  blindSpots:      300,
  pairs:           400,
  toughCalls:      400,
};
const UNLOCK_TIER_LIST = [...new Set(Object.values(SECTION_TIERS))].sort((a, b) => a - b);

let imageCache = {};
let gAnalytics = null; // global after compute

// ── Tier Helper ────────────────────────────────────
function getTier(rankPct) {
  return TIERS[TIER_BOUNDS.findIndex(b => rankPct < b)];
}

// ── Canvas Crop (from draft.js) ────────────────────
function drawCrop(canvas, card, topFraction = 1, forceSheet = false) {
  if (!canvas || !card || !card.source_image) return;
  if (!forceSheet) {
    const singleCardPath = window.CardImages?.getPath?.(card);
    if (singleCardPath) {
      window.CardImages.draw(canvas, singleCardPath, topFraction, () => drawCrop(canvas, card, topFraction, true));
      return;
    }
  }
  const key = IMG_BASE + card.source_image;
  const draw = img => {
    const isComposite = card.source_image.includes('部分.jpg') || card.source_image.includes('舊版');
    const isFR = card.source_image.startsWith('FR') || card.source_image.startsWith('Gm') ||
      card.source_image.startsWith('Go') || /^wa/i.test(card.source_image) || /^wm/i.test(card.source_image) ||
      card.source_image.toLowerCase().startsWith('z');
    const cols = card.grid_cols || (isComposite ? 10 : GRID_COLS);
    const rows = card.grid_rows || (isComposite ? 3  : GRID_ROWS);
    const scaleCropX = (value) => value === 0 ? 0 : value * img.naturalWidth / CROP_REF.width;
    const scaleCropY = (value) => value === 0 ? 0 : value * img.naturalHeight / CROP_REF.height;
    
    let sx, sy, cellW, cellH;
    if (card.source_image.startsWith('Zm')) {
      const cols_x = [16, 388, 760];
      const rows_y = [30, 651, 1274];
      cellW = scaleCropX(342);
      cellH = scaleCropY(558);
      sx = scaleCropX(cols_x[card.grid_col || 0]);
      sy = scaleCropY(rows_y[card.grid_row || 0]);
    } else {
      const oL = scaleCropX(card.crop_left   !== undefined ? card.crop_left   : (isComposite || isFR ? 0 : CROP.offsetLeft));
      const oR = scaleCropX(card.crop_right  !== undefined ? card.crop_right  : (isComposite || isFR ? 0 : CROP.offsetRight));
      const oT = scaleCropY(card.crop_top    !== undefined ? card.crop_top    : (isComposite || isFR ? 0 : CROP.offsetTop));
      const oB = scaleCropY(card.crop_bottom !== undefined ? card.crop_bottom : (isComposite || isFR ? 0 : CROP.offsetBottom));
      cellW = (img.naturalWidth  - oL - oR) / cols;
      cellH = (img.naturalHeight - oT - oB) / rows;
      sx = oL + (card.grid_col || 0) * cellW;
      sy = oT + (card.grid_row || 0) * cellH;
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
        elo:       Number(f.elo?.integerValue       ?? f.elo?.doubleValue       ?? 1200),
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
  // 樣本數不足的卡牌，原始 ELO 容易被結構性機制衝出異常值，算分時往基準值收斂以避免污染最佳/最差判斷
  // 天花板保留作保險絲；S 卡均衡點預期 1600~1700，以 1700 為上限
  const SCORE_ELO_CEILING = 1700;
  const eloForScore = id => {
    const r = ratingsMap[id];
    if (!r) return 1200;
    const conf = Math.min(r.seenCount / 30, 1);
    return Math.min(conf * r.elo + (1 - conf) * 1200, SCORE_ELO_CEILING);
  };
  const SCORE_REFERENCE_GAP = 150; // 視為「明顯選差」的 ELO 差距基準（取自全卡庫中段 50% 的典型差距）
  const NEAR_TIE_TOLERANCE = 20; // 包內最佳/次佳常常只差 20~30 分（接近評分系統雜訊水準），落在此範圍內視為勢均力敵，不扣分
  const efficiencyOf = (pickedElo, maxElo) => {
    const gap = maxElo - pickedElo;
    return gap <= NEAR_TIE_TOLERANCE
      ? 1
      : Math.min(1, Math.max(0, 1 - (gap - NEAR_TIE_TOLERANCE) / SCORE_REFERENCE_GAP));
  };

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
      const maxElo = Math.max(...all.map(eloForScore));
      return efficiencyOf(eloForScore(picked), maxElo);
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

  // ── 分類效率分數（與總覽「平均得分」同一套算法，依職業/次發拆開）──
  let occEffSum = 0, occTotal = 0, occEloSum = 0;
  let minEffSum = 0, minTotal = 0, minEloSum = 0;
  sessions.forEach(s => {
    s.raterLog.forEach(({ picked, opponents }) => {
      const card = cardMeta[picked];
      if (!card) return;
      const isOcc = card.card_type === 'occupation';
      const isMin = card.card_type === 'minor' || card.card_type === 'both';
      if (!isOcc && !isMin) return;

      const all = [picked, ...opponents];
      const elo = eloOf(picked);
      const efficiency = efficiencyOf(eloForScore(picked), Math.max(...all.map(eloForScore)));
      if (isOcc) { occTotal++; occEloSum += elo; occEffSum += efficiency; }
      else        { minTotal++; minEloSum += elo; minEffSum += efficiency; }
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

  // ── 計分型 vs 引擎型偏好（職業卡 / 次要發展卡分開計算）──
  // 職業卡無「勝利點數」欄位，計分與否看「紅利分數」；次要發展卡則勝利點數或紅利分數有一項即算計分型
  const isScoringCard = id => {
    const c = cardMeta[id];
    if (!c) return null;
    const bonus = (c['紅利分數'] || '').trim();
    const hasBonus = bonus === '有' || bonus.startsWith('有');
    if (c.card_type === 'occupation') return hasBonus;
    const vp = (c['勝利點數'] || '').trim();
    const hasVP = vp !== '' && vp !== '無';
    return hasVP || hasBonus;
  };
  const makeTypeStat = () => ({
    scoreSeen: 0, scorePicked: 0, scoreEloSum: 0,
    engineSeen: 0, enginePicked: 0, engineEloSum: 0,
  });
  const occStat = makeTypeStat(), minStat = makeTypeStat();
  sessions.forEach(s => {
    s.raterLog.forEach(({ picked, opponents }) => {
      [picked, ...opponents].forEach(id => {
        const c = cardMeta[id];
        if (!c) return;
        const isOcc = c.card_type === 'occupation';
        const isMin = c.card_type === 'minor' || c.card_type === 'both';
        if (!isOcc && !isMin) return;
        const stat = isOcc ? occStat : minStat;
        const isPicked = id === picked;
        if (isScoringCard(id)) {
          stat.scoreSeen++;
          if (isPicked) { stat.scorePicked++; stat.scoreEloSum += eloOf(id); }
        } else {
          stat.engineSeen++;
          if (isPicked) { stat.enginePicked++; stat.engineEloSum += eloOf(id); }
        }
      });
    });
  });
  const buildPref = stat => {
    const scoreRate  = stat.scoreSeen  > 0 ? stat.scorePicked  / stat.scoreSeen  : null;
    const engineRate = stat.engineSeen > 0 ? stat.enginePicked / stat.engineSeen : null;
    const sum = (scoreRate ?? 0) + (engineRate ?? 0);
    return {
      scorePicks: stat.scorePicked, enginePicks: stat.enginePicked,
      scoreSeen: stat.scoreSeen,    engineSeen: stat.engineSeen,
      scoreRate, engineRate,
      pref: (scoreRate !== null && engineRate !== null && sum > 0) ? scoreRate / sum : null,
      scoreAvgElo:  stat.scorePicked  > 0 ? stat.scoreEloSum  / stat.scorePicked  : null,
      engineAvgElo: stat.enginePicked > 0 ? stat.engineEloSum / stat.enginePicked : null,
    };
  };
  const scoreEnginePref = {
    occ: buildPref(occStat),
    min: buildPref(minStat),
  };

  // ── 盲區清單：社群評為 S/A 但你常放棄的卡 ──
  const blindSpots = Object.keys(seenCounts)
    .filter(id => {
      const c = cardMeta[id];
      if (!c || seenCounts[id] < MIN_SEEN_HATE) return false;
      return tierMap[id] === 'S' || tierMap[id] === 'A';
    })
    .map(id => {
      const seen = seenCounts[id];
      const picked = pickCounts[id] || 0;
      return { id, value: (seen - picked) / seen, seen };
    })
    .filter(x => x.value >= 0.5)
    .sort((a, b) => b.value - a.value)
    .slice(0, 20);

  // ── 分數穩定度（標準差）──
  let scoreStdDev = null;
  if (sessionScores.length > 1) {
    const mean = sessionScores.reduce((s, x) => s + x.score, 0) / sessionScores.length;
    const variance = sessionScores.reduce((s, x) => s + (x.score - mean) ** 2, 0) / sessionScores.length;
    scoreStdDev = Math.sqrt(variance);
  }

  // ── 最難抉擇時刻：picked 與最接近的對手 ELO 差距最小的回合 ──
  const toughCalls = [];
  sessions.forEach(s => {
    s.raterLog.forEach(({ picked, opponents }) => {
      if (opponents.length === 0 || !cardMeta[picked]) return;
      const pickedElo = eloOf(picked);
      let closestId = null, closestGap = Infinity;
      opponents.forEach(oppId => {
        if (!cardMeta[oppId]) return;
        const gap = Math.abs(eloOf(oppId) - pickedElo);
        if (gap < closestGap) { closestGap = gap; closestId = oppId; }
      });
      if (closestId === null) return;
      toughCalls.push({
        picked, pickedElo,
        rivalId: closestId, rivalElo: eloOf(closestId),
        gap: closestGap, timestamp: s.timestamp,
      });
    });
  });
  toughCalls.sort((a, b) => a.gap - b.gap);

  return {
    totalSessions: sessions.length,
    sessionScores,
    avgScore,
    pickCounts,
    seenCounts,
    gemCount,
    mistakeCount,
    occEfficiency: occTotal > 0 ? Math.round(occEffSum / occTotal * 100) : null,
    minEfficiency: minTotal > 0 ? Math.round(minEffSum / minTotal * 100) : null,
    occAvgElo: occTotal > 0 ? occEloSum / occTotal : null,
    minAvgElo: minTotal > 0 ? minEloSum / minTotal : null,
    topPairs,
    pickPriority,
    scoreEnginePref,
    blindSpots,
    scoreStdDev,
    toughCalls: toughCalls.slice(0, 8),
    cardMeta,
    ratingsMap,
    tierMap,
  };
}

// ── Section Unlock Helpers ─────────────────────────

// Returns true if the section is locked (and renders the lock placeholder); false if unlocked
function lockedOut(section, containerId, compact = false) {
  const threshold = SECTION_TIERS[section] ?? MIN_UNLOCK_THRESHOLD;
  const count = gAnalytics.unlockCount;
  if (count >= threshold) return false;

  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = compact
      ? `<span class="section-locked-inline">🔒 累積 ${threshold} 場解鎖（目前 ${count} / ${threshold}）</span>`
      : `
      <div class="section-locked">
        <div class="section-locked-icon">🔒</div>
        <div class="section-locked-text">累積 ${threshold} 場評分解鎖</div>
        <div class="section-locked-sub">目前 ${count} / ${threshold} 場</div>
      </div>`;
  }
  return true;
}

function renderUnlockProgress() {
  const el = document.getElementById('unlockProgress');
  if (!el) return;
  const count = gAnalytics.unlockCount;

  if (count >= UNLOCK_THRESHOLD) {
    el.innerHTML = `<span class="unlock-step done">🔓 已全部解鎖（${UNLOCK_THRESHOLD}+ 場）</span>`;
    return;
  }

  const steps = UNLOCK_TIER_LIST.map(t => {
    const cls = count >= t ? 'done' : 'todo';
    return `<span class="unlock-step ${cls}">${t}${count >= t ? ' ✓' : ''}</span>`;
  }).join('<span class="unlock-arrow">→</span>');

  const next = UNLOCK_TIER_LIST.find(t => count < t);
  const nextHint = next ? `<span class="unlock-next">再 ${next - count} 場解鎖下一階段</span>` : '';

  el.innerHTML = `<span class="unlock-lbl">解鎖進度</span>${steps}${nextHint}`;
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
  if (lockedOut('scoreChart', 'scoreChartWrap')) return;
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
  if (lockedOut('gem', 'gemContent')) return;
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
  if (lockedOut('typePref', 'typePrefContent')) return;
  const { occEfficiency, minEfficiency, avgScore, occAvgElo, minAvgElo } = gAnalytics;
  const fmtElo = v => v !== null ? Math.round(v) : '—';

  const row = (cls, title, score, avgElo) => {
    if (score === null) {
      return `
      <div class="tp-row">
        <div class="tp-row-title ${cls}">${title}</div>
        <div class="tp-empty">資料還太少，看不出結果</div>
      </div>`;
    }
    const diff = avgScore !== null ? score - avgScore : null;
    const verdict = diff === null ? ''
      : diff >= 4  ? `比你的整體平均得分（${avgScore} 分）高出 ${diff} 分，是你挑得特別準的牌型`
      : diff <= -4 ? `比你的整體平均得分（${avgScore} 分）低了 ${Math.abs(diff)} 分，挑這類牌時準度稍微下滑`
      : `跟你的整體平均得分（${avgScore} 分）差不多，挑這類牌時表現穩定`;
    const pct = Math.min(Math.max(score, 0), 100);
    return `
    <div class="tp-row">
      <div class="tp-row-title ${cls}">${title}</div>
      <div class="tp-track">
        <div class="tp-fill ${cls}" style="width:${pct}%"></div>
      </div>
      <div class="tp-row-vals">效率分數 <b>${score}</b> 分　·　選牌平均 ELO ${fmtElo(avgElo)}</div>
      <div class="tp-row-verdict ${cls}">${verdict}</div>
    </div>`;
  };

  document.getElementById('typePrefContent').innerHTML = `
    ${row('occ', '職業牌', occEfficiency, occAvgElo)}
    ${row('min', '次要發展牌', minEfficiency, minAvgElo)}
    <div class="pref-note">「效率分數」與上方總覽的「平均得分」用同一套算法──每次選擇取「你選的牌 ELO ÷ 當輪候選牌中最高 ELO」的比例，平均後換算成 0~100 分；分數越高代表你越常選到接近當輪最強的牌。這裡依「職業牌」「次要發展卡」分開計算，可以看出你在哪一種牌型上挑得比較準</div>
  `;
}

// ── 計分型 vs 引擎型偏好 ───────────────────────────

function renderScoreEnginePref() {
  if (lockedOut('scoreEnginePref', 'scoreEnginePrefContent')) return;
  const { occ, min } = gAnalytics.scoreEnginePref;
  const fmtPct = v => v !== null ? `${Math.round(v * 100)}%` : '—';
  const fmtElo = v => v !== null ? Math.round(v) : '—';

  // 把兩個選取率換算成「機率高了百分之幾」，比倍數更貼近直覺
  const verdictOf = (scoreRate, engineRate) => {
    if (scoreRate === null || engineRate === null || (scoreRate === 0 && engineRate === 0)) {
      return { dir: 'even', icon: '📊', text: '資料還太少，看不出明顯偏好' };
    }
    const higher = Math.max(scoreRate, engineRate);
    const lower  = Math.min(scoreRate, engineRate);
    const diffPct = lower > 0 ? Math.round((higher / lower - 1) * 100) : 999;
    if (diffPct < 12) {
      return { dir: 'even', icon: '⚖️', text: '看到計分型或引擎型的卡時，選擇它的機率差不多，沒有明顯偏好' };
    }
    const dir = scoreRate > engineRate ? 'score' : 'engine';
    const lbl = dir === 'score' ? '計分型' : '引擎型';
    const strength = diffPct >= 50 ? '明顯' : '稍微';
    return {
      dir, icon: '👉',
      text: `${strength}偏好<b>${lbl}卡</b>——遇到${lbl}卡時，比遇到另一種卡多了約 ${diffPct}% 的機率會選它`,
    };
  };

  const block = (title, p) => {
    // pref: 0 = 完全偏引擎型、0.5 = 均衡、1 = 完全偏計分型
    const pref = p.pref;
    const markerPct = pref !== null ? Math.round(pref * 100) : 50;
    const v = verdictOf(p.scoreRate, p.engineRate);

    return `
    <div class="se-cat">
      <div class="se-cat-title">${title}</div>
      <div class="se-gauge">
        <div class="se-gauge-track">
          <div class="se-gauge-marker" style="left:${markerPct}%"></div>
        </div>
        <div class="se-gauge-labels">
          <span class="se-gauge-lbl engine">⚙️ 偏引擎型</span>
          <span class="se-gauge-lbl mid">均衡</span>
          <span class="se-gauge-lbl score">💰 偏計分型</span>
        </div>
      </div>
      <div class="se-verdict ${v.dir}">${v.icon} ${v.text}</div>
      <div class="se-detail">
        看到時選了它的比例　計分型卡 ${fmtPct(p.scoreRate)}（${p.scorePicks}/${p.scoreSeen} 次）　·　引擎型卡 ${fmtPct(p.engineRate)}（${p.enginePicks}/${p.engineSeen} 次）　　選牌平均 ELO　計分型 ${fmtElo(p.scoreAvgElo)}　·　引擎型 ${fmtElo(p.engineAvgElo)}
      </div>
    </div>`;
  };

  document.getElementById('scoreEnginePrefContent').innerHTML = `
    ${block('職業卡', occ)}
    ${block('次要發展卡', min)}
    <div class="pref-note">指標位置＝你「看到計分型卡就選它」與「看到引擎型卡就選它」這兩個機率的相對位置，避免卡池中兩種卡數量不對等造成偏差；計分型卡＝職業卡看「紅利分數」、次要發展卡則勝利點數或紅利分數有一項即算</div>
  `;
}

// ── 盲區清單 ───────────────────────────────────────

function renderBlindSpots() {
  if (lockedOut('blindSpots', 'blindSpotList')) return;
  const { blindSpots } = gAnalytics;
  renderCardList('blindSpotList', blindSpots, item => `${Math.round(item.value * 100)}% 跳過率`);
  if (blindSpots.length === 0) {
    document.getElementById('blindSpotList').innerHTML = '<div class="rank-empty">目前沒有明顯盲區，眼光不錯！</div>';
  }
}

// ── 分數穩定度 ─────────────────────────────────────

function renderStability() {
  if (lockedOut('stability', 'scoreStability', true)) return;
  const { scoreStdDev } = gAnalytics;
  const el = document.getElementById('scoreStability');
  if (!el) return;
  if (scoreStdDev === null) { el.innerHTML = ''; return; }
  const sd = Math.round(scoreStdDev * 10) / 10;
  const label = sd < 10 ? '表現相當穩定' : sd < 18 ? '表現中規中矩，偶有起伏' : '表現起伏較大，時而神準時而失手';
  el.innerHTML = `<span class="stability-val">標準差 ±${sd} 分</span><span class="stability-lbl">${label}</span>`;
}

// ── 最難抉擇時刻 ───────────────────────────────────

function renderToughCalls() {
  if (lockedOut('toughCalls', 'toughCallsContent')) return;
  const { toughCalls, cardMeta, tierMap } = gAnalytics;
  const el = document.getElementById('toughCallsContent');
  el.innerHTML = '';

  toughCalls.forEach(({ picked, pickedElo, rivalId, rivalElo, gap, timestamp }) => {
    const cP = cardMeta[picked], cR = cardMeta[rivalId];
    const nameP = cP?.['牌名'] || picked, nameR = cR?.['牌名'] || rivalId;
    const tierP = tierMap[picked] || '?', tierR = tierMap[rivalId] || '?';
    const date = timestamp ? new Date(timestamp).toLocaleDateString('zh-TW') : '—';

    const item = document.createElement('div');
    item.className = 'tough-item';
    item.innerHTML = `
      <div class="tough-meta">
        <span class="tough-gap">差距僅 ${Math.round(gap)} 分</span>
        <span class="tough-date">${date}</span>
      </div>
      <div class="tough-cards">
        <div class="tough-card picked">
          <div class="tough-thumb"><canvas data-slot="p"></canvas></div>
          <span class="tier-pip tier-${tierP.toLowerCase()}">${tierP}</span>
          <span class="tough-name">${nameP}</span>
          <span class="tough-elo">${Math.round(pickedElo)}</span>
          <span class="tough-pick-badge">你選了這張</span>
        </div>
        <span class="tough-vs">vs</span>
        <div class="tough-card">
          <div class="tough-thumb"><canvas data-slot="r"></canvas></div>
          <span class="tier-pip tier-${tierR.toLowerCase()}">${tierR}</span>
          <span class="tough-name">${nameR}</span>
          <span class="tough-elo">${Math.round(rivalElo)}</span>
        </div>
      </div>
    `;
    if (cP) requestAnimationFrame(() => drawCrop(item.querySelector('canvas[data-slot="p"]'), cP, 0.5));
    if (cR) requestAnimationFrame(() => drawCrop(item.querySelector('canvas[data-slot="r"]'), cR, 0.5));
    el.appendChild(item);
  });

  if (toughCalls.length === 0) el.innerHTML = '<div class="rank-empty">資料不足</div>';
}

// ── Best / Worst Sessions ──────────────────────────

function renderExtremes() {
  if (lockedOut('extremes', 'extremesContent')) return;
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
            <button class="ext-expand-btn">🔍 展開</button>
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

  // Bind expand buttons
  wrap.querySelectorAll('.ext-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const picks = btn.parentElement.nextElementSibling;
      const isExpanded = picks.classList.toggle('expanded');
      btn.textContent = isExpanded ? '🔍 收合' : '🔍 展開';
      picks.querySelectorAll('canvas[data-id]').forEach(canvas => {
        const card = cardMeta[canvas.dataset.id];
        if (card) requestAnimationFrame(() => drawCrop(canvas, card, isExpanded ? 1 : 0.5));
      });
    });
  });
}

// ── Common Pairs ──────────────────────────────────

function renderPairs() {
  if (lockedOut('pairs', 'pairsContent')) return;
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
  if (lockedOut('pickPriority', 'pickPriorityContent')) return;
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
  renderUnlockProgress();
  document.getElementById('statSessions').textContent = gAnalytics.totalSessions;
  document.getElementById('statAvgScore').textContent = gAnalytics.avgScore !== null ? `${gAnalytics.avgScore} 分` : '—';
  document.getElementById('statGems').textContent    = gAnalytics.gemCount;
  document.getElementById('statMistakes').textContent = gAnalytics.mistakeCount;

  buildFavList('favOccList', 'occupation', false);
  buildFavList('favMinList', 'minor',      false);
  buildHateList('hateOccList', 'occupation', false);
  buildHateList('hateMinList', 'minor',      false);

  renderScoreChart();
  renderStability();
  renderGem();
  renderTypePref();
  renderScoreEnginePref();
  renderBlindSpots();
  renderExtremes();
  renderToughCalls();
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

  if (!auth || !hasProfileAccess()) {
    document.getElementById('profileLoading').style.display = 'none';
    document.getElementById('profileAuthRequired').style.display = '';
    document.getElementById('profileLoginBtn').addEventListener('click', openLoginModal);
    document.getElementById('profilePlayerLoginBtn').addEventListener('click', openPlayerLoginModal);
    return;
  }

  const urlRater  = new URLSearchParams(location.search).get('rater');
  const adminView = isAdmin() && !!urlRater;
  const raterId   = adminView ? urlRater : getRaterId();

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

    if (!adminView && count < MIN_UNLOCK_THRESHOLD) {
      document.getElementById('profileLoading').style.display = 'none';
      document.getElementById('profileLocked').style.display = '';
      const pct = Math.min(count / MIN_UNLOCK_THRESHOLD * 100, 100);
      document.getElementById('profileLockFill').style.width  = `${pct}%`;
      document.getElementById('profileLockCount').textContent = `${count} / ${MIN_UNLOCK_THRESHOLD} 場`;
      return;
    }

    setLoading('載入評分紀錄…');
    const [sessions, cards, ratingsMap] = await Promise.all([
      fetchSessions(raterId),
      fetch('./cards.json').then(r => r.json()),
      fetchAllRatings(),
      window.CardImages?.load?.() || Promise.resolve(),
    ]);

    setLoading('計算分析數據…');
    const tierMap = computeTierMap(ratingsMap, cards);
    gAnalytics = computeAnalytics(sessions, cards, ratingsMap, tierMap);
    gAnalytics.unlockCount = adminView ? Infinity : count;

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
  if (auth && hasProfileAccess() && document.getElementById('profileAuthRequired').style.display !== 'none') {
    document.getElementById('profileAuthRequired').style.display = 'none';
    document.getElementById('profileLoading').style.display = '';
    init();
  }
}
