import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAll, validateWarnings, hasErrors } from '../public/js/validate.js';
import { state, item } from './helpers.js';

const keys = (map, id) => (map.get(id) || []).map(e => e.key);

test('a correctly placed item has no errors', () => {
  const it = item({ x: 2, y: 2 });
  const res = validateAll(state({ items: [it] }));
  assert.deepEqual(keys(res, it.id), []);
  assert.equal(hasErrors(res), false);
});

test('outside the plinth line: err.wall with the overshoot', () => {
  const it = item({ x: 0, y: 2 });
  const res = validateAll(state({ items: [it] }));
  assert.deepEqual(res.get(it.id), [{ key: 'err.wall', params: { wall: 'west', n: 2 } }]);
});

test('overlap and too small gap are reported on both items', () => {
  const a = item({ x: 2, y: 2 }), b = item({ x: 50, y: 2 });
  const res = validateAll(state({ items: [a, b] }));
  assert.deepEqual(keys(res, a.id), ['err.overlap']);
  assert.deepEqual(keys(res, b.id), ['err.overlap']);
  const c = item({ x: 2, y: 2 }), d = item({ x: 103, y: 2 });
  const res2 = validateAll(state({ items: [c, d] }));
  assert.deepEqual(res2.get(c.id), [{ key: 'err.gap', params: { otherId: d.id, n: 1 } }]);
  const e = item({ x: 2, y: 2 }), f = item({ x: 105, y: 2 });
  assert.equal(hasErrors(validateAll(state({ items: [e, f] }))), false);
});

test('taller than the ceiling: err.height', () => {
  const it = item({ h: 300 });
  assert.deepEqual(validateAll(state({ items: [it] })).get(it.id), [{ key: 'err.height', params: { n: 30 } }]);
});

test('in the door swing: err.door', () => {
  const door = { id: 1, kind: 'door', wall: 'south', offset: 100, width: 80, height: 200 };
  const it = item({ x: 100, y: 200 });
  assert.deepEqual(keys(validateAll(state({ items: [it], openings: [door] })), it.id), ['err.door']);
  const ok = item({ x: 200, y: 200 });
  assert.deepEqual(keys(validateAll(state({ items: [ok], openings: [door] })), ok.id), []);
});

test('tall item in front of a window: a warning, not an error', () => {
  const win = { id: 1, kind: 'window', wall: 'north', offset: 100, width: 100, sill: 85, height: 140 };
  const tall = item({ x: 100, y: 2, h: 200 }), low = item({ x: 250, y: 2, h: 60 });
  const s = state({ items: [tall, low], openings: [win] });
  // (the 50 cm between them is also a narrow passage — see passages.test.js)
  const win_ = id => keys(validateWarnings(s), id).filter(k => k !== 'warn.passage');
  assert.deepEqual(win_(tall.id), ['warn.window']);
  assert.deepEqual(win_(low.id), []);
  assert.equal(hasErrors(validateAll(s)), false);
});
