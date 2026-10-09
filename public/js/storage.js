// Projects with rooms in localStorage (debounced). No DOM here, so it is unit-tested with a fake storage.
//   fsp3d.projects.v2      — index: [{ id, name, createdAt, updatedAt, rooms }]
//   fsp3d.project.<id>     — the whole project: { id, name, createdAt, updatedAt, activeRoomId, rooms: [roomDoc] }
//   fsp3d.lastProject      — id of the project opened last
//   fsp3d.plan.v1          — old single-room plan; migrated once and kept as a spare copy
// roomDoc = { id, name, purpose, versionOf, room, settings, items, seq, openings, openingsLocked, opSeq }
const V1 = 'fsp3d.plan.v1';
const INDEX = 'fsp3d.projects.v2';
const LAST = 'fsp3d.lastProject';
const projectKey = id => 'fsp3d.project.' + id;

const DEFAULT_ROOM = { L: 400, W: 300, H: 270, plinth: 2 };
const DEFAULT_SETTINGS = { snap: 5, gap: 3, grid: 10 };

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
export function normalizeDoc(d = {}) {
  const items = Array.isArray(d.items) ? d.items : [];
  const openings = Array.isArray(d.openings) ? d.openings : null;
  return {
    room: { ...DEFAULT_ROOM, ...d.room },
    settings: { ...DEFAULT_SETTINGS, ...d.settings },
    items,
    seq: Math.max(d.seq || 1, ...items.map(i => i.id + 1)),
    openings,
    openingsLocked: !!d.openingsLocked,
    opSeq: Math.max(d.opSeq || 1, ...(openings || []).map(o => o.id + 1))
  };
}

export function makeRoom(name, doc, extra = {}) {
  return { id: newId(), name, purpose: '', versionOf: null, ...extra, ...normalizeDoc(doc) };
}

export function makeProject(name, rooms) {
  const now = Date.now();
  return { id: newId(), name, createdAt: now, updatedAt: now, activeRoomId: rooms[0].id, rooms };
}

export function listProjects() {
  const list = read(INDEX);
  return Array.isArray(list) ? list : [];
}

export function loadProject(id) {
  const p = read(projectKey(id));
  if (!p || !Array.isArray(p.rooms) || !p.rooms.length) return null;
  p.rooms = p.rooms.map(r => ({
    id: r.id || newId(), name: r.name || '', purpose: r.purpose || '',
    versionOf: r.versionOf ?? null, ...(r.variant ? { variant: r.variant } : {}), ...normalizeDoc(r)
  }));
  if (!p.rooms.some(r => r.id === p.activeRoomId)) p.activeRoomId = p.rooms[0].id;
  return p;
}

// Write now; returns false (and reports) when the storage is full or unavailable.
export function saveProjectNow(p) {
  if (pending === p) { clearTimeout(timer); pending = null; }
  p.updatedAt = Date.now();
  try {
    store().setItem(projectKey(p.id), JSON.stringify(p));
    const entry = { id: p.id, name: p.name, createdAt: p.createdAt, updatedAt: p.updatedAt, rooms: p.rooms.length };
    const list = listProjects().filter(e => e.id !== p.id);
    store().setItem(INDEX, JSON.stringify([entry, ...list]));
    store().setItem(LAST, p.id);
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
  const p = makeProject(projectName, [makeRoom(roomName, data)]);
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

// Rooms of one version group: the original (variant 1) and its copies (versionOf = original id).
export function versionGroup(p, room) {
  const root = p.rooms.find(r => r.id === room.versionOf) || room;
  return p.rooms.filter(r => r === root || r.versionOf === root.id);
}

// Copy the room as the next free variant of its group, placed right after the group.
// nameOf(originalName, n) builds the name, e.g. "Bedroom — variant B" for n = 2.
export function makeVersion(p, id, nameOf) {
  const src = p.rooms.find(r => r.id === id);
  const root = p.rooms.find(r => r.id === src.versionOf) || src;
  const group = versionGroup(p, src);
  root.variant ??= 1;
  const used = new Set(group.map(r => r.variant || 1));
  let n = 2;
  while (used.has(n)) n++;
  const copy = { ...structuredClone(src), id: newId(), name: nameOf(root.name, n), versionOf: root.id, variant: n };
  p.rooms.splice(p.rooms.indexOf(group[group.length - 1]) + 1, 0, copy);
  return copy;
}
