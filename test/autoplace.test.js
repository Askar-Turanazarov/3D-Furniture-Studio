import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSpot } from '../public/js/autoplace.js';
import { validateAll, hasErrors } from '../public/js/validate.js';
import { state, item } from './helpers.js';

const place = (it, res) => Object.assign(it, { x: res.x, y: res.y, rot: res.rot });

test('finds a valid spot in an empty room', () => {
  const it = item({ x: -50, y: -50 });
  const s = state({ items: [it] });
  const res = findSpot(it, s);
  assert.equal(res.ok, true);
  place(it, res);
  assert.equal(hasErrors(validateAll(s)), false);
});

test('never places furniture in a door swing', () => {
  const door = { id: 1, kind: 'door', wall: 'north', offset: 2, width: 80, height: 200 };
  const it = item({ w: 60, d: 40, x: -50, y: -50 });
  const s = state({ items: [it], openings: [door] });
  const res = findSpot(it, s);
  assert.equal(res.ok, true);
  place(it, res);
  assert.equal(hasErrors(validateAll(s)), false);
});

test('explains why an item does not fit', () => {
  assert.deepEqual(findSpot(item({ w: 500, d: 50 }), state()), { ok: false, key: 'auto.tooBigL', params: { n: 104 } });
  assert.deepEqual(findSpot(item({ h: 280 }), state()), { ok: false, key: 'auto.tooTall', params: { n: 10 } });
});

test('reports the shortfall when the room is full', () => {
  const big = item({ w: 396, d: 250, x: 2, y: 2 });
  const it = item({ w: 200, d: 60 });
  const res = findSpot(it, state({ items: [big, it] }));
  assert.equal(res.ok, false);
  assert.ok(['auto.deficit', 'auto.noSpace'].includes(res.key));
});
