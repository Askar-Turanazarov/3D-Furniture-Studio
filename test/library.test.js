import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { styleOf, surfacesOf, FLOORS, WALL_MATS, FINISHES, TEX_SLOTS } from '../public/js/style.js';

const root = new URL('../public/textures/', import.meta.url);
const library = JSON.parse(readFileSync(new URL('library.json', root), 'utf8'));

test('library entries are complete and unique', () => {
  const ids = new Set();
  for (const e of library) {
    assert.match(e.id, /^[a-zA-Z0-9]+$/, e.id);
    assert.ok(!ids.has(e.id), 'duplicate ' + e.id);
    ids.add(e.id);
    assert.ok(['floor', 'wall', 'rough', 'furniture', 'site'].includes(e.kind), e.id);
    if (e.maps) assert.ok(e.maps.includes('color') && e.maps.every(k => ['color', 'normal', 'roughness', 'opacity'].includes(k)), e.id + ' maps');
    assert.ok(e.tile > 0, e.id);
    for (const l of ['ru', 'uz', 'en']) assert.ok(e.name[l], `${e.id} name.${l}`);
    assert.ok(e.source?.ambientcg, e.id);
    if (e.style?.floor) assert.ok(FLOORS.includes(e.style.floor), e.id);
    if (e.style?.wall) assert.ok(WALL_MATS.includes(e.style.wall), e.id);
    if (e.style?.finish) assert.ok(FINISHES.includes(e.style.finish), e.id);
    if (e.kind === 'rough') assert.ok(TEX_SLOTS.includes(e.slot), e.id + ' slot');
    if (!e.bundled) assert.ok(e.mb > 0, e.id + ' mb');
  }
  assert.ok(library.filter(e => e.bundled).length >= 14);
  assert.ok(library.length >= 40);
});

test('bundled sets have their maps in the repository', () => {
  for (const e of library.filter(x => x.bundled)) {
    for (const f of e.maps || ['color', 'normal', 'roughness']) {
      const p = new URL(`sets/${e.id}/${f}.jpg`, root);
      assert.ok(existsSync(p), `${e.id}/${f}.jpg`);
      assert.ok(statSync(p).size > 10000, `${e.id}/${f}.jpg is too small`);
    }
  }
});

test('every library set named by a style exists in the library', () => {
  const ids = new Set(library.map(e => e.id));
  for (const floor of FLOORS) for (const material of WALL_MATS) for (const finish of FINISHES) {
    const s = surfacesOf({ floor, wall: { material, color: '#ffffff' }, finish });
    if (s.floorSet) assert.ok(ids.has(s.floorSet), s.floorSet);
    if (s.wallSet) assert.ok(ids.has(s.wallSet), s.wallSet);
  }
});

test('finish levels: rough and pre-finish hide the chosen finish', () => {
  const st = { floor: 'marble', wall: { material: 'brick', color: '#b5654a' }, accentWall: 'north' };
  const fin = surfacesOf(st);
  assert.deepEqual([fin.floor, fin.wall, fin.accent, fin.plinth, fin.doorLeaves], ['marble', 'brick', true, true, true]);
  const pre = surfacesOf({ ...st, finish: 'prefinish' });
  assert.deepEqual([pre.floor, pre.wall, pre.accent, pre.plinth, pre.doorLeaves], ['screed', 'putty', false, false, true]);
  const rough = surfacesOf({ ...st, finish: 'rough' });
  assert.deepEqual([rough.floor, rough.wall, rough.ceiling, rough.plinth, rough.doorLeaves], ['screed', 'blocks', 'concrete', false, false]);
  // The chosen finish is kept: back to finished restores it.
  assert.equal(styleOf({ ...st, finish: 'rough' }).floor, 'marble');
  assert.equal(styleOf({ finish: 'bogus' }).finish, 'finished');
});
