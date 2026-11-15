/* 全站共用導覽列（Lu 1115 第一波：名稱統一「卡牌圖鑑」「牌力排行」；文字列表不進導覽，留在圖鑑頁當切換鈕）
   用法：頁尾 <script src="nav.js"></script>，自動插在 .top-brand-bar 後面；排序評分只給評分者（同首頁規則）。
   整檔包在 IIFE：viewer 各 .js 共用全域作用域，避免撞名。 */
(() => {
  const ITEMS = [
    ['index.html', '首頁'],
    ['cards.html', '卡牌圖鑑', ['list.html']],
    ['draft.html', '輪抽模擬'],
    ['review.html', '覆盤輪抽'],
    ['rank.html', '排序評分', [], 'rater'],
    ['tierlist.html', '牌力排行'],
    ['compare.html', '卡牌比較'],
    ['about.html', '關於'],
    ['bug-report.html', 'BUG 回報'],
  ];
  const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  const css = `
.site-nav{display:flex;gap:4px;padding:6px 16px;background:var(--bg2);border-bottom:1px solid var(--border);overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.site-nav::-webkit-scrollbar{display:none}
.site-nav a{flex:none;padding:6px 12px;border-radius:var(--radius-sm);color:var(--text2);text-decoration:none;font-size:.9rem;white-space:nowrap;transition:background var(--transition),color var(--transition)}
.site-nav a:hover{background:var(--surface);color:var(--text)}
.site-nav a.active{background:var(--surface2);color:var(--gold2);font-weight:600}
@media (max-width:640px){.site-nav{padding:6px 8px}.site-nav a{padding:6px 10px;font-size:.85rem}}`;

  function render() {
    const old = document.querySelector('.site-nav');
    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.setAttribute('aria-label', '網站導覽');
    // 沒載 auth.js 的頁（覆盤）直接讀同一個登入紀錄，規則同 auth.js isRater
    let role = '';
    try { role = JSON.parse(localStorage.getItem('agricola_auth'))?.role || ''; } catch {}
    const rater = role === 'rater' || role === 'admin';
    for (const [href, label, also = [], need] of ITEMS) {
      if (need === 'rater' && !rater) continue;
      const a = document.createElement('a');
      a.href = `./${href}`;
      a.textContent = label;
      if (href === here || also.includes(here)) { a.className = 'active'; a.setAttribute('aria-current', 'page'); }
      nav.appendChild(a);
    }
    if (old) { old.replaceWith(nav); return; }
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const bar = document.querySelector('.top-brand-bar');
    if (bar) bar.insertAdjacentElement('afterend', nav); else document.body.prepend(nav);
    // 手機上導覽列可橫滑：把目前這頁捲到中間（只捲導覽列本身，不動整頁）
    const act = nav.querySelector('.active');
    if (act) nav.scrollLeft = act.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - act.offsetWidth) / 2;
  }

  render();
  // 登入／登出後重畫（排序評分要跟著出現或消失）；其他分頁登入也同步
  window.addEventListener('storage', (e) => { if (e.key === 'agricola_auth') render(); });
  window.SiteNav = { refresh: render };
})();
