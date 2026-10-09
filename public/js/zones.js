// Opening zones of furniture: hinged doors, drawers, pull-out beds. Pure helpers, cm.
// The zone is a rect in front of the front face (same side as the 2D front marker):
// rot 0 → +Y, 90 → −X, 180 → −Y, 270 → +X. It has the item's own height range.
import { rectOf } from './geometry.js';

export const OPEN_KINDS = ['swing', 'slide', 'drawer', 'pullout', 'none'];
const DOOR_W = 50;      // typical leaf width, cm → number of doors
const MAX_SWING = 60;   // a wider leaf is rare; the zone depth is capped
const PULLOUT = 110;    // sofa bed / pull-out depth

// Catalog default (type.open) overridden by item.open → { kind, doors, depth }
export function openSpec(item, catalog = []) {
  const base = catalog.find(c => c.type === item.type)?.open || { kind: 'none' };
  const o = { ...base, ...(item.open || {}) };
  const kind = OPEN_KINDS.includes(o.kind) ? o.kind : 'none';
  if (kind === 'swing') {
    const doors = Math.max(1, Math.min(8, Math.round(o.doors || Math.max(1, Math.round(item.w / DOOR_W)))));
    const depth = Math.round(o.depth || Math.min(MAX_SWING, item.w / doors));
    return { kind, doors, depth };
  }
  if (kind === 'drawer') return { kind, doors: 0, depth: Math.round(o.depth || item.d * 0.8) };
  if (kind === 'pullout') return { kind, doors: 0, depth: Math.round(o.depth || PULLOUT) };
  return { kind, doors: 0, depth: 0 };
}

// Front face of the footprint: start point, unit vector along it, outward normal.
export function frontFace(item) {
  const r = rectOf(item);
  switch (item.rot) {
    case 90:  return { p: [r.x, r.y + r.h], u: [0, -1], n: [-1, 0], len: r.h };
    case 180: return { p: [r.x + r.w, r.y], u: [-1, 0], n: [0, -1], len: r.w };
    case 270: return { p: [r.x + r.w, r.y], u: [0, 1], n: [1, 0], len: r.h };
    default:  return { p: [r.x, r.y + r.h], u: [1, 0], n: [0, 1], len: r.w };
  }
}

export function openZoneRect(item, spec) {
  if (!spec.depth) return null;
  const r = rectOf(item), d = spec.depth;
  switch (item.rot) {
    case 90:  return { x: r.x - d, y: r.y, w: d, h: r.h };
    case 180: return { x: r.x, y: r.y - d, w: r.w, h: d };
    case 270: return { x: r.x + r.w, y: r.y, w: d, h: r.h };
    default:  return { x: r.x, y: r.y + r.h, w: r.w, h: d };
  }
}

// Free distance from the front face to a blocking rect (or a wall) along the normal.
export function freeDepth(item, b) {
  const r = rectOf(item);
  switch (item.rot) {
    case 90:  return r.x - (b.x + b.w);
    case 180: return r.y - (b.y + b.h);
    case 270: return b.x - (r.x + r.w);
    default:  return b.y - (r.y + r.h);
  }
}

export function wallDepth(item, room) {
  const r = rectOf(item);
  switch (item.rot) {
    case 90:  return r.x;
    case 180: return r.y;
    case 270: return room.L - r.x - r.w;
    default:  return room.W - r.y - r.h;
  }
}
