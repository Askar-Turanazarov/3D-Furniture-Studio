// Every room template must open without errors or warnings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateAll, validateWarnings, obstacleWarnings } from '../public/js/validate.js';

const read = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
const catalog = read('catalog.json').items;
const data = read('templates.json');

const stateOf = t => ({
  room: { ...t.room, plinth: 2 },
  settings: { snap: 5, gap: 3, grid: 10, minPassage: 60 },
  catalog,
  items: t.items.map((x, i) => ({ id: i + 1, ...x })),
  openings: t.openings.map((x, i) => ({ id: i + 1, ...x })),
  obstacles: t.obstacles.map((x, i) => ({ id: i + 1, ...x }))
});
const flat = map => [...map.values()].flat();

test('templates: two sets, names in three languages', () => {
  assert.deepEqual(data.sets.map(s => s.id), ['soviet', 'newbuild']);
  for (const t of data.templates) {
    assert.ok(data.sets.some(s => s.id === t.set), t.id);
    for (const l of ['ru', 'uz', 'en']) assert.ok(t.name[l], `${t.id} ${l}`);
    for (const it of t.items) assert.ok(catalog.some(c => c.type === it.type), `${t.id} ${it.type}`);
  }
});

for (const t of data.templates) {
  test(`template ${t.id}: no errors, no warnings`, () => {
    const st = stateOf(t);
    assert.deepEqual(flat(validateAll(st)), []);
    assert.deepEqual(flat(validateWarnings(st)), []);
    assert.deepEqual(flat(obstacleWarnings(st)), []);
  });
}

test('apartments reference existing templates of their set', () => {
  for (const a of data.apartments) {
    assert.ok(a.rooms.length >= 2, a.id);
    for (const id of a.rooms) assert.equal(data.templates.find(t => t.id === id)?.set, a.set, `${a.id} → ${id}`);
  }
});
