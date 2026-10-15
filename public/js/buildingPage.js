// New-building showcase (/building.html?b=<id>): floors with free/booked/sold counts, filters, a floor plan coloured
// by status or rooms with a tooltip, the apartment card (plan with sizes, rooms, price), "Open in the planner"
// (a copy in this browser's projects) and a request for the apartment (POST /api/order with apartmentRef).
// The main view is the building in 3D (bld3d/exterior.js); the floor grid stays as a scheme and without WebGL.
import { t, getLang, initLangSwitcher, onLangChange } from './i18n.js';
import { roomRect, roomArea } from './apartment.js';
import { rectOf } from './geometry.js';
import { DEPTH, TYPES, localRoomName } from './building.js';
import { FILE_FORMAT, VERSION } from './storage.js';

const $ = id => document.getElementById(id);
const BUILDING = new URLSearchParams(location.search).get('b') || 'novostroyka-12';
export const HANDOFF = 'fsp3d.handoff';
const STATUSES = ['free', 'booked', 'sold'];
const ST_FILL = { free: '#b2f2bb', booked: '#ffd8a8', sold: '#dee2e6' };
const ST_LINE = { free: '#2b8a3e', booked: '#d9480f', sold: '#868e96' };
const ROOMS_FILL = ['#e5dbff', '#d0ebff', '#c3fae8', '#fff3bf', '#ffdeeb'];   // studio, 1–4 rooms
const LOCALE = { ru: 'ru-RU', uz: 'uz-UZ', en: 'en-GB' };
const ROOM_COUNTS = [...new Set(Object.values(TYPES).map(x => x.rooms))].sort();

let b = null, floorN = 2, colorBy = 'status', hover = null, cardApt = null, view = null;
let ext = null, hover3d = null;   // the 3D facade and the apartment under the mouse there
let tint3d = true;                // windows coloured by status / rooms, or plain glass
const filter = { rooms: new Set(), areaMin: null, areaMax: null, priceMax: null, free: false };
try { colorBy = localStorage.getItem('fsp3d.bldColor') === 'rooms' ? 'rooms' : 'status'; } catch { /* ignore */ }

const num = (v, d = 1) => new Intl.NumberFormat(LOCALE[getLang()] || 'en-GB', { maximumFractionDigits: d }).format(v);
const sum = v => `${String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${t('unit.sum')}`;
const local = o => o?.[getLang()] || o?.ru || '';
const typeName = a => t('bld.type.' + a.type);
const allApts = () => b.floorsData.flatMap(f => f.apartments);
const byNo = no => allApts().find(a => a.no === no);
const floorOf = n => b.floorsData.find(f => f.n === n);
const matches = a => (!filter.rooms.size || filter.rooms.has(a.rooms))
  && (filter.areaMin == null || a.area >= filter.areaMin) && (filter.areaMax == null || a.area <= filter.areaMax)
  && (filter.priceMax == null || a.price <= filter.priceMax * 1e6) && (!filter.free || a.status === 'free');
const fillOf = a => (colorBy === 'status' ? ST_FILL[a.status] : ROOMS_FILL[a.rooms]);

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
  toastTimer = setTimeout(() => { box.hidden = true; }, isError ? 5000 : 3500);
}

// ---------- filters ----------
function renderFilters() {
  $('fRooms').replaceChildren(el('button', { type: 'button', className: filter.rooms.size ? '' : 'active', textContent: t('bld.all'),
    onclick: () => { filter.rooms.clear(); renderAll(); } }),
  ...ROOM_COUNTS.map(n => el('button', { type: 'button', className: filter.rooms.has(n) ? 'active' : '',
    textContent: n ? String(n) : t('bld.type.studio'),
    onclick: () => { filter.rooms.has(n) ? filter.rooms.delete(n) : filter.rooms.add(n); renderAll(); } })));
  const list = allApts().filter(matches);
  $('fFound').textContent = t('bld.found', { n: list.length });
}

function readFilters() {
  const v = id => { const x = parseFloat($(id).value); return Number.isFinite(x) ? x : null; };
  filter.areaMin = v('fAreaMin');
  filter.areaMax = v('fAreaMax');
  filter.priceMax = v('fPrice');
  filter.free = $('fFree').checked;
  renderAll();
}

// ---------- facade: one row per floor, a cell per apartment (north band, then south) ----------
function renderFacade() {
  $('bldFacade').replaceChildren(...[...b.floorsData].reverse().map(f => {
    const row = el('div', { className: 'bld-floor' + (f.n === floorN ? ' active' : ''), role: 'button', tabIndex: 0 });
    row.dataset.floor = f.n;
    const cells = el('span', { className: 'bld-cells' });
    if (!f.apartments.length) cells.append(el('span', { className: 'bld-lobby', textContent: t('bld.lobbyFloor') }));
    for (const side of ['north', 'south']) {
      const band = el('span', { className: 'bld-band' });
      for (const a of f.apartments.filter(x => x.side === side)) {
        const c = el('span', { className: `bld-cell st-${a.status}` + (matches(a) ? '' : ' dim'),
          title: `№${a.no} · ${typeName(a)} · ${num(a.area)} ${t('unit.m2')} · ${t('bld.st.' + a.status)}` });
        c.style.flexGrow = a.w;
        c.dataset.apt = a.no;
        band.append(c);
      }
      if (band.childElementCount) cells.append(band);
    }
    const fit = f.apartments.filter(matches);
    const cnt = Object.fromEntries(STATUSES.map(s => [s, fit.filter(a => a.status === s).length]));
    row.append(el('span', { className: 'bld-fl-n', textContent: f.n }), cells,
      el('span', { className: 'bld-cnt', textContent: f.apartments.length ? t('bld.counts', cnt) : '' }));
    return row;
  }));
}

function legend() {
  const item = (fill, text) => el('span', {}, el('i', { style: `background:${fill}` }), text);
  $('bldLegendSt').replaceChildren(...STATUSES.map(s => item(ST_FILL[s], t('bld.st.' + s))));
  $('bldLegend').replaceChildren(...(colorBy === 'status'
    ? STATUSES.map(s => item(ST_FILL[s], t('bld.st.' + s)))
    : ROOM_COUNTS.map(n => item(ROOMS_FILL[n], n ? t('bld.nRooms', { n }) : t('bld.type.studio')))));
}

// ---------- drawing ----------
// Rooms of an apartment at `at` (cm on the floor) with walls, windows and doors; s — px per cm, (ox, oy) — px offset.
function drawRooms(g, plan, at, s, ox, oy, { fill = '#fff', wall = '#343a40', lw = 1, furniture = false } = {}) {
  const box = r => { const q = roomRect(r); return [ox + (at.x + q.x) * s, oy + (at.y + q.y) * s, q.w * s, q.h * s]; };
  for (const r of plan) {
    g.fillStyle = typeof fill === 'function' ? fill(r) : fill;
    g.fillRect(...box(r));
  }
  if (furniture) {
    for (const r of plan) {
      const [x0, y0] = box(r);
      for (const it of r.items || []) {
        const q = rectOf(it);
        g.fillStyle = it.layer === 'decor' ? 'rgba(134,142,150,.12)' : 'rgba(73,80,87,.16)';
        g.strokeStyle = 'rgba(73,80,87,.55)';
        g.lineWidth = 0.75;
        g.fillRect(x0 + q.x * s, y0 + q.y * s, q.w * s, q.h * s);
        g.strokeRect(x0 + q.x * s, y0 + q.y * s, q.w * s, q.h * s);
      }
    }
  }
  g.strokeStyle = wall;
  g.lineWidth = lw;
  for (const r of plan) g.strokeRect(...box(r));
  for (const r of plan) {
    const [x, y, w, h] = box(r);
    for (const o of r.openings) {
      const p = o.offset * s, q = (o.offset + o.width) * s;
      const seg = { north: [p, 0, q, 0], south: [p, h, q, h], west: [0, p, 0, q], east: [w, p, w, q] }[o.wall];
      g.beginPath();
      g.moveTo(x + seg[0], y + seg[1]);
      g.lineTo(x + seg[2], y + seg[3]);
      g.strokeStyle = o.kind === 'window' ? '#4dabf7' : '#fff';
      g.lineWidth = o.kind === 'window' ? lw + 2 : lw + 1.5;
      g.stroke();
    }
  }
}

function sizeCanvas(cv, cw, ch) {
  const dpr = window.devicePixelRatio || 1;
  cv.style.height = ch + 'px';
  cv.width = Math.round(cw * dpr);
  cv.height = Math.round(ch * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return g;
}

function label(g, text, x, y, { size = 12, color = '#212529', bold = false } = {}) {
  g.font = `${bold ? 600 : 400} ${size}px system-ui, sans-serif`;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

// Bounding box of an apartment on the floor (cm): its strip from the facade to the corridor.
const unitBox = a => ({ x: a.at.x, y: a.at.y, w: a.w, h: DEPTH });

function drawFloor() {
  const cv = $('bldPlan'), f = floorOf(floorN);
  const cw = cv.parentElement.clientWidth || 600, pad = 14;
  const s = (cw - 2 * pad) / b.section.L;
  const g = sizeCanvas(cv, cw, Math.round(b.section.W * s + 2 * pad));
  view = { s, ox: pad, oy: pad };
  const R = q => [pad + q.x * s, pad + q.y * s, q.w * s, q.h * s];
  g.clearRect(0, 0, cw, cv.height);
  g.fillStyle = '#f8f9fa';
  g.fillRect(...R({ x: 0, y: 0, w: b.section.L, h: b.section.W }));
  const small = Math.max(10, Math.min(13, s * 40));
  if (f.lobby) {
    g.fillStyle = '#e7f5ff';
    g.fillRect(...R(f.lobby));
    const [x, y, w, h] = R(f.lobby);
    label(g, t('bld.lobby'), x + w / 2, y + h / 2, { size: small + 2, bold: true });
    for (const c of f.commercial) {
      g.fillStyle = '#fff4e6';
      g.fillRect(...R(c));
      g.strokeStyle = '#adb5bd';
      g.strokeRect(...R(c));
      const [cx, cy, cw2, ch2] = R(c);
      label(g, t('bld.commercial'), cx + cw2 / 2, cy + ch2 / 2, { size: small + 1 });
    }
  } else {
    g.fillStyle = '#e9ecef';
    g.fillRect(...R(b.corridor));
    const [x, y, w, h] = R(b.corridor);
    label(g, t('bld.corridor'), x + w * 0.25, y + h / 2, { size: small, color: '#868e96' });
    label(g, t('bld.corridor'), x + w * 0.75, y + h / 2, { size: small, color: '#868e96' });
  }
  g.fillStyle = '#ced4da';
  g.fillRect(...R(b.core));
  const [kx, ky, kw, kh] = R(b.core);
  label(g, t('bld.core'), kx + kw / 2, ky + kh / 2, { size: small, color: '#495057' });
  for (const a of f.apartments) {
    const on = matches(a);
    const [x, y, w, h] = R(unitBox(a));
    // the apartment outline first: windows and the front door are drawn over it
    g.strokeStyle = '#343a40';
    g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
    g.save();
    g.globalAlpha = on ? 1 : 0.3;
    drawRooms(g, a.plan, a.at, s, pad, pad, { fill: fillOf(a), lw: 1 });
    g.restore();
    if (a.no === hover) {
      g.strokeStyle = '#3b5bdb';
      g.lineWidth = 3;
      g.strokeRect(x - 1, y - 1, w + 2, h + 2);
    }
    const cy = y + h * (a.side === 'north' ? 0.3 : 0.7);
    label(g, `№${a.no}`, x + w / 2, cy - small * 0.7, { size: small + 1, bold: true, color: on ? '#212529' : '#868e96' });
    label(g, `${a.rooms ? a.rooms + t('bld.roomsShort') : t('bld.type.studio')} · ${num(a.area)} ${t('unit.m2')}`,
      x + w / 2, cy + small * 0.6, { size: small - 1, color: on ? '#343a40' : '#868e96' });
  }
  // outer walls (outside the facade line, so the windows stay visible)
  g.strokeStyle = '#212529';
  g.lineWidth = 3;
  g.strokeRect(...R({ x: -6 - 1.5 / s, y: -6 - 1.5 / s, w: b.section.L + 12 + 3 / s, h: b.section.W + 12 + 3 / s }));
  $('floorTitle').textContent = t('bld.floor', { n: floorN });
  $('floorDown').disabled = floorN <= 1;
  $('floorUp').disabled = floorN >= b.floors;
}

function aptAt(e) {
  if (!view) return null;
  const r = $('bldPlan').getBoundingClientRect();
  const x = (e.clientX - r.left - view.ox) / view.s, y = (e.clientY - r.top - view.oy) / view.s;
  return floorOf(floorN).apartments.find(a => { const q = unitBox(a); return x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h; }) || null;
}

function showTip(a, e, wrapEl = $('planWrap'), tip = $('bldTip')) {
  if (!a) { tip.hidden = true; return; }
  tip.replaceChildren(
    el('b', { textContent: `№${a.no} · ${typeName(a)}` }),
    el('span', { textContent: `${num(a.area)} ${t('unit.m2')} · ${t('bld.floorShort', { n: a.floor })}` }),
    el('span', { textContent: sum(a.price) }),
    el('span', { className: 'bld-st st-' + a.status, textContent: t('bld.st.' + a.status) }));
  tip.hidden = false;
  const wrap = wrapEl.getBoundingClientRect();
  const x = e.clientX - wrap.left + 14, y = e.clientY - wrap.top + 14;
  tip.style.left = Math.min(x, wrap.width - tip.offsetWidth - 4) + 'px';
  tip.style.top = Math.min(y, wrap.height - tip.offsetHeight - 4) + 'px';
}

// ---------- apartment card ----------
function roomName(r) { return localRoomName(r.name, getLang()); }

function drawCard(a) {
  const cv = $('aptPlan');
  const rs = a.plan.map(roomRect);
  const x0 = Math.min(...rs.map(q => q.x)), y0 = Math.min(...rs.map(q => q.y));
  const L = Math.max(...rs.map(q => q.x + q.w)) - x0, W = Math.max(...rs.map(q => q.y + q.h)) - y0;
  const cw = cv.clientWidth || 420, pad = 18;
  const s = (cw - 2 * pad) / L;
  const g = sizeCanvas(cv, cw, Math.round(W * s + 2 * pad));
  g.clearRect(0, 0, cw, cv.height);
  const ox = pad - x0 * s, oy = pad - y0 * s;
  drawRooms(g, a.plan, { x: 0, y: 0 }, s, ox, oy, { fill: '#fff', lw: 2, furniture: true });
  for (const r of a.plan) {
    const q = roomRect(r), cx = ox + (q.x + q.w / 2) * s, cy = oy + (q.y + q.h / 2) * s;
    const fs = q.w * s < 70 || q.h * s < 50 ? 9 : 11;
    g.fillStyle = 'rgba(255,255,255,.8)';
    const name = roomName(r), dims = `${num(r.room.L / 100, 2)}×${num(r.room.W / 100, 2)}`;
    g.font = `600 ${fs}px system-ui, sans-serif`;
    const tw = Math.max(g.measureText(name).width, g.measureText(dims).width) + 6;
    g.fillRect(cx - tw / 2, cy - fs * 1.6, tw, fs * 3.4);
    label(g, name, cx, cy - fs * 0.8, { size: fs, bold: true });
    label(g, dims, cx, cy + fs * 0.25, { size: fs - 1, color: '#495057' });
    label(g, `${num(roomArea(r))} ${t('unit.m2')}`, cx, cy + fs * 1.2, { size: fs - 1, color: '#495057' });
  }
  // overall size of the apartment
  label(g, `${num(L / 100, 2)} ${t('bld.m')}`, pad + L * s / 2, pad / 2, { size: 11, color: '#495057' });
}

function openCard(a) {
  cardApt = a;
  $('aptTitle').textContent = `${t('bld.apt', { no: a.no })} · ${typeName(a)}`;
  const dd = (k, v) => [el('dt', { textContent: t(k) }), el('dd', {}, v)];
  $('aptMeta').replaceChildren(
    ...dd('bld.status', el('span', { className: 'bld-st st-' + a.status, textContent: t('bld.st.' + a.status) })),
    ...dd('bld.floorLabel', `${a.floor} / ${b.floors}`),
    ...dd('bld.total', `${num(a.area)} ${t('unit.m2')}`),
    ...dd('bld.price', sum(a.price)),
    ...dd('bld.perM2', sum(a.price / a.area)),
    ...dd('bld.windows', [t('bld.side.' + a.side), a.corner && t('bld.corner')].filter(Boolean).join(', ')));
  $('aptRooms').replaceChildren(el('tbody', {}, ...a.plan.map(r => el('tr', {},
    el('td', { textContent: roomName(r) }),
    el('td', { className: 'num', textContent: `${num(r.room.L / 100, 2)} × ${num(r.room.W / 100, 2)}` }),
    el('td', { className: 'num', textContent: `${num(roomArea(r))} ${t('unit.m2')}` })))));
  $('aptRequest').disabled = a.status === 'sold';
  $('aptRequest').title = a.status === 'sold' ? t('bld.soldNote') : '';
  if (!$('aptDlg').open) $('aptDlg').showModal();
  requestAnimationFrame(() => drawCard(a));
}

// A copy of the apartment for the planner: handed over through localStorage, the planner imports it on start.
function openInPlanner(a) {
  const lang = getLang();
  const project = {
    name: `${local(b.name)}, ${t('bld.apt', { no: a.no })}`,
    activeRoomId: (a.plan.find(r => r.purpose === 'kitchenLiving' || r.purpose === 'living') || a.plan[0]).id,
    rooms: a.plan.map(r => ({ ...structuredClone(r), name: localRoomName(r.name, lang) }))
  };
  try {
    localStorage.setItem(HANDOFF, JSON.stringify({ format: FILE_FORMAT, version: VERSION, project }));
  } catch {
    toast(t('storage.full'), true);
    return;
  }
  location.href = '/';
}

// From the street through the doors: a short fade, then the lobby in the floor dialog (the walker at the doors).
async function enterLobby() {
  const fade = Object.assign(document.createElement('div'), { className: 'fade3d' });
  $('bld3dView').append(fade);
  requestAnimationFrame(() => fade.classList.add('on'));
  await new Promise(r => setTimeout(r, 320));
  $('floor3dTitle').textContent = `${t('bld.lobbyFloor')} · 3D`;
  $('floor3dFrame').src = `/?embed=building&b=${encodeURIComponent(b.id)}&floor=1&from=street`;
  $('floor3dDlg').showModal();
  fade.remove();
}

// The floor in 3D: the planner's 3D view embedded (temporary project, nothing saved), walking from the entrance.
function open3d(a) {
  $('floor3dTitle').textContent = `${t('bld.apt', { no: a.no })} · ${t('bld.floor', { n: a.floor })} · 3D`;
  $('floor3dFrame').src = `/?embed=floor&b=${encodeURIComponent(b.id)}&apt=${a.no}`;
  $('floor3dDlg').showModal();
}

function openRequest(a) {
  $('reqTitle').textContent = t('bld.reqTitle', { no: a.no });
  $('reqDlg').showModal();
}

async function sendRequest(e) {
  e.preventDefault();
  const f = e.target.elements, a = cardApt;
  const body = {
    name: f.name.value, phone: f.phone.value, comment: f.comment.value, website: f.website.value, lang: getLang(),
    project: { name: `${local(b.name)}, ${t('bld.apt', { no: a.no })}` },
    apartmentRef: { building: b.id, floor: a.floor, apt: a.no }
  };
  try {
    const res = await fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) return toast(t('order.tooMany'), true);
    if (res.status === 400) return toast(t('order.invalid', { field: data.field || '?' }), true);
    if (!res.ok) throw new Error(res.status);
    $('reqDlg').close();
    e.target.reset();
    toast(t('bld.reqOk', { id: data.id }));
  } catch {
    toast(t('order.fail'), true);
  }
}

// ---------- page ----------
function renderAll() {
  renderFilters();
  renderFacade();
  legend();
  drawFloor();
  paint3d();
  document.querySelectorAll('#colorBy [data-by]').forEach(x => x.classList.toggle('active', x.dataset.by === colorBy));
}

function setFloor(n) {
  floorN = Math.max(1, Math.min(b.floors, n));
  hover = null;
  $('bldTip').hidden = true;
  renderFacade();
  drawFloor();
  ext?.setFloor(floorN);
}

// ---------- 3D facade ----------
function paint3d() {
  ext?.paint({ colorOf: no => (tint3d ? fillOf(byNo(no)) : null), dim: no => !matches(byNo(no)), hover: hover3d });
}

function sync3dHud() {
  if (!ext) return;
  document.querySelectorAll('#bld3dTime [data-time]').forEach(x => {
    x.classList.toggle('active', x.dataset.time === ext.getTime());
    x.title = t('bld3d.' + x.dataset.time);
  });
  $('bld3dOrbit').classList.toggle('active', ext.getAuto() && !ext.isWalking());
  $('bld3dWalk').classList.toggle('active', ext.isWalking());
  $('bld3dPad').hidden = !(ext.isWalking() && matchMedia('(pointer: coarse)').matches);
  $('bld3dTint').classList.toggle('active', tint3d);
  const touch = matchMedia('(pointer: coarse)').matches;
  $('bld3dHint').textContent = t(ext.isWalking() ? (touch ? 'bld3d.walkHintTouch' : 'bld3d.walkHint') : touch ? 'bld3d.hintTouch' : 'bld3d.hint');
}

async function init3d() {
  try {
    const [{ createExterior }, { facadeOf }] = await Promise.all([import('./bld3d/exterior.js'), import('./facade.js')]);
    ext = createExterior($('bld3dView'), {
      bld: b, fac: facadeOf(b), title: local(b.name),
      onHover: (no, e) => {
        if (no !== hover3d) { hover3d = no; paint3d(); }
        showTip(no ? byNo(no) : null, e, $('bld3dView'), $('bld3dTip'));
      },
      onPick: no => { const a = byNo(no); setFloor(a.floor); openCard(a); },
      onFloor: n => { if (n !== floorN) setFloor(n); },
      onDoor: enterLobby,
      onWalk: () => sync3dHud()
    });
  } catch {
    $('bld3dCard').hidden = true;   // no WebGL: the floor grid and plan remain
    return;
  }
  $('bld3dTime').addEventListener('click', e => {
    const x = e.target.closest('[data-time]');
    if (x) { ext.setTime(x.dataset.time); sync3dHud(); }
  });
  $('bld3dOrbit').addEventListener('click', () => { ext.endWalk(); ext.setAuto(!ext.getAuto()); sync3dHud(); });
  $('bld3dWalk').addEventListener('click', () => {
    if (ext.isWalking()) ext.endWalk(); else ext.startWalk('street');
    $('bld3dWalk').blur();
    sync3dHud();
  });
  // Touch: hold ▲ / ▼ to walk.
  for (const btn of $('bld3dPad').querySelectorAll('[data-f]')) {
    const set = v => e => { e.preventDefault(); ext.walkPad.f = v; ext.requestRender(); };
    btn.addEventListener('pointerdown', set(Number(btn.dataset.f)));
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, set(0));
  }
  $('bld3dTint').addEventListener('click', () => { tint3d = !tint3d; paint3d(); sync3dHud(); });
  // The facade stands still while a dialog covers it (the floor 3D has its own scene).
  const pause = () => ext.pause(['aptDlg', 'floor3dDlg', 'reqDlg'].some(id => $(id).open));
  for (const id of ['aptDlg', 'floor3dDlg', 'reqDlg']) new MutationObserver(pause).observe($(id), { attributes: true, attributeFilter: ['open'] });
  pause();
  ext.setFloor(floorN);
  paint3d();
  sync3dHud();
}

function bind() {
  for (const id of ['fAreaMin', 'fAreaMax', 'fPrice']) $(id).addEventListener('input', readFilters);
  $('fFree').addEventListener('change', readFilters);
  $('floorDown').addEventListener('click', () => setFloor(floorN - 1));
  $('floorUp').addEventListener('click', () => setFloor(floorN + 1));
  $('colorBy').addEventListener('click', e => {
    const x = e.target.closest('[data-by]');
    if (!x) return;
    colorBy = x.dataset.by;
    try { localStorage.setItem('fsp3d.bldColor', colorBy); } catch { /* ignore */ }
    renderAll();
  });
  $('bldFacade').addEventListener('click', e => {
    const row = e.target.closest('[data-floor]');
    if (!row) return;
    setFloor(Number(row.dataset.floor));
    const cell = e.target.closest('[data-apt]');
    if (cell) openCard(allApts().find(a => a.no === Number(cell.dataset.apt)));
  });
  $('bldFacade').addEventListener('keydown', e => {
    const row = e.target.closest('[data-floor]');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setFloor(Number(row.dataset.floor)); }
  });
  const plan = $('bldPlan');
  plan.addEventListener('pointermove', e => {
    const a = aptAt(e);
    if ((a?.no ?? null) !== hover) { hover = a?.no ?? null; drawFloor(); }
    plan.style.cursor = a ? 'pointer' : 'default';
    showTip(a, e);
  });
  plan.addEventListener('pointerleave', () => { hover = null; $('bldTip').hidden = true; drawFloor(); });
  plan.addEventListener('click', e => { const a = aptAt(e); if (a) openCard(a); });
  $('aptClose').addEventListener('click', () => $('aptDlg').close());
  $('aptPlanner').addEventListener('click', () => openInPlanner(cardApt));
  $('apt3d').addEventListener('click', () => open3d(cardApt));
  $('floor3dClose').addEventListener('click', () => $('floor3dDlg').close());
  // The WebGL scene goes away with the dialog.
  $('floor3dDlg').addEventListener('close', () => { $('floor3dFrame').src = 'about:blank'; });
  // The walker went into another apartment of the floor: the dialog title follows.
  window.addEventListener('message', e => {
    if (e.origin !== location.origin || e.source !== $('floor3dFrame').contentWindow) return;
    // Out through the street doors of the lobby: back on the porch.
    if (e.data?.type === 'fsp3d:street') {
      $('floor3dDlg').close();
      if (ext) { ext.startWalk('porch'); sync3dHud(); }
      return;
    }
    if (e.data?.type !== 'fsp3d:place') return;
    const a = byNo(e.data.no), n = Number(e.data.floor);
    if (a) $('floor3dTitle').textContent = `${t('bld.apt', { no: a.no })} · ${t('bld.floor', { n: a.floor })} · 3D`;
    else if (n === 1) $('floor3dTitle').textContent = `${t('bld.lobbyFloor')} · 3D`;
    else if (n > 1) $('floor3dTitle').textContent = `${t('bld.floor', { n })} · 3D`;
  });
  $('aptRequest').addEventListener('click', () => openRequest(cardApt));
  $('reqCancel').addEventListener('click', () => $('reqDlg').close());
  $('reqForm').addEventListener('submit', sendRequest);
  new ResizeObserver(() => drawFloor()).observe($('planWrap'));
  onLangChange(() => {
    document.title = `${local(b.name)} — ${t('bld.title')}`;
    $('bldName').textContent = local(b.name);
    ext?.setTitle(local(b.name));
    sync3dHud();
    renderAll();
    if ($('aptDlg').open) openCard(cardApt);
    if ($('reqDlg').open) $('reqTitle').textContent = t('bld.reqTitle', { no: cardApt.no });
  });
}

async function start() {
  initLangSwitcher();
  try {
    const res = await fetch('/api/buildings/' + encodeURIComponent(BUILDING));
    if (!res.ok) throw new Error(res.status);
    b = await res.json();
  } catch {
    toast(t('bld.loadFail'), true);
    return;
  }
  document.title = `${local(b.name)} — ${t('bld.title')}`;
  $('bldName').textContent = local(b.name);
  const n = Number(new URLSearchParams(location.search).get('floor'));
  floorN = n >= 1 && n <= b.floors ? n : 2;
  bind();
  renderAll();
  init3d();
}

start();
