import { test } from 'node:test';
import assert from 'node:assert/strict';
import { narrowPassages } from '../public/js/passages.js';
import { validateWarnings } from '../public/js/validate.js';
import { state, item, room } from './helpers.js';

const keys = (map, id) => (map.get(id) || []).map(e => e.key);
const S = o => ({ ...state({ room: { L: 500, W: 400 }, ...o }), settings: { snap: 5, gap: 3, grid: 10, minPassage: 60 } });

test('bed and wardrobe 50 cm apart: narrow passage on both', () => {
  const bed = item({ type: 'bed', w: 160, d: 200, h: 50, x: 100, y: 2 });
  const wr = item({ type: 'wardrobe', w: 120, d: 60, h: 220, x: 310, y: 2 });
  const s = S({ items: [bed, wr] });
  const ps = narrowPassages(s);
  const p = ps.find(p => p.a.itemId === bed.id && p.b.itemId === wr.id);
  assert.ok(p);
  assert.equal(p.n, 50);
  assert.deepEqual(keys(validateWarnings(s), bed.id).includes('warn.passage'), true);
  assert.deepEqual(keys(validateWarnings(s), wr.id).includes('warn.passage'), true);
});

test('70 cm apart: no warning; 3 cm is a slit, not a passage', () => {
  const bed = item({ w: 160, d: 200, h: 50, x: 100, y: 2 });
  const wr = item({ w: 120, d: 60, h: 220, x: 330, y: 2 });
  assert.equal(narrowPassages(S({ items: [bed, wr] })).some(p => p.a.itemId === bed.id && p.b.itemId === wr.id), false);
  const ns = item({ w: 50, d: 40, h: 55, x: 263, y: 2 });
  assert.equal(narrowPassages(S({ items: [bed, ns] })).some(p => p.b.itemId === ns.id && p.a.itemId === bed.id), false);
});

test('a third item between the pair cancels the passage; walls count', () => {
  const a = item({ w: 100, d: 100, h: 80, x: 100, y: 100 });
  const b = item({ w: 100, d: 100, h: 80, x: 250, y: 100 });
  const mid = item({ w: 30, d: 100, h: 80, x: 210, y: 100 });
  assert.equal(narrowPassages(S({ items: [a, b, mid] })).some(p => p.a.itemId === a.id && p.b.itemId === b.id), false);
  const nearWall = item({ w: 100, d: 50, h: 80, x: 50, y: 300 });   // 48 cm to the west plinth line
  const ps = narrowPassages(S({ items: [nearWall] }));
  assert.deepEqual(ps.map(p => [p.a.wall || p.b.wall, p.n]), [['west', 48], ['south', 48]]);
});

test('a high shelf does not narrow the passage', () => {
  const bed = item({ w: 160, d: 200, h: 50, x: 100, y: 2 });
  const shelf = item({ w: 80, d: 25, h: 4, elev: 160, x: 310, y: 2 });
  assert.equal(narrowPassages(S({ items: [bed, shelf] })).length, 0);
});
