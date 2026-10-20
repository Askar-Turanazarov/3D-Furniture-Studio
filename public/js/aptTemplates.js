// Apartment templates (apartment-templates.json): loading, room documents of a whole apartment, furnishing it,
// a mini plan for the gallery cards. No DOM except drawAptPlan.
import { makeRoom } from './storage.js';
import { roomView, roomRect } from './apartment.js';
import { furnish, kitsFor, rng } from './furnish.js';
import { cssVar, getTheme } from './theme.js';

let cache = null;
export function loadApartments() {
  cache ??= fetch('/api/apartments')
    .then(r => { if (!r.ok) throw new Error('apartments ' + r.status); return r.json(); })
    .catch(e => { cache = null; throw e; });
  return cache;
}

// Template → room documents with fresh ids at their places on the plan (the template is not mutated).
export function aptRooms(a, lang, plinth = 2) {
  return a.plan.map(r => makeRoom(r.name[lang] || r.name.ru, {
    room: { ...r.room, plinth },
    openings: structuredClone(r.openings)
  }, { purpose: r.purpose, pos: { ...r.pos } }));
}

/**
 * Furnish every room that has kits for its purpose with a kit picked by the seed.
 * apt = { rooms, settings, catalog }; rooms are changed in place. → number of items placed.
 */
export function furnishRooms(apt, { seed = 1, catalog = apt.catalog } = {}) {
  const pick = rng(seed);
  let n = 0;
  for (const r of apt.rooms) {
    const kits = kitsFor(r.purpose, r.room);
    if (!kits.length) continue;
    const kit = kits[Math.floor(pick() * kits.length)];
    const res = furnish({ ...roomView(apt, r.id), items: [], seq: r.seq }, kit, { seed: seed + n, catalog });
    r.items = res.items;
    r.seq = res.seq;
    n += res.items.length;
  }
  return n;
}

// Small plan of a whole apartment: rooms, windows, doors (for the gallery cards).
export function drawAptPlan(canvas, a) {
  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth || 180, ch = canvas.clientHeight || 120;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rs = a.plan.map(r => roomRect(r));
  const x0 = Math.min(...rs.map(r => r.x)), y0 = Math.min(...rs.map(r => r.y));
  const L = Math.max(...rs.map(r => r.x + r.w)) - x0, W = Math.max(...rs.map(r => r.y + r.h)) - y0;
  const pad = 8, s = Math.min((cw - 2 * pad) / L, (ch - 2 * pad) / W);
  const ox = (cw - L * s) / 2 - x0 * s, oy = (ch - W * s) / 2 - y0 * s;
  const FILL = getTheme() === 'dark'
    ? { hall: '#22211e', bathroom: '#1c2526', kitchen: '#2a241a', kitchenLiving: '#2a241a', other: '#22211e' }
    : { hall: '#f1ede6', bathroom: '#e9f1f1', kitchen: '#f6ecdc', kitchenLiving: '#f6ecdc', other: '#f1ede6' };
  const floor = cssVar('--plan-floor', '#fff'), wall = cssVar('--plan-wall', '#343a40'), gap = cssVar('--plan-bg', '#fff');
  a.plan.forEach((r, i) => {
    const b = rs[i];
    g.fillStyle = FILL[r.purpose] || floor;
    g.fillRect(ox + b.x * s, oy + b.y * s, b.w * s, b.h * s);
    g.strokeStyle = wall;
    g.lineWidth = 1.5;
    g.strokeRect(ox + b.x * s, oy + b.y * s, b.w * s, b.h * s);
  });
  a.plan.forEach((r, i) => {
    const b = rs[i];
    for (const o of r.openings) {
      const p = o.offset, q = o.offset + o.width;
      const seg = { north: [p, 0, q, 0], south: [p, b.h, q, b.h], west: [0, p, 0, q], east: [b.w, p, b.w, q] }[o.wall];
      g.beginPath();
      g.moveTo(ox + (b.x + seg[0]) * s, oy + (b.y + seg[1]) * s);
      g.lineTo(ox + (b.x + seg[2]) * s, oy + (b.y + seg[3]) * s);
      g.strokeStyle = o.kind === 'window' ? '#4dabf7' : gap;
      g.lineWidth = o.kind === 'window' ? 3 : 3.5;
      g.stroke();
    }
  });
}
