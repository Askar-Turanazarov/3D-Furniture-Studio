// Apartment templates (apartments.json): sound plans that stay valid empty and furnished.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { overlapsRooms, reachable, doorLinks, roomRect, apartmentArea, roomView, entrances } from '../public/js/apartment.js';
import { validateAll } from '../public/js/validate.js';
import { furnish, kitsFor } from '../public/js/furnish.js';
import { aptRooms, furnishRooms } from '../public/js/aptTemplates.js';

const read = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
const catalog = read('catalog.json').items;
const data = read('apartments.json');
const settings = { snap: 5, gap: 3, grid: 10, minPassage: 60 };
const aptOf = a => ({ rooms: aptRooms(a, 'ru'), settings, catalog });
const errorsOf = apt => apt.rooms.flatMap(r => [...validateAll(roomView(apt, r.id))]
  .filter(([, e]) => e.length).map(([id, e]) => `${r.name} #${id}: ${e.join(', ')}`));

test('three sets, 13 apartments, names in three languages', () => {
  assert.deepEqual(data.sets.map(s => s.id), ['khrushchevka', 'improved', 'newbuild']);
  assert.equal(data.apartments.length, 13);
  for (const a of data.apartments) {
    assert.ok(data.sets.some(s => s.id === a.set), a.id);
    for (const l of ['ru', 'uz', 'en']) {
      assert.ok(a.name[l], `${a.id} ${l}`);
      for (const r of a.plan) assert.ok(r.name[l], `${a.id} ${r.key} ${l}`);
    }
  }
  const H = { khrushchevka: 250, improved: 265, newbuild: 280 };
  for (const a of data.apartments) for (const r of a.plan) assert.equal(r.room.H, H[a.set], a.id);
});

for (const a of data.apartments) {
  test(`${a.id}: plan`, () => {
    const rooms = aptRooms(a, 'en');
    assert.deepEqual(overlapsRooms(rooms), [], 'rooms do not overlap');
    const links = doorLinks(rooms);
    assert.equal(links.filter(l => l.to === 'outside').length, 1, 'one entrance door');
    const hall = rooms.find(r => r.purpose === 'hall');
    assert.deepEqual(entrances(rooms, links), [hall.id], 'the entrance is in the hallway');
    assert.equal(reachable(rooms, links).size, rooms.length, 'every room is reachable from the hallway');
    // ±10 % of the stated area (the sum of the interiors)
    assert.ok(Math.abs(apartmentArea(rooms) - a.area) <= a.area * 0.1, `${apartmentArea(rooms)} vs ${a.area}`);
    // a window in every living room and kitchen, windows only on outer walls
    for (const r of rooms) {
      const wins = r.openings.filter(o => o.kind === 'window');
      if (['living', 'bedroom', 'kids', 'study', 'kitchen', 'kitchenLiving'].includes(r.purpose)) assert.ok(wins.length, `${r.name}: window`);
      for (const o of wins) {
        const b = roomRect(r), d = 50;
        const strip = {
          north: { x: b.x + o.offset, y: b.y - d, w: o.width, h: d },
          south: { x: b.x + o.offset, y: b.y + b.h, w: o.width, h: d },
          west: { x: b.x - d, y: b.y + o.offset, w: d, h: o.width },
          east: { x: b.x + b.w, y: b.y + o.offset, w: d, h: o.width }
        }[o.wall];
        for (const q of rooms) {
          const c = roomRect(q);
          const hit = strip.x < c.x + c.w && c.x < strip.x + strip.w && strip.y < c.y + c.h && c.y < strip.y + strip.h;
          assert.ok(!hit, `${r.name}: window on the ${o.wall} wall faces ${q.name}`);
        }
      }
    }
    // building norms (rounded): main room, bedrooms, kitchen, bathroom
    for (const r of rooms) {
      const m2 = r.room.L * r.room.W / 1e4, short = Math.min(r.room.L, r.room.W);
      if (['bedroom', 'kids', 'study'].includes(r.purpose)) assert.ok(m2 >= 7 && short >= 240, `${r.name} ${m2}`);
      if (r.purpose === 'kitchen') assert.ok(m2 >= 5.5, `${r.name} ${m2}`);
      if (r.purpose === 'kitchenLiving') assert.ok(m2 >= 16, `${r.name} ${m2}`);
      if (r.purpose === 'living') assert.ok(m2 >= 14, `${r.name} ${m2}`);
    }
  });

  test(`${a.id}: valid empty and furnished (5 seeds)`, () => {
    const apt = aptOf(a);
    assert.deepEqual(errorsOf(apt), []);
    for (let seed = 1; seed <= 5; seed++) {
      const f = aptOf(a);
      const n = furnishRooms(f, { seed, catalog });
      assert.ok(n > a.plan.length, `${a.id} seed ${seed}: ${n} items`);
      assert.deepEqual(errorsOf(f), [], `${a.id} seed ${seed}`);
    }
  });
}

test('aptRooms: fresh ids, positions and openings copied, the template untouched', () => {
  const a = data.apartments[0], before = JSON.stringify(a);
  const r1 = aptRooms(a, 'uz'), r2 = aptRooms(a, 'uz');
  assert.equal(JSON.stringify(a), before);
  assert.notEqual(r1[0].id, r2[0].id);
  assert.equal(r1[0].name, a.plan[0].name.uz);
  assert.deepEqual(r1[0].pos, a.plan[0].pos);
  assert.equal(r1[0].room.plinth, 2);
  assert.equal(r1[0].opSeq, a.plan[0].openings.length + 1);
  r1[0].openings[0].width = 1;
  assert.notEqual(a.plan[0].openings[0].width, 1);
});

test('furnishRooms: kitless rooms stay empty, the seed repeats the result', () => {
  const a = data.apartments.find(x => x.plan.some(r => r.purpose === 'other'));
  const f1 = aptOf(a), f2 = aptOf(a);
  furnishRooms(f1, { seed: 7, catalog });
  furnishRooms(f2, { seed: 7, catalog });
  assert.deepEqual(f1.rooms.map(r => r.items), f2.rooms.map(r => r.items));
  assert.deepEqual(f1.rooms.find(r => r.purpose === 'other').items, []);
  assert.equal(kitsFor('other').length, 0);
  assert.ok(furnish);
});
