/* ══════════════════════════════════════════════════
   農家樂 Raters — raters.js
   管理員後台：評分者列表
   ══════════════════════════════════════════════════ */

const FIRESTORE_BASE_RATERS = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';

let ratersData = []; // sorted array of rater objects
let currentSort = 'count';
let ratersLoaded = false;

const RATERS_CACHE_KEY = 'agricola_raters_cache_v2'; // v2：加入排序評分次數
const RATERS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ── Fetch ──────────────────────────────────────────

function getCachedRaters() {
  try {
    const s = JSON.parse(localStorage.getItem(RATERS_CACHE_KEY));
    if (s && Date.now() - s.cachedAt < RATERS_CACHE_TTL) return s.data;
  } catch {}
  return null;
}

function setCachedRaters(data) {
  try {
    localStorage.setItem(RATERS_CACHE_KEY, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {}
}

// 依 timestamp 分頁掃描一個 collection，每筆 doc 的 fields 交給 onDoc 處理
async function scanSessions(collectionId, fieldPaths, onDoc) {
  let lastTimestamp = null;

  while (true) {
    const query = {
      structuredQuery: {
        from: [{ collectionId }],
        select: { fields: fieldPaths.map(fp => ({ fieldPath: fp })) },
        orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'ASCENDING' }],
        limit: 300,
      }
    };
    if (lastTimestamp) {
      query.structuredQuery.startAt = { before: false, values: [{ stringValue: lastTimestamp }] };
    }

    const res  = await fetch(`${FIRESTORE_BASE_RATERS}:runQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });
    const data = await res.json();
    const docs = (Array.isArray(data) ? data : []).filter(d => d.document);

    for (const d of docs) onDoc(d.document.fields || {});

    if (docs.length < 300) break;
    lastTimestamp = docs[docs.length - 1].document.fields?.timestamp?.stringValue;
    if (!lastTimestamp) break;
  }
}

function ensureRater(map, id) {
  if (!map[id]) map[id] = { id, count: 0, lastActive: '', occ: 0, mixed: 0, rank: 0 };
  return map[id];
}

async function fetchAllSessions() {
  const cached = getCachedRaters();
  if (cached) return cached;

  const map = {}; // { raterId: { count, lastActive, occ, mixed, rank } }

  // 輪抽模擬器場次（agricola_sessions）
  await scanSessions('agricola_sessions', ['raterId', 'timestamp', 'draftMode', 'role'], f => {
    const id = f.raterId?.stringValue;
    if (!id) return;
    if (f.role?.stringValue === 'player') return; // 玩家模式紀錄不算評分者場次
    const ts   = f.timestamp?.stringValue || '';
    const mode = f.draftMode?.stringValue || 'separate';

    const r = ensureRater(map, id);
    r.count++;
    if (ts > r.lastActive) r.lastActive = ts;
    if (mode === 'combined') r.mixed++;
    else                     r.occ++;  // occ / min / legacy 'separate'
  });

  // 排序評分（快速）次數（agricola_rank_sessions，每輪一筆）
  await scanSessions('agricola_rank_sessions', ['raterId', 'timestamp'], f => {
    const id = f.raterId?.stringValue;
    if (!id) return;
    const ts = f.timestamp?.stringValue || '';

    const r = ensureRater(map, id);
    r.rank++;
    if (ts > r.lastActive) r.lastActive = ts;
  });

  const result = Object.values(map);
  setCachedRaters(result);
  return result;
}

// ── Sort & Render ──────────────────────────────────

function sortRaters(arr, by) {
  return [...arr].sort((a, b) => {
    if (by === 'lastActive') return b.lastActive.localeCompare(a.lastActive);
    if (by === 'rank')       return b.rank - a.rank;
    return b.count - a.count;
  });
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function renderTable() {
  const tbody = document.getElementById('ratersTableBody');
  tbody.innerHTML = '';

  sortRaters(ratersData, currentSort).forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="rater-name">${r.id}</td>
      <td class="rater-count">${r.count}</td>
      <td class="rater-date">${formatDate(r.lastActive)}</td>
      <td class="rater-mode">${r.occ || '—'}</td>
      <td class="rater-mode">${r.mixed || '—'}</td>
      <td class="rater-count">${r.rank || '—'}</td>
      <td><a href="profile.html?rater=${encodeURIComponent(r.id)}" class="rater-link-btn">查看分析 →</a></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderSummary() {
  const total     = ratersData.reduce((s, r) => s + r.count, 0);
  const totalRank = ratersData.reduce((s, r) => s + (r.rank || 0), 0);
  document.getElementById('ratersSummary').textContent =
    `共 ${ratersData.length} 位評分者　輪抽總場次 ${total}　排序評分總輪數 ${totalRank}`;
}

// ── Load content (after auth confirmed) ────────────

async function loadRatersContent() {
  if (ratersLoaded) return;
  ratersLoaded = true;

  document.getElementById('ratersAuthRequired').style.display = 'none';
  document.getElementById('ratersLoading').style.display = '';

  try {
    document.getElementById('ratersLoadingMsg').textContent = '載入評分紀錄…';
    ratersData = await fetchAllSessions();

    document.getElementById('ratersLoading').style.display = 'none';
    document.getElementById('ratersContent').style.display = '';

    renderSummary();
    renderTable();

    document.querySelectorAll('.sort-btn[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentSort = btn.dataset.sort;
        document.querySelectorAll('.sort-btn[data-sort]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTable();
      });
    });

    document.getElementById('refreshRatersBtn').addEventListener('click', async () => {
      localStorage.removeItem(RATERS_CACHE_KEY);
      ratersLoaded = false;
      document.getElementById('ratersContent').style.display = 'none';
      document.getElementById('ratersLoading').style.display = '';
      await loadRatersContent();
    });

  } catch (err) {
    document.getElementById('ratersLoadingMsg').textContent = `載入失敗：${err.message}`;
  }
}

// ── Auth callback (login after page load) ──────────

function onAuthChange() {
  if (ratersLoaded) return;
  if (typeof isAdmin === 'function' && isAdmin()) loadRatersContent();
}

// ── Init ───────────────────────────────────────────

async function init() {
  await new Promise(r => {
    if (document.readyState === 'complete') { r(); return; }
    window.addEventListener('load', r);
  });

  const auth = typeof getAuth === 'function' ? getAuth() : null;

  if (!auth || !isAdmin()) {
    document.getElementById('ratersLoading').style.display = 'none';
    document.getElementById('ratersAuthRequired').style.display = '';
    document.getElementById('ratersLoginBtn').addEventListener('click', openLoginModal);
    return;
  }

  loadRatersContent();
}

document.addEventListener('DOMContentLoaded', init);
