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

// ── Quick Action Helpers ───────────────────────────

let _editAllCards = [];

function getAdminCardRef(card) {
  return [card?.['卡片ID'] || '', card?.source_image || '', card?.position ?? ''].join('|');
}

async function removeCardFromBanlist(card, statusEl) {
  const setStatus = (text, color) => { if (statusEl) { statusEl.textContent = text; statusEl.style.color = color || 'var(--text3)'; } };
  setStatus('處理中…');
  try {
    const groups = await loadBanlistFromFirestore() || [];
    let removed = false;
    groups.forEach(g => {
      const idx = g.ids.indexOf(card['卡片ID']);
      if (idx !== -1) { g.ids.splice(idx, 1); removed = true; }
    });
    if (!removed) { setStatus('✗ 此牌不在禁卡表中', '#f87171'); return; }
    await saveBanlistToFirestore(groups.filter(g => g.ids.length > 0));
    setStatus('✓ 已移除禁卡', '#4ade80');
  } catch (e) {
    setStatus('✗ 失敗：' + e.message, '#f87171');
  }
}

async function addCardToBanlist(card, reason, statusEl) {
  const isOcc = card.card_type === 'occupation';
  const groupLabel = reason === '擾亂戰局' ? '擾亂戰局'
    : reason === '過強' ? (isOcc ? '過強職業卡' : '過強次要發展卡')
    : reason === '過爛' ? (isOcc ? '過爛職業卡' : '過爛次要發展卡')
    : (isOcc ? `${reason}職業` : `${reason}次要發展卡`);
  const setStatus = (text, color) => { if (statusEl) { statusEl.textContent = text; statusEl.style.color = color || 'var(--text3)'; } };
  setStatus('處理中…');
  try {
    const groups = await loadBanlistFromFirestore() || [];
    const existing = groups.find(g => g.ids.includes(card['卡片ID']));
    if (existing) {
      setStatus(`✗ 已在「${existing.label}」中`, '#f87171');
      return;
    }
    let group = groups.find(g => g.label === groupLabel);
    if (!group) { group = { label: groupLabel, ids: [] }; groups.push(group); }
    group.ids.push(card['卡片ID']);
    await saveBanlistToFirestore(groups);
    setStatus(`✓ 已加入「${groupLabel}」`, '#4ade80');
  } catch (e) {
    setStatus('✗ 失敗：' + e.message, '#f87171');
  }
}

async function addDuplicatePair(cardA, cardB, statusEl) {
  const LS_DUP_KEY = 'agricola_dups';
  const FS_DUP_DOC = `${FIRESTORE_BASE_ADMIN}/agricola_dup_state/main`;
  const setStatus = (text, color) => { if (statusEl) { statusEl.textContent = text; statusEl.style.color = color || 'var(--text3)'; } };
  setStatus('處理中…');
  try {
    // 從 Firestore 載入最新狀態
    let state = { picked: {}, dismissed: [], custom: [] };
    const res = await fetch(FS_DUP_DOC);
    if (!res.ok) throw new Error(`載入失敗 HTTP ${res.status}`);
    const data = await res.json();
    if (!data.fields) throw new Error('載入失敗，請稍後再試');
    const json = data.fields?.stateJson?.stringValue;
    if (json) state = { ...state, ...JSON.parse(json) };

    const refA = getAdminCardRef(cardA);
    const refB = getAdminCardRef(cardB);
    const allPairs = [...(window._dupBasePairs || []), ...(state.custom || [])];
    if (allPairs.find(p =>
      (p.cards.includes(refA) && p.cards.includes(refB))
      || (p.cards.includes(cardA['卡片ID']) && p.cards.includes(cardB['卡片ID']))
    )) {
      setStatus('✗ 這兩張牌已有重複配對', '#f87171');
      return;
    }

    state.custom = [...(state.custom || []), {
      id: 'c' + Date.now(),
      label: `${cardA['牌名']}／${cardB['牌名']}`,
      cards: [refA, refB],
      defaultCanonical: refA,
      type: 'custom',
    }];

    // 同步儲存至 Firestore 和 localStorage
    const saveRes = await fetch(`${FS_DUP_DOC}?updateMask.fieldPaths=stateJson`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { stateJson: { stringValue: JSON.stringify(state) } } }),
    });
    if (!saveRes.ok) throw new Error(`HTTP ${saveRes.status}`);
    localStorage.setItem(LS_DUP_KEY, JSON.stringify(state));
    setStatus('✓ 已新增並同步至雲端', '#4ade80');
  } catch (e) {
    setStatus('✗ 失敗：' + e.message, '#f87171');
  }
}

function renderBanSection(sec, card) {
  sec.innerHTML = `
    <div class="admin-qa-label">點擊原因直接加入禁卡：</div>
    <div class="admin-reason-row">
      <button class="admin-reason-btn" data-reason="過強">過強</button>
      <button class="admin-reason-btn" data-reason="過爛">過爛</button>
      <button class="admin-reason-btn" data-reason="擾亂戰局">擾亂戰局</button>
    </div>
    <div class="admin-qa-status"></div>
  `;
  const statusEl = sec.querySelector('.admin-qa-status');
  sec.querySelectorAll('.admin-reason-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      sec.querySelectorAll('.admin-reason-btn').forEach(b => b.disabled = true);
      await addCardToBanlist(card, btn.dataset.reason, statusEl);
      sec.querySelectorAll('.admin-reason-btn').forEach(b => b.disabled = false);
    });
  });
}

function renderDupSection(sec, card) {
  sec.innerHTML = `
    <div class="admin-qa-label">搜尋另一張相同的牌：</div>
    <div class="admin-dup-search-wrap">
      <input type="text" class="admin-input" id="qaDupSearch" placeholder="輸入牌名…" autocomplete="off" />
      <div id="qaDupResults" class="ban-admin-results" style="display:none"></div>
    </div>
    <div id="qaDupSelected" class="admin-qa-selected">（未選擇）</div>
    <div class="admin-qa-status" id="qaDupStatus"></div>
    <button class="admin-btn-save admin-qa-confirm" id="qaDupConfirm" disabled>確認標記重複</button>
  `;
  let selectedOther = null;
  const searchInput = document.getElementById('qaDupSearch');
  const resultsEl   = document.getElementById('qaDupResults');
  const selectedEl  = document.getElementById('qaDupSelected');
  const confirmBtn  = document.getElementById('qaDupConfirm');

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    resultsEl.innerHTML = '';
    if (!q) { resultsEl.style.display = 'none'; return; }
    const hits = _editAllCards
      .filter(c => getAdminCardRef(c) !== getAdminCardRef(card)
        && [c['牌名'], c['卡片ID'], c['牌組'], c.source_image].join(' ').toLowerCase().includes(q)
      )
      .slice(0, 12);
    if (!hits.length) { resultsEl.style.display = 'none'; return; }
    resultsEl.style.display = 'block';
    hits.forEach(c => {
      const item = document.createElement('div');
      item.className = 'ban-admin-result-item';
      item.textContent = `${c['牌名']}（${c['卡片ID']} · ${c['牌組']} · ${c.source_image || ''}）`;
      item.addEventListener('click', () => {
        selectedOther = c;
        selectedEl.textContent = `已選：${c['牌名']}（${c['卡片ID']}）`;
        selectedEl.style.color = 'var(--gold)';
        searchInput.value = '';
        resultsEl.style.display = 'none';
        confirmBtn.disabled = false;
      });
      resultsEl.appendChild(item);
    });
  });
  searchInput.addEventListener('blur', () => { setTimeout(() => { resultsEl.style.display = 'none'; }, 200); });
  confirmBtn.addEventListener('click', () => {
    if (selectedOther) addDuplicatePair(card, selectedOther, document.getElementById('qaDupStatus'));
  });
}

// ── Card Edit Modal ────────────────────────────────

const EDITABLE_FIELDS_MINOR = [
  { key: '牌名',    label: '牌名' },
  { key: '說明',    label: '說明', multiline: true },
  { key: '先決條件', label: '先決條件' },
  { key: '費用',    label: '費用', placeholder: '無' },
  { key: '勝利點數', label: '勝利點數', placeholder: '無' },
  { key: '紅利分數', label: '紅利分數', options: ['有', '無'] },
  { key: '是否傳遞', label: '是否傳遞', options: ['是', '否'] },
];
const EDITABLE_FIELDS_OCC = [
  { key: '牌名',    label: '牌名' },
  { key: '說明',    label: '說明', multiline: true },
  { key: '人數',    label: '需求人數' },
  { key: '紅利分數', label: '紅利分數', options: ['有', '無'] },
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

function openCardEditModal(card, allCardsRef) {
  _editAllCards = allCardsRef || _editAllCards;
  injectCardEditModal();
  document.getElementById('editModalTitle').textContent = `編輯：${card['牌名'] || card['卡片ID']}`;

  const fields = card.card_type === 'occupation' ? EDITABLE_FIELDS_OCC : EDITABLE_FIELDS_MINOR;
  const body   = document.getElementById('editModalBody');
  body.innerHTML = '';

  fields.forEach(({ key, label, multiline, options, placeholder }) => {
    const val = card[key] || '';
    const row = document.createElement('div');
    row.className = 'admin-field-row';
    let input;
    if (options) {
      const activeVal = val || options[options.length - 1];
      const btns = options.map(o =>
        `<button type="button" class="admin-option-btn${o === activeVal ? ' active' : ''}" data-val="${o}">${o}</button>`
      ).join('');
      input = `<div class="admin-option-group" data-key="${key}">${btns}</div>`;
    } else if (multiline) {
      input = `<textarea class="admin-input admin-textarea" data-key="${key}" rows="4">${val}</textarea>`;
    } else {
      const ph = placeholder ? ` placeholder="${placeholder}"` : '';
      input = `<input type="text" class="admin-input" data-key="${key}" value="${val.replace(/"/g, '&quot;')}"${ph} />`;
    }
    row.innerHTML = `<label class="admin-field-label">${label}</label>${input}`;
    body.appendChild(row);
    if (options) {
      row.querySelectorAll('.admin-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          row.querySelectorAll('.admin-option-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    }
  });

  // Quick actions
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'admin-quick-actions';
  actionsDiv.innerHTML = `
    <div class="admin-qa-divider"></div>
    <div class="admin-qa-title">快速操作</div>
    <div class="admin-qa-btns">
      <button class="admin-qa-btn" id="qaBanBtn">🚫 加入禁卡</button>
      <button class="admin-qa-btn admin-qa-btn-remove" id="qaUnbanBtn" style="display:none">✅ 移除禁卡</button>
      <button class="admin-qa-btn" id="qaDupBtn">🔁 標記重複</button>
      <button class="admin-qa-btn" id="qaBgaAddBtn">🎮 加入BGA</button>
      <button class="admin-qa-btn admin-qa-btn-remove" id="qaBgaRemoveBtn" style="display:none">🎮 移除BGA</button>
    </div>
    <div id="qaBanSection" class="admin-qa-section" style="display:none"></div>
    <div id="qaDupSection" class="admin-qa-section" style="display:none"></div>
  `;
  body.appendChild(actionsDiv);

  // 偵測是否已在禁卡表，動態顯示移除按鈕
  loadBanlistFromFirestore().then(groups => {
    const inBan = (groups || []).some(g => g.ids.includes(card['卡片ID']));
    document.getElementById('qaBanBtn').style.display = inBan ? 'none' : '';
    document.getElementById('qaUnbanBtn').style.display = inBan ? '' : 'none';
  });

  // BGA 按鈕：ABCDE 自動屬於 BGA，不需手動操作
  const isAutoBga = ['A','B','C','D','E'].includes(card['牌組']);
  if (isAutoBga) {
    document.getElementById('qaBgaAddBtn').style.display = 'none';
    document.getElementById('qaBgaRemoveBtn').style.display = 'none';
  } else {
    loadBgaFromFirestore().then(ids => {
      const inBga = ids.includes(card['卡片ID']);
      document.getElementById('qaBgaAddBtn').style.display = inBga ? 'none' : '';
      document.getElementById('qaBgaRemoveBtn').style.display = inBga ? '' : 'none';
    });
  }

  document.getElementById('qaUnbanBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('editSaveStatus');
    document.getElementById('qaUnbanBtn').disabled = true;
    await removeCardFromBanlist(card, statusEl);
    document.getElementById('qaUnbanBtn').disabled = false;
    // 移除後切換回加入按鈕
    document.getElementById('qaBanBtn').style.display = '';
    document.getElementById('qaUnbanBtn').style.display = 'none';
  });

  document.getElementById('qaBgaAddBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('editSaveStatus');
    document.getElementById('qaBgaAddBtn').disabled = true;
    await addCardToBga(card, statusEl);
    document.getElementById('qaBgaAddBtn').disabled = false;
    document.getElementById('qaBgaAddBtn').style.display = 'none';
    document.getElementById('qaBgaRemoveBtn').style.display = '';
  });

  document.getElementById('qaBgaRemoveBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('editSaveStatus');
    document.getElementById('qaBgaRemoveBtn').disabled = true;
    await removeCardFromBga(card, statusEl);
    document.getElementById('qaBgaRemoveBtn').disabled = false;
    document.getElementById('qaBgaRemoveBtn').style.display = 'none';
    document.getElementById('qaBgaAddBtn').style.display = '';
  });

  document.getElementById('qaBanBtn').addEventListener('click', () => {
    const sec = document.getElementById('qaBanSection');
    const open = sec.style.display !== 'none';
    document.getElementById('qaDupSection').style.display = 'none';
    sec.style.display = open ? 'none' : '';
    if (!open) renderBanSection(sec, card);
  });
  document.getElementById('qaDupBtn').addEventListener('click', () => {
    const sec = document.getElementById('qaDupSection');
    const open = sec.style.display !== 'none';
    document.getElementById('qaBanSection').style.display = 'none';
    sec.style.display = open ? 'none' : '';
    if (!open) renderDupSection(sec, card);
  });

  const statusEl = document.getElementById('editSaveStatus');
  statusEl.textContent = '';

  const saveBtn = document.getElementById('editModalSave');
  saveBtn.onclick = async () => {
    const changed = {};
    body.querySelectorAll('[data-key]').forEach(el => {
      const k = el.dataset.key;
      const v = el.classList.contains('admin-option-group')
        ? (el.querySelector('.admin-option-btn.active')?.dataset.val || '')
        : el.value;
      if (v !== (card[k] || '')) changed[k] = v;
    });

    if (Object.keys(changed).length === 0) {
      document.getElementById('cardEditModal').style.display = 'none';
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
    const res = await fetch(`${FIRESTORE_BASE_ADMIN}/settings/banlist`);
    const doc = await res.json();
    if (!doc.fields) return null; // 429 quota exceeded or other API error
    return (doc.fields.groups?.arrayValue?.values || []).map(g => ({
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
  const res = await fetch(`${FIRESTORE_BASE_ADMIN}/settings/banlist?updateMask.fieldPaths=groups`, {
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
      localStorage.removeItem('agricola_banlist_cache');
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

// ── BGA Admin ──────────────────────────────────────

async function loadBgaFromFirestore() {
  try {
    const res = await fetch(`${FIRESTORE_BASE_ADMIN}/settings/bga_cards`);
    const doc = await res.json();
    if (!doc.fields) return null; // 429 or other API error
    return (doc.fields.ids?.arrayValue?.values || []).map(v => v.stringValue).filter(Boolean);
  } catch { return null; }
}

async function saveBgaToFirestore(ids) {
  const body = JSON.stringify({
    fields: {
      ids: { arrayValue: { values: ids.map(s => ({ stringValue: s })) } }
    }
  });
  const res = await fetch(`${FIRESTORE_BASE_ADMIN}/settings/bga_cards?updateMask.fieldPaths=ids`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function addCardToBga(card, statusEl) {
  const setStatus = (text, color) => { if (statusEl) { statusEl.textContent = text; statusEl.style.color = color || 'var(--text3)'; } };
  setStatus('處理中…');
  try {
    const ids = await loadBgaFromFirestore();
    if (ids === null) { setStatus('✗ 載入失敗，請重試', '#f87171'); return; }
    if (ids.includes(card['卡片ID'])) { setStatus('✗ 已在 BGA 牌組中', '#f87171'); return; }
    ids.push(card['卡片ID']);
    await saveBgaToFirestore(ids);
    if (typeof bgaExtraIds !== 'undefined') bgaExtraIds.add(card['卡片ID']);
    setStatus('✓ 已加入 BGA 牌組', '#4ade80');
  } catch (e) {
    setStatus('✗ 失敗：' + e.message, '#f87171');
  }
}

async function removeCardFromBga(card, statusEl) {
  const setStatus = (text, color) => { if (statusEl) { statusEl.textContent = text; statusEl.style.color = color || 'var(--text3)'; } };
  setStatus('處理中…');
  try {
    const ids = await loadBgaFromFirestore();
    if (ids === null) { setStatus('✗ 載入失敗，請重試', '#f87171'); return; }
    if (!ids.includes(card['卡片ID'])) { setStatus('✗ 此牌不在 BGA 牌組中', '#f87171'); return; }
    const newIds = ids.filter(x => x !== card['卡片ID']);
    await saveBgaToFirestore(newIds);
    if (typeof bgaExtraIds !== 'undefined') bgaExtraIds.delete(card['卡片ID']);
    setStatus('✓ 已移除 BGA 牌組', '#4ade80');
  } catch (e) {
    setStatus('✗ 失敗：' + e.message, '#f87171');
  }
}

let adminBgaAllCards = null;

async function openBgaAdmin(allCards) {
  adminBgaAllCards = allCards;
  injectBgaAdminPanel();
  document.getElementById('bgaAdminPanel').style.display = 'flex';

  const status = document.getElementById('bgaAdminStatus');
  status.textContent = '載入中…';
  const ids = await loadBgaFromFirestore();
  if (ids === null) { status.textContent = '載入失敗'; return; }
  window._bgaAdminIds = [...ids];
  status.textContent = '';
  renderBgaAdminList();
}

function injectBgaAdminPanel() {
  if (document.getElementById('bgaAdminPanel')) return;
  const el = document.createElement('div');
  el.id = 'bgaAdminPanel';
  el.className = 'admin-modal-overlay';
  el.style.display = 'none';
  el.innerHTML = `
    <div class="admin-modal admin-modal-wide">
      <div class="admin-modal-header">
        <div class="admin-modal-title">BGA 牌組管理（手動標記）</div>
        <button class="admin-modal-close" id="bgaAdminClose">✕</button>
      </div>
      <div class="admin-modal-body" id="bgaAdminBody">
        <div class="admin-save-status" id="bgaAdminStatus"></div>
        <p style="font-size:.8rem;color:var(--text3);margin-bottom:12px;">
          ABCDE 牌組自動屬於 BGA，此處只管理其他牌組中需手動標記的卡牌。
        </p>
        <div id="bgaAdminChips" class="ban-admin-chips" style="flex-wrap:wrap;gap:8px;margin-bottom:14px;"></div>
        <div class="ban-admin-add-row" style="position:relative;">
          <input type="text" class="admin-input" id="bgaAdminSearch" placeholder="搜尋牌名新增…" autocomplete="off" />
          <div class="ban-admin-results" id="bgaAdminResults" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:10;"></div>
        </div>
      </div>
      <div class="admin-modal-footer">
        <div class="admin-save-status" id="bgaAdminSaveStatus"></div>
        <button class="admin-btn-cancel" id="bgaAdminCancel">關閉</button>
        <button class="admin-btn-save" id="bgaAdminSave">儲存變更</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  const close = () => { el.style.display = 'none'; };
  document.getElementById('bgaAdminClose').addEventListener('click', close);
  document.getElementById('bgaAdminCancel').addEventListener('click', close);
  el.addEventListener('click', e => { if (e.target === el) close(); });

  document.getElementById('bgaAdminSave').onclick = async () => {
    const btn = document.getElementById('bgaAdminSave');
    const st  = document.getElementById('bgaAdminSaveStatus');
    btn.disabled = true;
    st.textContent = '儲存中…';
    st.style.color = 'var(--text3)';
    try {
      await saveBgaToFirestore(window._bgaAdminIds || []);
      if (typeof bgaExtraIds !== 'undefined') {
        bgaExtraIds.clear();
        (window._bgaAdminIds || []).forEach(id => bgaExtraIds.add(id));
      }
      st.style.color = '#4ade80';
      st.textContent = '✓ 已儲存';
    } catch (e) {
      st.style.color = '#f87171';
      st.textContent = '✗ 失敗：' + e.message;
    }
    btn.disabled = false;
  };

  const searchInput  = document.getElementById('bgaAdminSearch');
  const resultsEl    = document.getElementById('bgaAdminResults');

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    resultsEl.innerHTML = '';
    if (!q) { resultsEl.style.display = 'none'; return; }
    const hits = (adminBgaAllCards || [])
      .filter(c => {
        const deck = c['牌組'] || '';
        if (['A','B','C','D','E'].includes(deck)) return false;
        return (c['牌名'] || '').toLowerCase().includes(q) && !(window._bgaAdminIds || []).includes(c['卡片ID']);
      })
      .slice(0, 8);
    if (!hits.length) { resultsEl.style.display = 'none'; return; }
    resultsEl.style.display = 'block';
    hits.forEach(card => {
      const item = document.createElement('div');
      item.className = 'ban-admin-result-item';
      item.textContent = `${card['牌名']}（${card['卡片ID']} · ${card['牌組']}）`;
      item.addEventListener('click', () => {
        window._bgaAdminIds = window._bgaAdminIds || [];
        window._bgaAdminIds.push(card['卡片ID']);
        searchInput.value = '';
        resultsEl.style.display = 'none';
        renderBgaAdminList();
      });
      resultsEl.appendChild(item);
    });
  });

  searchInput.addEventListener('blur', () => {
    setTimeout(() => { resultsEl.style.display = 'none'; }, 200);
  });
}

function renderBgaAdminList() {
  const chipsEl = document.getElementById('bgaAdminChips');
  if (!chipsEl) return;
  const ids = window._bgaAdminIds || [];
  chipsEl.innerHTML = ids.length === 0
    ? '<span style="color:var(--text3);font-size:.8rem;">尚無手動標記的 BGA 卡牌</span>'
    : ids.map(id => {
        const card = (adminBgaAllCards || []).find(c => c['卡片ID'] === id);
        const label = card ? `${card['牌名']}（${id} · ${card['牌組']}）` : id;
        return `<span class="ban-admin-chip" data-id="${id}">
          ${label}
          <button class="ban-chip-remove" data-id="${id}">✕</button>
        </span>`;
      }).join('');

  chipsEl.querySelectorAll('.ban-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      window._bgaAdminIds = (window._bgaAdminIds || []).filter(x => x !== btn.dataset.id);
      renderBgaAdminList();
    });
  });
}

// ── Expose ─────────────────────────────────────────
window.adminLoadOverrides  = loadCardOverrides;
window.adminApplyOverrides = applyOverrides;
window.openCardEditModal   = openCardEditModal;
window.openBanAdmin        = openBanAdmin;
window.openBgaAdmin        = openBgaAdmin;
window.loadBanlistFromFirestore = loadBanlistFromFirestore;
window.loadBgaFromFirestore     = loadBgaFromFirestore;
