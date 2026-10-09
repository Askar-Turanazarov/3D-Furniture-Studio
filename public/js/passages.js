// Narrow passages between furniture, structure and walls. Pure helpers, cm.
// A passage = the free band between two objects that face each other over ≥ 30 cm.
// 20 ≤ width < minPassage → narrow. Under 20 cm it is a slit ("flush"), not a passage.
import { rectOf, overlaps } from './geometry.js';
import { openSpec, openZoneRect } from './zones.js';

export const MIN_FACING = 30;   // cm the two sides must face each other
export const MIN_GAP = 20;      // narrower is a slit, not a passage
const BODY = 150;               // only objects in the 0–150 cm band block a person

const union = (a, b) => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

// Participants: furniture (with its opening zone) and structure in the body band, plus the walls at the plinth line.
export function participants(state) {
  const { room } = state;
  const p = room.plinth, BIG = 1000;
  const out = [];
  for (const it of state.items) {
    if ((it.elev || 0) >= BODY) continue;
    const zone = openZoneRect(it, openSpec(it, state.catalog));
    out.push({ ref: { itemId: it.id }, r: zone ? union(rectOf(it), zone) : rectOf(it) });
  }
  for (const o of state.obstacles || []) {
    if (o.elev >= BODY) continue;
    out.push({ ref: { kind: o.kind, obId: o.id }, r: { x: o.x, y: o.y, w: o.w, h: o.d } });
  }
  out.push(
    { ref: { wall: 'west' }, r: { x: p - BIG, y: -BIG, w: BIG, h: room.W + 2 * BIG } },
    { ref: { wall: 'east' }, r: { x: room.L - p, y: -BIG, w: BIG, h: room.W + 2 * BIG } },
    { ref: { wall: 'north' }, r: { x: -BIG, y: p - BIG, w: room.L + 2 * BIG, h: BIG } },
    { ref: { wall: 'south' }, r: { x: -BIG, y: room.W - p, w: room.L + 2 * BIG, h: BIG } }
  );
  return out;
}

// → [{ x, y, w, h, n, a, b }] — the band between a and b (refs), n = its width.
export function narrowPassages(state) {
  const min = state.settings.minPassage || 60;
  const list = participants(state);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j];
      if (A.ref.wall && B.ref.wall) continue;
      for (const axis of ['x', 'y']) {
        const band = between(A.r, B.r, axis);
        if (!band || band.n < MIN_GAP || band.n >= min) continue;
        // Something else stands in the band → these two do not form the passage.
        if (list.some((C, k) => k !== i && k !== j && overlaps(C.r, band))) continue;
        out.push({ ...band, a: A.ref, b: B.ref });
      }
    }
  }
  return out;
}

// Free band between two rects along an axis, if their sides face each other over ≥ MIN_FACING.
function between(a, b, axis) {
  const X = axis === 'x';
  const [a0, a1, b0, b1] = X ? [a.y, a.y + a.h, b.y, b.y + b.h] : [a.x, a.x + a.w, b.x, b.x + b.w];
  const lo = Math.max(a0, b0), hi = Math.min(a1, b1);
  if (hi - lo < MIN_FACING) return null;
  const [s0, s1, t0, t1] = X ? [a.x, a.x + a.w, b.x, b.x + b.w] : [a.y, a.y + a.h, b.y, b.y + b.h];
  let from, to;
  if (s1 <= t0) { from = s1; to = t0; } else if (t1 <= s0) { from = t1; to = s0; } else return null;
  const n = Math.round((to - from) * 10) / 10;
  return X ? { x: from, y: lo, w: to - from, h: hi - lo, n, axis } : { x: lo, y: from, w: hi - lo, h: to - from, n, axis };
}
