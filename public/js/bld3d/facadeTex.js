// Photo materials of the building outside, composed from the CC0 sets that ship with the app
// (public/textures/sets, ambientCG): porcelain panels 120 × 60 cm cut from the marble photo with seams,
// dark granite on the ground floor and the porch, concrete for the bands, the roof, the curbs and the paving,
// timber for the canopy and the benches. Nothing is downloaded. The images are decoded off the main thread
// (createImageBitmap); until they arrive the procedural materials stay.
import * as THREE from 'three';

const SETS = '/textures/sets/';
const bitmap = url => fetch(url).then(r => {
  if (!r.ok) throw new Error(url);
  return r.blob();
}).then(b => createImageBitmap(b));

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function texture(c, { color = true, anisotropy = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

/**
 * Stone panels: each one a different crop of the photo over a base colour, with seams. The texture covers
 * cols × rows panels of pw × ph metres at `px` pixels per metre; a matching normal map is cut the same way.
 */
function panels(photo, normal, { px, cols, rows, pw, ph, base, vary, mix, seam, seamColor, seed, scale }) {
  const W = Math.round(cols * pw * px), H = Math.round(rows * ph * px);
  const col = canvas(W, H), nor = normal && canvas(W, H);
  const g = col.getContext('2d'), gn = nor?.getContext('2d');
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const cw = pw * px, ch = ph * px;
  const sw = Math.min(photo.width, pw * scale), sh = Math.min(photo.height, ph * scale);   // source crop, px
  if (gn) { gn.fillStyle = 'rgb(128,128,255)'; gn.fillRect(0, 0, W, H); }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const dx = x * cw, dy = y * ch;
      const sx = rnd() * (photo.width - sw), sy = rnd() * (photo.height - sh);
      const k = 1 + (rnd() - 0.5) * vary;
      const [r, gg, b] = base.map(v => Math.max(0, Math.min(255, Math.round(v * k))));
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.fillStyle = `rgb(${r},${gg},${b})`;
      g.fillRect(dx, dy, cw, ch);
      // The photo's veins and grain over the base colour.
      g.globalCompositeOperation = 'overlay';
      g.globalAlpha = mix;
      g.drawImage(photo, sx, sy, sw, sh, dx, dy, cw, ch);
      if (gn) gn.drawImage(normal, sx, sy, sw, sh, dx, dy, cw, ch);
    }
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  // Seams: a dark joint, and in the normal map a groove (edges facing into it).
  const sp = Math.max(1, seam * px);
  g.fillStyle = seamColor;
  for (let x = 0; x < cols; x++) g.fillRect(x * cw, 0, sp, H);
  for (let y = 0; y < rows; y++) g.fillRect(0, y * ch, W, sp);
  if (gn) {
    for (let x = 0; x < cols; x++) {
      gn.fillStyle = 'rgb(70,128,230)'; gn.fillRect(x * cw, 0, sp / 2, H);
      gn.fillStyle = 'rgb(186,128,230)'; gn.fillRect(x * cw + sp / 2, 0, sp / 2 + 1, H);
    }
    for (let y = 0; y < rows; y++) {
      gn.fillStyle = 'rgb(128,186,230)'; gn.fillRect(0, y * ch, W, sp / 2);
      gn.fillStyle = 'rgb(128,70,230)'; gn.fillRect(0, y * ch + sp / 2, W, sp / 2 + 1);
    }
  }
  return { map: col, normalMap: nor };
}

// A photo with its colour pulled towards `tint` (multiply) — concrete, wood.
function tinted(photo, tint, size = 1024) {
  const c = canvas(size, Math.round(size * photo.height / photo.width));
  const g = c.getContext('2d');
  g.drawImage(photo, 0, 0, c.width, c.height);
  if (tint) {
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = tint;
    g.fillRect(0, 0, c.width, c.height);
  }
  return c;
}

/** Sizes in metres of one texture repeat, for the world-space UVs of the meshes. */
export const PHOTO_UV = { wall: [4.8, 2.4], base: [4.8, 2.4], concrete: [2.4, 1.2], wood: [1.4, 1.4], granite: [2.4, 2.4] };

/**
 * Load the photos and put them on the materials. mats: { wall, base, band, roof, wood } of the building,
 * site: { granite, curb, wood } of the site. small: the weak tier (lower resolution, no normal maps).
 * Resolves true when applied, false when the photos could not be read (the procedural look stays).
 */
export async function applyPhotoFacade({ mats, site = {}, anisotropy = 4, small = false }) {
  let marble, marbleN, concrete, concreteN, wood;
  try {
    [marble, marbleN, concrete, concreteN, wood] = await Promise.all([
      bitmap(SETS + 'marble/color.jpg'), small ? null : bitmap(SETS + 'marble/normal.jpg'),
      bitmap(SETS + 'concrete/color.jpg'), small ? null : bitmap(SETS + 'concrete/normal.jpg'),
      bitmap('/textures/wood/color.jpg')
    ]);
  } catch {
    return false;
  }
  const px = small ? 110 : 210;     // pixels per metre of the panel textures
  const opt = { anisotropy };
  // Light warm porcelain 120 × 60, 4 × 4 panels per repeat (4.8 × 2.4 m).
  const wall = panels(marble, marbleN, { px, cols: 4, rows: 4, pw: 1.2, ph: 0.6, base: [186, 170, 148], vary: 0.08,
    mix: 0.9, seam: 0.008, seamColor: '#7a7064', seed: 11, scale: 430 });
  // Dark granite slabs 120 × 120 on the ground floor (between the shop windows), 4 × 2 per repeat.
  const base = panels(marble, marbleN, { px, cols: 4, rows: 2, pw: 1.2, ph: 1.2, base: [62, 64, 68], vary: 0.12,
    mix: 0.55, seam: 0.006, seamColor: '#1d1f22', seed: 5, scale: 640 });
  const swap = (m, maps, extra = {}) => {
    m.map?.dispose();
    m.normalMap?.dispose();
    m.map = texture(maps.map, opt);
    m.normalMap = maps.normalMap ? texture(maps.normalMap, { color: false, anisotropy }) : null;
    if (m.normalMap) m.normalScale.set(0.6, 0.6);
    m.color.set('#ffffff');
    Object.assign(m, extra);
    m.needsUpdate = true;
  };
  swap(mats.wall, wall, { roughness: 0.62, metalness: 0 });
  swap(mats.base, base, { roughness: 0.38, metalness: 0.05 });
  const concN = concreteN && tinted(concreteN, null, 1024);
  const conc = { map: tinted(concrete, '#f1ece4', small ? 512 : 1024), normalMap: concN };
  const concDark = { map: tinted(concrete, '#b9b3aa', small ? 512 : 1024), normalMap: concN };
  for (const m of [mats.band, site.curb].filter(Boolean)) swap(m, conc, { roughness: 0.85 });
  if (mats.roof) swap(mats.roof, concDark, { roughness: 0.95 });
  const woodMaps = { map: tinted(wood, '#e2b98f', small ? 512 : 1024) };
  for (const m of [mats.wood, site.wood].filter(Boolean)) swap(m, woodMaps, { roughness: 0.55 });
  if (site.granite) swap(site.granite, base, { roughness: 0.45 });
  return true;
}
