import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapLines, snapPoint, lockAxis, measure } from '../public/js/ruler.js';
import { room } from './helpers.js';

const lines = snapLines(room(), [{ x: 100, y: 50, w: 80, h: 40 }]);

test('snaps to a corner of an item', () => {
  assert.deepEqual(snapPoint(178, 92, lines, 5), { x: 180, y: 90, snapX: true, snapY: true });
});

test('snaps to walls and plinth, picks the nearest line', () => {
  const p = snapPoint(1, 150.4, lines, 5);
  assert.equal(p.x, 0);
  assert.equal(p.y, 150);
  assert.equal(p.snapY, false);
  assert.equal(snapPoint(2.6, 10, lines, 5).x, 2);
});

test('free point rounds to whole cm', () => {
  assert.deepEqual(snapPoint(250.4, 200.6, lines, 1), { x: 250, y: 201, snapX: false, snapY: false });
});

test('shift keeps the dominant axis', () => {
  assert.deepEqual(lockAxis({ x: 0, y: 0 }, { x: 100, y: 20 }), { x: 100, y: 0 });
  assert.deepEqual(lockAxis({ x: 0, y: 0 }, { x: 10, y: -60 }), { x: 0, y: -60 });
});

test('length and deltas', () => {
  assert.deepEqual(measure({ x: 0, y: 0 }, { x: 30, y: 40 }), { len: 50, dx: 30, dy: 40 });
});
