// Moving furniture without collisions: what a drag, the arrow keys or a rotation may not cross — the walls with the
// plinth, other items at the same height, structure, door leaves and doorways. The minimum gap is only a warning
// (validate.js) and does not stop a move. An item that already stands badly (resized room, typed size, loaded
// project) moves freely until it reaches a legal spot, so it never gets stuck.
import { rectOf, footprint, overlaps, zOverlaps, isDecor, wallViolations } from './geometry.js';
import { leafDoors, doorwaysOf } from './apartment.js';
import { doorSwingRect, doorwayRect } from './openings.js';

const ROTS = [0, 90, 180, 270];

/** Rects the item may not overlap: [{ r, err: { key, params } }]; skip — items moving together with it. */
export function blockers(item, state, skip = new Set()) {
  if (isDecor(item)) return [];     // a rug lies under the furniture
  const elev = item.elev || 0, out = [];
  for (const o of state.items) {
    if (o === item || o.id === item.id || skip.has(o) || isDecor(o) || !zOverlaps(o, item)) continue;
    out.push({ r: rectOf(o), err: { key: 'err.overlap', params: { otherId: o.id } } });
  }
  for (const ob of state.obstacles || []) {
    if (zOverlaps(ob, item)) out.push({ r: { x: ob.x, y: ob.y, w: ob.w, h: ob.d }, err: { key: 'err.obstacle', params: { kind: ob.kind } } });
  }
  for (const d of leafDoors(state)) {
    if (elev < d.height) out.push({ r: doorSwingRect(d, state.room), err: { key: 'err.door', params: {} } });
  }
  for (const d of doorwaysOf(state)) {
    if (elev < d.height) out.push({ r: doorwayRect(d, state.room), err: { key: 'err.doorway', params: { room: d.fromName } } });
  }
  return out;
}

/** Why the item may not stand at rect (the first reason), or null. */
export function conflict(item, rect, state, list = blockers(item, state)) {
  const w = wallViolations(rect, state.room)[0];
  if (w) return { key: 'err.wall', params: { wall: w.wall, n: w.n } };
  return list.find(b => overlaps(rect, b.r))?.err || null;
}

// From a legal rect along one axis towards `to`: stops flush at the plinth line or at the first blocker in its lane.
function sweep(rect, axis, to, room, list) {
  const [pos, size, cross, csize, lim] = axis === 'x' ? ['x', 'w', 'y', 'h', room.L] : ['y', 'h', 'x', 'w', room.W];
  const p = room.plinth, from = rect[pos];
  let v = Math.max(p, Math.min(lim - p - rect[size], to));
  for (const { r: o } of list) {
    if (!(rect[cross] < o[cross] + o[csize] - 1e-6 && o[cross] < rect[cross] + rect[csize] - 1e-6)) continue;
    if (v > from && o[pos] >= from + rect[size] - 1e-6 && o[pos] < v + rect[size]) v = o[pos] - rect[size];
    else if (v < from && o[pos] + o[size] <= from + 1e-6 && o[pos] + o[size] > v) v = o[pos] + o[size];
  }
  return v;
}

/**
 * Move the item towards (tx, ty) as far as the rules allow: the whole way if the target is free, otherwise it slides
 * along the wall / the neighbour and stops flush against it (no jumping through a blocker on the way).
 * → { x, y, blocked, reason, free } — reason: why the target itself is not allowed; free: the start was not legal.
 */
export function moveTo(item, tx, ty, state, { skip = new Set(), from = item } = {}) {
  const list = blockers(item, state, skip), f = footprint(item);
  const reason = conflict(item, { x: tx, y: ty, w: f.w, h: f.h }, state, list);
  if (!reason) return { x: tx, y: ty, blocked: false, reason: null, free: false };
  const r = { x: from.x, y: from.y, w: f.w, h: f.h };
  if (conflict(item, r, state, list)) return { x: tx, y: ty, blocked: false, reason, free: true };
  const order = Math.abs(tx - r.x) >= Math.abs(ty - r.y) ? ['x', 'y'] : ['y', 'x'];
  for (const a of order) r[a] = sweep(r, a, a === 'x' ? tx : ty, state.room, list);
  return { x: r.x, y: r.y, blocked: true, reason, free: false };
}

/**
 * Shift several items together by (dx, dy): each one is limited by the rules (ignoring the others of the group),
 * the group takes the smallest allowed shift on each axis. → { dx, dy, reason }
 */
export function moveGroup(items, dx, dy, state) {
  const skip = new Set(items);
  let ax = dx, ay = dy, reason = null;
  for (const it of items) {
    const m = moveTo(it, it.x + dx, it.y + dy, state, { skip });
    if (m.free) continue;
    reason ||= m.reason;
    if (Math.abs(m.x - it.x) < Math.abs(ax)) ax = m.x - it.x;
    if (Math.abs(m.y - it.y) < Math.abs(ay)) ay = m.y - it.y;
  }
  // The two axes were limited separately: make sure the combined shift is still allowed.
  const ok = (sx, sy) => items.every(it => {
    const f = footprint(it), list = blockers(it, state, skip);
    return !conflict(it, { x: it.x + sx, y: it.y + sy, w: f.w, h: f.h }, state, list)
      || !!conflict(it, { x: it.x, y: it.y, w: f.w, h: f.h }, state, list);
  });
  if (!ok(ax, ay)) [ax, ay] = ok(ax, 0) ? [ax, 0] : ok(0, ay) ? [0, ay] : [0, 0];
  return { dx: ax, dy: ay, reason };
}

/**
 * Turn the item by 90° about its centre; if it does not fit there, the nearest free spot within `reach` cm.
 * → { ok: true, x, y, rot } | { ok: false, reason }
 */
export function rotateLegal(item, state, { snap = state.settings?.snap || 5, reach = 30, round = v => v } = {}) {
  const rot = ROTS[(ROTS.indexOf(item.rot) + 1) % 4];
  const b = footprint(item), a = footprint(item, rot);
  const cx = item.x + b.w / 2, cy = item.y + b.h / 2;
  const x0 = round(cx - a.w / 2), y0 = round(cy - a.h / 2);
  const turned = { ...item, rot };
  const list = blockers(turned, state);
  const at = (x, y) => conflict(turned, { x, y, w: a.w, h: a.h }, state, list);
  // Standing badly already: turn as before.
  if (conflict(item, rectOf(item), state, blockers(item, state))) return { ok: true, x: x0, y: y0, rot };
  const reason = at(x0, y0);
  if (!reason) return { ok: true, x: x0, y: y0, rot };
  const step = Math.max(1, snap);
  for (let d = step; d <= reach; d += step) {
    for (let i = -d; i <= d; i += step) {
      for (const [ox, oy] of [[i, -d], [i, d], [-d, i], [d, i]]) {
        if (!at(x0 + ox, y0 + oy)) return { ok: true, x: x0 + ox, y: y0 + oy, rot };
      }
    }
  }
  return { ok: false, reason };
}
