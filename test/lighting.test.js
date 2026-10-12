import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lightingOf, lampsOn, targetsFor, easeInOut, SCENES } from '../public/js/lighting.js';
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
  const p = importProject(exportProject(makeProject('P', [makeRoom('R', d)])));
  assert.equal(lightingOf(p.rooms[0].lighting).lampsOn, false);
});
