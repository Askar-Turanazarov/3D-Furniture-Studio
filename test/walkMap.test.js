import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkMap } from '../public/js/walkMap.js';
import { PARTITION } from '../public/js/apartment.js';

const door = (id, wall, offset, width = 80) => ({ id, kind: 'door', wall, offset, width, height: 200, hinge: 'start' });
const mk = (id, x, y, L, W, o = {}) => ({
  id, pos: { x, y }, room: { L, W, H: 270, plinth: 2 }, items: o.items || [], openings: o.openings || [], obstacles: o.obstacles || []
});
// Hall 300×200; living room below it across a partition, door from the hall at 50…130.
const flat = () => [
  mk('hall', 0, 0, 300, 200, { openings: [door(1, 'north', 100), door(2, 'south', 50)] }),
  mk('living', 0, 200 + PARTITION, 400, 300)
];

test('walk: inside rooms, through the doorway, not through the partition', () => {
  const m = walkMap(flat());
  assert.equal(m.blocked(150, 100), false, 'hall');
  assert.equal(m.blocked(150, 400), false, 'living room');
  assert.equal(m.blocked(90, 205), false, 'in the doorway');
  assert.equal(m.blocked(200, 205), true, 'in the partition');
  assert.equal(m.blocked(10, 100), true, 'closer than the radius to the wall');
  assert.equal(m.blocked(140, -5), true, 'the entrance door leads outside');
  assert.equal(m.roomIdAt(150, 400), 'living');
  assert.equal(m.roomIdAt(90, 205), null);
});

test('walk: a closed door blocks its doorway and is reported', () => {
  let open = false;
  const m = walkMap(flat(), { doorOpen: () => open });
  assert.equal(m.blocked(90, 205), true);
  assert.equal(m.closedDoorAt(90, 205).door, 2);
  assert.equal(m.closedDoorAt(150, 100), null);
  open = true;
  assert.equal(m.blocked(90, 205), false);
});

test('walk: furniture lower than the person blocks, a high shelf does not', () => {
  const rooms = flat();
  rooms[1].items = [
    { id: 1, type: 'bed', w: 160, d: 200, h: 50, x: 100, y: 50, rot: 0 },
    { id: 2, type: 'shelf', w: 80, d: 25, h: 4, x: 300, y: 20, rot: 0, elev: 190 }
  ];
  const m = walkMap(rooms, { personH: 170 });
  assert.equal(m.blocked(180, 360), true, 'on the bed (the living room starts at y 210)');
  assert.equal(m.blocked(340, 245), false, 'under the high shelf');
});

test('walk: a ray along the floor passes an open doorway into the next room', () => {
  const m = walkMap(flat());
  const down = m.ray(90, 100, 0, 1);
  assert.deepEqual([down.wall, down.room, Math.round(down.d)], ['south', 'living', 410]);
  const side = m.ray(200, 100, 0, 1);
  assert.deepEqual([side.wall, side.room, Math.round(side.d)], ['south', 'hall', 100]);
  const shut = walkMap(flat(), { doorOpen: () => false }).ray(90, 100, 0, 1);
  assert.equal(shut.room, 'hall', 'a closed door stops the ray');
});

test('walk: the strip in front of a door leading off the plan is found, linked doors are not', () => {
  const m = walkMap(flat());
  assert.deepEqual([m.outerDoorAt(140, 30)?.room, m.outerDoorAt(140, 30)?.door], ['hall', 1], 'entrance door, from inside');
  assert.equal(m.outerDoorAt(140, 100), null, 'middle of the hall');
  assert.equal(m.outerDoorAt(60, 30), null, 'beside the door');
  assert.equal(m.outerDoorAt(90, 180), null, 'the door to the living room is a passage');
});
