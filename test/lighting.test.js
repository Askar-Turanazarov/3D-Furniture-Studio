import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lightingOf, lampsOn, targetsFor, easeInOut, SCENES, fixtureSpec, floorLux, FLOOR_LUX } from '../public/js/lighting.js';
import { normalizeDoc, exportProject, importProject, makeProject, makeRoom } from '../public/js/storage.js';

test('lightingOf validates and keeps the lamp switch', () => {
  assert.deepEqual(lightingOf(), { scene: 'day', ceiling: 'chandelier', lampsOn: null });
  assert.deepEqual(lightingOf({ scene: 'dusk', ceiling: 'disco', lampsOn: 'yes' }), { scene: 'day', ceiling: 'chandelier', lampsOn: null });
  assert.deepEqual(lightingOf({ scene: 'night', ceiling: 'spots', lampsOn: false }), { scene: 'night', ceiling: 'spots', lampsOn: false });
});

test('lamps: the scene decides unless switched', () => {
  assert.equal(lampsOn({ scene: 'day' }), false);
  assert.equal(lampsOn({ scene: 'evening' }), true);
  assert.equal(lampsOn({ scene: 'night' }), true);
  assert.equal(lampsOn({ scene: 'day', lampsOn: true }), true);
  assert.equal(lampsOn({ scene: 'night', lampsOn: false }), false);
});

test('light targets: numbers and colours, darker towards night', () => {
  const [day, evening, night] = SCENES.map(scene => targetsFor({ scene }));
  for (const t of [day, evening, night]) {
    for (const [k, v] of Object.entries(t)) {
      if (typeof v === 'string') assert.match(v, /^#[0-9a-f]{6}$/i, k);
      else assert.ok(Number.isFinite(v), k);
    }
  }
  assert.ok(day.hemi > evening.hemi && evening.hemi > night.hemi);
  assert.ok(day.sunHeight > evening.sunHeight && night.sunPower === 0);
  assert.equal(night.ceil, 1);
  assert.ok(targetsFor({ scene: 'night', lampsOn: false }).ceil < 0.1);
  assert.ok(targetsFor({ scene: 'day', lampsOn: true }).ceil === 1);
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
  assert.equal(easeInOut(0.5), 0.5);
});

test('lamp switch survives save and import', () => {
  const d = normalizeDoc({ lighting: { scene: 'night', ceiling: 'panel', lampsOn: false } });
  assert.deepEqual(lightingOf(d.lighting), { scene: 'night', ceiling: 'panel', lampsOn: false });
  const p = importProject(exportProject(makeProject('P', [makeRoom('R', {})], { lighting: d.lighting })));
  assert.equal(lightingOf(p.lighting).lampsOn, false);
});

test('ceiling fixtures light the floor evenly, not a flood', () => {
  for (const [L, W, H] of [[3.3, 3.1, 2.7], [5.5, 4.3, 2.95], [4, 3, 2.5]]) {
    for (const c of ['chandelier', 'spots', 'panel']) {
      const s = fixtureSpec(c, L, W, H);
      const centre = floorLux(s, L / 2, W / 2);
      assert.ok(centre > (c === 'spots' ? 0.45 : 0.8) * FLOOR_LUX && centre < 2 * FLOOR_LUX, `${c} ${L}×${W}: ${centre.toFixed(2)} at the centre`);
      assert.ok(floorLux(s, 0.3, 0.3) > 0.15, `${c} ${L}×${W}: the corner is not black`);
    }
  }
});

test('spots are real downlights: housings near the walls, a soft spill, nothing past the wall', () => {
  const s = fixtureSpec('spots', 5.5, 4.3, 2.95);
  assert.equal(s.lights.length, 9);
  assert.deepEqual(s.lights.map(l => [l.x, l.z]), s.discs.map(d => [d.x, d.z]));
  for (const l of s.lights) assert.ok(l.angle <= 0.95 && l.penumbra < 1 && l.distance > 0 && l.clip);
  // The outer housings sit ≈ 0.6 m off the walls: the cone reaches a wall ≈ 0.5 m under the ceiling.
  const nearest = Math.min(...s.lights.map(l => l.x));
  assert.ok(nearest > 0.4 && nearest <= 0.6, nearest);
  assert.ok(nearest / Math.tan(s.lights[0].angle) < 0.6);
  // 1 m behind the wall (the next room) a spot gives nothing: the 3D clips it to its room.
  assert.equal(floorLux(s, -1, 4.3 / 2), 0);
  assert.equal(floorLux(fixtureSpec('spots', 4, 3, 2.7, { merged: true }), 4.5, 1.5), 0);
});

test('merged spots keep the light output of the grid', () => {
  const grid = fixtureSpec('spots', 4, 3, 2.7), one = fixtureSpec('spots', 4, 3, 2.7, { merged: true });
  assert.equal(one.lights.length, 1);
  assert.equal(one.discs.length, grid.discs.length);
  const c = floorLux(one, 2, 1.5);
  assert.ok(c > 0.6 * FLOOR_LUX && c < 2 * FLOOR_LUX, c.toFixed(2));
});

test('no fixture, no lights', () => {
  assert.deepEqual(fixtureSpec('none', 4, 3, 2.7), { lights: [], discs: [] });
});

test('lamps on: their bounce lifts the night, not the day', () => {
  const night = targetsFor({ scene: 'night', lampsOn: true }), evening = targetsFor({ scene: 'evening' });
  assert.ok(night.bounce > evening.bounce && evening.bounce > 0);
  assert.equal(targetsFor({ scene: 'day', lampsOn: true }).bounce, 0);
  assert.equal(targetsFor({ scene: 'night', lampsOn: false }).bounce, 0);
});
