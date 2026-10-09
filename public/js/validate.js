// Validate every item: walls (with plinth), AABB overlap, min gap, ceiling height, door swing.
import { rectOf, wallViolations, overlaps, clearance, round1, zOverlaps } from './geometry.js';
import { doorSwingRect, windowZoneRect } from './openings.js';

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
    if (it.h > room.H) errs.push({ key: 'err.height', params: { n: it.h - room.H } });
    for (const o of state.openings || []) {
      if (o.kind === 'door' && overlaps(rects[i], doorSwingRect(o, room))) errs.push({ key: 'err.door', params: {} });
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

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = rects[i], b = rects[j];
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
      if (o.kind === 'window' && it.h > o.sill && overlaps(r, windowZoneRect(o, room))) {
        result.get(it.id).push({ key: 'warn.window', params: { n: o.sill } });
      }
    }
  }
  return result;
}
