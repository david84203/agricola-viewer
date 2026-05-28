/* ══════════════════════════════════════════════════
   農家樂 Auth — auth.js
   共用登入邏輯，所有頁面 include 此檔案
   ══════════════════════════════════════════════════ */

const AUTH_LS_KEY = 'agricola_auth';
const FIRESTORE_AUTH = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents/settings/auth';

// ── State ──────────────────────────────────────────
function getAuth() {
  try { return JSON.parse(localStorage.getItem(AUTH_LS_KEY)) || null; } catch { return null; }
}

function clearAuth() {
  localStorage.removeItem(AUTH_LS_KEY);
}

function getRole()   { return getAuth()?.role || 'anonymous'; }
function getRaterId(){ return getAuth()?.id   || null; }
function isRater()   { const r = getRole(); return r === 'rater' || r === 'admin'; }
function isAdmin()   { return getRole() === 'admin'; }

// ── Login ──────────────────────────────────────────
async function login(id, pin) {
  if (!id.trim()) return { ok: false, error: '請輸入 ID' };

  const res  = await fetch(FIRESTORE_AUTH);
  const doc  = await res.json();
  const correctPin = doc.fields?.raterPin?.stringValue;
  const adminId    = doc.fields?.adminId?.stringValue;

  if (pin !== correctPin) return { ok: false, error: 'PIN 錯誤，請重試' };

  const role = id.trim() === adminId ? 'admin' : 'rater';
  localStorage.setItem(AUTH_LS_KEY, JSON.stringify({ id: id.trim(), role }));
  return { ok: true, role, id: id.trim() };
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
    wrap.innerHTML = `<button class="auth-login-btn" id="authLoginBtn">🔐 評分者登入</button>`;
    wrap.querySelector('#authLoginBtn').addEventListener('click', openLoginModal);
  } else {
    const roleLabel = auth.role === 'admin' ? '👑 管理員' : '✅ 評分者';
    wrap.innerHTML = `
      <span class="auth-user">${roleLabel}｜${auth.id}</span>
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
    } else {
      err.textContent = result.error;
    }
  } catch (e) {
    err.textContent = '網路錯誤，請重試';
  }

  btn.disabled = false;
  btn.textContent = '登入';
}

// ── Auto-init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  injectLoginModal();
  const mount = document.getElementById('authBarMount') || document.querySelector('.brand-right');
  if (mount) mountAuthBar(mount);
});
