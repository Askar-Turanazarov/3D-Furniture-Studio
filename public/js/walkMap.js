// Walking through an apartment: where a person (a circle of `radius`) may stand, which room that is,
// and how far a ray along the floor goes. Pure, cm, apartment plan coordinates (x right, y down).
// A person moves inside room interiors (minus the plinth) and from room to room through doorways;
// furniture lower than the person and structure block the way, a closed door blocks its doorway.
import { roomRect, doorLinks, wallLine, posOf } from './apartment.js';
import { rectOf, isDecor } from './geometry.js';

const WALLS = ['north', 'south', 'west', 'east'];

/**
 * @param rooms room docs with pos (the active one live)
 * @param opts { radius, personH, feet, doorOpen(roomId, doorId) → bool }
 */
export function walkMap(rooms, { radius = 25, personH = 170, feet = 50, doorOpen = () => true } = {}) {
  const links = doorLinks(rooms).filter(l => l.to !== 'outside');
  const byId = new Map(rooms.map(r => [r.id, r]));
  const inner = rooms.map(r => {
    const b = roomRect(r), p = (r.room.plinth || 0) + radius;
    return { id: r.id, x0: b.x + p, x1: b.x + b.w - p, y0: b.y + p, y1: b.y + b.h - p };
  });

  // Doorway corridors: across both walls and the partition, as wide as the door minus the radius on each side.
  const passages = links.map(l => {
    const a = byId.get(l.room), b = byId.get(l.to), o = a.openings.find(x => x.id === l.door);
    const la = wallLine(a, o.wall), lb = wallLine(b, l.wall);
    const p = Math.max(a.room.plinth || 0, b.room.plinth || 0) + radius + 1;
    const s0 = la.from + o.offset + radius, s1 = la.from + o.offset + o.width - radius;
    const c0 = Math.min(la.at, lb.at) - p, c1 = Math.max(la.at, lb.at) + p;
    const horiz = o.wall === 'north' || o.wall === 'south';     // the wall runs along x
    return {
      room: l.room, door: l.door, to: l.to,
      ...(horiz ? { x0: s0, x1: s1, y0: c0, y1: c1 } : { x0: c0, x1: c1, y0: s0, y1: s1 })
    };
  }).filter(p => p.x1 > p.x0 && p.y1 > p.y0);

  // Footprints on the apartment plan: furniture (not decor) and structure, with their heights.
  const solids = [];
  for (const r of rooms) {
    const { x, y } = posOf(r.pos);
    for (const it of r.items || []) {
      if (isDecor(it)) continue;
      const q = rectOf(it);
      solids.push({ room: r.id, item: it, elev: it.elev || 0, x0: x + q.x, y0: y + q.y, x1: x + q.x + q.w, y1: y + q.y + q.h });
    }
    for (const o of r.obstacles || []) {
      solids.push({ room: r.id, ob: o, elev: o.elev || 0, x0: x + o.x, y0: y + o.y, x1: x + o.x + o.w, y1: y + o.y + o.d });
    }
  }
  const blockers = solids.filter(s => s.elev < personH);

  const inRect = (q, x, y) => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1;
  const passageAt = (x, y) => passages.find(p => inRect(p, x, y)) || null;

  function blocked(x, y) {
    if (blockers.some(s => x > s.x0 - radius && x < s.x1 + radius && y > s.y0 - radius && y < s.y1 + radius)) return true;
    if (inner.some(q => inRect(q, x, y))) return false;
    const p = passageAt(x, y);
    return !p || !doorOpen(p.room, p.door);
  }

  // The doorway with a closed door at this point (the walker pushes it open).
  function closedDoorAt(x, y) {
    if (inner.some(q => inRect(q, x, y))) return null;
    const p = passageAt(x, y);
    return p && !doorOpen(p.room, p.door) ? p : null;
  }

  const roomIdAt = (x, y) => rooms.find(r => {
    const b = roomRect(r);
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  })?.id ?? null;

  // Inner wall faces with the open doorways cut out: { room, wall, horiz, at, from, to, holes: [[s, e]] }.
  function walls() {
    const out = [];
    for (const r of rooms) {
      for (const wall of WALLS) {
        const l = wallLine(r, wall), holes = [];
        for (const k of links) {
          if (k.room === r.id && byId.get(k.room).openings.find(o => o.id === k.door).wall === wall && doorOpen(k.room, k.door)) {
            const o = r.openings.find(x => x.id === k.door);
            holes.push([l.from + o.offset, l.from + o.offset + o.width]);
          }
          if (k.to === r.id && k.wall === wall && doorOpen(k.room, k.door)) holes.push([l.from + k.offset, l.from + k.offset + k.width]);
        }
        out.push({ room: r.id, wall, horiz: wall === 'north' || wall === 'south', at: l.at, from: l.from, to: l.to, holes });
      }
    }
    return out;
  }

  /** First thing a ray from (ox, oy) along (dx, dy) meets at foot level: { d, wall, room } | { d, item } | { d, ob } | null. */
  function ray(ox, oy, dx, dy) {
    let best = null;
    for (const w of walls()) {
      const o = w.horiz ? oy : ox, dv = w.horiz ? dy : dx;
      if (Math.abs(dv) < 1e-9) continue;
      const t = (w.at - o) / dv;
      if (t <= 1e-6 || (best && t >= best.d)) continue;
      const s = w.horiz ? ox + dx * t : oy + dy * t;
      if (s < w.from || s > w.to || w.holes.some(([a, b]) => s > a && s < b)) continue;
      best = { d: t, wall: w.wall, room: w.room };
    }
    for (const s of solids) {
      if (s.elev > feet) continue;   // a shelf does not catch the ray from the feet
      const t = rayBox(ox, oy, dx, dy, s.x0, s.y0, s.x1, s.y1);
      if (t !== null && (!best || t < best.d)) best = s.item ? { d: t, item: s.item, room: s.room } : { d: t, ob: s.ob, room: s.room };
    }
    return best;
  }

  return { blocked, closedDoorAt, roomIdAt, ray, passages };
}

export function rayBox(ox, oz, dx, dz, x0, z0, x1, z1) {
  let tmin = 0, tmax = Infinity;
  for (const [o, d, a, b] of [[ox, dx, x0, x1], [oz, dz, z0, z1]]) {
    if (Math.abs(d) < 1e-9) { if (o < a || o > b) return null; continue; }
    let t1 = (a - o) / d, t2 = (b - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}
