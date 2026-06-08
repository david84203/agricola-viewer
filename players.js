/* ══════════════════════════════════════════════════
   農家樂 Players — players.js
   管理員後台：玩家帳號列表 + PIN 重設
   ══════════════════════════════════════════════════ */

const FIRESTORE_BASE_PLAYERS = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';

let playersData = []; // [{ id, createdAt, count, lastActive }]
let currentSort = 'count';
let playersLoaded = false;
let resetPinTargetId = null;

const PLAYERS_CACHE_KEY = 'agricola_players_cache';
const PLAYERS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ── Cache ──────────────────────────────────────────
function getCachedPlayers() {
  try {
    const s = JSON.parse(localStorage.getItem(PLAYERS_CACHE_KEY));
    if (s && Date.now() - s.cachedAt < PLAYERS_CACHE_TTL) return s.data;
  } catch {}
  return null;
}

function setCachedPlayers(data) {
  try {
    localStorage.setItem(PLAYERS_CACHE_KEY, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {}
}

// ── Fetch player accounts ──────────────────────────
async function fetchPlayerAccounts() {
  const players = [];
  let pageToken = null;

  do {
    const url = new URL(`${FIRESTORE_BASE_PLAYERS}/agricola_players`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url);
    const data = await res.json();
    (data.documents || []).forEach(doc => {
      players.push({
        id:        doc.name.split('/').pop(),
        createdAt: doc.fields?.createdAt?.stringValue || '',
      });
    });
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return players;
}

// ── Fetch session stats (count + last active) per ID ──
// Scans agricola_sessions once and aggregates by raterId — works for both raters and players.
async function fetchSessionStats() {
  const map = {};
  let lastTimestamp = null;

  while (true) {
    const query = {
      structuredQuery: {
        from: [{ collectionId: 'agricola_sessions' }],
        select: { fields: [
          { fieldPath: 'raterId' },
          { fieldPath: 'timestamp' },
        ]},
        orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'ASCENDING' }],
        limit: 300,
      }
    };
    if (lastTimestamp) {
      query.structuredQuery.startAt = { before: false, values: [{ stringValue: lastTimestamp }] };
    }

    const res = await fetch(`${FIRESTORE_BASE_PLAYERS}:runQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });
    const data = await res.json();
    const docs = (Array.isArray(data) ? data : []).filter(d => d.document);

    for (const d of docs) {
      const f  = d.document.fields || {};
      const id = f.raterId?.stringValue;
      if (!id) continue;
      const ts = f.timestamp?.stringValue || '';

      if (!map[id]) map[id] = { count: 0, lastActive: '' };
      map[id].count++;
      if (ts > map[id].lastActive) map[id].lastActive = ts;
    }

    if (docs.length < 300) break;
    lastTimestamp = docs[docs.length - 1].document.fields?.timestamp?.stringValue;
    if (!lastTimestamp) break;
  }

  return map;
}

async function fetchAllPlayers() {
  const cached = getCachedPlayers();
  if (cached) return cached;

  const [accounts, stats] = await Promise.all([fetchPlayerAccounts(), fetchSessionStats()]);
  const result = accounts.map(p => ({
    ...p,
    count:      stats[p.id]?.count ?? 0,
    lastActive: stats[p.id]?.lastActive || '',
  }));

  setCachedPlayers(result);
  return result;
}

// ── Sort & Render ──────────────────────────────────
function sortPlayers(arr, by) {
  return [...arr].sort((a, b) => {
    if (by === 'lastActive') return b.lastActive.localeCompare(a.lastActive);
    if (by === 'createdAt')  return b.createdAt.localeCompare(a.createdAt);
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
  const tbody = document.getElementById('playersTableBody');
  tbody.innerHTML = '';

  sortPlayers(playersData, currentSort).forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="rater-name">${p.id}</td>
      <td class="rater-count">${p.count}</td>
      <td class="rater-date">${formatDate(p.lastActive)}</td>
      <td class="rater-date">${formatDate(p.createdAt)}</td>
      <td><a href="profile.html?rater=${encodeURIComponent(p.id)}" class="rater-link-btn">查看分析 →</a></td>
      <td><button class="sort-btn reset-pin-btn" data-id="${p.id}">重設 PIN</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.reset-pin-btn').forEach(btn => {
    btn.addEventListener('click', () => openResetPinModal(btn.dataset.id));
  });
}

function renderSummary() {
  const total = playersData.reduce((s, p) => s + p.count, 0);
  document.getElementById('playersSummary').textContent =
    `共 ${playersData.length} 位玩家　總場次 ${total}`;
}

// ── Reset PIN Modal ────────────────────────────────
function openResetPinModal(id) {
  resetPinTargetId = id;
  document.getElementById('resetPinTargetId').textContent = id;
  document.getElementById('resetPinInput').value = '';
  document.getElementById('resetPinError').textContent = '';
  document.getElementById('resetPinModal').style.display = 'flex';
  document.getElementById('resetPinInput').focus();
}

function closeResetPinModal() {
  document.getElementById('resetPinModal').style.display = 'none';
  resetPinTargetId = null;
}

async function submitResetPin() {
  const newPin = document.getElementById('resetPinInput').value;
  const btn    = document.getElementById('resetPinSubmit');
  const err    = document.getElementById('resetPinError');

  if (!newPin) { err.textContent = '請輸入新 PIN'; return; }
  if (!resetPinTargetId) return;

  btn.disabled = true;
  btn.textContent = '處理中…';
  err.textContent = '';

  try {
    const pinHash = await hashPin(newPin);
    const url = `${FIRESTORE_BASE_PLAYERS}/agricola_players/${encodeURIComponent(resetPinTargetId)}?updateMask.fieldPaths=pinHash`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { pinHash: { stringValue: pinHash } } }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    closeResetPinModal();
    alert(`已將「${resetPinTargetId}」的 PIN 重設為新密碼，請告知玩家本人。`);
  } catch (e) {
    err.textContent = `重設失敗：${e.message}`;
  }

  btn.disabled = false;
  btn.textContent = '確認重設';
}

function bindResetPinModal() {
  document.getElementById('resetPinCancel').addEventListener('click', closeResetPinModal);
  document.getElementById('resetPinSubmit').addEventListener('click', submitResetPin);
  document.getElementById('resetPinModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeResetPinModal();
  });
  document.getElementById('resetPinInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitResetPin();
  });
}

// ── Load content (after auth confirmed) ────────────
async function loadPlayersContent() {
  if (playersLoaded) return;
  playersLoaded = true;

  document.getElementById('playersAuthRequired').style.display = 'none';
  document.getElementById('playersLoading').style.display = '';

  try {
    document.getElementById('playersLoadingMsg').textContent = '載入玩家帳號…';
    playersData = await fetchAllPlayers();

    document.getElementById('playersLoading').style.display = 'none';
    document.getElementById('playersContent').style.display = '';

    renderSummary();
    renderTable();

    document.querySelectorAll('.raters-sort .sort-btn[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentSort = btn.dataset.sort;
        document.querySelectorAll('.raters-sort .sort-btn[data-sort]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTable();
      });
    });

    document.getElementById('refreshPlayersBtn').addEventListener('click', async () => {
      localStorage.removeItem(PLAYERS_CACHE_KEY);
      playersLoaded = false;
      document.getElementById('playersContent').style.display = 'none';
      document.getElementById('playersLoading').style.display = '';
      await loadPlayersContent();
    });

  } catch (err) {
    document.getElementById('playersLoadingMsg').textContent = `載入失敗：${err.message}`;
  }
}

// ── Auth callback (login after page load) ──────────
function onAuthChange() {
  if (playersLoaded) return;
  if (typeof isAdmin === 'function' && isAdmin()) loadPlayersContent();
}

// ── Init ───────────────────────────────────────────
async function init() {
  await new Promise(r => {
    if (document.readyState === 'complete') { r(); return; }
    window.addEventListener('load', r);
  });

  bindResetPinModal();

  const auth = typeof getAuth === 'function' ? getAuth() : null;

  if (!auth || !isAdmin()) {
    document.getElementById('playersLoading').style.display = 'none';
    document.getElementById('playersAuthRequired').style.display = '';
    document.getElementById('playersLoginBtn').addEventListener('click', openLoginModal);
    return;
  }

  loadPlayersContent();
}

document.addEventListener('DOMContentLoaded', init);
