// The open project and its rooms: tabs above the plan, the room dialog, switching rooms
// (each room keeps its own undo history while the page is open).
import { state, emit, applyDoc, docFromState } from './state.js';
import { history } from './history.js';
import {
  onSaveError, saveProject, flushSave, migrateV1, openLastProject, makeProject, makeRoom, activeRoom, normalizeDoc,
  makeVersion, versionGroup
} from './storage.js';
import { defaultOpenings } from './openings.js';
import { resetView } from './renderer.js';
import { resetRuler } from './interaction.js';
import { t, getLang, onLangChange } from './i18n.js';
import { toast, syncForms } from './ui.js';

export const PURPOSES = ['bedroom', 'kids', 'living', 'kitchen', 'kitchenLiving', 'study', 'hall', 'other'];

let project = null;
const histories = new Map();   // roomId → history.dump()
const $ = id => document.getElementById(id);

export const currentProject = () => project;
export const currentRoom = () => (project ? activeRoom(project) : null);

// The state is the active room: copy it back and save (debounced).
export function persist() {
  if (!project) return;
  Object.assign(activeRoom(project), docFromState());
  saveProject(project);
}

export function initProjects() {
  onSaveError(() => toast(t('storage.full'), true));
  project = openLastProject() || migrateV1(t('project.default'), t('room.default', { n: 1 }));
  if (!project) {
    state.openings = defaultOpenings(state.room);
    project = makeProject(t('project.default'), [makeRoom(t('room.default', { n: 1 }), docFromState())]);
  }
  applyRoom(activeRoom(project));
  window.addEventListener('pagehide', flushSave);
  initTabs();
  initRoomDialog();
  onLangChange(renderTabs);
  renderTabs();
}

function applyRoom(r) {
  state.selectedId = null;
  state.selectedIds = new Set();
  state.selectedOpening = null;
  state.found = null;
  applyDoc(r);
  state.openings ??= defaultOpenings(state.room);
}

export function switchRoom(id) {
  if (!project || id === project.activeRoomId || !project.rooms.some(r => r.id === id)) return;
  persist();
  histories.set(project.activeRoomId, history.dump());
  project.activeRoomId = id;
  enterRoom();
}

// Apply the active room and reset everything that belongs to the view of the previous one.
function enterRoom() {
  const r = activeRoom(project);
  applyRoom(r);
  const h = histories.get(r.id);
  if (h) history.load(h);
  else history.reset(null);
  resetView();
  resetRuler();
  syncForms();
  renderTabs();
  emit();
}

function addRoom({ name, purpose, L, W, H }) {
  const room = { L, W, H, plinth: state.room.plinth };
  const doc = normalizeDoc({ room, settings: { ...state.settings }, openings: defaultOpenings(room) });
  const r = makeRoom(name, doc, { purpose });
  project.rooms.push(r);
  switchRoom(r.id);
}

const LETTERS = { ru: 'АБВГДЕЖЗИКЛМН', uz: 'ABCDEFGHIJKLM', en: 'ABCDEFGHIJKLM' };
const letter = n => (LETTERS[getLang()] || LETTERS.en)[n - 1] || String(n);

function duplicateAsVersion(id) {
  persist();
  const copy = makeVersion(project, id, (name, n) => `${name} — ${t('room.variant', { v: letter(n) })}`);
  switchRoom(copy.id);
  toast(t('room.versionDone', { name: copy.name }));
}

function deleteRoom(id) {
  if (project.rooms.length < 2) return toast(t('room.lastOne'), true);
  const i = project.rooms.findIndex(r => r.id === id);
  if (!confirm(t('room.confirmDelete', { name: project.rooms[i].name }))) return;
  project.rooms.splice(i, 1);
  histories.delete(id);
  if (project.activeRoomId === id) {
    project.activeRoomId = project.rooms[Math.max(0, i - 1)].id;
    enterRoom();
  }
  persist();
  renderTabs();
}

// ---- tabs ----
function initTabs() {
  $('roomTabsList').addEventListener('click', e => {
    const more = e.target.closest('[data-more]');
    if (more) return openMenu(more.dataset.more, more);
    const tab = e.target.closest('[data-room]');
    if (tab) switchRoom(tab.dataset.room);
  });
  $('roomTabsList').addEventListener('dblclick', e => {
    const tab = e.target.closest('[data-room]');
    if (tab) openRoomDialog(tab.dataset.room);
  });
  $('addRoomBtn').addEventListener('click', () => openRoomDialog(null));
  $('roomMenu').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = $('roomMenu').dataset.room;
    closeMenu();
    if (b.dataset.act === 'edit') openRoomDialog(id);
    if (b.dataset.act === 'version') duplicateAsVersion(id);
    if (b.dataset.act === 'delete') deleteRoom(id);
  });
  document.addEventListener('pointerdown', e => {
    if (!$('roomMenu').hidden && !e.target.closest('#roomMenu, [data-more]')) closeMenu();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
}

export function renderTabs() {
  if (!project) return;
  $('projName').textContent = project.name;
  const list = $('roomTabsList');
  list.replaceChildren(...project.rooms.map(r => {
    const tab = document.createElement('div');
    tab.className = 'room-tab' + (r.id === project.activeRoomId ? ' active' : '');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', r.id === project.activeRoomId);
    tab.dataset.room = r.id;
    const area = (r.room.L * r.room.W / 10000).toFixed(1);
    tab.title = [r.purpose && t('purpose.' + r.purpose), `${r.room.L}×${r.room.W} ${t('unit.cm')} · ${area} ${t('unit.m2')}`]
      .filter(Boolean).join(' · ');
    const name = document.createElement('span');
    name.className = 'room-tab-name';
    name.textContent = r.name;
    const more = document.createElement('button');
    more.className = 'room-tab-more';
    more.type = 'button';
    more.dataset.more = r.id;
    more.title = t('room.menu');
    more.textContent = '⋯';
    tab.append(name);
    if (r.variant && versionGroup(project, r).length > 1) {
      const v = document.createElement('small');
      v.className = 'room-tab-ver';
      v.textContent = t('room.variantShort', { v: letter(r.variant) });
      tab.append(v);
    }
    tab.append(more);
    return tab;
  }));
  list.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function openMenu(id, anchor) {
  const m = $('roomMenu');
  if (!m.hidden && m.dataset.room === id) return closeMenu();
  m.dataset.room = id;
  m.hidden = false;
  const r = anchor.getBoundingClientRect();
  m.style.left = Math.min(r.left, window.innerWidth - m.offsetWidth - 8) + 'px';
  m.style.top = r.bottom + 4 + 'px';
}

function closeMenu() { $('roomMenu').hidden = true; }

// ---- room dialog: new room (name, purpose, size) or edit (name, purpose) ----
let editing = null;   // room id or null for a new room

function initRoomDialog() {
  const sel = $('roomDlgForm').elements.purpose;
  const fill = () => {
    const v = sel.value;
    sel.replaceChildren(...['', ...PURPOSES].map(p => new Option(p ? t('purpose.' + p) : '—', p)));
    sel.value = v;
  };
  fill();
  onLangChange(fill);
  $('roomDlgCancel').addEventListener('click', () => $('roomDlg').close());
  $('roomDlgForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target.elements;
    const name = f.name.value.trim() || t('room.default', { n: project.rooms.length + 1 });
    $('roomDlg').close();
    if (editing) {
      const r = project.rooms.find(x => x.id === editing);
      Object.assign(r, { name, purpose: f.purpose.value });
      persist();
      renderTabs();
    } else {
      const num = (inp, lo, hi) => Math.min(hi, Math.max(lo, Math.round(+inp.value) || lo));
      addRoom({ name, purpose: f.purpose.value, L: num(f.L, 100, 3000), W: num(f.W, 100, 3000), H: num(f.H, 200, 600) });
    }
  });
}

function openRoomDialog(id) {
  editing = id;
  const f = $('roomDlgForm').elements;
  const r = id ? project.rooms.find(x => x.id === id) : null;
  $('roomDlgTitle').textContent = t(r ? 'room.edit' : 'room.new');
  $('roomDlgSize').hidden = !!r;
  f.name.value = r ? r.name : t('room.default', { n: project.rooms.length + 1 });
  f.purpose.value = r ? r.purpose : '';
  if (!r) { f.L.value = state.room.L; f.W.value = state.room.W; f.H.value = state.room.H; }
  $('roomDlg').showModal();
  f.name.select();
}
