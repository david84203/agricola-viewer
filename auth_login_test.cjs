// 登入防呆（2026-09-11，房號 9UZE：KG 桌機登成長得一模一樣的另一個帳號，整局被判成觀戰者）
//   1. 建新帳號前一定先確認，沒確認不會寫入
//   2. 全形英數、隱形字元自動正規化；當初就用全形註冊的舊帳號照樣登得進去
//   3. 只差大小寫時提示相似帳號
// 執行：node auth_login_test.cjs
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');

let passed = 0, failed = 0;
function ok(name, cond, actual) {
  if (cond) { passed++; console.log('PASS', name); }
  else { failed++; console.log('FAIL', name, '→', JSON.stringify(actual)); }
}

async function sha256(text) {
  const buf = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function makeAuth(accounts) {
  const docs = {};
  for (const [id, info] of Object.entries(accounts)) docs[id] = { pinHash: await sha256(info.pin), role: info.role || null };
  const storage = {};
  const patches = [];
  const PLAYERS = '/documents/agricola_players/';
  const fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.endsWith('/documents/settings/auth')) {
      return { status: 200, ok: true, json: async () => ({ fields: { adminId: { stringValue: 'GM' }, raterPin: { stringValue: 'shared-code' } } }) };
    }
    if (u.includes(':runQuery')) return { status: 200, ok: true, json: async () => [] };
    if (u.includes(PLAYERS)) {
      const id = decodeURIComponent(u.split(PLAYERS)[1].split('?')[0]);
      if (opts.method === 'PATCH') { patches.push(id); return { status: 200, ok: true, json: async () => ({}) }; }
      const doc = docs[id];
      if (!doc) return { status: 404, ok: false, json: async () => ({}) };
      const fields = { pinHash: { stringValue: doc.pinHash } };
      if (doc.role) fields.role = { stringValue: doc.role };
      return { status: 200, ok: true, json: async () => ({ fields }) };
    }
    throw new Error('unexpected fetch ' + u);
  };
  const ctx = {
    fetch, crypto: webcrypto, TextEncoder, console, patches,
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; },
    },
    document: { addEventListener() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'auth.js'), 'utf8'), ctx, { filename: 'auth.js' });
  return ctx;
}

(async () => {
  const base = { KG: { pin: '1234' }, box: { pin: '5555' } };

  // ── 正規化：全形／隱形字元都登進真正的帳號 ──
  for (const typed of ['ＫＧ', 'KG\u200B', ' KG\uFEFF ', 'Ｋ\u200DＧ']) {
    const a = await makeAuth(base);
    const r = await a.loginAccount(typed, '1234');
    ok(`線上登入 ${JSON.stringify(typed)} → 登進 KG`, r.ok && r.id === 'KG' && a.getAuth().id === 'KG', r);
    const p = await (await makeAuth(base)).loginPlayer(typed, '1234');
    ok(`卡牌中心登入 ${JSON.stringify(typed)} → 登進 KG、不建新帳號`, p.ok && p.id === 'KG', p);
  }

  // ── 舊帳號當初就用全形註冊：照樣登得進去 ──
  {
    const a = await makeAuth({ 'ＡＢ': { pin: '8888' } });
    const r = await a.loginAccount('ＡＢ', '8888');
    ok('只有全形舊帳號時，打全形仍登進原帳號', r.ok && r.id === 'ＡＢ', r);
  }
  {
    // 半形與全形兩個帳號並存、PIN 不同：打全形＋全形那組 PIN → 進全形那個（不會被鎖在外面）
    const a = await makeAuth({ KG: { pin: '1234' }, 'ＫＧ': { pin: '9999' } });
    const r = await a.loginAccount('ＫＧ', '9999');
    ok('全形與半形帳號並存時，用全形帳號的 PIN 仍登進全形帳號', r.ok && r.id === 'ＫＧ', r);
    const both = await a.loginAccount('ＫＧ', '0000');
    ok('兩個都對不上 PIN → PIN 錯誤，不登入', !both.ok && /PIN 錯誤/.test(both.error), both);
  }

  // ── 建新帳號一定先確認 ──
  {
    const a = await makeAuth(base);
    const r = await a.loginPlayer('newbie', '4321');
    ok('新 ID 第一次只回 needConfirmCreate', r.needConfirmCreate && r.id === 'newbie' && !r.ok, r);
    ok('未確認前不寫入任何帳號、不登入', a.patches.length === 0 && a.getAuth() === null, a.patches);
    const r2 = await a.loginPlayer('newbie', '4321', { confirmCreate: true });
    ok('確認後才建立帳號並登入', r2.ok && a.patches.length === 1 && a.patches[0] === 'newbie', { r2, patches: a.patches });
  }
  {
    const a = await makeAuth(base);
    const r = await a.loginPlayer('ｎｅｗ', '4321', { confirmCreate: true });
    ok('全形新 ID 建成半形帳號', r.ok && a.patches[0] === 'new', a.patches);
  }

  // ── 只差大小寫：提示相似帳號 ──
  {
    const a = await makeAuth(base);
    const r = await a.loginPlayer('kg', '1234');
    ok('卡牌中心打 kg：要求確認並指出相似帳號 KG', r.needConfirmCreate && r.similarId === 'KG', r);
    ok('確認視窗文字點名 KG', /相似的帳號「KG」/.test(a.createAccountPrompt(r)), a.createAccountPrompt(r));
    const online = await a.loginAccount('kg', '1234');
    ok('線上登入打 kg：錯誤訊息點名相似帳號 KG', !online.ok && /「KG」/.test(online.error), online);
    const none = await a.loginAccount('nobody', '1234');
    ok('完全沒相似帳號：維持原本的查無帳號訊息', !none.ok && /查無此帳號/.test(none.error), none);
  }

  // ── 原本行為不變 ──
  {
    const a = await makeAuth(base);
    const wrong = await a.loginPlayer('KG', '0000');
    ok('PIN 錯誤照擋', !wrong.ok && /PIN 錯誤/.test(wrong.error) && a.patches.length === 0, wrong);
    const migrate = await a.loginAccount('ｒａｔｅｒ', 'shared-code');
    ok('舊評分者共用碼首次登入：導去設定 PIN，ID 已正規化', migrate.needMigrate && migrate.id === 'rater', migrate);
    const reserved = await a.loginPlayer('ＧＭ', '4321', { confirmCreate: true });
    ok('全形 ＧＭ 也不能建成保留帳號', !reserved.ok && /保留帳號/.test(reserved.error) && a.patches.length === 0, reserved);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
