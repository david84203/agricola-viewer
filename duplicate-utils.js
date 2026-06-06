(function (global) {
  const DUP_LS_KEY = 'agricola_dups';
  const DUP_FS_DOC = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents/agricola_dup_state/main';

  function getCardId(card) {
    return card?.['卡片ID'] || '';
  }

  function getCardKey(card) {
    return [getCardId(card), card?.source_image || '', card?.position ?? ''].join('|');
  }

  function getRefId(ref) {
    return String(ref || '').split('|')[0];
  }

  function isPreciseRef(ref) {
    return String(ref || '').includes('|');
  }

  function normalizeState(state) {
    return { picked: {}, dismissed: [], custom: [], ...(state || {}) };
  }

  async function loadDuplicateState() {
    const fallback = (() => {
      try { return normalizeState(JSON.parse(localStorage.getItem(DUP_LS_KEY) || '{}')); }
      catch { return normalizeState(); }
    })();

    try {
      const res = await fetch(DUP_FS_DOC);
      if (!res.ok) return fallback;
      const data = await res.json();
      const json = data.fields?.stateJson?.stringValue;
      if (!json) return fallback;
      const state = normalizeState(JSON.parse(json));
      localStorage.setItem(DUP_LS_KEY, JSON.stringify(state));
      return state;
    } catch {
      return fallback;
    }
  }

  async function loadDuplicatePairs() {
    try {
      return await fetch('./duplicates.json').then(r => r.json());
    } catch {
      return [];
    }
  }

  function resolveCardRef(cards, ref) {
    if (!ref) return null;
    const value = String(ref);
    if (isPreciseRef(value)) {
      const [id, source, position] = value.split('|');
      return cards.find(c => getCardKey(c) === value)
        || cards.find(c =>
          getCardId(c) === id
          && (c.source_image || '') === source
          && String(c.position ?? '') === position
        );
    }
    return cards.find(c => getCardId(c) === value);
  }

  function resolveCardRefs(cards, ref) {
    if (!ref) return [];
    const value = String(ref);
    if (isPreciseRef(value)) {
      const card = resolveCardRef(cards, value);
      return card ? [card] : [];
    }
    return cards.filter(c => getCardId(c) === value);
  }

  function isCardCanonical(card, canonicalRef) {
    return isPreciseRef(canonicalRef)
      ? getCardKey(card) === canonicalRef
      : getCardId(card) === canonicalRef;
  }

  function buildDuplicateInfo(cards, pairs, state) {
    const safeCards = Array.isArray(cards) ? cards : [];
    const safePairs = Array.isArray(pairs) ? pairs : [];
    const safeState = normalizeState(state);
    const allPairs = [...safePairs, ...(safeState.custom || [])];
    const excludedRefs = new Set();
    const nonCanonicalKeys = new Set();
    const cardToPair = new Map();
    const canonicalMap = new Map();
    const keepRefs = new Set();
    const keepIds = new Set();

    allPairs.forEach(pair => {
      if (!(safeState.dismissed || []).includes(pair.id)) return;
      (pair.cards || []).forEach(ref => {
        keepRefs.add(ref);
        keepIds.add(getRefId(ref));
      });
    });

    allPairs.forEach(pair => {
      if ((safeState.dismissed || []).includes(pair.id)) return;
      const canon = (safeState.picked || {})[pair.id] || pair.defaultCanonical;
      if (!canon || !Array.isArray(pair.cards)) return;

      const canonCard = resolveCardRef(safeCards, canon);
      const canonKey = canonCard ? getCardKey(canonCard) : canon;
      const replacedRefs = [];

      pair.cards.forEach(ref => {
        if (ref === canon) return;
        const isExplicitPrecisePair = pair.type === 'custom' && (isPreciseRef(ref) || isPreciseRef(canon));
        if (!isExplicitPrecisePair && (keepRefs.has(ref) || keepIds.has(getRefId(ref)))) return;

        excludedRefs.add(ref);
        resolveCardRefs(safeCards, ref).forEach(card => {
          if (isCardCanonical(card, canon)) return;

          const replacedRef = getCardKey(card);
          replacedRefs.push(replacedRef);
          nonCanonicalKeys.add(replacedRef);
          cardToPair.set(replacedRef, { pair, canonId: canon });
        });
      });

      if (replacedRefs.length) {
        const existing = canonicalMap.get(canonKey) || [];
        existing.push({ pair, replacedRefs });
        canonicalMap.set(canonKey, existing);
      }
    });

    return { state: safeState, pairs: allPairs, excludedRefs, nonCanonicalKeys, cardToPair, canonicalMap };
  }

  async function loadDuplicateInfo(cards = [], pairs = null) {
    const [basePairs, state] = await Promise.all([
      pairs ? Promise.resolve(pairs) : loadDuplicatePairs(),
      loadDuplicateState(),
    ]);
    return buildDuplicateInfo(cards, basePairs, state);
  }

  global.DuplicateCards = {
    getCardId,
    getCardKey,
    isPreciseRef,
    resolveCardRef,
    resolveCardRefs,
    isCardCanonical,
    loadDuplicateState,
    loadDuplicatePairs,
    buildDuplicateInfo,
    loadDuplicateInfo,
  };
})(typeof window !== 'undefined' ? window : globalThis);
