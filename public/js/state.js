// Single app state + simple change notification.
import { footprint } from './geometry.js';
import { getLang } from './i18n.js';
import { newOpening, clampOpening } from './openings.js';

export const state = {
  room: { L: 400, W: 300, H: 270, plinth: 2 },
  settings: { snap: 5, gap: 3, grid: 10 },
  items: [],          // { id, type, w, d, h, x, y, rot, color }
  seq: 1,
  selectedId: null,
  openings: null,     // windows / doors, see openings.js (defaults are set after load)
  openingsLocked: false,
  opSeq: 3,
  selectedOpening: null,
  catalog: [],
  found: null         // { id, until } — green highlight after auto-place
};

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); }
export function emit() { listeners.forEach(fn => fn(state)); }

export const getItem = id => state.items.find(i => i.id === id) || null;
export const selected = () => getItem(state.selectedId);

export function itemName(item) {
  const c = state.catalog.find(c => c.type === item.type);
  return c ? (c.name[getLang()] || c.name.ru) : item.type;
}

// Snap a coordinate to the grid anchored at the plinth line.
export function snapValue(v) {
  const { snap } = state.settings;
  const p = state.room.plinth;
  if (snap <= 1) return Math.round(v);
  return p + Math.round((v - p) / snap) * snap;
}

export function addItem({ type, w, d, h }) {
  const c = state.catalog.find(c => c.type === type);
  const p = state.room.plinth;
  const item = {
    id: state.seq++, type, w, d, h,
    x: p, y: p, rot: 0,
    color: c ? c.color : '#90a4ae'
  };
  state.items.push(item);
  state.selectedId = item.id;
  emit();
  return item;
}

export function removeItem(id) {
  state.items = state.items.filter(i => i.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  emit();
}

// Rotate 90° clockwise around the footprint centre.
export function rotateItem(item) {
  const before = footprint(item);
  const cx = item.x + before.w / 2;
  const cy = item.y + before.h / 2;
  item.rot = (item.rot + 90) % 360;
  const after = footprint(item);
  item.x = snapValue(cx - after.w / 2);
  item.y = snapValue(cy - after.h / 2);
  emit();
}

export function select(id) {
  state.selectedId = id;
  if (id !== null) state.selectedOpening = null;
  emit();
}

// ---- windows / doors (furniture and opening selection are exclusive) ----
export const getOpening = id => (state.openings || []).find(o => o.id === id) || null;
export const selectedOpening = () => getOpening(state.selectedOpening);

export function selectOpening(id) {
  state.selectedOpening = id;
  if (id !== null) state.selectedId = null;
  emit();
}

export function addOpening(kind) {
  if (state.openingsLocked) return null;
  const o = newOpening(kind, state.opSeq++, state.room);
  state.openings.push(o);
  selectOpening(o.id);
  return o;
}

export function removeOpening(id) {
  if (state.openingsLocked) return;
  state.openings = state.openings.filter(o => o.id !== id);
  if (state.selectedOpening === id) state.selectedOpening = null;
  emit();
}

export function updateOpening(o, patch) {
  if (state.openingsLocked) return;
  Object.assign(o, patch);
  clampOpening(o, state.room);
  emit();
}

export function setOpeningsLocked(v) {
  state.openingsLocked = v;
  emit();
}
