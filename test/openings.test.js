import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampOpening, doorSwingRect, windowZoneRect, nearestWall, defaultOpenings, wallLen } from '../public/js/openings.js';
import { room } from './helpers.js';

test('clampOpening keeps the opening on its wall and below the ceiling', () => {
  const r = room();
  const o = clampOpening({ kind: 'window', wall: 'west', offset: 280, width: 500, sill: 300, height: 200 }, r);
  assert.equal(o.width, 300);
  assert.equal(o.offset, 0);
  assert.equal(o.sill, 240);
  assert.equal(o.height, 25);
  const d = clampOpening({ kind: 'door', wall: 'north', offset: 380, width: 80, height: 400 }, r);
  assert.equal(d.offset, 320);
  assert.equal(d.height, 270);
});

test('door swing rect lies inside the room on every wall', () => {
  const r = room();
  const d = w => ({ kind: 'door', wall: w, offset: 100, width: 80 });
  assert.deepEqual(doorSwingRect(d('north'), r), { x: 100, y: 0, w: 80, h: 80 });
  assert.deepEqual(doorSwingRect(d('south'), r), { x: 100, y: 220, w: 80, h: 80 });
  assert.deepEqual(doorSwingRect(d('west'), r), { x: 0, y: 100, w: 80, h: 80 });
  assert.deepEqual(doorSwingRect(d('east'), r), { x: 320, y: 100, w: 80, h: 80 });
});

test('window zone is a strip in front of the window', () => {
  assert.deepEqual(windowZoneRect({ wall: 'north', offset: 100, width: 120 }, room()), { x: 100, y: 0, w: 120, h: 12 });
  assert.deepEqual(windowZoneRect({ wall: 'east', offset: 50, width: 100 }, room()), { x: 388, y: 50, w: 12, h: 100 });
});

test('nearestWall returns the wall, coordinate along it and distance', () => {
  assert.deepEqual(nearestWall(10, 150, room()), { wall: 'west', along: 150, dist: 10 });
  assert.deepEqual(nearestWall(200, 295, room()), { wall: 'south', along: 200, dist: 5 });
});

test('default openings: a window on the north wall and a door on the south wall', () => {
  const r = room();
  const [w, d] = defaultOpenings(r);
  assert.equal(w.kind, 'window');
  assert.equal(w.wall, 'north');
  assert.equal(d.kind, 'door');
  assert.equal(d.wall, 'south');
  assert.ok(d.offset + d.width <= wallLen('south', r));
});
