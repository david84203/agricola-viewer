/* ══════════════════════════════════════════════════
   農家樂 卡牌比較 — compare.js（Lu 1111）
   任選 2～4 張卡並排比較；網址 ?ids=A,B,C 可分享。
   整檔包在 IIFE 裡：viewer 各 .js 共用全域作用域，避免撞名。
   ══════════════════════════════════════════════════ */
(function () {
  const FS = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';
  // 與 app.js／tierlist.js 共用同一把快取 key：看過圖鑑或排行的人零額外讀取
  const RATINGS_CACHE_KEY = 'agricola_ratings_cache_v5';
  const RATINGS_CACHE_TTL = 2 * 60 * 60 * 1000;
  const BANLIST_CACHE_KEY = 'agricola_banlist_cache';
  const BANLIST_CACHE_TTL = 24 * 60 * 60 * 1000;
  const MIN_SEEN = 5;
  const TIERS = ['S', 'A', 'B', 'C', 'D', 'E'];
  const MAX_SLOTS = 4;

  let cards = [];
  const byId = new Map();
  let profiles = {};
  let ratings = {};
  let bannedIds = new Set();
  let rankInfo = new Map(); // 卡片ID → { tier, rank, total, pool, score }
  let slots = [];             // 卡片ID 或 ''（空欄）

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');

  // ── 資料載入 ──────────────────────────────────────
  async function loadOverrides() {
    try {
      const data = await fetch(`${FS}/card_overrides?pageSize=300`).then((r) => r.json());
      const out = {};
      (data.documents || []).forEach((doc) => {
        const f = {};
        Object.entries(doc.fields || {}).forEach(([k, v]) => { f[k] = v.stringValue ?? String(v.integerValue ?? v.doubleValue ?? ''); });
        out[decodeURIComponent(doc.name.split('/').pop())] = f;
      });
      return out;
    } catch { return {}; }
  }

  async function loadBanned() {
    try {
      const s = JSON.parse(localStorage.getItem(BANLIST_CACHE_KEY));
      if (s && Date.now() - s.cachedAt < BANLIST_CACHE_TTL && s.data?.length) return new Set(s.data.flatMap((g) => g.ids));
    } catch {}
    try {
      const doc = await fetch(`${FS}/settings/banlist`).then((r) => r.json());
      const groups = (doc.fields?.groups?.arrayValue?.values || []).map((g) => ({
        label: g.mapValue.fields.label.stringValue,
        ids: (g.mapValue.fields.ids.arrayValue.values || []).map((v) => v.stringValue),
      }));
      if (groups.length) {
        try { localStorage.setItem(BANLIST_CACHE_KEY, JSON.stringify({ data: groups, cachedAt: Date.now() })); } catch {}
      }
      return new Set(groups.flatMap((g) => g.ids));
    } catch { return new Set(); }
  }

  async function loadRatings() {
    try {
      const s = JSON.parse(localStorage.getItem(RATINGS_CACHE_KEY));
      if (s && Date.now() - s.cachedAt < RATINGS_CACHE_TTL) return s.data;
    } catch {}
    const map = {};
    let pageToken = null;
    do {
      let url = `${FS}/agricola_ratings?pageSize=300`;
      if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
      const data = await fetch(url).then((r) => r.json());
      (data.documents || []).forEach((doc) => {
        const f = doc.fields || {};
        map[doc.name.split('/').pop()] = {
          elo: Number(f.elo?.integerValue ?? f.elo?.doubleValue ?? 1200),
          seenCount: Number(f.seenCount?.integerValue ?? 0),
          pickCount: Number(f.pickCount?.integerValue ?? 0),
          rankSeen: Number(f.rankSeen?.integerValue ?? 0),
        };
      });
      pageToken = data.nextPageToken ?? null;
    } while (pageToken);
    try { localStorage.setItem(RATINGS_CACHE_KEY, JSON.stringify({ data: map, cachedAt: Date.now() })); } catch {}
    return map;
  }

  // 三頁共用 tier-utils.js：職業／次發各自排、扣禁卡與被取代的重複卡
  let dupNonCanonicalKeys = new Set();
  function buildRanks() {
    rankInfo = window.CardTiers.compute(cards, ratings,
      (c) => bannedIds.has(c['卡片ID']) || dupNonCanonicalKeys.has(window.DuplicateCards.getCardKey(c)));
  }

  // ── 比較列定義 ────────────────────────────────────
  // num：可比大小的數值（null＝不參加比較）；better：'max'／'min'
  const typeLabel = (c) => c.card_type === 'occupation' ? '職業卡' : c.card_type === 'both' ? '雙色卡' : (c.reference ? '主要發展卡' : '次要發展卡');
  const ratingOf = (c) => {
    const r = ratings[c['卡片ID']];
    return r && r.seenCount >= MIN_SEEN ? r : null; // 禁卡（如 BGA 牌組）有評分也照顯示，只是不進排名
  };
  const matchOf = (c) => profiles[c['卡片ID']]?.match || null;
  const tags = (arr, mainFirst) => (arr && arr.length)
    ? `<div class="cmp-tags">${arr.map((t, i) => `<span class="cmp-tag${mainFirst && i === 0 ? ' is-main' : ''}">${esc(t)}</span>`).join('')}</div>`
    : '<span class="cmp-dim">—</span>';
  const plain = (v) => (v === undefined || v === null || v === '' ? '<span class="cmp-dim">—</span>' : esc(v));

  const SECTIONS = [
    ['基本資料', [
      ['類型', (c) => ({ html: esc(typeLabel(c)) })],
      ['牌組', (c) => ({ html: plain(c['牌組']) })],
      ['費用', (c) => ({ html: plain(c['費用']) })],
      ['先決條件', (c) => ({ html: plain(c['先決條件']) })],
      ['人數', (c) => ({ html: plain(c['人數'] || c['需求人數']) })],
      ['勝利點數', (c) => ({ html: plain(c['勝利點數']), num: Number.isFinite(parseFloat(c['勝利點數'])) ? parseFloat(c['勝利點數']) : null, better: 'max' })],
      ['紅利分數', (c) => ({ html: plain(c['紅利分數']) })],
      ['傳遞', (c) => ({ html: plain(c['是否傳遞']) })],
      ['禁卡', (c) => ({ html: bannedIds.has(c['卡片ID']) ? '<span class="tag tag-ban">禁卡</span>' : '<span class="cmp-dim">否</span>' })],
    ]],
    ['牌力（輪抽評分）', [
      ['ELO', (c) => {
        const r = ratingOf(c);
        return r ?{ html: String(Math.round(r.elo)), num: r.elo, better: 'max' } : { html: '<span class="cmp-dim">樣本不足</span>' };
      }],
      ['Tier', (c) => {
        const k = rankInfo.get(c['卡片ID']);
        if (bannedIds.has(c['卡片ID'])) return { html: '<span class="cmp-dim">禁卡不排名</span>' };
        return k ? { html: `<b>${k.tier}</b>`, num: -TIERS.indexOf(k.tier), better: 'max' } : { html: '<span class="cmp-dim">—</span>' };
      }],
      ['同類排名', (c) => {
        const k = rankInfo.get(c['卡片ID']);
        // 職業與次發各自排名；▲ 比的是「前百分之幾」，跨類型也成立
        return k ? { html: `${window.CardTiers.POOL_LABEL[k.pool]}第 ${k.rank} / ${k.total}（前 ${Math.max(1, Math.round(k.rank / k.total * 100))}%）`, num: k.rank / k.total, better: 'min' } : { html: '<span class="cmp-dim">—</span>' };
      }],
      ['輪抽選取率', (c) => {
        const r = ratingOf(c);
        return r && r.seenCount ? { html: `${Math.round(r.pickCount / r.seenCount * 100)}%（${r.pickCount}/${r.seenCount}）`, num: r.pickCount / r.seenCount, better: 'max' } : { html: '<span class="cmp-dim">—</span>' };
      }],
      ['有效場數', (c) => {
        const r = ratings[c['卡片ID']];
        return r ? { html: String(r.seenCount + (r.rankSeen || 0)) } : { html: '<span class="cmp-dim">0</span>' };
      }],
    ]],
    ['實戰（LUGA 四人局）', [
      ['出現局數', (c) => { const m = matchOf(c); return m ? { html: String(m.n) } : { html: '<span class="cmp-dim">0</span>' }; }],
      ['平均名次', (c) => {
        const m = matchOf(c);
        if (!m) return { html: '<span class="cmp-dim">—</span>' };
        return m.n >= 5 ? { html: `第 ${m.avgRank.toFixed(1)} 名`, num: m.avgRank, better: 'min' } : { html: '<span class="cmp-dim">樣本不足</span>' };
      }],
      ['前兩名率', (c) => {
        const m = matchOf(c);
        if (!m) return { html: '<span class="cmp-dim">—</span>' };
        return m.n >= 5 ? { html: `${Math.round(m.top2 * 100)}%`, num: m.top2, better: 'max' } : { html: '<span class="cmp-dim">樣本不足</span>' };
      }],
    ]],
    ['卡片定位', [
      ['類型', (c) => ({ html: tags(profiles[c['卡片ID']]?.types?.slice(0, 3), true) })],
      ['路線', (c) => {
        const p = profiles[c['卡片ID']];
        if (!p?.types?.length) return { html: '<span class="cmp-dim">—</span>' };
        return { html: tags(p.routes?.length ? p.routes.slice(0, 3) : ['通用']) };
      }],
      ['特性', (c) => ({ html: tags(profiles[c['卡片ID']]?.traits) })],
      ['推薦搭配', (c) => ({ html: plain((profiles[c['卡片ID']]?.best || []).join('、')) })],
    ]],
    ['卡文', [
      ['說明', (c) => ({ html: `<div class="cmp-desc">${plain(c['說明'])}</div>` })],
    ]],
  ];

  // ── 畫表 ──────────────────────────────────────────
  function render() {
    const table = $('cmpTable');
    const diffOnly = $('cmpDiffOnly').checked;
    const chosen = slots.map((id) => byId.get(id) || null);
    const filled = chosen.filter(Boolean);

    let html = `<colgroup><col class="cmp-label-col">${slots.map(() => '<col class="cmp-card-col">').join('')}</colgroup>`;
    html += '<tr class="cmp-head"><th class="cmp-label">卡片</th>';
    slots.forEach((id, i) => {
      const c = chosen[i];
      const img = c ? window.CardImages?.getPath?.(c) : '';
      html += `<th><div class="cmp-slot">
        <div class="cmp-search">
          <input type="text" data-slot="${i}" placeholder="輸入牌名或 ID…" value="${c ? esc(c['牌名']) : ''}" autocomplete="off" />
          ${slots.length > 2 ? `<button type="button" class="cmp-remove" data-remove="${i}" title="移除這一欄">✕</button>` : ''}
          <div class="cmp-suggest" data-suggest="${i}"></div>
        </div>
        ${c ? (img ? `<img class="cmp-img" src="${esc(img)}" alt="${esc(c['牌名'])}" loading="lazy" data-zoom="${esc(img)}" />` : '<div class="cmp-img-empty">沒有卡圖</div>')
            : '<div class="cmp-img-empty">還沒選卡</div>'}
        ${c ? `<div><div class="cmp-name">${esc(c['牌名'])}</div><div class="cmp-dim">${esc(c['卡片ID'])}</div></div>` : ''}
      </div></th>`;
    });
    html += '</tr>';

    if (filled.length) {
      SECTIONS.forEach(([title, rows]) => {
        let body = '';
        rows.forEach(([label, fn]) => {
          const cells = chosen.map((c) => (c ? fn(c) : null));
          if (diffOnly && filled.length > 1) {
            const vals = cells.filter(Boolean).map((x) => x.html);
            if (vals.every((v) => v === vals[0])) return;
          }
          // 找最佳值：至少兩張有數值、且不是全部一樣才標
          const nums = cells.map((x) => (x && typeof x.num === 'number' ? x.num : null));
          const valid = nums.filter((n) => n !== null);
          let best = null;
          if (valid.length >= 2 && new Set(valid).size > 1) {
            const better = cells.find((x) => x && x.better)?.better;
            best = better === 'min' ? Math.min(...valid) : Math.max(...valid);
          }
          body += `<tr><td class="cmp-label">${esc(label)}</td>${cells.map((x, i) =>
            `<td class="${best !== null && nums[i] === best ? 'cmp-best' : ''}">${x ? x.html : ''}</td>`).join('')}</tr>`;
        });
        if (body) html += `<tr class="cmp-section"><td colspan="${slots.length + 1}">${esc(title)}</td></tr>${body}`;
      });
    }
    table.innerHTML = html;
    $('cmpAdd').style.display = slots.length >= MAX_SLOTS ? 'none' : '';
    syncUrl();
  }

  function syncUrl() {
    const ids = slots.filter(Boolean);
    const url = new URL(location.href);
    if (ids.length) url.searchParams.set('ids', ids.join(',')); else url.searchParams.delete('ids');
    history.replaceState(null, '', url);
  }

  // ── 搜尋建議 ──────────────────────────────────────
  function search(q) {
    const n = norm(q);
    if (!n) return [];
    const scored = [];
    for (const c of cards) {
      const name = norm(c['牌名']);
      const id = norm(c['卡片ID']);
      let s = -1;
      if (name === n || id === n) s = 0;
      else if (name.startsWith(n) || id.startsWith(n)) s = 1;
      else if (name.includes(n)) s = 2;
      else if (id.includes(n)) s = 3;
      if (s >= 0) scored.push([s + (bannedIds.has(c['卡片ID']) ? 0.5 : 0), c]);
    }
    scored.sort((a, b) => a[0] - b[0]);
    return scored.slice(0, 15).map((x) => x[1]);
  }

  function openSuggest(input) {
    const i = Number(input.dataset.slot);
    const box = document.querySelector(`[data-suggest="${i}"]`);
    const list = search(input.value);
    if (!input.value.trim()) { box.classList.remove('open'); return; }
    box.innerHTML = list.length
      ? list.map((c, k) => `<button type="button" data-pick="${esc(c['卡片ID'])}" class="${k === 0 ? 'active' : ''}">${esc(c['牌名'])}<small>${esc(c['卡片ID'])}・${esc(typeLabel(c))}${bannedIds.has(c['卡片ID']) ? '・禁卡' : ''}</small></button>`).join('')
      : '<div class="cmp-empty">找不到這張卡</div>';
    box.classList.add('open');
  }

  function pick(slotIdx, id) {
    slots[slotIdx] = id;
    render();
    // 自動跳到下一個空欄，方便連續輸入
    const next = slots.indexOf('');
    if (next >= 0) document.querySelector(`input[data-slot="${next}"]`)?.focus();
  }

  function bindEvents() {
    const table = $('cmpTable');
    table.addEventListener('input', (e) => { if (e.target.matches('input[data-slot]')) openSuggest(e.target); });
    table.addEventListener('focusin', (e) => { if (e.target.matches('input[data-slot]')) { e.target.select(); openSuggest(e.target); } });
    table.addEventListener('keydown', (e) => {
      if (!e.target.matches('input[data-slot]')) return;
      const box = document.querySelector(`[data-suggest="${e.target.dataset.slot}"]`);
      const items = [...box.querySelectorAll('button[data-pick]')];
      if (!items.length) return;
      let k = items.findIndex((b) => b.classList.contains('active'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        items[k]?.classList.remove('active');
        k = (k + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[k].classList.add('active');
        items[k].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        pick(Number(e.target.dataset.slot), items[Math.max(k, 0)].dataset.pick);
      } else if (e.key === 'Escape') {
        box.classList.remove('open');
      }
    });
    // mousedown 先於 blur，才點得到建議
    table.addEventListener('mousedown', (e) => {
      const b = e.target.closest('button[data-pick]');
      if (b) { e.preventDefault(); pick(Number(b.closest('[data-suggest]').dataset.suggest), b.dataset.pick); }
    });
    table.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-remove]');
      if (rm) { slots.splice(Number(rm.dataset.remove), 1); render(); return; }
      const z = e.target.closest('[data-zoom]');
      if (z) { $('cmpZoom').querySelector('img').src = z.dataset.zoom; $('cmpZoom').classList.add('open'); }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.cmp-search')) document.querySelectorAll('.cmp-suggest.open').forEach((b) => b.classList.remove('open'));
    });
    $('cmpZoom').addEventListener('click', () => $('cmpZoom').classList.remove('open'));
    $('cmpAdd').addEventListener('click', () => {
      if (slots.length >= MAX_SLOTS) return;
      slots.push('');
      render();
      document.querySelector(`input[data-slot="${slots.length - 1}"]`)?.focus();
    });
    $('cmpDiffOnly').addEventListener('change', render);
  }

  // ── 啟動 ──────────────────────────────────────────
  async function init() {
    bindEvents();
    const params = new URLSearchParams(location.search);
    const wanted = (params.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_SLOTS);
    slots = wanted.length >= 2 ? wanted : [...wanted, '', ''].slice(0, 2);

    try {
      const [base, refCards, overrides, banned, profileData] = await Promise.all([
        fetch('./cards.json').then((r) => r.json()),
        fetch('./reference-cards.json').then((r) => r.json()).catch(() => []),
        loadOverrides(),
        loadBanned(),
        fetch('./card-profile.json').then((r) => r.json()).catch(() => ({})),
        window.CardImages?.load?.() || Promise.resolve(),
      ]);
      cards = base.map((c) => (overrides[c['卡片ID']] ? { ...c, ...overrides[c['卡片ID']] } : c)).concat(refCards);
      cards.forEach((c) => byId.set(c['卡片ID'], c));
      bannedIds = banned;
      try { dupNonCanonicalKeys = (await window.DuplicateCards.loadDuplicateInfo(cards)).nonCanonicalKeys; } catch {}
      profiles = profileData || {};
      slots = slots.map((id) => (id && byId.has(id) ? id : ''));
      while (slots.length < 2) slots.push('');
    } catch (e) {
      $('cmpStatus').textContent = `卡牌資料載入失敗（${e.message}），請重新整理`;
      return;
    }
    $('cmpStatus').textContent = '牌力資料載入中…';
    render();
    try {
      ratings = await loadRatings();
      buildRanks();
      $('cmpStatus').textContent = '';
    } catch (e) {
      $('cmpStatus').textContent = `牌力資料暫時讀不到（${e.message}），其他欄位照常比較`;
    }
    render();
    if (!slots.some(Boolean)) document.querySelector('input[data-slot="0"]')?.focus();
  }

  init();
})();
