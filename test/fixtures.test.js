import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultFixtures, fixturesOf, fixturesSpec, fixtureSpec, floorLux, clampFixture, FIXTURE_WALL } from '../public/js/lighting.js';
import { normalizeRoom } from '../public/js/storage.js';
import {
  state, applyDoc, docFromState, setActiveRoom, roomFixtures, ownFixture, addFixture, moveFixture,
  removeFixture, cycleFixture, setCeiling, selectFixture
} from '../public/js/state.js';

const room = (id, o = {}) => ({
  id, name: id, purpose: '', pos: { x: o.x || 0, y: 0 }, room: { L: 400, W: 300, H: 270, plinth: 2 },
  items: [], seq: 1, openings: o.openings || [], obstacles: [], style: undefined, ...(o.fixtures ? { fixtures: o.fixtures } : {})
});
const load = (rooms, ceiling = 'chandelier') => {
  applyDoc({ rooms, settings: { snap: 5, gap: 3, grid: 10, minPassage: 60 }, lighting: { scene: 'day', ceiling } });
  setActiveRoom(rooms[0].id) || null;
};

test('a room without its own lights has the layout of the ceiling type (old projects look the same)', () => {
  assert.deepEqual(defaultFixtures('chandelier', 400, 300), [{ id: 1, kind: 'chandelier', x: 200, y: 150 }]);
  assert.equal(defaultFixtures('spots', 550, 430).length, 9);
  assert.deepEqual(defaultFixtures('none', 400, 300), []);
  const old = fixtureSpec('chandelier', 4, 3, 2.7), same = fixturesSpec(fixturesOf({ room: { L: 400, W: 300 } }, { ceiling: 'chandelier' }), 4, 3, 2.7);
  assert.deepEqual(same, old);
  // A spot grid of the type and the same spots placed one by one give the same light.
  const grid = fixtureSpec('spots', 4, 3, 2.7), own = fixturesSpec(defaultFixtures('spots', 400, 300), 4, 3, 2.7);
  assert.deepEqual(own.lights.map(l => [l.x, l.z]), grid.lights.map(l => [l.x, l.z]));
});

test('lights follow the fixtures: a chandelier moved to a corner lights that corner', () => {
  const at = (x, y) => fixturesSpec([{ id: 1, kind: 'chandelier', x, y }], 4, 3, 2.7);
  assert.ok(floorLux(at(80, 80), 0.8, 0.8) > 1.5 * floorLux(at(200, 150), 0.8, 0.8));
  const two = fixturesSpec([{ id: 1, kind: 'chandelier', x: 100, y: 150 }, { id: 2, kind: 'pendant', x: 300, y: 150 }], 4, 3, 2.7);
  assert.equal(two.lights.length, 2);
  assert.ok(floorLux(two, 2, 1.5) > floorLux(at(100, 150), 2, 1.5));
  assert.deepEqual(two.lights.map(l => l.fixture), [1, 2]);
});

test('a fixture keeps off the walls', () => {
  assert.deepEqual(clampFixture(5, 290, 400, 300), { x: FIXTURE_WALL, y: 300 - FIXTURE_WALL });
});

test('placed lights are saved with the room; broken entries are dropped', () => {
  const r = normalizeRoom({ room: { L: 300, W: 300 }, fixtures: [{ id: 3, kind: 'pendant', x: 50, y: 60 }, { kind: 'x', x: 'a' }, { kind: 'lamp', x: 1, y: 2 }] });
  assert.deepEqual(r.fixtures, [{ id: 3, kind: 'pendant', x: 50, y: 60 }, { id: 2, kind: 'chandelier', x: 1, y: 2 }]);
  assert.equal('fixtures' in normalizeRoom({ room: {} }), false);
});

test('editing a light gives the room its own list; a new ceiling type resets every room', () => {
  load([room('a'), room('b', { x: 410 })]);
  assert.equal(state.fixtures, null);
  assert.deepEqual(roomFixtures().map(f => f.kind), ['chandelier']);
  const f = ownFixture(1);
  assert.equal(moveFixture(f, 101, 52).ok, true);
  assert.deepEqual([f.x, f.y], [100, 50]);                 // snapped (5 cm)
  addFixture('pendant');
  assert.deepEqual(state.fixtures.map(x => x.kind), ['chandelier', 'pendant']);
  assert.equal(state.selectedFixture, 2);
  cycleFixture(ownFixture(2));
  assert.equal(ownFixture(2).kind, 'spot');
  removeFixture(1);
  assert.deepEqual(docFromState().rooms[0].fixtures.map(x => x.id), [2]);
  assert.equal(docFromState().rooms[1].fixtures, undefined);
  setCeiling('panel');
  assert.equal(state.fixtures, null);
  assert.deepEqual(roomFixtures().map(x => x.kind), ['panel']);
});

test('a hanging light does not go over a door swing; a spot may', () => {
  const door = { id: 1, kind: 'door', wall: 'north', offset: 40, width: 80, height: 200, hinge: 'start' };
  load([room('a', { openings: [door] })]);
  selectFixture(null);
  const f = ownFixture(1);
  const m = moveFixture(f, 80, 40);
  assert.equal(m.ok, false);
  assert.equal(m.reason.key, 'err.fxDoor');
  assert.deepEqual([f.x, f.y], [200, 150]);
  f.kind = 'spot';
  assert.equal(moveFixture(f, 80, 40).ok, true);
});
