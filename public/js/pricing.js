// Price estimate of an item from catalog.pricing (TEST prices in sum — to be replaced with real ones). Pure.
//   pricing = { defaultRate, types: { <type>: { formula: 'cabinet' | 'drawers' | 'kitchen', ... } | { price } } }
//   cabinet: carcassPerM × running metre × (h / refH) × body rate factor + facade m² × material rate
//            + doors × doorRate + (sliding ? slideKit : hinges) + drawers × drawerRate + extra sections × sectionRate
//   drawers: carcass + facade m² + drawers × drawerRate
//   kitchen: base + upper (if tall) + countertop per running metre + facade m²
//   price:   ready-made item, fixed price; no entry — not part of the order (appliances, lamps).
import { matById } from './materials.js';
import { openSpec } from './zones.js';
import { sectionCount, drawerCount, slideDoors } from './config.js';

const ROUND = 10000;

export function estimate(item, catalog = {}) {
  const pricing = catalog.pricing || {}, p = pricing.types?.[item.type];
  if (!p) return null;
  if (p.price) return { total: p.price, lines: [{ key: 'fixed', sum: p.price }] };

  const def = pricing.defaultRate || 170000, mats = catalog.materials || [];
  const bodyRate = matById(mats, item.materials?.body)?.priceRate || def;
  const faceRate = matById(mats, item.materials?.facade)?.priceRate || bodyRate;
  const lm = item.w / 100, lines = [];
  const add = (key, sum) => { if (sum > 0) lines.push({ key, sum }); };

  if (p.formula === 'kitchen') {
    const tall = item.h > 160;
    add('carcass', (p.basePerM + (tall ? p.upperPerM : 0)) * lm * bodyRate / def);
    add('counter', p.counterPerM * lm);
    add('facade', faceRate * lm * (0.72 + (tall ? 0.7 : 0)));
  } else {
    add('carcass', p.carcassPerM * lm * (item.h / p.refH) * bodyRate / def);
    add('facade', faceRate * lm * item.h / 100);
    if (p.formula === 'cabinet') {
      const spec = openSpec(item, catalog.items || []);
      const sliding = spec.kind === 'slide';
      const doors = sliding ? slideDoors(item) : spec.doors || Math.max(1, Math.round(item.w / 50));
      add('doors', doors * (p.doorRate || 0));
      add('hardware', sliding ? p.slideKit || 0 : doors * (p.hingesPerDoor || 2) * (p.hinge || 0));
      add('sections', (sectionCount(item) - 1) * (p.sectionRate || 0));
    }
    add('drawers', drawerCount(item) * (p.drawerRate || 0));
  }
  const total = Math.round(lines.reduce((s, l) => s + l.sum, 0) / ROUND) * ROUND;
  return { total, lines: lines.map(l => ({ ...l, sum: Math.round(l.sum) })) };
}

// Sum of a room: priced items and how many are not included.
export function roomEstimate(items, catalog) {
  let total = 0, skipped = 0;
  for (const it of items) {
    const e = estimate(it, catalog);
    if (e) total += e.total; else skipped++;
  }
  return { total, skipped };
}
