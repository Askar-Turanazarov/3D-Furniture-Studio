import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { itemLook, hasFacade, setItemMaterial, setItemColor } from '../public/js/materials.js';
import { item } from './helpers.js';

const cat = JSON.parse(fs.readFileSync(new URL('../catalog.json', import.meta.url), 'utf8'));
const M = cat.materials;

test('catalog materials: ids unique, kinds known, names in 3 languages', () => {
  assert.equal(new Set(M.map(m => m.id)).size, M.length);
  for (const m of M) {
    assert.ok(['wood', 'solid', 'gloss', 'fabric'].includes(m.kind), m.id);
    assert.match(m.color, /^#[0-9a-f]{6}$/i);
    assert.ok(m.priceRate > 0);
    for (const l of ['ru', 'uz', 'en']) assert.ok(m.name[l], `${m.id} ${l}`);
  }
});

test('facade falls back to the body; no materials → nulls', () => {
  assert.deepEqual(itemLook(item(), M), { body: null, facade: null });
  const it = item({ materials: { body: 'walnut' } });
  assert.equal(itemLook(it, M).facade.id, 'walnut');
  it.materials.facade = 'gloss-white';
  assert.equal(itemLook(it, M).facade.id, 'gloss-white');
  assert.equal(itemLook(it, M).body.id, 'walnut');
});

test('hasFacade from the catalog type', () => {
  assert.equal(hasFacade({ type: 'wardrobe' }, cat.items), true);
  assert.equal(hasFacade({ type: 'bed' }, cat.items), false);
});

test('body material sets the plan colour; own colour drops the body material only', () => {
  const it = item({ color: '#000000' });
  const shared = { body: 'oak-sonoma' };
  it.materials = shared;
  setItemMaterial(it, 'facade', M.find(m => m.id === 'graphite'));
  assert.equal(shared.facade, undefined, 'the object is replaced, never mutated (duplicates may share it)');
  setItemMaterial(it, 'body', M.find(m => m.id === 'walnut'));
  assert.equal(it.color, '#7a5236');
  setItemColor(it, '#123456');
  assert.deepEqual(it.materials, { facade: 'graphite' });
  setItemMaterial(it, 'facade', null);
  assert.equal(it.materials, undefined);
});
