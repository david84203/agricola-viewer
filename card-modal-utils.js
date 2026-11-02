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
      .card-profile-dispute-btn { margin-left: auto; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--border2); background: transparent; color: var(--text3); font-size: .72rem; cursor: pointer; }
      .card-profile-dispute-btn:hover { color: var(--text2); border-color: var(--text3); }
      .card-profile-dispute { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; padding: 8px; border: 1px dashed var(--border2); border-radius: 8px; }
      .card-profile-dispute-hint { font-size: .75rem; color: var(--text3); }
      .card-profile-dispute-chips { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: .8rem; color: var(--text2); }
      .card-profile-dispute-chips label { display: inline-flex; align-items: center; gap: 3px; cursor: pointer; }
      .card-profile-dispute textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: .8rem; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--border2); background: transparent; color: var(--text2); resize: vertical; }
      .card-profile-dispute-actions { display: flex; align-items: center; gap: 8px; }
      .card-profile-dispute-actions button { padding: 3px 14px; border-radius: 6px; border: 1px solid var(--gold); background: transparent; color: var(--gold2); font-size: .8rem; cursor: pointer; }
      .card-profile-dispute-actions button:disabled { opacity: .5; cursor: default; }
      .card-profile-dispute-msg { font-size: .75rem; color: var(--text3); }
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

  // 推薦搭配異議（Lu 1103：任何使用者都能提，不限評分者／GM）→ Firestore agricola_best_disputes，一筆一則
  const DISPUTE_URL = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents/agricola_best_disputes';
  function disputeForm(entry) {
    const box = document.createElement('div');
    box.className = 'card-profile-dispute';
    const hint = document.createElement('div');
    hint.className = 'card-profile-dispute-hint';
    hint.textContent = '勾出不該推薦的卡，或寫下應該推哪些／理由：';
    const chips = document.createElement('div');
    chips.className = 'card-profile-dispute-chips';
    const checks = entry.best.map((name) => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = name;
      label.append(cb, document.createTextNode(name));
      chips.appendChild(label);
      return cb;
    });
    const note = document.createElement('textarea');
    note.maxLength = 500;
    note.rows = 2;
    note.placeholder = '例：犁具彼此是替代品，該配農田夢想家這類卡';
    const send = document.createElement('button');
    send.type = 'button';
    send.textContent = '送出';
    const msg = document.createElement('span');
    msg.className = 'card-profile-dispute-msg';
    send.addEventListener('click', async () => {
      const wrong = checks.filter((c) => c.checked).map((c) => c.value);
      const text = note.value.trim();
      if (!wrong.length && !text) { msg.textContent = '請至少勾一張或寫一句理由'; return; }
      const auth = typeof getAuth === 'function' ? getAuth() : null;
      const str = (v) => ({ stringValue: String(v) });
      const fields = {
        cardName: str(entry.name),
        shown: { arrayValue: { values: entry.best.map(str) } },
        wrong: { arrayValue: { values: wrong.map(str) } },
        note: str(text),
        reporter: str(auth ? (auth.displayId || auth.id) : '?'),
        role: str((auth && auth.role) || 'anonymous'),
        status: str('pending'),
        createdAt: { timestampValue: new Date().toISOString() },
      };
      send.disabled = true;
      msg.textContent = '送出中…';
      try {
        const res = await fetch(DISPUTE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        box.replaceChildren(Object.assign(document.createElement('span'), { className: 'card-profile-dispute-msg', textContent: '已送出，謝謝！我們會依回報調整推薦規則。' }));
      } catch (e) {
        send.disabled = false;
        msg.textContent = `送出失敗（${e.message}），請稍後再試`;
      }
    });
    const actions = document.createElement('div');
    actions.className = 'card-profile-dispute-actions';
    actions.append(send, msg);
    box.append(hint, chips, note, actions);
    return box;
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

    // 特性（1103：Lu 舊 25 類補進來的 5 類）
    if (Array.isArray(entry.traits) && entry.traits.length) {
      const row = profileRow('特性', (valueEl) => {
        entry.traits.forEach((t) => {
          const tag = document.createElement('span');
          tag.className = 'card-profile-tag';
          tag.textContent = t;
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

    // 推薦搭配（1103 原名「最搭」）：1103 晚規則重寫（同觸發點疊加／開路／免空同打法／衝突不推，見 build_card_profile.cjs deriveBest）後重開
    const SHOW_BEST = true;
    if (SHOW_BEST && Array.isArray(entry.best) && entry.best.length) {
      const row = profileRow('推薦搭配', (valueEl) => {
        const span = document.createElement('span');
        span.className = 'card-profile-combo-item';
        span.textContent = entry.best.join('、');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'card-profile-dispute-btn';
        btn.textContent = '提出異議';
        btn.addEventListener('click', () => {
          // Lu 1103：要登入才能提（玩家／評分者／GM 都行，訪客不行）
          if (!(typeof getAuth === 'function' && getAuth())) {
            if (typeof openLoginModal === 'function') openLoginModal();
            else btn.textContent = '請先登入再提出異議';
            return;
          }
          const open = row.querySelector('.card-profile-dispute');
          if (open) open.remove(); else row.appendChild(disputeForm(entry));
        });
        valueEl.append(span, btn);
      });
      if (row) rows.push(row);
    }

    // 實戰（1103）：LUGA 正式 4 人局（不含雙打）打出這張的紀錄；<5 局只報局數＋樣本不足
    if (entry.match && entry.match.n > 0) {
      const m = entry.match;
      const row = profileRow('實戰', (valueEl) => {
        const span = document.createElement('span');
        span.className = 'card-profile-combo-item';
        span.textContent = m.n >= 5
          ? `出現 ${m.n} 局・平均第 ${m.avgRank.toFixed(1)} 名・前兩名 ${Math.round(m.top2 * 100)}%`
          : `出現 ${m.n} 局・樣本不足`;
        valueEl.appendChild(span);
      });
      if (row) rows.push(row);
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
