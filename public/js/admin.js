// Manager page: orders from order.json, statuses, notes. Every request carries Authorization: Bearer <ADMIN_TOKEN>;
// the token lives only in this tab (sessionStorage). User data is put into the page as text, never as HTML.
import { t, getLang, applyStatic, initLangSwitcher, onLangChange } from './i18n.js';

const $ = id => document.getElementById(id);
const STATUSES = ['new', 'inWork', 'measure', 'done', 'cancelled'];
const LOCALE = { ru: 'ru-RU', uz: 'uz-UZ', en: 'en-GB' };
const KEY = 'fsp3d.adminToken';
const sum = v => `${String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${t('unit.sum')}`;
const when = iso => new Date(iso).toLocaleString(LOCALE[getLang()] || 'en-GB', { dateStyle: 'short', timeStyle: 'short' });

let token = '';
try { token = sessionStorage.getItem(KEY) || ''; } catch { /* storage off */ }
let orders = [];
let openId = null;
const blobs = [];

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids.filter(k => k != null && k !== false));
  return e;
}

let toastTimer;
function toast(text, isError = false) {
  const box = $('toast');
  box.textContent = text;
  box.className = 'toast' + (isError ? ' error' : '');
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, isError ? 5000 : 3000);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: 'Bearer ' + token, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) }
  });
  if (res.status === 401 || res.status === 503) {
    logout(res.status === 503 ? t('adm.disabled') : t('adm.badToken'));
    throw new Error('auth');
  }
  if (!res.ok) throw new Error(String(res.status));
  return res;
}

function logout(msg = '') {
  token = '';
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  $('admList').hidden = true;
  $('admLogout').hidden = true;
  $('admLogin').hidden = false;
  $('admLoginErr').textContent = msg;
  $('admDlg').open && $('admDlg').close();
}

async function load() {
  try {
    orders = await (await api('/api/orders')).json();
  } catch (e) {
    if (e.message !== 'auth') toast(t('adm.loadFail'), true);
    return;
  }
  $('admLogin').hidden = true;
  $('admList').hidden = false;
  $('admLogout').hidden = false;
  renderList();
}

const roomLabel = o => [o.project?.name, o.rooms?.length ? t('adm.rooms', { n: o.rooms.length }) : o.roomName]
  .filter(Boolean).join(' / ');

function statusSelect(o) {
  const s = el('select', { ariaLabel: t('adm.status') },
    ...STATUSES.map(v => el('option', { value: v, textContent: t('st.' + v) })));
  s.value = o.status || 'new';
  s.addEventListener('click', e => e.stopPropagation());
  s.addEventListener('change', () => patch(o.id, { status: s.value }));
  return s;
}

function renderList() {
  const f = $('admFilter').value, q = $('admSearch').value.trim().toLowerCase();
  const rows = orders.filter(o => (!f || (o.status || 'new') === f)
    && (!q || [o.id, o.name, o.phone, o.project?.name, o.roomName, o.comment].join(' ').toLowerCase().includes(q)));
  $('admRows').replaceChildren(...rows.map(o => {
    const tr = el('tr', { className: 'st-' + (o.status || 'new') },
      el('td', { textContent: o.id }),
      el('td', { textContent: when(o.createdAt) }),
      el('td', { textContent: o.name }),
      el('td', {}, el('a', { href: 'tel:' + String(o.phone).replace(/[^\d+]/g, ''), textContent: o.phone,
        onclick: e => e.stopPropagation() })),
      el('td', { textContent: roomLabel(o) }),
      el('td', { className: 'num', textContent: o.estimate ? sum(o.estimate) : '—' }),
      el('td', {}, statusSelect(o)));
    tr.addEventListener('click', () => openCard(o.id));
    return tr;
  }));
  $('admEmpty').hidden = rows.length > 0;
}

async function patch(id, body) {
  try {
    const next = await (await api('/api/orders/' + id, { method: 'PATCH', body: JSON.stringify(body) })).json();
    orders = orders.map(o => (o.id === id ? next : o));
    renderList();
    if (openId === id) openCard(id);
    toast(t('adm.saved'));
  } catch (e) {
    if (e.message !== 'auth') toast(t('adm.saveFail'), true);
  }
}

// Picture of an order through the token → blob URL (freed when the card closes).
async function picture(id, file) {
  try {
    const url = URL.createObjectURL(await (await api(`/api/orders/${id}/${file}`)).blob());
    blobs.push(url);
    return el('img', { src: url, alt: file });
  } catch { return null; }
}

function spec(items) {
  return el('table', { className: 'adm-spec' },
    el('thead', {}, el('tr', {}, ...['drw.no', 'drw.name', 'drw.dims', 'drw.elev', 'drw.conf', 'drw.price']
      .map(k => el('th', { textContent: t(k) })))),
    el('tbody', {}, ...items.map((it, i) => el('tr', {},
      el('td', { textContent: i + 1 }),
      el('td', { textContent: it.name || it.type }),
      el('td', { textContent: `${it.w}×${it.d}×${it.h}` }),
      el('td', { textContent: it.elev ? '↑' + it.elev : '—' }),
      el('td', { textContent: [
        it.materials && Object.values(it.materials).join(' / '),
        it.sections != null && `${t('cfg.sections')}: ${it.sections}`,
        it.drawers ? `${t('cfg.drawers')}: ${it.drawers}` : null,
        it.open?.kind && t('open.' + it.open.kind)
      ].filter(Boolean).join(', ') || '—' }),
      el('td', { textContent: it.price ? sum(it.price) : t('drw.noPrice') })))));
}

async function openCard(id) {
  const o = orders.find(x => x.id === id);
  if (!o) return;
  openId = id;
  $('admDlgTitle').textContent = t('adm.card', { id: o.id });
  const rooms = o.rooms?.length ? o.rooms : [{ name: o.roomName, purpose: o.purpose, room: o.room, items: o.items }];
  const note = el('textarea', { className: 'adm-note', value: o.note || '', maxLength: 2000 });
  const body = el('div', {},
    el('dl', { className: 'adm-meta' },
      el('dt', { textContent: t('adm.date') }), el('dd', { textContent: when(o.createdAt) }),
      el('dt', { textContent: t('order.name') }), el('dd', { textContent: o.name }),
      el('dt', { textContent: t('order.phone') }),
      el('dd', {}, el('a', { href: 'tel:' + String(o.phone).replace(/[^\d+]/g, ''), textContent: o.phone })),
      el('dt', { textContent: t('adm.room') }), el('dd', { textContent: roomLabel(o) }),
      el('dt', { textContent: t('adm.sum') }), el('dd', { textContent: o.estimate ? t('price.from', { sum: sum(o.estimate) }) : '—' }),
      el('dt', { textContent: t('adm.status') }), el('dd', {}, statusSelect(o)),
      el('dt', { textContent: t('order.comment') }), el('dd', { textContent: o.comment || '—' })),
    el('div', { className: 'adm-pics', id: 'admPics' }),
    ...rooms.flatMap(r => [
      el('h3', { textContent: [r.name, r.room && `${r.room.L}×${r.room.W}×${r.room.H} ${t('unit.cm')}`].filter(Boolean).join(' · ') }),
      spec(r.items || [])
    ]),
    el('h3', { textContent: t('adm.note') }), note,
    el('div', { className: 'btn-row end' },
      el('button', { type: 'button', className: 'btn primary', textContent: t('adm.saveNote'),
        onclick: () => patch(o.id, { note: note.value }) })),
    o.history?.length ? el('h3', { textContent: t('adm.history') }) : null,
    o.history?.length ? el('ul', { className: 'adm-hist' },
      ...o.history.map(h => el('li', { textContent: `${when(h.at)} — ${t('st.' + h.status)}` }))) : null);
  $('admDlgBody').replaceChildren(body);
  if (!$('admDlg').open) $('admDlg').showModal();
  const files = (o.files || []).map(f => f.split('/').pop());
  const pics = await Promise.all(files.map(f => picture(o.id, f)));
  if (openId === id) $('admPics').replaceChildren(...pics.filter(Boolean));
}

function fillFilter() {
  const v = $('admFilter').value;
  $('admFilter').replaceChildren(el('option', { value: '', textContent: t('adm.all') }),
    ...STATUSES.map(s => el('option', { value: s, textContent: t('st.' + s) })));
  $('admFilter').value = v;
  $('admSearch').placeholder = t('adm.search');
  document.title = t('adm.title');
}

function init() {
  applyStatic();
  initLangSwitcher();
  fillFilter();
  onLangChange(() => {
    fillFilter();
    if (!$('admList').hidden) renderList();
    if ($('admDlg').open) openCard(openId);
  });
  $('admLogin').addEventListener('submit', e => {
    e.preventDefault();
    token = e.target.elements.token.value.trim();
    try { sessionStorage.setItem(KEY, token); } catch { /* ignore */ }
    e.target.reset();
    load();
  });
  $('admLogout').addEventListener('click', () => logout());
  $('admReload').addEventListener('click', load);
  $('admFilter').addEventListener('change', renderList);
  $('admSearch').addEventListener('input', renderList);
  $('admDlgClose').addEventListener('click', () => $('admDlg').close());
  $('admDlg').addEventListener('close', () => {
    openId = null;
    blobs.splice(0).forEach(u => URL.revokeObjectURL(u));
  });
  if (token) load();
}

init();
