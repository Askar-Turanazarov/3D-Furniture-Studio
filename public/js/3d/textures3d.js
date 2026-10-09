// Materials for the room and furniture.
// Quality 'simple': procedural Canvas textures; 'photo': CC0 photo textures from /textures (fallback to simple).
// 1 texture tile = 1 m.
import * as THREE from 'three';

const SIZE = 512;
let mats = null;
const furnCache = new Map();
const finishCache = new Map();
let tex = null;
let photo = null;          // { floor, wall, wood, fabric } → { map, normalMap, roughnessMap } | null
let quality = 'simple';

const PHOTO_SETS = ['floor', 'wall', 'wood', 'fabric'];

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

// Laminate: long planks 20 cm wide, greyish oak.
function laminate() {
  const [c, g] = canvas('#b9a58a');
  const r = rng(41);
  const rowH = SIZE / 5;
  for (let row = 0; row < 5; row++) {
    const y = row * rowH, seam = r() * SIZE, tone = 0.9 + r() * 0.2;
    g.fillStyle = `rgb(${185 * tone | 0}, ${165 * tone | 0}, ${138 * tone | 0})`;
    g.fillRect(0, y, SIZE, rowH);
    grainLines(g, r, 0, y, SIZE, rowH, '#4d3b28', 18);
    g.fillStyle = 'rgba(50,35,20,.5)';
    g.fillRect(seam, y, 1.5, rowH);
    g.fillRect(0, y, SIZE, 1.5);
  }
  return { map: toTexture(c) };
}

// Ceramic tile 50×50 cm with grout.
function tile() {
  const [c, g] = canvas('#bdb9b2');
  const r = rng(53);
  const s = SIZE / 2;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const tone = 0.96 + r() * 0.06;
      g.fillStyle = `rgb(${232 * tone | 0}, ${229 * tone | 0}, ${223 * tone | 0})`;
      g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
      for (let k = 0; k < 500; k++) {
        g.fillStyle = `rgba(120,110,100,${r() * 0.08})`;
        g.fillRect(i * s + 2 + r() * (s - 4), j * s + 2 + r() * (s - 4), 2, 2);
      }
    }
  }
  return { map: toTexture(c) };
}

// Short-pile carpet: dense noise.
function carpet() {
  const [c, g] = canvas('#b3a692');
  const r = rng(61);
  for (let i = 0; i < 40000; i++) {
    g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${r() * 0.1})` : `rgba(60,50,40,${r() * 0.12})`;
    g.fillRect(r() * SIZE, r() * SIZE, 1 + r() * 2, 1 + r() * 2);
  }
  return { map: toTexture(c) };
}

// Wallpaper: soft vertical stripes with a small diamond print (neutral, tinted by the wall colour).
function wallpaper() {
  const [c, g] = canvas('#f4f1ec');
  const step = SIZE / 8;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.05)';
    g.fillRect(i * step, 0, step, SIZE);
  }
  g.fillStyle = 'rgba(120,100,80,.12)';
  for (let x = step / 2; x < SIZE; x += step) {
    for (let y = step / 4; y < SIZE; y += step / 2) {
      g.beginPath();
      g.moveTo(x, y - 6); g.lineTo(x + 4, y); g.lineTo(x, y + 6); g.lineTo(x - 4, y);
      g.fill();
    }
  }
  return { map: toTexture(c) };
}

// Brick 25 cm × ~7 cm in half-bond (light neutral, tinted by the wall colour); mortar is lighter.
function brick() {
  const [c, g] = canvas('#f2eee8');
  const r = rng(71);
  const rows = 14, bw = SIZE / 4, bh = SIZE / rows;
  for (let row = 0; row < rows; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let i = -1; i < 4; i++) {
      const tone = 0.78 + r() * 0.2;
      g.fillStyle = `rgb(${230 * tone | 0}, ${222 * tone | 0}, ${214 * tone | 0})`;
      g.fillRect(i * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }
  for (let k = 0; k < 6000; k++) {
    g.fillStyle = `rgba(70,50,40,${r() * 0.07})`;
    g.fillRect(r() * SIZE, r() * SIZE, 2, 2);
  }
  return { map: toTexture(c) };
}

// Wall panels: vertical boards ≈ 17 cm with grooves.
function panels() {
  const [c, g] = canvas('#ece6dc');
  const r = rng(83);
  const n = 6, pw = SIZE / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.08})`;
    g.fillRect(i * pw, 0, pw, SIZE);
    grainLines(g, r, i * pw, 0, pw, SIZE, '#8a7a66', 6, true);
    g.fillStyle = 'rgba(60,45,30,.35)';
    g.fillRect(i * pw, 0, 2, SIZE);
  }
  return { map: toTexture(c) };
}

const EXTRA = { laminate, tile, carpet, wallpaper, brick, panels };

function textures() {
  if (!tex) tex = { parquet: parquet(), plaster: plaster(), wood: woodGrain(), fabric: fabric() };
  return tex;
}

// Extra finishes are generated on first use.
function extra(name) {
  const T = textures();
  if (!T[name]) T[name] = EXTRA[name]();
  return T[name];
}

// ---------- photo textures ----------
// Custom uploads (colour map only) from the server: { floor: url | null, ... }.
async function customUrls() {
  try {
    const res = await fetch('/api/textures');
    return res.ok ? (await res.json()).custom : {};
  } catch { return {}; }
}

async function loadSet(name, customUrl) {
  const loader = new THREE.TextureLoader();
  const load = async (file, srgb, url = `/textures/${name}/${file}.jpg`) => {
    const t = await loader.loadAsync(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  };
  if (customUrl) {
    // The built-in normal/roughness maps do not match a foreign photo, so use the colour only.
    try { return { map: await load('color', true, customUrl), custom: true }; } catch { /* fall back to built-in */ }
  }
  try {
    const [map, normalMap, roughnessMap] = await Promise.all([
      load('color', true), load('normal', false), load('roughness', false)
    ]);
    // Upholstery is tinted by the item colour, so its photo must be neutral grey.
    return { map: name === 'fabric' ? greyscale(map) : map, normalMap, roughnessMap };
  } catch {
    return null;
  }
}

function greyscale(t) {
  const img = t.image;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
  const k = 215 / (sum / (px.length / 4));          // normalise to a light grey
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.min(255, (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) * k);
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  g.putImageData(d, 0, 0);
  t.dispose();
  return toTexture(c);
}

/** Switch texture quality. Resolves to false if photo textures are missing. */
export async function setQuality(q) {
  let ok = true;
  if (q === 'photo' && !photo) {
    const custom = await customUrls();
    const sets = await Promise.all(PHOTO_SETS.map(n => loadSet(n, custom[n])));
    photo = Object.fromEntries(PHOTO_SETS.map((n, i) => [n, sets[i]]));
    ok = sets.every(Boolean);
  } else if (q === 'photo') {
    ok = Object.values(photo).every(Boolean);
  }
  quality = q;
  mats = null;              // rebuilt on next getMats()
  furnCache.clear();
  finishCache.clear();
  return ok;
}

export const getQuality = () => quality;

/** Forget loaded photo textures (after an upload / reset) so the next setQuality reloads them. */
export function resetPhoto() {
  if (photo) for (const set of Object.values(photo)) if (set) for (const t of Object.values(set)) t?.isTexture && t.dispose();
  photo = null;
}

// Texture set for a surface in the current quality (falls back to procedural).
function surface(name) {
  const p = quality === 'photo' && photo && photo[name];
  if (p) return { ...p, photo: true, custom: !!p.custom };
  const T = textures();
  const simple = { floor: T.parquet, wall: T.plaster, wood: T.wood, fabric: T.fabric }[name];
  return { ...simple, photo: false };
}

// Photo maps are already coloured: tint them only lightly with the item colour (custom ones barely).
function tint(color, isPhoto, isCustom = false) {
  if (!isPhoto) return new THREE.Color(color);
  return new THREE.Color(color).lerp(new THREE.Color('#ffffff'), isCustom ? 0.8 : 0.45);
}

const maps = ({ map, normalMap, roughnessMap }) => {
  const m = { map };
  if (normalMap) m.normalMap = normalMap;
  if (roughnessMap) m.roughnessMap = roughnessMap;
  return m;
};

// ---------- materials ----------
export function getMats() {
  if (mats) return mats;
  const floor = surface('floor'), wall = surface('wall'), wood = surface('wood');
  mats = {
    floor: new THREE.MeshStandardMaterial({ ...maps(floor), roughness: floor.photo ? 1 : 0.75 }),
    wall: new THREE.MeshStandardMaterial({ ...maps(wall), color: wall.photo ? '#f3eee6' : '#ffffff', roughness: 0.95 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }),
    plinth: new THREE.MeshStandardMaterial({ color: '#f7f5f0', roughness: 0.5 }),
    frame: new THREE.MeshStandardMaterial({ color: '#fafafa', roughness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({ color: '#cfe8ff', roughness: 0.05, transparent: true, opacity: 0.25 }),
    sky: new THREE.MeshBasicMaterial({ color: '#bfe3ff' }),
    door: new THREE.MeshStandardMaterial({ ...maps(wood), color: tint('#d9c7ad', wood.photo), roughness: 0.6 }),
    metal: new THREE.MeshStandardMaterial({ color: '#c0c4cc', roughness: 0.3, metalness: 0.9 }),
    lampShade: new THREE.MeshStandardMaterial({ color: '#fff7e0', emissive: '#ffe9b0', emissiveIntensity: 2 })
  };
  return mats;
}

/**
 * Floor and wall materials for a room style (see style.js); accent — the accent-wall material.
 * Parquet and paint use the photo set in Photo quality, the other finishes are procedural.
 */
export function finishMats(style) {
  const key = JSON.stringify(style);
  if (finishCache.has(key)) return finishCache.get(key);
  const floorTex = style.floor === 'parquet' ? surface('floor') : { ...extra(style.floor), photo: false };
  const ROUGH = { parquet: null, laminate: 0.55, tile: 0.25, carpet: 1 };
  const floor = new THREE.MeshStandardMaterial({
    ...maps(floorTex), roughness: style.floor === 'parquet' ? (floorTex.photo ? 1 : 0.75) : ROUGH[style.floor]
  });
  const wm = style.wall.material;
  const wallTex = wm === 'paint' ? surface('wall') : { ...extra(wm), photo: false };
  const wallMat = color => new THREE.MeshStandardMaterial({
    ...maps(wallTex), color: tint(color, wallTex.photo, wallTex.custom), roughness: wm === 'panels' ? 0.6 : 0.95
  });
  const res = { floor, wall: wallMat(style.wall.color), accent: style.accentWall ? wallMat(style.accentColor) : null };
  finishCache.set(key, res);
  return res;
}

const HIGHLIGHT = {
  ok: null,
  bad: { color: '#ff1a1a', intensity: 0.45 },
  found: { color: '#2fbf4a', intensity: 0.4 }
};

/**
 * Furniture material, cached by kind + colour + status.
 * kind: 'wood' | 'fabric' | 'soft' (light fabric) | 'dark' | 'plain' (untextured colour) | 'solid' | 'gloss' | 'brass' | 'black' | 'metal'
 * Materials are shared through the cache: disposeGroup frees geometry only.
 */
export function furnitureMat(kind, color, status = 'ok') {
  const key = `${kind}|${color}|${status}`;
  if (furnCache.has(key)) return furnCache.get(key);
  const wood = surface('wood'), fab = surface('fabric');
  let m;
  switch (kind) {
    case 'wood': m = new THREE.MeshStandardMaterial({ ...maps(wood), color: tint(color, wood.photo, wood.custom), roughness: 0.55 }); break;
    case 'fabric': m = new THREE.MeshStandardMaterial({ ...maps(fab), color: fab.custom ? tint(color, true, true) : color, roughness: 0.95 }); break;
    case 'soft': m = new THREE.MeshStandardMaterial({ ...maps(fab), color: '#f4f1ea', roughness: 0.95 }); break;
    case 'dark': m = new THREE.MeshStandardMaterial({ ...maps(wood), color: wood.photo ? '#6b5442' : '#4a3a2c', roughness: 0.6 }); break;
    case 'plain': m = new THREE.MeshStandardMaterial({ color, roughness: 0.35 }); break;   // enamel, plastic, stone
    case 'solid': m = new THREE.MeshStandardMaterial({ color, roughness: 0.7 }); break;    // matte laminate / paint
    case 'gloss': m = new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0.05 }); break;
    case 'brass': m = new THREE.MeshStandardMaterial({ color: '#b08d57', roughness: 0.35, metalness: 0.9 }); break;
    case 'black': m = new THREE.MeshStandardMaterial({ color: '#26272b', roughness: 0.5, metalness: 0.6 }); break;
    default: m = new THREE.MeshStandardMaterial({ color: '#b8bcc4', roughness: 0.3, metalness: 0.9 });
  }
  const hl = HIGHLIGHT[status];
  if (hl) { m.emissive.set(hl.color); m.emissiveIntensity = hl.intensity; }
  furnCache.set(key, m);
  return m;
}
