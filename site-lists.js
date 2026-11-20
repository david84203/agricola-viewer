/* ══════════════════════════════════════════════════
   全站共用名單：禁卡表＋BGA 額外卡（Lu 1120 整合）
   唯一來源＝Firestore settings/banlist、settings/bga_cards。
   讀到雲端就「完全採用」，不跟備援聯集——否則在禁卡管理解禁的卡會被寫死清單擋回去。
   雲端讀不到（離線、額度爆）才用下方備援清單。
   ══════════════════════════════════════════════════ */
(function (global) {
  const FS = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';
  const BAN_KEY = 'agricola_banlist_cache';
  const BGA_KEY = 'agricola_bga_cache';
  const TTL = 24 * 60 * 60 * 1000;
  const BGA_DECKS = ['A', 'B', 'C', 'D', 'E'];

  // 備援：與 Firestore 2026-11-20 內容同步的快照，只在雲端讀不到時使用
  const FALLBACK_BANNED_GROUPS = [
    { label: '過強職業卡', ids: ['FL049', 'A127', 'I251', 'I260', 'I234', 'I255', '舊版E198', 'K270', 'NL098', 'Ö01', 'PI03', '2913-2', '7252-3', '8720-9', 'Z329', 'PI06', '7873-7'] },
    { label: '過強次要發展卡', ids: ['B010*', '906-8', 'A010', 'B021', 'A048', 'C031', 'K138', 'Ö13', 'Ö20', 'I081', 'Ö17', '5869-10', '6044-7', '6515-6', '4988-8', '9244-5', 'Z320', '12019-2', 'D021*', 'A039'] },
    { label: '過爛職業卡', ids: ['A107', 'A151', 'C144*', 'C111', 'D158*', 'B146', 'C157', 'B101', 'D140', 'A154', '舊版E158', '舊版E170', '舊版E155', 'I247', 'FL053', 'A100', 'A132', 'B147', '舊版E171', 'K304', '6575-4', 'WA042', 'K317', 'Ö02', 'Ö05', 'I224', '9995-3', 'Ö09', '5698-2', '5030-2', 'Z333'] },
    { label: '過爛次要發展卡', ids: ['B052', 'B018', '舊版E17', '舊版E29', '舊版E51', 'K109', 'FL016', 'FL028', 'Z324', 'FL021', 'NL025', 'NL023', '8315', 'C058', '6960-2', 'B064'] },
    { label: '擾亂戰局', ids: ['C093', 'C130', 'C003*', 'B022', 'K125', 'Ö03', 'Ö04', 'PI17', 'PI10', '5881-9', '6022-5'] },
  ];

  function readCache(key) {
    try {
      const s = JSON.parse(localStorage.getItem(key));
      return s && Date.now() - s.cachedAt < TTL && Array.isArray(s.data) ? s.data : null;
    } catch { return null; }
  }

  function writeCache(key, data) {
    try { localStorage.setItem(key, JSON.stringify({ data, cachedAt: Date.now() })); } catch {}
  }

  async function fetchDoc(name) {
    const res = await fetch(`${FS}/settings/${name}`);
    if (!res.ok) return null;
    const doc = await res.json();
    return doc.fields ? doc : null; // 429 等錯誤回應沒有 fields
  }

  const copyFallback = () => FALLBACK_BANNED_GROUPS.map(g => ({ label: g.label, ids: [...g.ids] }));
  let banPromise = null;
  let bgaPromise = null;

  // fresh:true＝略過快取直接讀雲端並更新快取（圖鑑頁用，讓 GM 改完的名單盡快擴散）
  function loadBannedGroups({ fresh = false } = {}) {
    if (banPromise && !fresh) return banPromise;
    banPromise = (async () => {
      const cached = !fresh && readCache(BAN_KEY);
      if (cached && cached.length) return cached;
      try {
        const doc = await fetchDoc('banlist');
        if (doc) {
          const groups = (doc.fields.groups?.arrayValue?.values || []).map(g => ({
            label: g.mapValue.fields.label.stringValue,
            ids: (g.mapValue.fields.ids?.arrayValue?.values || []).map(v => v.stringValue),
          }));
          if (groups.length) { writeCache(BAN_KEY, groups); return groups; }
        }
      } catch {}
      return cached && cached.length ? cached : copyFallback();
    })();
    return banPromise;
  }

  function loadBgaExtraIds({ fresh = false } = {}) {
    if (bgaPromise && !fresh) return bgaPromise;
    bgaPromise = (async () => {
      const cached = !fresh && readCache(BGA_KEY);
      if (cached) return new Set(cached);
      try {
        const doc = await fetchDoc('bga_cards');
        if (doc) {
          const ids = (doc.fields.ids?.arrayValue?.values || []).map(v => v.stringValue).filter(Boolean);
          writeCache(BGA_KEY, ids);
          return new Set(ids);
        }
      } catch {}
      return new Set();
    })();
    return bgaPromise;
  }

  const bannedIdSet = groups => new Set((groups || []).flatMap(g => g.ids));
  // BGA 卡＝A～E 牌組＋GM 在 Firestore 額外標記的卡
  const isBga = (card, extraIds) => BGA_DECKS.includes(card?.['牌組']) || !!extraIds?.has(card?.['卡片ID']);

  function clearCache() {
    try { localStorage.removeItem(BAN_KEY); localStorage.removeItem(BGA_KEY); } catch {}
    banPromise = null;
    bgaPromise = null;
  }

  global.SiteLists = { BGA_DECKS, FALLBACK_BANNED_GROUPS, loadBannedGroups, loadBgaExtraIds, bannedIdSet, isBga, clearCache };
})(typeof window !== 'undefined' ? window : globalThis);
