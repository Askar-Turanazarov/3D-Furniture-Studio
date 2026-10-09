import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSpec, openZoneRect } from '../public/js/zones.js';
import { validateAll, validateWarnings, hasErrors } from '../public/js/validate.js';
import { findSpot } from '../public/js/autoplace.js';
import { state, item } from './helpers.js';

const CAT = [
  { type: 'wardrobe', open: { kind: 'swing' } },
  { type: 'dresser', open: { kind: 'drawer' } }
];
const wardrobe = o => item({ type: 'wardrobe', w: 120, d: 60, h: 220, ...o });
const keys = (map, id) => (map.get(id) || []).map(e => e.key);

test('spec: doors from the width, drawers from the depth, item override', () => {
  assert.deepEqual(openSpec(wardrobe(), CAT), { kind: 'swing', doors: 2, depth: 60 });
  assert.deepEqual(openSpec(wardrobe({ w: 90 }), CAT), { kind: 'swing', doors: 2, depth: 45 });
  assert.deepEqual(openSpec(item({ type: 'dresser', d: 45 }), CAT), { kind: 'drawer', doors: 0, depth: 36 });
  assert.equal(openSpec(wardrobe({ open: { kind: 'slide' } }), CAT).depth, 0);
  assert.equal(openSpec(item({ type: 'box' }), CAT).kind, 'none');
});

test('zone rect in front of the face for 0/90/180/270', () => {
  const s = { depth: 60 };
  const it = wardrobe({ x: 100, y: 100 });
  assert.deepEqual(openZoneRect({ ...it, rot: 0 }, s), { x: 100, y: 160, w: 120, h: 60 });
  assert.deepEqual(openZoneRect({ ...it, rot: 90 }, s), { x: 40, y: 100, w: 60, h: 120 });
  assert.deepEqual(openZoneRect({ ...it, rot: 180 }, s), { x: 100, y: 40, w: 120, h: 60 });
  assert.deepEqual(openZoneRect({ ...it, rot: 270 }, s), { x: 160, y: 100, w: 60, h: 120 });
});

test('wardrobe with a bed 40 cm in front: 20 cm short', () => {
  const w = wardrobe({ x: 2, y: 2 });
  const bed = item({ type: 'bed', w: 160, d: 190, h: 50, x: 2, y: 102 });
  const res = validateAll({ ...state({ items: [w, bed] }), catalog: CAT });
  assert.deepEqual(res.get(w.id), [{ key: 'err.openZone', params: { otherId: bed.id, n: 20 } }]);
});

test('sliding wardrobe next to the bed is fine; facing the wall is an error', () => {
  const w = wardrobe({ x: 2, y: 2, open: { kind: 'slide' } });
  const bed = item({ type: 'bed', w: 160, d: 190, h: 50, x: 2, y: 102 });
  assert.equal(hasErrors(validateAll({ ...state({ items: [w, bed] }), catalog: CAT })), false);
  const back = wardrobe({ x: 2, y: 2, rot: 180 });
  assert.deepEqual(validateAll({ ...state({ items: [back] }), catalog: CAT }).get(back.id),
    [{ key: 'err.openZoneWall', params: { wallBlock: true, n: 58 } }]);
});

test('two zones over the same floor warn', () => {
  const a = wardrobe({ x: 2, y: 2 });
  const b = wardrobe({ x: 2, y: 162, rot: 180 });
  const s = { ...state({ items: [a, b] }), catalog: CAT };
  assert.equal(hasErrors(validateAll(s)), false);
  assert.deepEqual(keys(validateWarnings(s), a.id), ['warn.openZoneShared']);
});

test('autoplace keeps the zone free when it can', () => {
  const w = wardrobe({ x: -99, y: -99 });
  const s = { ...state({ items: [w] }), catalog: CAT };
  const res = findSpot(w, s);
  assert.equal(res.ok, true);
  assert.equal(res.soft, undefined);
  Object.assign(w, { x: res.x, y: res.y, rot: res.rot });
  assert.equal(hasErrors(validateAll(s)), false);
});
