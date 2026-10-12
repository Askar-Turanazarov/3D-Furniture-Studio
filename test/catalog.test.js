import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCatalog } from '../public/js/catalog.js';

test('v1 array and v2 object both parse', () => {
  const items = [{ type: 'bed', w: 160, d: 200, h: 50 }];
  assert.deepEqual(parseCatalog(items), { items, materials: [], pricing: {} });
  assert.deepEqual(parseCatalog({ version: 2, items, materials: [{ id: 'oak' }], pricing: { a: 1 } }).materials, [{ id: 'oak' }]);
  assert.deepEqual(parseCatalog(null).items, []);
});

test('catalog.json is v2 with unique types and sane sizes', () => {
  const c = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url), 'utf8'));
  assert.equal(c.version, 2);
  const { items } = parseCatalog(c);
  assert.equal(new Set(items.map(i => i.type)).size, items.length);
  for (const i of items) {
    assert.ok(i.name.ru && i.name.uz && i.name.en, i.type);
    for (const k of ['w', 'd', 'h']) assert.ok(i[k] > 0 && i[k] <= 600, `${i.type}.${k}`);
    assert.ok(!i.elev || i.elev + i.h <= 300, `${i.type} elev`);
  }
});

test('every catalog type has a category and the room purposes it suits', () => {
  const c = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url), 'utf8'));
  const cats = ['storage', 'beds', 'seating', 'tables', 'kitchen', 'bath', 'hall', 'decor', 'light'];
  const purposes = ['bedroom', 'kids', 'living', 'kitchen', 'kitchenLiving', 'study', 'hall', 'bathroom', 'other'];
  assert.ok(c.items.length >= 50);
  for (const i of c.items) {
    assert.ok(cats.includes(i.cat), `${i.type}.cat`);
    assert.ok(i.rooms?.length && i.rooms.every(r => purposes.includes(r)), `${i.type}.rooms`);
    assert.ok(!i.layer || i.layer === 'decor', `${i.type}.layer`);
  }
  for (const p of purposes.filter(p => p !== 'other')) assert.ok(c.items.some(i => i.rooms.includes(p)), p);
  // Wall items fit a 250 cm khrushchevka ceiling (a mezzanine is made to the ceiling).
  for (const i of c.items.filter(i => i.type !== 'mezzanine')) assert.ok((i.elev || 0) + i.h <= 250, `${i.type} height`);
});
