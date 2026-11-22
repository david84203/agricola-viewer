// card-modal-utils.js mountProfile 的「📝 講評」區塊（規格測試，依規格寫、不配合實作）
// 需要 jsdom：npm i --no-save jsdom；每個情境開新的 jsdom window，不依賴 _resetInsightsForTest
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SRC = fs.readFileSync(path.join(__dirname, 'card-modal-utils.js'), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = () => sleep(60);

// insights：物件（JSON 化）／{ body: 物件或字串, deferred?: true }／'reject'／'notok'
function setup(insights) {
  const dom = new JSDOM('<!doctype html><body><div id="wrap"><div class="modal-desc-wrap"></div></div></body>', { runScripts: 'outside-only', url: 'http://localhost/' });
  const w = dom.window;
  const calls = [];
  let release;
  const gate = new Promise((r) => { release = r; });
  w.fetch = (url) => {
    const u = String(url);
    if (!/card-insights\.json/.test(u)) return Promise.reject(new Error('stub: no network'));
    calls.push(u);
    if (insights === 'reject') return Promise.reject(new Error('offline'));
    let res;
    if (insights === 'notok') {
      res = { ok: false, status: 500, json: async () => ({}), text: async () => '' };
    } else {
      const b = insights.body !== undefined ? insights.body : insights;
      const raw = typeof b === 'string' ? b : JSON.stringify(b);
      res = { ok: true, status: 200, json: async () => JSON.parse(raw), text: async () => raw };
    }
    return insights.deferred ? gate.then(() => res) : Promise.resolve(res);
  };
  w.eval(SRC);
  const afterEl = w.document.querySelector('.modal-desc-wrap');
  const CM = w.CardModal;
  const card = (id) => ({ '卡片ID': id, '牌名': 'n' + id });
  const entry = { types: ['食物引擎'], main: '食物引擎' };
  const kids = () => [...afterEl.parentElement.children].filter((e) => e !== afterEl).map((e) => e.className);
  const insightEls = () => [...w.document.querySelectorAll('.card-insight-block')];
  return { w, CM, afterEl, card, entry, calls, release, kids, insightEls };
}
const idx = (kids, re) => kids.findIndex((c) => re.test(c));

const tests = [];
const t = (name, fn) => tests.push([name, fn]);

t('有講評：標題、內文、位置在類型區塊後留言板前', async () => {
  const s = setup({ A1: '很強的一張牌' });
  s.CM.mountProfile(s.afterEl, s.entry, s.card('A1'), null);
  await settle();
  const b = s.insightEls();
  assert.strictEqual(b.length, 1, '應有一個 .card-insight-block');
  assert.ok(b[0].textContent.includes('📝 講評'), '標題含「📝 講評」');
  assert.strictEqual(b[0].querySelector('.card-insight-text').textContent, '很強的一張牌');
  const k = s.kids();
  const p = idx(k, /card-profile-block/), i = idx(k, /card-insight-block/), c = idx(k, /card-comments-block/);
  assert.ok(p >= 0 && i >= 0 && c >= 0, '三區塊都在: ' + k);
  assert.ok(p < i && i < c, '順序應為 類型 < 講評 < 留言板: ' + k);
});

t('沒有類型區塊：講評緊接 afterEl、留言板之前', async () => {
  const s = setup({ A1: 'x' });
  s.CM.mountProfile(s.afterEl, undefined, s.card('A1'), null);
  await settle();
  const k = s.kids();
  assert.ok(/card-insight-block/.test(k[0] || ''), '講評應緊接 afterEl: ' + k);
  assert.ok(/card-comments-block/.test(k[1] || ''), '留言板在其後: ' + k);
  assert.ok(!/card-profile-block/.test(k.join(' ')));
});

t('沒講評（ID 不在檔內／空字串／純空白）→ 無區塊', async () => {
  for (const id of ['NOPE', 'E1', 'W1']) {
    const s = setup({ E1: '', W1: '  \n\t ', A1: 'x' });
    s.CM.mountProfile(s.afterEl, s.entry, s.card(id), null);
    await settle();
    assert.strictEqual(s.insightEls().length, 0, id + ' 不該有講評區塊');
    const k = s.kids().join(' ');
    assert.ok(/card-profile-block/.test(k) && /card-comments-block/.test(k), id + ' 類型區塊與留言板照常');
  }
});

t('壞檔：fetch reject／!ok／壞 JSON → 無講評、不丟錯、其餘照常', async () => {
  for (const bad of ['reject', 'notok', { body: '{not json' }]) {
    const s = setup(bad);
    assert.doesNotThrow(() => s.CM.mountProfile(s.afterEl, s.entry, s.card('A1'), null));
    await settle();
    assert.strictEqual(s.insightEls().length, 0);
    const k = s.kids().join(' ');
    assert.ok(/card-profile-block/.test(k) && /card-comments-block/.test(k), '類型與留言板照常: ' + k);
    assert.ok(s.calls.length >= 1, '前提：真的有試著 fetch');
  }
});

t('整頁只 fetch 一次，網址 ./card-insights.json，載入模組時不先 fetch', async () => {
  const s = setup({ A1: 'a', B2: 'b' });
  assert.strictEqual(s.calls.length, 0, '載入模組時不可先 fetch');
  for (const id of ['A1', 'B2', 'A1']) {
    s.CM.mountProfile(s.afterEl, s.entry, s.card(id), null);
    await settle();
  }
  assert.strictEqual(s.calls.length, 1, 'fetch 次數: ' + s.calls.length);
  assert.strictEqual(s.calls[0], './card-insights.json');
});

t('載入慢：資料回來時仍是卡 A → 補插在正確位置', async () => {
  const s = setup({ deferred: true, body: { A1: '慢慢來' } });
  s.CM.mountProfile(s.afterEl, s.entry, s.card('A1'), null);
  await settle();
  assert.strictEqual(s.insightEls().length, 0, '資料未到前不該有講評');
  s.release();
  await settle();
  assert.strictEqual(s.insightEls().length, 1, '資料到後應補插');
  const k = s.kids();
  assert.ok(idx(k, /card-profile-block/) < idx(k, /card-insight-block/) && idx(k, /card-insight-block/) < idx(k, /card-comments-block/), '位置: ' + k);
});

t('載入慢：資料回來前已換卡 B → A 的講評不出現；B 有講評則顯示 B 的', async () => {
  const s = setup({ deferred: true, body: { A1: '卡A講評', B2: '卡B講評' } });
  s.CM.mountProfile(s.afterEl, s.entry, s.card('A1'), null);
  s.CM.mountProfile(s.afterEl, s.entry, s.card('B2'), null);
  s.release();
  await settle();
  const b = s.insightEls();
  assert.strictEqual(b.length, 1, '應有 B 的講評');
  assert.strictEqual(b[0].querySelector('.card-insight-text').textContent, '卡B講評');
  assert.ok(!s.w.document.body.textContent.includes('卡A講評'));
  const s2 = setup({ deferred: true, body: { A1: '卡A講評' } });
  s2.CM.mountProfile(s2.afterEl, s2.entry, s2.card('A1'), null);
  s2.CM.mountProfile(s2.afterEl, s2.entry, s2.card('B2'), null);
  s2.release();
  await settle();
  assert.strictEqual(s2.insightEls().length, 0, 'B 沒講評，A 的不可補上');
});

t('換卡：舊講評區塊被清掉，不疊兩個', async () => {
  const s = setup({ A1: '甲', B2: '乙' });
  s.CM.mountProfile(s.afterEl, s.entry, s.card('A1'), null);
  await settle();
  s.CM.mountProfile(s.afterEl, s.entry, s.card('B2'), null);
  await settle();
  const b = s.insightEls();
  assert.strictEqual(b.length, 1, '只剩一個');
  assert.strictEqual(b[0].querySelector('.card-insight-text').textContent, '乙');
  s.CM.mountProfile(s.afterEl, s.entry, s.card('NOPE'), null);
  await settle();
  assert.strictEqual(s.insightEls().length, 0, '換到沒講評的卡要清掉舊的');
  assert.strictEqual(s.w.document.querySelectorAll('.card-comments-block').length, 1);
});

t('純文字：<b>x</b> 原樣顯示、換行保留', async () => {
  const s = setup({ A1: '第一行 <b>x</b>\n第二行 & <i>y</i>' });
  s.CM.mountProfile(s.afterEl, s.entry, s.card('A1'), null);
  await settle();
  const blocks = s.insightEls();
  assert.strictEqual(blocks.length, 1, '應有講評區塊');
  const el = blocks[0].querySelector('.card-insight-text');
  assert.strictEqual(el.textContent, '第一行 <b>x</b>\n第二行 & <i>y</i>');
  assert.strictEqual(el.querySelector('b, i'), null, '不可變成 HTML 元素');
});

(async () => {
  let fail = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log('PASS  ' + name); }
    catch (e) { fail++; console.log('FAIL  ' + name + '\n      ' + String(e.message).split('\n')[0]); }
  }
  console.log(fail ? `\n${fail}/${tests.length} 失敗` : `\n全部 ${tests.length} 條通過`);
  process.exit(fail ? 1 : 0);
})();
