// Every room template must open without errors or warnings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateAll, validateWarnings, obstacleWarnings } from '../public/js/validate.js';
import { templateDoc, sizeLabel } from '../public/js/templates.js';

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

test('templateDoc: fresh ids and seq counters, template untouched', () => {
  const t = data.templates.find(x => x.id === 'sov-kitchen');
  const before = JSON.stringify(t);
  const doc = templateDoc(t, { plinth: 3, settings: { snap: 3 } });
  assert.equal(JSON.stringify(t), before);
  assert.deepEqual(doc.items.map(i => i.id), t.items.map((_, i) => i + 1));
  assert.equal(doc.seq, t.items.length + 1);
  assert.equal(doc.opSeq, t.openings.length + 1);
  assert.equal(doc.obSeq, t.obstacles.length + 1);
  assert.equal(doc.room.plinth, 3);
  assert.equal(doc.settings.snap, 3);
  doc.items[0].x = 999;
  assert.notEqual(t.items[0].x, 999);
});

test('sizeLabel: area and metres per language', () => {
  assert.equal(sizeLabel({ L: 400, W: 300 }, 'en', 'm²', 'm'), '12 m² · 4×3 m');
  assert.equal(sizeLabel({ L: 360, W: 270 }, 'ru', 'м²', 'м'), '9,7 м² · 3,6×2,7 м');
});
