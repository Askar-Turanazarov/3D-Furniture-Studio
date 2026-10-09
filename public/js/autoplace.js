// "Find a spot": scan (x, y) with the snap step over 4 rotations.
// Wall-adjacent positions are tried first, then the whole room.
import { footprint, rectOf, blocked, insideRoom, obstacleRects, zOverlaps } from './geometry.js';
import { doorSwingRect, windowZoneRect, nearestWall } from './openings.js';
import { openSpec, openZoneRect } from './zones.js';

const ROTS = [0, 90, 180, 270];
const MAX_STEPS = 600;   // per axis, keeps big rooms fast

// → { ok: true, x, y, rot } | { ok: false, key, params }
export function findSpot(item, state) {
  const { room, settings } = state;
  const p = room.plinth;
  const Lu = room.L - 2 * p, Wu = room.W - 2 * p;
  const gap = settings.gap;
  // Door swing areas count as obstacles, so nothing is auto-placed in front of a door.
  const elev = item.elev || 0;
  const others = state.items.filter(i => i.id !== item.id && zOverlaps(i, item)).map(i => rectOf(i))
    .concat((state.openings || []).filter(o => o.kind === 'door' && elev < o.height).map(o => doorSwingRect(o, room)))
    .concat(obstacleRects(state.obstacles, item));

  if (elev + item.h > room.H) return { ok: false, key: 'auto.tooTall', params: { n: elev + item.h - room.H } };

  // Doesn't fit even into an empty room → report the shortfall per axis.
  const shortA = { L: Math.max(0, item.w - Lu), W: Math.max(0, item.d - Wu) };
  const shortB = { L: Math.max(0, item.d - Lu), W: Math.max(0, item.w - Wu) };
  if ((shortA.L || shortA.W) && (shortB.L || shortB.W)) {
    const s = shortA.L + shortA.W <= shortB.L + shortB.W ? shortA : shortB;
    return s.L > 0
      ? { ok: false, key: 'auto.tooBigL', params: { n: s.L } }
      : { ok: false, key: 'auto.tooBigW', params: { n: s.W } };
  }

  // Current rotation first, then the rest.
  const rots = [item.rot, ...ROTS.filter(r => r !== item.rot)];
  const loose = (x, y, rot) => {
    const r = rectOf(item, x, y, rot);
    return insideRoom(r, room) && !blocked(r, others, gap);
  };
  // Strict: own opening zone inside the room and free; not standing in other items' zones.
  const spec = openSpec(item, state.catalog);
  const otherZones = state.items.filter(i => i.id !== item.id && zOverlaps(i, item))
    .map(i => openZoneRect(i, openSpec(i, state.catalog))).filter(Boolean);
  const strict = (x, y, rot) => {
    if (!loose(x, y, rot)) return false;
    const r = rectOf(item, x, y, rot);
    if (blocked(r, otherZones, 0)) return false;
    const z = openZoneRect({ ...item, x, y, rot }, spec);
    return !z || (z.x >= 0 && z.y >= 0 && z.x + z.w <= room.L && z.y + z.h <= room.W && !blocked(z, others, 0));
  };
  const hard = search(strict);
  if (hard) return hard;
  const soft = search(loose);
  if (soft) return { ...soft, soft: true };
  return explainFailure(item, state, others);

  function search(fits) {

  // Pass 1: along the walls, back to the wall (front faces into the room).
  const walls = [
    { rot: 0, side: 'north' }, { rot: 90, side: 'east' },
    { rot: 270, side: 'west' }, { rot: 180, side: 'south' }
  ];
  for (const { rot, side } of walls) {
    const f = footprint(item, rot);
    if (side === 'north' || side === 'south') {
      const y = side === 'north' ? p : room.W - p - f.h;
      for (const x of axisCandidates(p, room.L - p - f.w, f.w, 'x', others, settings)) {
        if (fits(x, y, rot)) return { ok: true, x, y, rot };
      }
    } else {
      const x = side === 'west' ? p : room.L - p - f.w;
      for (const y of axisCandidates(p, room.W - p - f.h, f.h, 'y', others, settings)) {
        if (fits(x, y, rot)) return { ok: true, x, y, rot };
      }
    }
  }
  // Pass 2: anywhere.
  for (const rot of rots) {
    const f = footprint(item, rot);
    const xs = axisCandidates(p, room.L - p - f.w, f.w, 'x', others, settings);
    const ys = axisCandidates(p, room.W - p - f.h, f.h, 'y', others, settings);
    for (const y of ys) for (const x of xs) if (fits(x, y, rot)) return { ok: true, x, y, rot };
  }
  return null;
  }
}

// Grid positions plus exact "touching" positions next to other items.
function axisCandidates(min, max, size, axis, others, settings) {
  if (max < min) return [];
  const step = Math.max(settings.snap, Math.ceil((max - min) / MAX_STEPS));
  const set = new Set();
  for (let v = min; v <= max + 1e-6; v += step) set.add(v);
  set.add(max);
  for (const o of others) {
    const [s, len] = axis === 'x' ? [o.x, o.w] : [o.y, o.h];
    for (const v of [s + len + settings.gap, s - settings.gap - size]) {
      if (v >= min - 1e-6 && v <= max + 1e-6) set.add(v);
    }
  }
  return [...set].sort((a, b) => a - b);
}

// For each wall and orientation: longest free run in the strip along the wall.
// Report the smallest shortfall: "N cm short along the south wall".
function explainFailure(item, state, others) {
  const { room, settings } = state;
  const p = room.plinth, gap = settings.gap;
  let best = null;

  for (const rot of [0, 90]) {
    const f = footprint(item, rot);
    const walls = [
      { wall: 'north', along: 'x', need: f.w, depth: f.h, strip: { x: p, y: p, w: room.L - 2 * p, h: f.h } },
      { wall: 'south', along: 'x', need: f.w, depth: f.h, strip: { x: p, y: room.W - p - f.h, w: room.L - 2 * p, h: f.h } },
      { wall: 'west', along: 'y', need: f.h, depth: f.w, strip: { x: p, y: p, w: f.w, h: room.W - 2 * p } },
      { wall: 'east', along: 'y', need: f.h, depth: f.w, strip: { x: room.L - p - f.w, y: p, w: f.w, h: room.W - 2 * p } }
    ];
    for (const w of walls) {
      if (w.depth > (w.along === 'x' ? room.W : room.L) - 2 * p) continue;
      const free = longestFree(w.strip, w.along, others, gap);
      const short = Math.ceil(w.need - free);
      if (short > 0 && (!best || short < best.n)) best = { n: short, wall: w.wall };
    }
  }
  return best
    ? { ok: false, key: 'auto.deficit', params: { n: best.n, wallAlong: best.wall } }
    : { ok: false, key: 'auto.noSpace', params: {} };
}

function longestFree(strip, along, others, gap) {
  const [start, end] = along === 'x' ? [strip.x, strip.x + strip.w] : [strip.y, strip.y + strip.h];
  const blocks = [];
  for (const o of others) {
    // Obstacle expanded by the gap; does it reach into the strip?
    const e = { x: o.x - gap, y: o.y - gap, w: o.w + 2 * gap, h: o.h + 2 * gap };
    const hit = e.x < strip.x + strip.w && strip.x < e.x + e.w && e.y < strip.y + strip.h && strip.y < e.y + e.h;
    if (!hit) continue;
    blocks.push(along === 'x' ? [e.x, e.x + e.w] : [e.y, e.y + e.h]);
  }
  blocks.sort((a, b) => a[0] - b[0]);
  let cur = start, best = 0;
  for (const [a, b] of blocks) {
    if (a > cur) best = Math.max(best, Math.min(a, end) - cur);
    cur = Math.max(cur, b);
    if (cur >= end) break;
  }
  if (cur < end) best = Math.max(best, end - cur);
  return best;
}

// ---------- "Fill a niche": the largest wardrobe in the free run of a wall ----------
export const NICHE = { depth: 60, minDepth: 30, minW: 40, top: 5, step: 5, highOb: 150 };
const WALL_ROT = { north: 0, east: 90, south: 180, west: 270 };

// Wall-local coords of a plan rect: along the wall [a0, a1], depth from the wall [v0, v1].
function local(r, wall, room) {
  switch (wall) {
    case 'north': return { a0: r.x, a1: r.x + r.w, v0: r.y, v1: r.y + r.h };
    case 'south': return { a0: r.x, a1: r.x + r.w, v0: room.W - r.y - r.h, v1: room.W - r.y };
    case 'west':  return { a0: r.y, a1: r.y + r.h, v0: r.x, v1: r.x + r.w };
    default:      return { a0: r.y, a1: r.y + r.h, v0: room.L - r.x - r.w, v1: room.L - r.x };
  }
}

// pt — click on the plan (cm). Along the nearest wall: free run around the click up to the first
// item, structure, door swing, window or corner (with plinth and gap); depth — 60 or less to keep
// minPassage in front; height — to the ceiling (or the bottom of a ceiling duct) minus 5 cm.
// → { ok: true, wall, free, item: { w, d, h, x, y, rot } } | { ok: false, key, params }
export function largestFit(pt, state) {
  const { room, settings } = state;
  const p = room.plinth, gap = settings.gap || 0, minPassage = settings.minPassage || 60;
  const { wall } = nearestWall(pt.x, pt.y, room);
  const horiz = wall === 'north' || wall === 'south';
  const len = horiz ? room.L : room.W, deep = horiz ? room.W : room.L;
  const u = horiz ? pt.x : pt.y;
  const tall = { elev: 0, h: room.H };

  // Things standing at the wardrobe's height; high structure (ceiling ducts) limits the height instead.
  const solid = state.items.filter(i => zOverlaps(i, tall)).map(i => ({ r: rectOf(i), gap }))
    .concat((state.obstacles || []).filter(o => (o.elev || 0) < NICHE.highOb).map(o => ({ r: { x: o.x, y: o.y, w: o.w, h: o.d }, gap })));
  const zones = (state.openings || []).map(o => ({ r: o.kind === 'door' ? doorSwingRect(o, room) : windowZoneRect(o, room), gap: 0 }));

  let lo = p, hi = len - p;
  for (const { r, gap: g } of solid.concat(zones)) {
    const l = local(r, wall, room);
    if (l.v0 >= p + NICHE.depth + g || l.v1 <= 0) continue;        // not in the strip along the wall
    const a0 = l.a0 - g, a1 = l.a1 + g;
    if (a0 < u && u < a1) return { ok: false, key: 'niche.occupied', params: {} };
    if (a1 <= u) lo = Math.max(lo, a1); else hi = Math.min(hi, a0);
  }
  const free = Math.floor(hi - lo);
  const w = Math.floor(free / NICHE.step) * NICHE.step;
  if (w < NICHE.minW) return { ok: false, key: 'niche.narrow', params: { n: Math.max(0, free) } };

  // Depth: up to 60, leaving minPassage to whatever stands in front within the run.
  let front = deep - p;
  for (const { r } of solid) {
    const l = local(r, wall, room);
    if (l.a1 > lo && l.a0 < hi && l.v0 >= p) front = Math.min(front, l.v0);
  }
  const d = Math.floor(Math.min(NICHE.depth, front - p - minPassage));
  if (d < NICHE.minDepth) return { ok: false, key: 'niche.shallow', params: { n: Math.max(0, d) } };

  let ceil = room.H - p;
  for (const o of state.obstacles || []) {
    if ((o.elev || 0) < NICHE.highOb) continue;
    const l = local({ x: o.x, y: o.y, w: o.w, h: o.d }, wall, room);
    if (l.a1 > lo && l.a0 < hi && l.v0 < p + d) ceil = Math.min(ceil, o.elev);
  }
  const h = Math.floor(ceil - NICHE.top);

  const a = lo + Math.floor((hi - lo - w) / 2);
  const rot = WALL_ROT[wall];
  const x = wall === 'west' ? p : wall === 'east' ? room.L - p - d : a;
  const y = wall === 'north' ? p : wall === 'south' ? room.W - p - d : a;
  return { ok: true, wall, free, item: { w, d, h, x, y, rot } };
}
