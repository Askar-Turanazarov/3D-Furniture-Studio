import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignDeltas } from '../public/js/align.js';

const rects = [
  { x: 10, y: 10, w: 50, h: 40 },
  { x: 100, y: 30, w: 30, h: 20 },
  { x: 200, y: 0, w: 40, h: 60 }
];
const apply = (rs, ds) => rs.map((r, i) => ({ ...r, x: r.x + ds[i].dx, y: r.y + ds[i].dy }));

test('align edges', () => {
  assert.deepEqual(apply(rects, alignDeltas(rects, 'left')).map(r => r.x), [10, 10, 10]);
  assert.deepEqual(apply(rects, alignDeltas(rects, 'right')).map(r => r.x + r.w), [240, 240, 240]);
  assert.deepEqual(apply(rects, alignDeltas(rects, 'top')).map(r => r.y), [0, 0, 0]);
  assert.deepEqual(apply(rects, alignDeltas(rects, 'bottom')).map(r => r.y + r.h), [60, 60, 60]);
});

test('align centres', () => {
  assert.deepEqual(apply(rects, alignDeltas(rects, 'cy')).map(r => r.y + r.h / 2), [30, 30, 30]);
  assert.deepEqual(apply(rects, alignDeltas(rects, 'cx')).map(r => r.x + r.w / 2), [125, 125, 125]);
});

test('distribute keeps the ends and makes equal gaps', () => {
  const out = apply(rects, alignDeltas(rects, 'distX'));
  assert.equal(out[0].x, 10);
  assert.equal(out[2].x, 200);
  const g1 = out[1].x - (out[0].x + out[0].w), g2 = out[2].x - (out[1].x + out[1].w);
  assert.ok(Math.abs(g1 - g2) <= 1);
});

test('one rect or two rects for distribution: nothing moves', () => {
  assert.deepEqual(alignDeltas([rects[0]], 'left'), [{ dx: 0, dy: 0 }]);
  assert.deepEqual(alignDeltas(rects.slice(0, 2), 'distX'), [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }]);
});
