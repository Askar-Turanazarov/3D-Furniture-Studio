// "Find a spot": scan (x, y) with the snap step over 4 rotations.
// Wall-adjacent positions are tried first, then the whole room.
import { footprint, rectOf, blocked, insideRoom } from './geometry.js';

const ROTS = [0, 90, 180, 270];
const MAX_STEPS = 600;   // per axis, keeps big rooms fast

// → { ok: true, x, y, rot } | { ok: false, key, params }
export function findSpot(item, state) {
  const { room, settings } = state;
  const p = room.plinth;
  const Lu = room.L - 2 * p, Wu = room.W - 2 * p;
  const gap = settings.gap;
  const others = state.items.filter(i => i.id !== item.id).map(i => rectOf(i));

  if (item.h > room.H) return { ok: false, key: 'auto.tooTall', params: { n: item.h - room.H } };

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
  const fits = (x, y, rot) => {
    const r = rectOf(item, x, y, rot);
    return insideRoom(r, room) && !blocked(r, others, gap);
  };

  // Pass 1: along the walls.
  for (const rot of rots) {
    const f = footprint(item, rot);
    const xs = axisCandidates(p, room.L - p - f.w, f.w, 'x', others, settings);
    const ys = axisCandidates(p, room.W - p - f.h, f.h, 'y', others, settings);
    const wallY = [p, room.W - p - f.h], wallX = [p, room.L - p - f.w];
    for (const y of wallY) for (const x of xs) if (fits(x, y, rot)) return { ok: true, x, y, rot };
    for (const x of wallX) for (const y of ys) if (fits(x, y, rot)) return { ok: true, x, y, rot };
  }
  // Pass 2: anywhere.
  for (const rot of rots) {
    const f = footprint(item, rot);
    const xs = axisCandidates(p, room.L - p - f.w, f.w, 'x', others, settings);
    const ys = axisCandidates(p, room.W - p - f.h, f.h, 'y', others, settings);
    for (const y of ys) for (const x of xs) if (fits(x, y, rot)) return { ok: true, x, y, rot };
  }

  return explainFailure(item, state, others);
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
