// Validate every item: walls (with plinth), AABB overlap, min gap, ceiling height, door swing.
import { rectOf, wallViolations, overlaps, clearance, round1, zOverlaps, zRange } from './geometry.js';
import { doorSwingRect, windowZoneRect } from './openings.js';
import { openSpec, openZoneRect, freeDepth, wallDepth } from './zones.js';
import { narrowPassages } from './passages.js';

// → Map<itemId, [{ key, params }]>
export function validateAll(state) {
  const { room, settings, items } = state;
  const result = new Map(items.map(i => [i.id, []]));
  const rects = items.map(i => rectOf(i));

  items.forEach((it, i) => {
    const errs = result.get(it.id);
    for (const v of wallViolations(rects[i], room)) {
      errs.push({ key: 'err.wall', params: { wall: v.wall, n: v.n } });
    }
    const top = (it.elev || 0) + it.h;
    if (top > room.H) errs.push({ key: 'err.height', params: { n: top - room.H } });
    for (const o of state.openings || []) {
      // A wall cabinet above the door leaf does not block it.
      if (o.kind === 'door' && (it.elev || 0) < o.height && overlaps(rects[i], doorSwingRect(o, room))) {
        errs.push({ key: 'err.door', params: {} });
      }
    }
    // Structure: only obstacles at the item's height count (a ceiling duct is above a low cabinet).
    for (const ob of state.obstacles || []) {
      if (!zOverlaps(it, ob)) continue;
      const r = { x: ob.x, y: ob.y, w: ob.w, h: ob.d };
      if (overlaps(rects[i], r)) errs.push({ key: 'err.obstacle', params: { kind: ob.kind } });
      else if (settings.gap > 0) {
        const c = clearance(rects[i], r);
        if (c < settings.gap - 1e-6) errs.push({ key: 'err.gap', params: { kind: ob.kind, n: round1(c) } });
      }
    }
  });

  // Opening zones: a door / drawer that hits a wall, an item or structure at its height will not open.
  items.forEach((it, i) => {
    const spec = openSpec(it, state.catalog);
    const zone = openZoneRect(it, spec);
    if (!zone) return;
    let worst = null;
    const hit = (n, params) => { if (n > 0 && (!worst || n > worst.params.n)) worst = { params: { ...params, n } }; };
    const wd = wallDepth(it, room);
    if (wd < spec.depth) hit(Math.ceil(spec.depth - wd), { wallBlock: true });
    items.forEach((o, j) => {
      if (j === i || !zOverlaps(it, o) || overlaps(rects[i], rects[j]) || !overlaps(zone, rects[j])) return;
      hit(Math.ceil(spec.depth - Math.max(0, freeDepth(it, rects[j]))), { otherId: o.id });
    });
    for (const ob of state.obstacles || []) {
      const r = { x: ob.x, y: ob.y, w: ob.w, h: ob.d };
      if (!zOverlaps(it, ob) || overlaps(rects[i], r) || !overlaps(zone, r)) continue;
      hit(Math.ceil(spec.depth - Math.max(0, freeDepth(it, r))), { kind: ob.kind });
    }
    if (worst) result.get(it.id).push({ key: worst.params.wallBlock ? 'err.openZoneWall' : 'err.openZone', params: worst.params });
  });

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = rects[i], b = rects[j];
      if (!zOverlaps(items[i], items[j])) continue;   // a shelf above a desk
      if (overlaps(a, b)) {
        result.get(items[i].id).push({ key: 'err.overlap', params: { otherId: items[j].id } });
        result.get(items[j].id).push({ key: 'err.overlap', params: { otherId: items[i].id } });
      } else if (settings.gap > 0) {
        const c = clearance(a, b);
        if (c < settings.gap - 1e-6) {
          result.get(items[i].id).push({ key: 'err.gap', params: { otherId: items[j].id, n: round1(c) } });
          result.get(items[j].id).push({ key: 'err.gap', params: { otherId: items[i].id, n: round1(c) } });
        }
      }
    }
  }
  return result;
}

export const hasErrors = map => [...map.values()].some(e => e.length > 0);

// Structure in front of a door or a window: → Map<obstacleId, [{ key, params }]>
export function obstacleWarnings(state) {
  const { room } = state;
  const result = new Map();
  for (const ob of state.obstacles || []) {
    const r = { x: ob.x, y: ob.y, w: ob.w, h: ob.d };
    const list = [];
    for (const o of state.openings || []) {
      if (o.kind === 'door' && ob.elev < o.height && overlaps(r, doorSwingRect(o, room))) {
        list.push({ key: 'warn.obDoor', params: { kind: ob.kind } });
      }
      if (o.kind === 'window' && ob.elev + ob.h > o.sill && ob.elev < o.sill + o.height && overlaps(r, windowZoneRect(o, room))) {
        list.push({ key: 'warn.obWindow', params: { kind: ob.kind } });
      }
    }
    if (list.length) result.set(ob.id, list);
  }
  return result;
}

// Soft problems that do not block the order: tall furniture in front of a window.
export function validateWarnings(state) {
  const { room, items } = state;
  const result = new Map(items.map(i => [i.id, []]));
  for (const it of items) {
    const r = rectOf(it);
    for (const o of state.openings || []) {
      const [z0, z1] = zRange(it);
      if (o.kind === 'window' && z1 > o.sill && z0 < o.sill + o.height && overlaps(r, windowZoneRect(o, room))) {
        result.get(it.id).push({ key: 'warn.window', params: { n: o.sill } });
      }
    }
  }
  // Two zones (or a zone and the room door) over the same floor: they cannot be open at once.
  const zones = items.map(it => openZoneRect(it, openSpec(it, state.catalog)));
  items.forEach((it, i) => {
    if (!zones[i]) return;
    for (const o of state.openings || []) {
      if (o.kind === 'door' && (it.elev || 0) < o.height && overlaps(zones[i], doorSwingRect(o, room))) {
        result.get(it.id).push({ key: 'warn.openZoneDoor', params: {} });
      }
    }
    items.forEach((o, j) => {
      if (j === i || !zones[j] || !zOverlaps(it, o) || !overlaps(zones[i], zones[j])) return;
      result.get(it.id).push({ key: 'warn.openZoneShared', params: { otherId: o.id } });
    });
  });
  const min = state.settings.minPassage || 60;
  for (const p of narrowPassages(state)) {
    for (const ref of [p.a, p.b]) {
      if (ref.itemId && result.has(ref.itemId)) result.get(ref.itemId).push({ key: 'warn.passage', params: { n: p.n, min } });
    }
  }
  return result;
}
