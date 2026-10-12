// The open project = one apartment: its header (name, area, active room, variants), the room dialog,
// switching the active room, apartment variants (copies of the whole apartment). One undo history per apartment.
import { state, emit, applyDoc, docFromState, setActiveRoom, syncActive } from './state.js';
import { history } from './history.js';
import {
  onSaveError, saveProject, flushSave, migrateV1, openLastProject, makeProject, makeRoom,
  saveProjectNow, setLastProject, makeVariant, variantsOf, loadProject, importProject
} from './storage.js';
import { nextRoomPos, apartmentArea, roomArea } from './apartment.js';
import { defaultOpenings } from './openings.js';
import { resetView, drawPlanTo, liveRooms } from './renderer.js';
import { resetRuler } from './interaction.js';
import { t, getLang, onLangChange } from './i18n.js';
import { loadTemplates, templateDoc, localName, sizeLabel, drawMiniPlan } from './templates.js';
import { aptRooms, furnishRooms } from './aptTemplates.js';
import { DEFAULT_SETTINGS } from './storage.js';
import { toast, syncForms } from './ui.js';
import { openCompare } from './compare.js';

export const PURPOSES = ['bedroom', 'kids', 'living', 'kitchen', 'kitchenLiving', 'study', 'hall', 'bathroom', 'other'];

let project = null;
let temporary = false;   // shown but never saved (the floor view embedded in the showcase)
const $ = id => document.getElementById(id);

export const currentProject = () => project;
// The active room doc (fresh: the live fields are written back first).
export const currentRoom = () => (project ? syncActive() : null);

// The state is the apartment: copy it into the project and save (debounced).
export function persist() {
  if (!project || temporary) return;
  Object.assign(project, docFromState(), { activeRoomId: state.activeRoomId });
  saveProject(project);
}

const emptyRoom = () => {
  const room = { L: 400, W: 300, H: 270, plinth: 2 };
  return makeRoom(t('room.default', { n: 1 }), { room, openings: defaultOpenings(room) });
};

export function initProjects() {
  onSaveError(() => toast(t('storage.full'), true));
  project = openLastProject() || migrateV1(t('project.default'), t('room.default', { n: 1 }))
    || makeProject(t('project.default'), [emptyRoom()]);
  applyProject(project);
  window.addEventListener('pagehide', flushSave);
  initHeader();
  initRoomDialog();
  onLangChange(renderHeader);
  renderHeader();
}

// Switch to another project (already saved or new); the current one is saved first.
export function openProject(p) {
  if (project && !temporary) { capturePreview(); persist(); flushSave(); }
  project = p;
  temporary = false;
  setLastProject(p.id);
  applyProject(p);
  history.reset(null);
  resetView();
  afterRoomChange();
}

// Show a project without saving it or making it the last one (nothing of it is written to localStorage).
export function openTemporary(p) {
  project = p;
  temporary = true;
  applyProject(p);
  history.reset(null);
  resetView();
  afterRoomChange();
}

// An apartment sent from the new-building showcase (building.html → localStorage) becomes a new project.
export function openHandoff() {
  let raw = null;
  try {
    raw = localStorage.getItem('fsp3d.handoff');
    localStorage.removeItem('fsp3d.handoff');
  } catch { return; }
  if (!raw) return;
  try {
    const p = importProject(JSON.parse(raw));
    if (saveProjectNow(p)) {
      openProject(p);
      toast(t('bld.imported', { name: p.name }));
    }
  } catch {
    toast(t('proj.badFile'), true);
  }
}

export function newProject() {
  const p = makeProject(t('project.new'), [emptyRoom()]);
  if (saveProjectNow(p)) openProject(p);
}

// Forget the open project without saving it (it is being deleted).
export function closeProject() { project = null; }

// Small JPEG of the whole apartment for the project card (drawn off-screen, so it works from the 3D view too).
export function capturePreview() {
  if (!project) return;
  const c = document.createElement('canvas');
  const rs = liveRooms().map(r => ({ x: r.pos?.x || 0, y: r.pos?.y || 0, w: r.room.L, h: r.room.W }));
  const L = Math.max(...rs.map(r => r.x + r.w)) - Math.min(...rs.map(r => r.x));
  const W = Math.max(...rs.map(r => r.y + r.h)) - Math.min(...rs.map(r => r.y));
  const h = Math.max(60, Math.min(240, Math.round(240 * W / L)));
  drawPlanTo(c, 240, h, { drawing: true, pad: 8 });
  project.preview = c.toDataURL('image/jpeg', 0.7);
}

function applyProject(p) {
  Object.assign(state, { selectedId: null, selectedIds: new Set(), selectedOpening: null, selectedObstacle: null, found: null });
  state.activeRoomId = p.activeRoomId;
  applyDoc(p);
}

export function switchRoom(id) {
  if (!project || !setActiveRoom(id)) return;
  afterRoomChange();
}

// Reset what belongs to the previous room (the apartment view itself stays where it is).
function afterRoomChange() {
  resetRuler();
  syncForms();
  renderHeader();
  emit();
}

// A new room goes next to the apartment (one undo step).
function insertRoom(r) {
  syncActive();
  r.pos = nextRoomPos(state.rooms);
  state.rooms.push(r);
  switchRoom(r.id);
}

function addRoom({ name, purpose, L, W, H }) {
  const room = { L, W, H, plinth: state.room.plinth };
  insertRoom(makeRoom(name, { room, openings: defaultOpenings(room) }, { purpose }));
}

function addRoomFromTemplate(tpl, name) {
  insertRoom(makeRoom(name, templateDoc(tpl, { plinth: state.room.plinth }), { purpose: tpl.purpose }));
}

// A whole apartment from an apartment template (apartments.json), empty or furnished by the kits.
export function newProjectFromApartment(a, name, furnished) {
  const rooms = aptRooms(a, getLang());
  if (furnished) furnishRooms({ rooms, settings: DEFAULT_SETTINGS, catalog: state.catalog }, { seed: Math.floor(Math.random() * 2 ** 31) });
  const main = rooms.find(r => ['living', 'kitchenLiving'].includes(r.purpose)) || rooms[0];
  const p = makeProject(name, rooms, { activeRoomId: main.id });
  if (!saveProjectNow(p)) return false;
  openProject(p);
  return true;
}

const LETTERS = { ru: 'АБВГДЕЖЗИКЛМН', uz: 'ABCDEFGHIJKLM', en: 'ABCDEFGHIJKLM' };
const letter = n => (LETTERS[getLang()] || LETTERS.en)[n - 1] || String(n);

// A variant = a copy of the whole apartment, opened right away; the original stays as it is.
export function createVariant() {
  persist();
  flushSave();
  const group = variantsOf(project.id);
  const root = group.find(e => !e.variantOf) || { name: project.name };
  const name = `${root.name} — ${t('room.variant', { v: letter(group.length + 1) })}`;
  const v = makeVariant(project, name);
  if (!saveProjectNow(v, { last: false })) return null;
  openProject(v);
  toast(t('room.versionDone', { name }));
  return v;
}

function deleteRoom(id) {
  if (state.rooms.length < 2) return toast(t('room.lastOne'), true);
  syncActive();
  const i = state.rooms.findIndex(r => r.id === id);
  if (!confirm(t('room.confirmDelete', { name: state.rooms[i].name }))) return;
  state.rooms.splice(i, 1);
  if (state.activeRoomId === id) switchRoom(state.rooms[Math.max(0, i - 1)].id);
  else { renderHeader(); emit(); }
}

// ---- apartment header: name, area, active room, variants, + room; the room panel's edit / delete ----
function initHeader() {
  $('roomPick').addEventListener('change', e => switchRoom(e.target.value));
  $('addRoomBtn').addEventListener('click', () => openRoomDialog(null));
  $('roomEditBtn').addEventListener('click', () => openRoomDialog(state.activeRoomId));
  $('roomDelBtn').addEventListener('click', () => deleteRoom(state.activeRoomId));
  $('variantsBtn').addEventListener('click', e => openVariants(e.currentTarget));
  $('variantsMenu').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    closeMenu();
    if (b.dataset.open && b.dataset.open !== project.id) {
      const p = loadProject(b.dataset.open);
      if (p) openProject(p);
    }
    if (b.dataset.act === 'create') createVariant();
    if (b.dataset.act === 'compare') openCompare();
  });
  document.addEventListener('pointerdown', e => {
    if (!$('variantsMenu').hidden && !e.target.closest('#variantsMenu, #variantsBtn')) closeMenu();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
}

export function renderHeader() {
  if (!project) return;
  $('projName').textContent = project.name;
  const rooms = liveRooms();
  $('aptArea').textContent = `${t('apt.rooms', { n: rooms.length })} · ${apartmentArea(rooms).toFixed(1)} ${t('unit.m2')}`;
  const pick = $('roomPick');
  pick.replaceChildren(...rooms.map(r => new Option(`${r.name} · ${roomArea(r).toFixed(1)} ${t('unit.m2')}`, r.id)));
  pick.value = state.activeRoomId;
  const r = rooms.find(x => x.id === state.activeRoomId);
  $('roomTitle').textContent = r ? [r.name, r.purpose && t('purpose.' + r.purpose)].filter(Boolean).join(' · ') : '';
  $('roomDelBtn').disabled = rooms.length < 2;
}

// Variants of this apartment (copies of the whole apartment): open one, create, compare.
function openVariants(anchor) {
  const m = $('variantsMenu');
  if (!m.hidden) return closeMenu();
  persist();
  flushSave();
  const group = variantsOf(project.id);
  $('variantsList').replaceChildren(...group.map(v => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.open = v.id;
    b.className = v.id === project.id ? 'current' : '';
    b.textContent = (v.id === project.id ? '✓ ' : '') + v.name;
    return b;
  }));
  m.querySelector('hr').hidden = !group.length;
  m.querySelector('[data-act="compare"]').hidden = group.length < 2;
  m.hidden = false;
  const r = anchor.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = r.bottom + 4 + 'px';
}

function closeMenu() { $('variantsMenu').hidden = true; }

// ---- room dialog: new room (empty with a size, or from a template) or edit (name, purpose) ----
let editing = null;   // room id or null for a new room
let mode = 'empty';   // 'empty' | 'template'
let tplData = null, tplSet = null, tplPicked = null;

function initRoomDialog() {
  const sel = $('roomDlgForm').elements.purpose;
  const fill = () => {
    const v = sel.value;
    sel.replaceChildren(...['', ...PURPOSES].map(p => new Option(p ? t('purpose.' + p) : '—', p)));
    sel.value = v;
  };
  fill();
  onLangChange(fill);
  onLangChange(() => { if ($('roomDlg').open && mode === 'template') renderTemplates(); });
  try { tplSet = localStorage.getItem('fsp3d.tplSet'); } catch { /* ignore */ }
  $('roomDlgMode').addEventListener('click', e => {
    const b = e.target.closest('[data-mode]');
    if (b) setMode(b.dataset.mode);
  });
  $('tplSets').addEventListener('click', e => {
    const b = e.target.closest('[data-set]');
    if (!b) return;
    tplSet = b.dataset.set;
    try { localStorage.setItem('fsp3d.tplSet', tplSet); } catch { /* ignore */ }
    renderTemplates();
  });
  $('tplGrid').addEventListener('click', e => {
    const card = e.target.closest('[data-tpl]');
    if (!card) return;
    tplPicked = tplData.templates.find(x => x.id === card.dataset.tpl);
    const f = $('roomDlgForm').elements;
    f.name.value = localName(tplPicked, getLang());
    f.purpose.value = tplPicked.purpose;
    $('tplGrid').querySelectorAll('[data-tpl]').forEach(c => c.classList.toggle('active', c === card));
  });
  $('tplGrid').addEventListener('dblclick', e => {
    if (e.target.closest('[data-tpl]')) $('roomDlgForm').requestSubmit();
  });
  $('roomDlgCancel').addEventListener('click', () => $('roomDlg').close());
  $('roomDlgForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target.elements;
    const name = f.name.value.trim() || t('room.default', { n: state.rooms.length + 1 });
    if (!editing && mode === 'template' && !tplPicked) return toast(t('tpl.pick'), true);
    $('roomDlg').close();
    if (!editing && mode === 'template') return addRoomFromTemplate(tplPicked, name);
    if (editing) {
      const r = state.rooms.find(x => x.id === editing);
      Object.assign(r, { name, purpose: f.purpose.value });
      renderHeader();
      emit();
    } else {
      const num = (inp, lo, hi) => Math.min(hi, Math.max(lo, Math.round(+inp.value) || lo));
      addRoom({ name, purpose: f.purpose.value, L: num(f.L, 100, 3000), W: num(f.W, 100, 3000), H: num(f.H, 200, 600) });
    }
  });
}

function openRoomDialog(id) {
  editing = id;
  const f = $('roomDlgForm').elements;
  const r = id ? state.rooms.find(x => x.id === id) : null;
  $('roomDlgTitle').textContent = t(r ? 'room.edit' : 'room.new');
  $('roomDlgMode').hidden = !!r;
  tplPicked = null;
  setMode(r ? 'empty' : mode);
  f.name.value = r ? r.name : t('room.default', { n: state.rooms.length + 1 });
  f.purpose.value = r ? r.purpose : '';
  if (!r) { f.L.value = state.room.L; f.W.value = state.room.W; f.H.value = state.room.H; }
  $('roomDlg').showModal();
  f.name.select();
}

function setMode(m) {
  mode = m;
  const tpl = m === 'template' && !editing;
  $('roomDlgMode').querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  $('roomDlgSize').hidden = !!editing || tpl;
  $('tplPane').hidden = !tpl;
  $('roomDlg').classList.toggle('wide', tpl);
  if (!tpl) return;
  if (tplData) return renderTemplates();
  $('tplGrid').textContent = '…';
  loadTemplates()
    .then(d => { tplData = d; if (mode === 'template') renderTemplates(); })
    .catch(() => { $('tplGrid').textContent = t('tpl.loadError'); });
}

function renderTemplates() {
  const lang = getLang();
  if (!tplData.sets.some(s => s.id === tplSet)) tplSet = tplData.sets[0].id;
  $('tplSets').replaceChildren(...tplData.sets.map(s => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.set = s.id;
    b.textContent = localName(s, lang);
    b.classList.toggle('active', s.id === tplSet);
    return b;
  }));
  const set = tplData.sets.find(s => s.id === tplSet);
  $('tplNote').textContent = set.note?.[lang] || '';
  const list = tplData.templates.filter(x => x.set === tplSet);
  if (tplPicked && tplPicked.set !== tplSet) tplPicked = null;
  $('tplGrid').replaceChildren(...list.map(tp => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'tpl-card' + (tp === tplPicked ? ' active' : '');
    card.dataset.tpl = tp.id;
    const c = document.createElement('canvas');
    const b = document.createElement('b');
    b.textContent = localName(tp, lang);
    const small = document.createElement('small');
    small.textContent = sizeLabel(tp.room, lang, t('unit.m2'), t('unit.m'));
    card.append(c, b, small);
    return card;
  }));
  // canvases need their layout size before drawing
  requestAnimationFrame(() => {
    $('tplGrid').querySelectorAll('[data-tpl]').forEach(card =>
      drawMiniPlan(card.querySelector('canvas'), list.find(x => x.id === card.dataset.tpl)));
  });
}
