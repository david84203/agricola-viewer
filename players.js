/* ══════════════════════════════════════════════════
   農家樂 Players — players.js
   管理員後台：玩家帳號列表 + PIN 重設
   ══════════════════════════════════════════════════ */

const FIRESTORE_BASE_PLAYERS = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';

// 專屬通道門檻：累積輪抽場次達此數即列入邀請名單（僅後台可見，公開頁面不提示）
const KEY_THRESHOLD = 100;

let playersData = []; // [{ id, createdAt, count, lastActive, keyInvited, keyInvitedAt }]
let currentSort = 'count';
let playersLoaded = false;
let resetPinTargetId = null;
let noticeTargetId = null;

const PLAYERS_CACHE_KEY = 'agricola_players_cache_v2'; // v2：新增 keyInvited 欄位，舊快取自動失效
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
        id:           doc.name.split('/').pop(),
        createdAt:    doc.fields?.createdAt?.stringValue || '',
        keyInvited:   doc.fields?.keyInvited?.booleanValue === true,
        keyInvitedAt: doc.fields?.keyInvitedAt?.stringValue || '',
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

// ── Fetch 站內通知（管理員留給玩家的訊息）──────────
async function fetchNotices() {
  const map = {};
  let pageToken = null;

  do {
    const url = new URL(`${FIRESTORE_BASE_PLAYERS}/agricola_notices`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    (data.documents || []).forEach(doc => {
      const f = doc.fields || {};
      map[doc.name.split('/').pop()] = {
        text:      f.text?.stringValue || '',
        createdAt: f.createdAt?.stringValue || '',
        readAt:    f.readAt?.stringValue || '',
      };
    });
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return map;
}

async function fetchAllPlayers() {
  const cached = getCachedPlayers();
  if (cached) return cached;

  const [accounts, stats, notices] = await Promise.all([
    fetchPlayerAccounts(), fetchSessionStats(), fetchNotices(),
  ]);
  const result = accounts.map(p => ({
    ...p,
    count:        stats[p.id]?.count ?? 0,
    lastActive:   stats[p.id]?.lastActive || '',
    noticeText:   notices[p.id]?.text || '',
    noticeAt:     notices[p.id]?.createdAt || '',
    noticeReadAt: notices[p.id]?.readAt || '',
  }));

  setCachedPlayers(result);
  return result;
}

// ── Sort & Render ──────────────────────────────────
function sortPlayers(arr, by) {
  return [...arr].sort((a, b) => {
    if (by === 'lastActive') return b.lastActive.localeCompare(a.lastActive);
    if (by === 'createdAt')  return b.createdAt.localeCompare(a.createdAt);
    if (by === 'key') {
      // 待邀請 → 已邀請 → 未達標，各組內再依場次由多到少
      const rank = p => (p.count >= KEY_THRESHOLD ? (p.keyInvited ? 1 : 0) : 2);
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
    }
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

// ── 專屬通道欄 ─────────────────────────────────────
function keyCellHtml(p) {
  if (p.count < KEY_THRESHOLD) {
    return `<span class="key-progress">${p.count}/${KEY_THRESHOLD}</span>`;
  }
  const state = p.keyInvited
    ? `<span class="key-done">✓ 已邀請 <span class="key-when">${formatDate(p.keyInvitedAt)}</span></span>`
    : `<span class="key-ready">🔑 待邀請</span>`;

  // 站內通知狀態
  let notice = '';
  if (p.noticeText) {
    notice = p.noticeReadAt
      ? `<span class="key-done">📬 已讀 <span class="key-when">${formatDate(p.noticeReadAt)}</span></span>`
      : `<span class="key-when">📩 已留言，未讀</span>`;
  }

  const btns =
    `<button class="sort-btn key-notice-btn" data-id="${p.id}">${p.noticeText ? '重新留言' : '✉ 留言'}</button>` +
    `<button class="sort-btn key-invite-btn" data-id="${p.id}">${p.keyInvited ? '取消標記' : '標記已邀請'}</button>`;

  return `<div class="key-cell">${state}${notice}${btns}</div>`;
}

function renderTable() {
  const tbody = document.getElementById('playersTableBody');
  tbody.innerHTML = '';

  sortPlayers(playersData, currentSort).forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="rater-name">${p.id}</td>
      <td class="rater-count">${p.count}</td>
      <td>${keyCellHtml(p)}</td>
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
  tbody.querySelectorAll('.key-invite-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleKeyInvited(btn.dataset.id, btn));
  });
  tbody.querySelectorAll('.key-notice-btn').forEach(btn => {
    btn.addEventListener('click', () => openNoticeModal(btn.dataset.id));
  });
}

function renderSummary() {
  const total   = playersData.reduce((s, p) => s + p.count, 0);
  const reached = playersData.filter(p => p.count >= KEY_THRESHOLD);
  const pending = reached.filter(p => !p.keyInvited).length;
  document.getElementById('playersSummary').textContent =
    `共 ${playersData.length} 位玩家　總場次 ${total}　｜　達 ${KEY_THRESHOLD} 場 ${reached.length} 位（待邀請 ${pending} 位）`;
}

// ── 標記／取消「已邀請」──────────────────────────
async function setKeyInvited(id, next) {
  const p = playersData.find(x => x.id === id);
  if (!p) return;

  const nextAt = next ? new Date().toISOString() : '';
  const url = `${FIRESTORE_BASE_PLAYERS}/agricola_players/${encodeURIComponent(id)}`
    + `?updateMask.fieldPaths=keyInvited&updateMask.fieldPaths=keyInvitedAt`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: {
      keyInvited:   { booleanValue: next },
      keyInvitedAt: { stringValue: nextAt },
    }}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  p.keyInvited   = next;
  p.keyInvitedAt = nextAt;
}

async function toggleKeyInvited(id, btn) {
  const p = playersData.find(x => x.id === id);
  if (!p) return;

  const oldTxt = btn.textContent;
  btn.disabled = true;
  btn.textContent = '處理中…';

  try {
    await setKeyInvited(id, !p.keyInvited);
    setCachedPlayers(playersData);
    renderSummary();
    renderTable();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = oldTxt;
    alert(`標記失敗：${e.message}`);
  }
}

// ── 站內通知：留言給玩家 ────────────────────────────
// ⚠ Firestore 規則全開，agricola_notices 任何人都讀得到 → 訊息不得含網址或密碼
const NOTICE_FORBIDDEN = /(https?:\/\/|www\.|\.com|\.tw|\.app|harvestable|vercel)/i;

function noticeTemplate(id) {
  return `Hi ${id}，\n`
    + `你的輪抽模擬場次已經破 ${KEY_THRESHOLD} 場了，這在所有玩家裡非常少見 👏\n\n`
    + `有個東西想私下給你，方便的話來找我聊聊：\n`
    + `LINE 官方帳號 @160qiryn\n\n`
    + `—— 站長`;
}

function openNoticeModal(id) {
  noticeTargetId = id;
  const p = playersData.find(x => x.id === id);
  document.getElementById('noticeTargetId').textContent = id;
  document.getElementById('noticeInput').value = p?.noticeText || noticeTemplate(id);
  document.getElementById('noticeError').textContent = '';
  document.getElementById('noticeModal').style.display = 'flex';
  document.getElementById('noticeInput').focus();
}

function closeNoticeModal() {
  document.getElementById('noticeModal').style.display = 'none';
  noticeTargetId = null;
}

async function submitNotice() {
  const text = document.getElementById('noticeInput').value.trim();
  const btn  = document.getElementById('noticeSubmit');
  const err  = document.getElementById('noticeError');

  if (!text) { err.textContent = '請輸入訊息內容'; return; }
  if (NOTICE_FORBIDDEN.test(text)) {
    err.textContent = '訊息裡不能放網址或站名——這個集合任何人都讀得到。請只留「來找我」和你的聯絡方式。';
    return;
  }
  if (!noticeTargetId) return;

  const id = noticeTargetId;
  btn.disabled = true;
  btn.textContent = '送出中…';
  err.textContent = '';

  try {
    const now = new Date().toISOString();
    const res = await fetch(`${FIRESTORE_BASE_PLAYERS}/agricola_notices/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: {
        text:      { stringValue: text },
        createdAt: { stringValue: now },
        readAt:    { stringValue: '' }, // 重新留言 → 重設未讀
      }}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const p = playersData.find(x => x.id === id);
    if (p) { p.noticeText = text; p.noticeAt = now; p.noticeReadAt = ''; }

    // 留言即視為已送出邀請
    try { await setKeyInvited(id, true); } catch {}

    setCachedPlayers(playersData);
    closeNoticeModal();
    renderSummary();
    renderTable();
  } catch (e) {
    err.textContent = `送出失敗：${e.message}`;
  }

  btn.disabled = false;
  btn.textContent = '送出留言';
}

function bindNoticeModal() {
  document.getElementById('noticeCancel').addEventListener('click', closeNoticeModal);
  document.getElementById('noticeSubmit').addEventListener('click', submitNotice);
  document.getElementById('noticeModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeNoticeModal();
  });
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
  bindNoticeModal();

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
