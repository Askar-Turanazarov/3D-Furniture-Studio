import { test } from 'node:test';
import assert from 'node:assert/strict';
import { styleOf, itemStyle, DEFAULT_STYLE } from '../public/js/style.js';
import { normalizeDoc } from '../public/js/storage.js';

test('styleOf fills defaults and drops bad values', () => {
  assert.deepEqual(styleOf(), DEFAULT_STYLE);
  const s = styleOf({ wall: { material: 'brick', color: 'red' }, accentWall: 'up', floor: 'tile', furniture: 'loft' });
  assert.deepEqual(s.wall, { material: 'brick', color: '#ffffff' });
  assert.equal(s.accentWall, null);
  assert.equal(s.floor, 'tile');
  assert.equal(s.furniture, 'loft');
  assert.deepEqual(styleOf(s), s);
});

test('item style overrides the room style', () => {
  assert.equal(itemStyle({}, { furniture: 'classic' }), 'classic');
  assert.equal(itemStyle({ style: 'loft' }, { furniture: 'classic' }), 'loft');
  assert.equal(itemStyle({ style: 'baroque' }, undefined), 'modern');
});

test('normalizeDoc adds the room style', () => {
  assert.deepEqual(normalizeDoc({}).style, DEFAULT_STYLE);
  assert.equal(normalizeDoc({ style: { floor: 'carpet' } }).style.floor, 'carpet');
});
