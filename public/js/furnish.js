// "🎲 Furnish": put a furniture kit (kits.js) into a room. Pure, cm; the same seed gives the same room.
// Anchors go first along free wall runs (clear of doors, doorways, windows and structure), dependents
// next to them; every placement is checked with validateAll, "find a spot" is the fallback.
import { footprint, rectOf, overlaps, zOverlaps, isDecor, blocked, insideRoom, obstacleRects } from './geometry.js';
import { windowZoneRect, wallLen, WALLS } from './openings.js';
import { doorZones, doorwaysOf } from './apartment.js';
import { validateAll } from './validate.js';
import { findSpot } from './autoplace.js';
import { KITS, PALETTES } from './kits.js';

const WALL_ROT = { north: 0, east: 90, south: 180, west: 270 };
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };
// Along the back (u) and to the front (n) of an item at each rotation (front: 0 → +Y, 90 → −X, 180 → −Y, 270 → +X).
const U = { 0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1] };
const N = { 0: [0, 1], 90: [-1, 0], 180: [0, -1], 270: [1, 0] };
const WINDOW_LOW = 15;      // a counter may reach this much above a sill
const CURTAIN_MARGIN = 20;  // curtains wider than the window on each side
const FABRIC = new Set(['sofa', 'armchair', 'cornersofa', 'pouf']);
const WOOD_CATS = new Set(['storage', 'beds', 'tables', 'hall']);

/** Kits of a purpose; with a room only those whose minimal size fits (all of them when none does). */
export function kitsFor(purpose, room) {
  const all = KITS.filter(k => k.purpose === purpose);
  if (!room) return all;
  const fit = all.filter(k => kitFits(k, room));
  return fit.length ? fit : all;
}

// Within the kit's min (and max for compact kits): [short side, long side].
export const kitFits = (kit, room) => {
  const [s, l] = [room.L, room.W].sort((a, b) => a - b);
  return s >= kit.min[0] && l >= kit.min[1] && (!kit.max || (s <= kit.max[0] && l <= kit.max[1]));
};

// Small seeded PRNG (mulberry32).
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param view room in the single-room shape: { room, items, openings, obstacles, doorways?, settings, catalog, seq }
 * @param kit  one of KITS
 * @returns { items (the room's items plus the new ones), seq, skipped: [type], palette }
 */
export function furnish(view, kit, { seed = 1, catalog = view.catalog || [], tries = 8 } = {}) {
  // A mandatory item may not fit next to an anchor the seed made too big: retry with derived seeds, keep the best.
  let best = null;
  for (let k = 0; k < tries; k++) {
    const res = attempt(view, kit, (seed + k * 7919) >>> 0, catalog);
    if (!best || res.skipped.length < best.skipped.length) best = res;
    if (!best.skipped.length) break;
  }
  return best;
}

function attempt(view, kit, seed, catalog) {
  const rnd = rng(seed);
  const pick = list => list[Math.floor(rnd() * list.length)];
  const shuffle = list => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const { room, settings } = view;
  const p = room.plinth;
  const gap = settings.gap || 0;
  const items = [...(view.items || [])];
  let seq = Math.max(view.seq || 1, ...items.map(i => i.id + 1));
  const placed = new Map();   // key → [item]
  const skipped = [];
  const palette = pick(PALETTES);
  const doorways = doorwaysOf(view);
  const windows = (view.openings || []).filter(o => o.kind === 'window');
  const st = { ...view, catalog, items, doorways };

  // Wall categories (walls in each one shuffled by the seed).
  const info = WALLS.map(w => ({
    wall: w, len: wallLen(w, room),
    win: windows.some(o => o.wall === w),
    door: (view.openings || []).some(o => o.kind === 'door' && o.wall === w) || doorways.some(d => d.wall === w)
  }));
  const maxLen = Math.max(...info.map(i => i.len)), minLen = Math.min(...info.map(i => i.len));
  const CATS = {
    long: i => i.len === maxLen, short: i => i.len === minLen, window: i => i.win, blank: i => !i.win && !i.door,
    noWindow: i => !i.win, door: i => i.door, opposite: i => !i.win && info.some(j => j.win && OPPOSITE[j.wall] === i.wall),
    any: () => true
  };
  const wallsOf = cats => {
    const out = [];
    for (const c of cats) for (const i of shuffle(info.filter(CATS[c] || CATS.any))) if (!out.includes(i.wall)) out.push(i.wall);
    return out;
  };

  for (const raw of kit.items) {
    let spec = raw;
    if (raw.oneOf) spec = { ...raw, ...pick(raw.oneOf) };
    if (spec.optional != null && rnd() >= spec.optional) continue;
    const c = catalog.find(x => x.type === spec.type);
    if (!c) continue;
    const want = Array.isArray(spec.count) ? spec.count[0] + Math.floor(rnd() * (spec.count[1] - spec.count[0] + 1)) : spec.count || 1;
    const got = placeSpec(spec, c, want);
    if (spec.key && got.length) placed.set(spec.key, got);
    // Not reported: optional items, and dependents whose anchor is not there (chairs of a skipped table).
    const orphan = (spec.at || []).every(r => r.rel && !placed.has(r.to));
    if (!got.length && spec.optional == null && !orphan) skipped.push(spec.type);
  }
  return { items, seq, skipped, palette: palette.id };

  // ---- one spec: sizes from the seeded one down, rules in order, then "find a spot" ----
  function placeSpec(spec, c, want) {
    const out = [];
    for (const w of widths(spec, c)) {
      for (const rule of spec.at || []) {
        if (rule.window) {
          for (const o of windows) { const it = curtainOn(o, spec, c); if (it && ok(it)) out.push(add(it)); }
          if (out.length) return out;
          continue;
        }
        // A table: of the first good spots, the one with room for the most chairs around it.
        const seats = spec.key && kit.items.find(x => x.at?.some(r => r.rel === 'around' && r.to === spec.key));
        if (seats && !rule.rel) {
          const best = bestForSeats(candidates(rule, spec, c, w), seats);
          if (best) return [add(best)];
          continue;
        }
        for (const cand of candidates(rule, spec, c, w)) {
          if (!ok(cand)) continue;
          out.push(add(cand));
          const n = rule.rel === 'both' ? Math.max(want, 2) : want;   // a pair of nightstands by default
          if (out.length >= n || (rule.rel !== 'both' && rule.rel !== 'around' && rule.rel !== 'flank')) return out;
        }
        if (out.length) return out;
      }
      if (spec.fallback !== false) {
        const it = make(spec, c, w, p, p, 0);
        const s = findSpot(it, st);
        if (s.ok) {
          Object.assign(it, { x: s.x, y: s.y, rot: s.rot });
          if (ok(it)) return [add(it)];
        }
      }
    }
    return out;
  }

  function bestForSeats(cands, seats) {
    const sc = catalog.find(x => x.type === seats.type);
    const rule = seats.at.find(r => r.rel === 'around');
    const want = Array.isArray(seats.count) ? seats.count[1] : seats.count || 1;
    let best = null, bestN = -1, tried = 0;
    for (const cand of cands) {
      if (!ok(cand)) continue;
      items.push(cand);
      let n = 0;
      const tmp = [];
      for (const ch of relSpots(rule, cand, seats, sc, sc.w)) {
        if (n >= want) break;
        if (ok(ch)) { n++; items.push(ch); tmp.push(ch); }
      }
      items.length -= tmp.length + 1;
      if (n > bestN) { best = cand; bestN = n; }
      if (n >= want || ++tried >= 40) break;
    }
    return best;
  }

  function widths(spec, c) {
    if (!Array.isArray(spec.w)) return [spec.w ?? c.w];
    const [a, b] = spec.w, step = settings.snap || 5;
    const first = a + Math.round(rnd() * (b - a) / step) * step;
    const out = [first];
    for (let w = first - 10; w >= a; w -= 10) out.push(w);
    if (!out.includes(a)) out.push(a);
    return out;
  }

  function make(spec, c, w, x, y, rot) {
    const elev = spec.elev ?? c.elev ?? 0;
    const it = { id: 0, type: spec.type, w, d: spec.d ?? c.d, h: Math.min(spec.h ?? c.h, room.H - elev), x, y, rot, color: c.color };
    if (elev > 0) it.elev = elev;
    if (c.layer) it.layer = c.layer;
    const role = c.cat === 'kitchen' && c.facade ? 'kitchen' : FABRIC.has(c.type) ? 'fabric' : WOOD_CATS.has(c.cat) ? 'wood' : null;
    if (role) {
      it.materials = { body: palette[role === 'kitchen' ? 'facade' : role] };
      if (c.facade) it.materials.facade = palette[role === 'kitchen' ? 'kitchen' : 'facade'];
    }
    return it;
  }

  function add(it) {
    it.id = seq++;
    items.push(it);
    return it;
  }

  // Free of walls, doors, doorways, structure, the windows (above a counter) and other items; then no errors at all.
  function ok(it) {
    const r = rectOf(it);
    if (!insideRoom(r, room)) return false;
    if (!isDecor(it)) {
      const elev = it.elev || 0, top = elev + it.h;
      const others = items.filter(o => !isDecor(o) && zOverlaps(o, it)).map(o => rectOf(o));
      if (blocked(r, others, gap)) return false;
      if (doorZones(st, elev).some(z => overlaps(r, z))) return false;
      if (obstacleRects(view.obstacles, it).some(z => overlaps(r, z))) return false;
      if (windows.some(o => top > o.sill + WINDOW_LOW && elev < o.sill + o.height && overlaps(r, windowZoneRect(o, room)))) return false;
    }
    const errs = validateAll({ ...st, items: [...items, it] });
    for (const e of errs.values()) if (e.length) return false;
    return true;
  }

  // ---- candidate positions of a rule ----
  function candidates(rule, spec, c, w) {
    if (rule.wall) {
      const align = rule.align || (rnd() < 0.5 ? 'center' : 'corner');
      return wallsOf(rule.wall).flatMap(wall => alongWall(wall, make(spec, c, w, 0, 0, WALL_ROT[wall]), align));
    }
    if (rule.free) return freeSpots(make(spec, c, w, 0, 0, 0));
    if (rule.rel) {
      const targets = placed.get(rule.to);
      if (!targets) return [];
      return relSpots(rule, targets[0], spec, c, w);
    }
    return [];
  }

  // Back to the wall, positions along it in the order of `align` (target: a point along the wall).
  function alongWall(wall, it, align, target) {
    const f = footprint(it, it.rot);
    const horiz = wall === 'north' || wall === 'south';
    const size = horiz ? f.w : f.h, len = wallLen(wall, room);
    const lo = p, hi = len - p - size;
    if (hi < lo - 1e-6) return [];
    const step = settings.snap || 5;
    const set = new Set([lo, hi]);
    for (let v = lo; v <= hi; v += step) set.add(v);
    // Right next to what is already there.
    for (const o of items) {
      if (isDecor(o)) continue;
      const r = rectOf(o), [s, l] = horiz ? [r.x, r.w] : [r.y, r.h];
      for (const v of [s + l + gap + 2, s - gap - 2 - size]) if (v >= lo && v <= hi) set.add(Math.round(v));
    }
    let key;
    if (target != null) key = v => Math.abs(v + size / 2 - target);
    else if (align === 'window') {
      const o = windows.find(x => x.wall === wall);
      const mid = o ? o.offset + o.width / 2 : len / 2;
      key = v => Math.abs(v + size / 2 - mid);
    } else if (align === 'corner') key = v => Math.min(v - lo, hi - v);
    else key = v => Math.abs(v + size / 2 - len / 2);
    return [...set].sort((a, b) => key(a) - key(b)).map(v => {
      const x = horiz ? v : wall === 'west' ? p : room.L - p - f.w;
      const y = horiz ? (wall === 'north' ? p : room.W - p - f.h) : v;
      return { ...it, x, y };
    });
  }

  // Anywhere, the middle of the room first (a little jitter from the seed), long side along the room.
  function freeSpots(it) {
    const out = [];
    const rots = room.L >= room.W ? [0, 90] : [90, 0];
    const jx = (rnd() - 0.5) * room.L * 0.2, jy = (rnd() - 0.5) * room.W * 0.2;
    for (const rot of rots) {
      const f = footprint(it, rot);
      for (let x = p; x <= room.L - p - f.w; x += 10) {
        for (let y = p; y <= room.W - p - f.h; y += 10) out.push({ ...it, x, y, rot, k: Math.hypot(x + f.w / 2 - room.L / 2 - jx, y + f.h / 2 - room.W / 2 - jy) });
      }
    }
    return out.sort((a, b) => a.k - b.k).map(({ k, ...o }) => o);
  }

  // Next to a placed item, in its own frame: a along its back (0…w), b from the back to the front (0…d).
  function relSpots(rule, t, spec, c, w) {
    const g = rule.gap < 0 ? rule.gap : Math.max(rule.gap ?? 5, gap + 2);
    const at = (relRot, a0, b0) => {
      const it = make(spec, c, w, 0, 0, (t.rot + relRot) % 360);
      const [ca, cb] = relRot % 180 === 0 ? [it.w, it.d] : [it.d, it.w];
      const [a, b] = [a0(ca), b0(cb)];
      const r = frameRect(t, a, a + ca, b, b + cb);
      return { ...it, x: Math.round(r.x), y: Math.round(r.y) };
    };
    const mid = ca => (t.w - ca) / 2;
    const back = () => 0;
    switch (rule.rel) {
      case 'left': return [at(0, ca => -g - ca, back)];
      case 'right': return [at(0, () => t.w + g, back)];
      case 'both': return shuffle([at(0, ca => -g - ca, back), at(0, () => t.w + g, back)]);
      case 'above': return [at(0, mid, back)];
      case 'front': return [at(rule.turn || 0, mid, () => t.d + g)];
      case 'toward': return [at(180, mid, () => t.d + g)];
      case 'under': return [at(rule.turn || 0, mid, cb => (t.d - cb) / 2)];
      case 'flank': return shuffle([at(270, ca => -g - ca, cb => (t.d - cb) / 2), at(90, () => t.w + g, cb => (t.d - cb) / 2)]);
      case 'around': return aroundSlots(t, rule, g, at);
      case 'facing': {
        const n = N[t.rot];
        const wall = n[1] > 0 ? 'south' : n[1] < 0 ? 'north' : n[0] < 0 ? 'west' : 'east';
        const r = rectOf(t);
        const horiz = wall === 'north' || wall === 'south';
        return alongWall(wall, make(spec, c, w, 0, 0, WALL_ROT[wall]), 'center', horiz ? r.x + r.w / 2 : r.y + r.h / 2).slice(0, 40);   // within ~1 m of the centre line
      }
    }
    return [];
  }

  // Chairs around a table: in front and behind (facing it), then at the ends.
  function aroundSlots(t, rule, g, at) {
    const it = { w: 45 };   // a typical seat width for the spacing
    const n = Math.max(1, Math.floor((t.w + 10) / (it.w + 15)));
    const centers = Array.from({ length: n }, (_, i) => (t.w * (i + 0.5)) / n);
    const front = centers.map(m => at(180, ca => m - ca / 2, () => t.d + g));
    const behind = centers.map(m => at(0, ca => m - ca / 2, cb => -g - cb));
    const out = [];
    for (let i = 0; i < n; i++) {
      if (rule.sides !== 'back') out.push(front[i]);
      if (rule.sides !== 'front') out.push(behind[i]);
    }
    if (!rule.sides) out.push(at(270, ca => -g - ca, cb => (t.d - cb) / 2), at(90, () => t.w + g, cb => (t.d - cb) / 2));
    return out;
  }

  // Curtains on a window: as wide as the window plus margins, within the wall.
  function curtainOn(o, spec, c) {
    const len = wallLen(o.wall, room);
    const a = Math.max(p, o.offset - CURTAIN_MARGIN), b = Math.min(len - p, o.offset + o.width + CURTAIN_MARGIN);
    const it = make(spec, c, Math.round(b - a), 0, 0, WALL_ROT[o.wall]);
    const f = footprint(it, it.rot);
    const horiz = o.wall === 'north' || o.wall === 'south';
    it.x = horiz ? a : o.wall === 'west' ? p : room.L - p - f.w;
    it.y = horiz ? (o.wall === 'north' ? p : room.W - p - f.h) : a;
    return it;
  }
}

// Plan rect of a box given in an item's frame (a along U, b along N from its back-left corner).
function frameRect(t, a0, a1, b0, b1) {
  const r = rectOf(t), u = U[t.rot], n = N[t.rot];
  const o = t.rot === 90 ? [r.x + r.w, r.y] : t.rot === 180 ? [r.x + r.w, r.y + r.h] : t.rot === 270 ? [r.x, r.y + r.h] : [r.x, r.y];
  const xs = [], ys = [];
  for (const a of [a0, a1]) for (const b of [b0, b1]) { xs.push(o[0] + a * u[0] + b * n[0]); ys.push(o[1] + a * u[1] + b * n[1]); }
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
