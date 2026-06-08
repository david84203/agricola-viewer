/* ══════════════════════════════════════════════════
   農家樂 Auth — auth.js
   共用登入邏輯，所有頁面 include 此檔案
   ══════════════════════════════════════════════════ */

const AUTH_LS_KEY       = 'agricola_auth';
const AUTH_SETTINGS_KEY = 'agricola_auth_settings';
const AUTH_SETTINGS_TTL = 24 * 60 * 60 * 1000; // 24 hours
const AUTH_LINE_INVITE_KEY = 'agricola_line_invite_seen';
const UGG_LINE_URL = 'https://lin.ee/TLqRqdc';
const FIRESTORE_DOCS_BASE = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';
const FIRESTORE_AUTH = `${FIRESTORE_DOCS_BASE}/settings/auth`;
const FIRESTORE_PLAYERS = `${FIRESTORE_DOCS_BASE}/agricola_players`;

// ── State ──────────────────────────────────────────
function getAuth() {
  try { return JSON.parse(localStorage.getItem(AUTH_LS_KEY)) || null; } catch { return null; }
}

function clearAuth() {
  localStorage.removeItem(AUTH_LS_KEY);
}

// ── Auth settings cache ────────────────────────────
function getCachedSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(AUTH_SETTINGS_KEY));
    if (s && Date.now() - s.cachedAt < AUTH_SETTINGS_TTL) return s;
  } catch {}
  return null;
}

async function fetchAuthSettings() {
  const cached = getCachedSettings();
  if (cached) return cached;
  const res = await fetch(FIRESTORE_AUTH);
  const doc = await res.json();
  if (!doc.fields) throw new Error('無法取得驗證設定');
  const settings = {
    raterPin:  doc.fields.raterPin?.stringValue,
    adminId:   doc.fields.adminId?.stringValue,
    adminName: doc.fields.adminName?.stringValue,
    cachedAt:  Date.now(),
  };
  localStorage.setItem(AUTH_SETTINGS_KEY, JSON.stringify(settings));
  return settings;
}

function getRole()   { return getAuth()?.role || 'anonymous'; }
function getRaterId(){ const a = getAuth(); return a?.displayId || a?.id || null; }
function isRater()   { const r = getRole(); return r === 'rater' || r === 'admin'; }
function isAdmin()   { return getRole() === 'admin'; }
function isPlayer()  { return getRole() === 'player'; }
// 玩家／評分者／管理員都會累積個人輪抽紀錄，可查看個人分析
function hasProfileAccess() { const r = getRole(); return r === 'rater' || r === 'admin' || r === 'player'; }

// ── Cross-role ID collision checks ─────────────────
// 評分者不需要註冊（共用 PIN），玩家需要自行註冊帳號；
// 為避免同一個 ID 被兩邊各自使用造成混淆，登入前互相檢查對方陣營是否已用過此 ID。

// 此 ID 是否已是註冊過的玩家帳號
async function isRegisteredPlayerId(id) {
  try {
    const res = await fetch(`${FIRESTORE_PLAYERS}/${encodeURIComponent(id)}`);
    return res.status === 200;
  } catch {
    return false;
  }
}

// 此 ID 是否曾以評分者身份留下場次紀錄（agricola_sessions 中 role 不是 'player' 的紀錄）
async function isUsedAsRaterId(id) {
  try {
    const query = {
      structuredQuery: {
        from: [{ collectionId: 'agricola_sessions' }],
        select: { fields: [{ fieldPath: 'role' }] },
        where: { fieldFilter: { field: { fieldPath: 'raterId' }, op: 'EQUAL', value: { stringValue: id } } },
        limit: 20,
      }
    };
    const res = await fetch(`${FIRESTORE_DOCS_BASE}:runQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });
    const data = await res.json();
    const docs = (Array.isArray(data) ? data : []).filter(d => d.document);
    return docs.some(d => d.document.fields?.role?.stringValue !== 'player');
  } catch {
    return false;
  }
}

// ── Login ──────────────────────────────────────────
async function login(id, pin) {
  const trimmedId = id.trim();
  if (!trimmedId) return { ok: false, error: '請輸入 ID' };

  if (trimmedId.toLowerCase() === 'bay' || trimmedId.toLowerCase() === 'chris') {
    return { ok: false, error: '此 ID 已被限制，若要使用請改由「玩家登入」註冊一般帳號' };
  }

  if (await isRegisteredPlayerId(trimmedId)) {
    return { ok: false, error: `「${trimmedId}」已是一般玩家帳號，你登入錯入口囉，請改用「玩家登入」` };
  }

  const settings = await fetchAuthSettings();

  if (pin !== settings.raterPin) return { ok: false, error: 'PIN 錯誤，請重試' };

  const role      = id.trim() === settings.adminId ? 'admin' : 'rater';
  const displayId = role === 'admin' && settings.adminName ? settings.adminName : id.trim();
  localStorage.setItem(AUTH_LS_KEY, JSON.stringify({ id: id.trim(), role, displayId }));
  return { ok: true, role, id: id.trim() };
}

// ── Player login (self-service ID + PIN, first login = register) ──
async function hashPin(pin) {
  const data = new TextEncoder().encode(pin);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function loginPlayer(id, pin) {
  const trimmedId = id.trim();
  if (!trimmedId) return { ok: false, error: '請輸入 ID' };
  if (!pin)        return { ok: false, error: '請輸入 PIN' };

  const pinHash = await hashPin(pin);
  const docUrl  = `${FIRESTORE_PLAYERS}/${encodeURIComponent(trimmedId)}`;

  const res = await fetch(docUrl);

  if (res.status === 404) {
    if (await isUsedAsRaterId(trimmedId)) {
      return { ok: false, error: `「${trimmedId}」已是評分者身份，你登入錯入口囉，請改用「評分者登入」（或換一個 ID 註冊玩家帳號）` };
    }

    // ID 尚未被使用 → 直接以此 ID + PIN 建立新帳號
    const createRes = await fetch(docUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          pinHash:   { stringValue: pinHash },
          createdAt: { stringValue: new Date().toISOString() },
        }
      })
    });
    if (!createRes.ok) return { ok: false, error: '建立帳號失敗，請重試' };
  } else if (res.ok) {
    const doc = await res.json();
    if (doc.fields?.pinHash?.stringValue !== pinHash) {
      return { ok: false, error: 'PIN 錯誤，請重試（ID 已被使用，若忘記 PIN 請聯絡管理員重設）' };
    }
  } else {
    return { ok: false, error: '網路錯誤，請重試' };
  }

  localStorage.setItem(AUTH_LS_KEY, JSON.stringify({ id: trimmedId, role: 'player', displayId: trimmedId }));
  return { ok: true, role: 'player', id: trimmedId };
}

// ── Mount UI ───────────────────────────────────────
// 在 brand-right 最前面注入登入按鈕 / 使用者狀態列
function mountAuthBar(brandRight) {
  const wrap = document.createElement('div');
  wrap.id = 'authBar';
  wrap.className = 'auth-bar';
  brandRight.prepend(wrap);
  refreshAuthBar();
}

function refreshAuthBar() {
  const wrap = document.getElementById('authBar');
  if (!wrap) return;
  const auth = getAuth();

  if (!auth) {
    wrap.innerHTML = `
      <button class="auth-login-btn" id="authLoginBtn">🔐 評分者登入</button>
      <button class="auth-login-btn" id="authPlayerLoginBtn">🎮 玩家登入</button>
    `;
    wrap.querySelector('#authLoginBtn').addEventListener('click', openLoginModal);
    wrap.querySelector('#authPlayerLoginBtn').addEventListener('click', openPlayerLoginModal);
  } else {
    const roleLabel = auth.role === 'admin' ? '👑 管理員' : auth.role === 'player' ? '🎮 玩家' : '✅ 評分者';
    const adminLink = auth.role === 'admin'
      ? `<a href="./raters.html" class="auth-admin-link">評分者管理</a>
         <a href="./players.html" class="auth-admin-link">玩家管理</a>` : '';
    wrap.innerHTML = `
      <span class="auth-user">${roleLabel}｜${auth.id}</span>
      ${adminLink}
      <button class="auth-logout-btn" id="authLogoutBtn">登出</button>
    `;
    wrap.querySelector('#authLogoutBtn').addEventListener('click', () => {
      clearAuth();
      refreshAuthBar();
      if (typeof onAuthChange === 'function') onAuthChange();
    });
  }
  if (typeof onAuthChange === 'function') onAuthChange();
}

// ── Login Modal ────────────────────────────────────
function openLoginModal() {
  document.getElementById('authModal').style.display = 'flex';
  document.getElementById('authIdInput').focus();
  document.getElementById('authError').textContent = '';
  document.getElementById('authIdInput').value = '';
  document.getElementById('authPinInput').value = '';
}

function closeLoginModal() {
  document.getElementById('authModal').style.display = 'none';
}

function shouldShowLineInvite() {
  return !localStorage.getItem(AUTH_LINE_INVITE_KEY);
}

function markLineInviteSeen() {
  localStorage.setItem(AUTH_LINE_INVITE_KEY, '1');
}

function openLineInviteModal() {
  if (!document.getElementById('lineInviteModal')) injectLineInviteModal();
  document.getElementById('lineInviteModal').style.display = 'flex';
}

function closeLineInviteModal() {
  markLineInviteSeen();
  const modal = document.getElementById('lineInviteModal');
  if (modal) modal.style.display = 'none';
}

function injectLineInviteModal() {
  const modal = document.createElement('div');
  modal.id = 'lineInviteModal';
  modal.className = 'auth-modal-overlay';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="auth-modal line-invite-modal">
      <div class="auth-modal-title">想一起玩農家樂？</div>
      <p class="line-invite-text">
        烏嘎嘎會不定期揪團、開桌與分享活動資訊，歡迎加入官方 LINE。
      </p>
      <div class="auth-modal-footer">
        <button class="auth-btn-cancel" id="lineInviteLater">先不用</button>
        <a class="auth-btn-submit line-invite-link" id="lineInviteJoin" href="${UGG_LINE_URL}" target="_blank" rel="noopener noreferrer">加入烏嘎嘎 LINE</a>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('lineInviteLater').addEventListener('click', closeLineInviteModal);
  document.getElementById('lineInviteJoin').addEventListener('click', closeLineInviteModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeLineInviteModal(); });
}

function injectLoginModal() {
  const modal = document.createElement('div');
  modal.id = 'authModal';
  modal.className = 'auth-modal-overlay';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="auth-modal">
      <div class="auth-modal-title">評分者登入</div>
      <div class="auth-field">
        <label>你的 ID（暱稱）</label>
        <input type="text" id="authIdInput" class="auth-input" placeholder="輸入你的名字" autocomplete="off" maxlength="20" />
      </div>
      <div class="auth-field">
        <label>PIN</label>
        <input type="password" id="authPinInput" class="auth-input" placeholder="輸入通關密碼" autocomplete="off" />
      </div>
      <div class="auth-error" id="authError"></div>
      <div class="auth-modal-footer">
        <button class="auth-btn-cancel" id="authCancel">取消</button>
        <button class="auth-btn-submit" id="authSubmit">登入</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('authCancel').addEventListener('click', closeLoginModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeLoginModal(); });
  document.getElementById('authSubmit').addEventListener('click', doLogin);
  document.getElementById('authPinInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
}

async function doLogin() {
  const id  = document.getElementById('authIdInput').value.trim();
  const pin = document.getElementById('authPinInput').value;
  const btn = document.getElementById('authSubmit');
  const err = document.getElementById('authError');

  btn.disabled = true;
  btn.textContent = '驗證中…';
  err.textContent = '';

  try {
    const result = await login(id, pin);
    if (result.ok) {
      closeLoginModal();
      refreshAuthBar();
      if (shouldShowLineInvite()) openLineInviteModal();
    } else {
      err.textContent = result.error;
    }
  } catch (e) {
    err.textContent = '網路錯誤，請重試';
  }

  btn.disabled = false;
  btn.textContent = '登入';
}

// ── Player Login Modal ─────────────────────────────
function injectPlayerLoginModal() {
  const modal = document.createElement('div');
  modal.id = 'playerAuthModal';
  modal.className = 'auth-modal-overlay';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="auth-modal">
      <div class="auth-modal-title">玩家登入</div>
      <p class="player-auth-hint">第一次登入會自動用此 ID＋PIN 建立帳號，之後請固定用同一組登入。請自行記住，遺失需請管理員協助重設。</p>
      <div class="auth-field">
        <label>你的 ID（暱稱）</label>
        <input type="text" id="playerAuthIdInput" class="auth-input" placeholder="設定一個好記的 ID" autocomplete="off" maxlength="20" />
      </div>
      <div class="auth-field">
        <label>PIN</label>
        <input type="password" id="playerAuthPinInput" class="auth-input" placeholder="設定你的 PIN" autocomplete="off" />
      </div>
      <div class="auth-error" id="playerAuthError"></div>
      <div class="auth-modal-footer">
        <button class="auth-btn-cancel" id="playerAuthCancel">取消</button>
        <button class="auth-btn-submit" id="playerAuthSubmit">登入／建立帳號</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('playerAuthCancel').addEventListener('click', closePlayerLoginModal);
  modal.addEventListener('click', e => { if (e.target === modal) closePlayerLoginModal(); });
  document.getElementById('playerAuthSubmit').addEventListener('click', doPlayerLogin);
  document.getElementById('playerAuthPinInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') doPlayerLogin();
  });
}

function openPlayerLoginModal() {
  document.getElementById('playerAuthModal').style.display = 'flex';
  document.getElementById('playerAuthIdInput').focus();
  document.getElementById('playerAuthError').textContent = '';
  document.getElementById('playerAuthIdInput').value = '';
  document.getElementById('playerAuthPinInput').value = '';
}

function closePlayerLoginModal() {
  document.getElementById('playerAuthModal').style.display = 'none';
}

async function doPlayerLogin() {
  const id  = document.getElementById('playerAuthIdInput').value.trim();
  const pin = document.getElementById('playerAuthPinInput').value;
  const btn = document.getElementById('playerAuthSubmit');
  const err = document.getElementById('playerAuthError');

  btn.disabled = true;
  btn.textContent = '處理中…';
  err.textContent = '';

  try {
    const result = await loginPlayer(id, pin);
    if (result.ok) {
      closePlayerLoginModal();
      refreshAuthBar();
      if (shouldShowLineInvite()) openLineInviteModal();
    } else {
      err.textContent = result.error;
    }
  } catch (e) {
    err.textContent = '網路錯誤，請重試';
  }

  btn.disabled = false;
  btn.textContent = '登入／建立帳號';
}

// ── Auto-init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  injectLoginModal();
  injectPlayerLoginModal();
  const mount = document.getElementById('authBarMount') || document.querySelector('.brand-right');
  if (mount) mountAuthBar(mount);
});
