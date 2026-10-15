// Trees of the site: a trunk with a few boughs (bark) and a crown of leaf cards — small squares with a cluster of
// leaves on a transparent ground (alphaTest, so the shadows have the leaves' outline too). The normals of the
// cards point away from the crown's centre: the crown is lit like one soft volume, light on top, darker below,
// instead of every card flashing on its own. Three tree shapes, each one InstancedMesh for the bark and one for
// the leaves: 6 draw calls for all the trees. The leaf texture is drawn in a canvas: painted leaves at first,
// photo leaves (library set "leaves", colour + opacity) once they are on disk; bark — the photo set "bark".
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const VARIANTS = 3;
const CARDS = 72;
const LEAF_TEX = 512;
// Leaf tones (they multiply the bright leaf texture): from deep summer green to a lighter, yellower one.
const GREENS = ['#7a9c55', '#6a8f4c', '#88a85c', '#5f8546', '#93aa5e'];

function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// One tree shape at scale 1 (about 5 m high): { bark, leaves } geometries.
function treeShape(seed) {
  const rnd = rng(seed);
  const H = 2.3 + rnd() * 0.4;
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.1, 0.17, H + 0.4, 9, 1, true);
  trunk.translate(0, (H + 0.4) / 2, 0);
  parts.push(trunk);
  // Boughs: from the top of the trunk outwards and up into the crown.
  const n = 4 + Math.floor(rnd() * 2), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const len = 1.1 + rnd() * 0.6, az = (i / n + rnd() * 0.15) * Math.PI * 2, tilt = 0.6 + rnd() * 0.35;
    const g = new THREE.CylinderGeometry(0.035, 0.075, len, 6, 1, true);
    g.translate(0, len / 2, 0);
    const dir = new THREE.Vector3(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az));
    g.applyQuaternion(q.setFromUnitVectors(up, dir));
    g.translate(0, H - 0.25 - rnd() * 0.4, 0);
    parts.push(g);
  }
  const bark = mergeGeometries(parts);
  for (const g of parts) g.dispose();

  // Crown: an ellipsoid of leaf cards, denser towards its surface; cards face mostly outwards.
  const C = new THREE.Vector3((rnd() - 0.5) * 0.3, H + 1.05, (rnd() - 0.5) * 0.3);
  const R = new THREE.Vector3(1.75 + rnd() * 0.35, 1.4 + rnd() * 0.3, 1.75 + rnd() * 0.35);
  const cards = [], v = new THREE.Vector3(), nrm = new THREE.Vector3(), e = new THREE.Euler();
  for (let i = 0; i < CARDS; i++) {
    const s = 0.85 + rnd() * 0.55;
    const g = new THREE.PlaneGeometry(s, s);
    // A random direction, then towards the surface (r ≈ 0.45 … 1).
    v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    if (v.lengthSq() < 1e-4) v.set(0, 1, 0);
    v.normalize();
    const r = 0.45 + 0.55 * Math.sqrt(rnd());
    const p = new THREE.Vector3(C.x + v.x * R.x * r, C.y + v.y * R.y * r, C.z + v.z * R.z * r);
    // Face outwards with a random twist and tilt.
    g.applyQuaternion(q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v));
    e.set((rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2, rnd() * Math.PI * 2);
    g.applyQuaternion(new THREE.Quaternion().setFromEuler(e));
    g.translate(p.x, p.y, p.z);
    // Normals from the crown's centre, a little towards the sky.
    const pos = g.attributes.position, nor = g.attributes.normal;
    for (let k = 0; k < pos.count; k++) {
      nrm.set((pos.getX(k) - C.x) / R.x, (pos.getY(k) - C.y) / R.y + 0.35, (pos.getZ(k) - C.z) / R.z).normalize();
      nor.setXYZ(k, nrm.x, nrm.y, nrm.z);
    }
    cards.push(g);
  }
  const leaves = mergeGeometries(cards);
  for (const g of cards) g.dispose();
  return { bark, leaves };
}

// A cluster of leaves round the centre of a square canvas, on twigs. `leaf(g, i)` draws leaf i with its stem at
// (0, 0) and its tip towards −y, about 1 unit long.
function drawCluster(c, leaf, seed) {
  const g = c.getContext('2d'), S = c.width, rnd = rng(seed);
  g.clearRect(0, 0, S, S);
  // Twigs from the centre outwards.
  g.strokeStyle = '#4b3a2a';
  g.lineCap = 'round';
  const tips = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.5, len = S * (0.3 + rnd() * 0.15);
    const x = S / 2 + Math.cos(a) * len, y = S / 2 + Math.sin(a) * len;
    g.lineWidth = S * 0.008;
    g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(x, y); g.stroke();
    tips.push([a, len]);
  }
  // Leaves along the twigs, pointing away from the centre; some across the middle.
  for (let i = 0; i < 64; i++) {
    const [a0, len] = tips[i % tips.length];
    const t = 0.25 + rnd() * 0.85, a = a0 + (rnd() - 0.5) * 0.5;
    const x = S / 2 + Math.cos(a) * len * t, y = S / 2 + Math.sin(a) * len * t;
    const size = S * (0.09 + rnd() * 0.05);
    g.save();
    g.translate(x, y);
    g.rotate(a + Math.PI / 2 + (rnd() - 0.5) * 1.2);
    g.scale(size, size);
    g.globalAlpha = 1;
    leaf(g, i, rnd);
    g.restore();
  }
}

// Painted leaves (before the photos arrive, or when there are none).
function paintedLeaf(g, i, rnd) {
  const k = 0.85 + rnd() * 0.3;
  g.fillStyle = `rgb(${Math.round(178 * k)},${Math.round(206 * k)},${Math.round(104 * k)})`;
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(0.42, -0.25, 0.32, -0.8, 0, -1);
  g.bezierCurveTo(-0.32, -0.8, -0.42, -0.25, 0, 0);
  g.fill();
  g.strokeStyle = 'rgba(70,90,40,0.5)';
  g.lineWidth = 0.03;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -0.9); g.stroke();
}

// Photo leaves: the colour image with its opacity as alpha, cut into the six leaves of the set (3 × 2, tip up).
function photoLeaves(color, opacity) {
  const w = color.width, h = color.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(opacity, 0, 0, w, h);
  const a = g.getImageData(0, 0, w, h).data;
  g.drawImage(color, 0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < a.length; i += 4) img.data[i + 3] = a[i];
  g.putImageData(img, 0, 0);
  const cw = w / 3, ch = h / 2;
  return (gg, i, rnd) => {
    const k = i % 6, sx = (k % 3) * cw, sy = Math.floor(k / 3) * ch;
    const s = 0.9 + rnd() * 0.25;
    // The cell is a leaf with its stem at the bottom: stem at (0, 0), tip at −y.
    gg.drawImage(c, sx, sy, cw, ch, -0.33 * s, -1 * s, 0.66 * s, 1 * s);
  };
}

/**
 * createTrees(list, { seed }) → { group, setPhoto({ leaves: { color, opacity }, bark: { color, normal, roughness } }, opts) }
 * list: [{ x, z, k }] — position (m) and size factor of each tree.
 */
export function createTrees(list, { seed = 12 } = {}) {
  const rnd = rng(seed * 31 + 7);
  const group = new THREE.Group();
  group.name = 'trees';
  const leafCanvas = document.createElement('canvas');
  leafCanvas.width = leafCanvas.height = LEAF_TEX;
  drawCluster(leafCanvas, paintedLeaf, seed);
  const leafMap = new THREE.CanvasTexture(leafCanvas);
  leafMap.colorSpace = THREE.SRGBColorSpace;
  leafMap.anisotropy = 4;
  const leafMat = new THREE.MeshStandardMaterial({ map: leafMap, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 });
  const barkMat = new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 0.95 });

  const shapes = Array.from({ length: VARIANTS }, (_, i) => treeShape(seed * 101 + i * 977));
  const byShape = shapes.map(() => []);
  list.forEach((t, i) => byShape[i % VARIANTS].push(t));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  const yAxis = new THREE.Vector3(0, 1, 0);
  shapes.forEach((shape, v) => {
    const ts = byShape[v];
    if (!ts.length) return;
    const bark = new THREE.InstancedMesh(shape.bark, barkMat, ts.length);
    const leaves = new THREE.InstancedMesh(shape.leaves, leafMat, ts.length);
    ts.forEach((t, i) => {
      m.compose(p.set(t.x, 0, t.z), q.setFromAxisAngle(yAxis, rnd() * Math.PI * 2), s.setScalar(t.k));
      bark.setMatrixAt(i, m);
      leaves.setMatrixAt(i, m);
      leaves.setColorAt(i, c.set(GREENS[Math.floor(rnd() * GREENS.length)]));
    });
    bark.castShadow = leaves.castShadow = true;
    bark.receiveShadow = leaves.receiveShadow = true;
    bark.computeBoundingSphere();
    leaves.computeBoundingSphere();
    group.add(bark, leaves);
  });

  /** Photo leaves and bark (either may be missing). */
  function setPhoto({ leaves, bark } = {}, { anisotropy = 4, small = false } = {}) {
    if (leaves?.color && leaves?.opacity) {
      drawCluster(leafCanvas, photoLeaves(leaves.color, leaves.opacity), seed);
      leafMap.needsUpdate = true;
    }
    if (bark?.color) {
      const tex = (img, color) => {
        const t = new THREE.Texture(img);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(2, 3);
        t.anisotropy = anisotropy;
        if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) t.flipY = false;   // bitmaps cannot be flipped
        if (color) t.colorSpace = THREE.SRGBColorSpace;
        t.needsUpdate = true;
        return t;
      };
      barkMat.map = tex(bark.color, true);
      barkMat.normalMap = bark.normal && !small ? tex(bark.normal, false) : null;
      barkMat.roughnessMap = bark.roughness ? tex(bark.roughness, false) : null;
      barkMat.color.set('#c9bdb0');
      barkMat.roughness = 1;
      barkMat.needsUpdate = true;
    }
  }

  return { group, setPhoto };
}
