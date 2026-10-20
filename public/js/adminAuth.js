// Manager sign-in for admin.html, bookings.html and calls.html: the password goes to POST /api/admin/login once,
// the server answers with an HttpOnly session cookie (12 h) — nothing secret is kept in the page or in storage.
// list — the id of the page's private section; onIn() loads the data, onOut() stops polling and clears the view.
import { t } from './i18n.js';

const $ = id => document.getElementById(id);
const MSG = { 401: 'adm.badPassword', 429: 'adm.tooMany', 503: 'adm.disabled' };

export function adminAuth({ list, onIn, onOut = () => {} }) {
  function show(signedIn, msg = '') {
    $(list).hidden = !signedIn;
    $('admLogout').hidden = !signedIn;
    $('admLogin').hidden = signedIn;
    $('admLoginErr').textContent = msg;
    if (!signedIn) onOut();
  }

  // An API call answered 401 / 503: the session ended (expired, new password) or the manager page is off.
  const signedOut = status => show(false, status === 503 ? t('adm.disabled') : t('adm.expired'));

  $('admLogin').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    let res = null;
    try {
      res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: form.elements.password.value }) });
    } catch { /* offline */ }
    button.disabled = false;
    if (res?.ok) {
      form.reset();
      show(true);
      onIn();
    } else {
      $('admLoginErr').textContent = t(MSG[res?.status] || 'adm.loginFail');
      form.elements.password.select();
    }
  });

  $('admLogout').addEventListener('click', async () => {
    try { await fetch('/api/admin/logout', { method: 'POST' }); } catch { /* the cookie ends by itself */ }
    show(false);
  });

  // Already signed in in this browser? Then straight to the data.
  fetch('/api/admin/me', { cache: 'no-store' }).then(r => {
    if (r.ok) { show(true); onIn(); } else show(false, r.status === 503 ? t('adm.disabled') : '');
  }, () => show(false, t('adm.loginFail')));

  return { signedOut };
}
