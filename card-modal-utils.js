/* Shared card modal helpers: keep card details consistent across pages. */
(function () {
  function typeName(card) {
    if (card.card_type === 'minor') return '次要發展卡';
    if (card.card_type === 'occupation') return '職業卡';
    if (card.card_type === 'major') return '主要發展卡';
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
        ['紅利分數', card['紅利分數'], 'bonus'],
        ['負分標記', card['負分標記'], 'minus'],
        ['牌組', card['牌組']],
      ];
    }

    return [
      ['先決條件', card['先決條件']],
      ['費用', card['費用']],
      ['是否傳遞', card['是否傳遞']],
      ['勝利點數', card['勝利點數'], 'vp'],
      ['紅利分數', card['紅利分數'], 'bonus'],
      ['負分標記', card['負分標記'], 'minus'],
      ['牌組', card['牌組']],
    ];
  }

  function highlightClass(value, highlight) {
    if (highlight === 'vp' && value !== '無') {
      return String(value).startsWith('-') ? 'highlight-vp-neg' : 'highlight-vp';
    }
    if (highlight === 'bonus' && value === '有') return 'highlight-bonus';
    if (highlight === 'minus' && value === '有') return 'highlight-minus';
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

  // ── 結構化卡效顯示（純顯示，不執行任何效果）──────────
  const TRIGGER_LABELS = {
    T1_ON_PLAY: '打出時',
    T2_MODIFIER: '常駐修正',
    T3_ANYTIME: '隨時可用',
    T4_EVENT: '事件觸發',
    T5_TIMING: '固定時機',
    T6_SCORING: '計分規則',
    T7_AUCTION: '競標',
  };

  function triggerLabel(trigger) {
    const zh = TRIGGER_LABELS[trigger] || trigger;
    return `${zh}（${trigger}）`;
  }

  function opLine(op) {
    // 逐條顯示效果指令：常見 GAIN/PAY 類給簡短摘要，其餘退回精簡 JSON
    if (op && op.op === 'GAIN' && op.good) return `獲得 ${op.good} × ${JSON.stringify(op.amount)}`;
    if (op && op.op === 'PAY' && op.good) return `支付 ${op.good} × ${JSON.stringify(op.amount)}`;
    return JSON.stringify(op);
  }

  function renderEffects(el, rec) {
    if (!el) return;
    el.innerHTML = '';
    if (!rec) return;

    const section = (title) => {
      const h = document.createElement('div');
      h.className = 'effects-section-title';
      h.textContent = title;
      el.appendChild(h);
    };

    (rec.effects || []).forEach((group) => {
      section(triggerLabel(group.trigger) + (group.event ? ` ・ ${JSON.stringify(group.event)}` : '') + (group.at ? ` ・ ${group.at}` : ''));
      const meta = [];
      if (group.optional) meta.push('可選');
      if (group.freq) meta.push(group.freq);
      if (group.condition) meta.push(`條件: ${JSON.stringify(group.condition)}`);
      if (meta.length) {
        const m = document.createElement('div');
        m.className = 'effects-meta-line';
        m.textContent = meta.join(' ・ ');
        el.appendChild(m);
      }
      (group.effects || []).forEach((op) => {
        const line = document.createElement('div');
        line.className = 'effects-op-line';
        line.textContent = opLine(op);
        el.appendChild(line);
      });
    });

    if (rec.modifiers && rec.modifiers.length) {
      section('規則修正（modifiers）');
      rec.modifiers.forEach((mod) => {
        const line = document.createElement('div');
        line.className = 'effects-op-line';
        line.textContent = `${mod.hook} → ${mod.transform} ${JSON.stringify(mod.params || {})}`;
        el.appendChild(line);
      });
    }

    if (rec.scoringRule) {
      section('計分規則（scoringRule）');
      const line = document.createElement('div');
      line.className = 'effects-op-line';
      line.textContent = JSON.stringify(rec.scoringRule);
      el.appendChild(line);
    }

    const foot = document.createElement('div');
    foot.className = 'effects-meta-line';
    const confLabel = { high: '高', medium: '中', low: '低' }[rec.confidence] || rec.confidence || '—';
    foot.textContent = `信心度: ${confLabel}${rec.notes ? ' ・ 備註: ' + rec.notes : ''}`;
    el.appendChild(foot);
  }

  window.CardModal = { typeName, renderTypeBadge, fieldDefs, renderFields, renderEffects };
})();
