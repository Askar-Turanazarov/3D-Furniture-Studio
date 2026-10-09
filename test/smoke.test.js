import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rectOf } from '../public/js/geometry.js';
import { item } from './helpers.js';

test('client modules load in node', () => {
  assert.deepEqual(rectOf(item({ x: 10, y: 20 })), { x: 10, y: 20, w: 100, h: 50 });
});
