// Sidebar forms, item list, selection panel, notes column and toasts.
import { t, getLang } from './i18n.js';
import { state, emit, addItem, removeItems, rotateItem, duplicateItems, select, selected, selectedItems, getItem, itemName,
  selectOpening, selectedOpening, addOpening, removeOpening, updateOpening, setOpeningsLocked,
  selectObstacle, selectedOb, addObstacle, addNiche, removeObstacle, updateObstacle } from './state.js';
import { wallLen } from './openings.js';
import { openSpec } from './zones.js';
import { requestDraw, flash as drawFlash } from './renderer.js';

import { rectOf } from './geometry.js';
import { alignDeltas } from './align.js';
import { initMatPanel, renderMatPanel } from './matPanel.js';
import { initStylePanel, syncStylePanel } from './stylePanel.js';
import { initPricePanel, renderPricePanel, renderPriceTotal } from './pricePanel.js';
import { slideDoors } from './config.js';

const $ = id => document.getElementById(id);
const num = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

let errors = new Map();
let warnings = new Map();
let onAutoPlace = () => {};

export function initUI({ autoPlace }) {
  onAutoPlace = autoPlace;

  // Room size → rebuild plan on every input.
  const roomForm = $('roomForm');
  roomForm.addEventListener('input', () => {
    const f = roomForm.elements;
    const L = Number(f.L.value), W = Number(f.W.value), H = Number(f.H.value);
    if (L >= 50 && W >= 50 && H >= 100) {
      Object.assign(state.room, { L: num(L, 50, 3000), W: num(W, 50, 3000), H: num(H, 100, 600) });
      emit();
    }
  });

  // Type select fills default dimensions.
  const addForm = $('addForm');
  $('typeSelect').addEventListener('change', fillDefaults);
  addForm.addEventListener('submit', e => {
    e.preventDefault();
    const f = addForm.elements;
    const item = addItem({
      type: f.type.value,
      w: num(f.w.value, 1, 1000), d: num(f.d.value, 1, 1000), h: num(f.h.value, 1, 600),
      elev: f.elev.value === '' ? undefined : num(f.elev.value, 0, 600)
    });
    onAutoPlace(item, true);
  });

  // Selected item dims.
  $('selForm').addEventListener('input', () => {
    const it = selected();
    if (!it) return;
    const f = $('selForm').elements;
    for (const k of ['w', 'd', 'h']) {
      const v = Number(f[k].value);
      if (v >= 1) it[k] = num(v, 1, k === 'h' ? 600 : 1000);
    }
    if (f.elev.value !== '') {
      const e = num(f.elev.value, 0, 600);
      if (e > 0) it.elev = e; else delete it.elev;
    }
    // Opening: empty = as the catalog says; doors only for hinged fronts.
    const kind = f.openKind.value;
    if (!kind) delete it.open;
    else {
      it.open = { kind };
      if (kind === 'swing' && Number(f.doors.value) >= 1) it.open.doors = num(f.doors.value, 1, 8);
      if (kind === 'slide' && Number(f.doors.value) >= 1) it.open.doors = num(f.doors.value, 2, 3);
    }
    emit();
  });
  initMatPanel();
  initStylePanel();
  initPricePanel();
  $('rotateBtn').addEventListener('click', () => { const it = selected(); if (it) rotateItem(it); });
  $('deleteBtn').addEventListener('click', () => removeItems(selectedItems().map(i => i.id)));
  $('dupBtn').addEventListener('click', () => duplicate());
  $('alignBox').addEventListener('click', e => {
    const b = e.target.closest('[data-align]');
    if (!b) return;
    const items = selectedItems();
    alignDeltas(items.map(i => rectOf(i)), b.dataset.align).forEach((d, i) => { items[i].x += d.dx; items[i].y += d.dy; });
    emit();
  });
  $('autoBtn').addEventListener('click', () => { const it = selected(); if (it) onAutoPlace(it, false); });

  // Settings.
  const setForm = $('setForm');
  setForm.addEventListener('input', () => {
    const f = setForm.elements;
    state.settings.snap = num(f.snap.value, 1, 10);
    state.settings.grid = num(f.grid.value, 10, 50);
    if (f.gap.value !== '') state.settings.gap = num(f.gap.value, 0, 20);
    if (Number(f.minPassage.value) >= 45) state.settings.minPassage = num(f.minPassage.value, 45, 90);
    if (f.plinth.value !== '') state.room.plinth = num(f.plinth.value, 0, 10);
    emit();
  });
  $('clearBtn').addEventListener('click', () => {
    if (state.items.length && confirm(t('set.clearConfirm'))) {
      state.items = [];
      state.selectedId = null;
      emit();
    }
  });

  initOpenings();
  initObstacles();

  $('problemList').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]');
    if (li) select(Number(li.dataset.id));
    const ob = e.target.closest('li[data-ob]');
    if (ob) selectObstacle(Number(ob.dataset.ob));
  });
  $('itemList').addEventListener('click', e => {
    const li = e.target.closest('li');
    if (li) select(Number(li.dataset.id));
  });
}

// Duplicate the selection (one item or a group).
export function duplicate() {
  const items = selectedItems();
  if (!items.length) return;
  const { item, placed } = duplicateItems(items);
  toast(placed ? t('dup.done', { name: itemName(item) }) : t('dup.shifted'), !placed);
}

export function fillCatalog() {
  const sel = $('typeSelect');
  const cur = sel.value;
  sel.innerHTML = state.catalog
    .map(c => `<option value="${c.type}">${c.name[getLang()] || c.name.ru}</option>`).join('');
  if (cur) sel.value = cur;
  else fillDefaults();
}

function fillDefaults() {
  const c = state.catalog.find(c => c.type === $('typeSelect').value);
  if (!c) return;
  const f = $('addForm').elements;
  f.w.value = c.w; f.d.value = c.d; f.h.value = c.h; f.elev.value = c.elev || 0;
}

// Sync all form values from state (after load from storage).
export function syncForms() {
  const r = $('roomForm').elements;
  r.L.value = state.room.L; r.W.value = state.room.W; r.H.value = state.room.H;
  const s = $('setForm').elements;
  s.snap.value = state.settings.snap; s.grid.value = state.settings.grid;
  s.gap.value = state.settings.gap; s.plinth.value = state.room.plinth;
  s.minPassage.value = state.settings.minPassage || 60;
  syncStylePanel();
}

export function setErrors(map) { errors = map; }
export function setWarnings(map) { warnings = map; }
let obWarnings = new Map();
export function setObWarnings(map) { obWarnings = map; }
let passages = [];
export function setPassages(list) { passages = list; }

// ---- windows / doors panel + lock ----
function initOpenings() {
  const toggleLock = () => setOpeningsLocked(!state.openingsLocked);
  $('lockBtn').addEventListener('click', toggleLock);
  $('lockBtn2').addEventListener('click', toggleLock);
  $('zonesBtn').addEventListener('click', cycleZones);
  $('passBtn').addEventListener('click', togglePassages);
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyP' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, dialog')) return;
    if (!$('view3d').hidden) return;
    togglePassages();
    e.preventDefault();
  });
  // Passages group: collapsed state is a per-browser convenience.
  const group = $('passGroup');
  try { group.open = localStorage.getItem('fsp3d.passOpen') !== '0'; } catch { group.open = true; }
  group.addEventListener('toggle', () => { try { localStorage.setItem('fsp3d.passOpen', group.open ? '1' : '0'); } catch { /* ignore */ } });
  $('passList').addEventListener('click', e => {
    const li = e.target.closest('li[data-i]');
    const p = li && passages[Number(li.dataset.i)];
    if (!p) return;
    drawFlash.passage = p;
    drawFlash.until = performance.now() + 3000;
    requestDraw();
  });
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyZ' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, dialog')) return;
    if (!$('view3d').hidden) return;
    cycleZones();
    e.preventDefault();
  });
  $('addWindowBtn').addEventListener('click', () => addOpening('window'));
  $('addDoorBtn').addEventListener('click', () => addOpening('door'));
  $('openList').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]');
    if (li) selectOpening(Number(li.dataset.id));
  });
  const form = $('openForm');
  form.addEventListener('input', () => {
    const o = selectedOpening();
    if (!o) return;
    const f = form.elements;
    const patch = { wall: f.wall.value };
    for (const k of ['offset', 'width', 'height', 'sill']) {
      if (f[k].value !== '' && (k !== 'sill' || o.kind === 'window')) patch[k] = Math.round(Number(f[k].value) || 0);
    }
    updateOpening(o, patch);
  });
  $('flipBtn').addEventListener('click', () => {
    const o = selectedOpening();
    if (o) updateOpening(o, { hinge: o.hinge === 'end' ? 'start' : 'end' });
  });
  $('openDelBtn').addEventListener('click', () => { const o = selectedOpening(); if (o) removeOpening(o.id); });
}

// ---- structure: columns, ducts, ledges, radiators, niches ----
function initObstacles() {
  $('obAdd').addEventListener('click', e => {
    const b = e.target.closest('[data-ob]');
    if (b) addObstacle(b.dataset.ob);
  });
  const nf = $('nicheForm');
  const centre = () => {
    const f = nf.elements;
    f.offset.value = Math.max(0, Math.round((wallLen(f.wall.value, state.room) - Number(f.width.value || 0)) / 2));
  };
  $('nicheBtn').addEventListener('click', () => {
    nf.hidden = !nf.hidden;
    if (!nf.hidden) {
      const f = nf.elements;
      f.width.value = Math.min(150, wallLen(f.wall.value, state.room));
      f.depth.value = 60;
      centre();
    }
  });
  nf.elements.wall.addEventListener('change', centre);
  nf.addEventListener('submit', e => {
    e.preventDefault();
    const f = nf.elements;
    addNiche(f.wall.value, num(f.offset.value, 0, 3000), num(f.width.value, 1, 3000), num(f.depth.value, 1, 300));
    nf.hidden = true;
  });
  $('nicheCancel').addEventListener('click', () => { nf.hidden = true; });
  $('obList').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]');
    if (li) selectObstacle(Number(li.dataset.id));
  });
  const form = $('obForm');
  form.addEventListener('input', () => {
    const o = selectedOb();
    if (!o) return;
    const patch = {};
    for (const k of ['x', 'y', 'w', 'd', 'h', 'elev']) {
      if (form.elements[k].value !== '') patch[k] = Math.round(Number(form.elements[k].value) || 0);
    }
    updateObstacle(o, patch);
  });
  $('obDelBtn').addEventListener('click', () => { const o = selectedOb(); if (o) removeObstacle(o.id); });
}

// ↔ Passages: bands on the plan on / off. Warnings stay either way.
export function togglePassages() {
  state.settings.showPassages = state.settings.showPassages === false;
  emit();
  toast(t(state.settings.showPassages ? 'pass.on' : 'pass.off'));
}

function renderPassages() {
  const on = state.settings.showPassages !== false;
  const b = $('passBtn');
  b.innerHTML = `↔ ${escapeHtml(t('pass.short'))}${passages.length ? ` <span class="badge">${passages.length}</span>` : ''}`;
  b.title = `${t(on ? 'pass.on' : 'pass.off')} (P)`;
  b.classList.toggle('active', on);
  $('passGroup').hidden = passages.length === 0;
  $('passCount').textContent = passages.length;
  const min = state.settings.minPassage || 60;
  $('passList').innerHTML = passages.map((p, i) => `<li data-i="${i}">
      <b>${escapeHtml(refName(p.a))} ↔ ${escapeHtml(refName(p.b))}</b>
      <i>⚠ ${escapeHtml(t('warn.passage', { n: p.n, min }))}</i>
    </li>`).join('');
}

function refName(ref) {
  if (ref.itemId) { const it = getItem(ref.itemId); return it ? itemName(it) : '?'; }
  if (ref.kind) return t('ob.' + ref.kind);
  return t('pass.wall', { wall: t('wallShort.' + ref.wall) });
}

// ⌓ Zones: selected → all → hidden → selected. A view setting: saved, not undone.
const ZONE_MODES = ['selected', 'all', 'none'];
export function cycleZones() {
  const cur = ZONE_MODES.indexOf(state.settings.showZones || 'selected');
  state.settings.showZones = ZONE_MODES[(cur + 1) % ZONE_MODES.length];
  emit();
  toast(t('zones.mode', { mode: t('zones.' + state.settings.showZones) }));
}

function renderZonesBtn() {
  const mode = state.settings.showZones || 'selected';
  const b = $('zonesBtn');
  b.textContent = `⌓ ${t('zones.short.' + mode)}`;
  b.title = `${t('zones.title')}: ${t('zones.' + mode)} (Z)`;
  b.classList.toggle('active', mode !== 'none');
}

function renderObstacles() {
  const locked = state.openingsLocked;
  for (const b of $('obAdd').querySelectorAll('button')) b.disabled = locked;
  if (locked) $('nicheForm').hidden = true;
  $('obList').innerHTML = (state.obstacles || []).map(o => `<li data-id="${o.id}" class="${o.id === state.selectedObstacle ? 'selected' : ''}">
      <i class="dot ob-dot"></i>
      <span class="name">${escapeHtml(t('ob.' + o.kind))}</span>
      <span class="dims">${o.w}×${o.d}×${o.h}${o.elev ? ' ↑' + o.elev : ''}</span>
    </li>`).join('');
  const o = selectedOb();
  const form = $('obForm');
  form.hidden = !o;
  if (!o) return;
  form.classList.toggle('locked', locked);
  for (const el of form.elements) el.disabled = locked;
  for (const k of ['x', 'y', 'w', 'd', 'h', 'elev']) {
    if (document.activeElement !== form.elements[k]) form.elements[k].value = o[k];
  }
}

function renderOpenings() {
  const locked = state.openingsLocked;
  for (const [id, key] of [['lockBtn', locked ? 'op.unlock' : 'op.lock'], ['lockBtn2', locked ? 'op.unlockShort' : 'op.lockShort']]) {
    $(id).textContent = t(key);
    $(id).classList.toggle('on', locked);
  }
  $('addWindowBtn').disabled = $('addDoorBtn').disabled = locked;
  $('notesLock').hidden = !locked;
  $('openList').innerHTML = (state.openings || []).map(o => `<li data-id="${o.id}" class="${o.id === state.selectedOpening ? 'selected' : ''}">
      <i class="dot" style="background:${o.kind === 'window' ? '#74c0fc' : '#8d6e63'}"></i>
      <span class="name">${escapeHtml(t('op.' + o.kind))}</span>
      <span class="dims">${escapeHtml(t('wallName.' + o.wall))} · ${o.width}</span>
    </li>`).join('');

  const o = selectedOpening();
  const form = $('openForm');
  form.hidden = !o;
  if (!o) return;
  form.classList.toggle('locked', locked);
  for (const el of form.elements) el.disabled = locked;
  form.querySelector('.win-only').hidden = o.kind !== 'window';
  $('flipBtn').hidden = o.kind !== 'door';
  const f = form.elements;
  for (const k of ['wall', 'offset', 'width', 'height', 'sill']) {
    if (document.activeElement !== f[k] && o[k] !== undefined) f[k].value = o[k];
  }
}

export function describe(err) {
  const p = { ...err.params };
  if (p.wall) p.wall = t('wall.' + p.wall);
  if (p.wallAlong) p.wall = t('wallAlong.' + p.wallAlong);
  if (p.otherId) { const o = getItem(p.otherId); p.name = o ? itemName(o) : '?'; }
  if (p.kind) p.name = t('ob.' + p.kind);
  p.gap = state.settings.gap;
  return t(err.key, p);
}

export function refresh() {
  renderList();
  renderSelPanel();
  renderOpenings();
  renderObstacles();
  renderZonesBtn();
  renderPassages();
  renderNotes();
}

function renderList() {
  const list = $('itemList');
  $('itemCount').textContent = state.items.length;
  $('emptyHint').hidden = state.items.length > 0;
  list.innerHTML = state.items.map(it => {
    const bad = (errors.get(it.id) || []).length > 0;
    const cls = [it.id === state.selectedId || state.selectedIds.has(it.id) ? 'selected' : '', bad ? 'bad' : ''].join(' ');
    return `<li data-id="${it.id}" class="${cls}">
      <i class="dot" style="background:${it.color}"></i>
      <span class="name">${escapeHtml(itemName(it))}</span>
      <span class="dims">${it.w}×${it.d}×${it.h}${it.elev ? ' ↑' + it.elev : ''} · ${it.rot}°</span>
      ${bad ? '<span class="flag">!</span>' : ''}
    </li>`;
  }).join('');
  renderPriceTotal();
}

function renderSelPanel() {
  const it = selected();
  const many = selectedItems().length;
  $('selPanel').hidden = !it;
  if (!it) return;
  const multi = many > 1;
  $('alignBox').hidden = !multi;
  $('selForm').hidden = multi;
  $('matBox').hidden = multi;
  $('cfgBox').hidden = $('itemPrice').hidden = multi;
  if (!multi) { renderMatPanel(it); renderPricePanel(it); }
  $('rotateBtn').hidden = $('autoBtn').hidden = multi;
  $('selName').textContent = multi ? t('sel.many', { n: many }) : `${itemName(it)} · ${it.rot}° · x=${it.x}, y=${it.y}`;
  const f = $('selForm').elements;
  for (const k of ['w', 'd', 'h']) {
    if (document.activeElement !== f[k]) f[k].value = it[k];
  }
  if (document.activeElement !== f.elev) f.elev.value = it.elev || 0;
  const spec = openSpec(it, state.catalog);
  if (document.activeElement !== f.openKind) f.openKind.value = it.open?.kind || '';
  const slide = spec.kind === 'slide' && it.open?.kind === 'slide';
  f.doors.closest('label').hidden = spec.kind !== 'swing' && !slide;
  f.doors.min = slide ? 2 : 1;
  f.doors.max = slide ? 3 : 8;
  if (document.activeElement !== f.doors) f.doors.value = slide ? slideDoors(it) : spec.doors || 1;
  f.openKind.title = t('open.' + spec.kind) + (spec.depth ? ` · ${spec.depth} ${t('unit.cm')}` : '');
}

// Notes column right of the canvas: the selected item's status + every problem item.
function renderNotes() {
  renderBanner();
  const errs = id => errors.get(id) || [], warns = id => (warnings.get(id) || []).filter(w => w.key !== 'warn.passage');
  const bad = state.items.filter(i => errs(i.id).length || warns(i.id).length);
  const obs = (state.obstacles || []).filter(o => obWarnings.has(o.id));
  $('notesEmpty').hidden = !!selected() || bad.length > 0 || obs.length > 0;
  $('notesAll').hidden = state.items.length === 0 && obs.length === 0;
  $('problemList').innerHTML = bad.length || obs.length
    ? bad.map(it => `<li data-id="${it.id}" class="${it.id === state.selectedId ? 'selected' : ''}">
        <b>${escapeHtml(itemName(it))}</b>
        ${errs(it.id).map(e => `<span>${escapeHtml(describe(e))}</span>`).join('')}
        ${warns(it.id).map(e => `<i>⚠ ${escapeHtml(describe(e))}</i>`).join('')}
      </li>`).join('') + obs.map(o => `<li data-ob="${o.id}" class="${o.id === state.selectedObstacle ? 'selected' : ''}">
        <b>${escapeHtml(t('ob.' + o.kind))}</b>
        ${obWarnings.get(o.id).map(e => `<i>⚠ ${escapeHtml(describe(e))}</i>`).join('')}
      </li>`).join('')
    : `<li class="ok">✓ ${escapeHtml(t('notes.allOk'))}</li>`;
}

// Banner: status of the selected item; with nothing selected — the first problem item.
function renderBanner() {
  const banner = $('banner');
  const sel = selected();
  const target = sel ? ((errors.get(sel.id) || []).length ? sel : null)
    : state.items.find(i => (errors.get(i.id) || []).length) || null;

  if (target) {
    const list = errors.get(target.id).map(e => `<li>${escapeHtml(describe(e))}</li>`).join('');
    banner.className = 'banner';
    banner.innerHTML = `«${escapeHtml(itemName(target))}» — ${t('banner.problems')}<ul>${list}</ul>`;
    banner.hidden = false;
  } else if (sel && (warnings.get(sel.id) || []).length) {
    const list = warnings.get(sel.id).map(e => `<li>${escapeHtml(describe(e))}</li>`).join('');
    banner.className = 'banner warn';
    banner.innerHTML = `⚠ ${escapeHtml(t('banner.ok', { name: itemName(sel) }))}<ul>${list}</ul>`;
    banner.hidden = false;
  } else if (sel) {
    banner.className = 'banner ok';
    banner.textContent = '✓ ' + t('banner.ok', { name: itemName(sel) });
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }
}

let toastTimer;
export function toast(text, isError = false) {
  const el = $('toast');
  el.textContent = text;
  el.className = 'toast' + (isError ? ' error' : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, isError ? 5000 : 3000);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

