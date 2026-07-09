/* ══════════════════════════════════════════════════
   農家樂 卡牌「功能實作狀態」— impl-status.js
   私有 tag：追蹤哪些牌還要加 code 進 agricola-online。
   僅 isImplStatusViewer()（小路 GM／YOYO）可見可改，
   其餘使用者一律不注入任何 DOM（不是 CSS 藏）。

   資料：Firestore 單一文件 settings/card_impl_status
   { [卡片ID]: 1|2|4 }；狀態 3（沒做，多數卡）不存欄位。
   ══════════════════════════════════════════════════ */

const IMPL_STATUS_DOC_URL   = `${FIRESTORE_BASE_ADMIN}/settings/card_impl_status`;
const IMPL_STATUS_CACHE_KEY = 'agricola_impl_status_cache_v1';
const IMPL_STATUS_CACHE_TTL = 10 * 60 * 1000; // 10 分鐘

const IMPL_STATUS_LABELS = {
  1: { cls: 'tag-impl-1', text: '功能未完' },
  2: { cls: 'tag-impl-2', text: '功能完成' },
  4: { cls: 'tag-impl-4', text: '無法做' },
};

let implStatusMap = null;      // 卡片ID → 1|2|4（只含非預設值）
let implStatusLoading = null;  // 載入中的 Promise，避免重複抓

// Firestore updateMask 的 field path：非簡單識別字（含中文/連字號/數字開頭）需 backtick 包住
function quoteImplFieldPath(cardId) {
  return '`' + String(cardId).replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`';
}

function getImplStatusCache() {
  try {
    const s = JSON.parse(localStorage.getItem(IMPL_STATUS_CACHE_KEY));
    if (s && Date.now() - s.cachedAt < IMPL_STATUS_CACHE_TTL) return s.data;
  } catch {}
  return null;
}

function setImplStatusCache(map) {
  try { localStorage.setItem(IMPL_STATUS_CACHE_KEY, JSON.stringify({ data: map, cachedAt: Date.now() })); } catch {}
}

async function fetchImplStatusMap() {
  const cached = getImplStatusCache();
  if (cached) return cached;
  try {
    const res = await fetch(IMPL_STATUS_DOC_URL);
    if (!res.ok) return {};
    const doc = await res.json();
    const map = {};
    Object.entries(doc.fields || {}).forEach(([cardId, v]) => {
      const n = Number(v.integerValue ?? v.doubleValue ?? NaN);
      if (n === 1 || n === 2 || n === 4) map[cardId] = n;
    });
    setImplStatusCache(map);
    return map;
  } catch { return {}; }
}

// 確保 implStatusMap 已載入（重複呼叫共用同一個 in-flight promise）
async function ensureImplStatus() {
  if (implStatusMap) return implStatusMap;
  if (!implStatusLoading) {
    implStatusLoading = fetchImplStatusMap().then(m => {
      implStatusMap = m || {};
      implStatusLoading = null;
      return implStatusMap;
    });
  }
  return implStatusLoading;
}

function getImplStatus(cardId) {
  return (implStatusMap && implStatusMap[cardId]) || 3;
}

// 寫入單一卡片狀態；status===3（預設）＝刪除該欄位。
// 用 updateMask.fieldPaths 只動這一欄，避免 GM／YOYO 同時編輯互蓋。
async function setImplStatus(cardId, status) {
  const fieldPath = quoteImplFieldPath(cardId);
  const url = `${IMPL_STATUS_DOC_URL}?updateMask.fieldPaths=${encodeURIComponent(fieldPath)}`;
  const fields = status === 3 ? {} : { [cardId]: { integerValue: String(status) } };
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  implStatusMap = implStatusMap || {};
  if (status === 3) delete implStatusMap[cardId];
  else implStatusMap[cardId] = status;
  setImplStatusCache(implStatusMap);
}

// ── 卡片格徽章（白名單才渲染；狀態 3 不顯示徽章）───────────
function renderImplStatusBadge(card, el) {
  const viewer = typeof isImplStatusViewer === 'function' && isImplStatusViewer();
  let badge = el.querySelector('.tag-impl-status');
  if (!viewer) { if (badge) badge.remove(); return; }

  const status = getImplStatus(card['卡片ID']);
  const info = IMPL_STATUS_LABELS[status];
  if (!info) { if (badge) badge.remove(); return; }

  if (!badge) {
    let tagsWrap = el.querySelector('.card-tags');
    if (!tagsWrap) {
      tagsWrap = document.createElement('div');
      tagsWrap.className = 'card-tags';
      el.querySelector('.card-body').appendChild(tagsWrap);
    }
    badge = document.createElement('span');
    tagsWrap.appendChild(badge);
  }
  badge.className = `tag tag-impl-status ${info.cls}`;
  badge.textContent = info.text;
}

function refreshAllImplStatusBadges() {
  if (typeof cardElMap === 'undefined') return;
  cardElMap.forEach(({ el, card }) => renderImplStatusBadge(card, el));
}

// ── 篩選器（白名單才注入；非白名單一律不存在於 DOM）────────
function renderImplStatusFilterControl() {
  const viewer = typeof isImplStatusViewer === 'function' && isImplStatusViewer();
  let wrap = document.getElementById('implStatusFilterWrap');

  if (!viewer) {
    if (wrap) wrap.remove();
    if (typeof activeImplStatus !== 'undefined') activeImplStatus = 'all';
    return;
  }
  if (wrap) return; // 已存在

  const filterBar = document.querySelector('.filter-bar');
  if (!filterBar) return;

  wrap = document.createElement('div');
  wrap.className = 'deck-filter';
  wrap.id = 'implStatusFilterWrap';
  wrap.innerHTML = `
    <label for="implStatusSelect">功能狀態</label>
    <select id="implStatusSelect">
      <option value="all">全部</option>
      <option value="1">1 部分完成</option>
      <option value="2">2 完成</option>
      <option value="3">3 未做</option>
      <option value="4">4 無法做</option>
    </select>
  `;
  filterBar.appendChild(wrap);

  document.getElementById('implStatusSelect').addEventListener('change', e => {
    window.activeImplStatus = e.target.value;
    if (typeof applyFilters === 'function') applyFilters();
  });
}

// ── Modal 編輯控制（白名單才注入；否則移除既有節點）─────────
function renderImplStatusEditor(card) {
  const viewer = typeof isImplStatusViewer === 'function' && isImplStatusViewer();
  let editor = document.getElementById('implStatusEditor');

  if (!viewer) {
    if (editor) editor.remove();
    return;
  }

  const modalInfo = document.querySelector('.modal-info');
  if (!modalInfo) return;

  if (!editor) {
    editor = document.createElement('div');
    editor.id = 'implStatusEditor';
    editor.className = 'impl-status-editor';
    editor.innerHTML = `
      <div class="impl-status-label">功能實作狀態（GM／YOYO 專用）</div>
      <div class="impl-status-btns">
        <button type="button" class="impl-status-btn impl-status-btn-1" data-status="1">1 部分完成</button>
        <button type="button" class="impl-status-btn impl-status-btn-2" data-status="2">2 完成</button>
        <button type="button" class="impl-status-btn impl-status-btn-3" data-status="3">3 未做</button>
        <button type="button" class="impl-status-btn impl-status-btn-4" data-status="4">4 無法做</button>
      </div>
      <div class="impl-status-save-status" id="implStatusSaveStatus"></div>
    `;
    modalInfo.appendChild(editor);
  }

  const statusEl = editor.querySelector('#implStatusSaveStatus');
  statusEl.textContent = '';

  const current = getImplStatus(card['卡片ID']);
  editor.querySelectorAll('.impl-status-btn').forEach(btn => {
    const st = Number(btn.dataset.status);
    btn.classList.toggle('active', st === current);
    btn.disabled = false;
    btn.onclick = async () => {
      editor.querySelectorAll('.impl-status-btn').forEach(b => b.disabled = true);
      statusEl.style.color = 'var(--text3)';
      statusEl.textContent = '儲存中…';
      try {
        await setImplStatus(card['卡片ID'], st);
        editor.querySelectorAll('.impl-status-btn').forEach(b => b.classList.toggle('active', b === btn));
        statusEl.style.color = '#4ade80';
        statusEl.textContent = '✓ 已儲存';
        refreshAllImplStatusBadges();
        if (typeof applyFilters === 'function') applyFilters();
      } catch (e) {
        statusEl.style.color = '#f87171';
        statusEl.textContent = '✗ 儲存失敗：' + e.message;
      }
      editor.querySelectorAll('.impl-status-btn').forEach(b => b.disabled = false);
    };
  });
}
