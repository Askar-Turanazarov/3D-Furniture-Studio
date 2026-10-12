import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  roomRect, roomAt, roomView, overlapsRooms, adjacent, doorLinks, reachable, snapRoom, layoutRow, nextRoomPos,
  moveItemBetween, apartmentArea, validateApartment, apartmentHasErrors, PARTITION, twinDoors, doorZones
} from '../public/js/apartment.js';
import { validateAll } from '../public/js/validate.js';
import { state as fixture, item } from './helpers.js';
import {
  state, applyDoc, docFromState, setActiveRoom, syncActive, moveItemToRoom, roomView as liveView
} from '../public/js/state.js';

const door = (id, wall, offset, width = 80) => ({ id, kind: 'door', wall, offset, width, height: 200, hinge: 'start' });
const mk = (id, x, y, L, W, o = {}) => ({
  id, name: id, purpose: o.purpose || '', pos: { x, y }, room: { L, W, H: 270, plinth: 2 },
  items: o.items || [], seq: 50, openings: o.openings || [], obstacles: [], style: undefined
});

// Hall 300×200 at (0,0); living room 400×300 below it across a partition; bath to the right of the hall.
const flat = () => [
  mk('hall', 0, 0, 300, 200, { purpose: 'hall', openings: [door(1, 'north', 100), door(2, 'south', 50), door(3, 'east', 60, 70)] }),
  mk('living', 0, 200 + PARTITION, 400, 300),
  mk('bath', 300 + PARTITION, 0, 170, 200)
];

test('geometry: rects, point lookup, area, overlaps', () => {
  const rooms = flat();
  assert.deepEqual(roomRect(rooms[1]), { x: 0, y: 210, w: 400, h: 300 });
  assert.equal(roomAt(rooms, 100, 300).id, 'living');
  assert.equal(roomAt(rooms, 305, 100), null, 'inside the partition');
  assert.equal(apartmentArea(rooms), 6 + 12 + 3.4);
  assert.deepEqual(overlapsRooms(rooms), []);
  rooms[2].pos.x = 250;
  assert.deepEqual(overlapsRooms(rooms), [['hall', 'bath']]);
});

test('adjacent walls across the partition', () => {
  const [hall, living, bath] = flat();
  assert.deepEqual(adjacent(hall, living), [{ wallA: 'south', wallB: 'north', gap: 10, from: 0, to: 300 }]);
  assert.deepEqual(adjacent(hall, bath).map(a => [a.wallA, a.wallB]), [['east', 'west']]);
  assert.deepEqual(adjacent(living, bath), [{ wallA: 'north', wallB: 'south', gap: 10, from: 310, to: 400 }],
    'the living room runs under the bath');
  bath.pos.x = 420;
  assert.deepEqual(adjacent(living, bath), [], 'only a corner in common');
});

test('door links: neighbour hole in local coordinates, entrance to the outside, reachability', () => {
  const rooms = flat();
  const links = doorLinks(rooms);
  assert.deepEqual(links, [
    { room: 'hall', door: 1, to: 'outside' },
    { room: 'hall', door: 2, to: 'living', wall: 'north', offset: 50, width: 80, height: 200 },
    { room: 'hall', door: 3, to: 'bath', wall: 'west', offset: 60, width: 70, height: 200 }
  ]);
  assert.deepEqual([...reachable(rooms)].sort(), ['bath', 'hall', 'living']);
  rooms[1].pos.y = 260;   // too far for a doorway: the living room is cut off
  assert.deepEqual([...reachable(rooms)].sort(), ['bath', 'hall']);
});

test('doorway from a neighbour: furniture in front of it is an error, also for the active room', () => {
  const rooms = flat();
  // The hall door 2 (south, 50…130) opens into the living room's north wall: 60 cm in front must stay free.
  rooms[1].items = [item({ id: 1, type: 'wardrobe', w: 100, d: 60, h: 220, x: 60, y: 2 }), item({ id: 2, type: 'dresser', w: 80, d: 45, h: 80, x: 200, y: 2 })];
  const errs = validateAll(roomView({ rooms, settings: fixture().settings }, 'living'));
  assert.deepEqual(errs.get(1).map(e => [e.key, e.params.room]), [['err.doorway', 'hall']]);
  assert.deepEqual(errs.get(2), [], 'beside the doorway');
  applyDoc({ rooms, settings: fixture().settings, lighting: {} });
  setActiveRoom('living');
  assert.deepEqual(validateAll(state).get(1).map(e => e.key), ['err.doorway']);
});

test('one door per partition: a door from each side in the same place is one leaf', () => {
  const rooms = flat();
  rooms[1].openings = [door(7, 'north', 60)];          // the living room's own door, 50…130 vs 60…140
  rooms[2].purpose = 'bathroom';
  rooms[2].openings = [door(8, 'west', 60, 70)];       // the bath's door under the hall's door 3
  assert.deepEqual([...twinDoors(rooms)].sort(), ['bath:8', 'hall:2'],
    'the leaf swings into the living room, and out of the bath into the hall');
  assert.deepEqual(doorLinks(rooms).map(l => [l.room, l.door, l.to]),
    [['hall', 1, 'outside'], ['hall', 3, 'bath'], ['living', 7, 'hall']]);
  const hall = roomView({ rooms, settings: fixture().settings }, 'hall');
  assert.deepEqual(hall.twins, [2]);
  assert.equal(doorZones(hall).length, 3, 'hall: entrance and bath leaves + the living room doorway, no own swing at door 2');
  rooms[1].openings = [door(7, 'north', 200)];          // elsewhere: two separate doors
  assert.deepEqual([...twinDoors(rooms)], ['bath:8']);
});

test('room magnet: aligned or one partition away', () => {
  const rooms = flat();
  assert.deepEqual(snapRoom(rooms, 'bath', 318, 7), { x: 310, y: 0 });
  assert.deepEqual(snapRoom(rooms, 'bath', 600, 900), { x: 600, y: 900 }, 'nothing near');
});

test('layout: a row for rooms without a place, next place to the right', () => {
  const rooms = [{ room: { L: 300, W: 200 } }, { room: { L: 200, W: 200 } }];
  layoutRow(rooms);
  assert.deepEqual(rooms.map(r => r.pos), [{ x: 0, y: 0 }, { x: 320, y: 0 }]);
  assert.deepEqual(nextRoomPos(flat()), { x: 500, y: 0 });
});

test('roomView gives every room the old single-room shape', () => {
  const apt = { rooms: flat(), settings: fixture().settings, lighting: {}, catalog: [] };
  apt.rooms[1].items = [item({ x: 380, y: 2 })];   // 100 cm wide from x 380: through the east wall
  const v = roomView(apt, 'living');
  assert.equal(v.settings, apt.settings);
  assert.deepEqual(validateAll(v), validateAll(fixture({ room: { L: 400, W: 300 }, items: apt.rooms[1].items })));
  const res = validateApartment(apt);
  assert.ok(res.rooms.get('living').get(apt.rooms[1].items[0].id).length);
  assert.ok(apartmentHasErrors(res));
  apt.rooms[1].items[0].x = 200;   // inside and clear of the doorway from the hall
  assert.ok(!apartmentHasErrors(validateApartment(apt)));
});

test('moving an item to the next room keeps its place on the plan', () => {
  const [hall, living] = flat();
  const it = item({ id: 7, x: 100, y: 150 });
  hall.items = [it];
  const moved = moveItemBetween(hall, living, it);
  assert.equal(hall.items.length, 0);
  assert.deepEqual([moved.id, moved.x, moved.y], [50, 100, 150 - 210]);
  assert.equal(living.seq, 51);
});

test('state: whole apartment in the undo doc, active room is live', () => {
  const rooms = flat();
  rooms[0].items = [item({ id: 1, x: 10, y: 10 })];
  state.activeRoomId = 'hall';
  applyDoc({ rooms, settings: fixture().settings, lighting: { scene: 'day', ceiling: 'none' } });
  assert.equal(state.room.L, 300);
  state.items[0].x = 20;
  state.items = [...state.items, item({ id: 2, x: 150, y: 10 })];
  const d = docFromState();
  assert.equal(d.rooms[0].items.length, 2, 'live fields written back');
  assert.ok(!('activeRoomId' in d), 'switching rooms is not an undo step');
  assert.ok(setActiveRoom('living'));
  assert.equal(state.room.L, 400);
  assert.equal(liveView('hall').items.length, 2);
  assert.equal(liveView('living'), state);
  setActiveRoom('hall');
  const moved = moveItemToRoom(state.items[1], 'bath');
  assert.equal(state.items.length, 1);
  assert.equal(syncActive().items.length, 1);
  assert.equal(moved.x, 150 - 310);
  applyDoc(d);   // undo
  assert.equal(state.items.length, 2);
  assert.equal(state.rooms.find(r => r.id === 'bath').items.length, 0);
});
