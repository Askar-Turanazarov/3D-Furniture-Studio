// The site around the building: lawn, paving round the house and to the street, sidewalk, road with markings,
// parking with cars, trees, benches, lamps (lit at night), a small playground and the entrance porch.
// Everything is procedural: merged geometry per material, trees and cars as InstancedMesh.
// Units: metres, building centred on the origin, south (+z) towards the street. `site` sizes are in cm.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SITE_DEFAULTS = { L: 9000, W: 7600, road: 'south', parking: 'east', trees: 40 };

function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.repeat.set(...repeat);
  return t;
}

const grass = rnd => canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#7f9a62';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) {
    const v = rnd();
    g.fillStyle = v < 0.45 ? 'rgba(70,98,48,.35)' : v < 0.85 ? 'rgba(150,175,110,.3)' : 'rgba(120,110,70,.25)';
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 3);
  }
});

// Concrete pavers 40 × 40 cm with joints (1 texture = 1.6 m).
const pavers = rnd => canvasTexture(256, 256, (g) => {
  g.fillStyle = '#8f8a82';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = 178 + Math.floor(rnd() * 22);
    g.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
    g.fillRect(x * 64 + 1.5, y * 64 + 1.5, 61, 61);
  }
});

const asphalt = rnd => canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#45484d';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6000; i++) {
    const v = 50 + Math.floor(rnd() * 50);
    g.fillStyle = `rgba(${v},${v},${v + 3},.5)`;
    g.fillRect(rnd() * w, rnd() * h, 1, 1);
  }
});

// Planar UVs (x, z) in metres / tile for flat boxes.
function planarUV(geo, tile) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / tile, p.getZ(i) / tile);
  return geo;
}

/**
 * createSite({ fac, site, seed, wallT, lampLights }) → { group, setTime(p), obstacles }
 * obstacles: footprints (x0, z0, x1, z1 in metres) of trees, benches, lamps and cars, for walking later.
 */
export function createSite({ fac, site = {}, seed = 12, wallT = 0.3, lampLights = true }) {
  const s = { ...SITE_DEFAULTS, ...site };
  const rnd = rng(seed * 7919 + 17);
  const M = 0.01, hx = fac.L * M / 2 + wallT, hz = fac.W * M / 2 + wallT;   // outer faces of the building
  const SL = s.L * M / 2, SW = s.W * M / 2;                                    // half site
  const group = new THREE.Group();
  group.name = 'site';
  const obstacles = [];

  const mats = {
    pave: new THREE.MeshStandardMaterial({ map: pavers(rnd), roughness: 0.9 }),
    road: new THREE.MeshStandardMaterial({ map: asphalt(rnd), roughness: 0.95 }),
    curb: new THREE.MeshStandardMaterial({ color: '#b9b4ab', roughness: 0.85 }),
    paint: new THREE.MeshStandardMaterial({ color: '#f1f1ec', roughness: 0.7 }),
    wood: new THREE.MeshStandardMaterial({ color: '#9a6a40', roughness: 0.65 }),
    metal: new THREE.MeshStandardMaterial({ color: '#33373c', roughness: 0.45, metalness: 0.6 }),
    granite: new THREE.MeshStandardMaterial({ color: '#9b968d', roughness: 0.6 }),
    play: new THREE.MeshStandardMaterial({ color: '#c4614f', roughness: 0.95 }),
    toy: new THREE.MeshStandardMaterial({ color: '#f2b233', roughness: 0.6 }),
    head: new THREE.MeshBasicMaterial({ color: '#d9d6cf' })
  };
  const parts = Object.fromEntries(Object.keys(mats).map(k => [k, []]));
  const box = (kind, x0, x1, y0, y1, z0, z1) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    parts[kind].push(g);
  };

  // Lawn under everything (a big plane, fog hides its edge).
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ map: grass(rnd), roughness: 1 }));
  lawn.material.map.repeat.set(200, 200);
  lawn.rotation.x = -Math.PI / 2;
  lawn.receiveShadow = true;
  group.add(lawn);

  // Street on the south: sidewalk, curb, two-lane road with a dashed centre line.
  const walkZ0 = SW - 3.2, walkZ1 = SW, roadZ0 = SW + 0.25, roadZ1 = SW + 7.25;
  const far = Math.max(SL + 60, 140);
  box('pave', -far, far, 0, 0.1, walkZ0, walkZ1);
  box('curb', -far, far, 0, 0.14, walkZ1, roadZ0);
  box('road', -far, far, 0, 0.04, roadZ0, roadZ1);
  box('curb', -far, far, 0, 0.14, roadZ1, roadZ1 + 0.25);
  for (let x = -far + 1; x < far - 3; x += 6) box('paint', x, x + 3, 0.04, 0.05, (roadZ0 + roadZ1) / 2 - 0.06, (roadZ0 + roadZ1) / 2 + 0.06);

  // Paving round the building, the path from the entrance to the sidewalk, the porch under the canopy.
  const ring = 2.4;
  box('pave', -hx - ring, hx + ring, 0, 0.08, -hz - ring, -hz);
  box('pave', -hx - ring, hx + ring, 0, 0.08, hz, hz + ring);
  box('pave', -hx - ring, -hx, 0, 0.08, -hz, hz);
  box('pave', hx, hx + ring, 0, 0.08, -hz, hz);
  const ent = fac.entrance, ex = (ent.x0 + ent.x1) / 2 * M - fac.L * M / 2;
  const pathW = 3.2;
  box('pave', ex - pathW / 2, ex + pathW / 2, 0, 0.08, hz + ring, walkZ0);
  box('granite', ex - 3.2, ex + 3.2, 0, 0.16, hz, hz + 2.6);
  // Paths to the parking and the playground.
  box('pave', hx + ring, SL - 18, 0, 0.08, hz + 6, hz + 8.4);
  box('pave', -SL + 20, -hx - ring, 0, 0.08, hz + 6, hz + 8.4);

  // Parking east: asphalt, stalls 2.5 × 5 m in two rows, a driveway to the road, cars.
  const px0 = hx + 8, px1 = Math.min(SL - 2, px0 + 16), pz0 = -hz + 2, pz1 = walkZ0 - 0.5;
  box('road', px0, px1, 0, 0.05, pz0, pz1);
  box('road', px0 + 4, px1 - 4, 0, 0.05, pz1, roadZ0);
  const stalls = [];
  for (let z = pz0 + 0.5; z + 2.5 <= pz1 - 7; z += 2.6) {
    for (const [x0, x1] of [[px0, px0 + 5], [px1 - 5, px1]]) {
      box('paint', x0, x1, 0.05, 0.06, z, z + 0.08);
      stalls.push({ x: (x0 + x1) / 2, z: z + 1.3 });
    }
  }
  // Cars: body and cabin as two instanced boxes, every other stall roughly.
  const carCols = ['#d0d4d8', '#22262b', '#7d8590', '#8a1c1c', '#1f3d6b', '#e8e6e0', '#55606b'];
  const cars = stalls.filter(() => rnd() < 0.55);
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.5 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: '#1d242c', roughness: 0.15, metalness: 0.6 });
  const bodies = new THREE.InstancedMesh(unit, bodyMat, Math.max(1, cars.length));
  const cabins = new THREE.InstancedMesh(unit, cabinMat, Math.max(1, cars.length));
  bodies.count = cabins.count = cars.length;
  const m = new THREE.Matrix4(), c = new THREE.Color();
  cars.forEach((p, i) => {
    m.makeScale(4.4, 0.8, 1.8).setPosition(p.x, 0.55, p.z);
    bodies.setMatrixAt(i, m);
    bodies.setColorAt(i, c.set(carCols[Math.floor(rnd() * carCols.length)]));
    m.makeScale(2.3, 0.6, 1.6).setPosition(p.x + (p.x < (px0 + px1) / 2 ? -0.2 : 0.2), 1.2, p.z);
    cabins.setMatrixAt(i, m);
    obstacles.push({ x0: p.x - 2.3, z0: p.z - 1, x1: p.x + 2.3, z1: p.z + 1 });
  });
  bodies.castShadow = cabins.castShadow = true;
  group.add(bodies, cabins);

  // Playground west of the entrance: rubber surface, a slide tower, a swing frame.
  const gx0 = -SL + 6, gx1 = gx0 + 12, gz0 = hz + 10, gz1 = Math.min(walkZ0 - 3, gz0 + 10);
  if (gx1 < -hx - ring - 2 && gz1 > gz0 + 4) {
    box('play', gx0, gx1, 0, 0.06, gz0, gz1);
    box('toy', gx0 + 2, gx0 + 4, 0, 1.6, gz0 + 2, gz0 + 4);
    box('wood', gx0 + 2, gx0 + 4, 1.6, 1.75, gz0 + 2, gz0 + 4);
    const slide = new THREE.BoxGeometry(0.8, 0.08, 3.2);
    slide.rotateX(-0.5);
    slide.translate(gx0 + 3, 0.85, gz0 + 5.4);
    parts.toy.push(slide);
    for (const x of [gx0 + 7, gx0 + 10]) box('metal', x - 0.06, x + 0.06, 0, 2.3, gz0 + 4, gz0 + 4.12);
    box('metal', gx0 + 7, gx0 + 10, 2.3, 2.4, gz0 + 4, gz0 + 4.12);
    box('wood', gx0 + 7.8, gx0 + 9.2, 0.45, 0.5, gz0 + 3.8, gz0 + 4.3);
    obstacles.push({ x0: gx0, z0: gz0, x1: gx1, z1: gz1 });
  }

  // Benches along the entrance path.
  for (const sx of [-1, 1]) for (const k of [0, 1]) {
    const x = ex + sx * (pathW / 2 + 0.6), z = hz + ring + 3 + k * 4.5;
    box('wood', x - 0.25, x + 0.25, 0.42, 0.47, z - 0.9, z + 0.9);
    box('wood', x + sx * 0.22, x + sx * 0.27, 0.47, 0.85, z - 0.9, z + 0.9);
    for (const dz of [-0.75, 0.75]) box('metal', x - 0.22, x + 0.22, 0, 0.42, z + dz - 0.03, z + dz + 0.03);
    obstacles.push({ x0: x - 0.35, z0: z - 1, x1: x + 0.35, z1: z + 1 });
  }

  // Lamps: along the entrance path and the sidewalk; heads glow at night, the four nearest the door light up.
  const lamps = [];
  for (const sx of [-1, 1]) for (const z of [hz + ring + 1, hz + ring + 8]) lamps.push({ x: ex + sx * (pathW / 2 + 0.35), z });
  for (let x = -SL + 4; x <= SL - 4; x += 14) lamps.push({ x, z: walkZ0 + 0.4 });
  for (const l of lamps) {
    box('metal', l.x - 0.05, l.x + 0.05, 0, 3.6, l.z - 0.05, l.z + 0.05);
    box('head', l.x - 0.16, l.x + 0.16, 3.6, 3.85, l.z - 0.16, l.z + 0.16);
    obstacles.push({ x0: l.x - 0.15, z0: l.z - 0.15, x1: l.x + 0.15, z1: l.z + 0.15 });
  }
  const lights = [];
  if (lampLights) {
    for (const l of [...lamps].sort((p, q) => Math.hypot(p.x - ex, p.z - hz) - Math.hypot(q.x - ex, q.z - hz)).slice(0, 4)) {
      const p = new THREE.PointLight('#ffd59a', 0, 12, 1.8);
      p.position.set(l.x, 3.5, l.z);
      lights.push(p);
      group.add(p);
    }
  }

  // Trees: a row along the sidewalk and groups on the lawn, away from the house, paths, parking and playground.
  const free = (x, z, r) => {
    const out = [
      { x0: -hx - ring - 1.5, z0: -hz - ring - 1.5, x1: hx + ring + 1.5, z1: hz + ring + 1.5 },   // house and paving
      { x0: ex - pathW / 2 - 1.5, z0: hz, x1: ex + pathW / 2 + 1.5, z1: walkZ1 },                 // entrance path
      { x0: px0 - 1, z0: pz0 - 1, x1: px1 + 1, z1: roadZ0 },                                     // parking
      { x0: hx + ring, z0: hz + 5, x1: SL - 18, z1: hz + 9.5 }, { x0: -SL + 20, z0: hz + 5, x1: -hx - ring, z1: hz + 9.5 },
      { x0: -Infinity, z0: walkZ0 - 0.2, x1: Infinity, z1: Infinity },                            // street
      ...obstacles
    ];
    return !out.some(o => x + r > o.x0 && x - r < o.x1 && z + r > o.z0 && z - r < o.z1);
  };
  const trees = [];
  for (let x = -SL + 7; x < SL - 3; x += 8 + rnd() * 2) {
    if (Math.abs(x - ex) > pathW / 2 + 1.2 && !(x > px0 - 2 && x < px1 + 2)) trees.push({ x, z: walkZ0 - 1.6, k: 0.8 + rnd() * 0.3 });
  }
  for (let tries = 0; trees.length < s.trees && tries < 3000; tries++) {
    const x = (rnd() * 2 - 1) * (SL - 3), z = (rnd() * 2 - 1) * (SW - 3);
    const k = 0.7 + rnd() * 0.7;
    if (!free(x, z, 1.6 * k) || trees.some(q => Math.hypot(q.x - x, q.z - z) < 4.5)) continue;
    trees.push({ x, z, k });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 0.9 }), trees.length);
  const crownMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true });
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, trees.length * 2);
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const greens = ['#5f8a44', '#6e9a4c', '#4f7a3e', '#7ea455', '#5b7f3a'];
  trees.forEach((t, i) => {
    const h = 2.6 * t.k;
    m.compose(v.set(t.x, 0, t.z), q.identity(), sc.set(t.k, h, t.k));
    trunks.setMatrixAt(i, m);
    const col = c.set(greens[Math.floor(rnd() * greens.length)]);
    for (let j = 0; j < 2; j++) {
      const r = (j ? 1.25 : 1.7) * t.k;
      e.set(rnd() * 3, rnd() * 3, rnd() * 3);
      m.compose(v.set(t.x + (j ? 0.5 : 0) * t.k, h + (j ? 1.7 : 0.9) * t.k, t.z + (j ? -0.3 : 0) * t.k), q.setFromEuler(e), sc.set(r, r * 0.9, r));
      crowns.setMatrixAt(i * 2 + j, m);
      crowns.setColorAt(i * 2 + j, col.clone().offsetHSL(0, 0, j ? 0.05 : 0));
    }
    obstacles.push({ x0: t.x - 0.3, z0: t.z - 0.3, x1: t.x + 0.3, z1: t.z + 0.3 });
  });
  trunks.castShadow = crowns.castShadow = true;
  crowns.receiveShadow = true;
  group.add(trunks, crowns);

  for (const [kind, list] of Object.entries(parts)) {
    if (!list.length) continue;
    const geo = mergeGeometries(list);
    for (const g of list) g.dispose();
    if (kind === 'pave') planarUV(geo, 1.6);
    if (kind === 'road') planarUV(geo, 4);
    const mesh = new THREE.Mesh(geo, mats[kind]);
    mesh.receiveShadow = true;
    mesh.castShadow = kind === 'metal' || kind === 'wood' || kind === 'toy';
    group.add(mesh);
  }

  function setTime(p) {
    mats.head.color.set(p.lamp ? '#ffe2b0' : '#d9d6cf');
    for (const l of lights) l.intensity = p.lamp * 25;
  }

  return { group, setTime, obstacles, trees: trees.length };
}
