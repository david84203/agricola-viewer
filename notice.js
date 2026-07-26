/* ══════════════════════════════════════════════════
   農家樂 站內通知 — notice.js
   管理員對特定玩家留一則訊息，該玩家下次登入時看到。

   ⚠ 刻意獨立於 auth.js／auth.css：
      線上對戰（harvestable）的 index/lobby 會從 viewer 動態載入
      auth.js 與 auth.css，動那兩個檔會連帶影響對戰站。
      本檔只掛在 viewer 自己的頁面。

   ⚠ Firestore 規則目前全開，agricola_notices 內容任何人都讀得到，
      因此訊息一律不得包含網址或密碼（後台 players.js 送出前會擋）。
   ══════════════════════════════════════════════════ */

const AG_NOTICE_BASE = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents/agricola_notices';

// ── 顯示卡片 ───────────────────────────────────────
function agNoticeShow(id, text) {
  const overlay = document.createElement('div');
  overlay.className = 'ag-notice-overlay';

  const card = document.createElement('div');
  card.className = 'ag-notice-card';

  const title = document.createElement('div');
  title.className = 'ag-notice-title';
  title.textContent = '📩 站長給你的訊息';

  const body = document.createElement('div');
  body.className = 'ag-notice-body';
  body.textContent = text; // textContent：訊息內容一律當純文字，不解析 HTML

  const btn = document.createElement('button');
  btn.className = 'ag-notice-btn';
  btn.textContent = '知道了';
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    await agNoticeMarkRead(id);
    overlay.remove();
  });

  card.append(title, body, btn);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

// ── 標記已讀（讓後台知道對方看到了）────────────────
async function agNoticeMarkRead(id) {
  try {
    const url = `${AG_NOTICE_BASE}/${encodeURIComponent(id)}?updateMask.fieldPaths=readAt`;
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { readAt: { stringValue: new Date().toISOString() } } }),
    });
  } catch {}
}

// ── 進站檢查 ───────────────────────────────────────
async function agNoticeCheck() {
  const id = (typeof getRaterId === 'function') ? getRaterId() : null;
  if (!id) return; // 未登入

  try {
    const res = await fetch(`${AG_NOTICE_BASE}/${encodeURIComponent(id)}`);
    if (!res.ok) return; // 404 = 沒有留言

    const f = (await res.json()).fields || {};
    const text = f.text?.stringValue || '';
    if (!text) return;
    if (f.readAt?.stringValue) return; // 已讀過就不再打擾

    agNoticeShow(id, text);
  } catch {}
}

document.addEventListener('DOMContentLoaded', agNoticeCheck);
