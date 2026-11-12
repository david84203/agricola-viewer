/* ══════════════════════════════════════════════════
   農家樂 Tier 共用計算 — tier-utils.js（Lu 1111）
   卡牌圖鑑、牌力排行、卡牌比較三頁共用同一份，Tier 才會一致。
   規則：
   - 職業卡只跟職業卡排、次要發展卡（含雙色卡）只跟次要發展卡排
   - 排名母體一律扣除禁卡與被取代的重複卡（由呼叫端的 isExcluded 決定）
   - Tier 固定以完整牌池計算，不隨頁面上的牌組／類型篩選變動
   - 分數：有效場數（輪抽 seenCount＋快排 rankSeen）滿 30 完全信任 ELO，
     不足時與輪抽選取率推估值加權（原牌力排行頁公式）
   ══════════════════════════════════════════════════ */
(function () {
  const TIERS = ['S', 'A', 'B', 'C', 'D', 'E'];
  const BOUNDS = [0.08, 0.25, 0.60, 0.82, 0.95, 1.01];
  const MIN_SEEN = 5;
  const POOL_LABEL = { occupation: '職業卡', minor: '次要發展卡' };

  function score({ elo, seenCount = 0, pickCount = 0, rankSeen = 0 }) {
    const conf = Math.min((seenCount + rankSeen) / 30, 1);
    if (conf >= 1) return elo;
    const pickRate = seenCount ? pickCount / seenCount : 0.11; // 0.11 ≈ 1/9（9 張包隨機基準）
    const prior = 1200 + (pickRate - 0.11) * 450;
    return conf * elo + (1 - conf) * prior;
  }

  // 主要發展卡（參考卡）不參加排名
  function poolOf(card) {
    if (!card || card.reference || card.card_type === 'major') return null;
    return card.card_type === 'occupation' ? 'occupation' : 'minor';
  }

  // 回傳 Map：卡片ID → { tier, rank, total, pool, score }
  function compute(cards, ratings, isExcluded) {
    const pools = { occupation: [], minor: [] };
    (cards || []).forEach((c) => {
      const pool = poolOf(c);
      if (!pool || (isExcluded && isExcluded(c))) return;
      const id = c['卡片ID'];
      const r = ratings && ratings[id];
      if (r && r.seenCount + (r.rankSeen || 0) >= MIN_SEEN) pools[pool].push({ id, score: score(r) });
    });
    const out = new Map();
    Object.entries(pools).forEach(([pool, list]) => {
      list.sort((a, b) => b.score - a.score);
      list.forEach((x, i) => out.set(x.id, {
        tier: TIERS[BOUNDS.findIndex((b) => i / list.length < b)],
        rank: i + 1, total: list.length, pool, score: x.score,
      }));
    });
    return out;
  }

  window.CardTiers = { TIERS, BOUNDS, MIN_SEEN, POOL_LABEL, score, poolOf, compute };
})();
