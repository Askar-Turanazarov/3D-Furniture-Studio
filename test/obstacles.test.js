import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newObstacle, nicheLedges, clampObstacle, fitObstacleHeight, obRect, OB_KINDS } from '../public/js/obstacles.js';
import { room } from './helpers.js';

const R = room();

test('defaults of every kind fit the room', () => {
  for (const k of OB_KINDS) {
    const o = newObstacle(k, 1, R);
    assert.ok(o.x >= 0 && o.y >= 0 && o.x + o.w <= R.L && o.y + o.d <= R.W, k);
    assert.ok(o.elev + o.h <= R.H, k);
  }
  const c = newObstacle('ceilingDuct', 1, R);
  assert.equal(c.elev, R.H - 30);
  assert.equal(newObstacle('column', 1, R).h, R.H);
});

test('radiator is centred under the window', () => {
  const win = { kind: 'window', wall: 'east', offset: 100, width: 120 };
  const o = newObstacle('radiator', 1, R, [win]);
  assert.deepEqual([o.x, o.y, o.w, o.d, o.h, o.elev], [R.L - 10, 120, 10, 80, 55, 15]);
});

test('niche makes two ledges around the free part of the wall', () => {
  let id = 10;
  const ls = nicheLedges('north', 100, 150, 60, R, () => id++);
  assert.deepEqual(ls.map(l => [l.x, l.y, l.w, l.d]), [[0, 0, 100, 60], [250, 0, 150, 60]]);
  assert.deepEqual(ls.map(l => l.id), [10, 11]);
  // Niche at the corner → only one ledge.
  assert.equal(nicheLedges('west', 0, 120, 40, R, () => id++).length, 1);
  assert.deepEqual(obRect(nicheLedges('west', 0, 120, 40, R, () => 1)[0]), { x: 0, y: 120, w: 40, h: 180 });
});

test('clamp keeps it inside and below the ceiling', () => {
  const o = clampObstacle({ x: 390, y: -5, w: 40, d: 40, h: 300, elev: 10 }, R);
  assert.deepEqual([o.x, o.y, o.h, o.elev], [360, 0, 270, 0]);
});

test('full-height obstacles and ceiling ducts follow the ceiling', () => {
  const col = newObstacle('column', 1, R);
  const duct = newObstacle('ceilingDuct', 2, R);
  const hi = { ...R, H: 300 };
  assert.equal(fitObstacleHeight(col, 270, hi).h, 300);
  assert.equal(fitObstacleHeight(duct, 270, hi).elev, 270);
});
