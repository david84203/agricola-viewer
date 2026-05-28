/* ══════════════════════════════════════════════════
   農家樂 Admin — admin.js
   管理員功能：卡牌修正、禁卡表管理
   ══════════════════════════════════════════════════ */

const FIRESTORE_BASE_ADMIN = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';

// ── Card Overrides ─────────────────────────────────

async function loadCardOverrides() {
  try {
    const res  = await fetch(`${FIRESTORE_BASE_ADMIN}/card_overrides?pageSize=300`);
    const data = await res.json();
    const overrides = {};
    (data.documents || []).forEach(doc => {
      const cardId = doc.name.split('/').pop();
      const fields = {};
      Object.entries(doc.fields || {}).forEach(([k, v]) => {
        fields[k] = v.stringValue ?? String(v.integerValue ?? v.doubleValue ?? '');
      });
      overrides[decodeURIComponent(cardId)] = fields;
    });
    return overrides;
  } catch { return {}; }
}

function applyOverrides(cards, overrides) {
  return cards.map(card => {
    const ov = overrides[card['卡片ID']];
    return ov ? { ...card, ...ov } : card;
  });
}

async function saveCardOverride(cardId, fields) {
  const firestoreFields = {};
  Object.entries(fields).forEach(([k, v]) => {
    firestoreFields[k] = { stringValue: String(v) };
  });
  const body = JSON.stringify({ fields: firestoreFields });
  const id   = encodeURIComponent(cardId);
  const res  = await fetch(`${FIRESTORE_BASE_ADMIN}/card_overrides/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ── Card Edit Modal ────────────────────────────────

const EDITABLE_FIELDS_MINOR = [
  { key: '牌名',    label: '牌名' },
  { key: '說明',    label: '說明', multiline: true },
  { key: '先決條件', label: '先決條件' },
  { key: '費用',    label: '費用' },
  { key: '勝利點數', label: '勝利點數' },
  { key: '紅利分數', label: '紅利分數' },
  { key: '是否傳遞', label: '是否傳遞' },
];
const EDITABLE_FIELDS_OCC = [
  { key: '牌名',    label: '牌名' },
  { key: '說明',    label: '說明', multiline: true },
  { key: '人數',    label: '需求人數' },
  { key: '紅利分數', label: '紅利分數' },
];

function injectCardEditModal() {
  if (document.getElementById('cardEditModal')) return;
  const el = document.createElement('div');
  el.id = 'cardEditModal';
  el.className = 'admin-modal-overlay';
  el.style.display = 'none';
  el.innerHTML = `
    <div class="admin-modal">
      <div class="admin-modal-header">
        <div class="admin-modal-title" id="editModalTitle">編輯卡牌</div>
        <button class="admin-modal-close" id="editModalClose">✕</button>
      </div>
      <div class="admin-modal-body" id="editModalBody"></div>
      <div class="admin-modal-footer">
        <div class="admin-save-status" id="editSaveStatus"></div>
        <button class="admin-btn-cancel" id="editModalCancel">取消</button>
        <button class="admin-btn-save" id="editModalSave">儲存</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  const close = () => { el.style.display = 'none'; };
  document.getElementById('editModalClose').addEventListener('click', close);
  document.getElementById('editModalCancel').addEventListener('click', close);
  el.addEventListener('click', e => { if (e.target === el) close(); });
}

function openCardEditModal(card) {
  injectCardEditModal();
  document.getElementById('editModalTitle').textContent = `編輯：${card['牌名'] || card['卡片ID']}`;

  const fields = card.card_type === 'occupation' ? EDITABLE_FIELDS_OCC : EDITABLE_FIELDS_MINOR;
  const body   = document.getElementById('editModalBody');
  body.innerHTML = '';

  fields.forEach(({ key, label, multiline }) => {
    const val = card[key] || '';
    const row = document.createElement('div');
    row.className = 'admin-field-row';
    row.innerHTML = `
      <label class="admin-field-label">${label}</label>
      ${multiline
        ? `<textarea class="admin-input admin-textarea" data-key="${key}" rows="4">${val}</textarea>`
        : `<input type="text" class="admin-input" data-key="${key}" value="${val.replace(/"/g, '&quot;')}" />`
      }
    `;
    body.appendChild(row);
  });

  const statusEl = document.getElementById('editSaveStatus');
  statusEl.textContent = '';

  const saveBtn = document.getElementById('editModalSave');
  saveBtn.onclick = async () => {
    const changed = {};
    body.querySelectorAll('[data-key]').forEach(el => {
      const k = el.dataset.key;
      if (el.value !== (card[k] || '')) changed[k] = el.value;
    });

    if (Object.keys(changed).length === 0) {
      statusEl.textContent = '沒有修改';
      return;
    }

    saveBtn.disabled = true;
    statusEl.textContent = '儲存中…';
    try {
      await saveCardOverride(card['卡片ID'], changed);
      statusEl.style.color = '#4ade80';
      statusEl.textContent = '✓ 已儲存（重新整理頁面後生效）';
      // Update the card object in memory immediately
      Object.assign(card, changed);
    } catch (e) {
      statusEl.style.color = '#f87171';
      statusEl.textContent = '✗ 儲存失敗：' + e.message;
    }
    saveBtn.disabled = false;
  };

  document.getElementById('cardEditModal').style.display = 'flex';
}

// ── Ban List Admin ─────────────────────────────────

async function loadBanlistFromFirestore() {
  try {
    const res  = await fetch(`${FIRESTORE_BASE_ADMIN}/settings/banlist`);
    const doc  = await res.json();
    return (doc.fields?.groups?.arrayValue?.values || []).map(g => ({
      label: g.mapValue.fields.label.stringValue,
      ids:   (g.mapValue.fields.ids.arrayValue.values || []).map(v => v.stringValue),
    }));
  } catch { return null; }
}

async function saveBanlistToFirestore(groups) {
  const body = JSON.stringify({
    fields: {
      groups: {
        arrayValue: {
          values: groups.map(g => ({
            mapValue: { fields: {
              label: { stringValue: g.label },
              ids:   { arrayValue: { values: g.ids.map(s => ({ stringValue: s })) } },
            }}
          }))
        }
      }
    }
  });
  const res = await fetch(`${FIRESTORE_BASE_ADMIN}/settings/banlist`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ── Ban List Admin Panel ───────────────────────────

let adminBanGroups = null;
let adminAllCards  = null;

async function openBanAdmin(allCards) {
  adminAllCards = allCards;
  injectBanAdminPanel();
  document.getElementById('banAdminPanel').style.display = 'flex';

  const status = document.getElementById('banAdminStatus');
  status.textContent = '載入中…';
  adminBanGroups = await loadBanlistFromFirestore();
  if (!adminBanGroups) {
    status.textContent = '載入失敗';
    return;
  }
  status.textContent = '';
  renderBanAdminGroups();
}

function injectBanAdminPanel() {
  if (document.getElementById('banAdminPanel')) return;
  const el = document.createElement('div');
  el.id = 'banAdminPanel';
  el.className = 'admin-modal-overlay';
  el.style.display = 'none';
  el.innerHTML = `
    <div class="admin-modal admin-modal-wide">
      <div class="admin-modal-header">
        <div class="admin-modal-title">禁卡表管理</div>
        <button class="admin-modal-close" id="banAdminClose">✕</button>
      </div>
      <div class="admin-modal-body" id="banAdminBody">
        <div class="admin-save-status" id="banAdminStatus"></div>
      </div>
      <div class="admin-modal-footer">
        <div class="admin-save-status" id="banAdminSaveStatus"></div>
        <button class="admin-btn-cancel" id="banAdminCancel">關閉</button>
        <button class="admin-btn-save" id="banAdminSave">儲存變更</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  const close = () => { el.style.display = 'none'; };
  document.getElementById('banAdminClose').addEventListener('click', close);
  document.getElementById('banAdminCancel').addEventListener('click', close);
  el.addEventListener('click', e => { if (e.target === el) close(); });

  document.getElementById('banAdminSave').onclick = async () => {
    const btn = document.getElementById('banAdminSave');
    const st  = document.getElementById('banAdminSaveStatus');
    btn.disabled = true;
    st.textContent = '儲存中…';
    st.style.color = 'var(--text3)';
    try {
      await saveBanlistToFirestore(adminBanGroups);
      st.style.color = '#4ade80';
      st.textContent = '✓ 已儲存';
    } catch (e) {
      st.style.color = '#f87171';
      st.textContent = '✗ 失敗：' + e.message;
    }
    btn.disabled = false;
  };
}

function renderBanAdminGroups() {
  const body = document.getElementById('banAdminBody');
  body.innerHTML = '';

  adminBanGroups.forEach((group, gi) => {
    const section = document.createElement('div');
    section.className = 'ban-admin-group';

    const cards = group.ids.map(id => adminAllCards.find(c => c['卡片ID'] === id)).filter(Boolean);
    const missing = group.ids.filter(id => !adminAllCards.find(c => c['卡片ID'] === id));

    section.innerHTML = `
      <div class="ban-admin-group-header">
        <span class="ban-admin-group-label">${group.label}（${group.ids.length} 張）</span>
      </div>
      <div class="ban-admin-chips" data-gi="${gi}">
        ${group.ids.map(id => {
          const card = adminAllCards.find(c => c['卡片ID'] === id);
          return `<span class="ban-admin-chip" data-id="${id}" data-gi="${gi}">
            ${card ? card['牌名'] : id}
            <button class="ban-chip-remove" data-id="${id}" data-gi="${gi}">✕</button>
          </span>`;
        }).join('')}
      </div>
      <div class="ban-admin-add-row">
        <input type="text" class="admin-input ban-admin-search" data-gi="${gi}" placeholder="搜尋牌名新增…" autocomplete="off" />
        <div class="ban-admin-results" data-gi="${gi}" style="display:none"></div>
      </div>
    `;
    body.appendChild(section);
  });

  // Remove card buttons
  body.querySelectorAll('.ban-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const gi = +btn.dataset.gi;
      const id = btn.dataset.id;
      adminBanGroups[gi].ids = adminBanGroups[gi].ids.filter(x => x !== id);
      renderBanAdminGroups();
    });
  });

  // Search inputs
  body.querySelectorAll('.ban-admin-search').forEach(input => {
    const gi = +input.dataset.gi;
    const resultsEl = body.querySelector(`.ban-admin-results[data-gi="${gi}"]`);

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      resultsEl.innerHTML = '';
      if (!q) { resultsEl.style.display = 'none'; return; }

      const hits = adminAllCards
        .filter(c => (c['牌名'] || '').toLowerCase().includes(q) && !adminBanGroups[gi].ids.includes(c['卡片ID']))
        .slice(0, 8);

      if (!hits.length) { resultsEl.style.display = 'none'; return; }
      resultsEl.style.display = 'block';
      hits.forEach(card => {
        const item = document.createElement('div');
        item.className = 'ban-admin-result-item';
        item.textContent = `${card['牌名']}（${card['卡片ID']} · ${card['牌組']}）`;
        item.addEventListener('click', () => {
          adminBanGroups[gi].ids.push(card['卡片ID']);
          input.value = '';
          renderBanAdminGroups();
        });
        resultsEl.appendChild(item);
      });
    });

    input.addEventListener('blur', () => {
      setTimeout(() => { resultsEl.style.display = 'none'; }, 200);
    });
  });
}

// ── Expose ─────────────────────────────────────────
window.adminLoadOverrides  = loadCardOverrides;
window.adminApplyOverrides = applyOverrides;
window.openCardEditModal   = openCardEditModal;
window.openBanAdmin        = openBanAdmin;
window.loadBanlistFromFirestore = loadBanlistFromFirestore;
