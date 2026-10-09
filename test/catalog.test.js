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
