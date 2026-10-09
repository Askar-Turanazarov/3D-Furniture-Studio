// Materials for the room and furniture. Procedural Canvas textures (1 tile = 1 m).
import * as THREE from 'three';

const SIZE = 512;
let mats = null;
const furnCache = new Map();
let tex = null;

// ---------- procedural generators ----------
function canvas(fill) {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  if (fill) { g.fillStyle = fill; g.fillRect(0, 0, SIZE, SIZE); }
  return [c, g];
}

// Deterministic random so textures look the same on every rebuild.
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

function toTexture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

function grainLines(g, r, x, y, w, h, color, count, vertical = false) {
  g.strokeStyle = color;
  for (let i = 0; i < count; i++) {
    g.globalAlpha = 0.05 + r() * 0.12;
    g.lineWidth = 0.5 + r() * 1.5;
    g.beginPath();
    const off = r() * (vertical ? w : h);
    const amp = 1 + r() * 3, freq = 0.01 + r() * 0.03;
    for (let s = 0; s <= (vertical ? h : w); s += 8) {
      const wob = Math.sin(s * freq + off) * amp;
      const px = vertical ? x + off + wob : x + s;
      const py = vertical ? y + s : y + off + wob;
      s === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}

// Oak parquet: staggered planks 12.5 cm wide.
function parquet() {
  const [c, g] = canvas('#a87b4f');
  const [rc, rg] = canvas('#9a9a9a');
  const r = rng(7);
  const rowH = SIZE / 8;
  for (let row = 0; row < 8; row++) {
    let x = -r() * 200;
    while (x < SIZE) {
      const len = 160 + r() * 200;
      const y = row * rowH;
      const tone = 0.85 + r() * 0.3;
      g.fillStyle = `rgb(${190 * tone | 0}, ${140 * tone | 0}, ${90 * tone | 0})`;
      g.fillRect(x, y, len, rowH);
      grainLines(g, r, x, y, len, rowH, '#5a3a1e', 14);
      rg.fillStyle = `rgb(${150 + r() * 40 | 0},${150 + r() * 40 | 0},${150 + r() * 40 | 0})`;
      rg.fillRect(x, y, len, rowH);
      // Seams.
      g.fillStyle = 'rgba(60,35,15,.55)';
      g.fillRect(x, y, 1.5, rowH);
      x += len;
    }
    g.fillStyle = 'rgba(60,35,15,.6)';
    g.fillRect(0, row * rowH, SIZE, 1.5);
  }
  return { map: toTexture(c), roughnessMap: toTexture(rc, false) };
}

// Light plaster with fine speckle.
function plaster() {
  const [c, g] = canvas('#ece6dc');
  const r = rng(11);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(120,100,80,.06)';
    const s = 1 + r() * 3;
    g.fillRect(r() * SIZE, r() * SIZE, s, s);
  }
  return { map: toTexture(c) };
}

// Neutral wood grain (tinted by the item colour).
function woodGrain() {
  const [c, g] = canvas('#e9e4dd');
  const r = rng(23);
  grainLines(g, r, 0, 0, SIZE, SIZE, '#6b5a48', 70, true);
  return { map: toTexture(c) };
}

// Neutral fabric weave (tinted by the item colour).
function fabric() {
  const [c, g] = canvas('#e6e6e6');
  const r = rng(31);
  for (let y = 0; y < SIZE; y += 4) {
    g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.04})`;
    g.fillRect(0, y, SIZE, 2);
  }
  for (let x = 0; x < SIZE; x += 4) {
    g.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.05})`;
    g.fillRect(x, 0, 2, SIZE);
  }
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
    g.fillRect(r() * SIZE, r() * SIZE, 2, 2);
  }
  return { map: toTexture(c) };
}

function textures() {
  if (!tex) tex = { parquet: parquet(), plaster: plaster(), wood: woodGrain(), fabric: fabric() };
  return tex;
}

// ---------- materials ----------
export function getMats() {
  if (mats) return mats;
  const T = textures();
  mats = {
    floor: new THREE.MeshStandardMaterial({ ...T.parquet, roughness: 0.75 }),
    wall: new THREE.MeshStandardMaterial({ ...T.plaster, roughness: 0.95 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }),
    plinth: new THREE.MeshStandardMaterial({ color: '#f7f5f0', roughness: 0.5 }),
    frame: new THREE.MeshStandardMaterial({ color: '#fafafa', roughness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({ color: '#cfe8ff', roughness: 0.05, transparent: true, opacity: 0.25 }),
    sky: new THREE.MeshBasicMaterial({ color: '#bfe3ff' }),
    door: new THREE.MeshStandardMaterial({ ...T.wood, color: '#d9c7ad', roughness: 0.6 }),
    metal: new THREE.MeshStandardMaterial({ color: '#c0c4cc', roughness: 0.3, metalness: 0.9 }),
    lampShade: new THREE.MeshStandardMaterial({ color: '#fff7e0', emissive: '#ffe9b0', emissiveIntensity: 2 })
  };
  return mats;
}

const HIGHLIGHT = {
  ok: null,
  bad: { color: '#ff1a1a', intensity: 0.45 },
  found: { color: '#2fbf4a', intensity: 0.4 }
};

/**
 * Furniture material, cached by kind + colour + status.
 * kind: 'wood' | 'fabric' | 'soft' (light fabric) | 'dark' | 'metal'
 */
export function furnitureMat(kind, color, status = 'ok') {
  const key = `${kind}|${color}|${status}`;
  if (furnCache.has(key)) return furnCache.get(key);
  const T = textures();
  let m;
  switch (kind) {
    case 'wood': m = new THREE.MeshStandardMaterial({ ...T.wood, color, roughness: 0.55 }); break;
    case 'fabric': m = new THREE.MeshStandardMaterial({ ...T.fabric, color, roughness: 0.95 }); break;
    case 'soft': m = new THREE.MeshStandardMaterial({ ...T.fabric, color: '#f4f1ea', roughness: 0.95 }); break;
    case 'dark': m = new THREE.MeshStandardMaterial({ ...T.wood, color: '#4a3a2c', roughness: 0.6 }); break;
    default: m = new THREE.MeshStandardMaterial({ color: '#b8bcc4', roughness: 0.3, metalness: 0.9 });
  }
  const hl = HIGHLIGHT[status];
  if (hl) { m.emissive.set(hl.color); m.emissiveIntensity = hl.intensity; }
  furnCache.set(key, m);
  return m;
}
