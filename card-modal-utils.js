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

  // 內部代碼 → 中文對照；找不到對照的代碼一律不顯示（不露英文代碼與原始 JSON）
  const AT_LABELS = {
    HARVEST_FEED: '收穫・餵食階段', HARVEST_FIELD: '收穫・田地階段', HARVEST_BREED: '收穫・繁殖階段',
    HARVEST_START: '收穫開始', HARVEST_END: '收穫結束', HARVEST_REAP_END: '收穫・收成後',
    WORK_PHASE: '工作階段', WORK_PHASE_START: '工作階段開始', WORK_PHASE_END: '工作階段結束',
    RETURN_HOME: '回家階段', REPLENISH_PHASE: '補充階段', ROUND_START: '回合開始', ROUND_END: '回合結束',
  };
  const FREQ_LABELS = {
    max_1_per_game: '每場限 1 次', max_2_per_game: '每場限 2 次', max_1_per_round: '每回合限 1 次',
    max_1_per_turn: '每次輪到限 1 次', max_1_per_harvest: '每次收穫限 1 次', unlimited: '次數不限',
  };
  const GOOD_LABELS = {
    wood: '木材', clay: '黏土', reed: '蘆葦', stone: '石頭', food: '食物', grain: '穀物', vegetable: '蔬菜',
    sheep: '羊', boar: '野豬', cattle: '牛', animal: '動物', any: '任一資源', building_resource: '建材',
    vp_bonus: '獎勵分', begging_card: '乞討卡', field: '田地', family_member: '家庭成員',
  };
  const OP_LABELS = {
    CONVERT: '轉換', PLACE_ON_ROUND_SPACE: '放到回合格', BUILD_STABLE: '蓋馬廄', PERFORM_ACTION: '執行行動',
    DEPLOY_WORKER: '放置工人', PLOW: '犁田', RENOVATE: '整修', PLAY_CARD: '打出卡牌', FOR_EACH: '依數量計算',
    CHOOSE: '擇一', STORE_ON_CARD: '存放在卡上', BREED: '繁殖', IF: '符合條件時', MOVE: '移動',
    FORGO_ACTION: '放棄行動', EXTRA_DEPLOYMENT: '額外放置工人', BUY_FROM_SUPPLY: '向供應區購買',
    PROVIDE_ZONE: '提供區域', HARVEST_CROP: '收成作物', CREATE_ACTION_SPACE: '新增行動格',
    LEAVE_ON_SPACE: '留在行動格', BUILD_ROOM: '蓋房間', PLACE_MARKER: '放置標記', REFILL_SPACE: '補充行動格',
    OPPONENT_GAINS: '對手獲得', ATTACH_TO_SPACE: '附加於行動格', STACK: '堆疊放置', BUILD_FENCES: '蓋圍欄',
    SKIP_PLACEMENT: '略過放置', SOW: '播種', RECALL_WORKER: '收回工人', REPEAT: '重複',
  };
  const EVENT_LABELS = {
    BUILD_STABLE: '蓋馬廄', BUILD_ROOM: '蓋房間', SOW: '播種', BUILD_FENCES: '蓋圍欄', TAKE_ACCUMULATE: '拿取累積物',
    ANY_ACTION: '任一行動', RENOVATE: '整修', BAKE_BREAD: '烤麵包', HARVEST_CROP: '收成作物',
    PLAY_IMPROVEMENT: '打出發展卡', DEPLOY_WORKER: '放置工人', PLAY_MAJOR: '打出主要發展', PLAY_MINOR: '打出次要發展',
    PLAY_OCCUPATION: '打出職業', PLAY_CARD: '打出卡牌', PLOW: '犁田', FAMILY_GROWTH: '家庭成員增加', BREED: '繁殖',
  };
  const SPACE_LABELS = {
    PLOW_SPACE: '犁田', PLOW_SOW_SPACE: '犁田播種', WOOD1_SPACE: '1 木材', WOOD2_SPACE: '2 木材', WOOD3_SPACE: '3 木材',
    CLAY1_SPACE: '1 黏土', CLAY2_SPACE: '2 黏土', REED_SPACE: '蘆葦', STONE_S2_SPACE: '石頭（第 2 階段）',
    STONE_S4_SPACE: '石頭（第 4 階段）', FISHING_SPACE: '釣魚', DAY_LABORER_SPACE: '日工', TAKE_GRAIN_SPACE: '拿穀物',
    TAKE_VEG_SPACE: '拿蔬菜', TRAVELING_PLAYERS_SPACE: '巡迴藝人', BOAR_SPACE: '野豬', SHEEP_SPACE: '羊', CATTLE_SPACE: '牛',
    FAMILY_GROWTH_SPACE: '家庭成員增加', OCCUPATION_SPACE: '職業', FENCES_SPACE: '圍欄', STARTING_PLAYER_SPACE: '起始玩家',
    SOW_BAKE_SPACE: '播種烤麵包', RENOVATE_BUILD_SPACE: '整修', BUILD_ROOM_STABLE_SPACE: '蓋房間／馬廄',
    BUILD_MAJOR_MINOR_SPACE: '主要／次要發展',
  };
  const HOOK_LABELS = {
    SPACE_OCCUPIED: '行動格被占用', COST_PLAY_OCCUPATION: '打出職業的費用', CAPACITY_PASTURE: '牧場容量',
    COST_BUILD_ROOM: '蓋房間的費用', ACTION_REPLACE: '行動替換', COST_RENOVATE: '整修的費用',
    COST_PLAY_IMPROVEMENT: '打出發展卡的費用', COST_BUILD_FENCE: '蓋圍欄的費用', COST_BUILD_STABLE: '蓋馬廄的費用',
    SPACE_RESTRICTION: '行動格限制', SOW_PLACEMENT: '播種位置', CAPACITY_STABLE: '馬廄容量', COST_FEED: '餵食的費用',
    BREED_RULE: '繁殖規則', CAPACITY_HOUSE_ANIMAL: '房屋可養動物數',
  };
  const TRANSFORM_LABELS = {
    RELAX: '放寬限制', SUBSTITUTE_RESOURCE: '資源替代', SET_VALUE: '改為固定值', DISCOUNT: '折扣',
    SWAP_ACTION: '行動互換', RECLASSIFY: '改變分類', RESTRICT: '加上限制',
  };

  // 備註含內部代碼（如 SOW、PERFORM_ACTION）或原始 JSON 的整段不顯示
  const isPlainNote = (t) => typeof t === 'string' && t.trim() && !/[A-Z]{2,}_[A-Z_]+|\{"|\[\{|\b(?:hook|event:|trigger)\b/.test(t);

  function triggerLabel(trigger) {
    return TRIGGER_LABELS[trigger] || '';
  }

  function atLabel(at) {
    return String(at || '').split(',').map((p) => {
      const t = p.trim();
      const m = /^R(\d+)$/.exec(t);
      return m ? `第 ${m[1]} 回合` : (AT_LABELS[t] || '');
    }).filter(Boolean).join('、');
  }

  function eventOne(ev) {
    if (typeof ev !== 'string') return '';
    if (EVENT_LABELS[ev]) return EVENT_LABELS[ev];
    const i = ev.indexOf(':');
    if (i < 0) return ev === 'USE_SPACE' ? '使用行動格' : '';
    const head = ev.slice(0, i), tail = ev.slice(i + 1);
    if (head === 'USE_SPACE' && SPACE_LABELS[tail]) return `使用「${SPACE_LABELS[tail]}」行動格`;
    if (head === 'GAIN' && GOOD_LABELS[tail]) return `獲得${GOOD_LABELS[tail]}`;
    return '';
  }

  function eventLabel(event) {
    return [].concat(event || []).map(eventOne).filter(Boolean).join('／');
  }

  function opLine(op) {
    // 逐條顯示效果指令：只顯示有中文對照的內容，其餘不顯示（回傳空字串）
    if (!op || !OP_LABELS[op.op] && op.op !== 'GAIN' && op.op !== 'PAY' && op.op !== 'LOSE') return '';
    if (op.op === 'GAIN' || op.op === 'PAY' || op.op === 'LOSE') {
      const good = GOOD_LABELS[op.good];
      if (!good) return '';
      const verb = { GAIN: '獲得', PAY: '支付', LOSE: '失去' }[op.op];
      return typeof op.amount === 'number' ? `${verb} ${good} × ${op.amount}` : `${verb} ${good}`;
    }
    if (op.op === 'CONVERT' && GOOD_LABELS[op.from] && GOOD_LABELS[op.to]) {
      return `轉換：${GOOD_LABELS[op.from]} → ${GOOD_LABELS[op.to]}`;
    }
    return OP_LABELS[op.op];
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
      section([triggerLabel(group.trigger), eventLabel(group.event), atLabel(group.at)].filter(Boolean).join(' ・ ') || '效果');
      const meta = [];
      if (group.optional) meta.push('可選');
      if (FREQ_LABELS[group.freq]) meta.push(FREQ_LABELS[group.freq]);
      if (group.condition) meta.push('有附帶條件');
      if (meta.length) {
        const m = document.createElement('div');
        m.className = 'effects-meta-line';
        m.textContent = meta.join(' ・ ');
        el.appendChild(m);
      }
      (group.effects || []).forEach((op) => {
        const text = opLine(op);
        if (!text) return;
        const line = document.createElement('div');
        line.className = 'effects-op-line';
        line.textContent = text;
        el.appendChild(line);
      });
    });

    if (rec.modifiers && rec.modifiers.length) {
      const lines = rec.modifiers
        .filter((mod) => HOOK_LABELS[mod.hook] && TRANSFORM_LABELS[mod.transform])
        .map((mod) => `${HOOK_LABELS[mod.hook]}：${TRANSFORM_LABELS[mod.transform]}`);
      if (lines.length) section('規則修正');
      lines.forEach((text) => {
        const line = document.createElement('div');
        line.className = 'effects-op-line';
        line.textContent = text;
        el.appendChild(line);
      });
    }

    if (rec.scoringRule && isPlainNote(rec.scoringRule.notes)) {
      section('計分規則');
      const line = document.createElement('div');
      line.className = 'effects-op-line';
      line.textContent = rec.scoringRule.notes;
      el.appendChild(line);
    }

    const foot = document.createElement('div');
    foot.className = 'effects-meta-line';
    const confLabel = { high: '高', medium: '中', low: '低' }[rec.confidence] || rec.confidence || '—';
    foot.textContent = `信心度: ${confLabel}${isPlainNote(rec.notes) ? ' ・ 備註: ' + rec.notes : ''}`;
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
      .card-profile-combo-panel { margin-top: 4px; padding: 8px 10px; border: 1px solid var(--border2); border-radius: 8px; font-size: .8rem; color: var(--text2); line-height: 1.6; max-height: 220px; overflow-y: auto; }
      .card-profile-combo-title { font-size: .75rem; color: var(--text3); margin-bottom: 4px; }
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
      .card-comments-block { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 6px; }
      .card-comments-title { font-size: .75rem; color: var(--text3); letter-spacing: .05em; }
      .card-comments-list { display: flex; flex-direction: column; gap: 6px; font-size: .8rem; color: var(--text3); max-height: 240px; overflow-y: auto; }
      .card-comment { padding: 6px 8px; border-radius: 6px; background: var(--bg2, rgba(127,127,127,.08)); }
      .card-comment-meta { font-size: .7rem; color: var(--text3); display: flex; align-items: center; gap: 8px; }
      .card-comment-del { margin-left: auto; padding: 0 6px; font-size: .7rem; border: none; background: transparent; color: var(--text3); cursor: pointer; text-decoration: underline; }
      .card-comment-text { font-size: .85rem; color: var(--text2); white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.5; }
      .card-comments-form { display: flex; flex-direction: column; gap: 6px; }
      .card-comments-form > .card-profile-dispute-btn { align-self: flex-start; }
      .card-comments-form textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: .8rem; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--border2); background: transparent; color: var(--text2); resize: vertical; }
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

  // 連動名單（1115 Lu：點數字留在 viewer 內展開，不跳頻道圖）
  // 規則與 tools/build_card_profile.cjs deriveCombo 一致：可接＝其他卡 react／pay 該頻道；可餵＝其他卡 cause／bind／get 該頻道
  let comboIdxPromise = null;
  function loadComboIndex() {
    if (!comboIdxPromise) {
      comboIdxPromise = Promise.all([
        fetch('./channels.json').then((r) => r.json()),
        fetch('./card-profile.json').then((r) => r.json()),
      ]).then(([ch, pf]) => {
        const has = (e, r) => (e.role || []).includes(r);
        const src = {}, sink = {};
        for (const id of Object.keys(pf)) {
          for (const e of (ch[id] && ch[id].channels) || []) {
            // 同卡同頻道可能有多筆 entry（例如 react 與 pay 各一），用 Set 去重
            if (has(e, 'cause') || has(e, 'bind') || has(e, 'get')) (src[e.ch] ||= new Set()).add(id);
            if (has(e, 'react') || has(e, 'pay')) (sink[e.ch] ||= new Set()).add(id);
          }
        }
        return { src, sink, pf };
      }).catch((err) => { comboIdxPromise = null; throw err; });
    }
    return comboIdxPromise;
  }

  function comboNumberLink(channel, n, dir, selfId, panel) {
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = String(n);
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const key = channel + '|' + dir;
      if (panel.dataset.key === key && !panel.hidden) { panel.hidden = true; return; }
      panel.dataset.key = key;
      panel.hidden = false;
      panel.textContent = '載入中…';
      loadComboIndex().then(({ src, sink, pf }) => {
        if (panel.dataset.key !== key) return;
        const ids = [...((dir === 'to' ? sink : src)[channel] || [])].filter((id) => id !== selfId);
        const items = ids.map((id) => ({ id, name: (pf[id] && pf[id].name) || id })).sort((x, y) => x.name.localeCompare(y.name, 'zh-Hant'));
        panel.textContent = '';
        const title = document.createElement('div');
        title.className = 'card-profile-combo-title';
        title.textContent = `${channel}・${dir === 'to' ? '可接' : '可餵'} ${items.length} 張`;
        const list = document.createElement('div');
        list.className = 'card-profile-combo-names';
        // 1115 Lu：牌名可點，直接換成那張卡的視窗（頁面有傳 openCard 才可點）
        const opener = openCardById;
        items.forEach(({ id, name }, i) => {
          if (i) list.appendChild(document.createTextNode('、'));
          if (!opener) { list.appendChild(document.createTextNode(name)); return; }
          const b = document.createElement('a');
          b.href = '#';
          b.textContent = name;
          b.addEventListener('click', (e) => { e.preventDefault(); opener(id); });
          list.appendChild(b);
        });
        panel.append(title, list);
      }).catch(() => {
        if (panel.dataset.key === key) panel.textContent = '名單載入失敗，請重新整理再試。';
      });
    });
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

  // 實戰統計的產生日期（card-match-stats.json 的 _meta.generatedAt「2026-11-09 12:00 (台北)」→「11/09」）；只抓一次
  let matchDateP = null;
  function matchDate() {
    return matchDateP ||= fetch('./card-match-stats.json').then((r) => r.json())
      .then((j) => { const m = /^\d{4}-(\d{2})-(\d{2})/.exec(j?._meta?.generatedAt || ''); return m ? `${m[1]}/${m[2]}` : ''; })
      .catch(() => '');
  }

  function renderProfile(entry, selfId) {
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
        const panel = document.createElement('div');
        panel.className = 'card-profile-combo-panel';
        panel.hidden = true;
        const row = profileRow('連動', (valueEl) => {
          items.forEach(({ channel, to, from }) => {
            const span = document.createElement('span');
            span.className = 'card-profile-combo-item';
            span.appendChild(document.createTextNode(channel + ' '));
            if (to !== null) {
              span.appendChild(document.createTextNode('可接 '));
              span.appendChild(comboNumberLink(channel, to, 'to', selfId, panel));
              span.appendChild(document.createTextNode(' 張'));
            }
            if (from !== null) {
              span.appendChild(document.createTextNode(to !== null ? ' ← ' : '← '));
              span.appendChild(comboNumberLink(channel, from, 'from', selfId, panel));
              span.appendChild(document.createTextNode(' 張可餵'));
            }
            valueEl.appendChild(span);
          });
        });
        if (row) { row.appendChild(panel); rows.push(row); }
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
        // Lu 1115：標資料日期（每週一排程才更新；有新局才推，所以日期＝最後一次有新局的統計）
        const at = document.createElement('span');
        at.className = 'card-profile-match-at';
        at.style.cssText = 'color:var(--text3);font-size:.85em;margin-left:6px';
        valueEl.appendChild(at);
        matchDate().then((d) => { if (d) at.textContent = `資料至 ${d}`; });
      });
      if (row) rows.push(row);
    }

    if (!rows.length) return null;

    const block = document.createElement('div');
    block.className = 'card-profile-block';
    rows.forEach((r) => block.appendChild(r));
    return block;
  }

  // ── 每張卡留言板（Lu 1111：人人可看、登入才能留、本人與 GM 可刪、新留言推播 GM）──
  // Firestore agricola_card_comments 一則一筆；規則目前全開，「誰能刪」只在前端擋（同 agricola_notices 的既有作法）
  const FS_DOCS = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';
  const COMMENT_URL = `${FS_DOCS}/agricola_card_comments`;
  const NOTIFY_URL = 'https://lulucola.pages.dev/api/notify-event';
  const fsVal = (v) => (v ? (v.stringValue ?? v.timestampValue ?? '') : '');

  async function loadComments(cardId) {
    const res = await fetch(`${FS_DOCS}:runQuery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery: {
        from: [{ collectionId: 'agricola_card_comments' }],
        where: { fieldFilter: { field: { fieldPath: 'cardId' }, op: 'EQUAL', value: { stringValue: cardId } } },
        limit: 200,
      } }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).filter((r) => r.document).map(({ document: d }) => ({
      name: d.name, authorId: fsVal(d.fields.authorId), author: fsVal(d.fields.author),
      text: fsVal(d.fields.text), createdAt: fsVal(d.fields.createdAt),
    })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  function renderComments(card) {
    const cardId = String(card['卡片ID'] || '');
    const box = document.createElement('div');
    box.className = 'card-comments-block';
    const title = document.createElement('div');
    title.className = 'card-comments-title';
    title.textContent = '💬 留言板';
    const list = document.createElement('div');
    list.className = 'card-comments-list';
    list.textContent = '載入中…';
    const form = document.createElement('div');
    form.className = 'card-comments-form';
    box.append(title, list, form);
    if (!cardId) { list.textContent = '這張卡沒有編號，無法留言'; return box; }

    const auth = typeof getAuth === 'function' ? getAuth() : null;
    const refresh = async () => {
      try {
        const rows = await loadComments(cardId);
        list.replaceChildren();
        if (!rows.length) list.textContent = '還沒有留言，問問題或分享用法吧！';
        for (const c of rows) {
          const item = document.createElement('div');
          item.className = 'card-comment';
          const meta = document.createElement('div');
          meta.className = 'card-comment-meta';
          const when = c.createdAt ? new Date(c.createdAt).toLocaleString('zh-TW', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
          meta.textContent = `${c.author || c.authorId || '?'}・${when}`;
          if (auth && (auth.id === c.authorId || auth.role === 'admin')) {
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'card-comment-del';
            del.textContent = '刪除';
            del.addEventListener('click', async () => {
              del.disabled = true;
              try {
                const res = await fetch(`https://firestore.googleapis.com/v1/${c.name}`, { method: 'DELETE' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                item.remove();
                if (!list.children.length) list.textContent = '還沒有留言，問問題或分享用法吧！';
              } catch (e) { del.disabled = false; del.textContent = `刪除失敗（${e.message}）`; }
            });
            meta.appendChild(del);
          }
          const body = document.createElement('div');
          body.className = 'card-comment-text';
          body.textContent = c.text; // 純文字，不解析 HTML
          item.append(meta, body);
          list.appendChild(item);
        }
      } catch (e) { list.textContent = `留言載入失敗（${e.message}）`; }
    };

    if (!auth) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card-profile-dispute-btn';
      btn.textContent = '登入後留言';
      // 開視窗後才登入：再按一次就換成留言框
      btn.addEventListener('click', () => {
        if (typeof getAuth === 'function' && getAuth()) box.replaceWith(renderComments(card));
        else if (typeof openLoginModal === 'function' && document.getElementById('authModal')) openLoginModal();
        else btn.textContent = '請先到首頁登入';
      });
      form.appendChild(btn);
    } else {
      const note = document.createElement('textarea');
      note.maxLength = 500;
      note.rows = 2;
      note.placeholder = '問問題、分享用法或搭配心得（最多 500 字）';
      const send = document.createElement('button');
      send.type = 'button';
      send.textContent = '送出留言';
      const msg = document.createElement('span');
      msg.className = 'card-profile-dispute-msg';
      send.addEventListener('click', async () => {
        const text = note.value.trim();
        if (!text) { msg.textContent = '請先寫點內容'; return; }
        const str = (v) => ({ stringValue: String(v) });
        send.disabled = true;
        msg.textContent = '送出中…';
        try {
          const res = await fetch(COMMENT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: {
            cardId: str(cardId), cardName: str(card['牌名'] || ''), authorId: str(auth.id),
            author: str(auth.displayId || auth.id), role: str(auth.role || 'player'), text: str(text),
            createdAt: { timestampValue: new Date().toISOString() },
          } }) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const docId = String((await res.json()).name || '').split('/').pop();
          // 推播 GM：失敗不影響留言本身（text/plain 免 CORS 預檢，同 auth.js 登入的作法）
          fetch(NOTIFY_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ kind: 'card-comment', eventId: docId }) }).catch(() => {});
          note.value = '';
          msg.textContent = '已送出';
          await refresh();
        } catch (e) { msg.textContent = `送出失敗（${e.message}），請稍後再試`; }
        send.disabled = false;
      });
      const actions = document.createElement('div');
      actions.className = 'card-profile-dispute-actions';
      actions.append(send, msg);
      form.append(note, actions);
    }
    refresh();
    return box;
  }

  // 掛在 afterEl（通常是 .modal-desc-wrap）之後；每次開視窗先清掉上一次插入的區塊
  // card 有給才掛留言板（沒有卡片類型資料的卡也有留言板）
  // openCard(cardId)：頁面提供的「打開某張卡」函式，連動名單的牌名靠它換卡（沒傳就只顯示文字）
  let openCardById = null;
  function mountProfile(afterEl, entry, card, openCard) {
    if (!afterEl) return;
    openCardById = typeof openCard === 'function'
      ? (id) => { openCard(id); const box = afterEl.closest('.modal-box, .modal-content, .modal'); if (box) box.scrollTop = 0; }
      : null;
    for (let next = afterEl.nextElementSibling; next && /card-(profile|comments)-block/.test(next.className); next = afterEl.nextElementSibling) next.remove();
    injectProfileStyles();
    const block = renderProfile(entry, card ? String(card['卡片ID'] ?? '').trim() : '');
    let anchor = afterEl;
    if (block) { afterEl.insertAdjacentElement('afterend', block); anchor = block; }
    if (card) anchor.insertAdjacentElement('afterend', renderComments(card));
  }

  // ── 狀態資訊（Lu 1120 整合：圖鑑以外的卡片視窗也看得到禁卡／BGA／取代關係／牌力）──
  // opts.bannedIds(Set)、opts.bgaExtraIds(Set，搭配 site-lists.js)、opts.allCards、
  // opts.dupInfo（DuplicateCards.loadDuplicateInfo 的結果）、
  // opts.ratings（卡片ID → { elo, seenCount, rankSeen, lugaDealt, lugaPick, lugaPickPosSum }，要 v6 含實戰欄位）、
  // opts.tiers（卡片ID → 'S' 或 CardTiers.compute 的 { tier }）。沒給的項目就不顯示。
  const RATING_MIN_SEEN = 5;
  function statusFields(card, opts = {}) {
    const id = String(card['卡片ID'] ?? '').trim();
    const out = [];
    const all = opts.allCards || [];
    const DC = window.DuplicateCards;
    if (opts.dupInfo && DC) {
      const key = DC.getCardKey(card);
      const label = (c) => `${c['牌名'] || '未命名'}（${c['卡片ID']}）`;
      const refs = new Set((opts.dupInfo.canonicalMap?.get(key) || []).flatMap((e) => e.replacedRefs || []));
      const replaced = all.filter((c) => refs.has(DC.getCardKey(c))).map(label);
      if (replaced.length) out.push(['取代卡牌', replaced.join('、'), 'replace']);
      const by = opts.dupInfo.cardToPair?.get(key);
      if (by) {
        const canon = DC.resolveCardRef(all, by.canonId);
        out.push(['被取代', `${canon ? label(canon) : by.canonId}（重複卡，不進牌池）`, 'replace']);
      }
    }
    if (opts.ratings) {
      const r = opts.ratings[id];
      const enough = r && r.seenCount + (r.rankSeen || 0) >= RATING_MIN_SEEN;
      if (opts.bannedIds?.has(id)) {
        out.push(['牌力', '禁卡']);
        if (enough) out.push(['ELO 分數', String(Math.round(r.elo))]);
      } else if (enough) {
        const t = opts.tiers?.get(id);
        if (opts.tiers) out.push(['牌力 Tier', (t && t.tier) || (typeof t === 'string' ? t : '—')]);
        out.push(['ELO 分數', String(Math.round(r.elo))]);
      } else {
        out.push(['ELO 分數', '樣本不足']);
      }
      out.push(['實戰輪抽', r?.lugaDealt
        ? `發到 ${r.lugaDealt} 次・被選 ${r.lugaPick} 次${r.lugaPick ? `・平均第 ${(r.lugaPickPosSum / r.lugaPick).toFixed(1)} 手被拿` : '・都沒人拿'}`
        : '尚無']);
    }
    return out;
  }

  // 在 .modal-sub-row 的卡片 ID 後面放禁卡／BGA 徽章＋「比較」連結（重開時先清掉上一張的）
  function renderStatusBadges(subRow, card, opts = {}) {
    if (!subRow) return;
    const id = String(card['卡片ID'] ?? '').trim();
    subRow.querySelectorAll('.cm-status-badge').forEach((n) => n.remove());
    let link = subRow.querySelector('.modal-compare-link');
    if (!link) {
      link = document.createElement('a');
      link.className = 'modal-compare-link';
      link.title = '拿這張去跟別張卡並排比較';
      link.textContent = '⚖ 比較';
      subRow.appendChild(link);
    }
    link.href = `./compare.html?ids=${encodeURIComponent(id)}`;
    const badges = [];
    if (opts.bannedIds?.has(id)) badges.push(['modal-ban-badge', '禁卡']);
    if (opts.bgaExtraIds && window.SiteLists?.isBga(card, opts.bgaExtraIds)) badges.push(['modal-bga-badge', 'BGA']);
    badges.forEach(([cls, text]) => {
      const s = document.createElement('span');
      s.className = `${cls} cm-status-badge`;
      s.textContent = text;
      subRow.insertBefore(s, link);
    });
  }

  // ── 自帶 DOM 的卡片視窗（Lu 1115 第一波：文字列表、卡牌比較頁也要點得開完整卡片視窗）──
  // 跟卡牌圖鑑同一套樣式（style.css 的 .modal-*）；卡圖用 CardImages.getPath（頁面要先載 card-images.js）
  // opts.profileMap：卡片ID → card-profile；opts.allCards：連動名單換卡時用來找卡
  let quick = null;
  function open(card, opts = {}) {
    if (!quick) {
      quick = document.createElement('div');
      quick.className = 'modal-overlay';
      quick.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
        <button class="modal-close" type="button" aria-label="關閉">✕</button>
        <div class="modal-inner">
          <div class="modal-image-wrap"><img alt="" class="cm-quick-img" /></div>
          <div class="modal-info">
            <div class="modal-title-row"><h2 class="modal-title"></h2><div class="modal-badge"></div></div>
            <div class="modal-sub-row"><div class="modal-id"></div>
              <a class="modal-compare-link" href="./compare.html" title="拿這張去跟別張卡並排比較">⚖ 比較</a></div>
            <div class="modal-fields"></div>
            <div class="modal-desc-wrap"><div class="modal-desc-label">說明</div><div class="modal-desc"></div></div>
          </div>
        </div></div>`;
      document.body.appendChild(quick);
      // 卡圖整張縮進框內（手機版圖框只有 200px 高，同圖鑑的 canvas）
      const st = document.createElement('style');
      st.textContent = '.cm-quick-img{display:block;max-width:100%;max-height:70vh;object-fit:contain}@media (max-width:540px){.cm-quick-img{max-height:200px}}';
      document.head.appendChild(st);
      const close =() => { quick.classList.remove('open'); document.body.style.overflow = ''; };
      quick.querySelector('.modal-close').addEventListener('click', close);
      quick.addEventListener('click', (e) => { if (e.target === quick) close(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && quick.classList.contains('open')) close(); });
    }
    const q = (s) => quick.querySelector(s);
    const id = String(card['卡片ID'] ?? '').trim();
    q('.modal-title').textContent = card['牌名'] || '—';
    q('.modal-id').textContent = id;
    renderTypeBadge(q('.modal-badge'), card);
    renderFields(q('.modal-fields'), fieldDefs(card).concat(statusFields(card, opts)));
    q('.modal-desc').textContent = card['說明'] || '—';
    renderStatusBadges(q('.modal-sub-row'), card, opts);
    const img = q('.modal-image-wrap img');
    img.style.display = 'none';
    img.removeAttribute('src');
    img.alt = card['牌名'] || '';
    // 卡圖清單要先載完才查得到路徑；載完時視窗若已換卡就不蓋
    Promise.resolve(window.CardImages?.load?.()).catch(() => {}).then(() => {
      if (q('.modal-id').textContent !== id) return;
      const src = window.CardImages?.getPath?.(card) || '';
      img.style.display = src ? '' : 'none';
      if (src) img.src = src;
    });
    const all = opts.allCards || [];
    mountProfile(q('.modal-desc-wrap'), (opts.profileMap || {})[id], card, (cid) => {
      const c = all.find((x) => String(x['卡片ID'] ?? '').trim() === cid);
      if (c) open(c, opts);
    });
    quick.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  // 目前開著哪張卡（沒開＝null）；頁面晚到的資料（評分）載完時用來判斷要不要重畫
  const currentId = () => (quick && quick.classList.contains('open') ? quick.querySelector('.modal-id').textContent : null);

  window.CardModal = { typeName, renderTypeBadge, fieldDefs, renderFields, renderEffects, renderProfile, mountProfile, statusFields, renderStatusBadges, open, currentId };
})();
