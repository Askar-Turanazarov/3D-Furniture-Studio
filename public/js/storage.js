// Apartment projects in localStorage (debounced). No DOM here, so it is unit-tested with a fake storage.
//   fsp3d.projects.v2      — index: [{ id, name, createdAt, updatedAt, rooms, variantOf? }]
//   fsp3d.project.<id>     — the whole project (format v3, see below)
//   fsp3d.lastProject      — id of the project opened last
//   fsp3d.plan.v1          — old single-room plan; migrated once and kept as a spare copy
// project (v3) = { id, name, version: 3, createdAt, updatedAt, variantOf?, activeRoomId, lighting, settings, rooms: [roomDoc] }
// roomDoc = { id, name, purpose, pos: { x, y }, room, items, seq, openings, openingsLocked, opSeq, obstacles, obSeq, style }
// A variant is a separate project (a copy of the whole apartment) with variantOf = the original project id.
// Old v2 projects (rooms as tabs, each with its own lighting / settings, room versions) are migrated on load.
import { styleOf } from './style.js';
import { DEFAULT_LIGHTING } from './lighting.js';
import { posOf, layoutRow } from './apartment.js';

const V1 = 'fsp3d.plan.v1';
const INDEX = 'fsp3d.projects.v2';
const LAST = 'fsp3d.lastProject';
const projectKey = id => 'fsp3d.project.' + id;
export const VERSION = 3;

const DEFAULT_ROOM = { L: 400, W: 300, H: 270, plinth: 2 };
export const DEFAULT_SETTINGS = { snap: 5, gap: 3, grid: 10, showZones: 'selected', minPassage: 60, showPassages: true };

let timer = null, pending = null;
let onError = () => {};
export function onSaveError(fn) { onError = fn; }

const store = () => globalThis.localStorage;

function read(key) {
  try { return JSON.parse(store().getItem(key)); } catch { return null; }
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// Fill defaults and repair counters, so any saved or imported room can be applied to the state.
// (Old room docs carry settings / lighting; in v3 they belong to the apartment, see normalizeRoom.)
export function normalizeDoc(d = {}) {
  const items = Array.isArray(d.items) ? d.items : [];
  const openings = Array.isArray(d.openings) ? d.openings : null;
  const obstacles = Array.isArray(d.obstacles) ? d.obstacles : [];
  return {
    room: { ...DEFAULT_ROOM, ...d.room },
    settings: { ...DEFAULT_SETTINGS, ...d.settings },
    items,
    seq: Math.max(d.seq || 1, ...items.map(i => i.id + 1)),
    openings,
    openingsLocked: !!d.openingsLocked,
    opSeq: Math.max(d.opSeq || 1, ...(openings || []).map(o => o.id + 1)),
    obstacles,
    obSeq: Math.max(d.obSeq || 1, ...obstacles.map(o => o.id + 1)),
    lighting: { ...DEFAULT_LIGHTING, ...d.lighting },
    style: styleOf(d.style)
  };
}

// One room of an apartment (v3): no settings / lighting of its own; pos only when known.
export function normalizeRoom(r = {}) {
  const { settings, lighting, ...doc } = normalizeDoc(r);
  return {
    id: String(r.id || newId()), name: String(r.name || '').slice(0, 60), purpose: String(r.purpose || ''),
    ...(r.pos ? { pos: posOf(r.pos) } : {}),
    ...doc
  };
}

export function makeRoom(name, doc = {}, extra = {}) {
  return normalizeRoom({ ...doc, ...extra, id: newId(), name });
}

// A new apartment; rooms without a position are put in a row.
export function makeProject(name, rooms, extra = {}) {
  const now = Date.now();
  layoutRow(rooms);
  return {
    id: newId(), name, version: VERSION, createdAt: now, updatedAt: now, activeRoomId: rooms[0].id,
    lighting: { ...DEFAULT_LIGHTING }, settings: { ...DEFAULT_SETTINGS }, ...extra, rooms
  };
}

// Saved v3 project → complete valid one.
export function normalizeProject(p) {
  const rooms = layoutRow(p.rooms.map(normalizeRoom));
  return {
    id: p.id || newId(), name: String(p.name || ''), version: VERSION,
    createdAt: p.createdAt || Date.now(), updatedAt: p.updatedAt || Date.now(),
    ...(p.variantOf ? { variantOf: p.variantOf } : {}), ...(p.preview ? { preview: p.preview } : {}),
    activeRoomId: rooms.some(r => r.id === p.activeRoomId) ? p.activeRoomId : rooms[0].id,
    lighting: { ...DEFAULT_LIGHTING, ...p.lighting },
    settings: { ...DEFAULT_SETTINGS, ...p.settings },
    rooms
  };
}

/**
 * v2 project (rooms as tabs, room versions) → [apartment, ...variants].
 * The rooms become one plan in a row; lighting and settings come from the room that was open;
 * every room version becomes a variant project: the apartment with that version instead of its original.
 */
export function migrateV2(p) {
  const rooms = p.rooms.map(r => ({ ...r, id: String(r.id || newId()) }));
  const isVersion = r => r.versionOf && rooms.some(x => x.id === r.versionOf && x !== r);
  const active = rooms.find(r => r.id === p.activeRoomId) || rooms[0];
  const base = {
    createdAt: p.createdAt, updatedAt: p.updatedAt, preview: p.preview,
    lighting: { ...DEFAULT_LIGHTING, ...active.lighting }, settings: { ...DEFAULT_SETTINGS, ...active.settings }
  };
  const main = rooms.filter(r => !isVersion(r)).map(r => normalizeRoom({ ...r, pos: undefined }));
  layoutRow(main);
  const mainActive = isVersion(active) ? active.versionOf : active.id;
  const apartment = normalizeProject({ ...base, id: p.id, name: p.name, activeRoomId: mainActive, rooms: main });
  const variants = rooms.filter(isVersion).sort((a, b) => (a.variant || 0) - (b.variant || 0)).map(v => {
    const ids = new Map();
    const vr = apartment.rooms.map(r => {
      const id = newId();
      ids.set(r.id, id);
      return r.id === v.versionOf
        ? normalizeRoom({ ...v, id, pos: r.pos })
        : { ...structuredClone(r), id };
    });
    return normalizeProject({
      ...base, preview: null, id: newId(), name: `${p.name} — ${v.name}`, variantOf: apartment.id,
      activeRoomId: ids.get(v.versionOf), rooms: vr
    });
  });
  return [apartment, ...variants];
}

export function listProjects() {
  const list = read(INDEX);
  return Array.isArray(list) ? list : [];
}

// Projects that are variants of the given one (and the original, for a variant).
export function variantsOf(id) {
  const list = listProjects(), me = list.find(e => e.id === id);
  const root = me?.variantOf || id;
  return list.filter(e => e.id === root || e.variantOf === root);
}

export function loadProject(id) {
  const p = read(projectKey(id));
  if (!p || !Array.isArray(p.rooms) || !p.rooms.length) return null;
  if (p.version === VERSION) return normalizeProject(p);
  // v2 → v3 once: the variants are saved as their own projects next to it.
  const [main, ...variants] = migrateV2(p);
  for (const v of variants) saveProjectNow(v, { last: false, keepTime: true });
  saveProjectNow(main, { last: false, keepTime: true });
  return main;
}

// Write now; returns false (and reports) when the storage is full or unavailable.
// last: remember it as the project to open next time (false for copies and imports).
export function saveProjectNow(p, { last = true, keepTime = false } = {}) {
  if (pending === p) { clearTimeout(timer); pending = null; }
  if (!keepTime) p.updatedAt = Date.now();
  try {
    store().setItem(projectKey(p.id), JSON.stringify(p));
    const entry = { id: p.id, name: p.name, createdAt: p.createdAt, updatedAt: p.updatedAt, rooms: p.rooms.length,
      ...(p.variantOf ? { variantOf: p.variantOf } : {}) };
    const list = listProjects().filter(e => e.id !== p.id);
    store().setItem(INDEX, JSON.stringify([entry, ...list].sort((a, b) => b.updatedAt - a.updatedAt)));
    if (last) store().setItem(LAST, p.id);
    return true;
  } catch (e) {
    onError(e);
    return false;
  }
}

export function saveProject(p) {
  if (pending && pending !== p) saveProjectNow(pending);
  pending = p;
  clearTimeout(timer);
  timer = setTimeout(() => { pending = null; saveProjectNow(p); }, 300);
}

export function flushSave() {
  if (pending) saveProjectNow(pending);
}

export function deleteProject(id) {
  if (pending?.id === id) { clearTimeout(timer); pending = null; }
  try {
    store().removeItem(projectKey(id));
    store().setItem(INDEX, JSON.stringify(listProjects().filter(e => e.id !== id)));
    if (store().getItem(LAST) === id) store().removeItem(LAST);
  } catch { /* ignore */ }
}

// The old single plan becomes "My project" / "Room 1". The v1 key stays as a spare copy.
export function migrateV1(projectName, roomName) {
  if (listProjects().length) return null;
  const data = read(V1);
  if (!data || !Array.isArray(data.items)) return null;
  const p = makeProject(projectName, [makeRoom(roomName, data)], {
    settings: { ...DEFAULT_SETTINGS, ...data.settings }, lighting: { ...DEFAULT_LIGHTING, ...data.lighting }
  });
  return saveProjectNow(p) ? p : null;
}

// Last opened project, else the newest one, else null (the caller creates a new project).
export function openLastProject() {
  const last = store()?.getItem(LAST);
  const ids = [last, ...listProjects().map(e => e.id)].filter(Boolean);
  for (const id of ids) {
    const p = loadProject(id);
    if (p) return p;
  }
  return null;
}

export const activeRoom = p => p.rooms.find(r => r.id === p.activeRoomId) || p.rooms[0];

export function setLastProject(id) {
  try { store().setItem(LAST, id); } catch { /* ignore */ }
}

// Deep copy with new ids for the project and its rooms (same geometry); extra — e.g. { variantOf }.
export function cloneProject(p, name = p.name, extra = {}) {
  const ids = new Map(p.rooms.map(r => [r.id, newId()]));
  const now = Date.now();
  const { variantOf, ...rest } = structuredClone(p);
  return {
    ...rest, id: newId(), name, version: VERSION, createdAt: now, updatedAt: now, preview: p.preview || null, ...extra,
    activeRoomId: ids.get(p.activeRoomId) || ids.get(p.rooms[0].id),
    rooms: rest.rooms.map(r => ({ ...r, id: ids.get(r.id) }))
  };
}

// A variant of the apartment: an exact copy linked to the original (a variant of a variant links to the original too).
export const makeVariant = (p, name) => cloneProject(p, name, { variantOf: p.variantOf || p.id });

// ---- export / import of a project file ----
export const FILE_FORMAT = 'fsp3d-project';

export function exportProject(p) {
  const { preview, ...rest } = p;
  return { format: FILE_FORMAT, version: VERSION, exportedAt: new Date().toISOString(), project: rest };
}

const isSize = v => Number.isFinite(v) && v >= 50 && v <= 3000;

/**
 * Check a project file (v2 or v3) and return new projects with new ids: [apartment, ...variants]
 * (a v2 file with room versions gives variants). Throws Error('bad file') on anything odd.
 */
export function importProjects(data) {
  const p = data?.format === FILE_FORMAT ? data.project : null;
  const ok = p && typeof p.name === 'string' && Array.isArray(p.rooms) && p.rooms.length > 0 && p.rooms.length <= 50 &&
    p.rooms.every(r => r && r.room && isSize(r.room.L) && isSize(r.room.W) && Array.isArray(r.items ?? []) &&
      (r.items ?? []).every(i => i && Number.isFinite(i.x) && Number.isFinite(i.y) && Number.isFinite(i.w) && Number.isFinite(i.d)));
  if (!ok) throw new Error('bad file');
  const src = { ...p, name: p.name.slice(0, 100), preview: null };
  const [main, ...variants] = p.version === VERSION || data.version === VERSION ? [normalizeProject(src)] : migrateV2(src);
  const copy = cloneProject(main);
  delete copy.variantOf;
  return [copy, ...variants.map(v => ({ ...cloneProject(v), variantOf: copy.id }))];
}

export const importProject = data => importProjects(data)[0];
