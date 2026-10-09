// Validate every item: walls (with plinth), AABB overlap, min gap, ceiling height, door swing.
import { rectOf, wallViolations, overlaps, clearance, round1 } from './geometry.js';
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
