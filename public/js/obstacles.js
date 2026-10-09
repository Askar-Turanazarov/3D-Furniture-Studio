// Fixed parts of the room the furniture has to fit around. Pure helpers, all values in cm.
// obstacle = { id, kind, x, y, w, d, h, elev } — x/y: top-left on the plan, w along X, d along Y,
// h: height, elev: bottom above the floor (a ceiling duct hangs at H − h).
// Obstacles are structure: they stand flush with the walls (no plinth inset).
import { wallLen } from './openings.js';

export const OB_KINDS = ['column', 'duct', 'ceilingDuct', 'ledge', 'radiator'];

export const obRect = o => ({ x: o.x, y: o.y, w: o.w, h: o.d });

// A strip of depth `depth` along the wall from `offset` (along the wall) with length `len`.
export function wallStrip(wall, offset, len, depth, room) {
  switch (wall) {
    case 'north': return { x: offset, y: 0, w: len, d: depth };
    case 'south': return { x: offset, y: room.W - depth, w: len, d: depth };
    case 'west':  return { x: 0, y: offset, w: depth, d: len };
    default:      return { x: room.L - depth, y: offset, w: depth, d: len };
  }
}

export function newObstacle(kind, id, room, openings = []) {
  const { L, W, H } = room;
  let o;
  switch (kind) {
    case 'column':
      o = { x: Math.round(L / 2 - 20), y: Math.round(W / 2 - 20), w: 40, d: 40, h: H, elev: 0 };
      break;
    case 'duct':
      o = { x: 0, y: 0, w: 30, d: 30, h: H, elev: 0 };
      break;
    case 'ceilingDuct':
      o = { ...wallStrip('north', 0, Math.min(200, L), 30, room), h: 30, elev: H - 30 };
      break;
    case 'ledge':
      o = { ...wallStrip('north', Math.round(L / 2 - 20), 40, 20, room), h: H, elev: 0 };
      break;
    case 'radiator': {
      // Centred under the first window, else in the middle of the north wall.
      const win = openings.find(op => op.kind === 'window');
      const wall = win ? win.wall : 'north';
      const len = Math.min(80, wallLen(wall, room));
      const mid = win ? win.offset + win.width / 2 : wallLen(wall, room) / 2;
      o = { ...wallStrip(wall, Math.round(mid - len / 2), len, 10, room), h: 55, elev: 15 };
      break;
    }
    default:
      throw new Error('unknown obstacle kind ' + kind);
  }
  return clampObstacle({ id, kind, ...o }, room);
}

// A niche = two ledges on both sides of the free part of the wall.
// offset/width — the niche along the wall, depth — how deep it is. → [ledge, ledge] (zero-length sides skipped)
export function nicheLedges(wall, offset, width, depth, room, nextId) {
  const len = wallLen(wall, room);
  const a = Math.max(0, Math.min(offset, len));
  const b = Math.max(a, Math.min(offset + width, len));
  const out = [];
  for (const [s, e] of [[0, a], [b, len]]) {
    if (e - s >= 1) out.push(clampObstacle({ id: nextId(), kind: 'ledge', ...wallStrip(wall, s, e - s, depth, room), h: room.H, elev: 0 }, room));
  }
  return out;
}

// Keep the obstacle inside the room and below the ceiling (after room resize or edits).
export function clampObstacle(o, room) {
  const r = v => Math.round(Number(v) || 0);
  o.w = Math.max(1, Math.min(r(o.w), room.L));
  o.d = Math.max(1, Math.min(r(o.d), room.W));
  o.x = Math.max(0, Math.min(r(o.x), room.L - o.w));
  o.y = Math.max(0, Math.min(r(o.y), room.W - o.d));
  o.h = Math.max(1, Math.min(r(o.h), room.H));
  o.elev = Math.max(0, Math.min(r(o.elev), room.H - o.h));
  return o;
}

// Full-height obstacles follow the ceiling when the room height changes.
export function fitObstacleHeight(o, oldH, room) {
  if (o.elev === 0 && o.h === oldH) o.h = room.H;
  if (o.kind === 'ceilingDuct' && o.elev + o.h === oldH) o.elev = room.H - o.h;
  return clampObstacle(o, room);
}
