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

function sofa(w, d, h, c, s) {
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
  const n = w - 2 * arm > 1.6 ? 3 : 2;
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

const BUILDERS = { wardrobe, table, sofa, nightstand, bed, chair };

/**
 * Build a furniture object placed in the room.
 * @param item plan item (cm); status 'ok' | 'bad' | 'found'
 */
export function buildItem(item, status) {
  const make = BUILDERS[item.type] || generic;
  const obj = make(item.w / 100, item.d / 100, item.h / 100, item.color, status);
  const r = rectOf(item);
  obj.position.set((r.x + r.w / 2) / 100, 0, (r.y + r.h / 2) / 100);
  // Same direction as the 2D front marker: 0° → +Z (south), clockwise on the plan.
  obj.rotation.y = -item.rot * Math.PI / 180;
  obj.userData.itemId = item.id;
  return obj;
}
