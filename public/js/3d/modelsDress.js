// Cabinets in the furniture style: the carcass is built smaller (conf().bare — without its own base or legs) and the
// style's plinth, frame, columns, cornice or top go around it; the overall size of the item never changes.
import * as THREE from 'three';
import { box, rbox, cyl, taper, style3d, conf } from './models3d.js';
import { luxePart } from './modelsLuxe.js';

export const DRESSED = new Set(['wardrobe', 'hallwardrobe', 'bookshelf', 'dresser', 'shoerack', 'tvstand', 'sideboard',
  'vitrine', 'wallcabinet', 'mezzanine']);
const WALL = new Set(['wallcabinet', 'mezzanine']);

// Room the style takes around the carcass (m): each side, bottom, top; null — the carcass as it is.
function frameOf(st, wall, low, w) {
  switch (st) {
    case 'modern': return wall ? null : { side: 0, bottom: 0.07, top: 0 };
    case 'classic': return { side: 0.02, bottom: wall ? 0.03 : 0.1, top: low ? 0.035 : 0.08 };
    case 'loft': return { side: 0.03, bottom: wall ? 0.03 : low ? 0.14 : 0.12, top: 0.03 };
    case 'milano': return { side: 0, bottom: wall ? 0.015 : 0.1, top: low ? 0.03 : 0.028 };
    case 'couture': return { side: 0.015, bottom: wall ? 0.02 : 0.18, top: low ? 0.03 : 0.06 };
    case 'deco': return { side: Math.min(0.07, w * 0.08), bottom: wall ? 0.02 : 0.05, top: 0.03 };
    case 'organic': return { side: 0.03, bottom: wall ? 0 : 0.12, top: 0.045 };
  }
  return null;
}

/** Build `make` (a builder of models3d) for the item type, dressed in the style when it is a cabinet. */
export function dressed(make, type, w, d, h, c, s) {
  const st = style3d(), wall = WALL.has(type), low = h < 1.1 && !wall;
  const f = DRESSED.has(type) ? frameOf(st, wall, low, w) : null;
  if (!f || w - 2 * f.side < 0.25 || h - f.bottom - f.top < 0.3) return make(w, d, h, c, s);
  conf().bare = true;
  const inner = make(w - 2 * f.side, d, h - f.bottom - f.top, c, s);
  conf().bare = false;
  inner.position.y = f.bottom;
  const g = new THREE.Group();
  g.add(inner);
  PARTS[st](g, { w, d, h, H: h - f.bottom - f.top, ...f, s, wall, low });
  return g;
}

const PARTS = {
  // Recessed black plinth: the carcass seems to float a little.
  modern(g, { w, d, bottom, s }) {
    g.add(box(w - 0.03, bottom, d - 0.06, luxePart('metal', s), 0, 0, -0.02));
  },
  // Profiled plinth and cornice (stepped), pilasters at the sides.
  classic(g, { w, d, h, H, side, bottom, top, s }) {
    const body = luxePart('body', s);
    g.add(box(w, bottom * 0.7, d, body, 0, 0, 0));
    g.add(box(w - 0.016, bottom * 0.3, d - 0.012, body, 0, bottom * 0.7, -0.006));
    for (const sx of [-1, 1]) g.add(box(side, H, d - 0.004, body, sx * (w / 2 - side / 2), bottom, -0.002));
    g.add(box(w - 0.02, top * 0.35, d - 0.016, body, 0, h - top, -0.008));
    g.add(box(w - 0.008, top * 0.3, d - 0.006, body, 0, h - top * 0.65, -0.003));
    g.add(box(w, top * 0.35, d, body, 0, h - top * 0.35, 0));
  },
  // Black steel frame: corner posts down to the floor (the legs) and rails at the bottom and the top.
  loft(g, { w, d, h, bottom, s }) {
    const steel = luxePart('metal', s), p = 0.03;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(p, h, p, steel, sx * (w / 2 - p / 2), 0, sz * (d / 2 - p / 2)));
    for (const y of [bottom - p, h - p]) {
      for (const sz of [-1, 1]) g.add(box(w - 2 * p, p, p, steel, 0, y, sz * (d / 2 - p / 2)));
      for (const sx of [-1, 1]) g.add(box(p, p, d - 2 * p, steel, sx * (w / 2 - p / 2), y, 0));
    }
  },
  // Floating carcass on a deep-set bronze band; the low ones under a travertine top, the tall ones under a veneer
  // cap over a bronze shadow gap.
  milano(g, { w, d, h, bottom, top, low, s }) {
    const bronze = luxePart('metal', s);
    const inset = bottom < 0.05 ? 0.02 : 0.12;
    g.add(box(w - inset, bottom, d - inset, bronze, 0, 0, -inset / 4));
    if (low) { g.add(box(w, top, d, luxePart('stone', s), 0, h - top, 0)); return; }
    g.add(box(w - 0.02, 0.008, d - 0.02, bronze, 0, h - top, -0.01));
    g.add(box(w, top - 0.008, d, luxePart('body', s), 0, h - top + 0.008, 0));
  },
  // Tapered legs with brass shoes, a base frame, a cornice with a brass inlay (the low ones — a marble top).
  couture(g, { w, d, h, H, side, bottom, top, low, wall, s }) {
    const body = luxePart('body', s), brass = luxePart('metal', s), frame = 0.03;
    if (!wall) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = sx * (w / 2 - 0.045), z = sz * (d / 2 - 0.045);
        g.add(cyl(0.016, 0.03, brass, x, 0, z));
        g.add(taper(0.024, 0.015, bottom - frame - 0.03, body, x, 0.03, z));
      }
      g.add(box(w, frame, d, body, 0, bottom - frame, 0));
    } else g.add(box(w, bottom, d, body, 0, 0, 0));
    for (const sx of [-1, 1]) g.add(box(side, H, d - 0.004, body, sx * (w / 2 - side / 2), bottom, -0.002));
    g.add(box(w, top, d - 0.006, low ? luxePart('stone', s) : body, 0, h - top, -0.003));
    g.add(box(w - 0.01, 0.008, 0.006, brass, 0, h - top / 2 - 0.004, d / 2 - 0.003));
  },
  // Half-round fluted columns at the ends, a brass toe band, a black marble top.
  deco(g, { w, d, h, H, side, bottom, top, s }) {
    const body = luxePart('body', s), brass = luxePart('metal', s), r = side / 2;
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - r);
      g.add(box(side, H, d - r, body, x, bottom, -r / 2));
      g.add(cyl(r, H, body, x, bottom, d / 2 - r));
      for (const k of [-0.45, 0, 0.45]) g.add(box(0.004, H * 0.9, 0.004, brass, x + k * r, bottom + H * 0.05, d / 2 - r * (1 - Math.sqrt(1 - k * k)) - 0.002));
    }
    g.add(box(w, bottom, d - 0.02, brass, 0, 0, -0.01));
    g.add(box(w, top, d, luxePart('stone', s), 0, h - top, 0));
  },
  // Soft rounded ends, chunky oak legs, a thick rounded top.
  organic(g, { w, d, h, H, side, bottom, top, wall, s }) {
    const body = luxePart('body', s);
    for (const sx of [-1, 1]) g.add(rbox(side, H, d, body, sx * (w / 2 - side / 2), bottom, 0, side * 0.48));
    if (!wall) for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.035, bottom, body, sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.06)));
    g.add(rbox(w, top, d, body, 0, h - top, 0, 0.02));
  }
};
