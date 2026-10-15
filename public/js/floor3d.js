// Floor view embedded in the showcase (building.html → iframe /?embed=floor&b=<id>&apt=<no>): the chosen apartment
// and the floor corridor are a temporary project (full detail, never saved), the other apartments a low-detail
// shell around them. From the corridor the doors of the neighbours lead in: free and booked ones open (the
// detailed apartment is swapped behind a short fade), sold ones stay locked.
// Coordinates: the section's (cm), the scene origin is the section corner.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { t, getLang } from './i18n.js';
import { state, onChange } from './state.js';
import { normalizeProject } from './storage.js';
import { doorLinks, entrances, roomRect } from './apartment.js';
import { localRoomName } from './building.js';
import { styleOf } from './style.js';
import { openTemporary } from './projects.js';
import { toast } from './ui.js';

export const CORR_ID = 'corr';
const OPPOSITE = { north: 'south', south: 'north', west: 'east', east: 'west' };

export function embedParams(search = location.search) {
  const q = new URLSearchParams(search);
  const b = q.get('b') || '', apt = Number(q.get('apt'));
  return q.get('embed') === 'floor' && /^[a-z0-9-]{1,60}$/.test(b) && Number.isInteger(apt) && apt > 0 ? { b, apt } : null;
}

// Rooms of an apartment on the floor (section coordinates).
const placed = a => a.plan.map(r => ({ ...structuredClone(r), pos: { x: a.at.x + r.pos.x, y: a.at.y + r.pos.y } }));

// The entrance door of an apartment as seen from the corridor: { wall (of the corridor), x (cm along it), width }.
export function entranceDoor(a) {
  const rooms = placed(a);
  const link = doorLinks(rooms).find(l => l.to === 'outside');
  if (!link) return null;
  const r = rooms.find(q => q.id === link.room), o = r.openings.find(d => d.id === link.door);
  if (o.wall !== 'north' && o.wall !== 'south') return null;
  return { wall: OPPOSITE[o.wall], x: r.pos.x + o.offset, width: o.width, height: o.height || 210 };
}

/**
 * The floor corridor as a room of the project: the doors of the other apartments in its walls (they lead
 * "outside", i.e. to the shells), the lift and stair doors in the wall facing the core.
 * → { room, doors: Map(doorId → { aptNo } | { lift: i } | { stairs: true }) }
 */
export function corridorRooms(bld, floor, aptNo, lang = getLang()) {
  const c = bld.corridor;
  if (!c) return null;
  const H = bld.section?.H || 280;
  const f = bld.floorsData.find(q => q.n === floor);
  const openings = [], doors = new Map();
  let id = 1;
  const add = (wall, x, width, height, meta) => {
    openings.push({ id, kind: 'door', wall, offset: Math.round(x - c.x), width, height, hinge: 'start' });
    doors.set(id++, meta);
  };
  for (const o of f?.apartments || []) {
    if (o.no === aptNo) continue;
    const e = entranceDoor(o);
    if (e) add(e.wall, e.x, e.width, e.height, { aptNo: o.no });
  }
  const core = bld.core;
  if (core) {
    const wall = core.y >= c.y + c.h ? 'south' : 'north';
    add(wall, core.x + 60, 110, 210, { lift: 1 });
    add(wall, core.x + 200, 110, 210, { lift: 2 });
    add(wall, core.x + core.w - 150, 90, 210, { stairs: true });
  }
  const room = {
    id: CORR_ID, name: t('floor3d.corridor', { n: floor }), purpose: 'hall',
    pos: { x: c.x, y: c.y }, room: { L: c.w, W: c.h, H, plinth: 2 },
    openings, items: [], obstacles: [],
    style: { ...styleOf({}), floor: 'tile', wall: { material: 'paint', color: '#e6e1d8' }, accentWall: null, finish: 'finished' }
  };
  return { room, doors, lang };
}

// The project: the apartment (names "Apt. №N · room") plus the corridor; the walker starts in its hall.
function floorProject(bld, a, keep = null) {
  const lang = getLang();
  const rooms = placed(a).map(r => ({ ...r, name: t('floor3d.room', { no: a.no, name: localRoomName(r.name, lang) }) }));
  const start = entrances(rooms)[0] || rooms[0].id;
  if (keep?.finish) for (const r of rooms) r.style = { ...styleOf(r.style), finish: keep.finish };
  const corr = corridorRooms(bld, a.floor, a.no, lang);
  const name = `${bld.name?.[lang] || bld.name?.ru || bld.id}, №${a.no}`;
  // Not importProject: its size check (≤ 30 m) is for files, the corridor runs the whole section.
  const p = normalizeProject({ name, activeRoomId: start, rooms: corr ? [...rooms, corr.room] : rooms,
    ...(keep?.lighting ? { lighting: structuredClone(keep.lighting) } : {}) });
  return { p, doors: corr?.doors || new Map() };
}

// Load the building, open the apartment and its corridor as a temporary project.
export async function openFloor({ b, apt }) {
  const res = await fetch('/api/buildings/' + encodeURIComponent(b));
  if (!res.ok) throw new Error(res.status);
  const bld = await res.json();
  const a = bld.floorsData.flatMap(f => f.apartments || []).find(q => q.no === apt);
  if (!a) throw new Error('no apartment');
  const { p, doors } = floorProject(bld, a);
  openTemporary(p);
  return { bld, a, doors };
}

const WALL = 5;      // half a partition: every shell room gets this much wall outside its outline, cm
const SLAB = 20;     // floor slab under the whole section, cm
let mats = null;
const materials = () => (mats ||= {
  wall: new THREE.MeshStandardMaterial({ color: '#e7e2d8', roughness: 0.95 }),
  floor: new THREE.MeshStandardMaterial({ color: '#c9c1b3', roughness: 1 }),
  core: new THREE.MeshStandardMaterial({ color: '#8f969d', roughness: 0.9 }),
  slab: new THREE.MeshStandardMaterial({ color: '#6c727a', roughness: 1 }),
  glass: new THREE.MeshStandardMaterial({ color: '#9cc3e6', roughness: 0.1, transparent: true, opacity: 0.35, depthWrite: false })
});

const PLATE = { free: '#2b8a3e', booked: '#d9480f', sold: '#868e96' };

// Number plate over a corridor door: the apartment number on a stripe of its status colour.
function plate(no, status) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2f3337';
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = PLATE[status] || '#868e96';
  g.fillRect(0, 54, 128, 10);
  g.fillStyle = '#f4efe6';
  g.font = '600 38px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(no), 64, 28);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.16), new THREE.MeshBasicMaterial({ map: tex }));
}

// The floor around apartment `a`: other apartments as merged shells (floor, walls with window gaps, glass;
// their doors stay closed), the lift/stair core, the slab, number plates on the corridor doors.
// One mesh per material, no shadows.
export function floorContext({ bld, a }) {
  const parts = { wall: [], floor: [], core: [], slab: [], glass: [] };
  const box = (kind, x, z, w, d, y0, h) => {
    if (w <= 0 || d <= 0 || h <= 0) return;
    const g = new THREE.BoxGeometry(w / 100, h / 100, d / 100);
    g.translate((x + w / 2) / 100, (y0 + h / 2) / 100, (z + d / 2) / 100);
    parts[kind].push(g);
  };
  const floor = bld.floorsData.find(f => f.n === a.floor);
  const H = bld.section?.H || 280;
  for (const o of floor?.apartments || []) {
    if (o.no === a.no) continue;
    for (const r of o.plan) {
      const q = roomRect(r), x = o.at.x + q.x, z = o.at.y + q.y;
      box('floor', x, z, q.w, q.h, -2, 2);
      const h = r.room.H || H;
      const wins = (r.openings || []).filter(w => w.kind === 'window');
      // Each wall: along its length, with gaps for the windows (sill below, lintel above, glass in between).
      for (const wall of ['north', 'south', 'west', 'east']) {
        const horiz = wall === 'north' || wall === 'south';
        const len = horiz ? q.w : q.h;
        const seg = (from, to, y0, hh) => {
          if (to <= from) return;
          if (horiz) box('wall', x + from, wall === 'north' ? z - WALL : z + q.h, to - from, WALL, y0, hh);
          else box('wall', wall === 'west' ? x - WALL : x + q.w, z + from, WALL, to - from, y0, hh);
        };
        const glass = (from, to, y0, hh) => {
          if (horiz) box('glass', x + from, (wall === 'north' ? z - WALL : z + q.h) + WALL / 2 - 0.5, to - from, 1, y0, hh);
          else box('glass', (wall === 'west' ? x - WALL : x + q.w) + WALL / 2 - 0.5, z + from, 1, to - from, y0, hh);
        };
        let at = 0;
        for (const w of wins.filter(w => w.wall === wall).sort((p, s) => p.offset - s.offset)) {
          const s = Math.max(at, w.offset), e = Math.min(len, w.offset + w.width);
          if (e <= s) continue;
          seg(at, s, 0, h);
          seg(s, e, 0, w.sill);
          seg(s, e, w.sill + w.height, h - w.sill - w.height);
          glass(s, e, w.sill, w.height);
          at = e;
        }
        seg(at, len, 0, h);
      }
      // Corners between the wall strips.
      for (const [cx, cz] of [[x - WALL, z - WALL], [x + q.w, z - WALL], [x - WALL, z + q.h], [x + q.w, z + q.h]]) box('wall', cx, cz, WALL, WALL, 0, h);
    }
  }
  const { core, section } = bld;
  if (core) box('core', core.x, core.y, core.w, core.h, 0, H);
  if (section) box('slab', 0, 0, section.L, section.W, -2 - SLAB, SLAB);
  const group = new THREE.Group();
  group.name = 'floorContext';
  const m = materials();
  for (const [kind, list] of Object.entries(parts)) {
    if (!list.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(list), m[kind]);
    for (const g of list) g.dispose();
    mesh.castShadow = mesh.receiveShadow = false;
    if (kind === 'glass') mesh.renderOrder = 1;
    group.add(mesh);
  }
  // Plates over the neighbours' doors, on the corridor side.
  const c = bld.corridor;
  for (const o of floor?.apartments || []) {
    if (o.no === a.no || !c) continue;
    const e = entranceDoor(o);
    if (!e) continue;
    const p = plate(o.no, o.status);
    const north = e.wall === 'north';
    p.position.set((e.x + e.width / 2) / 100, 2.32, (north ? c.y + 1 : c.y + c.h - 1) / 100);
    if (!north) p.rotation.y = Math.PI;
    group.add(p);
  }
  return group;
}

// ---------- walking between apartments ----------
let ctx = null, busy = false, corrShown = false;

function fadeEl() {
  let el = document.getElementById('fade3d');
  if (!el) {
    el = Object.assign(document.createElement('div'), { id: 'fade3d', className: 'fade3d' });
    document.getElementById('view3d').append(el);
  }
  return el;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Corridor doors: sold → locked with a note, free / booked → enter (the detailed apartment is swapped).
 * Returns true when the door is handled here (the default opening is skipped). Lifts and stairs are locked.
 */
export function corridorDoor(roomId, doorId, enter = enterApartment) {
  if (roomId !== CORR_ID || !ctx) return false;
  const meta = ctx.doors.get(doorId);
  if (!meta) return false;
  if (meta.aptNo) {
    const o = ctx.bld.floorsData.flatMap(f => f.apartments).find(q => q.no === meta.aptNo);
    if (o?.status === 'sold') toast(t('floor3d.sold', { no: o.no }));
    else if (o) enter(o);
  }
  return true;
}

// The neighbour's apartment becomes the detailed one; finish level and light stay as they are.
export async function enterApartment(a2, setContext) {
  if (busy) return;
  busy = true;
  const fade = fadeEl();
  fade.classList.add('on');
  await sleep(300);
  try {
    const keep = { lighting: state.lighting, finish: styleOf(state.style).finish };
    const { p, doors } = floorProject(ctx.bld, a2, keep);
    openTemporary(p);
    ctx = { ...ctx, a: a2, doors };
    (setContext || ctx.setContext)(floorContext(ctx));
    try { window.parent?.postMessage({ type: 'fsp3d:apartment', no: a2.no }, location.origin); } catch { /* ignore */ }
  } finally {
    await sleep(60);
    fade.classList.remove('on');
    busy = false;
  }
}

// Called once the embedded floor is shown: door hook, corridor hint.
export function enableCorridor(floorCtx, { setContext, setDoorHook }) {
  ctx = { ...floorCtx, setContext };
  setDoorHook((roomId, doorId) => corridorDoor(roomId, doorId));
  onChange(() => {
    if (state.activeRoomId === CORR_ID && !corrShown) {
      corrShown = true;
      toast(t('floor3d.corrHint'));
    }
  });
}
