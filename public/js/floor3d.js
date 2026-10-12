// Floor view embedded in the showcase (building.html → iframe /?embed=floor&b=<id>&apt=<no>): the chosen apartment
// is a temporary project (full detail, never saved), the rest of its floor a low-detail shell around it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getLang } from './i18n.js';
import { FILE_FORMAT, VERSION, importProject } from './storage.js';
import { entrances, roomRect } from './apartment.js';
import { localRoomName } from './building.js';
import { openTemporary } from './projects.js';

export function embedParams(search = location.search) {
  const q = new URLSearchParams(search);
  const b = q.get('b') || '', apt = Number(q.get('apt'));
  return q.get('embed') === 'floor' && /^[a-z0-9-]{1,60}$/.test(b) && Number.isInteger(apt) && apt > 0 ? { b, apt } : null;
}

// Load the building, open the apartment as a temporary project with the walker at its entrance door.
export async function openFloor({ b, apt }) {
  const res = await fetch('/api/buildings/' + encodeURIComponent(b));
  if (!res.ok) throw new Error(res.status);
  const bld = await res.json();
  const a = bld.floorsData.flatMap(f => f.apartments || []).find(q => q.no === apt);
  if (!a) throw new Error('no apartment');
  const lang = getLang();
  const rooms = a.plan.map(r => ({ ...structuredClone(r), name: localRoomName(r.name, lang) }));
  const name = `${bld.name?.[lang] || bld.name?.ru || b}, №${a.no}`;
  const p = importProject({ format: FILE_FORMAT, version: VERSION, project: { name, activeRoomId: rooms[0].id, rooms } });
  p.activeRoomId = entrances(p.rooms)[0] || p.activeRoomId;
  openTemporary(p);
  return { bld, a };
}

const WALL = 5;      // half a partition: every shell room gets this much wall outside its outline, cm
const SLAB = 20;     // floor slab under the whole section, cm
let mats = null;
const materials = () => (mats ||= {
  wall: new THREE.MeshStandardMaterial({ color: '#e7e2d8', roughness: 0.95 }),
  floor: new THREE.MeshStandardMaterial({ color: '#c9c1b3', roughness: 1 }),
  corridor: new THREE.MeshStandardMaterial({ color: '#b3ada3', roughness: 0.9 }),
  core: new THREE.MeshStandardMaterial({ color: '#8f969d', roughness: 0.9 }),
  slab: new THREE.MeshStandardMaterial({ color: '#6c727a', roughness: 1 }),
  glass: new THREE.MeshStandardMaterial({ color: '#9cc3e6', roughness: 0.1, transparent: true, opacity: 0.35, depthWrite: false })
});

// The floor around apartment `a` (scene origin = the apartment's corner): other apartments as merged shells
// (floor, walls with window gaps, glass; their doors stay closed), the corridor, the lift/stair core, the slab.
// One mesh per material, no shadows.
export function floorContext({ bld, a }) {
  const parts = { wall: [], floor: [], corridor: [], core: [], slab: [], glass: [] };
  const box = (kind, x, z, w, d, y0, h) => {
    if (w <= 0 || d <= 0 || h <= 0) return;
    const g = new THREE.BoxGeometry(w / 100, h / 100, d / 100);
    g.translate((x + w / 2 - a.at.x) / 100, (y0 + h / 2) / 100, (z + d / 2 - a.at.y) / 100);
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
  const { corridor, core, section } = bld;
  if (corridor) box('corridor', corridor.x, corridor.y, corridor.w, corridor.h, -2, 2);
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
  return group;
}
