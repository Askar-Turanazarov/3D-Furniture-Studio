import { test } from 'node:test';
import assert from 'node:assert/strict';
import { largestFit } from '../public/js/autoplace.js';
import { validateAll, hasErrors } from '../public/js/validate.js';
import { state, item } from './helpers.js';

// Two wall ledges on the north wall leave a 150 cm niche (x 100…250).
const ledges = () => [
  { id: 1, kind: 'ledge', x: 0, y: 0, w: 100, d: 60, h: 270, elev: 0 },
  { id: 2, kind: 'ledge', x: 250, y: 0, w: 150, d: 60, h: 270, elev: 0 }
];
const wardrobe = fit => ({ id: 99, type: 'wardrobe', ...fit.item, open: { kind: 'slide' } });

test('fills a 150 cm niche between ledges: gaps on both sides, width down to a 5 cm step', () => {
  const s = state({ obstacles: ledges() });
  const fit = largestFit({ x: 175, y: 20 }, s);
  assert.equal(fit.ok, true);
  assert.equal(fit.wall, 'north');
  assert.equal(fit.free, 144);                       // 150 − 2 × gap 3
  assert.deepEqual(fit.item, { w: 140, d: 60, h: 263, x: 105, y: 2, rot: 0 });
  s.items.push(wardrobe(fit));
  assert.equal(hasErrors(validateAll(s)), false);
});

test('a ceiling duct at 240 cm limits the height to 235', () => {
  const duct = { id: 3, kind: 'ceilingDuct', x: 0, y: 0, w: 400, d: 30, h: 30, elev: 240 };
  const s = state({ obstacles: [...ledges(), duct] });
  const fit = largestFit({ x: 175, y: 20 }, s);
  assert.equal(fit.item.h, 235);
  s.items.push(wardrobe(fit));
  assert.equal(hasErrors(validateAll(s)), false);
});

test('works on every wall with the back to the wall', () => {
  const s = state();
  for (const [pt, wall, rot] of [[{ x: 200, y: 280 }, 'south', 180], [{ x: 10, y: 150 }, 'west', 270], [{ x: 390, y: 150 }, 'east', 90]]) {
    const fit = largestFit(pt, s);
    assert.equal(fit.wall, wall);
    assert.equal(fit.item.rot, rot);
    const t = state({ items: [wardrobe(fit)] });
    assert.equal(hasErrors(validateAll(t)), false, wall);
  }
});

test('keeps the passage in front and stops at furniture and doors', () => {
  // Bed 100 cm from the north wall: depth = 100 − 2 − 60 = 38.
  const bed = item({ w: 160, d: 150, x: 120, y: 100 });
  const fit = largestFit({ x: 200, y: 10 }, state({ items: [bed] }));
  assert.equal(fit.item.d, 38);
  // A door swing at x 300…380 on the north wall ends the run.
  const door = { id: 1, kind: 'door', wall: 'north', offset: 300, width: 80, height: 200 };
  const f2 = largestFit({ x: 100, y: 10 }, state({ openings: [door] }));
  assert.equal(f2.free, 298);
  assert.equal(f2.item.w, 295);
});

test('explains a refusal', () => {
  const it = item({ w: 100, d: 60, x: 150, y: 2 });
  assert.equal(largestFit({ x: 200, y: 10 }, state({ items: [it] })).key, 'niche.occupied');
  const narrow = [{ id: 1, kind: 'ledge', x: 0, y: 0, w: 180, d: 60, h: 270, elev: 0 }, { id: 2, kind: 'ledge', x: 210, y: 0, w: 190, d: 60, h: 270, elev: 0 }];
  assert.equal(largestFit({ x: 195, y: 10 }, state({ obstacles: narrow })).key, 'niche.narrow');
  const sofa = item({ w: 200, d: 90, x: 100, y: 70 });
  assert.equal(largestFit({ x: 200, y: 10 }, state({ items: [sofa] })).key, 'niche.shallow');
});
