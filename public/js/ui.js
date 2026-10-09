// Sidebar forms, item list, selection panel, notes column and toasts.
import { t, getLang } from './i18n.js';
import { state, emit, addItem, removeItem, rotateItem, select, selected, getItem, itemName } from './state.js';

const $ = id => document.getElementById(id);
const num = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

let errors = new Map();
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
      w: num(f.w.value, 10, 1000), d: num(f.d.value, 10, 1000), h: num(f.h.value, 10, 600)
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
      if (v >= 10) it[k] = num(v, 10, k === 'h' ? 600 : 1000);
    }
    emit();
  });
  $('rotateBtn').addEventListener('click', () => { const it = selected(); if (it) rotateItem(it); });
  $('deleteBtn').addEventListener('click', () => { const it = selected(); if (it) removeItem(it.id); });
  $('autoBtn').addEventListener('click', () => { const it = selected(); if (it) onAutoPlace(it, false); });

  // Settings.
  const setForm = $('setForm');
  setForm.addEventListener('input', () => {
    const f = setForm.elements;
    state.settings.snap = num(f.snap.value, 1, 10);
    state.settings.grid = num(f.grid.value, 10, 50);
    if (f.gap.value !== '') state.settings.gap = num(f.gap.value, 0, 20);
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

  $('problemList').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]');
    if (li) select(Number(li.dataset.id));
  });
  $('itemList').addEventListener('click', e => {
    const li = e.target.closest('li');
    if (li) select(Number(li.dataset.id));
  });
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
  f.w.value = c.w; f.d.value = c.d; f.h.value = c.h;
}

// Sync all form values from state (after load from storage).
export function syncForms() {
  const r = $('roomForm').elements;
  r.L.value = state.room.L; r.W.value = state.room.W; r.H.value = state.room.H;
  const s = $('setForm').elements;
  s.snap.value = state.settings.snap; s.grid.value = state.settings.grid;
  s.gap.value = state.settings.gap; s.plinth.value = state.room.plinth;
}

export function setErrors(map) { errors = map; }

export function describe(err) {
  const p = { ...err.params };
  if (p.wall) p.wall = t('wall.' + p.wall);
  if (p.wallAlong) p.wall = t('wallAlong.' + p.wallAlong);
  if (p.otherId) { const o = getItem(p.otherId); p.name = o ? itemName(o) : '?'; }
  p.gap = state.settings.gap;
  return t(err.key, p);
}

export function refresh() {
  renderList();
  renderSelPanel();
  renderNotes();
}

function renderList() {
  const list = $('itemList');
  $('itemCount').textContent = state.items.length;
  $('emptyHint').hidden = state.items.length > 0;
  list.innerHTML = state.items.map(it => {
    const bad = (errors.get(it.id) || []).length > 0;
    const cls = [it.id === state.selectedId ? 'selected' : '', bad ? 'bad' : ''].join(' ');
    return `<li data-id="${it.id}" class="${cls}">
      <i class="dot" style="background:${it.color}"></i>
      <span class="name">${escapeHtml(itemName(it))}</span>
      <span class="dims">${it.w}×${it.d}×${it.h} · ${it.rot}°</span>
      ${bad ? '<span class="flag">!</span>' : ''}
    </li>`;
  }).join('');
}

function renderSelPanel() {
  const it = selected();
  $('selPanel').hidden = !it;
  if (!it) return;
  $('selName').textContent = `${itemName(it)} · ${it.rot}° · x=${it.x}, y=${it.y}`;
  const f = $('selForm').elements;
  for (const k of ['w', 'd', 'h']) {
    if (document.activeElement !== f[k]) f[k].value = it[k];
  }
}

// Notes column right of the canvas: the selected item's status + every problem item.
function renderNotes() {
  renderBanner();
  const bad = state.items.filter(i => (errors.get(i.id) || []).length);
  $('notesEmpty').hidden = !!selected() || bad.length > 0;
  $('notesAll').hidden = state.items.length === 0;
  $('problemList').innerHTML = bad.length
    ? bad.map(it => `<li data-id="${it.id}" class="${it.id === state.selectedId ? 'selected' : ''}">
        <b>${escapeHtml(itemName(it))}</b>
        ${errors.get(it.id).map(e => `<span>${escapeHtml(describe(e))}</span>`).join('')}
      </li>`).join('')
    : `<li class="ok">✓ ${escapeHtml(t('notes.allOk'))}</li>`;
}

// Banner: reasons for the selected item, else the first problem item.
function renderBanner() {
  const banner = $('banner');
  const sel = selected();
  let target = sel && (errors.get(sel.id) || []).length ? sel : null;
  if (!target) target = state.items.find(i => (errors.get(i.id) || []).length) || null;

  if (target) {
    const list = errors.get(target.id).map(e => `<li>${escapeHtml(describe(e))}</li>`).join('');
    banner.className = 'banner';
    banner.innerHTML = `«${escapeHtml(itemName(target))}» — ${t('banner.problems')}<ul>${list}</ul>`;
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

