import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveTo, moveGroup, rotateLegal, conflict } from '../public/js/placement.js';
import { rectOf } from '../public/js/geometry.js';
import { state, item } from './helpers.js';

test('a free target is reached as it is', () => {
  const it = item({ x: 50, y: 50 });
  assert.deepEqual(moveTo(it, 120, 80, state({ items: [it] })), { x: 120, y: 80, blocked: false, reason: null, free: false });
});

test('stops flush at the plinth line (2 cm) and names the wall', () => {
  const it = item({ x: 100, y: 100 });                    // 100 × 50 in a 400 × 300 room
  const m = moveTo(it, 330, 100, state({ items: [it] }));
  assert.equal(m.blocked, true);
  assert.equal(m.x, 400 - 2 - 100);
  assert.equal(m.reason.key, 'err.wall');
  assert.equal(moveTo(it, -40, 100, state({ items: [it] })).x, 2);
});

test('stops against a neighbour and slides along it', () => {
  const a = item({ x: 20, y: 100 }), b = item({ x: 200, y: 80, w: 60, d: 100 });
  const s = state({ items: [a, b] });
  const m = moveTo(a, 180, 140, s);                        // into b, diagonally
  assert.equal(m.blocked, true);
  assert.equal(m.reason.key, 'err.overlap');
  assert.equal(m.x, 100);                                  // flush with b's left side
  assert.equal(m.y, 140);                                  // the free axis moved on
});

test('a long jump does not pass through a blocker on the way', () => {
  const a = item({ x: 20, y: 100, w: 40, d: 40 }), b = item({ x: 150, y: 90, w: 20, d: 60 });
  const s = state({ items: [a, b] });
  const m = moveTo(a, 160, 100, s);                        // the target overlaps b
  assert.equal(m.x, 110);
});

test('a shelf above a desk and a rug under the sofa do not block', () => {
  const desk = item({ x: 100, y: 2, h: 75 }), shelf = item({ x: 20, y: 2, h: 30, elev: 150 });
  const rug = item({ type: 'rug', x: 20, y: 150, h: 1 });
  const s = state({ items: [desk, shelf, rug] });
  assert.equal(moveTo(shelf, 100, 2, s).blocked, false);
  assert.equal(moveTo(rug, 100, 2, s).blocked, false);
});

test('structure and a door swing block', () => {
  const it = item({ x: 200, y: 200, w: 50, d: 50 });
  const ob = { id: 1, kind: 'column', x: 100, y: 200, w: 40, d: 40, h: 270 };
  const door = { id: 2, kind: 'door', wall: 'north', offset: 2, width: 80, height: 200 };
  const s = state({ items: [it], obstacles: [ob], openings: [door] });
  const m = moveTo(it, 110, 200, s);
  assert.equal(m.reason.key, 'err.obstacle');
  assert.equal(m.x, 140);
  assert.equal(moveTo(it, 10, 10, s).reason.key, 'err.door');
});

test('an item that already stands badly moves freely', () => {
  const a = item({ x: 50, y: 50 }), b = item({ x: 80, y: 60 });
  const m = moveTo(a, 90, 70, state({ items: [a, b] }));
  assert.equal(m.free, true);
  assert.equal(m.x, 90);
});

test('a group moves by the smallest allowed shift', () => {
  const a = item({ x: 100, y: 100, w: 50, d: 50 }), b = item({ x: 200, y: 100, w: 50, d: 50 });
  const s = state({ items: [a, b] });
  const m = moveGroup([a, b], 300, 0, s);
  assert.equal(m.dx, 400 - 2 - 250);                       // b reaches the east wall
  assert.equal(m.reason.key, 'err.wall');
  assert.deepEqual(moveGroup([a, b], 0, -50, s), { dx: 0, dy: -50, reason: null });
});

test('rotation at a wall moves the item to the nearest free spot', () => {
  const it = item({ x: 2, y: 100, w: 100, d: 40 });        // along the west wall
  const s = state({ items: [it] });
  const r = rotateLegal(it, s);
  assert.equal(r.ok, true);
  assert.equal(r.rot, 90);
  assert.equal(conflict({ ...it, rot: r.rot }, rectOf({ ...it, ...r }), s), null);
  const big = item({ x: 2, y: 2, w: 290, d: 100 });        // 290 does not fit across a 300 room with the plinth
  assert.equal(rotateLegal(big, state({ items: [big], room: { W: 292 } })).ok, false);
});
