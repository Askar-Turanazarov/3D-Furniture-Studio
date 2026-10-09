import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAll, validateWarnings, hasErrors } from '../public/js/validate.js';
import { findSpot } from '../public/js/autoplace.js';
import { zOverlaps } from '../public/js/geometry.js';
import { newObstacle } from '../public/js/obstacles.js';
import { state, item, room } from './helpers.js';

const keys = (map, id) => (map.get(id) || []).map(e => e.key);

test('z ranges: touching is not an overlap', () => {
  assert.equal(zOverlaps({ h: 75 }, { elev: 75, h: 4 }), false);
  assert.equal(zOverlaps({ h: 76 }, { elev: 75, h: 4 }), true);
});

test('a shelf above a desk is fine, a shelf at desk height is not', () => {
  const desk = item({ w: 120, d: 60, h: 75, x: 2, y: 2 });
  const shelf = item({ w: 80, d: 25, h: 4, elev: 150, x: 2, y: 2 });
  assert.equal(hasErrors(validateAll(state({ items: [desk, shelf] }))), false);
  shelf.elev = 60;
  assert.deepEqual(keys(validateAll(state({ items: [desk, shelf] })), shelf.id), ['err.overlap']);
});

test('ceiling height counts the elevation', () => {
  const m = item({ h: 50, elev: 230 });
  assert.deepEqual(validateAll(state({ items: [m] })).get(m.id), [{ key: 'err.height', params: { n: 10 } }]);
});

test('wardrobe under a ceiling duct: 220 fits, 250 does not', () => {
  const duct = newObstacle('ceilingDuct', 1, room());   // elev 240
  const ok = item({ h: 220, x: 2, y: 2 });
  assert.equal(hasErrors(validateAll(state({ items: [ok], obstacles: [duct] }))), false);
  const bad = item({ h: 250, x: 2, y: 2 });
  assert.deepEqual(keys(validateAll(state({ items: [bad], obstacles: [duct] })), bad.id), ['err.obstacle']);
});

test('door swing: a shelf below the door top blocks it, above does not', () => {
  const door = { id: 1, kind: 'door', wall: 'north', offset: 100, width: 80, height: 200 };
  const low = item({ w: 80, d: 25, h: 4, elev: 150, x: 100, y: 2 });
  assert.deepEqual(keys(validateAll(state({ items: [low], openings: [door] })), low.id), ['err.door']);
  const high = item({ w: 80, d: 25, h: 4, elev: 205, x: 100, y: 2 });
  assert.equal(hasErrors(validateAll(state({ items: [high], openings: [door] }))), false);
});

test('window warning only when the heights meet', () => {
  const win = { id: 1, kind: 'window', wall: 'north', offset: 100, width: 150, height: 150, sill: 80 };
  const low = item({ w: 100, d: 30, h: 70, x: 120, y: 2 });
  const shelf = item({ w: 100, d: 25, h: 4, elev: 240, x: 120, y: 2 });
  const s = state({ items: [low, shelf], openings: [win] });
  assert.equal(keys(validateWarnings(s), low.id).length, 0);
  assert.equal(keys(validateWarnings(s), shelf.id).length, 0);
  shelf.elev = 150;
  assert.deepEqual(keys(validateWarnings(s), shelf.id), ['warn.window']);
});

test('autoplace puts a wall cabinet above a floor cabinet', () => {
  const R = room({ L: 100, W: 100 });
  const base = item({ w: 96, d: 60, h: 85, x: 2, y: 2 });
  const wall = item({ w: 60, d: 35, h: 70, elev: 140, x: -99, y: -99 });
  const s = state({ room: R, items: [base, wall] });
  const res = findSpot(wall, s);
  assert.equal(res.ok, true);
  Object.assign(wall, { x: res.x, y: res.y, rot: res.rot });
  assert.equal(hasErrors(validateAll(s)), false);
  assert.equal(wall.elev, 140);
});
