import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { furnish, kitsFor, kitFits } from '../public/js/furnish.js';
import { KITS } from '../public/js/kits.js';
import { validateAll } from '../public/js/validate.js';
import { defaultOpenings } from '../public/js/openings.js';

const catalog = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url), 'utf8')).items;
const settings = { snap: 5, gap: 3, grid: 10, minPassage: 60 };

// A room of the kit's minimal size or bigger; hallways and bathrooms without a window.
function view(kit, W, L) {
  const room = { L, W, H: 270, plinth: 2 };
  const noWin = kit.purpose === 'hall' || kit.purpose === 'bathroom';
  return { room, items: [], openings: defaultOpenings(room).filter(o => !noWin || o.kind === 'door'), obstacles: [], settings, catalog, seq: 1 };
}
const mandatory = kit => kit.items.filter(s => s.optional == null);

test('every purpose has kits, every kit type is in the catalog', () => {
  for (const p of ['bedroom', 'kids', 'living', 'kitchen', 'kitchenLiving', 'study', 'hall', 'bathroom']) assert.ok(kitsFor(p).length >= 3, p);
  for (const k of KITS) for (const s of k.items) assert.ok(catalog.some(c => c.type === s.type), `${k.id}: ${s.type}`);
});

test('every kit × 3 room sizes × 10 seeds: no errors, the mandatory items are there', () => {
  for (const kit of KITS) {
    const [s, l] = kit.min;
    for (const [W, L] of [[s, l], [s + 40, l + 60], [s + 100, l + 150]]) {
      for (let seed = 1; seed <= 10; seed++) {
        const v = view(kit, W, L);
        const res = furnish(v, kit, { seed, catalog });
        const where = `${kit.id} ${L}×${W} seed ${seed}`;
        const errs = [...validateAll({ ...v, items: res.items })].filter(([, e]) => e.length);
        assert.deepEqual(errs, [], where);
        assert.deepEqual(res.skipped, [], where);
        for (const m of mandatory(kit)) {
          const orphan = (m.at || []).every(r => r.rel && !kit.items.some(x => x.key === r.to && x.optional == null));
          if (!orphan) assert.ok(res.items.some(i => i.type === m.type), `${where}: ${m.type}`);
        }
        assert.equal(new Set(res.items.map(i => i.id)).size, res.items.length, 'unique ids');
        assert.ok(res.seq > Math.max(...res.items.map(i => i.id)));
      }
    }
  }
});

test('the seed picks the variant; the same seed gives the same room', () => {
  const kit = kitsFor('living')[0];
  const a = furnish(view(kit, 400, 500), kit, { seed: 1, catalog });
  const b = furnish(view(kit, 400, 500), kit, { seed: 1, catalog });
  assert.deepEqual(a, b);
  const looks = new Set();
  for (let seed = 1; seed <= 10; seed++) looks.add(JSON.stringify(furnish(view(kit, 400, 500), kit, { seed, catalog }).items));
  assert.ok(looks.size >= 5, 'different seeds, different rooms');
});

test('relations: nightstands at the bed, TV opposite the sofa, painting above it', () => {
  const bed = KITS.find(k => k.id === 'bedroom-classic');
  const r = furnish(view(bed, 350, 420), bed, { seed: 3, catalog }).items;
  const b = r.find(i => i.type === 'bed');
  assert.equal(r.filter(i => i.type === 'nightstand').length, 2, 'a pair');
  for (const n of r.filter(i => i.type === 'nightstand')) {
    assert.equal(n.rot, b.rot, 'same direction as the bed');
    const side = b.rot % 180 === 0 ? n.y === b.y || n.y + n.d === b.y + b.d : n.x === b.x || n.x + n.d === b.x + b.d;
    assert.ok(side, 'back to the same wall');
  }
  const liv = KITS.find(k => k.id === 'living-tv');
  let facing = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const it = furnish(view(liv, 400, 500), liv, { seed, catalog }).items;
    const sofa = it.find(i => i.type === 'sofa'), tvs = it.find(i => i.type === 'tvstand');
    if ((sofa.rot + 180) % 360 === tvs.rot) facing++;
    const pic = it.find(i => i.type === 'painting');
    if (pic) assert.ok(pic.elev >= sofa.h && pic.rot === sofa.rot, 'above the sofa');
  }
  assert.ok(facing >= 8, 'the TV faces the sofa');
});

test('in a room with furniture the new items avoid it; doorways of the neighbours stay free', () => {
  const kit = kitsFor('bedroom')[0];
  const v = view(kit, 350, 420);
  v.items = [{ id: 1, type: 'wardrobe', w: 200, d: 60, h: 220, x: 2, y: 2, rot: 0 }];
  v.seq = 2;
  v.doorways = [{ kind: 'doorway', wall: 'west', offset: 150, width: 80, height: 200, from: 'h', fromName: 'Hall' }];
  const res = furnish(v, kit, { seed: 5, catalog });
  assert.equal(res.items[0].id, 1);
  assert.ok(res.items.length > 3);
  assert.deepEqual([...validateAll({ ...v, items: res.items })].filter(([, e]) => e.length), []);
});

test('kitsFor: only the kits that fit the room, all of them when none does', () => {
  assert.ok(kitsFor('living', { L: 500, W: 400 }).length > kitsFor('living', { L: 320, W: 300 }).length);
  assert.ok(kitsFor('living', { L: 300, W: 200 }).length > 0);
  assert.ok(kitFits(KITS[0], { L: KITS[0].min[1], W: KITS[0].min[0] }));
  assert.deepEqual(kitsFor('other'), []);
});
