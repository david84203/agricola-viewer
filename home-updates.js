/* 首頁重大更新專區：讀 updates.json 渲染，預設顯示最新 3 筆 */
(async () => {
  const INITIAL_SHOWN = 3;
  const SEEN_KEY = 'ugg_updates_seen_date';
  let updates = [];
  try {
    updates = await fetch('./updates.json').then(r => r.json());
  } catch { return; } // 抓不到就整區留空，不報錯
  if (!Array.isArray(updates) || updates.length === 0) return;

  const lastSeen = localStorage.getItem(SEEN_KEY) || '';
  const list = document.getElementById('updatesList');
  const moreBtn = document.getElementById('updatesMoreBtn');

  const render = (entries) => {
    list.innerHTML = entries.map(u => `
      <article class="home-update-card">
        <div class="home-update-meta">
          <span class="home-update-date">${u.date}</span>
          <span class="home-update-tag">${u.tag}</span>
          ${u.date > lastSeen ? '<span class="home-update-new">NEW</span>' : ''}
        </div>
        <h3 class="home-update-title">${u.title}</h3>
        <ul class="home-update-items">
          ${(u.items || []).map(t => `<li>${t}</li>`).join('')}
        </ul>
      </article>
    `).join('');
  };

  render(updates.slice(0, INITIAL_SHOWN));
  if (updates.length > INITIAL_SHOWN) {
    moreBtn.style.display = '';
    moreBtn.addEventListener('click', () => {
      render(updates);
      moreBtn.style.display = 'none';
    });
  }

  // 看過即標記：下次來訪只有更新的條目才會掛 NEW
  localStorage.setItem(SEEN_KEY, updates[0].date);
})();
