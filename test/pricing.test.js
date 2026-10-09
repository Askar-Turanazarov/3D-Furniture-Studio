import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estimate, roomEstimate } from '../public/js/pricing.js';
import { sectionCount, drawerCount, slideDoors } from '../public/js/config.js';

const catalog = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url)));
const wardrobe = (extra = {}) => ({ id: 1, type: 'wardrobe', w: 120, d: 60, h: 220, x: 0, y: 0, rot: 0, ...extra });

test('every catalog type is priced, fixed or explicitly left out', () => {
  const out = ['fridge', 'floorlamp', 'sconce'];
  for (const c of catalog.items) {
    const e = estimate({ ...c, id: 1, x: 0, y: 0, rot: 0 }, catalog);
    if (out.includes(c.type)) assert.equal(e, null, c.type);
    else assert.ok(e && e.total > 0, c.type);
  }
});

test('swing wardrobe 120×60×220: carcass + facade + doors + hinges + one extra section', () => {
  const e = estimate(wardrobe(), catalog);
  const p = catalog.pricing.types.wardrobe, def = catalog.pricing.defaultRate;
  const raw = p.carcassPerM * 1.2 + def * 1.2 * 2.2 + 2 * p.doorRate + 2 * p.hingesPerDoor * p.hinge + p.sectionRate;
  assert.equal(e.total, Math.round(raw / 10000) * 10000);
  assert.deepEqual(e.lines.map(l => l.key), ['carcass', 'facade', 'doors', 'hardware', 'sections']);
});

test('sliding doors use the slide kit instead of hinges', () => {
  const e = estimate(wardrobe({ open: { kind: 'slide' } }), catalog);
  assert.equal(e.lines.find(l => l.key === 'hardware').sum, catalog.pricing.types.wardrobe.slideKit);
});

test('a dearer material raises the price; drawers add up', () => {
  const base = estimate(wardrobe(), catalog).total;
  assert.ok(estimate(wardrobe({ materials: { body: 'walnut' } }), catalog).total > base);
  const two = estimate(wardrobe({ drawers: 2 }), catalog);
  assert.equal(two.lines.find(l => l.key === 'drawers').sum, 2 * catalog.pricing.types.wardrobe.drawerRate);
});

test('kitchen: a tall set includes the upper cabinets', () => {
  const low = estimate({ type: 'kitchen', w: 240, d: 60, h: 90 }, catalog).total;
  const tall = estimate({ type: 'kitchen', w: 240, d: 60, h: 220 }, catalog).total;
  assert.ok(tall > low);
});

test('room total skips items that are not part of the order', () => {
  const r = roomEstimate([wardrobe(), { type: 'fridge', w: 60, d: 65, h: 185 }], catalog);
  assert.equal(r.total, estimate(wardrobe(), catalog).total);
  assert.equal(r.skipped, 1);
});

test('configuration counts follow the 3D defaults and are clamped', () => {
  assert.equal(sectionCount(wardrobe()), 2);
  assert.equal(sectionCount(wardrobe({ sections: 9 })), 6);
  assert.equal(drawerCount(wardrobe()), 0);
  assert.equal(drawerCount({ type: 'dresser', w: 100, d: 45, h: 90 }), 4);
  assert.equal(drawerCount({ type: 'dresser', w: 100, d: 45, h: 90, drawers: 0 }), 1);
  assert.equal(slideDoors(wardrobe({ open: { kind: 'slide', doors: 5 } })), 3);
});
