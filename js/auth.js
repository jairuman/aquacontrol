// =============================================
// auth.js — Autenticación
// =============================================

const AUTH = { user: 'admin', pass: 'agua2024' };

function doLogin() {
  const u = document.getElementById('login-user').value;
  const p = document.getElementById('login-pass').value;

  if (u === AUTH.user && p === AUTH.pass) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    clearCache();
    initApp();
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
}

function doLogout() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  clearCache();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') {
    doLogin();
  }
});