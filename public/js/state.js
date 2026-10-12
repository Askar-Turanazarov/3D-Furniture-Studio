// Single app state + simple change notification.
// The state holds the whole apartment (rooms[], lighting, settings) and is at the same time the live view of the
// active room: state.room / items / openings / obstacles / style are the fields of rooms[activeRoomId], so all
// per-room logic (validate, autoplace, zones, renderer, 3D) works on `state` as before. syncActive() writes them back.
import { footprint, rectOf, insideRoom, blocked } from './geometry.js';
import { findSpot } from './autoplace.js';
import { getLang } from './i18n.js';
import { newOpening, clampOpening, defaultOpenings } from './openings.js';
import { newObstacle, nicheLedges, clampObstacle } from './obstacles.js';
import { styleOf } from './style.js';
import { DEFAULT_LIGHTING } from './lighting.js';
import { roomView as aptRoomView, moveItemBetween, posOf, doorZones } from './apartment.js';

export const state = {
  rooms: [],          // the apartment: room docs with pos (see storage.js); the active one is mirrored below
  activeRoomId: null,
  room: { L: 400, W: 300, H: 270, plinth: 2 },
  settings: { snap: 5, gap: 3, grid: 10, showZones: 'selected', minPassage: 60, showPassages: true },   // showZones: selected | all | none
  items: [],          // { id, type, w, d, h, x, y, rot, color }
  seq: 1,
  selectedId: null,   // primary selected item
  selectedIds: new Set(),   // more selected items (multi-select)
  openings: null,     // windows / doors, see openings.js (defaults are set after load)
  openingsLocked: false,
  opSeq: 3,
  selectedOpening: null,
  obstacles: [],      // columns, ducts, ledges, radiators — see obstacles.js
  obSeq: 1,
  selectedObstacle: null,
  lighting: { scene: 'day', ceiling: 'chandelier' },   // 3D light: see 3d/lights3d.js
  style: styleOf(),   // walls, floor, furniture style: see style.js
  catalog: [],        // furniture types (catalog.json → items)
  materials: [],      // catalog.json → materials (phase 6)
  pricing: {},        // catalog.json → pricing (phase 7)
  found: null         // { id, until } — green highlight after auto-place
};


const listeners = new Set();
export function onChange(fn) { listeners.add(fn); }
export function emit() { listeners.forEach(fn => fn(state)); }

// Fields of the active room that live directly on the state.
const ROOM_KEYS = ['room', 'items', 'seq', 'openings', 'openingsLocked', 'opSeq', 'obstacles', 'obSeq', 'style'];

export const activeRoomDoc = () => state.rooms.find(r => r.id === state.activeRoomId) || null;

// Write the live fields of the active room back into its doc.
export function syncActive() {
  const r = activeRoomDoc();
  if (r) for (const k of ROOM_KEYS) r[k] = state[k];
  return r;
}

function loadActive() {
  if (!activeRoomDoc()) state.activeRoomId = state.rooms[0]?.id ?? null;
  const r = activeRoomDoc();
  if (!r) return;
  for (const k of ROOM_KEYS) state[k] = r[k];
  state.openings ??= r.openings = defaultOpenings(state.room);
  state.obstacles ??= r.obstacles = [];
  state.style = r.style = styleOf(r.style);
}

// The apartment document: everything that is saved and undone (not selection, highlights or the active room).
export function docFromState() {
  syncActive();
  const { rooms, settings, lighting } = state;
  return structuredClone({ rooms, settings, lighting });
}

export function applyDoc(doc) {
  const d = structuredClone(doc);
  Object.assign(state, {
    rooms: d.rooms, settings: d.settings,
    lighting: { ...DEFAULT_LIGHTING, ...d.lighting }
  });
  loadActive();
  clearStaleSelection();
}

function clearStaleSelection() {
  if (!getObstacle(state.selectedObstacle)) state.selectedObstacle = null;
  if (!getItem(state.selectedId)) state.selectedId = null;
  state.selectedIds = new Set([...state.selectedIds].filter(id => getItem(id)));
  if (!getOpening(state.selectedOpening)) state.selectedOpening = null;
}

// Any room in the old single-room shape (the active one is the live state itself).
export const roomView = id => (id === state.activeRoomId ? state : aptRoomView(state, id));

// Make another room active: the selection and highlights belong to the previous one.
export function setActiveRoom(id) {
  if (id === state.activeRoomId || !state.rooms.some(r => r.id === id)) return false;
  syncActive();
  state.activeRoomId = id;
  Object.assign(state, { selectedId: null, selectedIds: new Set(), selectedOpening: null, selectedObstacle: null, found: null });
  loadActive();
  emit();
  return true;
}

// Re-parent an item of the active room into another room; it keeps its place on the apartment plan.
export function moveItemToRoom(item, toId) {
  const from = syncActive(), to = state.rooms.find(r => r.id === toId);
  if (!from || !to || to === from || !state.items.includes(item)) return null;
  const moved = moveItemBetween(from, to, item);
  state.items = from.items;
  if (state.selectedId === item.id) state.selectedId = null;
  state.selectedIds.delete(item.id);
  emit();
  return moved;
}

// Active room position on the apartment plan.
export const activePos = () => posOf(activeRoomDoc()?.pos);

export const getItem = id => state.items.find(i => i.id === id) || null;
export const selected = () => getItem(state.selectedId);

// ---- multi-select: the primary item first, then the others ----
export const isSelected = id => id === state.selectedId || state.selectedIds.has(id);
export function selectedItems() {
  const ids = state.selectedId !== null ? [state.selectedId] : [];
  for (const id of state.selectedIds) if (id !== state.selectedId) ids.push(id);
  return ids.map(getItem).filter(Boolean);
}

export function toggleSelect(id) {
  if (id === state.selectedId) {
    const rest = [...state.selectedIds];
    state.selectedId = rest.shift() ?? null;
    state.selectedIds = new Set(rest);
  } else if (state.selectedIds.has(id)) state.selectedIds.delete(id);
  else if (state.selectedId === null) state.selectedId = id;
  else state.selectedIds.add(id);
  state.selectedOpening = null;
  state.selectedObstacle = null;
  emit();
}

export function selectMany(ids) {
  state.selectedId = ids[0] ?? null;
  state.selectedIds = new Set(ids.slice(1));
  state.selectedOpening = null;
  state.selectedObstacle = null;
  emit();
}

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

export function addItem({ type, w, d, h, elev }) {
  const c = state.catalog.find(c => c.type === type);
  const p = state.room.plinth;
  const item = {
    id: state.seq++, type, w, d, h,
    x: p, y: p, rot: 0,
    color: c ? c.color : '#90a4ae'
  };
  const e = elev ?? c?.elev ?? 0;
  if (e > 0) item.elev = e;
  if (c?.layer) item.layer = c.layer;
  state.items.push(item);
  state.selectedId = item.id;
  emit();
  return item;
}

export function removeItem(id) { removeItems([id]); }

export function removeItems(ids) {
  state.items = state.items.filter(i => !ids.includes(i.id));
  if (ids.includes(state.selectedId)) state.selectedId = null;
  for (const id of ids) state.selectedIds.delete(id);
  emit();
}

export function moveItems(items, dx, dy) {
  for (const it of items) { it.x += dx; it.y += dy; }
  emit();
}

// Copy next to the original (right, below, left, above), else the first free spot,
// else shifted by 20 cm. → { item, placed }
export function duplicateItem(item) {
  const copy = { ...structuredClone(item), id: state.seq++ };
  const { room, settings } = state;
  const r = rectOf(item), g = settings.gap;
  const others = state.items.map(i => rectOf(i))
    .concat(doorZones(state));
  let placed = false;
  for (const [dx, dy] of [[r.w + g, 0], [0, r.h + g], [-(r.w + g), 0], [0, -(r.h + g)]]) {
    const c = rectOf(copy, item.x + dx, item.y + dy);
    if (insideRoom(c, room) && !blocked(c, others, g)) {
      Object.assign(copy, { x: c.x, y: c.y });
      placed = true;
      break;
    }
  }
  if (!placed) {
    const res = findSpot(copy, { ...state, items: [...state.items, copy] });
    if (res.ok) Object.assign(copy, { x: res.x, y: res.y, rot: res.rot });
    else Object.assign(copy, { x: item.x + 20, y: item.y + 20 });
    placed = res.ok;
  }
  state.items.push(copy);
  state.selectedId = copy.id;
  state.selectedIds = new Set();
  emit();
  return { item: copy, placed };
}

// Several items: the whole group is copied next to itself keeping the layout, else shifted by 20 cm.
export function duplicateItems(items) {
  if (items.length === 1) return duplicateItem(items[0]);
  const { room, settings } = state;
  const g = settings.gap;
  const rs = items.map(i => rectOf(i));
  const x0 = Math.min(...rs.map(r => r.x)), y0 = Math.min(...rs.map(r => r.y));
  const bw = Math.max(...rs.map(r => r.x + r.w)) - x0, bh = Math.max(...rs.map(r => r.y + r.h)) - y0;
  const others = state.items.map(i => rectOf(i))
    .concat(doorZones(state));
  let shift = null;
  for (const [dx, dy] of [[bw + g, 0], [0, bh + g], [-(bw + g), 0], [0, -(bh + g)]]) {
    const moved = rs.map(r => ({ ...r, x: r.x + dx, y: r.y + dy }));
    if (moved.every(r => insideRoom(r, room) && !blocked(r, others, g))) { shift = [dx, dy]; break; }
  }
  const [dx, dy] = shift || [20, 20];
  const copies = items.map(it => ({ ...structuredClone(it), id: state.seq++, x: it.x + dx, y: it.y + dy }));
  state.items.push(...copies);
  selectMany(copies.map(c => c.id));
  return { item: copies[0], items: copies, placed: !!shift };
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
  state.selectedIds = new Set();
  if (id !== null) { state.selectedOpening = null; state.selectedObstacle = null; }
  emit();
}

// ---- windows / doors (furniture and opening selection are exclusive) ----
export const getOpening = id => (state.openings || []).find(o => o.id === id) || null;
export const selectedOpening = () => getOpening(state.selectedOpening);

export function selectOpening(id) {
  state.selectedOpening = id;
  if (id !== null) { state.selectedId = null; state.selectedIds = new Set(); state.selectedObstacle = null; }
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

// ---- obstacles (structure): locked together with windows and doors ----
export const getObstacle = id => (state.obstacles || []).find(o => o.id === id) || null;
export const selectedOb = () => getObstacle(state.selectedObstacle);

export function selectObstacle(id) {
  state.selectedObstacle = id;
  if (id !== null) { state.selectedId = null; state.selectedIds = new Set(); state.selectedOpening = null; }
  emit();
}

export function addObstacle(kind) {
  if (state.openingsLocked) return null;
  const o = newObstacle(kind, state.obSeq++, state.room, state.openings || []);
  state.obstacles.push(o);
  selectObstacle(o.id);
  return o;
}

export function addNiche(wall, offset, width, depth) {
  if (state.openingsLocked) return [];
  const ledges = nicheLedges(wall, offset, width, depth, state.room, () => state.obSeq++);
  state.obstacles.push(...ledges);
  selectObstacle(ledges[0]?.id ?? null);
  return ledges;
}

export function removeObstacle(id) {
  if (state.openingsLocked) return;
  state.obstacles = state.obstacles.filter(o => o.id !== id);
  if (state.selectedObstacle === id) state.selectedObstacle = null;
  emit();
}

export function updateObstacle(o, patch) {
  if (state.openingsLocked) return;
  Object.assign(o, patch);
  clampObstacle(o, state.room);
  emit();
}

export function setOpeningsLocked(v) {
  state.openingsLocked = v;
  emit();
}
