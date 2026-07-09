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
const MIN_PIN_LEN = 4; // 新設定的 PIN 最低長度（登入時不檢查，避免擋到舊帳號）

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
// 卡牌「功能實作狀態」私有 tag 白名單：只有小路(GM)與YOYO可見可改
function isImplStatusViewer() {
  if (isAdmin()) return true;
  const id = getAuth()?.id;
  return typeof id === 'string' && id.trim().toLowerCase() === 'yoyo';
}
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

// ── 帳號基礎工具（統一存在 agricola_players/{id}）─────
async function hashPin(pin) {
  const data = new TextEncoder().encode(pin);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function validatePin(pin) {
  return typeof pin === 'string' && pin.trim().length >= MIN_PIN_LEN;
}

// 讀取帳號文件。回傳 { exists, pinHash, role } 或 { exists:false }（error:true 表示網路錯）
async function fetchAccount(id) {
  try {
    const res = await fetch(`${FIRESTORE_PLAYERS}/${encodeURIComponent(id.trim())}`);
    if (res.status === 200) {
      const d = await res.json();
      return { exists: true, pinHash: d.fields?.pinHash?.stringValue, role: d.fields?.role?.stringValue || null };
    }
    if (res.status === 404) return { exists: false };
    return { exists: false, error: true };
  } catch {
    return { exists: false, error: true };
  }
}

// 建立新帳號（role 傳 null = 一般玩家；'rater' = 評分者）。回傳是否成功。
async function createAccount(id, pin, role) {
  const fields = {
    pinHash:   { stringValue: await hashPin(pin) },
    createdAt: { stringValue: new Date().toISOString() },
  };
  if (role) fields.role = { stringValue: role };
  const res = await fetch(`${FIRESTORE_PLAYERS}/${encodeURIComponent(id.trim())}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  return res.ok;
}

// 只更新 pinHash（用 updateMask 才不會把 role/createdAt 洗掉）
async function patchPinHash(id, newPin) {
  const url = `${FIRESTORE_PLAYERS}/${encodeURIComponent(id.trim())}?updateMask.fieldPaths=pinHash`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { pinHash: { stringValue: await hashPin(newPin) } } }),
  });
  return res.ok;
}

// 寫入登入狀態並回傳結果（role: admin 由 settings.adminId 判定，優先於文件裡的 role）
function persistLogin(id, docRole, settings) {
  const role = (settings && id === settings.adminId) ? 'admin' : (docRole || 'player');
  const displayId = (role === 'admin' && settings && settings.adminName) ? settings.adminName : id;
  localStorage.setItem(AUTH_LS_KEY, JSON.stringify({ id, role, displayId }));
  return { ok: true, role, id };
}

// ── 統一登入（只登入、不自動建帳號；供評分者入口與線上大廳使用）──
// 回傳：{ok:true,role,id} / {ok:false,error} / {needMigrate:true,id,code}（舊評分者用共用碼首次登入）
async function loginAccount(id, pin) {
  const trimmedId = id.trim();
  if (!trimmedId) return { ok: false, error: '請輸入 ID' };
  if (!pin)        return { ok: false, error: '請輸入 PIN' };

  const settings = await fetchAuthSettings();
  const acc = await fetchAccount(trimmedId);
  if (acc.error) return { ok: false, error: '網路錯誤，請重試' };

  if (acc.exists) {
    if (acc.pinHash !== await hashPin(pin)) {
      return { ok: false, error: 'PIN 錯誤，請重試（忘記請聯絡管理員重設）' };
    }
    return persistLogin(trimmedId, acc.role, settings);
  }

  // 尚無個人帳號 → 若輸入的是共用通關密碼，視為舊評分者首次登入，帶去設定新 PIN
  if (settings.raterPin && pin === settings.raterPin) {
    return { needMigrate: true, id: trimmedId, code: pin };
  }
  return {
    ok: false,
    unregistered: true,
    error: '查無此帳號或 PIN 錯誤。若你是評分者但還沒設定新密碼，請用「ID＋原本的通關密碼」登入一次，系統會帶你設定新密碼。',
  };
}

// ── 評分者授權／舊帳號遷移：用共用碼換一組個人 PIN ──
async function setRaterPin(id, code, newPin) {
  const trimmedId = id.trim();
  if (!trimmedId) return { ok: false, error: '請輸入 ID' };
  const settings = await fetchAuthSettings();
  if (!settings.raterPin || code !== settings.raterPin) return { ok: false, error: '授權碼錯誤' };
  if (!validatePin(newPin)) return { ok: false, error: `新 PIN 至少 ${MIN_PIN_LEN} 碼` };
  if (newPin === settings.raterPin) return { ok: false, error: '新 PIN 不能跟原本的通關密碼一樣' };

  const acc = await fetchAccount(trimmedId);
  if (acc.error) return { ok: false, error: '網路錯誤，請重試' };
  if (acc.exists) return { ok: false, error: '此 ID 已有帳號，請直接用個人 PIN 登入' };

  const isAdmin = trimmedId === settings.adminId;
  const created = await createAccount(trimmedId, newPin, isAdmin ? null : 'rater');
  if (!created) return { ok: false, error: '設定失敗，請重試' };
  return persistLogin(trimmedId, isAdmin ? null : 'rater', settings);
}

// ── 玩家登入／自助註冊（首次登入即建立帳號）──
async function loginPlayer(id, pin) {
  const trimmedId = id.trim();
  if (!trimmedId) return { ok: false, error: '請輸入 ID' };
  if (!pin)        return { ok: false, error: '請輸入 PIN' };

  const settings = await fetchAuthSettings();
  const acc = await fetchAccount(trimmedId);
  if (acc.error) return { ok: false, error: '網路錯誤，請重試' };

  if (acc.exists) {
    if (acc.pinHash !== await hashPin(pin)) {
      return { ok: false, error: 'PIN 錯誤，請重試（ID 已被使用，若忘記 PIN 請聯絡管理員重設）' };
    }
    return persistLogin(trimmedId, acc.role, settings);
  }

  // 尚未被使用 → 自助建立玩家帳號
  if (!validatePin(pin)) return { ok: false, error: `PIN 至少 ${MIN_PIN_LEN} 碼，請重新設定` };
  if (settings.adminId && trimmedId === settings.adminId) {
    return { ok: false, error: '此 ID 為保留帳號，無法用玩家登入建立' };
  }
  if (await isUsedAsRaterId(trimmedId)) {
    return { ok: false, error: `「${trimmedId}」已是評分者身份，請改用「評分者登入」設定密碼（或換一個 ID）` };
  }
  const created = await createAccount(trimmedId, pin, null);
  if (!created) return { ok: false, error: '建立帳號失敗，請重試' };
  return persistLogin(trimmedId, null, settings);
}

// ── 自助修改 PIN（需驗證原 PIN）──
async function changePin(id, oldPin, newPin) {
  const trimmedId = id.trim();
  if (!trimmedId) return { ok: false, error: '缺少帳號' };
  const acc = await fetchAccount(trimmedId);
  if (acc.error) return { ok: false, error: '網路錯誤，請重試' };
  if (!acc.exists) return { ok: false, error: '找不到帳號' };
  if (acc.pinHash !== await hashPin(oldPin)) return { ok: false, error: '原 PIN 錯誤' };
  if (!validatePin(newPin)) return { ok: false, error: `新 PIN 至少 ${MIN_PIN_LEN} 碼` };
  const settings = await fetchAuthSettings().catch(() => ({}));
  if (settings.raterPin && newPin === settings.raterPin) return { ok: false, error: '新 PIN 不能跟原本的通關密碼一樣' };
  const ok = await patchPinHash(trimmedId, newPin);
  return ok ? { ok: true } : { ok: false, error: '更新失敗，請重試' };
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
      <button class="auth-changepin-btn" id="authChangePinBtn">修改 PIN</button>
      <button class="auth-logout-btn" id="authLogoutBtn">登出</button>
    `;
    wrap.querySelector('#authChangePinBtn').addEventListener('click', openChangePinModal);
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
      <p class="player-auth-hint">第一次登入請用「原本的通關密碼」，系統會請你設定一組專屬新 PIN；之後就用新 PIN 登入。</p>
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
    const result = await loginAccount(id, pin);
    if (result.ok) {
      closeLoginModal();
      refreshAuthBar();
      if (shouldShowLineInvite()) openLineInviteModal();
    } else if (result.needMigrate) {
      closeLoginModal();
      openMigrateModal(result.id, result.code);
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
      <p class="player-auth-hint">第一次登入會自動用此 ID＋PIN 建立帳號（PIN 至少 ${MIN_PIN_LEN} 碼），之後請固定用同一組登入。請自行記住，遺失需請管理員協助重設。</p>
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
    } else if (result.needMigrate) {
      closePlayerLoginModal();
      openMigrateModal(result.id, result.code);
    } else {
      err.textContent = result.error;
    }
  } catch (e) {
    err.textContent = '網路錯誤，請重試';
  }

  btn.disabled = false;
  btn.textContent = '登入／建立帳號';
}

// ── 遷移／授權設定新 PIN Modal ─────────────────────
function injectMigrateModal() {
  const modal = document.createElement('div');
  modal.id = 'migrateModal';
  modal.className = 'auth-modal-overlay';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="auth-modal">
      <div class="auth-modal-title">設定你的專屬 PIN</div>
      <p class="player-auth-hint">偵測到你是評分者。為了保護你的戰績與資料，請設定一組只有你知道的新 PIN（至少 ${MIN_PIN_LEN} 碼），之後就用「ID＋新 PIN」登入。</p>
      <div class="auth-field">
        <label>ID</label>
        <input type="text" id="migrateIdInput" class="auth-input" disabled />
      </div>
      <div class="auth-field">
        <label>新 PIN（至少 ${MIN_PIN_LEN} 碼）</label>
        <input type="password" id="migratePinInput" class="auth-input" placeholder="設定新 PIN" autocomplete="off" />
      </div>
      <div class="auth-field">
        <label>再輸入一次</label>
        <input type="password" id="migratePin2Input" class="auth-input" placeholder="再輸入一次" autocomplete="off" />
      </div>
      <div class="auth-error" id="migrateError"></div>
      <div class="auth-modal-footer">
        <button class="auth-btn-cancel" id="migrateCancel">取消</button>
        <button class="auth-btn-submit" id="migrateSubmit">完成升級</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('migrateCancel').addEventListener('click', closeMigrateModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeMigrateModal(); });
  document.getElementById('migrateSubmit').addEventListener('click', doMigrate);
  document.getElementById('migratePin2Input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doMigrate();
  });
}

let _migrateCode = '';
function openMigrateModal(id, code) {
  if (!document.getElementById('migrateModal')) injectMigrateModal();
  _migrateCode = code || '';
  document.getElementById('migrateIdInput').value = id;
  document.getElementById('migratePinInput').value = '';
  document.getElementById('migratePin2Input').value = '';
  document.getElementById('migrateError').textContent = '';
  document.getElementById('migrateModal').style.display = 'flex';
  document.getElementById('migratePinInput').focus();
}
function closeMigrateModal() {
  const m = document.getElementById('migrateModal');
  if (m) m.style.display = 'none';
}
async function doMigrate() {
  const id   = document.getElementById('migrateIdInput').value.trim();
  const pin  = document.getElementById('migratePinInput').value;
  const pin2 = document.getElementById('migratePin2Input').value;
  const btn  = document.getElementById('migrateSubmit');
  const err  = document.getElementById('migrateError');
  if (pin !== pin2) { err.textContent = '兩次輸入不一致'; return; }
  btn.disabled = true; btn.textContent = '處理中…'; err.textContent = '';
  try {
    const result = await setRaterPin(id, _migrateCode, pin);
    if (result.ok) {
      closeMigrateModal();
      refreshAuthBar();
      if (shouldShowLineInvite()) openLineInviteModal();
    } else {
      err.textContent = result.error;
    }
  } catch (e) {
    err.textContent = '網路錯誤，請重試';
  }
  btn.disabled = false; btn.textContent = '完成升級';
}

// ── 修改 PIN Modal ────────────────────────────────
function injectChangePinModal() {
  const modal = document.createElement('div');
  modal.id = 'changePinModal';
  modal.className = 'auth-modal-overlay';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="auth-modal">
      <div class="auth-modal-title">修改 PIN</div>
      <div class="auth-field">
        <label>原 PIN</label>
        <input type="password" id="cpOldInput" class="auth-input" placeholder="輸入原本的 PIN" autocomplete="off" />
      </div>
      <div class="auth-field">
        <label>新 PIN（至少 ${MIN_PIN_LEN} 碼）</label>
        <input type="password" id="cpNewInput" class="auth-input" placeholder="設定新 PIN" autocomplete="off" />
      </div>
      <div class="auth-field">
        <label>再輸入一次</label>
        <input type="password" id="cpNew2Input" class="auth-input" placeholder="再輸入一次" autocomplete="off" />
      </div>
      <div class="auth-error" id="cpError"></div>
      <div class="auth-modal-footer">
        <button class="auth-btn-cancel" id="cpCancel">取消</button>
        <button class="auth-btn-submit" id="cpSubmit">確認修改</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('cpCancel').addEventListener('click', closeChangePinModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeChangePinModal(); });
  document.getElementById('cpSubmit').addEventListener('click', doChangePin);
  document.getElementById('cpNew2Input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doChangePin();
  });
}
function openChangePinModal() {
  if (!document.getElementById('changePinModal')) injectChangePinModal();
  document.getElementById('cpOldInput').value = '';
  document.getElementById('cpNewInput').value = '';
  document.getElementById('cpNew2Input').value = '';
  document.getElementById('cpError').textContent = '';
  document.getElementById('changePinModal').style.display = 'flex';
  document.getElementById('cpOldInput').focus();
}
function closeChangePinModal() {
  const m = document.getElementById('changePinModal');
  if (m) m.style.display = 'none';
}
async function doChangePin() {
  const auth = getAuth();
  if (!auth) { closeChangePinModal(); return; }
  const oldPin = document.getElementById('cpOldInput').value;
  const newPin = document.getElementById('cpNewInput').value;
  const new2   = document.getElementById('cpNew2Input').value;
  const btn = document.getElementById('cpSubmit');
  const err = document.getElementById('cpError');
  if (newPin !== new2) { err.textContent = '兩次輸入不一致'; return; }
  btn.disabled = true; btn.textContent = '處理中…'; err.textContent = '';
  try {
    const result = await changePin(auth.id, oldPin, newPin);
    if (result.ok) {
      closeChangePinModal();
      alert('PIN 已更新，下次請用新 PIN 登入。');
    } else {
      err.textContent = result.error;
    }
  } catch (e) {
    err.textContent = '網路錯誤，請重試';
  }
  btn.disabled = false; btn.textContent = '確認修改';
}

// ── Auto-init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  injectLoginModal();
  injectPlayerLoginModal();
  injectMigrateModal();
  injectChangePinModal();
  const mount = document.getElementById('authBarMount') || document.querySelector('.brand-right');
  if (mount) mountAuthBar(mount);
});
