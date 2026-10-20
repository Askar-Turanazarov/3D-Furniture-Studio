// Manager page «Журнал вызовов»: the MCP call log (mcp-calls.jsonl) through GET /api/calls, refreshed every 3 s.
// Each subagent has its own tools, so the tool tells who called. Same sign-in as the orders page; data goes in as text only.
import { t, getLang, applyStatic, initLangSwitcher, onLangChange } from './i18n.js';
import { initTheme } from './theme.js';
import { initIcons } from './icons.js';

const $ = id => document.getElementById(id);
const LOCALE = { ru: 'ru-RU', uz: 'uz-UZ', en: 'en-GB' };
const KEY = 'fsp3d.adminToken';
const EVERY_MS = 3000;
const AGENT = { search_apartments: 'apt_finder', get_apartment: 'apt_finder', calc_mortgage: 'mortgage_consultant', book_viewing: 'booking_manager' };
const loc = () => LOCALE[getLang()] || 'en-GB';
const when = iso => new Date(iso).toLocaleString(loc(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Tashkent' });
const sum = n => `${Number(n).toLocaleString('ru-RU')} ${t('unit.sum')}`;

// The arguments in a few words: «2 комн. · до 900 000 000 сум», «№10 · 20 % · 15 лет · 22 %».
function argsText(tool, a = {}) {
  if (Array.isArray(a.fields)) return t('cl.fields', { v: a.fields.join(', ') || '—' });   // refused before the tool: names only
  const parts = [];
  if (tool === 'search_apartments') {
    if (a.rooms != null) parts.push(a.rooms ? t('cl.rooms', { n: a.rooms }) : t('bld.type.studio'));
    if (a.maxPrice != null) parts.push(t('cl.upTo', { v: sum(a.maxPrice) }));
    if (a.minArea != null) parts.push(t('cl.from', { v: a.minArea + ' ' + t('unit.m2') }));
    if (a.floor != null) parts.push(t('bld.floor', { n: a.floor }));
    if (a.status && a.status !== 'free') parts.push(a.status);
  } else if (tool === 'calc_mortgage') {
    if (a.loan != null) parts.push(t('cl.loan', { v: sum(a.loan) }));
    if (a.price != null) parts.push(sum(a.price));
    if (a.no != null) parts.push('№' + a.no);
    if (a.downPct) parts.push(`${a.downPct} %`);
    parts.push(t('cl.years', { n: a.years }), `${a.rate} %`);
  } else {
    if (a.no != null) parts.push('№' + a.no);
    if (a.datetime) parts.push(String(a.datetime).replace('T', ' '));
  }
  return parts.join(' · ') || '—';
}

let token = '';
try { token = sessionStorage.getItem(KEY) || ''; } catch { /* storage off */ }
let events = [];
let shown = '';
let timer = null;
let failed = false;

let toastTimer;
function toast(text) {
  const box = $('toast');
  box.textContent = text;
  box.className = 'toast error';
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, 5000);
}

function logout(msg = '') {
  token = '';
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  clearInterval(timer);
  timer = null;
  $('clList').hidden = true;
  $('admLogout').hidden = true;
  $('admLogin').hidden = false;
  $('admLoginErr').textContent = msg;
}

async function load() {
  if (!token || document.hidden) return;
  let res;
  try { res = await fetch('/api/calls', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' }); } catch { res = null; }
  if (res && (res.status === 401 || res.status === 503)) return logout(res.status === 503 ? t('adm.disabled') : t('adm.badToken'));
  if (!res || !res.ok) {
    if (!failed) toast(t('cl.loadFail'));
    failed = true;
    return renderStats();
  }
  failed = false;
  events = await res.json();
  $('admLogin').hidden = true;
  $('clList').hidden = false;
  $('admLogout').hidden = false;
  render();
}

const chip = (text, cls) => Object.assign(document.createElement('span'), { className: 'cl-chip ' + cls, textContent: text });

function renderStats() {
  const calls = events.filter(e => e.type === 'call');
  const by = a => calls.filter(e => AGENT[e.tool] === a).length;
  const box = $('clStats');
  box.replaceChildren(
    chip(t('cl.total', { n: calls.length }), ''),
    chip(t('cl.errors', { n: calls.filter(e => !e.ok).length }), 'bad'),
    chip(t('cl.denied', { n: events.filter(e => e.type === 'denied').length }), 'deny'),
    ...['apt_finder', 'mortgage_consultant', 'booking_manager'].map(a => chip(`${a}: ${by(a)}`, 'agent')),
    Object.assign(document.createElement('span'), { className: 'bk-live',
      textContent: failed ? t('bk.offline') : t('cl.live', { time: new Date().toLocaleTimeString(loc(), { timeZone: 'Asia/Tashkent' }) }) }));
}

function render(force = false) {
  renderStats();
  const key = JSON.stringify(events) + getLang();
  if (!force && key === shown) return;
  shown = key;
  $('clEmpty').hidden = events.length > 0;
  $('clTable').hidden = !events.length;
  $('clRows').replaceChildren(...events.map(e => {
    const tr = document.createElement('tr');
    const denied = e.type === 'denied';
    const result = denied ? chip(t(e.reason === 'bad_token' ? 'cl.badToken' : 'cl.noToken'), 'deny')
      : chip(e.ok ? t('cl.ok') : t('cl.err'), e.ok ? 'good' : 'bad');
    const resCell = document.createElement('span');
    resCell.append(result, e.msg ? ' ' + e.msg : '');
    for (const cell of [when(e.at), denied ? '—' : AGENT[e.tool] || '—', denied ? '—' : e.tool, denied ? '—' : argsText(e.tool, e.args), resCell, denied ? '' : String(e.ms ?? '')]) {
      const td = document.createElement('td');
      td.append(cell);
      tr.append(td);
    }
    if (denied) tr.className = 'cl-denied';
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
  onLangChange(() => { if (!$('clList').hidden) render(true); });
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
