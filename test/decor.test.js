import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAll, validateWarnings } from '../public/js/validate.js';
import { findSpot } from '../public/js/autoplace.js';
import { narrowPassages } from '../public/js/passages.js';
import { isDecor } from '../public/js/geometry.js';
import { room, item, state } from './helpers.js';

const errs = (s, it) => validateAll(s).get(it.id);

test('a rug under the sofa is not a collision', () => {
  const sofa = item({ type: 'sofa', w: 200, d: 90, h: 85, x: 50, y: 2 });
  const rug = item({ type: 'rug', layer: 'decor', w: 200, d: 140, h: 1, x: 50, y: 40 });
  const s = state({ items: [sofa, rug] });
  assert.deepEqual(errs(s, sofa), []);
  assert.deepEqual(errs(s, rug), []);
});

test('decor still respects the walls and the ceiling', () => {
  const rug = item({ type: 'rug', w: 200, d: 140, h: 1, x: 300, y: 2 });
  const curtains = item({ type: 'curtains', w: 200, d: 15, h: 280, x: 2, y: 2 });
  const s = state({ items: [rug, curtains] });
  assert.ok(errs(s, rug).some(e => e.key === 'err.wall'));
  assert.ok(errs(s, curtains).some(e => e.key === 'err.height'));
});

test('isDecor by layer or by type', () => {
  assert.ok(isDecor({ type: 'rug' }));
  assert.ok(isDecor({ type: 'x', layer: 'decor' }));
  assert.ok(!isDecor({ type: 'sofa' }));
});

test('decor gives no window warning, no passage and is no obstacle for auto-place', () => {
  const curtains = item({ type: 'curtains', w: 200, d: 15, h: 240, elev: 5, x: 100, y: 2 });
  const s = state({ items: [curtains], openings: [{ id: 1, kind: 'window', wall: 'north', offset: 130, width: 140, sill: 85, height: 140 }] });
  assert.deepEqual(validateWarnings(s).get(curtains.id), []);
  const rug = item({ type: 'rug', w: 200, d: 140, h: 1, x: 100, y: 100 });
  const s2 = state({ items: [rug] });
  assert.deepEqual(narrowPassages(s2), []);
  const bed = item({ type: 'bed', w: 396, d: 296, h: 50, x: 2, y: 2 });   // fills the whole room, over the rug
  const res = findSpot(bed, { ...s2, items: [rug, bed], room: room() });
  assert.ok(res.ok);
});
