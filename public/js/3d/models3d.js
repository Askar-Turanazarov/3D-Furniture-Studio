// Procedural furniture models built from primitives and fitted exactly into w × d × h.
// Local space: origin at the footprint centre on the floor, front faces +Z, metres.
import * as THREE from 'three';
import { furnitureMat } from './textures3d.js';
import { rectOf } from '../geometry.js';

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
  const wood = furnitureMat('wood', c, s), metal = furnitureMat('metal', c, s), dark = furnitureMat('dark', c, s);
  const base = Math.min(0.08, h * 0.05), doorT = 0.018;
  g.add(box(w - 0.02, base, d - 0.04, dark, 0, 0, -0.01));                 // recessed base
  g.add(box(w, h - base, d - doorT, wood, 0, base, -doorT / 2));             // carcass
  const n = w > 1.6 ? 3 : w > 0.7 ? 2 : 1;
  const dw = (w - 0.006 * (n + 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.006 + dw / 2 + i * (dw + 0.006);
    g.add(box(dw, h - base - 0.012, doorT, wood, x, base + 0.006, d / 2 - doorT / 2));
    const hx = x + (i % 2 === 0 ? 1 : -1) * (dw / 2 - 0.05);
    g.add(box(0.015, Math.min(0.35, h * 0.2), 0.02, metal, n === 1 ? x + dw / 2 - 0.05 : hx, base + h * 0.45, d / 2 + 0.01));
  }
  return g;
}

function table(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = furnitureMat('wood', c, s);
  const top = Math.min(0.035, h * 0.1), leg = Math.min(0.06, w * 0.1, d * 0.1);
  g.add(box(w, top, d, wood, 0, h - top, 0));
  g.add(box(w - 0.1, 0.08, d - 0.1, wood, 0, h - top - 0.08, 0));            // apron
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(leg, h - top, leg, wood, sx * (w / 2 - leg / 2 - 0.03), 0, sz * (d / 2 - leg / 2 - 0.03)));
  }
  return g;
}

function sofa(w, d, h, c, s, seats) {
  const g = new THREE.Group();
  const fab = furnitureMat('fabric', c, s), dark = furnitureMat('dark', c, s);
  const legH = Math.min(0.08, h * 0.1), seatH = Math.min(0.45, h * 0.55);
  const arm = Math.min(0.18, w * 0.12), backD = Math.min(0.22, d * 0.25);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(cyl(0.025, legH, dark, sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06)));
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
  const wood = furnitureMat('wood', c, s), metal = furnitureMat('metal', c, s), dark = furnitureMat('dark', c, s);
  const legH = Math.min(0.08, h * 0.15);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(0.03, legH, 0.03, dark, sx * (w / 2 - 0.04), 0, sz * (d / 2 - 0.04)));
  }
  g.add(box(w, h - legH, d - 0.015, wood, 0, legH, -0.0075));
  const n = h - legH > 0.4 ? 2 : 1;
  const dh = (h - legH - 0.01 * (n + 1)) / n;
  for (let i = 0; i < n; i++) {
    const y = legH + 0.01 + i * (dh + 0.01);
    g.add(box(w - 0.02, dh, 0.015, wood, 0, y, d / 2 - 0.0075));
    g.add(cyl(0.012, 0.02, metal, 0, y + dh / 2 - 0.01, d / 2 + 0.005).rotateX(Math.PI / 2));
  }
  return g;
}

function bed(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = furnitureMat('dark', c, s), soft = furnitureMat('soft', c, s), fab = furnitureMat('fabric', c, s);
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
  const wood = furnitureMat('wood', c, s), fab = furnitureMat('fabric', c, s);
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
  g.add(box(w, h, d, furnitureMat('wood', c, s)));
  return g;
}

const armchair = (w, d, h, c, s) => sofa(w, d, h, c, s, 1);

// Carcass on short legs with a column of drawers (dresser, shoe cabinet, desk pedestal).
function drawers(w, d, h, c, s, rows) {
  const g = new THREE.Group();
  const wood = furnitureMat('wood', c, s), metal = furnitureMat('metal', c, s), dark = furnitureMat('dark', c, s);
  const legH = Math.min(0.08, h * 0.1), front = 0.018, gap = 0.008;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(0.035, legH, 0.035, dark, sx * (w / 2 - 0.04), 0, sz * (d / 2 - 0.04)));
  }
  g.add(box(w, h - legH, d - front, wood, 0, legH, -front / 2));
  const n = rows || Math.max(1, Math.round((h - legH) / 0.2));
  const fh = (h - legH - gap * (n + 1)) / n;
  for (let i = 0; i < n; i++) {
    const y = legH + gap + i * (fh + gap);
    g.add(box(w - 2 * gap, fh, front, wood, 0, y, d / 2 - front / 2));
    g.add(box(Math.min(0.16, w * 0.3), 0.015, 0.02, metal, 0, y + fh * 0.6, d / 2 + 0.01));
  }
  return g;
}

const dresser = (w, d, h, c, s) => drawers(w, d, h, c, s);
const shoerack = (w, d, h, c, s) => drawers(w, d, h, c, s, Math.max(2, Math.round(h / 0.35)));

// Low long cabinet: drawers on the sides, open niche in the middle.
function tvstand(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = furnitureMat('wood', c, s), dark = furnitureMat('dark', c, s);
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
  const wood = furnitureMat('wood', c, s);
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
  g.add(box(w - 0.1, 0.02, d - 0.1, furnitureMat('wood', c, s), 0, Math.min(0.12, h * 0.3), 0));
  return g;
}

// Desk: top, drawer pedestal on the right, panel leg on the left.
function desk(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = furnitureMat('wood', c, s);
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
  const front = furnitureMat('plain', c, s), metal = furnitureMat('metal', c, s);
  const counter = furnitureMat('plain', '#5d5f63', s), dark = furnitureMat('plain', '#202124', s);
  const baseH = Math.min(0.86, h), plinth = 0.1, ct = 0.04;
  g.add(box(w, plinth, d - 0.06, dark, 0, 0, -0.03));
  g.add(box(w, baseH - plinth - ct, d - 0.04, front, 0, plinth, -0.02));
  g.add(box(w, ct, d, counter, 0, baseH - ct, 0));
  const n = Math.max(1, Math.round(w / 0.6)), dw = w / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + dw / 2 + i * dw;
    g.add(box(dw - 0.006, baseH - plinth - ct - 0.01, 0.018, front, x, plinth + 0.005, d / 2 - 0.029));
    g.add(box(Math.min(0.2, dw * 0.5), 0.012, 0.02, metal, x, baseH - ct - 0.06, d / 2 - 0.01));
  }
  g.add(box(Math.min(0.5, w * 0.25), 0.005, d * 0.6, metal, -w / 4, baseH, 0));   // sink
  g.add(box(Math.min(0.58, w * 0.25), 0.006, d * 0.85, dark, w / 4, baseH, 0));   // hob
  if (h > 1.6) {
    const bottom = Math.max(baseH + 0.55, h - 0.75), ud = Math.min(0.35, d);
    g.add(box(w, h - bottom, ud, front, 0, bottom, -d / 2 + ud / 2));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + dw / 2 + i * dw;
      g.add(box(Math.min(0.2, dw * 0.5), 0.012, 0.02, metal, x, bottom + 0.06, -d / 2 + ud + 0.01));
    }
  }
  return g;
}

// Fridge: enamel body, freezer door at the bottom, vertical handles.
function fridge(w, d, h, c, s) {
  const g = new THREE.Group();
  const body = furnitureMat('plain', c, s), metal = furnitureMat('metal', c, s);
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
  const wood = furnitureMat('wood', c, s), metal = furnitureMat('metal', c, s);
  const front = 0.018, gap = 0.004;
  g.add(box(w, h, d - front, wood, 0, 0, -front / 2));
  const n = Math.max(1, Math.min(3, Math.round(w / 0.45)));
  const dw = (w - gap * (n + 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + gap + dw / 2 + i * (dw + gap);
    g.add(box(dw, h - 2 * gap, front, wood, x, gap, d / 2 - front / 2));
    g.add(box(Math.min(0.12, dw * 0.4), 0.012, 0.02, metal, x, gap + 0.03, d / 2 + 0.01));
  }
  return g;
}
const mezzanine = wallcabinet;

// Floating shelf: a board with two hidden brackets.
function wallshelf(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = furnitureMat('wood', c, s), metal = furnitureMat('metal', c, s);
  g.add(box(w, h, d, wood));
  for (const sx of [-1, 1]) g.add(box(0.02, 0.02, d * 0.8, metal, sx * w * 0.35, -0.02, -d * 0.1));
  return g;
}

// Floating TV console: long box with flap fronts and a dark gap line.
function tvpanel(w, d, h, c, s) {
  const g = new THREE.Group();
  const wood = furnitureMat('wood', c, s), dark = furnitureMat('dark', c, s);
  const front = 0.018;
  g.add(box(w, h, d - front, wood, 0, 0, -front / 2));
  const n = Math.max(2, Math.round(w / 0.6));
  const dw = (w - 0.004 * (n + 1)) / n;
  for (let i = 0; i < n; i++) {
    g.add(box(dw, h - 0.008, front, wood, -w / 2 + 0.004 + dw / 2 + i * (dw + 0.004), 0.004, d / 2 - front / 2));
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

const BUILDERS = {
  wardrobe, table, sofa, nightstand, bed, chair,
  armchair, dresser, shoerack, tvstand, bookshelf, coffeetable, desk, kitchen, fridge,
  wallcabinet, mezzanine, wallshelf, tvpanel, mirror
};

/**
 * Build a furniture object placed in the room.
 * @param item plan item (cm); status 'ok' | 'bad' | 'found'
 */
export function buildItem(item, status) {
  const make = BUILDERS[item.type] || generic;
  const obj = make(item.w / 100, item.d / 100, item.h / 100, item.color, status);
  const r = rectOf(item);
  obj.position.set((r.x + r.w / 2) / 100, (item.elev || 0) / 100, (r.y + r.h / 2) / 100);
  // Same direction as the 2D front marker: 0° → +Z (south), clockwise on the plan.
  obj.rotation.y = -item.rot * Math.PI / 180;
  obj.userData.itemId = item.id;
  return obj;
}
