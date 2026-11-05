// 伺服器帳號 API（2026-11-06 第 0 階段）前端：登入／註冊／改 PIN／重設都走 /api/login，瀏覽器不碰 PIN 雜湊。
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
  const calls = { login: [], bodies: [], players: 0, writes: 0, exchange: 0 };
  const kgHash = await sha256('1234');
  const fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.endsWith('/api/login')) {
      calls.login.push(u);
      calls.bodies.push(JSON.parse(opts.body));
      const r = server(JSON.parse(opts.body));
      if (r === 'down') throw new Error('network');
      return reply(r[0], r[1]);
    }
    if (u.includes('signInWithCustomToken')) { calls.exchange++; return reply(200, { idToken: 'id', refreshToken: 'refresh', expiresIn: '3600' }); }
    if (u.endsWith('/documents/settings/auth')) return reply(200, { fields: { adminId: { stringValue: 'GM' }, adminName: { stringValue: '小路' }, raterPin: { stringValue: 'shared-code' } } });
    if (u.includes(':runQuery')) return reply(200, []);
    if (u.includes('/agricola_players/')) {
      if (opts.method === 'PATCH') calls.writes++;
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
    ok(`${label} → 擋下並提示重試，不碰公開文件`, !r.ok && r.error === '網路錯誤，請重試' && calls.players === 0 && !ctx.getAuth(), { r, calls });
  }
  {
    const { ctx, calls } = await makeAuth((b) => (b.action === 'register' ? [200, { ok: true, id: 'newbie', role: 'player', customToken: 'ct' }] : [404, { error: 'not_found' }]));
    const r = await ctx.loginPlayer('newbie', '5678', { confirmCreate: true });
    ok('註冊走伺服器、登入並換發憑證，不直接寫公開文件', r.ok && r.id === 'newbie' && calls.writes === 0 && calls.exchange === 1 && calls.bodies[1].action === 'register', { r, calls });
  }
  {
    const { ctx } = await makeAuth((b) => (b.action === 'register' ? [409, { error: 'id_taken' }] : [404, { error: 'not_found' }]));
    const r = await ctx.loginPlayer('newbie', '5678', { confirmCreate: true });
    ok('註冊撞名給明確訊息、不登入', !r.ok && r.error.includes('請換一個') && !ctx.getAuth(), r);
  }
  {
    const { ctx } = await makeAuth((b) => (b.action === 'register' ? 'down' : [404, { error: 'not_found' }]));
    const r = await ctx.loginPlayer('newbie', '5678', { confirmCreate: true });
    ok('註冊時伺服器掛掉：不登入、提示稍後再試', !r.ok && r.error.includes('稍後再試') && !ctx.getAuth(), r);
  }
  {
    const { ctx, calls } = await makeAuth(() => [200, { ok: true, id: 'GM', role: 'admin', customToken: 'ct' }]);
    const r = await ctx.loginAccount('GM', '0000');
    ok('角色以伺服器為準，管理員顯示名稱照舊', r.ok && r.role === 'admin' && ctx.getAuth().displayId === '小路', { r, calls });
  }
  {
    const { ctx } = await makeAuth(() => [200, { ok: true, id: 'GM', role: 'player', customToken: 'ct' }]);
    const r = await ctx.loginAccount('GM', '0000');
    ok('伺服器說是玩家，就算 settings/auth 寫他是管理員也不給', r.role === 'player' && ctx.getAuth().role === 'player', r);
  }
  {
    const { ctx, calls } = await makeAuth(() => [200, { ok: true }]);
    const r = await ctx.changePin('KG', '1234', '5678');
    ok('改 PIN 送原 PIN 與新 PIN 給伺服器，不直接寫公開文件', r.ok && calls.writes === 0 && calls.bodies[0].action === 'change-pin' && calls.bodies[0].pin === '1234' && calls.bodies[0].newPin === '5678', calls);
  }
  {
    const { ctx } = await makeAuth(() => [401, { error: 'bad_pin', remaining: 1 }]);
    const r = await ctx.changePin('KG', 'wrong', '5678');
    ok('改 PIN 原 PIN 錯，提示並警告快鎖了', !r.ok && r.error.includes('原 PIN 錯誤') && r.error.includes('再錯 1 次'), r);
  }
  {
    const { ctx, calls } = await makeAuth(() => [200, { ok: true }]);
    const r = await ctx.changePin('KG', '1234', 'shared-code');
    ok('新 PIN 不能等於共用通關密碼，且沒送伺服器', !r.ok && calls.login.length === 0, r);
  }
  {
    const { ctx, calls } = await makeAuth((b) => (b.code === 'shared-code' ? [200, { ok: true, id: 'r2', role: 'rater', customToken: 'ct' }] : [401, { error: 'bad_code' }]));
    const good = await ctx.setRaterPin('r2', 'shared-code', '5678');
    ok('評分者設定走伺服器並登入成 rater', good.ok && good.role === 'rater' && calls.writes === 0 && calls.exchange === 1, { good, calls });
    const bad = await ctx.setRaterPin('r3', 'wrong', '5678');
    ok('評分者授權碼錯：前端先擋', !bad.ok && bad.error === '授權碼錯誤', bad);
  }
  {
    const { ctx, calls, storage } = await makeAuth(() => [200, { ok: true }]);
    storage.agricola_auth = JSON.stringify({ id: 'GM', role: 'admin' });
    const r = await ctx.adminResetPin('KG', '0000', '5678');
    const b = calls.bodies[0];
    ok('管理員重設送自己的 ID＋PIN 與目標，不直接寫公開文件', r.ok && calls.writes === 0 && b.action === 'admin-reset' && b.id === 'GM' && b.pin === '0000' && b.targetId === 'KG' && b.newPin === '5678', calls);
  }
  {
    const { ctx, storage } = await makeAuth(() => [403, { error: 'forbidden' }]);
    storage.agricola_auth = JSON.stringify({ id: 'KG', role: 'admin' });
    const r = await ctx.adminResetPin('X', '1234', '5678');
    ok('本機自稱管理員但伺服器不認：重設失敗', !r.ok && r.error.includes('沒有管理員權限'), r);
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
    const src = ['auth.js', 'players.js'].map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
    ok('瀏覽器端完全不再碰 PIN 雜湊', !/pinHash|hashPin|SERVER_LOGIN/.test(src), null);
    ok('重設視窗有管理員 PIN 欄位', /id="resetPinAdminInput"/.test(fs.readFileSync(path.join(__dirname, 'players.html'), 'utf8')), null);
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
})();
