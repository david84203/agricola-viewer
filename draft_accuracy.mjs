/* ══════════════════════════════════════════════════
   扣牌分 vs 真實名次 — 自動比對與累積紀錄
   ──────────────────────────────────────────────────
   用途：驗證「覆盤輪抽的扣牌評分（牌力 ELO 分析）」能不能預測真實名次。
   資料：Firestore match_results（線上對戰完賽紀錄，含 draftLog 與真實 rank）
   演算法：完全比照 review.js calculateAllScores / getAdjElo，
          差別只在可見牌直接取 draftLog 的 ev.seen（實際看到的那包），
          不用傳包公式反推。

   跑法：node draft_accuracy.mjs
   產出：draft_accuracy.json（機器讀，可給網頁 fetch）
        draft_accuracy.md（人看的報表）
   ══════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FS_BASE = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';

/* 與 review.js 同步的常數 */
const SCORE_ELO_CEILING = 1700;
const REFERENCE_GAP = 150;
const NEAR_TIE_TOLERANCE = 20;
const BGA_DECKS = ['A', 'B', 'C', 'D', 'E'];
const DRAFT_ROUNDS = 7;

/* 禁卡預設分（label → eloPreset），Firestore banlist 只給 ids */
const BAN_PRESETS = {
  過強職業卡: 1300, 過強次要發展卡: 1300,
  過爛職業卡: 850, 過爛次要發展卡: 850,
  擾亂戰局: 1200,
};

/* ── Firestore REST 值轉純 JS ───────────────────── */
function conv(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(conv);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, conv(x)]));
  return v;
}
const docToObj = (doc) => conv({ mapValue: { fields: doc.fields || {} } });

async function fetchAllMatches() {
  const out = [];
  let token = '';
  do {
    const res = await fetch(`${FS_BASE}/match_results?pageSize=300${token ? `&pageToken=${token}` : ''}`);
    const json = await res.json();
    (json.documents || []).forEach((doc) => {
      const obj = docToObj(doc);
      obj.__id = doc.name.split('/').pop();
      out.push(obj);
    });
    token = json.nextPageToken || '';
  } while (token);
  return out;
}

/* ── 卡表 / 禁卡 / 重複卡 / ELO ──────────────────── */
/* draftLog 記的是去星號的卡片ID（play.js cleanCardId），卡表與評分庫是帶星號的原 ID，
   查 ELO / 禁卡 / 重複卡前都要先還原，否則整批卡查不到會被當 1200 分。 */
function loadCards() {
  const cards = JSON.parse(fs.readFileSync(path.join(DIR, 'cards.json'), 'utf8'));
  const deckById = {};
  const cleanToReal = {};
  cards.forEach((c) => {
    const id = c['卡片ID'];
    if (!id) return;
    deckById[id] = c['牌組'];
    const clean = id.replace(/\*+$/, '');
    if (clean !== id && !cleanToReal[clean]) cleanToReal[clean] = id;
  });
  // 卡表本來就有的原樣 ID 優先，不被星號版蓋掉
  const resolveId = (id) => (deckById[id] ? id : (cleanToReal[id] || id));
  return { deckById, resolveId };
}

async function loadBanMap() {
  const map = {};
  try {
    const res = await fetch(`${FS_BASE}/settings/banlist`);
    const doc = await res.json();
    const groups = (doc.fields?.groups?.arrayValue?.values || []).map((g) => ({
      label: g.mapValue.fields.label.stringValue,
      ids: (g.mapValue.fields.ids.arrayValue.values || []).map((v) => v.stringValue),
    }));
    groups.forEach((g) => {
      const preset = BAN_PRESETS[g.label] ?? 1200;
      g.ids.forEach((id) => { map[id] = { label: g.label, eloPreset: preset }; });
    });
  } catch { /* 抓不到就當沒有禁卡，會在報表註記 */ }
  return map;
}

/* 直接跑 viewer 的 duplicate-utils.js，避免重寫一套會走鐘的排除邏輯 */
async function loadDupExcluded() {
  const store = {};
  const realFetch = globalThis.fetch;
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  globalThis.fetch = (url, opt) => (String(url).startsWith('./')
    ? Promise.resolve({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(DIR, String(url)), 'utf8')) })
    : realFetch(url, opt));
  vm.runInThisContext(fs.readFileSync(path.join(DIR, 'duplicate-utils.js'), 'utf8'));
  const info = await globalThis.DuplicateCards.loadDuplicateInfo();
  globalThis.fetch = realFetch;
  return info.excludedRefs;
}

async function fetchElo(cardIds) {
  const cache = {};
  const ids = [...new Set(cardIds)];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const res = await fetch(`${FS_BASE}:batchGet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // 卡片ID 有中文（舊版E214）與 Ö 等字元，percent-encode 會查不到，照 review.js 原樣送
        documents: chunk.map((id) => `projects/project-hub-410cd/databases/(default)/documents/agricola_ratings/${id}`),
      }),
    });
    const data = await res.json();
    (Array.isArray(data) ? data : []).forEach((item) => {
      if (!item.found) return;
      const id = item.found.name.split("/").pop();
      const f = item.found.fields || {};
      cache[id] = {
        elo: Number(f.elo?.integerValue ?? f.elo?.doubleValue ?? 1200),
        seenCount: Number(f.seenCount?.integerValue ?? 0),
        rankSeen: Number(f.rankSeen?.integerValue ?? 0),
      };
    });
  }
  return cache;
}

/* ── 評分（照抄 review.js getAdjElo）─────────────── */
function makeGetAdjElo({ banMap, dupExcluded, eloCache, deckById, resolveId }) {
  return function getAdjElo(rawId) {
    const cardId = resolveId(rawId);
    const banInfo = banMap[cardId];
    const special = banInfo
      ? { type: 'ban', eloPreset: banInfo.eloPreset }
      : (dupExcluded.has(cardId) ? { type: 'dup', eloPreset: 1150 } : null);
    if (special) {
      if (special.type === 'ban' && BGA_DECKS.includes(deckById[cardId])) {
        const cached = eloCache[cardId];
        if (cached) {
          const conf = Math.min((cached.rankSeen ?? 0) / 30, 1);
          return Math.min(conf * cached.elo + (1 - conf) * special.eloPreset, SCORE_ELO_CEILING);
        }
      }
      return special.eloPreset;
    }
    const r = eloCache[cardId] || { elo: 1200, seenCount: 0 };
    const conf = Math.min(r.seenCount / 30, 1);
    return Math.min(conf * r.elo + (1 - conf) * 1200, SCORE_ELO_CEILING);
  };
}

/* draftLog → 每位玩家的扣牌分。回傳 null 表示這局資料不完整不能評 */
function scoreMatch(draftLog, getAdjElo) {
  const picksByColor = {};
  for (const ev of draftLog) {
    if (typeof ev.pick !== 'number') continue;                  // 'discard' 棄包事件跳過
    const seen = Array.isArray(ev.seen) && ev.seen.length
      ? ev.seen
      : (ev.seenCards || []).map((c) => c.id).filter(Boolean);
    if (!ev.picked || !seen.length) continue;
    (picksByColor[ev.color] ||= []).push({ stage: ev.stage, pick: ev.pick, picked: ev.picked, seen });
  }
  const colors = Object.keys(picksByColor);
  if (colors.length !== 4) return null;

  const result = {};
  for (const color of colors) {
    const rounds = picksByColor[color];
    if (rounds.length !== DRAFT_ROUNDS * 2) return null;         // 7 職業 + 7 次發，缺一不評
    const details = rounds.map((r) => {
      const all = [r.picked, ...r.seen.filter((id) => id !== r.picked)];
      const elos = all.map(getAdjElo);
      const maxElo = Math.max(...elos);
      const pickedElo = getAdjElo(r.picked);
      const gap = maxElo - pickedElo;
      const eff = gap <= NEAR_TIE_TOLERANCE
        ? 1
        : Math.min(1, Math.max(0, 1 - (gap - NEAR_TIE_TOLERANCE) / REFERENCE_GAP));
      return { stage: r.stage, pick: r.pick, picked: r.picked, gap: Math.round(gap), efficiency: eff, bestId: all[elos.indexOf(maxElo)] };
    });
    const handIds = rounds.map((r) => r.picked);
    const first4 = rounds.filter((r) => r.pick <= 4).map((r) => r.picked);
    result[color] = {
      draftScore: Math.round(details.reduce((s, d) => s + d.efficiency, 0) / details.length * 100),
      handAvgElo: Math.round(handIds.reduce((s, id) => s + getAdjElo(id), 0) / handIds.length),
      first4AvgElo: Math.round(first4.reduce((s, id) => s + getAdjElo(id), 0) / first4.length),
      missCount: details.filter((d) => d.efficiency < 1).length,
    };
  }
  return result;
}

/* ── 名次與相關係數 ─────────────────────────────── */
/* 由分數算名次（高分＝第 1 名），同分取平均名次 */
function ranksFromScores(scores) {
  const sorted = scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
  const ranks = new Array(scores.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].s === sorted[i].s) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[sorted[k].i] = avg;
    i = j + 1;
  }
  return ranks;
}

function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/* 兩兩比較：預測與實際的先後順序一致的對數 / 有效對數 */
function pairwiseAgreement(pred, real) {
  let hit = 0, total = 0;
  for (let i = 0; i < pred.length; i++) {
    for (let j = i + 1; j < pred.length; j++) {
      if (pred[i] === pred[j] || real[i] === real[j]) continue;   // 同分不計
      total++;
      if ((pred[i] < pred[j]) === (real[i] < real[j])) hit++;
    }
  }
  return { hit, total };
}

/* ── 主流程 ─────────────────────────────────────── */
const args = process.argv.slice(2);
const includeDouble = args.includes('--include-double');
const publish = args.includes('--publish');   // 把彙總寫進 Firestore 給覆盤頁顯示

console.log('抓 match_results…');
const matches = await fetchAllMatches();
console.log(`  共 ${matches.length} 局`);

console.log('載入卡表 / 禁卡 / 重複卡…');
const { deckById, resolveId } = loadCards();
const banMap = await loadBanMap();
const dupExcluded = await loadDupExcluded();
console.log(`  卡表 ${Object.keys(deckById).length} 張、禁卡 ${Object.keys(banMap).length} 張、重複卡排除 ${dupExcluded.size} 筆`);

/* 蒐集所有出現過的卡 ID 一次抓 ELO */
const allIds = new Set();
matches.forEach((m) => (m.draftLog || []).forEach((ev) => {
  (ev.seen || []).forEach((id) => allIds.add(id));
  (ev.seenCards || []).forEach((c) => c?.id && allIds.add(c.id));
  if (ev.picked) allIds.add(ev.picked);
}));
const realIds = [...allIds].map(resolveId);
console.log(`載入 ELO（${allIds.size} 張卡）…`);
const eloCache = await fetchElo(realIds);
const hit = realIds.filter((id) => eloCache[id]).length;
const missingIds = realIds.filter((id) => !eloCache[id]);
console.log(`  有評分資料 ${hit}/${realIds.length}（沒有的以 1200 基準計）`);
if (missingIds.length) console.log(`  無評分：${missingIds.slice(0, 15).join(', ')}${missingIds.length > 15 ? ' …' : ''}`);
const getAdjElo = makeGetAdjElo({ banMap, dupExcluded, eloCache, deckById, resolveId });

const rows = [];
const skipped = [];
for (const m of matches) {
  const reason = (r) => { skipped.push({ roomCode: m.roomCode || m.__id, finishedAt: m.finishedAt, reason: r }); };
  if (!Array.isArray(m.draftLog) || !m.draftLog.length) { reason('沒有輪抽紀錄'); continue; }
  if (m.playerCount !== 4) { reason(`非四人局（${m.playerCount} 人）`); continue; }
  if (m.teamMode === 'double' && !includeDouble) { reason('雙打（名次是隊伍制，個人扣牌分不可比）'); continue; }
  const players = (m.players || []).filter((p) => p && p.color && typeof p.rank === 'number');
  if (players.length !== 4) { reason('玩家資料不齊'); continue; }

  const scored = scoreMatch(m.draftLog, getAdjElo);
  if (!scored) { reason('輪抽紀錄不完整（非 7+7 扣牌）'); continue; }
  if (players.some((p) => !scored[p.color])) { reason('輪抽顏色與座位對不上'); continue; }

  const realRanks = players.map((p) => p.rank);
  /* 三種預測指標各算一次，看誰比較能預測名次 */
  const evalPredictor = (values) => {
    const ranks = ranksFromScores(values);
    const pair = pairwiseAgreement(ranks, realRanks);
    const top1 = ranks.indexOf(Math.min(...ranks));
    return {
      spearman: Number(pearson(ranks, realRanks).toFixed(4)),
      pairHit: pair.hit,
      pairTotal: pair.total,
      exactMatch: ranks.every((r, i) => r === realRanks[i]),
      top1Hit: realRanks[top1] === Math.min(...realRanks) && ranks.filter((r) => r === ranks[top1]).length === 1,
      rankMad: Number((ranks.reduce((s, r, i) => s + Math.abs(r - realRanks[i]), 0) / 4).toFixed(3)),
      ranks,
    };
  };
  const draftScores = players.map((p) => scored[p.color].draftScore);
  const evalDraft = evalPredictor(draftScores);
  const evalHand = evalPredictor(players.map((p) => scored[p.color].handAvgElo));
  const evalFirst4 = evalPredictor(players.map((p) => scored[p.color].first4AvgElo));
  const draftRanks = evalDraft.ranks;

  rows.push({
    roomCode: m.roomCode || m.__id,
    replayId: m.replayId || null,
    finishedAt: m.finishedAt,
    buildVersion: m.buildVersion || null,
    gameMode: m.gameMode || null,
    paceMode: m.paceMode || null,
    teamMode: m.teamMode || 'single',
    ranked: !!m.ranked,
    clean: !!m.ranked && !m.forceEnded && !m.surrendered && !m.godTouched,
    flags: { forceEnded: !!m.forceEnded, surrendered: !!m.surrendered, godTouched: !!m.godTouched },
    players: players.map((p, i) => ({
      name: p.name || p.userId || p.color,
      color: p.color,
      realRank: p.rank,
      realScore: p.score ?? null,
      draftScore: draftScores[i],
      draftRank: draftRanks[i],
      handAvgElo: scored[p.color].handAvgElo,
      first4AvgElo: scored[p.color].first4AvgElo,
      missCount: scored[p.color].missCount,
    })),
    metrics: {
      ...evalDraft,
      scoreCorr: Number(pearson(draftScores, players.map((p) => p.score ?? 0)).toFixed(4)),
    },
    /* 對照組：不看選牌效率，直接用手牌牌力預測 */
    metricsHandElo: evalHand,
    metricsFirst4Elo: evalFirst4,
  });
}
rows.sort((a, b) => String(a.finishedAt).localeCompare(String(b.finishedAt)));

/* 彙總（全部局 / 只算乾淨局）*/
function summarize(list, key = 'metrics') {
  if (!list.length) return { games: 0 };
  const n = list.length;
  const avg = (f) => list.reduce((s, r) => s + f(r), 0) / n;
  const pairHit = list.reduce((s, r) => s + r[key].pairHit, 0);
  const pairTotal = list.reduce((s, r) => s + r[key].pairTotal, 0);
  return {
    games: n,
    avgSpearman: Number(avg((r) => r[key].spearman).toFixed(4)),
    exactMatchRate: Number((list.filter((r) => r[key].exactMatch).length / n).toFixed(4)),
    top1HitRate: Number((list.filter((r) => r[key].top1Hit).length / n).toFixed(4)),
    avgRankMad: Number(avg((r) => r[key].rankMad).toFixed(3)),
    pairwiseAgreement: Number((pairHit / (pairTotal || 1)).toFixed(4)),
    pairHit,
    pairTotal,
    avgScoreCorr: Number(avg((r) => r.metrics.scoreCorr).toFixed(4)),
    /* 亂猜的期望值，用來對照 */
    randomBaseline: { avgSpearman: 0, exactMatchRate: 0.0417, top1HitRate: 0.25, avgRankMad: 1.25, pairwiseAgreement: 0.5 },
    /* 兩兩比較的二項檢定 p 值（單尾，H0：純亂猜 50%）*/
    pairwiseP: Number(binomTailP(pairHit, pairTotal, 0.5).toExponential(3)),
  };
}

/* P(X >= k)，X ~ Binomial(n, p) */
function binomTailP(k, n, p) {
  if (!n) return 1;
  let logFact = [0];
  for (let i = 1; i <= n; i++) logFact[i] = logFact[i - 1] + Math.log(i);
  let sum = 0;
  for (let i = k; i <= n; i++) {
    sum += Math.exp(logFact[n] - logFact[i] - logFact[n - i] + i * Math.log(p) + (n - i) * Math.log(1 - p));
  }
  return Math.min(1, sum);
}

const summary = {
  generatedAt: new Date().toISOString(),
  source: 'Firestore match_results',
  algo: { REFERENCE_GAP, NEAR_TIE_TOLERANCE, SCORE_ELO_CEILING, note: '與 agricola-viewer review.js calculateAllScores 同一套' },
  eloSnapshot: { cardsWithRating: hit, cardsSeen: allIds.size },
  all: summarize(rows),
  clean: summarize(rows.filter((r) => r.clean)),
  /* 三種預測方式對照：選牌效率 vs 純牌力 */
  predictors: {
    draftScore: summarize(rows, 'metrics'),
    handAvgElo: summarize(rows, 'metricsHandElo'),
    first4AvgElo: summarize(rows, 'metricsFirst4Elo'),
  },
};

const out = { summary, matches: rows, skipped };
fs.writeFileSync(path.join(DIR, 'draft_accuracy.json'), JSON.stringify(out, null, 2), 'utf8');

/* ── Markdown 報表 ──────────────────────────────── */
const fmtPct = (x) => `${(x * 100).toFixed(1)}%`;
const summaryTable = (s, title) => (s.games ? [
  `### ${title}（${s.games} 局）`,
  '',
  '| 指標 | 實測 | 亂猜期望 | 說明 |',
  '|---|---|---|---|',
  `| 名次相關係數 Spearman ρ | **${s.avgSpearman}** | 0 | +1＝完全一致、0＝毫無關係 |`,
  `| 四名完全命中率 | **${fmtPct(s.exactMatchRate)}** | 4.2% | 四個名次全對 |`,
  `| 冠軍命中率 | **${fmtPct(s.top1HitRate)}** | 25% | 扣牌分第 1 ＝ 真實第 1 |`,
  `| 兩兩順序一致率 | **${fmtPct(s.pairwiseAgreement)}** | 50% | ${s.pairHit}/${s.pairTotal} 對；p = ${s.pairwiseP} |`,
  `| 平均名次誤差 | **${s.avgRankMad}** | 1.25 | 每人預測名次與實際差幾名 |`,
  `| 扣牌分↔實際得分 相關 | **${s.avgScoreCorr}** | 0 | 不看名次，直接比分數 |`,
  '',
] : [`### ${title}：無資料`, '']).join('\n');

const md = [
  '# 扣牌分 vs 真實名次 — 自動比對紀錄',
  '',
  `產生時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}（台北時間）`,
  '',
  '問題：**覆盤輪抽算出來的「扣牌分」（用卡牌中心的 ELO 牌力評分），能不能預測這局誰會贏？**',
  '扣牌分＝每一輪你選的牌跟「當時那包裡 ELO 最高的牌」差多少，7 職業＋7 次發平均後 ×100。',
  '',
  summaryTable(summary.all, '全部可評估對局'),
  summaryTable(summary.clean, '乾淨對局（正式計分、無投降／強制結束／上帝介入）'),
  '### 三種預測方式對照（全部可評估對局）',
  '',
  '同一批對局，換不同東西來預測名次，看誰比較準：',
  '',
  '| 拿來預測的東西 | 兩兩順序一致率 | 冠軍命中率 | Spearman ρ | p 值 |',
  '|---|---|---|---|---|',
  ...Object.entries({
    '扣牌分（選牌效率）': summary.predictors.draftScore,
    '手牌平均 ELO（最後拿到的牌力）': summary.predictors.handAvgElo,
    '前 4 扣平均 ELO（開局關鍵牌）': summary.predictors.first4AvgElo,
  }).map(([label, s]) => `| ${label} | **${fmtPct(s.pairwiseAgreement)}**（${s.pairHit}/${s.pairTotal}） | ${fmtPct(s.top1HitRate)} | ${s.avgSpearman} | ${s.pairwiseP} |`),
  '',
  '亂猜的話：一致率 50%、冠軍 25%、ρ = 0。',
  '',
  '## 逐局明細',
  '',
  '| 日期 | 房號 | 扣牌分名次（分數） | 真實名次（得分） | ρ | 冠軍 | 全中 |',
  '|---|---|---|---|---|---|---|',
  ...rows.map((r) => {
    const byDraft = r.players.slice().sort((a, b) => a.draftRank - b.draftRank)
      .map((p) => `${p.name} ${p.draftScore}`).join(' › ');
    const byReal = r.players.slice().sort((a, b) => a.realRank - b.realRank)
      .map((p) => `${p.name} ${p.realScore}`).join(' › ');
    const date = String(r.finishedAt).slice(0, 10);
    return `| ${date}${r.clean ? '' : ' ⚠'} | ${r.roomCode} | ${byDraft} | ${byReal} | ${r.metrics.spearman.toFixed(2)} | ${r.metrics.top1Hit ? '✅' : '—'} | ${r.metrics.exactMatch ? '✅' : '—'} |`;
  }),
  '',
  '⚠ ＝ 該局有投降／強制結束／上帝介入／未計分，名次品質存疑。',
  '',
  ...(skipped.length ? [
    '## 未納入的對局',
    '',
    '| 房號 | 日期 | 原因 |',
    '|---|---|---|',
    ...skipped.map((s) => `| ${s.roomCode} | ${String(s.finishedAt).slice(0, 10)} | ${s.reason} |`),
    '',
  ] : []),
  '## 怎麼讀這份報表',
  '',
  '- **兩兩順序一致率**最耐看：局數少的時候，它的樣本數是局數 ×6，最先脫離雜訊。',
  '- p 值＝「如果扣牌分其實毫無預測力，純靠運氣也能好成這樣」的機率。低於 0.05 才算證據。',
  '- ELO 是會變的：這份報表用的是**產生當下**的卡牌評分重算，之後評分更新再跑一次數字會動。',
  '',
].join('\n');

fs.writeFileSync(path.join(DIR, 'draft_accuracy.md'), md, 'utf8');

/* ── 發布到 Firestore（覆盤頁讀這份顯示驗證小字）──── */
if (publish) {
  const s = summary.all;
  const body = {
    fields: {
      generatedAt: { stringValue: summary.generatedAt },
      games: { integerValue: String(s.games || 0) },
      pairHit: { integerValue: String(s.pairHit || 0) },
      pairTotal: { integerValue: String(s.pairTotal || 0) },
      pairwiseAgreement: { doubleValue: s.pairwiseAgreement || 0 },
      top1HitRate: { doubleValue: s.top1HitRate || 0 },
      exactMatchRate: { doubleValue: s.exactMatchRate || 0 },
      avgSpearman: { doubleValue: s.avgSpearman || 0 },
      pairwiseP: { stringValue: String(s.pairwiseP ?? '') },
      handEloAgreement: { doubleValue: summary.predictors.handAvgElo.pairwiseAgreement || 0 },
      summaryJson: { stringValue: JSON.stringify(summary) },
    },
  };
  const res = await fetch(`${FS_BASE}/agricola_stats/draft_accuracy`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  console.log(res.ok ? '已發布到 Firestore agricola_stats/draft_accuracy' : `發布失敗：HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}

console.log('');
console.log(`可評估 ${rows.length} 局、略過 ${skipped.length} 局`);
console.log('全部局：', summary.all);
console.log('乾淨局：', summary.clean);
console.log('已寫入 draft_accuracy.json / draft_accuracy.md');
