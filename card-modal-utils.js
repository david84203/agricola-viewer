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

  // ── 卡片類型系統（card-profile.json）純顯示四行：類型／路線／代價／連動 ──
  const COMBO_HIDE_ABOVE = 80; // 數字 > 80 視為材料類雜訊，不顯示

  function injectProfileStyles() {
    if (document.getElementById('card-profile-styles')) return;
    const style = document.createElement('style');
    style.id = 'card-profile-styles';
    style.textContent = `
      .card-profile-block { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
      .card-profile-row { display: flex; flex-direction: column; gap: 3px; }
      .card-profile-label { font-size: .7rem; color: var(--text3); letter-spacing: .06em; text-transform: uppercase; }
      .card-profile-value { font-size: .85rem; color: var(--text2); display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; line-height: 1.5; }
      .card-profile-tag { display: inline-block; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--border2); color: var(--text2); font-size: .78rem; }
      .card-profile-tag.is-main { border-color: var(--gold); color: var(--gold2); font-weight: 600; }
      .card-profile-tag.is-dual { border-color: var(--blue); color: var(--blue); font-size: .72rem; }
      .card-profile-combo-item { color: var(--text2); }
      .card-profile-value a { color: var(--blue); font-weight: 600; text-decoration: none; }
      .card-profile-value a:hover { text-decoration: underline; }
    `;
    document.head.appendChild(style);
  }

  function profileRow(label, fill) {
    const row = document.createElement('div');
    row.className = 'card-profile-row';
    const labelEl = document.createElement('div');
    labelEl.className = 'card-profile-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('div');
    valueEl.className = 'card-profile-value';
    fill(valueEl);
    if (!valueEl.childNodes.length) return null;
    row.append(labelEl, valueEl);
    return row;
  }

  function comboNumberLink(channel, n) {
    const a = document.createElement('a');
    a.href = `頻道圖.html#${encodeURIComponent(channel)}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = String(n);
    return a;
  }

  function renderProfile(entry) {
    if (!entry) return null;
    injectProfileStyles();
    const rows = [];

    // 類型（最多 3 個，第一個＝主類型加粗；dual 尾巴加標籤）
    if (Array.isArray(entry.types) && entry.types.length) {
      const row = profileRow('類型', (valueEl) => {
        entry.types.slice(0, 3).forEach((t, i) => {
          const tag = document.createElement('span');
          tag.className = 'card-profile-tag' + (i === 0 ? ' is-main' : '');
          tag.textContent = t;
          valueEl.appendChild(tag);
        });
        if (entry.dual) {
          const tag = document.createElement('span');
          tag.className = 'card-profile-tag is-dual';
          tag.textContent = '雙色卡';
          valueEl.appendChild(tag);
        }
      });
      if (row) rows.push(row);
    }

    // 路線（最多 3 個）；有類型但路線空＝「通用」（規格第十一節 Q2）。類型也空的整塊照舊不顯示
    if (rows.length) {
      const routes = (Array.isArray(entry.routes) && entry.routes.length) ? entry.routes : ['通用'];
      const row = profileRow('路線', (valueEl) => {
        routes.slice(0, 3).forEach((r) => {
          const tag = document.createElement('span');
          tag.className = 'card-profile-tag';
          tag.textContent = r;
          valueEl.appendChild(tag);
        });
      });
      if (row) rows.push(row);
    }

    // 代價（支付／乞討／餵養）
    if (entry.cost) {
      const parts = [];
      if (Array.isArray(entry.cost.pay) && entry.cost.pay.length) parts.push('支付 ' + entry.cost.pay.join('／'));
      if (entry.cost.beg) parts.push('會吃乞討');
      if (entry.cost.feed) parts.push('餵養變重');
      if (parts.length) {
        const row = profileRow('代價', (valueEl) => {
          const span = document.createElement('span');
          span.textContent = parts.join('・');
          valueEl.appendChild(span);
        });
        if (row) rows.push(row);
      }
    }

    // 連動（combo）：每個頻道一則，>80 的數字不顯示，兩個數字都被藏就整則不顯示
    if (entry.combo) {
      const items = [];
      Object.entries(entry.combo).forEach(([channel, v]) => {
        const to = (v && typeof v.to === 'number' && v.to <= COMBO_HIDE_ABOVE) ? v.to : null;
        const from = (v && typeof v.from === 'number' && v.from <= COMBO_HIDE_ABOVE) ? v.from : null;
        if (to === null && from === null) return;
        items.push({ channel, to, from });
      });
      if (items.length) {
        const row = profileRow('連動', (valueEl) => {
          items.forEach(({ channel, to, from }) => {
            const span = document.createElement('span');
            span.className = 'card-profile-combo-item';
            span.appendChild(document.createTextNode(channel + ' '));
            if (to !== null) {
              span.appendChild(document.createTextNode('可接 '));
              span.appendChild(comboNumberLink(channel, to));
              span.appendChild(document.createTextNode(' 張'));
            }
            if (from !== null) {
              span.appendChild(document.createTextNode(to !== null ? ' ← ' : '← '));
              span.appendChild(comboNumberLink(channel, from));
              span.appendChild(document.createTextNode(' 張可餵'));
            }
            valueEl.appendChild(span);
          });
        });
        if (row) rows.push(row);
      }
    }

    if (!rows.length) return null;

    const block = document.createElement('div');
    block.className = 'card-profile-block';
    rows.forEach((r) => block.appendChild(r));
    return block;
  }

  // 掛在 afterEl（通常是 .modal-desc-wrap）之後；每次開視窗先清掉上一次插入的區塊
  function mountProfile(afterEl, entry) {
    if (!afterEl) return;
    const next = afterEl.nextElementSibling;
    if (next && next.classList.contains('card-profile-block')) next.remove();
    const block = renderProfile(entry);
    if (block) afterEl.insertAdjacentElement('afterend', block);
  }

  window.CardModal = { typeName, renderTypeBadge, fieldDefs, renderFields, renderEffects, renderProfile, mountProfile };
})();
