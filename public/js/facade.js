// Facade of a building from its real apartment plans (no three.js, tested): every window of every apartment
// on the outer wall it is in, the glazed ground floor and the entrance. Coordinates in cm.
// Sides: north (y = 0), south (y = W), west (x = 0), east (x = L). Along a side, `x` is the floor-plan x for
// north/south and the floor-plan y for west/east. Floor n stands at y = (n − 1) · level.
import { roomRect } from './apartment.js';

export const SLAB = 20;            // floor slab between storeys, cm
const EDGE = 2;                    // a room wall closer than this to the section edge is on the facade
const SHOP = { pitch: 300, glass: 260, sill: 0, h: 250 };   // ground-floor shop windows
const DOOR_W = 220;                // entrance doors
const PART = 10;                   // partition between the core and the entrance passage

export const SIDES = ['north', 'south', 'west', 'east'];
export const sideLength = (section, side) => (side === 'north' || side === 'south' ? section.L : section.W);

// Which facade a room wall lies on (null for inner walls). q = room rect on the floor plan.
function facadeSide(wall, q, { L, W }) {
  if (wall === 'north' && q.y <= EDGE) return 'north';
  if (wall === 'south' && q.y + q.h >= W - EDGE) return 'south';
  if (wall === 'west' && q.x <= EDGE) return 'west';
  if (wall === 'east' && q.x + q.w >= L - EDGE) return 'east';
  return null;
}

// Glass bays along [x0, x1]: every `pitch` cm, centred; the strip [skip0, skip1] stays free (the entrance).
function strip(list, base, side, x0, x1, skip = null) {
  const n = Math.floor((x1 - x0) / SHOP.pitch);
  const pad = (x1 - x0 - n * SHOP.pitch) / 2;
  for (let i = 0; i < n; i++) {
    const c = x0 + pad + (i + 0.5) * SHOP.pitch;
    const b0 = c - SHOP.glass / 2, b1 = c + SHOP.glass / 2;
    if (skip && b1 > skip[0] && b0 < skip[1]) continue;
    list.push({ ...base, side, x0: b0, x1: b1, sill: SHOP.sill, h: SHOP.h });
  }
}

/**
 * building → { floors, H, level, L, W, bays, spans, entrance }.
 * bays: [{ floor, side, x0, x1, sill, h, kind: 'window' | 'lobby' | 'shop', aptNo, purpose }] — glass on the facade.
 * spans: [{ floor, side, x0, x1, aptNo }] — the part of a side each apartment occupies (for picking).
 * entrance: { side, x0, x1, h } — the doors into the lobby, opposite the lift core.
 */
export function facadeOf(bld) {
  const { L, W, H = 280 } = bld.section;
  const level = H + SLAB;
  const bays = [], spans = [];
  for (const f of bld.floorsData) {
    for (const a of f.apartments || []) {
      const ext = {};
      for (const r of a.plan) {
        const p = roomRect(r), q = { x: a.at.x + p.x, y: a.at.y + p.y, w: p.w, h: p.h };
        for (const side of SIDES) {
          if (!facadeSide(side, q, { L, W })) continue;   // the room has a wall on this facade
          const [s0, s1] = side === 'north' || side === 'south' ? [q.x, q.x + q.w] : [q.y, q.y + q.h];
          const e = ext[side] ||= [Infinity, -Infinity];
          e[0] = Math.min(e[0], s0);
          e[1] = Math.max(e[1], s1);
        }
        for (const o of r.openings || []) {
          if (o.kind !== 'window') continue;
          const side = facadeSide(o.wall, q, { L, W });
          if (!side) continue;
          const at = side === 'north' || side === 'south' ? q.x : q.y;
          bays.push({ floor: f.n, side, x0: at + o.offset, x1: at + o.offset + o.width, sill: o.sill ?? 80, h: o.height ?? 150,
            kind: 'window', aptNo: a.no, purpose: r.purpose || null });
        }
      }
      for (const [side, [x0, x1]] of Object.entries(ext)) spans.push({ floor: f.n, side, x0, x1, aptNo: a.no });
    }
  }
  // Ground floor: shop fronts all round the commercial units, glass lobby, entrance doors facing the core.
  const ground = bld.floorsData.find(f => f.n === 1);
  const core = bld.core || { x: L / 2 - 250, w: 500 };
  // The street doors open into the passage east of the lift core (the lobby wraps around the core).
  const lobby = ground?.lobby;
  const mid = lobby && bld.core ? (core.x + core.w + PART + lobby.x + lobby.w) / 2 : core.x + core.w / 2;
  const entrance = { side: 'south', x0: mid - DOOR_W / 2, x1: mid + DOOR_W / 2, h: 240 };
  if (ground) {
    for (const c of ground.commercial || []) {
      const base = { floor: 1, kind: 'shop', aptNo: null, purpose: null };
      strip(bays, base, 'north', c.x, c.x + c.w);
      strip(bays, base, 'south', c.x, c.x + c.w);
      if (c.x <= EDGE) strip(bays, base, 'west', c.y, c.y + c.h);
      if (c.x + c.w >= L - EDGE) strip(bays, base, 'east', c.y, c.y + c.h);
    }
    if (ground.lobby) {
      const { x, w } = ground.lobby, base = { floor: 1, kind: 'lobby', aptNo: null, purpose: null };
      strip(bays, base, 'north', x, x + w);
      strip(bays, base, 'south', x, x + w, [entrance.x0 - 20, entrance.x1 + 20]);
    }
  }
  return { floors: bld.floors || bld.floorsData.length, H, level, L, W, bays, spans, entrance };
}

/** The apartment at a point of a facade side (x along the side), or null. */
export function apartmentAt(fac, floor, side, x) {
  return fac.spans.find(s => s.floor === floor && s.side === side && x >= s.x0 && x <= s.x1)?.aptNo ?? null;
}

/** The floor at a height (cm from the ground), 1 … floors, or null outside the building. */
export function floorAt(fac, y) {
  const n = Math.floor(y / fac.level) + 1;
  return n >= 1 && n <= fac.floors ? n : null;
}
