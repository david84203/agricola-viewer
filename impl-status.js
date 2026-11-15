/* ══════════════════════════════════════════════════
   農家樂 卡牌「功能狀態」篩選 — impl-status.js
   僅 isImplStatusViewer()（小路 GM／YOYO）可見，其餘使用者一律不注入 DOM。

   資料只看自動清單 online-implemented.json（agricola-online/gen_online_implemented.cjs 掃 play.js 產生）。
   舊的人工狀態表（Firestore settings/card_impl_status，1 部分完成／2 完成／3 未做／4 無法做）
   2026-07-31 已整份清空，1115 Lu 確認「都全自動化了」→ 人工選項、徽章、編輯器全部移除。
   ══════════════════════════════════════════════════ */

function renderImplStatusFilterControl() {
  const viewer = typeof isImplStatusViewer === 'function' && isImplStatusViewer();
  let wrap = document.getElementById('implStatusFilterWrap');

  if (!viewer) {
    if (wrap) wrap.remove();
    if (typeof activeImplStatus !== 'undefined') activeImplStatus = 'all';
    return;
  }
  const filterBar = document.querySelector('.filter-bar');
  if (!filterBar) return;
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'deck-filter';
    wrap.id = 'implStatusFilterWrap';
    wrap.innerHTML = `
      <label for="implStatusSelect">功能狀態</label>
      <select id="implStatusSelect">
        <option value="all">全部</option>
        <option value="online">✅ 線上已實作</option>
        <option value="todo">⬜ 線上未實作</option>
      </select>
    `;
    filterBar.appendChild(wrap);
    document.getElementById('implStatusSelect').addEventListener('change', e => {
      // 要寫 app.js 頂層的 let activeImplStatus（共用全域作用域），不是 window.activeImplStatus
      activeImplStatus = e.target.value;
      if (typeof applyFilters === 'function') applyFilters();
    });
  }
  // 標清單產生日：清單要在 agricola-online 重跑產生器才會更新，過舊要看得出來
  const label = wrap.querySelector('label');
  label.textContent = typeof onlineImplAt === 'string' && onlineImplAt ? `功能狀態（清單 ${onlineImplAt}）` : '功能狀態';
}
