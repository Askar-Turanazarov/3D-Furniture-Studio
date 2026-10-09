// Ruler tool: measurements on the plan (view-only, not saved, not in undo history).
export const ruler = {
  active: false,
  a: null,          // first point of the measurement in progress
  hover: null,      // { x, y, snapX, snapY } under the cursor
  measures: []      // [{ a: {x, y}, b: {x, y} }]
};

// Lines a ruler point sticks to: walls, plinth line, edges of items (and later obstacles).
export function snapLines(room, rects) {
  const p = room.plinth || 0;
  const xs = [0, room.L, p, room.L - p];
  const ys = [0, room.W, p, room.W - p];
  for (const r of rects) {
    xs.push(r.x, r.x + r.w);
    ys.push(r.y, r.y + r.h);
  }
  return { xs, ys };
}

// Each axis snaps independently, so a corner snaps both coordinates; on a tie the earlier line
// (wall before plinth) wins. Free values round to 1 cm.
export function snapPoint(x, y, { xs, ys }, tol) {
  const near = (v, list) => {
    let best = null, d = tol;
    for (const c of list) if (Math.abs(v - c) < d) { best = c; d = Math.abs(v - c); }
    return best;
  };
  const sx = near(x, xs), sy = near(y, ys);
  return { x: sx ?? Math.round(x), y: sy ?? Math.round(y), snapX: sx !== null, snapY: sy !== null };
}

// Shift: keep only the dominant direction from A.
export function lockAxis(a, p) {
  return Math.abs(p.x - a.x) >= Math.abs(p.y - a.y) ? { ...p, y: a.y } : { ...p, x: a.x };
}

export function measure(a, b) {
  const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
  return { len: Math.hypot(dx, dy), dx, dy };
}
