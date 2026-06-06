/* ══════════════════════════════════════════════════
   農家樂 Raters — raters.js
   管理員後台：評分者列表
   ══════════════════════════════════════════════════ */

const FIRESTORE_BASE_RATERS = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';

let ratersData = []; // sorted array of rater objects
let currentSort = 'count';

// ── Fetch ──────────────────────────────────────────

async function fetchAllSessions() {
  const map = {}; // { raterId: { count, lastActive, occ, min, combined } }
  let lastTimestamp = null;

  while (true) {
    const query = {
      structuredQuery: {
        from: [{ collectionId: 'agricola_sessions' }],
        select: { fields: [
          { fieldPath: 'raterId' },
          { fieldPath: 'timestamp' },
          { fieldPath: 'draftMode' },
        ]},
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

    for (const d of docs) {
      const f    = d.document.fields || {};
      const id   = f.raterId?.stringValue;
      if (!id) continue;
      const ts   = f.timestamp?.stringValue || '';
      const mode = f.draftMode?.stringValue || 'separate';

      if (!map[id]) map[id] = { id, count: 0, lastActive: '', occ: 0, min: 0, combined: 0 };
      map[id].count++;
      if (ts > map[id].lastActive) map[id].lastActive = ts;
      if      (mode === 'occ')      map[id].occ++;
      else if (mode === 'min')      map[id].min++;
      else if (mode === 'combined') map[id].combined++;
      else                          map[id].occ++;  // legacy 'separate' treated as occ
    }

    if (docs.length < 300) break;
    lastTimestamp = docs[docs.length - 1].document.fields?.timestamp?.stringValue;
    if (!lastTimestamp) break;
  }

  return Object.values(map);
}

// ── Sort & Render ──────────────────────────────────

function sortRaters(arr, by) {
  return [...arr].sort((a, b) => {
    if (by === 'lastActive') return b.lastActive.localeCompare(a.lastActive);
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
      <td class="rater-mode">${r.min || '—'}</td>
      <td class="rater-mode">${r.combined || '—'}</td>
      <td><a href="profile.html?rater=${encodeURIComponent(r.id)}" class="rater-link-btn">查看分析 →</a></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderSummary() {
  const total = ratersData.reduce((s, r) => s + r.count, 0);
  document.getElementById('ratersSummary').textContent =
    `共 ${ratersData.length} 位評分者　總場次 ${total}`;
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

  try {
    document.getElementById('ratersLoadingMsg').textContent = '載入評分紀錄…';
    ratersData = await fetchAllSessions();

    document.getElementById('ratersLoading').style.display = 'none';
    document.getElementById('ratersContent').style.display = '';

    renderSummary();
    renderTable();

    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentSort = btn.dataset.sort;
        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTable();
      });
    });

  } catch (err) {
    document.getElementById('ratersLoadingMsg').textContent = `載入失敗：${err.message}`;
  }
}

document.addEventListener('DOMContentLoaded', init);
