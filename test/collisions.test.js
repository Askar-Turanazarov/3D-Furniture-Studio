import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAll, hasErrors, obstacleWarnings } from '../public/js/validate.js';
import { findSpot } from '../public/js/autoplace.js';
import { newObstacle, nicheLedges } from '../public/js/obstacles.js';
import { state, item, room } from './helpers.js';

const keys = (map, id) => (map.get(id) || []).map(e => e.key);
const R = room();

test('item on a column: err.obstacle with the kind', () => {
  const col = newObstacle('column', 1, R);   // 180..220 × 130..170
  const it = item({ x: 150, y: 120 });
  const res = validateAll(state({ items: [it], obstacles: [col] }));
  assert.deepEqual(res.get(it.id), [{ key: 'err.obstacle', params: { kind: 'column' } }]);
});

test('flush to a ledge needs the gap, gap away is fine', () => {
  const ledge = { id: 1, kind: 'ledge', x: 0, y: 0, w: 100, d: 60, h: 270, elev: 0 };
  const close = item({ x: 101, y: 2 });
  assert.deepEqual(validateAll(state({ items: [close], obstacles: [ledge] })).get(close.id),
    [{ key: 'err.gap', params: { kind: 'ledge', n: 1 } }]);
  const ok = item({ x: 103, y: 2 });
  assert.equal(hasErrors(validateAll(state({ items: [ok], obstacles: [ledge] }))), false);
});

test('a ceiling duct above a low item is not a collision', () => {
  const duct = newObstacle('ceilingDuct', 1, R);   // elev 240
  const low = item({ x: 2, y: 2, h: 220 });
  assert.equal(hasErrors(validateAll(state({ items: [low], obstacles: [duct] }))), false);
  const tall = item({ x: 2, y: 2, h: 250 });
  assert.deepEqual(keys(validateAll(state({ items: [tall], obstacles: [duct] })), tall.id), ['err.obstacle']);
});

test('autoplace avoids a column and fits a wardrobe into a niche', () => {
  const col = { id: 1, kind: 'column', x: 2, y: 2, w: 396, d: 200, h: 270, elev: 0 };
  const it = item({ w: 100, d: 50, x: -99, y: -99 });
  const s = state({ items: [it], obstacles: [col] });
  const res = findSpot(it, s);
  assert.equal(res.ok, true);
  Object.assign(it, { x: res.x, y: res.y, rot: res.rot });
  assert.equal(hasErrors(validateAll(s)), false);

  let id = 1;
  const niche = nicheLedges('north', 100, 150, 60, R, () => id++);
  const w = item({ w: 144, d: 60, x: -99, y: -99 });
  const s2 = state({ items: [w], obstacles: niche });
  const r2 = findSpot(w, s2);
  assert.equal(r2.ok, true);
  Object.assign(w, { x: r2.x, y: r2.y, rot: r2.rot });
  assert.equal(hasErrors(validateAll(s2)), false);
});

test('structure in a door swing or in front of a window is warned', () => {
  const door = { id: 1, kind: 'door', wall: 'south', offset: 100, width: 80, height: 200 };
  const win = { id: 2, kind: 'window', wall: 'north', offset: 100, width: 150, height: 150, sill: 80 };
  const col = { id: 5, kind: 'column', x: 110, y: 250, w: 40, d: 40, h: 270, elev: 0 };
  const rad = newObstacle('radiator', 6, R, [win]);   // top 70 < sill 80
  const ledge = { id: 7, kind: 'ledge', x: 120, y: 0, w: 40, d: 20, h: 270, elev: 0 };
  const w = obstacleWarnings(state({ openings: [door, win], obstacles: [col, rad, ledge] }));
  assert.deepEqual(w.get(5), [{ key: 'warn.obDoor', params: { kind: 'column' } }]);
  assert.equal(w.has(6), false);
  assert.deepEqual(w.get(7), [{ key: 'warn.obWindow', params: { kind: 'ledge' } }]);
});
