// Pure geometry helpers. All values in cm; origin = inner top-left corner of the room.

// Footprint on the plan: at 0/180 width runs along X, at 90/270 the sides swap.
export function footprint(item, rot = item.rot) {
  return rot % 180 === 0 ? { w: item.w, h: item.d } : { w: item.d, h: item.w };
}

export function rectOf(item, x = item.x, y = item.y, rot = item.rot) {
  const f = footprint(item, rot);
  return { x, y, w: f.w, h: f.h };
}

// Positive-area intersection (touching edges is not an overlap).
export function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// Clearance between two non-overlapping AABBs (largest axis separation).
export function clearance(a, b) {
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
  return Math.max(dx, dy);
}

// Walls crossed by a rect given the plinth inset → [{ wall, n }]
export function wallViolations(r, room) {
  const p = room.plinth;
  const out = [];
  const west = p - r.x;
  const east = r.x + r.w - (room.L - p);
  const north = p - r.y;
  const south = r.y + r.h - (room.W - p);
  if (west > 1e-6) out.push({ wall: 'west', n: round1(west) });
  if (east > 1e-6) out.push({ wall: 'east', n: round1(east) });
  if (north > 1e-6) out.push({ wall: 'north', n: round1(north) });
  if (south > 1e-6) out.push({ wall: 'south', n: round1(south) });
  return out;
}

export function insideRoom(r, room) {
  const p = room.plinth;
  return r.x >= p - 1e-6 && r.y >= p - 1e-6 &&
         r.x + r.w <= room.L - p + 1e-6 && r.y + r.h <= room.W - p + 1e-6;
}

// True when rect r collides with any rect in others (incl. gap clearance).
export function blocked(r, others, gap) {
  for (const o of others) {
    if (overlaps(r, o)) return true;
    if (gap > 0 && clearance(r, o) < gap - 1e-6) return true;
  }
  return false;
}

export const round1 = v => Math.round(v * 10) / 10;

// Dimension lines from each side of rect r to the nearest obstacle (furniture or wall).
// If a neighbour covers only part of the side, the rest of that side is measured further
// (to the next item or the wall). → [{ x1, y1, x2, y2, d, kind: 'item' | 'wall' }]
export function rayGaps(r, others, room) {
  const out = [];
  const sides = [
    // axis: along which we measure; s0/s1: side span on the other axis; dir: −1 towards 0, +1 towards L/W
    { axis: 'x', dir: -1, edge: r.x, s0: r.y, s1: r.y + r.h, wall: 0 },
    { axis: 'x', dir: 1, edge: r.x + r.w, s0: r.y, s1: r.y + r.h, wall: room.L },
    { axis: 'y', dir: -1, edge: r.y, s0: r.x, s1: r.x + r.w, wall: 0 },
    { axis: 'y', dir: 1, edge: r.y + r.h, s0: r.x, s1: r.x + r.w, wall: room.W }
  ];
  const cands = others.filter(o => !overlaps(r, o));
  for (const s of sides) scanSide(s, s.s0, s.s1, cands, out, 0);
  return out;
}

function scanSide(s, a, b, cands, out, depth) {
  const X = s.axis === 'x';
  // Distance from the side to an obstacle in the corridor [a, b] (perpendicular span).
  let best = null, bestD = Infinity;
  for (const o of cands) {
    const [p0, p1] = X ? [o.y, o.y + o.h] : [o.x, o.x + o.w];
    if (p0 >= b - 1e-6 || p1 <= a + 1e-6) continue;
    const [n0, n1] = X ? [o.x, o.x + o.w] : [o.y, o.y + o.h];
    const d = s.dir < 0 ? s.edge - n1 : n0 - s.edge;
    if (d < -1e-6) continue;
    if (d < bestD) { bestD = d; best = { o, lo: Math.max(a, p0), hi: Math.min(b, p1) }; }
  }
  const line = (mid, d, kind) => {
    const far = s.edge + s.dir * d;
    out.push(X ? { x1: s.edge, y1: mid, x2: far, y2: mid, d, kind }
               : { x1: mid, y1: s.edge, x2: mid, y2: far, d, kind });
  };
  if (!best) { line((a + b) / 2, Math.abs(s.wall - s.edge), 'wall'); return; }
  line((best.lo + best.hi) / 2, bestD, 'item');
  if (depth >= 2) return;
  // The longest part of the side not covered by this neighbour is measured further.
  const rest = [[a, best.lo], [best.hi, b]].filter(([u, v]) => v - u > 1e-6).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
  if (rest.length) scanSide(s, rest[0][0], rest[0][1], cands.filter(o => o !== best.o), out, depth + 1);
}
