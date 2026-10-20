// Generates apartment-templates.json: typical apartments of three sets (khrushchevka, improved layout, new build).
// Sizes follow typical floor plans of the series (rounded); no plan images are used.
// A layout is rooms as rectangles on the apartment plan (cm, x → east, y → south, 10 cm partitions),
// doors between neighbours (the wall and offset are found from the plan), windows on outer walls.
// Run: node scripts/gen-apartments.mjs
import fs from 'node:fs';
import { adjacent, wallLine, apartmentArea } from '../public/js/apartment.js';

const NAMES = {
  hall: ['Прихожая', 'Dahliz', 'Hallway'],
  living: ['Гостиная', 'Mehmonxona', 'Living room'],
  bedroom: ['Спальня', 'Yotoqxona', 'Bedroom'],
  kids: ['Детская', 'Bolalar xonasi', 'Kids room'],
  study: ['Кабинет', 'Ish xonasi', 'Study'],
  kitchen: ['Кухня', 'Oshxona', 'Kitchen'],
  kitchenLiving: ['Кухня-гостиная', 'Oshxona-mehmonxona', 'Kitchen-living room'],
  bathroom: ['Ванная', 'Hammom', 'Bathroom'],
  wc: ['Туалет', 'Hojatxona', 'WC'],
  other: ['Кладовая', 'Omborxona', 'Storage']
};
const name = ([ru, uz, en], n) => n ? { ru: `${ru} ${n}`, uz: `${uz} ${n}`, en: `${en} ${n}` } : { ru, uz, en };

/**
 * spec = { rooms: [[key, purpose, x, y, L, W, n?]], doors: [[owner, other, at?, width?]],
 *          windows: [[key, wall, count?]], entrance: [key, wall, at] }
 * at — the door start along the shared span from its start (default 15 cm from the corner).
 */
function build(id, set, rooms, size, area, series, H, spec) {
  const plan = spec.rooms.map(([key, purpose, x, y, L, W, n]) => ({
    key, purpose: purpose === 'wc' ? 'bathroom' : purpose, name: name(NAMES[purpose], n),
    pos: { x, y }, room: { L, W, H }, openings: []
  }));
  const by = k => plan.find(r => r.key === k) || fail(`${id}: no room ${k}`);
  const add = (r, o) => r.openings.push({ id: r.openings.length + 1, ...o });
  const winH = Math.min(H === 250 ? 140 : 150, H - 110);

  for (const [key, wall, count = 1] of spec.windows) {
    const r = by(key), len = wall === 'north' || wall === 'south' ? r.room.L : r.room.W;
    const width = Math.min(H >= 280 ? 170 : 150, Math.round(len * 0.45 / 10) * 10, Math.floor((len - 40) / count / 10) * 10 - 20);
    for (let i = 0; i < count; i++) {
      const c = len * (2 * i + 1) / (2 * count);
      add(r, { kind: 'window', wall, offset: Math.round(c - width / 2), width, sill: H >= 280 ? 70 : 85, height: H >= 280 ? 170 : winH });
    }
  }
  for (const [ownerKey, otherKey, at = 15, width] of spec.doors) {
    const a = by(ownerKey), b = by(otherKey);
    const adj = adjacent(a, b)[0] || fail(`${id}: ${ownerKey} and ${otherKey} are not neighbours`);
    const w = width ?? (b.purpose === 'bathroom' || a.purpose === 'bathroom' ? 70 : 80);
    const from = adj.from + at;
    if (from + w > adj.to) fail(`${id}: door ${ownerKey}→${otherKey} does not fit (${adj.to - adj.from})`);
    add(a, { kind: 'door', wall: adj.wallA, offset: from - wallLine(a, adj.wallA).from, width: w, height: 200, hinge: 'start' });
  }
  const [ek, ewall, eat] = spec.entrance;
  add(by(ek), { kind: 'door', wall: ewall, offset: eat, width: 90, height: 205, hinge: 'start' });

  const total = apartmentArea(plan);
  if (Math.abs(total - area) > area * 0.1) fail(`${id}: area ${total} vs ${area}`);
  return { id, set, rooms, area, total, H, series, name: size, plan };
}
function fail(msg) { throw new Error(msg); }

const SIZE = {
  studio: { ru: 'Студия', uz: 'Studiya', en: 'Studio' },
  euro1: { ru: 'Евродвушка', uz: 'Yevro-ikki xonali', en: 'Euro one-bedroom' },
  1: { ru: '1-комнатная', uz: '1 xonali', en: '1-room' },
  2: { ru: '2-комнатная', uz: '2 xonali', en: '2-room' },
  3: { ru: '3-комнатная', uz: '3 xonali', en: '3-room' },
  4: { ru: '4-комнатная', uz: '4 xonali', en: '4-room' }
};

const K = 250, I = 265, N = 280;
const apartments = [
  // ---- khrushchevka: 1-447, 1-464, II-29; H 250, kitchen ≈ 6 m², combined bathroom, walk-through rooms ----
  build('kh-1', 'khrushchevka', 1, SIZE[1], 31, '1-464 / 1-447', K, {
    rooms: [['living', 'living', 0, 0, 330, 560], ['kitchen', 'kitchen', 340, 0, 260, 230],
      ['hall', 'hall', 340, 240, 260, 130], ['bath', 'bathroom', 340, 380, 200, 180]],
    doors: [['living', 'hall', 20], ['kitchen', 'hall', 150], ['hall', 'bath', 20]],
    windows: [['living', 'north'], ['kitchen', 'north']],
    entrance: ['hall', 'east', 20]
  }),
  build('kh-2', 'khrushchevka', 2, SIZE[2], 44, '1-464 / 1-447', K, {
    rooms: [['bed', 'bedroom', 0, 0, 280, 420], ['living', 'living', 290, 0, 340, 510],
      ['kitchen', 'kitchen', 640, 0, 260, 235], ['hall', 'hall', 640, 245, 260, 130], ['bath', 'bathroom', 640, 385, 200, 170]],
    doors: [['bed', 'living', 300], ['living', 'hall', 25], ['kitchen', 'hall', 150], ['hall', 'bath', 20]],
    windows: [['bed', 'north'], ['living', 'north'], ['kitchen', 'north']],
    entrance: ['hall', 'east', 20]
  }),
  build('kh-3', 'khrushchevka', 3, SIZE[3], 56, '1-447 / II-29', K, {
    rooms: [['bed', 'bedroom', 0, 0, 290, 380], ['kids', 'kids', 0, 390, 290, 300], ['living', 'living', 300, 0, 360, 520],
      ['closet', 'other', 300, 530, 150, 120], ['kitchen', 'kitchen', 670, 0, 260, 240],
      ['hall', 'hall', 670, 250, 260, 150], ['bath', 'bathroom', 670, 410, 200, 170]],
    doors: [['bed', 'living', 270], ['kids', 'living', 10], ['living', 'hall', 30], ['closet', 'living', 30, 70],
      ['kitchen', 'hall', 150], ['hall', 'bath', 20]],
    windows: [['bed', 'north'], ['kids', 'south'], ['living', 'north'], ['kitchen', 'north']],
    entrance: ['hall', 'east', 30]
  }),
  build('kh-4', 'khrushchevka', 4, SIZE[4], 62, '1-464 / 1-447', K, {
    rooms: [['bed', 'bedroom', 0, 0, 290, 380], ['kids', 'kids', 0, 390, 290, 300], ['living', 'living', 300, 0, 360, 520],
      ['closet', 'other', 300, 530, 150, 120], ['kitchen', 'kitchen', 670, 0, 280, 240],
      ['hall', 'hall', 670, 250, 280, 150], ['bath', 'bathroom', 670, 410, 170, 200], ['study', 'study', 960, 250, 260, 300]],
    doors: [['bed', 'living', 270], ['kids', 'living', 10], ['living', 'hall', 30], ['closet', 'living', 30, 70],
      ['kitchen', 'hall', 170], ['hall', 'bath', 20], ['study', 'hall', 30]],
    windows: [['bed', 'north'], ['kids', 'south'], ['living', 'north'], ['kitchen', 'north'], ['study', 'north']],
    entrance: ['hall', 'south', 185]
  }),

  // ---- improved layout: 1-528, II-49, II-57, 121; H 265, kitchen 8–9 m², separate bathroom and WC, a hall ----
  build('im-1', 'improved', 1, SIZE[1], 36, 'II-49 / 1-528', I, {
    rooms: [['living', 'living', 0, 0, 340, 560], ['kitchen', 'kitchen', 350, 0, 300, 270],
      ['hall', 'hall', 350, 280, 300, 150], ['bath', 'bathroom', 350, 440, 200, 170], ['wc', 'wc', 560, 440, 100, 150]],
    doors: [['living', 'hall', 30], ['kitchen', 'hall', 190], ['hall', 'bath', 20], ['hall', 'wc', 10, 70]],
    windows: [['living', 'north'], ['kitchen', 'north']],
    entrance: ['hall', 'east', 30]
  }),
  build('im-2', 'improved', 2, SIZE[2], 52, '1-528 / II-57', I, {
    rooms: [['bed', 'bedroom', 0, 0, 310, 460], ['living', 'living', 320, 0, 360, 460],
      ['hall', 'hall', 0, 470, 680, 120],
      ['kitchen', 'kitchen', 0, 600, 280, 290], ['bath', 'bathroom', 290, 600, 200, 170], ['wc', 'wc', 500, 600, 100, 150]],
    doors: [['bed', 'hall', 200], ['living', 'hall', 30], ['kitchen', 'hall', 180], ['hall', 'bath', 20], ['hall', 'wc', 10, 70]],
    windows: [['bed', 'north'], ['living', 'north'], ['kitchen', 'south']],
    entrance: ['hall', 'east', 20]
  }),
  build('im-3', 'improved', 3, SIZE[3], 67, 'II-57 / 121', I, {
    rooms: [['bed', 'bedroom', 0, 0, 320, 440], ['living', 'living', 330, 0, 400, 440],
      ['hall', 'hall', 0, 450, 800, 120],
      ['kids', 'kids', 0, 580, 300, 330], ['kitchen', 'kitchen', 310, 580, 290, 300],
      ['wc', 'wc', 610, 580, 100, 150], ['bath', 'bathroom', 720, 580, 200, 170]],
    doors: [['bed', 'hall', 200], ['living', 'hall', 30], ['kids', 'hall', 200], ['kitchen', 'hall', 15],
      ['hall', 'wc', 10, 70], ['hall', 'bath', 10]],
    windows: [['bed', 'north'], ['living', 'north'], ['kids', 'south'], ['kitchen', 'south']],
    entrance: ['hall', 'east', 15]
  }),
  build('im-4', 'improved', 4, SIZE[4], 80, '121 / II-57', I, {
    rooms: [['bed', 'bedroom', 0, 0, 330, 440], ['living', 'living', 340, 0, 420, 440], ['bed2', 'bedroom', 770, 0, 300, 440, 2],
      ['hall', 'hall', 0, 450, 1070, 110],
      ['kids', 'kids', 0, 570, 310, 330], ['kitchen', 'kitchen', 320, 570, 300, 300],
      ['wc', 'wc', 630, 570, 100, 150], ['bath', 'bathroom', 740, 570, 200, 170], ['closet', 'other', 950, 570, 130, 150]],
    doors: [['bed', 'hall', 220], ['living', 'hall', 40], ['bed2', 'hall', 15], ['kids', 'hall', 200], ['kitchen', 'hall', 15],
      ['hall', 'wc', 10, 70], ['hall', 'bath', 10], ['closet', 'hall', 30, 70]],
    windows: [['bed', 'north'], ['living', 'north', 2], ['bed2', 'north'], ['kids', 'south'], ['kitchen', 'south']],
    entrance: ['hall', 'east', 10]
  }),

  // ---- new build (monolithic frame, 2015+): H 280, kitchen-living rooms, large windows ----
  build('nb-studio', 'newbuild', 1, SIZE.studio, 27, '', N, {
    rooms: [['kl', 'kitchenLiving', 0, 0, 380, 520], ['hall', 'hall', 0, 530, 190, 200], ['bath', 'bathroom', 200, 530, 180, 200]],
    doors: [['kl', 'hall', 50], ['hall', 'bath', 30]],
    windows: [['kl', 'north']],
    entrance: ['hall', 'south', 50]
  }),
  build('nb-euro1', 'newbuild', 2, SIZE.euro1, 40, '', N, {
    rooms: [['bed', 'bedroom', 0, 0, 320, 400], ['kl', 'kitchenLiving', 330, 0, 380, 500],
      ['hall', 'hall', 0, 410, 320, 160], ['bath', 'bathroom', 0, 580, 210, 190]],
    doors: [['bed', 'hall', 220], ['kl', 'hall', 5], ['hall', 'bath', 110]],
    windows: [['bed', 'north'], ['kl', 'north']],
    entrance: ['hall', 'west', 40]
  }),
  build('nb-2', 'newbuild', 2, SIZE[2], 60, '', N, {
    rooms: [['bed', 'bedroom', 0, 0, 340, 440], ['living', 'living', 350, 0, 400, 450], ['kitchen', 'kitchen', 760, 0, 280, 440],
      ['hall', 'hall', 200, 460, 680, 130], ['bath', 'bathroom', 200, 600, 220, 200], ['wc', 'wc', 430, 600, 100, 150]],
    doors: [['bed', 'hall', 30], ['living', 'hall', 40], ['kitchen', 'hall', 20], ['hall', 'bath', 20], ['hall', 'wc', 10, 70]],
    windows: [['bed', 'north'], ['living', 'north'], ['kitchen', 'north']],
    entrance: ['hall', 'south', 420]
  }),
  build('nb-3', 'newbuild', 3, SIZE[3], 80, '', N, {
    rooms: [['bed', 'bedroom', 0, 0, 360, 460], ['kl', 'kitchenLiving', 370, 0, 540, 460], ['kids', 'kids', 920, 0, 320, 460],
      ['hall', 'hall', 200, 470, 830, 130],
      ['bath', 'bathroom', 200, 610, 230, 200], ['wc', 'wc', 440, 610, 100, 150], ['closet', 'other', 550, 610, 150, 130]],
    doors: [['bed', 'hall', 20], ['kl', 'hall', 230], ['kids', 'hall', 10], ['hall', 'bath', 20], ['hall', 'wc', 10, 70],
      ['closet', 'hall', 40, 70]],
    windows: [['bed', 'north'], ['kl', 'north', 2], ['kids', 'north']],
    entrance: ['hall', 'south', 600]
  }),
  build('nb-4', 'newbuild', 4, SIZE[4], 105, '', N, {
    rooms: [['bed', 'bedroom', 0, 0, 360, 470], ['kl', 'kitchenLiving', 370, 0, 600, 470], ['kids', 'kids', 980, 0, 280, 470],
      ['hall', 'hall', 200, 480, 1060, 140],
      ['bath', 'bathroom', 200, 630, 240, 210], ['bath2', 'bathroom', 450, 630, 180, 200, 2], ['closet', 'other', 640, 630, 140, 150],
      ['bed2', 'bedroom', 790, 630, 470, 330, 2]],
    doors: [['bed', 'hall', 20], ['kl', 'hall', 250], ['kids', 'hall', 10], ['hall', 'bath', 20], ['hall', 'bath2', 20],
      ['closet', 'hall', 40, 70], ['bed2', 'hall', 30]],
    windows: [['bed', 'north'], ['kl', 'north', 2], ['kids', 'north'], ['bed2', 'south', 2]],
    entrance: ['hall', 'west', 30]
  })
];

const sets = [
  { id: 'khrushchevka', name: { ru: 'Хрущёвка', uz: 'Xrushchyovka', en: 'Khrushchevka' },
    note: { ru: 'Серии 1-447, 1-464, II-29 (1958–1970): потолок 2,5 м, кухня ≈ 6 м², совмещённый санузел, проходные комнаты',
      uz: '1-447, 1-464, II-29 seriyalari (1958–1970): shift 2,5 m, oshxona ≈ 6 m², birlashgan sanuzel, o‘tish xonalari',
      en: 'Series 1-447, 1-464, II-29 (1958–1970): 2.5 m ceiling, ≈ 6 m² kitchen, combined bathroom, walk-through rooms' } },
  { id: 'improved', name: { ru: 'Улучшенная планировка', uz: 'Yaxshilangan reja', en: 'Improved layout' },
    note: { ru: 'Серии 1-528, II-49, II-57, 121 (1965–1990): потолок 2,65 м, кухня 8–9 м², раздельный санузел, изолированные комнаты',
      uz: '1-528, II-49, II-57, 121 seriyalari (1965–1990): shift 2,65 m, oshxona 8–9 m², alohida sanuzel, izolyatsiyalangan xonalar',
      en: 'Series 1-528, II-49, II-57, 121 (1965–1990): 2.65 m ceiling, 8–9 m² kitchen, separate WC, isolated rooms' } },
  { id: 'newbuild', name: { ru: 'Новостройка', uz: 'Yangi bino', en: 'New build' },
    note: { ru: 'Монолит/каркас 2015+: потолок 2,8 м, кухни-гостиные, большие окна, евроформаты',
      uz: 'Monolit/karkas 2015+: shift 2,8 m, oshxona-mehmonxonalar, katta derazalar, yevroformatlar',
      en: 'Monolithic frame 2015+: 2.8 m ceiling, kitchen-living rooms, large windows, euro layouts' } }
];

const out = new URL('../apartment-templates.json', import.meta.url);
fs.writeFileSync(out, JSON.stringify({ version: 1, sets, apartments }, null, 1) + '\n');
for (const a of apartments) console.log(a.id.padEnd(10), String(a.total).padStart(5), 'm²  (', a.area, ')', a.plan.length, 'rooms');
