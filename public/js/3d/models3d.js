// Procedural furniture models built from primitives and fitted exactly into w × d × h.
// Local space: origin at the footprint centre on the floor, front faces +Z, metres.
import * as THREE from 'three';
import { furnitureMat } from './textures3d.js';
import { rectOf } from '../geometry.js';
import { itemLook } from '../materials.js';
import { itemStyle } from '../style.js';

// Furniture style of the item being built: 'modern' (as drawn) | 'classic' | 'loft'.
// Only handles, legs and facade mouldings change; the overall size never does.
let sty = 'modern';

// Handle: modern keeps the original bar / knob, classic — a brass knob, loft — a black bar.
// (x, y, z) — where the original was placed: y = its bottom, z = its centre.
function handle(orig, x, y, z, len, vertical, s) {
  if (sty === 'classic') {
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), furnitureMat('brass', '', s));
    k.position.set(x, y + (vertical ? len / 2 : 0.008), z + 0.004);
    k.castShadow = true;
    return k;
  }
  if (sty === 'loft') {
    const l = Math.max(len, 0.1);
    return vertical ? box(0.02, l, 0.025, furnitureMat('black', '', s), x, y, z + 0.0025)
      : box(l, 0.02, 0.025, furnitureMat('black', '', s), x, y, z + 0.0025);
  }
  return orig;
}

// Leg of height lh: classic — turned wood with a bulb, loft — thin black steel.
function leg(orig, x, z, lh, size, c, s) {
  if (sty === 'classic') {
    const g = new THREE.Group();
    const wood = fm('dark', c, s);
    g.add(cyl(size * 0.32, lh, wood, x, 0, z));
    const r = Math.min(size * 0.5, lh * 0.25);
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), wood);
    b.position.set(x, lh * 0.55, z);
    b.castShadow = true;
    g.add(b);
    return g;
  }
  if (sty === 'loft') return box(Math.max(0.02, size * 0.6), lh, Math.max(0.02, size * 0.6), furnitureMat('black', '', s), x, 0, z);
  return orig;
}

// Classic facade: a raised moulding frame on the front (zFront = front face).
function panel(g, fw, fh, x, y, zFront, mat) {
  if (sty !== 'classic' || fw < 0.12 || fh < 0.1) return;
  const m = Math.min(0.05, fw * 0.12, fh * 0.12), t = 0.012, dz = 0.006, z = zFront + dz / 2;
  g.add(box(fw - 2 * m, t, dz, mat, x, y + m, z));
  g.add(box(fw - 2 * m, t, dz, mat, x, y + fh - m - t, z));
  g.add(box(t, fh - 2 * m, dz, mat, x - fw / 2 + m + t / 2, y + m, z));
  g.add(box(t, fh - 2 * m, dz, mat, x + fw / 2 - m - t / 2, y + m, z));
}

// Look of the item being built: catalog materials for the body and the facade (doors, drawer fronts).
let look = { body: null, facade: null };
const FAMILY = { wood: 'board', dark: 'board', plain: 'board', fabric: 'fabric' };
// A chosen material replaces the parts of the same family (boards or upholstery); metal, glass etc. stay.
function fm(kind, c, s, role = 'body') {
  const m = look[role];
  if (m && FAMILY[kind] === (m.kind === 'fabric' ? 'fabric' : 'board')) return furnitureMat(m.kind, m.color, s);
  return furnitureMat(kind, c, s);
}

// Box with UVs scaled to metres (1 texture tile = 1 m) on every face.
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // Face order: +x, -x, +y, -y, +z, -z (4 vertices each).
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
  }
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y + h / 2, z);       // y = bottom of the box
  m.castShadow = m.receiveShadow = true;
  return m;
}

function cyl(r, h, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Rounded cushion (capsule-ish) for sofas and pillows.
function cushion(w, h, d, mat, x, y, z) {
  const r = Math.min(w, h, d) * 0.35;
  const g = new THREE.BoxGeometry(w - r, h, d - r, 1, 1, 1);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y + h / 2, z);
  const group = new THREE.Group();
  group.add(m);
  // Soft edges: capsules along the front and back edges.
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(Math.min(r, h / 2), w - r * 2, 4, 12), mat);
    c.rotation.z = Math.PI / 2;
    c.position.set(x, y + h / 2, z + s * (d - r) / 2);
    c.scale.set(1, 1, 1);
    group.add(c);
  }
  group.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return group;
}

// ---------- builders: (w, d, h, color, status) → Group ----------
function wardrobe(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = fm('wood', c, s), metal = furnitureMat('metal', c, s), dark = fm('dark', c, s);
  const base = Math.min(0.08, h * 0.05), doorT = 0.018;
  g.add(box(w - 0.02, base, d - 0.04, dark, 0, 0, -0.01));                 // recessed base
  g.add(box(w, h - base, d - doorT, wood, 0, base, -doorT / 2));             // carcass
  const n = w > 1.6 ? 3 : w > 0.7 ? 2 : 1;
  const dw = (w - 0.006 * (n + 1)) / n;
  const face = fm('wood', c, s, 'facade');
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.006 + dw / 2 + i * (dw + 0.006);
    g.add(box(dw, h - base - 0.012, doorT, face, x, base + 0.006, d / 2 - doorT / 2));
    panel(g, dw, h - base - 0.012, x, base + 0.006, d / 2, face);
    const hx = n === 1 ? x + dw / 2 - 0.05 : x + (i % 2 === 0 ? 1 : -1) * (dw / 2 - 0.05);
    const hl = Math.min(0.35, h * 0.2);
    g.add(handle(box(0.015, hl, 0.02, metal, hx, base + h * 0.45, d / 2 + 0.01), hx, base + h * 0.45, d / 2 + 0.01, hl, true, s));
  }
  return g;
}

function table(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = fm('wood', c, s);
  const top = Math.min(0.035, h * 0.1), lw = Math.min(0.06, w * 0.1, d * 0.1);
  g.add(box(w, top, d, wood, 0, h - top, 0));
  g.add(box(w - 0.1, 0.08, d - 0.1, wood, 0, h - top - 0.08, 0));            // apron
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - lw / 2 - 0.03), z = sz * (d / 2 - lw / 2 - 0.03);
    g.add(leg(box(lw, h - top, lw, wood, x, 0, z), x, z, h - top, lw, c, s));
  }
  return g;
}

function sofa(w, d, h, c, s, seats) {
  const g = new THREE.Group();
  const fab = fm('fabric', c, s), dark = fm('dark', c, s);
  const legH = Math.min(0.08, h * 0.1), seatH = Math.min(0.45, h * 0.55);
  const arm = Math.min(0.18, w * 0.12), backD = Math.min(0.22, d * 0.25);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - 0.06), z = sz * (d / 2 - 0.06);
    g.add(leg(cyl(0.025, legH, dark, x, 0, z), x, z, legH, 0.05, c, s));
  }
  const baseTop = legH + (seatH - legH) * 0.55;
  g.add(box(w, baseTop - legH, d, fab, 0, legH, 0));                          // base
  g.add(box(w - 2 * arm, h - baseTop, backD, fab, 0, baseTop, -d / 2 + backD / 2)); // back
  const armH = Math.min(h, seatH + 0.2) - legH;
  for (const sx of [-1, 1]) g.add(box(arm, armH, d, fab, sx * (w / 2 - arm / 2), legH, 0));
  // Seat cushions.
  const n = seats || (w - 2 * arm > 1.6 ? 3 : 2);
  const cw = (w - 2 * arm) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + arm + cw / 2 + i * cw;
    g.add(cushion(cw - 0.01, seatH - baseTop, d - backD - 0.01, fab, x, baseTop, backD / 2));
  }
  return g;
}

function nightstand(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = fm('wood', c, s), metal = furnitureMat('metal', c, s), dark = fm('dark', c, s);
  const legH = Math.min(0.08, h * 0.15);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - 0.04), z = sz * (d / 2 - 0.04);
    g.add(leg(box(0.03, legH, 0.03, dark, x, 0, z), x, z, legH, 0.03, c, s));
  }
  g.add(box(w, h - legH, d - 0.015, wood, 0, legH, -0.0075));
  const n = h - legH > 0.4 ? 2 : 1;
  const dh = (h - legH - 0.01 * (n + 1)) / n;
  for (let i = 0; i < n; i++) {
    const y = legH + 0.01 + i * (dh + 0.01);
    const face = fm('wood', c, s, 'facade');
    g.add(box(w - 0.02, dh, 0.015, face, 0, y, d / 2 - 0.0075));
    panel(g, w - 0.02, dh, 0, y, d / 2, face);
    g.add(handle(cyl(0.012, 0.02, metal, 0, y + dh / 2 - 0.01, d / 2 + 0.005).rotateX(Math.PI / 2), 0, y + dh / 2 - 0.008, d / 2 + 0.01, 0.1, false, s));
  }
  return g;
}

function bed(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = fm('dark', c, s), soft = furnitureMat('soft', c, s), fab = fm('fabric', c, s);
  const frameH = Math.min(0.3, h * 0.55), matTop = Math.min(h - 0.02, frameH + 0.2);
  const head = Math.min(0.08, d * 0.06);
  g.add(box(w, frameH, d - head, wood, 0, 0, head / 2));                    // frame
  g.add(box(w, h, head, wood, 0, 0, -d / 2 + head / 2));                     // headboard (full height)
  g.add(box(w - 0.04, matTop - frameH, d - head - 0.04, soft, 0, frameH, head / 2)); // mattress
  // Pillows.
  const pn = w > 1.2 ? 2 : 1, pw = (w - 0.12) / pn;
  for (let i = 0; i < pn; i++) {
    g.add(cushion(pw - 0.04, Math.min(0.1, h - matTop), 0.4, soft,
      -w / 2 + 0.06 + pw / 2 + i * pw, matTop, -d / 2 + head + 0.25));
  }
  // Blanket over the lower 60 %.
  const bl = (d - head) * 0.6;
  g.add(box(w - 0.02, 0.03, bl, fab, 0, matTop - 0.01, d / 2 - bl / 2 - 0.01));
  return g;
}

function chair(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = fm('wood', c, s), fab = fm('fabric', c, s);
  const seatH = Math.min(0.46, h * 0.5), leg = 0.035, seatT = 0.05;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lh = sz < 0 ? h : seatH - seatT;                                     // back legs go up
    g.add(box(leg, lh, leg, wood, sx * (w / 2 - leg / 2), 0, sz * (d / 2 - leg / 2)));
  }
  g.add(box(w, seatT, d, fab, 0, seatH - seatT, 0));
  g.add(box(w - 2 * leg, Math.min(0.3, (h - seatH) * 0.6), 0.025, wood, 0, h - Math.min(0.3, (h - seatH) * 0.6) - 0.02, -d / 2 + leg / 2));
  return g;
}

function generic(w, d, h, c, s) {
  const g = new THREE.Group();
  g.add(box(w, h, d, fm('wood', c, s)));
  return g;
}

const armchair = (w, d, h, c, s) => sofa(w, d, h, c, s, 1);

// Carcass on short legs with a column of drawers (dresser, shoe cabinet, desk pedestal).
function drawers(w, d, h, c, s, rows) {
  const g = new THREE.Group();
  const wood = fm('wood', c, s), metal = furnitureMat('metal', c, s), dark = fm('dark', c, s);
  const legH = Math.min(0.08, h * 0.1), front = 0.018, gap = 0.008;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - 0.04), z = sz * (d / 2 - 0.04);
    g.add(leg(box(0.035, legH, 0.035, dark, x, 0, z), x, z, legH, 0.035, c, s));
  }
  g.add(box(w, h - legH, d - front, wood, 0, legH, -front / 2));
  const n = rows || Math.max(1, Math.round((h - legH) / 0.2));
  const fh = (h - legH - gap * (n + 1)) / n;
  for (let i = 0; i < n; i++) {
    const y = legH + gap + i * (fh + gap);
    const face = fm('wood', c, s, 'facade'), hl = Math.min(0.16, w * 0.3);
    g.add(box(w - 2 * gap, fh, front, face, 0, y, d / 2 - front / 2));
    panel(g, w - 2 * gap, fh, 0, y, d / 2, face);
    g.add(handle(box(hl, 0.015, 0.02, metal, 0, y + fh * 0.6, d / 2 + 0.01), 0, y + fh * 0.6, d / 2 + 0.01, hl, false, s));
  }
  return g;
}

const dresser = (w, d, h, c, s) => drawers(w, d, h, c, s);
const shoerack = (w, d, h, c, s) => drawers(w, d, h, c, s, Math.max(2, Math.round(h / 0.35)));

// Low long cabinet: drawers on the sides, open niche in the middle.
function tvstand(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = fm('wood', c, s), dark = fm('dark', c, s);
  const side = Math.min(0.45, w * 0.3);
  g.add(drawers(side, d, h, c, s, 2).translateX(-w / 2 + side / 2));
  g.add(drawers(side, d, h, c, s, 2).translateX(w / 2 - side / 2));
  const mid = w - 2 * side, legH = Math.min(0.08, h * 0.1), t = 0.02;
  g.add(box(mid, t, d, wood, 0, legH, 0));                                    // bottom
  g.add(box(mid, t, d, wood, 0, h - t, 0));                                   // top
  g.add(box(mid, h - legH - 2 * t, 0.01, dark, 0, legH + t, -d / 2 + 0.005)); // back
  g.add(box(mid, t, d - 0.04, wood, 0, legH + (h - legH) / 2, -0.02));        // shelf
  return g;
}

// Open shelving with books (deterministic colours).
function bookshelf(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = fm('wood', c, s);
  const t = 0.02;
  g.add(box(t, h, d, wood, -w / 2 + t / 2, 0, 0));
  g.add(box(t, h, d, wood, w / 2 - t / 2, 0, 0));
  g.add(box(w - 2 * t, h, 0.008, wood, 0, 0, -d / 2 + 0.004));               // back
  const n = Math.max(2, Math.round(h / 0.38));
  const step = (h - t) / n;
  const colors = ['#8e3b46', '#2f5d8a', '#c9a227', '#3e7d4f', '#5b4a8a', '#d0d0d0', '#a0522d'];
  let k = 7;
  for (let i = 0; i <= n; i++) {
    const y = i * step;
    g.add(box(w - 2 * t, t, d - 0.01, wood, 0, y, 0.005));
    if (i === n) break;
    // Books, about 70 % of the shelf.
    let x = -w / 2 + t + 0.01;
    const maxX = w / 2 - t - (w - 2 * t) * 0.3;
    const bh0 = step - t - 0.03;
    while (x < maxX && bh0 > 0.08) {
      k = (k * 31 + 17) % 97;
      const bw = 0.02 + (k % 4) * 0.008, bh = Math.min(bh0, 0.18 + (k % 5) * 0.025);
      g.add(box(bw, bh, Math.min(0.22, d - 0.04), furnitureMat('plain', colors[k % colors.length], s), x + bw / 2, y + t, 0));
      x += bw + 0.002;
    }
  }
  return g;
}

// Table with a lower shelf.
function coffeetable(w, d, h, c, s) {
  const g = table(w, d, h, c, s);
  g.add(box(w - 0.1, 0.02, d - 0.1, fm('wood', c, s), 0, Math.min(0.12, h * 0.3), 0));
  return g;
}

// Desk: top, drawer pedestal on the right, panel leg on the left.
function desk(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = fm('wood', c, s);
  const top = 0.03, ped = Math.min(0.42, w * 0.35);
  g.add(box(w, top, d, wood, 0, h - top, 0));
  g.add(drawers(ped, d - 0.04, h - top, c, s, 3).translateX(w / 2 - ped / 2));
  g.add(box(0.025, h - top, d - 0.04, wood, -w / 2 + 0.0125, 0, 0));
  g.add(box(w - ped - 0.025, 0.25, 0.02, wood, -ped / 2, h - top - 0.25, -d / 2 + 0.03)); // modesty panel
  return g;
}

// Kitchen: base cabinets with countertop, sink and hob; wall cabinets if tall enough.
function kitchen(w, d, h, c, s) {
  const g = new THREE.Group();
  const front = fm('plain', c, s, 'facade'), body = fm('plain', c, s), metal = furnitureMat('metal', c, s);
  const counter = furnitureMat('plain', '#5d5f63', s), dark = furnitureMat('plain', '#202124', s);
  const baseH = Math.min(0.86, h), plinth = 0.1, ct = 0.04;
  g.add(box(w, plinth, d - 0.06, dark, 0, 0, -0.03));
  g.add(box(w, baseH - plinth - ct, d - 0.04, body, 0, plinth, -0.02));
  g.add(box(w, ct, d, counter, 0, baseH - ct, 0));
  const n = Math.max(1, Math.round(w / 0.6)), dw = w / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + dw / 2 + i * dw;
    g.add(box(dw - 0.006, baseH - plinth - ct - 0.01, 0.018, front, x, plinth + 0.005, d / 2 - 0.029));
    panel(g, dw - 0.006, baseH - plinth - ct - 0.01, x, plinth + 0.005, d / 2 - 0.02, front);
    const hl = Math.min(0.2, dw * 0.5);
    g.add(handle(box(hl, 0.012, 0.02, metal, x, baseH - ct - 0.06, d / 2 - 0.01), x, baseH - ct - 0.06, d / 2 - 0.01, hl, false, s));
  }
  g.add(box(Math.min(0.5, w * 0.25), 0.005, d * 0.6, metal, -w / 4, baseH, 0));   // sink
  g.add(box(Math.min(0.58, w * 0.25), 0.006, d * 0.85, dark, w / 4, baseH, 0));   // hob
  if (h > 1.6) {
    const bottom = Math.max(baseH + 0.55, h - 0.75), ud = Math.min(0.35, d);
    g.add(box(w, h - bottom, ud, body, 0, bottom, -d / 2 + ud / 2));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + dw / 2 + i * dw;
      const hl = Math.min(0.2, dw * 0.5), z = -d / 2 + ud + 0.01;
      g.add(handle(box(hl, 0.012, 0.02, metal, x, bottom + 0.06, z), x, bottom + 0.06, z, hl, false, s));
    }
  }
  return g;
}

// Fridge: enamel body, freezer door at the bottom, vertical handles.
function fridge(w, d, h, c, s) {
  const g = new THREE.Group();
  const body = fm('plain', c, s), metal = furnitureMat('metal', c, s);
  const door = 0.04, split = h * 0.36, lowH = Math.min(0.3, split * 0.6);
  g.add(box(w, h, d - door, body, 0, 0, -door / 2));
  g.add(box(w - 0.01, split - 0.01, door, body, 0, 0.005, d / 2 - door / 2));
  g.add(box(w - 0.01, h - split - 0.01, door, body, 0, split + 0.005, d / 2 - door / 2));
  g.add(box(0.02, lowH, 0.03, metal, w / 2 - 0.06, split - lowH - 0.05, d / 2 + 0.015));
  g.add(box(0.02, 0.35, 0.03, metal, w / 2 - 0.06, split + 0.08, d / 2 + 0.015));
  return g;
}

// ---- wall-mounted: built from the bottom (the item is lifted by elev in buildItem) ----

// Wall cabinet / mezzanine: carcass with 1–3 hinged doors and handles at the bottom edge.
function wallcabinet(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = fm('wood', c, s), metal = furnitureMat('metal', c, s);
  const front = 0.018, gap = 0.004;
  g.add(box(w, h, d - front, wood, 0, 0, -front / 2));
  const n = Math.max(1, Math.min(3, Math.round(w / 0.45)));
  const dw = (w - gap * (n + 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + gap + dw / 2 + i * (dw + gap);
    const face = fm('wood', c, s, 'facade'), hl = Math.min(0.12, dw * 0.4);
    g.add(box(dw, h - 2 * gap, front, face, x, gap, d / 2 - front / 2));
    panel(g, dw, h - 2 * gap, x, gap, d / 2, face);
    g.add(handle(box(hl, 0.012, 0.02, metal, x, gap + 0.03, d / 2 + 0.01), x, gap + 0.03, d / 2 + 0.01, hl, false, s));
  }
  return g;
}
const mezzanine = wallcabinet;

// Floating shelf: a board with two hidden brackets.
function wallshelf(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = fm('wood', c, s), metal = furnitureMat('metal', c, s);
  g.add(box(w, h, d, wood));
  for (const sx of [-1, 1]) g.add(box(0.02, 0.02, d * 0.8, metal, sx * w * 0.35, -0.02, -d * 0.1));
  return g;
}

// Floating TV console: long box with flap fronts and a dark gap line.
function tvpanel(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = fm('wood', c, s), dark = fm('dark', c, s);
  const front = 0.018;
  g.add(box(w, h, d - front, wood, 0, 0, -front / 2));
  const n = Math.max(2, Math.round(w / 0.6));
  const dw = (w - 0.004 * (n + 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.004 + dw / 2 + i * (dw + 0.004), face = fm('wood', c, s, 'facade');
    g.add(box(dw, h - 0.008, front, face, x, 0.004, d / 2 - front / 2));
    panel(g, dw, h - 0.008, x, 0.004, d / 2, face);
  }
  g.add(box(w * 0.98, 0.006, 0.002, dark, 0, h * 0.5, d / 2 + 0.001));
  return g;
}

// Wall mirror: thin frame with a reflective glass.
function mirror(w, d, h, c, s) {
  const g = new THREE.Group();
  const frame = furnitureMat('plain', c, s);
  const glass = new THREE.MeshStandardMaterial({ color: '#dfe7ef', roughness: 0.02, metalness: 1 });
  const f = Math.min(0.03, w * 0.08, h * 0.08);
  g.add(box(w, h, d * 0.6, frame, 0, 0, -d * 0.2));
  const m = box(w - 2 * f, h - 2 * f, 0.004, glass, 0, f, d * 0.1 + 0.002);
  g.add(m);
  return g;
}

// Glowing lamp shade: a cone open at both ends + a bulb light (power is set per scene by applyFixtures).
function lampHead(rTop, rBottom, hh, c, s, power) {
  const g = new THREE.Group();
  const shadeMat = furnitureMat('soft', c, s).clone();
  shadeMat.side = THREE.DoubleSide;
  shadeMat.emissive = new THREE.Color('#ffd9a0');
  shadeMat.emissiveIntensity = 0.35;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, hh, 24, 1, true), shadeMat);
  shade.position.y = hh / 2;
  const light = new THREE.PointLight('#ffd9a8', power, 0, 2);
  light.position.y = hh * 0.4;
  light.userData.lampPower = power;
  g.add(shade, light);
  return g;
}

function floorlamp(w, d, h, c, s) {
  const g = new THREE.Group();
  const metal = furnitureMat('metal', c, s);
  const r = Math.min(w, d) / 2;
  g.add(cyl(r * 0.6, 0.02, metal, 0, 0, 0));
  const hh = Math.min(0.32, h * 0.25);
  g.add(cyl(0.012, h - hh * 0.6, metal, 0, 0.02, 0));
  const head = lampHead(r * 0.55, r * 0.95, hh, c, s, 4);
  head.position.y = h - hh;
  g.add(head);
  return g;
}

function sconce(w, d, h, c, s) {
  const g = new THREE.Group();
  const metal = furnitureMat('metal', c, s);
  // Back plate on the wall (-Z), arm forward, shade at the front.
  g.add(box(Math.min(0.1, w), Math.min(0.14, h), 0.02, metal, 0, h * 0.2, -d / 2 + 0.01));
  g.add(box(0.02, 0.02, d * 0.6, metal, 0, h * 0.35, -d / 2 + d * 0.3));
  const hh = h * 0.6;
  const rb = Math.min(w, d) * 0.45;   // the shade stays inside the footprint
  const head = lampHead(rb * 0.6, rb, hh, c, s, 2.5);
  head.position.set(0, h - hh, 0);
  g.add(head);
  return g;
}

const BUILDERS = {
  wardrobe, table, sofa, nightstand, bed, chair,
  armchair, dresser, shoerack, tvstand, bookshelf, coffeetable, desk, kitchen, fridge,
  wallcabinet, mezzanine, wallshelf, tvpanel, mirror, floorlamp, sconce
};

/**
 * Build a furniture object placed in the room.
 * @param item plan item (cm); status 'ok' | 'bad' | 'found'
 */
export function buildItem(item, status, materials = [], roomStyle) {
  const make = BUILDERS[item.type] || generic;
  look = itemLook(item, materials);
  sty = itemStyle(item, roomStyle);
  const obj = make(item.w / 100, item.d / 100, item.h / 100, item.color, status);
  look = { body: null, facade: null };
  sty = 'modern';
  const r = rectOf(item);
  obj.position.set((r.x + r.w / 2) / 100, (item.elev || 0) / 100, (r.y + r.h / 2) / 100);
  // Same direction as the 2D front marker: 0° → +Z (south), clockwise on the plan.
  obj.rotation.y = -item.rot * Math.PI / 180;
  obj.userData.itemId = item.id;
  return obj;
}
