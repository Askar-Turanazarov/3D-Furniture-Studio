import { test } from 'node:test';
import assert from 'node:assert/strict';
import { footprint, rectOf, overlaps, clearance, wallViolations, insideRoom, rayGaps } from '../public/js/geometry.js';
import { room, item } from './helpers.js';

test('footprint swaps sides at 90 / 270', () => {
  const it = item({ w: 120, d: 60 });
  for (const rot of [0, 180]) assert.deepEqual(footprint(it, rot), { w: 120, h: 60 });
  for (const rot of [90, 270]) assert.deepEqual(footprint(it, rot), { w: 60, h: 120 });
  assert.deepEqual(rectOf(it, 10, 20, 90), { x: 10, y: 20, w: 60, h: 120 });
});

test('touching edges is not an overlap', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  assert.equal(overlaps(a, { x: 10, y: 0, w: 10, h: 10 }), false);
  assert.equal(overlaps(a, { x: 9, y: 9, w: 10, h: 10 }), true);
});

test('clearance is the largest axis separation', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  assert.equal(clearance(a, { x: 13, y: 0, w: 5, h: 5 }), 3);
  assert.equal(clearance(a, { x: 15, y: 20, w: 5, h: 5 }), 10);
});

test('wall violations include the plinth', () => {
  const r = room();
  assert.deepEqual(wallViolations({ x: 0, y: 2, w: 100, h: 50 }, r), [{ wall: 'west', n: 2 }]);
  assert.deepEqual(wallViolations({ x: 300, y: 250, w: 100, h: 50 }, r), [{ wall: 'east', n: 2 }, { wall: 'south', n: 2 }]);
  assert.equal(insideRoom({ x: 2, y: 2, w: 396, h: 296 }, r), true);
  assert.equal(insideRoom({ x: 2, y: 2, w: 397, h: 296 }, r), false);
});

const byKind = (lines, kind) => lines.filter(l => l.kind === kind).map(l => l.d).sort((a, b) => a - b);

test('rayGaps: no neighbours, four wall lines', () => {
  const lines = rayGaps({ x: 2, y: 2, w: 100, h: 50 }, [], room());
  assert.deepEqual(byKind(lines, 'wall'), [2, 2, 248, 298]);
  assert.deepEqual(byKind(lines, 'item'), []);
});

test('rayGaps: neighbour covering the whole side, only the line to it', () => {
  const lines = rayGaps({ x: 2, y: 2, w: 100, h: 50 }, [{ x: 150, y: 2, w: 50, h: 50 }], room());
  assert.deepEqual(byKind(lines, 'item'), [48]);
  assert.deepEqual(byKind(lines, 'wall'), [2, 2, 248]);
});

test('rayGaps: neighbour covering part of the side, to it and to the wall', () => {
  const lines = rayGaps({ x: 2, y: 2, w: 100, h: 50 }, [{ x: 150, y: 2, w: 50, h: 20 }], room());
  assert.deepEqual(byKind(lines, 'item'), [48]);
  assert.deepEqual(byKind(lines, 'wall'), [2, 2, 248, 298]);
  const east = lines.find(l => l.kind === 'wall' && l.d === 298);
  assert.ok(east.y1 > 22 && east.y1 < 52, 'wall line runs through the uncovered part');
});

test('rayGaps ignores overlapping items', () => {
  const lines = rayGaps({ x: 2, y: 2, w: 100, h: 50 }, [{ x: 50, y: 2, w: 100, h: 50 }], room());
  assert.deepEqual(byKind(lines, 'item'), []);
});
