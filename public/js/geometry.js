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
