// Soft shadows: a stable replacement for screen-space AO. Two kinds, both plain geometry baked once per room:
// - contact shadows: a soft dark patch on the floor under every piece of furniture standing on it;
// - corner shade: narrow gradient strips along the real junctions (floor–wall, wall–ceiling, vertical corners).
// Each is one merged mesh per room (vertex colours with alpha, black, no depth writes): one draw call,
// no halos at silhouettes, the same picture from every angle.
import * as THREE from 'three';

const MAT = new THREE.MeshBasicMaterial({
  color: 0x000000, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
});
const LIFT = 0.002;        // off the surface, m
const SPREAD = 0.1;        // how far a contact shadow fades out around the item, m
const CONTACT = 0.45;      // darkness right under an item
const FLOOR_ONLY = 0.3;    // items whose bottom is higher than this (wall shelves, hanging cabinets) cast none
const STRIP = 0.22, CORNER = 0.12, EDGE = 0.26;   // corner strips: width along floor/ceiling, vertical width, darkness

// Quads: [inner ring of 4 points, outer ring of 4 points, inner alpha, outer alpha]; a "ring" fades outwards.
function addRing(pos, col, idx, inner, outer, aIn, aOut) {
  const base = pos.length / 3;
  for (const p of inner) { pos.push(...p); col.push(0, 0, 0, aIn); }
  for (const p of outer) { pos.push(...p); col.push(0, 0, 0, aOut); }
  // Centre (two triangles) + four sides of the ring.
  idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  for (let i = 0; i < 4; i++) {
    const a = base + i, b = base + (i + 1) % 4, c = base + 4 + (i + 1) % 4, d = base + 4 + i;
    idx.push(a, d, c, a, c, b);
  }
}

// A strip fading from a line (alpha a) to a parallel line (alpha 0): p0, p1 on the junction, n the offset.
function addStrip(pos, col, idx, p0, p1, n, a) {
  const base = pos.length / 3;
  pos.push(...p0, ...p1, p1[0] + n[0], p1[1] + n[1], p1[2] + n[2], p0[0] + n[0], p0[1] + n[1], p0[2] + n[2]);
  col.push(0, 0, 0, a, 0, 0, 0, a, 0, 0, 0, 0, 0, 0, 0, 0);
  idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function meshOf(pos, col, idx, name) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, MAT);
  m.name = name;
  m.renderOrder = 1;
  m.raycast = () => {};     // never picked, never blocks the walker
  m.userData.softShadow = true;
  return m;
}

/**
 * One mesh of shade strips: [{ p0, p1, n, a }] — a strip along p0–p1 (world points), darkness a there, fading to
 * nothing at p + n. Used on the building facade (reveals, under the cornice and the balconies).
 */
export function shadeStrips(strips, name = 'shade') {
  if (!strips.length) return null;
  const pos = [], col = [], idx = [];
  for (const { p0, p1, n, a } of strips) addStrip(pos, col, idx, p0, p1, n, a);
  return meshOf(pos, col, idx, name);
}

/** Footprints of floor-standing items, in the frame of `group` (not yet placed in the scene): [{ x0, z0, x1, z1 }]. */
export function footprints(group) {
  group.updateMatrixWorld(true);
  const out = [];
  const b = new THREE.Box3();
  for (const c of group.children) {
    b.setFromObject(c);
    if (b.isEmpty() || b.min.y > FLOOR_ONLY) continue;
    out.push({ x0: b.min.x, z0: b.min.z, x1: b.max.x, z1: b.max.z });
  }
  return out;
}

/** One mesh of contact shadows for the footprints (metres), or null when there are none. */
export function contactShadows(rects) {
  if (!rects.length) return null;
  const pos = [], col = [], idx = [];
  for (const { x0, z0, x1, z1 } of rects) {
    // A little inset: the darkest part is under the item, the fade runs out past its edges.
    const i = Math.min(0.04, (x1 - x0) / 4, (z1 - z0) / 4), y = LIFT;
    const inner = [[x0 + i, y, z0 + i], [x1 - i, y, z0 + i], [x1 - i, y, z1 - i], [x0 + i, y, z1 - i]];
    const s = SPREAD;
    const outer = [[x0 - s, y, z0 - s], [x1 + s, y, z0 - s], [x1 + s, y, z1 + s], [x0 - s, y, z1 + s]];
    addRing(pos, col, idx, inner, outer, CONTACT, 0);
  }
  return meshOf(pos, col, idx, 'contactShadows');
}

// Parts of [0, len] not covered by the spans [a, b] (doorways: no shade on the floor across them).
function gaps(len, spans) {
  const out = [];
  let x = 0;
  for (const [a, b] of [...spans].sort((p, q) => p[0] - q[0])) {
    if (a > x) out.push([x, Math.min(a, len)]);
    x = Math.max(x, b);
  }
  if (x < len) out.push([x, len]);
  return out.filter(([a, b]) => b - a > 0.01);
}

/**
 * Corner shade of a room shell: L, W, H in metres; openings [{ wall, offset, width, kind, sill, height }] in cm
 * (doors and doorways have no sill). Floor strips stop at doorways; a vertical corner strip is left out
 * where an opening reaches that corner.
 */
export function cornerShade(L, W, H, openings = []) {
  const pos = [], col = [], idx = [];
  const e = LIFT, s = STRIP, c = CORNER, a = EDGE;
  const span = o => [o.offset / 100, (o.offset + o.width) / 100];
  const on = w => openings.filter(o => o.wall === w);
  const doors = w => on(w).filter(o => o.kind !== 'window').map(span);
  // Floor along each wall (towards the room) and ceiling along each wall.
  for (const [x0, x1] of gaps(L, doors('north'))) addStrip(pos, col, idx, [x0, e, e], [x1, e, e], [0, 0, s], a);
  for (const [x0, x1] of gaps(L, doors('south'))) addStrip(pos, col, idx, [x0, e, W - e], [x1, e, W - e], [0, 0, -s], a);
  for (const [z0, z1] of gaps(W, doors('west'))) addStrip(pos, col, idx, [e, e, z0], [e, e, z1], [s, 0, 0], a);
  for (const [z0, z1] of gaps(W, doors('east'))) addStrip(pos, col, idx, [L - e, e, z0], [L - e, e, z1], [-s, 0, 0], a);
  const y = H - e, k = a * 0.8;
  addStrip(pos, col, idx, [0, y, e], [L, y, e], [0, 0, s], k);
  addStrip(pos, col, idx, [0, y, W - e], [L, y, W - e], [0, 0, -s], k);
  addStrip(pos, col, idx, [e, y, 0], [e, y, W], [s, 0, 0], k);
  addStrip(pos, col, idx, [L - e, y, 0], [L - e, y, W], [-s, 0, 0], k);
  // Top of each wall under the ceiling (openings never reach it).
  addStrip(pos, col, idx, [0, y, e], [L, y, e], [0, -s, 0], k);
  addStrip(pos, col, idx, [0, y, W - e], [L, y, W - e], [0, -s, 0], k);
  addStrip(pos, col, idx, [e, y, 0], [e, y, W], [0, -s, 0], k);
  addStrip(pos, col, idx, [L - e, y, 0], [L - e, y, W], [0, -s, 0], k);
  // Vertical corners: on both walls meeting there, unless an opening touches that end of the wall.
  const near = (w, len, atEnd) => on(w).some(o => atEnd ? (o.offset + o.width) / 100 > len - c - 0.02 : o.offset / 100 < c + 0.02);
  const corners = [
    // [x, z, wall along x (north/south) and its end, wall along z (west/east) and its end]
    [0, 0, 'north', false, 'west', false], [L, 0, 'north', true, 'east', false],
    [0, W, 'south', false, 'west', true], [L, W, 'south', true, 'east', true]
  ];
  for (const [x, z, wx, ex, wz, ez] of corners) {
    const sx = x ? -1 : 1, sz = z ? -1 : 1;
    const px = x + sx * e, pz = z + sz * e;
    if (!near(wx, L, ex)) addStrip(pos, col, idx, [x, 0, pz], [x, H, pz], [sx * c, 0, 0], a * 0.8);
    if (!near(wz, W, ez)) addStrip(pos, col, idx, [px, 0, z], [px, H, z], [0, 0, sz * c], a * 0.8);
  }
  return meshOf(pos, col, idx, 'cornerShade');
}
