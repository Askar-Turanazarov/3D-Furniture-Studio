// Luxe collections (style.js LUXE_STYLES): own silhouettes for soft furniture and tables.
// Builders get the item size in metres (w along x, d along z, h up; front = +z, y = 0 on the floor) and never
// leave that box. Materials come from the collection (STYLE_MATS); a catalog material chosen for the item
// replaces the parts of its family (boards or upholstery).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { furnitureMat } from './textures3d.js';
import { box, rbox, slider, conf, style3d, look3d } from './models3d.js';
import { STYLE_MATS } from '../style.js';
import { familyOf } from '../materials.js';

// Colours of the collection parts (null — the material's own base colour).
const TONE = {
  milano: { soft: '#e8e1d5', facade: '#cfc6b8', leather: '#d9c6a8' },
  couture: { soft: '#2c4a40', facade: '#161618', leather: '#3a2a22' },
  deco: { soft: '#6b2a33', body: '#121214', leather: '#1d1c1e' },
  organic: { soft: '#dcd2c2', leather: '#d8c4a4' }
};
const FAMILY = { soft: 'fabric', leather: 'fabric', body: 'board', facade: 'board', stone: 'board' };

// Material of a collection part; role — which catalog choice of the item may replace it.
function M(part, s, role = part === 'facade' ? 'facade' : 'body') {
  const st = style3d(), m = look3d()[role];
  if (m && FAMILY[part] && familyOf(m.kind) === FAMILY[part]) return furnitureMat(m.kind, m.color, s);
  return furnitureMat(STYLE_MATS[st][part], TONE[st][part] || null, s);
}
export const luxePart = M;
const white = s => furnitureMat('linen', '#f3efe8', s);      // bed linen

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- primitives ----------

// Cushion: a rounded box whose top swells towards the middle (k of its height); y = bottom.
function puffy(w, h, d, mat, x, y, z, r = 0.04, k = 0.12) {
  const h0 = h * (1 - k), hw = w / 2, hd = d / 2;
  const rad = Math.max(0.002, Math.min(r, hw - 0.002, h0 / 2 - 0.002, hd - 0.002));
  const g = new RoundedBoxGeometry(w, h0, d, 3, rad);
  const p = g.attributes.position, n = g.attributes.normal, a = h * k;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
    if (py <= 0) continue;
    const fx = Math.max(0, 1 - (px / hw) ** 2), fz = Math.max(0, 1 - (pz / hd) ** 2), t = py / (h0 / 2);
    p.setY(i, py + a * fx * fz * t);
    // Tilt the normals of the top along the swelling (no seams, unlike recomputing them).
    if (n.getY(i) > 0.5) {
      const v = new THREE.Vector3(2 * a * px / (hw * hw) * fz, 1, 2 * a * pz / (hd * hd) * fx).normalize();
      n.setXYZ(i, v.x, v.y, v.z);
    }
  }
  return mesh(g, mat, x, y + h0 / 2, z);
}

// Capitonné panel facing +z: diamond pillows, creases along the diagonals, a button in each crossing.
// w × h with bulge t; (x, y) — its bottom centre, z — its back plane (a backing of depth bd goes behind).
function tufted(w, h, t, mat, x, y, z, bd = 0.04, cell = 0.17) {
  const g = new THREE.Group();
  const nx = Math.max(2, Math.round(w / cell)), sx = w / nx;
  const ny = Math.max(1, Math.round(h / (sx * 0.9))), sy = h / ny;
  const geo = new THREE.PlaneGeometry(w, h, Math.min(48, nx * 5), Math.min(36, ny * 5));
  const p = geo.attributes.position, edge = Math.min(sx, sy) * 0.4;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i);
    const u = (px + w / 2) / sx, v = (py + h / 2) / sy;
    const a = Math.abs(Math.cos(Math.PI * v) - Math.cos(Math.PI * u)) / 2;
    const e = clamp(Math.min(w / 2 - Math.abs(px), h / 2 - Math.abs(py)) / edge, 0, 1);
    p.setZ(i, t * Math.sqrt(a) * e);
  }
  geo.computeVertexNormals();
  g.add(mesh(geo, mat, x, y + h / 2, z));
  g.add(box(w, h, bd, mat, x, y, z - bd / 2));
  const buttons = [];
  for (let u = 1; u < nx; u++) for (let v = 1; v < ny; v++) {
    if ((u + v) % 2) continue;
    const b = new THREE.SphereGeometry(0.008, 6, 4);
    b.translate(x - w / 2 + u * sx, y + v * sy, z + 0.003);
    buttons.push(b);
  }
  if (buttons.length) g.add(mesh(mergeGeometries(buttons), mat));
  return g;
}

// Piping (a thin welt) around a rounded rectangle w × d at height y.
function piping(w, d, y, mat, r = 0.006, corner = 0.03, x = 0, z = 0) {
  const pts = rrectPts(w - 2 * r, d - 2 * r, corner).map(([px, pz]) => new THREE.Vector3(x + px, y, z + pz));
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'centripetal'), 96, r, 5, true);
  return mesh(geo, mat);
}

// Shapes on the floor plane: points [x, z].
function rrectPts(w, d, r, n = 6) {
  const out = [], hw = w / 2, hd = d / 2, rr = Math.min(r, hw, hd);
  const corners = [[hw - rr, hd - rr, 0], [-hw + rr, hd - rr, Math.PI / 2], [-hw + rr, -hd + rr, Math.PI], [hw - rr, -hd + rr, 1.5 * Math.PI]];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * Math.PI / 2;
      out.push([cx + rr * Math.cos(a), cz + rr * Math.sin(a)]);
    }
  }
  return out;
}
// Superellipse |x/a|^e + |z/b|^e = 1: e = 2 — an ellipse, larger — a pebble / soft rectangle.
function superPts(w, d, e = 2, n = 64) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t);
    out.push([w / 2 * Math.sign(c) * Math.abs(c) ** (2 / e), d / 2 * Math.sign(s) * Math.abs(s) ** (2 / e)]);
  }
  return out;
}
// Inner "D" of a shell with walls t thick: the same front edge, overlapping the walls by o.
const dIn = (w, d, t, o = 0.02) => {
  const W = w - 2 * t + 2 * o, D = d - t + o;
  return dPts(W, D).map(([x, z]) => [x, z + (d - D) / 2]);
};
// "D" shape: straight front edge at z = d/2, half-ellipse behind (deco sofas and tub chairs).
function dPts(w, d, n = 40) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI;
    out.push([w / 2 * Math.cos(t), d / 2 - d * Math.sin(t)]);
  }
  return out;
}

// Slab of thickness t from a floor shape (tops, plinths, seats); y = bottom. The bevel stays inside the shape.
function slab(pts, t, mat, y, bevel = 0.006) {
  bevel = Math.min(bevel, t / 2.2);
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const W = Math.max(...xs) - Math.min(...xs), D = Math.max(...zs) - Math.min(...zs);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cz = (Math.max(...zs) + Math.min(...zs)) / 2;
  const kx = Math.max(0.1, (W - 2 * bevel) / W), kz = Math.max(0.1, (D - 2 * bevel) / D);
  const sh = new THREE.Shape();
  pts.forEach(([x, z], i) => {
    const X = cx + (x - cx) * kx, Z = cz + (z - cz) * kz;
    if (i) sh.lineTo(X, -Z); else sh.moveTo(X, -Z);
  });
  const geo = new THREE.ExtrudeGeometry(sh, {
    depth: Math.max(0.001, t - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 2, curveSegments: 1
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y + bevel, 0);
  return mesh(geo, mat);
}

// Tapered leg with a metal shoe; y = 0 on the floor.
function shoeLeg(h, r, x, z, wood, metal) {
  const g = new THREE.Group(), cap = Math.min(0.05, h * 0.3);
  g.add(mesh(new THREE.CylinderGeometry(r, r * 0.62, h - cap, 14), wood, x, cap + (h - cap) / 2, z));
  g.add(mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.55, cap, 14), metal, x, cap / 2, z));
  return g;
}
const rod = (r, h, mat, x, y, z, seg = 12) => mesh(new THREE.CylinderGeometry(r, r, h, seg), mat, x, y + h / 2, z);

// Fluted column / drum: n round flutes on a circle (R) around a core; y = bottom.
function fluted(R, h, mat, x, y, z, n = 18) {
  const r = Math.PI * R / n * 0.95, parts = [new THREE.CylinderGeometry(R * 0.9, R * 0.9, h, 24)];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI, c = new THREE.CylinderGeometry(r, r, h, 8);
    c.translate(R * Math.cos(a), 0, R * Math.sin(a));
    parts.push(c);
  }
  return mesh(mergeGeometries(parts), mat, x, y + h / 2, z);
}

// Vertical channels (deco channel tufting) standing on a path: [{ x, z, ry, w, h }] from y up, thickness t.
function channels(list, t, y, mat) {
  const parts = list.map(c => {
    const g = new RoundedBoxGeometry(c.w, c.h, t, 2, Math.min(c.w, t) * 0.45);
    g.rotateY(c.ry);
    g.translate(c.x, y + c.h / 2, c.z);
    return g;
  });
  return mesh(mergeGeometries(parts), mat);
}

// Channels along the back half-ellipse of a "D" (w × d); height falls from hb at the back to ha at the front.
function shellChannels(w, d, t, y, ha, hb, mat, cell = 0.15) {
  const a = w / 2 - t / 2, b = d - t / 2, cz = d / 2;
  const len = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))) / 2;
  const n = clamp(Math.round(len / cell), 6, 22), list = [];
  for (let i = 0; i < n; i++) {
    const th = ((i + 0.5) / n) * Math.PI;
    const x = a * Math.cos(th), z = cz - b * Math.sin(th);
    const tx = -a * Math.sin(th), tz = -b * Math.cos(th);
    list.push({ x, z, ry: Math.atan2(-tz, tx), w: len / n * 1.02, h: ha + (hb - ha) * Math.sin(th) ** 0.8 });
  }
  return channels(list, t, y, mat);
}

// ---------- soft furniture ----------

const SEAT = { milano: 0.38, couture: 0.45, deco: 0.43, organic: 0.4 };

// Sofa / armchair; opt: { seats, armL, armR } (corner sofas build their parts with one arm).
function sofa(w, d, h, c, s, opt = {}) {
  const st = style3d(), g = new THREE.Group();
  const { armL = true, armR = true } = opt;
  const soft = M('soft', s), metal = M('metal', s);
  const seatH = Math.min(SEAT[st], h * 0.6);
  if (st === 'deco' && armL && armR) return decoShell(w, d, h, s, seatH);
  const arm = st === 'milano' ? Math.min(0.1, w * 0.1) : st === 'couture' ? Math.min(0.2, w * 0.13) : Math.min(0.22, w * 0.16);
  const aL = armL ? arm : 0, aR = armR ? arm : 0;
  const backD = st === 'organic' ? Math.min(0.26, d * 0.3) : st === 'couture' ? Math.min(0.17, d * 0.22) : Math.min(0.18, d * 0.22);
  const inner = w - aL - aR, ix = (aL - aR) / 2;
  let foot = 0;                 // height of what the sofa stands on
  if (st === 'milano') {
    foot = 0.05;
    g.add(box(w - 0.08, foot, d - 0.1, metal, 0, 0, 0));
  } else if (st === 'couture' || st === 'deco') {
    foot = Math.min(0.12, h * 0.15);
    const legs = w > 1.9 ? [-1, 0, 1] : [-1, 1];
    for (const fx of legs) for (const sz of [-1, 1]) {
      const x = fx * (w / 2 - 0.07), z = sz * (d / 2 - 0.07);
      g.add(shoeLeg(foot, 0.022, x, z, M('body', s), metal));
    }
  } else {
    foot = 0.04;
    g.add(box(w - 0.12, foot, d - 0.12, M('body', s), 0, 0, 0));          // low oak plinth
  }
  const cushT = st === 'organic' ? (seatH - foot) * 0.5 : Math.min(0.15, (seatH - foot) * 0.55);
  const bt = seatH - cushT;     // top of the base under the seat cushions
  // Base and arms.
  if (st === 'organic') {
    g.add(puffy(w, bt - foot, d, soft, 0, foot, 0, 0.08, 0.06));
  } else {
    g.add(rbox(w, bt - foot, d, soft, 0, foot, 0, st === 'milano' ? 0.015 : 0.03));
    if (st === 'couture') g.add(piping(w, d, foot + 0.006, soft));
  }
  const armTop = Math.min(h, seatH + (st === 'milano' ? 0.16 : st === 'organic' ? 0.2 : 0.24));
  for (const [on, sx] of [[armL, -1], [armR, 1]]) {
    if (!on) continue;
    const x = sx * (w / 2 - arm / 2);
    if (st === 'couture') {
      // Rolled arm: a block with a roll along its top.
      const r = arm / 2;
      g.add(rbox(arm, armTop - r - bt + 0.02, d, soft, x, bt - 0.02, 0, 0.02));
      const roll = new THREE.CylinderGeometry(r, r, d - 0.01, 20);
      roll.rotateX(Math.PI / 2);
      g.add(mesh(roll, soft, x, armTop - r, 0));
    } else if (st === 'organic') {
      g.add(puffy(arm, armTop - bt + cushT * 0.4, d - backD + 0.04, soft, x, bt - cushT * 0.4, backD / 2 - 0.02, 0.09, 0.1));
    } else {
      g.add(rbox(arm, armTop - bt, d, soft, x, bt, 0, 0.02));
    }
  }
  // Back.
  const backH = h - bt;
  if (st === 'couture') {
    g.add(tufted(inner, backH - 0.05, 0.028, soft, ix, bt, -d / 2 + backD - 0.03, backD - 0.03));
    const roll = new THREE.CylinderGeometry(0.05, 0.05, w - 0.01, 20);
    roll.rotateZ(Math.PI / 2);
    g.add(mesh(roll, soft, 0, h - 0.05, -d / 2 + 0.06));
  } else if (st === 'organic') {
    g.add(puffy(inner + (armL && armR ? 0.08 : 0), backH, backD, soft, ix, bt, -d / 2 + backD / 2, 0.1, 0.08));
  } else {
    g.add(rbox(w, backH, Math.min(0.14, backD), soft, 0, bt, -d / 2 + Math.min(0.14, backD) / 2, 0.02));
  }
  // Seat cushions and (milano, organic) back cushions.
  const n = opt.seats || (inner > 2.1 ? 3 : inner > 1.1 ? 2 : 1);
  const cw = inner / n, sd = d - backD - 0.01, sz = -d / 2 + backD + sd / 2;
  for (let i = 0; i < (st === 'couture' ? 1 : n); i++) {
    const one = st === 'couture';
    const x = one ? ix : -w / 2 + aL + cw / 2 + i * cw;
    g.add(puffy((one ? inner : cw) - 0.012, cushT, sd, soft, x, bt, sz, st === 'organic' ? 0.07 : 0.035, 0.14));
  }
  if (st === 'milano') {
    const bh = Math.min(0.4, h - seatH - 0.02);
    for (let i = 0; i < n && bh > 0.15; i++) {
      const piv = new THREE.Group();
      piv.position.set(-w / 2 + aL + cw / 2 + i * cw, seatH - 0.02, -d / 2 + 0.14 + 0.09);
      piv.rotation.x = -0.12;
      piv.add(puffy(cw - 0.03, bh, 0.16, soft, 0, 0, 0, 0.04, 0.1));
      g.add(piv);
    }
  }
  return g;
}

// Deco tub sofa / armchair: a "D" on a brass band, channel-tufted shell, one rounded seat cushion.
function decoShell(w, d, h, s, seatH) {
  const g = new THREE.Group(), soft = M('soft', s), metal = M('metal', s), body = M('body', s);
  const band = 0.03, t = Math.min(0.14, w * 0.12, d * 0.16);
  g.add(slab(dPts(w - 0.04, d - 0.02).map(([x, z]) => [x, z - 0.01]), band, metal, 0, 0.004));
  const bt = seatH - 0.12;
  g.add(slab(dIn(w, d, t), bt - band, body, band, 0.01));
  g.add(shellChannels(w, d, t, band, Math.min(h, seatH + 0.2) - band, h - band, soft, w < 1.1 ? 0.12 : 0.16));
  g.add(slab(dIn(w, d, t, 0.01), seatH - bt, soft, bt, 0.04));
  return g;
}

const armchair = (w, d, h, c, s) => sofa(w, d, h, c, s, { seats: 1 });

// Corner sofa (as the base model: backs along −z and −x, the chaise on the left towards +z).
function cornersofa(w, d, h, c, s) {
  const g = new THREE.Group();
  const longD = Math.min(d, 1.05), chaiseW = Math.min(1, w * 0.42);
  const long = sofa(w - chaiseW, longD, h, c, s, { armL: false });
  long.position.set(chaiseW / 2, 0, -d / 2 + longD / 2);
  // The chaise is a sofa turned to face +x: its local −x arm closes the +z end.
  const chaise = sofa(d, chaiseW, h, c, s, { armR: false, seats: 2 });
  chaise.rotation.y = Math.PI / 2;
  chaise.position.set(-w / 2 + chaiseW / 2, 0, 0);
  // The corner seat gets its back along −z too.
  const soft = M('soft', s), bd = Math.min(0.16, longD * 0.2), bh = h - Math.min(SEAT[style3d()], h * 0.6) + 0.1;
  g.add(long, chaise, style3d() === 'organic' ? puffy(chaiseW, bh, bd, soft, -w / 2 + chaiseW / 2, h - bh, -d / 2 + bd / 2, 0.08, 0.06)
    : rbox(chaiseW, bh, bd, soft, -w / 2 + chaiseW / 2, h - bh, -d / 2 + bd / 2, 0.02));
  return g;
}

function pouf(w, d, h, c, s) {
  const st = style3d(), g = new THREE.Group(), soft = M('soft', s), metal = M('metal', s);
  if (st === 'couture') {
    const legH = Math.min(0.1, h * 0.25);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(shoeLeg(legH, 0.018, sx * (w / 2 - 0.05), sz * (d / 2 - 0.05), M('body', s), metal));
    g.add(rbox(w, h - legH - 0.05, d, soft, 0, legH, 0, 0.02));
    g.add(piping(w, d, legH + 0.006, soft));
    g.add(puffy(w - 0.01, 0.06, d - 0.01, soft, 0, h - 0.06, 0, 0.025, 0.3));
  } else if (st === 'deco') {
    g.add(slab(superPts(w, d, 2, 48), 0.03, metal, 0, 0.004));
    g.add(slab(superPts(w - 0.01, d - 0.01, 2, 48), h - 0.03, soft, 0.03, 0.03));
  } else if (st === 'milano') {
    g.add(slab(superPts(w, d, 3.2, 48), h, soft, 0, Math.min(0.05, h * 0.2)));
  } else {
    g.add(puffy(w, h, d, soft, 0, 0, 0, Math.min(w, d, h) * 0.45, 0.12));
  }
  return g;
}

// ---------- beds ----------

// Mattress, pillows, duvet and (luxe) a throw over the foot; y0 — top of the frame.
function bedding(g, w, d, h, head, y0, top, s) {
  const lin = white(s), soft = M('soft', s), md = d - head - 0.04;
  g.add(rbox(w - 0.05, top - y0, md, furnitureMat('soft', '', s), 0, y0, head / 2, 0.06));
  const pn = w > 1.2 ? 2 : 1, pw = (w - 0.14) / pn, ph = clamp(h - top + 0.01, 0.05, 0.13);
  for (let i = 0; i < pn; i++) {
    g.add(puffy(pw - 0.04, ph, 0.4, lin, -w / 2 + 0.07 + pw / 2 + i * pw, top - 0.01, -d / 2 + head + 0.26, 0.05, 0.35));
  }
  const bl = (d - head) * 0.68;
  g.add(rbox(w - 0.03, 0.045, bl, lin, 0, top - 0.02, d / 2 - bl / 2 - 0.015, 0.02));
  g.add(rbox(w - 0.02, 0.03, Math.min(0.45, bl * 0.4), soft, 0, top + 0.02, d / 2 - Math.min(0.45, bl * 0.4) / 2 - 0.04, 0.012));
}

function bed(w, d, h, c, s) {
  const st = style3d(), g = new THREE.Group(), soft = M('soft', s), metal = M('metal', s), body = M('body', s);
  const head = Math.min(st === 'couture' ? 0.14 : 0.1, d * 0.08);
  const frameH = Math.min(st === 'milano' ? 0.26 : 0.32, h * 0.5), top = Math.min(h - 0.05, frameH + 0.24);
  const fd = d - head;
  if (st === 'milano') {
    g.add(box(w - 0.16, 0.06, fd - 0.16, metal, 0, 0, head / 2));                  // floating plinth
    g.add(rbox(w, frameH - 0.06, fd, soft, 0, 0.06, head / 2, 0.02));
    g.add(rbox(w, h, head, soft, 0, 0, -d / 2 + head / 2, 0.025));                     // low wide headboard
  } else if (st === 'couture') {
    const legH = 0.1;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(shoeLeg(legH, 0.025, sx * (w / 2 - 0.07), sz * (d / 2 - 0.07), body, metal));
    g.add(rbox(w, frameH - legH, fd, soft, 0, legH, head / 2, 0.025));
    g.add(piping(w, fd, frameH - 0.006, soft, 0.006, 0.025, 0, head / 2));
    g.add(tufted(w, h - legH - 0.02, 0.035, soft, 0, legH, -d / 2 + head - 0.035, head - 0.035, 0.18));
    const roll = new THREE.CylinderGeometry(0.04, 0.04, w, 20);
    roll.rotateZ(Math.PI / 2);
    g.add(mesh(roll, soft, 0, h - 0.04, -d / 2 + head / 2));
  } else if (st === 'deco') {
    g.add(box(w - 0.06, 0.04, fd - 0.06, metal, 0, 0, head / 2));
    g.add(rbox(w, frameH - 0.04, fd, body, 0, 0.04, head / 2, 0.03));
    // Arched headboard of vertical channels.
    const n = clamp(Math.round(w / 0.16), 5, 16), cw = w / n, list = [], hmin = Math.min(h, top + 0.35);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + cw / 2 + i * cw, k = Math.sqrt(Math.max(0, 1 - (2 * x / w) ** 2));
      list.push({ x, z: -d / 2 + head / 2, ry: 0, w: cw * 1.01, h: hmin + (h - hmin) * k });
    }
    g.add(channels(list, head, 0, soft));
  } else {
    g.add(slab(rrectPts(w, fd, 0.08), frameH, body, 0, 0.012).translateZ(head / 2));   // rounded oak frame
    g.add(slab(rrectPts(w, head, 0.04), h, body, 0, 0.012).translateZ(-d / 2 + head / 2));
    g.add(puffy(w - 0.12, Math.min(0.42, h - top), 0.12, soft, 0, top, -d / 2 + head + 0.06, 0.05, 0.1));
  }
  bedding(g, w, d, h, head, frameH, top, s);
  return g;
}

// ---------- chairs ----------

function chair(w, d, h, c, s) {
  const st = style3d(), g = new THREE.Group(), soft = M('soft', s), metal = M('metal', s), body = M('body', s);
  const seatH = Math.min(0.47, h * 0.52);
  if (st === 'deco') return decoShell(w, d, h, s, seatH);
  if (st === 'milano') {
    // Bronze frame (four rods, a back stile pair), upholstered shell seat and back.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(rod(0.008, seatH - 0.06, metal, sx * (w / 2 - 0.03), 0, sz * (d / 2 - 0.04)));
    g.add(puffy(w, 0.08, d - 0.02, soft, 0, seatH - 0.08, 0.01, 0.03, 0.15));
    g.add(rbox(w - 0.02, h - seatH - 0.04, 0.06, soft, 0, seatH + 0.02, -d / 2 + 0.03, 0.025));
  } else if (st === 'couture') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(shoeLeg(seatH - 0.07, 0.018, sx * (w / 2 - 0.04), sz * (d / 2 - 0.04), body, metal));
    g.add(rbox(w, 0.07, d, soft, 0, seatH - 0.07, 0, 0.02));
    g.add(piping(w, d, seatH - 0.004, soft, 0.005, 0.02));
    // Medallion back: an upholstered oval on two stiles.
    const bh = h - seatH - 0.04, oval = new THREE.Shape();
    oval.absellipse(0, 0, (w - 0.06) / 2, bh / 2, 0, 2 * Math.PI);
    const geo = new THREE.ExtrudeGeometry(oval, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 24 });
    g.add(mesh(geo, soft, 0, seatH + 0.02 + bh / 2, -d / 2 + 0.01));
    for (const sx of [-1, 1]) g.add(box(0.025, bh * 0.6, 0.025, body, sx * (w / 2 - 0.04), seatH, -d / 2 + 0.03));
  } else {
    const r = Math.min(0.022, w * 0.05);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(mesh(new THREE.CylinderGeometry(r, r * 0.75, seatH - 0.03, 14), body, sx * (w / 2 - 0.04), (seatH - 0.03) / 2, sz * (d / 2 - 0.04)));
    }
    g.add(slab(rrectPts(w, d, 0.06), 0.03, body, seatH - 0.03, 0.008));
    g.add(puffy(w - 0.06, 0.04, d - 0.08, soft, 0, seatH, 0.02, 0.02, 0.2));
    // Curved oak back rail on two posts.
    const bh = Math.min(0.14, (h - seatH) * 0.4);
    for (const sx of [-1, 1]) g.add(rod(0.013, h - bh - seatH, body, sx * (w / 2 - 0.05), seatH, -d / 2 + 0.03));
    g.add(slab(rrectPts(w - 0.02, 0.035, 0.017), bh, body, h - bh, 0.006).translateZ(-d / 2 + 0.02));
  }
  return g;
}

// ---------- tables ----------

function topShape(st, w, d, round) {
  if (round) return superPts(w, d, st === 'organic' ? 2.2 : 2, 64);
  if (st === 'organic') return superPts(w, d, 3.4, 64);
  return rrectPts(w, d, st === 'milano' ? 0.02 : st === 'couture' ? 0.01 : 0.05);
}

// Dining / round / coffee table and desk tops; under: the base of the collection.
function table(w, d, h, c, s, kind = 'dining') {
  const st = style3d(), g = new THREE.Group(), metal = M('metal', s), body = M('body', s), stone = M('stone', s);
  const round = kind === 'round', low = kind === 'coffee';
  const t = st === 'milano' || st === 'couture' ? 0.04 : 0.035;
  const topMat = st === 'organic' ? body : st === 'deco' ? M('body', s) : stone;
  g.add(slab(topShape(st, w, d, round), t, topMat, h - t, st === 'organic' ? 0.012 : 0.006));
  const under = h - t;
  if (st === 'couture') g.add(slab(topShape(st, w - 0.004, d - 0.004, round), 0.012, metal, under - 0.012, 0.002));   // brass skirt
  if (st === 'deco' && !low) g.add(slab(topShape(st, w * 0.94, d * 0.94, round), 0.003, metal, h - 0.0025, 0));       // brass inlay line
  const two = !round && w > 1.5 && !low;
  if (st === 'milano') {
    if (low) g.add(box(w * 0.78, under, d * 0.62, stone, 0, 0, 0));                 // monolith
    else if (two) for (const sx of [-1, 1]) g.add(box(0.1, under, d * 0.6, stone, sx * w * 0.28, 0, 0));
    else g.add(slab(superPts(Math.min(w, d) * 0.42, Math.min(w, d) * 0.42, 2, 40), under, stone, 0, 0.004));
  } else if (st === 'couture') {
    if (low) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(rod(0.008, under, metal, sx * (w / 2 - 0.03), 0, sz * (d / 2 - 0.03)));
      g.add(box(w - 0.06, 0.01, d - 0.06, furnitureMat('smokedGlass', '', s), 0, Math.min(0.12, under * 0.3), 0));
    } else if (round) {
      g.add(shoeLeg(under - 0.04, 0.06, 0, 0, body, metal));
      g.add(slab(superPts(Math.min(w, 0.6), Math.min(d, 0.6), 2, 40), 0.04, metal, 0, 0.005));
    } else {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(shoeLeg(under, 0.03, sx * (w / 2 - 0.08), sz * (d / 2 - 0.08), body, metal));
      g.add(box(w - 0.2, 0.07, d - 0.2, body, 0, under - 0.07, 0));                 // apron
    }
  } else if (st === 'deco') {
    if (low) {
      g.add(slab(topShape(st, w, d, round), 0.03, metal, 0, 0.004));
      g.add(slab(topShape(st, w - 0.03, d - 0.03, round), under - 0.03, body, 0.03, 0.01));
    } else {
      const R = Math.min(0.13, Math.min(w, d) * 0.18);
      const xs = two ? [-w * 0.27, w * 0.27] : [0];
      for (const x of xs) {
        g.add(fluted(R, under - 0.04, body, x, 0.04, 0, 16));
        g.add(slab(superPts(R * 3, R * 3, 2, 40), 0.04, metal, 0, 0.004).translateX(x));
      }
    }
  } else {
    if (low) {
      g.add(slab(superPts(w * 0.7, d * 0.7, 2.6, 48), under, stone, 0, 0.02));
    } else if (round) {
      const n = 3, R = Math.min(w, d) * 0.28;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * Math.PI + Math.PI / 2;
        g.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, under, 16), body, R * Math.cos(a), under / 2, R * Math.sin(a)));
      }
    } else {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        g.add(mesh(new THREE.CylinderGeometry(0.04, 0.03, under, 16), body, sx * (w / 2 - 0.12), under / 2, sz * (d / 2 - 0.12)));
      }
    }
  }
  return g;
}

const roundtable = (w, d, h, c, s) => table(w, d, h, c, s, 'round');
const coffeetable = (w, d, h, c, s) => table(w, d, h, c, s, 'coffee');

// Drawer of the collection: front, box, pull; slides out along +z.
function drawer(fw, fh, y, zFront, depth, s) {
  const st = style3d(), leaf = new THREE.Group(), face = M('facade', s), metal = M('metal', s);
  leaf.add(box(fw, fh, 0.018, face, 0, y, zFront - 0.009));
  leaf.add(box(fw - 0.04, fh * 0.65, depth, M('body', s), 0, y + 0.01, zFront - 0.018 - depth / 2));
  if (st === 'couture') {
    const ring = new THREE.TorusGeometry(0.018, 0.003, 6, 20);
    leaf.add(mesh(ring, metal, 0, y + fh / 2 - 0.01, zFront + 0.006));
    leaf.add(mesh(new THREE.SphereGeometry(0.006, 8, 6), metal, 0, y + fh / 2 + 0.008, zFront + 0.004));
  } else if (st === 'deco') {
    leaf.add(box(Math.min(0.16, fw * 0.4), 0.012, 0.012, metal, 0, y + fh / 2 - 0.006, zFront + 0.006));
  } else if (st === 'milano') {
    leaf.add(box(fw, 0.012, 0.004, metal, 0, y + fh - 0.012, zFront - 0.001));   // bronze gola line
  }
  return slider(leaf, depth);
}

function nightstand(w, d, h, c, s) {
  const st = style3d(), g = new THREE.Group(), body = M('body', s), metal = M('metal', s);
  let legH = 0;
  if (st === 'couture') {
    legH = Math.min(0.14, h * 0.25);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(shoeLeg(legH, 0.016, sx * (w / 2 - 0.035), sz * (d / 2 - 0.035), body, metal));
  } else if (st === 'milano') {
    legH = 0.04;
    g.add(box(w - 0.06, legH, d - 0.06, metal, 0, 0, -0.01));
  } else if (st === 'deco') {
    legH = 0.03;
    g.add(slab(rrectPts(w, d, 0.05), legH, metal, 0, 0.004));
  } else {
    legH = Math.min(0.08, h * 0.15);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(mesh(new THREE.CylinderGeometry(0.018, 0.013, legH, 12), body, sx * (w / 2 - 0.05), legH / 2, sz * (d / 2 - 0.05)));
    }
  }
  const r = st === 'deco' ? 0.05 : st === 'organic' ? 0.035 : 0.006;
  const zf = d / 2 - 0.012;           // drawer fronts: the pulls stay inside the item depth
  g.add(rbox(w, h - legH, d - 0.03, body, 0, legH, -0.015, r));
  if (st === 'couture' || st === 'milano') g.add(slab(rrectPts(w, d, 0.01), 0.02, M('stone', s), h - 0.02, 0.004));
  const n = Math.max(1, conf().drawers), gap = 0.01, top = st === 'couture' || st === 'milano' ? 0.03 : 0.02;
  const dh = (h - legH - top - gap * (n + 1)) / n, inset = r > 0.02 ? r * 0.6 : 0.01;
  for (let i = 0; i < n; i++) g.add(drawer(w - 2 * inset, dh, legH + gap + i * (dh + gap), zf, d * 0.65, s));
  return g;
}

function desk(w, d, h, c, s) {
  const st = style3d(), g = new THREE.Group(), body = M('body', s), metal = M('metal', s);
  const t = 0.035;
  g.add(slab(topShape(st, w, d, false), t, st === 'organic' ? body : M('body', s), h - t, st === 'organic' ? 0.012 : 0.006));
  if (st === 'couture') g.add(box(w - 0.2, 0.004, d - 0.2, M('leather', s), 0, h, 0));      // leather writing inset
  const under = h - t, apron = 0.12, dw = Math.min(0.5, w * 0.36);
  if (st === 'couture' || st === 'organic') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - 0.06), z = sz * (d / 2 - 0.06);
      g.add(st === 'couture' ? shoeLeg(under, 0.024, x, z, body, metal) : mesh(new THREE.CylinderGeometry(0.03, 0.022, under, 14), body, x, under / 2, z));
    }
    g.add(box(w - 0.18, apron, d - 0.14, body, 0, under - apron, -0.02));
    g.add(drawer(dw, apron - 0.02, under - apron + 0.01, d / 2 - 0.08, d * 0.55, s));
  } else {
    // Panel end on the left, a drawer pedestal on the right (milano: in stone, deco: fluted).
    if (st === 'deco') g.add(fluted(Math.min(0.11, d * 0.2), under, body, -w / 2 + 0.14, 0, 0, 14));
    else g.add(box(0.05, under, d - 0.06, M('stone', s), -w / 2 + 0.06, 0, 0));
    const pw = Math.min(0.42, w * 0.32), px = w / 2 - pw / 2 - 0.02;
    const ped = new THREE.Group();
    ped.add(rbox(pw, under, d - 0.06, body, 0, 0, -0.01, st === 'deco' ? 0.04 : 0.006));
    const n = 3, dh = (under - 0.06) / n;
    for (let i = 0; i < n; i++) ped.add(drawer(pw - 0.03, dh - 0.012, 0.05 + i * dh, d / 2 - 0.03, d * 0.6, s));
    ped.position.x = px;
    g.add(ped);
  }
  return g;
}

const SOFT = { sofa, armchair, cornersofa, pouf, bed, bed1: bed, chair, table, roundtable, coffeetable, nightstand, desk };
/** Builders of the luxe collections by type (the same set for each style; the style is read while building). */
export const LUXE_BUILDERS = SOFT;
