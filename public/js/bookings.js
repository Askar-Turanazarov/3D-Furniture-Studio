// Manager page «Заявки на показ»: booking.json (written by the MCP server) through GET /api/bookings, refreshed every 3 s.
// Same sign-in as the orders page (ADMIN_TOKEN in this tab's sessionStorage); user data goes into the page as text only.
import { t, getLang, applyStatic, initLangSwitcher, onLangChange } from './i18n.js';
import { initTheme } from './theme.js';
import { initIcons } from './icons.js';

const $ = id => document.getElementById(id);
const LOCALE = { ru: 'ru-RU', uz: 'uz-UZ', en: 'en-GB' };
const KEY = 'fsp3d.adminToken';
const EVERY_MS = 3000;
// viewings are booked in Tashkent time; creation times are shown in the same zone
const when = iso => new Date(iso).toLocaleString(LOCALE[getLang()] || 'en-GB', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Tashkent' });

let token = '';
try { token = sessionStorage.getItem(KEY) || ''; } catch { /* storage off */ }
let bookings = [];
let shown = '';          // the last list drawn: redraw only when it changed
let timer = null;
let failed = false;

let toastTimer;
function toast(text, isError = false) {
  const box = $('toast');
  box.textContent = text;
  box.className = 'toast' + (isError ? ' error' : '');
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, isError ? 5000 : 3000);
}

function logout(msg = '') {
  token = '';
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  clearInterval(timer);
  timer = null;
  $('bkList').hidden = true;
  $('admLogout').hidden = true;
  $('admLogin').hidden = false;
  $('admLoginErr').textContent = msg;
}

async function load() {
  if (!token || document.hidden) return;   // a hidden tab waits; it catches up on visibilitychange
  let res;
  try { res = await fetch('/api/bookings', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' }); } catch { res = null; }
  if (res && (res.status === 401 || res.status === 503)) return logout(res.status === 503 ? t('adm.disabled') : t('adm.badToken'));
  if (!res || !res.ok) {
    if (!failed) toast(t('bk.loadFail'), true);
    failed = true;
    return renderLive();
  }
  failed = false;
  bookings = await res.json();
  $('admLogin').hidden = true;
  $('bkList').hidden = false;
  $('admLogout').hidden = false;
  render();
}

function renderLive() {
  $('bkLive').textContent = failed ? t('bk.offline') : t('bk.live', { n: bookings.length, time: new Date().toLocaleTimeString(LOCALE[getLang()] || 'en-GB', { timeZone: 'Asia/Tashkent' }) });
}

function render(force = false) {
  renderLive();
  const key = JSON.stringify(bookings) + getLang();
  if (!force && key === shown) return;
  shown = key;
  $('bkEmpty').hidden = bookings.length > 0;
  $('bkTable').hidden = !bookings.length;
  $('bkRows').replaceChildren(...bookings.map(b => {
    const tr = document.createElement('tr');
    const tel = Object.assign(document.createElement('a'), { href: 'tel:' + String(b.phone).replace(/[^\d+]/g, ''), textContent: b.phone });
    for (const cell of [when(b.createdAt), b.name, tel, '№' + b.no, when(b.datetime)]) {
      const td = document.createElement('td');
      td.append(cell);
      tr.append(td);
    }
    return tr;
  }));
}

function start() {
  load();
  clearInterval(timer);
  timer = setInterval(load, EVERY_MS);
}

function init() {
  applyStatic();
  initLangSwitcher();
  initTheme();
  initIcons();
  onLangChange(() => { if (!$('bkList').hidden) render(true); });
  $('admLogin').addEventListener('submit', e => {
    e.preventDefault();
    token = e.target.elements.token.value.trim();
    try { sessionStorage.setItem(KEY, token); } catch { /* ignore */ }
    e.target.reset();
    start();
  });
  $('admLogout').addEventListener('click', () => logout());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  if (token) start();
}

init();
