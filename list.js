/* ══════════════════════════════════════════════════
   農家樂 Agricola Card List View — list.js
   ══════════════════════════════════════════════════ */

let allCards = [];
let filteredCards = [];
let activeType = 'all';
let activeDeck = 'all';
let searchQuery = '';

// ── Column definitions ─────────────────────────────
// key: unique key, label: header text, className: td class,
// hideFor: ['occupation'] | ['minor'] — auto-hide when that type is exclusively shown
// render: function(card) -> string
const COLUMNS = [
  {
    key: 'id',
    label: '卡片 ID',
    className: 'col-id',
    defaultOn: true,
    render: c => c['卡片ID'] || '—',
  },
  {
    key: 'name',
    label: '牌名',
    className: 'col-name',
    defaultOn: true,
    alwaysOn: true,
    render: c => c['牌名'] || '—',
  },
  {
    key: 'type',
    label: '類型',
    className: 'col-type',
    defaultOn: true,
    render: c => {
      if (c.card_type === 'both') {
        return `<span class="card-type-badge badge-both"><span class="badge-both-minor">次要及</span><span class="badge-both-occ">主要發展卡</span></span>`;
      }
      const map = { minor: '次要發展卡', occupation: '職業卡' };
      const cls = { minor: 'badge-minor', occupation: 'badge-occupation' };
      return `<span class="card-type-badge ${cls[c.card_type] || ''}">${map[c.card_type] || c.card_type}</span>`;
    },
  },
  {
    key: 'needs',
    label: '需求人數',
    className: 'col-needs',
    defaultOn: true,
    hideFor: ['minor', 'both'],   // auto-hide when NOT occupation
    render: c => (c['人數'] || c['需求人數']) ? `${c['人數'] || c['需求人數']} 人` : '—',
  },
  {
    key: 'pre',
    label: '先決條件',
    className: 'col-pre',
    defaultOn: true,
    hideFor: ['occupation'],      // auto-hide when occupation only
    render: c => c['先決條件'] || '—',
  },
  {
    key: 'cost',
    label: '費用',
    className: 'col-cost',
    defaultOn: true,
    hideFor: ['occupation'],      // auto-hide when occupation only
    render: c => c['費用'] || '—',
  },
  {
    key: 'pass',
    label: '是否傳遞',
    className: 'col-pass',
    defaultOn: true,
    render: c => {
      const v = c['是否傳遞'];
      if (!v || v === '—') return '<span class="val-no">—</span>';
      return v === '是'
        ? '<span class="val-yes">是</span>'
        : '<span class="val-no">否</span>';
    },
  },
  {
    key: 'vp',
    label: '勝利點數',
    className: 'col-vp',
    defaultOn: true,
    hideFor: ['occupation'],      // auto-hide when occupation only
    render: c => {
      const v = c['勝利點數'];
      if (!v || v === '無') return '<span class="val-no">無</span>';
      return `<span class="val-vp">${v}</span>`;
    },
  },
  {
    key: 'bonus',
    label: '紅利分數',
    className: 'col-bonus',
    defaultOn: true,
    render: c => {
      const v = c['紅利分數'];
      if (!v || v === '無') return '<span class="val-no">無</span>';
      return `<span class="val-bonus">${v}</span>`;
    },
  },
  {
    key: 'deck',
    label: '牌組',
    className: 'col-deck',
    defaultOn: true,
    render: c => c['牌組'] || '—',
  },
  {
    key: 'desc',
    label: '說明',
    className: 'col-desc',
    defaultOn: true,
    render: c => c['說明'] || '—',
  },
];

// Track which columns are active
const colState = {};
COLUMNS.forEach(col => {
  colState[col.key] = col.defaultOn !== false;
});

// ── Load Data ──────────────────────────────────────
async function loadCards() {
  const res = await fetch('./cards.json');
  allCards = await res.json();
  populateDeckFilter();
  document.getElementById('totalCount').textContent = allCards.length;
  buildColToggles();
  buildTableHead();
  applyFilters();
}

// ── Deck filter ────────────────────────────────────
function populateDeckFilter() {
  const decks = [...new Set(allCards.map(c => c['牌組'] || '').filter(Boolean))].sort();
  const sel = document.getElementById('deckSelect');
  decks.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = `${d} 牌組`;
    sel.appendChild(opt);
  });
}

// ── Column Toggles ─────────────────────────────────
function buildColToggles() {
  const wrap = document.getElementById('colToggles');
  COLUMNS.forEach(col => {
    if (col.alwaysOn) return;
    const label = document.createElement('label');
    label.dataset.key = col.key;
    label.className = `col-toggle ${colState[col.key] ? 'active' : ''}`;
    label.innerHTML = `
      <span class="col-toggle-dot"></span>
      ${col.label}
    `;
    label.addEventListener('click', () => {
      if (isAutoHidden(col)) return; // locked
      colState[col.key] = !colState[col.key];
      label.classList.toggle('active', colState[col.key]);
      updateColVisibility();
    });
    wrap.appendChild(label);
  });
}

// ── Table Head ─────────────────────────────────────
function buildTableHead() {
  const tr = document.querySelector('#tableHead tr');
  tr.innerHTML = '';
  COLUMNS.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label;
    th.dataset.colKey = col.key;
    if (!colState[col.key]) th.classList.add('col-hidden');
    tr.appendChild(th);
  });
}

// ── Determine if a column should be auto-hidden ────
// hideFor: ['occupation'] → hide when activeType is 'occupation'
// hideFor: ['minor','both'] → hide when activeType is 'minor' or 'both'
function isAutoHidden(col) {
  if (!col.hideFor) return false;
  // occupation-only filter
  if (activeType === 'occupation' && col.hideFor.includes('occupation')) return true;
  // minor/both-only filter (need = 需求人數 column)
  if (activeType !== 'all' && activeType !== 'occupation') {
    if (col.hideFor.includes('minor')) return true;
  }
  return false;
}

// ── Update column visibility ───────────────────────
function updateColVisibility() {
  COLUMNS.forEach(col => {
    const hidden = !colState[col.key] || isAutoHidden(col);
    // sync toggle button style (dim if auto-hidden)
    const toggleEl = document.querySelector(`.col-toggle[data-key="${col.key}"]`);
    if (toggleEl) {
      toggleEl.style.opacity = isAutoHidden(col) ? '0.35' : '1';
      toggleEl.style.pointerEvents = isAutoHidden(col) ? 'none' : '';
    }
    // header
    const th = document.querySelector(`th[data-col-key="${col.key}"]`);
    if (th) th.classList.toggle('col-hidden', hidden);
    // body cells
    document.querySelectorAll(`td[data-col-key="${col.key}"]`).forEach(td => {
      td.classList.toggle('col-hidden', hidden);
    });
  });
}

// ── Filters ────────────────────────────────────────
function applyFilters() {
  const q = searchQuery.toLowerCase();

  filteredCards = allCards.filter(c => {
    if (activeType !== 'all') {
      if (activeType === 'minor' && c.card_type !== 'minor' && c.card_type !== 'both') return false;
      if (activeType !== 'minor' && c.card_type !== activeType) return false;
    }
    if (activeDeck !== 'all' && c['牌組'] !== activeDeck) return false;
    if (q) {
      const haystack = [c['牌名'], c['卡片ID'], c['說明'], c['先決條件'], c['費用']].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  renderTable();
  document.getElementById('resultsInfo').textContent =
    filteredCards.length === allCards.length
      ? `共 ${allCards.length} 張卡牌`
      : `顯示 ${filteredCards.length} / ${allCards.length} 張`;
}

// ── Render Table ───────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (filteredCards.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${COLUMNS.length}" style="text-align:center; padding:60px 20px; color:var(--text3); font-size:1rem;">
          🌾 找不到符合條件的卡牌
        </td>
      </tr>`;
    return;
  }

  filteredCards.forEach(card => {
    const tr = document.createElement('tr');
    COLUMNS.forEach(col => {
      const td = document.createElement('td');
      td.className = col.className;
      td.dataset.colKey = col.key;
      td.innerHTML = col.render(card);
      if (!colState[col.key] || isAutoHidden(col)) td.classList.add('col-hidden');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// ── Event Listeners ────────────────────────────────
// Filter chips
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeType = chip.dataset.filter;
    applyFilters();
    updateColVisibility(); // re-evaluate auto-hidden cols
  });
});

document.getElementById('deckSelect').addEventListener('change', e => {
  activeDeck = e.target.value;
  applyFilters();
});

const searchInput = document.getElementById('searchInput');
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = searchInput.value.trim();
    applyFilters();
  }, 250);
});

document.getElementById('clearSearch').addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  applyFilters();
});

// ── Init ───────────────────────────────────────────
loadCards();
