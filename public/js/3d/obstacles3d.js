// Structure in 3D: columns, ducts and ledges as wall-coloured boxes; a radiator as a sectional panel.
// Plan cm → scene metres: x → x, y (plan) → z, elev → y.
import * as THREE from 'three';
import { scaleUV } from './room3d.js';
import { getMats, furnitureMat } from './textures3d.js';

const SECTION = 0.08;   // radiator section pitch, m

function mesh(geom, mat) {
  const m = new THREE.Mesh(geom, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function buildObstacles(obstacles = []) {
  const M = getMats();
  const group = new THREE.Group();
  group.name = 'obstacles';
  for (const o of obstacles) {
    const w = o.w / 100, d = o.d / 100, h = o.h / 100;
    const x = o.x / 100 + w / 2, z = o.y / 100 + d / 2, y = o.elev / 100 + h / 2;
    if (o.kind === 'radiator') {
      group.add(radiator(w, h, d, x, y, z));
      continue;
    }
    // Wall texture: 1 tile ≈ 1 m on the largest face.
    const g = scaleUV(new THREE.BoxGeometry(w, h, d), Math.max(w, d), h);
    const m = mesh(g, M.wall);
    m.position.set(x, y, z);
    group.add(m);
  }
  return group;
}

// Vertical sections along the longer plan side, with top and bottom collectors.
function radiator(w, h, d, x, y, z) {
  const mat = furnitureMat('plain', '#f1f3f5');
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const alongX = w >= d;
  const len = alongX ? w : d, depth = alongX ? d : w;
  const n = Math.max(1, Math.floor(len / SECTION));
  const step = len / n;
  for (let i = 0; i < n; i++) {
    const s = -len / 2 + step * (i + 0.5);
    const fin = mesh(new THREE.BoxGeometry(alongX ? step * 0.7 : depth, h, alongX ? depth : step * 0.7), mat);
    fin.position.set(alongX ? s : 0, 0, alongX ? 0 : s);
    g.add(fin);
  }
  for (const yy of [h / 2 - 0.03, -h / 2 + 0.03]) {
    const c = mesh(new THREE.BoxGeometry(alongX ? len : depth * 0.5, 0.04, alongX ? depth * 0.5 : len), mat);
    c.position.y = yy;
    g.add(c);
  }
  return g;
}
