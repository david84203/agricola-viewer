/* Shared card modal helpers: keep card details consistent across pages. */
(function () {
  function typeName(card) {
    if (card.card_type === 'minor') return '次要發展卡';
    if (card.card_type === 'occupation') return '職業卡';
    return '次要發展卡及主要發展卡';
  }

  function renderTypeBadge(el, card) {
    if (!el) return;
    el.className = `modal-badge badge-${card.card_type}`;
    if (card.card_type === 'both') {
      el.innerHTML = '<span class="badge-both-minor">次要及</span><span class="badge-both-occ">主要發展卡</span>';
    } else {
      el.textContent = typeName(card);
    }
  }

  function fieldDefs(card) {
    if (card.card_type === 'occupation') {
      return [
        ['需求人數', card['人數'] || card['需求人數']],
        ['紅利分數', card['紅利分數']],
        ['牌組', card['牌組']],
      ];
    }

    return [
      ['先決條件', card['先決條件']],
      ['費用', card['費用']],
      ['是否傳遞', card['是否傳遞']],
      ['勝利點數', card['勝利點數'], 'vp'],
      ['紅利分數', card['紅利分數'], 'bonus'],
      ['牌組', card['牌組']],
    ];
  }

  function highlightClass(value, highlight) {
    if (highlight === 'vp' && value !== '無') {
      return String(value).startsWith('-') ? 'highlight-vp-neg' : 'highlight-vp';
    }
    if (highlight === 'bonus' && value === '有') return 'highlight-bonus';
    if (highlight === 'replace') return 'highlight-replace';
    return '';
  }

  function renderFields(fieldsEl, defs) {
    if (!fieldsEl) return;
    fieldsEl.innerHTML = '';

    defs.forEach(([label, value, highlight]) => {
      if (value === undefined || value === null || value === '') return;

      const row = document.createElement('div');
      row.className = 'field-row';

      const labelEl = document.createElement('div');
      labelEl.className = 'field-label';
      labelEl.textContent = label;

      const valueEl = document.createElement('div');
      valueEl.className = `field-value ${highlightClass(value, highlight)}`.trim();
      valueEl.textContent = value;

      row.append(labelEl, valueEl);
      fieldsEl.appendChild(row);
    });
  }

  window.CardModal = { typeName, renderTypeBadge, fieldDefs, renderFields };
})();
