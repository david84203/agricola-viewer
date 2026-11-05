// 伺服器登入（2026-11-06 第 0 階段）前端：先問 /api/login，伺服器不可用才退回瀏覽器比對。
// 執行：node auth_server_login_test.cjs
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
const reply = (status, data) => ({ status, ok: status < 300, json: async () => data });

// server：(body) => [status, data] 或 'down'（連線失敗）
async function makeAuth(server, hostname = 'agricola-viewer.vercel.app') {
  const storage = {};
  const calls = { login: [], players: 0, exchange: 0 };
  const kgHash = await sha256('1234');
  const fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.endsWith('/api/login')) {
      calls.login.push(u);
      const r = server(JSON.parse(opts.body));
      if (r === 'down') throw new Error('network');
      return reply(r[0], r[1]);
    }
    if (u.includes('signInWithCustomToken')) { calls.exchange++; return reply(200, { idToken: 'id', refreshToken: 'refresh', expiresIn: '3600' }); }
    if (u.endsWith('/documents/settings/auth')) return reply(200, { fields: { adminId: { stringValue: 'GM' } } });
    if (u.includes(':runQuery')) return reply(200, []);
    if (u.includes('/agricola_players/')) {
      calls.players++;
      return u.includes('/agricola_players/KG') ? reply(200, { fields: { pinHash: { stringValue: kgHash } } }) : reply(404, {});
    }
    throw new Error('unexpected fetch ' + u);
  };
  const ctx = {
    fetch, crypto: webcrypto, TextEncoder, console: { ...console, warn() {} }, setTimeout, location: { hostname },
    localStorage: { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } },
    document: { addEventListener() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'auth.js'), 'utf8'), ctx, { filename: 'auth.js' });
  return { ctx, calls, storage };
}
const tick = () => new Promise((r) => setTimeout(r, 20));

(async () => {
  {
    const { ctx, calls, storage } = await makeAuth(() => [200, { ok: true, id: 'KG', role: 'player', customToken: 'ct' }]);
    const r = await ctx.loginAccount('KG', '1234');
    await tick();
    ok('伺服器說對就登入，不再自己讀 PIN 雜湊', r.ok && ctx.getAuth().id === 'KG' && calls.players === 0, { r, calls });
    ok('卡牌中心呼叫完整網址', calls.login[0] === 'https://lulucola.pages.dev/api/login', calls.login);
    ok('自訂憑證換成 Firebase 登入並存起來', calls.exchange === 1 && JSON.parse(storage.agricola_fb_session).refreshToken === 'refresh', storage);
    ctx.clearAuth();
    ok('登出時一併清掉 Firebase 登入', !storage.agricola_fb_session && !ctx.getAuth(), storage);
  }
  {
    const { ctx, calls } = await makeAuth(() => [200, { ok: true, id: 'KG', role: 'player', customToken: 'ct' }], 'lulucola.pages.dev');
    await ctx.loginAccount('KG', '1234');
    ok('對戰站同網域走相對路徑', calls.login[0] === '/api/login', calls.login);
  }
  {
    const { ctx } = await makeAuth(() => [401, { error: 'bad_pin', remaining: 2 }]);
    const r = await ctx.loginAccount('KG', '9999');
    ok('剩 2 次時提醒會鎖', !r.ok && r.error.includes('再錯 2 次會鎖 15 分鐘'), r);
  }
  {
    const { ctx } = await makeAuth(() => [401, { error: 'bad_pin', remaining: 4 }]);
    const r = await ctx.loginPlayer('KG', '9999');
    ok('剩很多次時只說 PIN 錯', !r.ok && r.error.startsWith('PIN 錯誤') && !r.error.includes('會鎖'), r);
  }
  {
    const { ctx, calls } = await makeAuth(() => [423, { error: 'locked', retryAfter: 600 }]);
    const r = await ctx.loginPlayer('KG', '1234');
    ok('鎖住時顯示分鐘數，也不退回瀏覽器比對', !r.ok && r.error.includes('10 分鐘') && calls.players === 0 && !ctx.getAuth(), { r, calls });
  }
  {
    let n = 0;
    const { ctx, calls } = await makeAuth(() => (++n === 1 ? [429, { error: 'busy' }] : [200, { ok: true, id: 'KG', role: 'player', customToken: 'ct' }]));
    const r = await ctx.loginAccount('KG', '1234');
    ok('剛好撞到另一個請求時自動重試一次', r.ok && calls.login.length === 2, { r, calls });
  }
  {
    const { ctx } = await makeAuth(() => [404, { error: 'not_found' }]);
    const r = await ctx.loginPlayer('newbie', '5678');
    ok('查無帳號照舊走「確認建立」流程', r.needConfirmCreate && r.id === 'newbie', r);
  }
  for (const [label, server] of [['伺服器 503', () => [503, { error: 'please_retry' }]], ['連不上', () => 'down'], ['回非 JSON 的 404 頁', () => [404, undefined]]]) {
    const { ctx, calls } = await makeAuth(server);
    const r = await ctx.loginAccount('KG', '1234');
    ok(`${label} → 自動退回瀏覽器比對，照樣登入`, r.ok && ctx.getAuth().id === 'KG' && calls.players > 0, { r, calls });
  }
  for (const [label, server, expect] of [
    ['伺服器限流', () => [429, { error: 'rate_limited' }], '太頻繁'],
    ['伺服器拒收格式', () => [400, { error: 'invalid_request' }], '登入失敗'],
    ['連續撞到同帳號請求', () => [429, { error: 'busy' }], '請再按一次'],
  ]) {
    const { ctx, calls } = await makeAuth(server);
    const r = await ctx.loginAccount('KG', '1234');
    ok(`${label} → 照伺服器的話擋下，不退回瀏覽器比對`, !r.ok && r.error.includes(expect) && calls.players === 0 && !ctx.getAuth(), { r, calls });
  }
  {
    const { ctx, calls, storage } = await makeAuth(() => [200, { ok: true, id: 'KG', role: 'player', customToken: 'ct' }]);
    storage.agricola_fb_session = JSON.stringify({ refreshToken: 'GM 的舊憑證' });
    const realFetch = ctx.fetch;
    ctx.fetch = async (url, opts) => (String(url).includes('signInWithCustomToken') ? { status: 400, ok: false, json: async () => ({ error: { message: 'X' } }) } : realFetch(url, opts));
    const r = await ctx.loginAccount('KG', '1234');
    ok('換發失敗時舊帳號的 Firebase 憑證一定清掉，不會帶錯身分', r.ok && !storage.agricola_fb_session, storage);
  }
  {
    const src = fs.readFileSync(path.join(__dirname, 'auth.js'), 'utf8');
    ok('建帳號帶 exists=false，已存在的帳號不會被蓋掉', /currentDocument\.exists=false/.test(src), null);
  }
  {
    const src = fs.readFileSync(path.join(__dirname, 'auth.js'), 'utf8');
    ok('回退開關存在且預設開啟', /const SERVER_LOGIN = true;/.test(src), null);
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
})();
