/* ══════════════════════════════════════════════════
   BUG 回報頁面邏輯
   ══════════════════════════════════════════════════ */

const FIRESTORE_BUGS = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents/agricola_bugs';

// ── Auth Hook ──────────────────────────────────────
function onAuthChange() {
  const auth = getAuth();
  const unauthScreen = document.getElementById('unauthScreen');
  const authScreen = document.getElementById('authScreen');
  const reporterIdDisplay = document.getElementById('reporterIdDisplay');

  if (!auth) {
    unauthScreen.style.display = 'block';
    authScreen.style.display = 'none';
  } else {
    unauthScreen.style.display = 'none';
    authScreen.style.display = 'block';
    reporterIdDisplay.textContent = auth.id;
    
    // 每次登入成功後，重新載入列表
    fetchBugList();
  }
}

// ── Submit Bug ─────────────────────────────────────
document.getElementById('bugSubmitBtn').addEventListener('click', async () => {
  const auth = getAuth();
  if (!auth) return;

  const interfaceSelect = document.getElementById('bugInterfaceSelect').value;
  const descInput = document.getElementById('bugDescInput').value.trim();
  const errorEl = document.getElementById('bugFormError');
  const submitBtn = document.getElementById('bugSubmitBtn');

  if (!descInput) {
    errorEl.textContent = '請填寫 BUG 詳細內容';
    return;
  }

  errorEl.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = '送出中...';

  const docData = {
    fields: {
      reporterId: { stringValue: auth.id },
      interface: { stringValue: interfaceSelect },
      description: { stringValue: descInput },
      status: { stringValue: 'pending' },
      createdAt: { stringValue: new Date().toISOString() }
    }
  };

  try {
    const res = await fetch(FIRESTORE_BUGS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docData)
    });

    if (res.ok) {
      document.getElementById('bugDescInput').value = '';
      alert('回報成功！感謝您的協助。');
      fetchBugList();
    } else {
      errorEl.textContent = '送出失敗，請稍後再試。';
    }
  } catch (err) {
    errorEl.textContent = '網路錯誤，請檢查連線。';
  }

  submitBtn.disabled = false;
  submitBtn.textContent = '送出回報';
});

// ── Fetch and Render Bug List ──────────────────────
async function fetchBugList() {
  const container = document.getElementById('bugListContainer');
  container.innerHTML = '<div class="bug-loading">讀取資料中...</div>';

  try {
    const res = await fetch(FIRESTORE_BUGS);
    if (!res.ok) throw new Error('Fetch failed');
    const data = await res.json();
    
    const docs = data.documents || [];
    
    // 整理並過濾資料
    const bugs = [];
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    for (const doc of docs) {
      const fields = doc.fields;
      if (!fields) continue;

      const id = doc.name.split('/').pop();
      const status = fields.status?.stringValue || 'pending';
      const resolvedAtStr = fields.resolvedAt?.stringValue;
      
      // 自動刪除過期資料 (已處理且超過 7 天)
      if (status === 'resolved' && resolvedAtStr) {
        const resolvedTime = new Date(resolvedAtStr).getTime();
        if (now - resolvedTime > SEVEN_DAYS) {
          // 在背景非同步呼叫刪除，不等待它完成
          deleteBug(id);
          continue; // 不加入顯示清單
        }
      }

      bugs.push({
        id,
        reporterId: fields.reporterId?.stringValue || 'Unknown',
        interface: fields.interface?.stringValue || '其他',
        description: fields.description?.stringValue || '',
        status,
        createdAt: fields.createdAt?.stringValue || new Date().toISOString()
      });
    }

    // 依建立時間排序，新的在上面
    bugs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    renderBugList(bugs);

  } catch (err) {
    container.innerHTML = '<div class="bug-error">讀取失敗，請稍後再試。</div>';
  }
}

function renderBugList(bugs) {
  const container = document.getElementById('bugListContainer');
  container.innerHTML = '';

  if (bugs.length === 0) {
    container.innerHTML = '<div class="bug-empty">目前沒有任何回報紀錄。</div>';
    return;
  }

  bugs.forEach(bug => {
    const item = document.createElement('div');
    item.className = `bug-item ${bug.status === 'resolved' ? 'resolved' : ''}`;

    const dateStr = new Date(bug.createdAt).toLocaleString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });

    const admin = typeof isAdmin === 'function' && isAdmin();
    const isPending = bug.status !== 'resolved';

    const statusHtml = isPending
      ? `<span class="bug-status-badge bug-status-pending">🔴 未處理</span>`
      : `<span class="bug-status-badge bug-status-resolved">🟢 已處理</span>`;

    const resolveBtn = (admin && isPending)
      ? `<button class="bug-resolve-btn" data-id="${bug.id}">✅ 標記處理完畢</button>`
      : '';

    item.innerHTML = `
      <div class="bug-item-header">
        <div class="bug-item-meta">
          <span class="bug-item-reporter">${escapeHtml(bug.reporterId)}</span>
          <span class="bug-item-interface">${escapeHtml(bug.interface)}</span>
          <span class="bug-item-date">${dateStr}</span>
        </div>
        <div class="bug-item-actions">
          ${resolveBtn}
          ${statusHtml}
        </div>
      </div>
      <div class="bug-item-desc">${escapeHtml(bug.description)}</div>
    `;

    if (admin && isPending) {
      item.querySelector('.bug-resolve-btn').addEventListener('click', () => resolveBug(bug.id));
    }

    container.appendChild(item);
  });
}

// ── Helper ─────────────────────────────────────────
async function resolveBug(id) {
  const btn = document.querySelector(`.bug-resolve-btn[data-id="${id}"]`);
  if (btn) { btn.disabled = true; btn.textContent = '處理中...'; }

  try {
    const res = await fetch(
      `${FIRESTORE_BUGS}/${id}?updateMask.fieldPaths=status&updateMask.fieldPaths=resolvedAt`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            status: { stringValue: 'resolved' },
            resolvedAt: { stringValue: new Date().toISOString() }
          }
        })
      }
    );
    if (res.ok) fetchBugList();
    else if (btn) { btn.disabled = false; btn.textContent = '✅ 標記處理完畢'; }
  } catch {
    if (btn) { btn.disabled = false; btn.textContent = '✅ 標記處理完畢'; }
  }
}

async function deleteBug(id) {
  try {
    await fetch(`${FIRESTORE_BUGS}/${id}`, { method: 'DELETE' });
  } catch (e) {
    console.error('Failed to auto-delete bug:', id);
  }
}

function escapeHtml(unsafe) {
  return (unsafe || '').replace(/[&<"'>]/g, function (match) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return map[match];
  });
}
