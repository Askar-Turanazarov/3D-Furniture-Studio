// Photo materials of the building outside. Best: the facade sets of the texture library (ambientCG, CC0,
// FACADE_SETS) — travertine slabs 120 × 60 cm with seams, black stone 120 × 120 on the ground floor and the
// porch, concrete for the bands, the roof and the curbs, timber for the portal, the canopy and the benches, each
// with its normal and roughness maps. The server downloads them only when someone presses the button
// (fetchFacadeSets) or runs `npm run textures -- --facade`; until then the look is composed from the sets that
// ship with the app (public/textures/sets). The images are decoded off the main thread (createImageBitmap);
// until they arrive the procedural materials stay.
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
  if (typeof ImageBitmap !== 'undefined' && c instanceof ImageBitmap) t.flipY = false;   // bitmaps cannot be flipped
  return t;
}

/**
 * Stone panels: each one a different crop of the photo over a base colour, with seams. The texture covers
 * cols × rows panels of pw × ph metres at `px` pixels per metre; a matching normal map is cut the same way.
 */
function panels(photo, normal, { px, cols, rows, pw, ph, base, vary, mix, seam, seamColor, seed, scale, rough = null }) {
  const W = Math.round(cols * pw * px), H = Math.round(rows * ph * px);
  const col = canvas(W, H), nor = normal && canvas(W, H), rou = rough && canvas(W, H);
  const g = col.getContext('2d'), gn = nor?.getContext('2d'), gr = rou?.getContext('2d');
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
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      if (base) {
        const [r, gg, b] = base.map(v => Math.max(0, Math.min(255, Math.round(v * k))));
        g.fillStyle = `rgb(${r},${gg},${b})`;
        g.fillRect(dx, dy, cw, ch);
        // The photo's veins and grain over the base colour.
        g.globalCompositeOperation = 'overlay';
        g.globalAlpha = mix;
        g.drawImage(photo, sx, sy, sw, sh, dx, dy, cw, ch);
      } else {
        // A real stone photo: each slab its own crop, a touch lighter or darker than the next.
        g.drawImage(photo, sx, sy, sw, sh, dx, dy, cw, ch);
        g.fillStyle = k > 1 ? `rgba(255,255,255,${(k - 1).toFixed(3)})` : `rgba(0,0,0,${(1 - k).toFixed(3)})`;
        g.fillRect(dx, dy, cw, ch);
      }
      if (gn) gn.drawImage(normal, sx, sy, sw, sh, dx, dy, cw, ch);
      if (gr) gr.drawImage(rough, sx, sy, sw, sh, dx, dy, cw, ch);
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
  if (gr) {   // the joints are matt
    gr.fillStyle = '#e6e6e6';
    for (let x = 0; x < cols; x++) gr.fillRect(x * cw, 0, sp, H);
    for (let y = 0; y < rows; y++) gr.fillRect(0, y * ch, W, sp);
  }
  return { map: col, normalMap: nor, roughnessMap: rou };
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
export const PHOTO_UV = { wall: [6, 3], base: [4.8, 2.4], concrete: [2.4, 1.2], wood: [1.4, 1.4], granite: [2.4, 2.4] };

/** Library sets of the facade (public/textures/library.json): walls, ground floor, concrete, timber. */
export const FACADE_SETS = { wall: 'travertine', base: 'marbleBlack', concrete: 'concreteFloor', wood: 'woodPanels' };

/** Library sets of the site (site.js, trees.js): lawn, asphalt, paving, leaves, bark — fetched with the facade. */
export const SITE_SETS = { lawn: 'lawnGrass', road: 'asphaltRoad', pave: 'paversWave', leaves: 'leaves', bark: 'bark' };
const ALL_SETS = [...Object.values(FACADE_SETS), ...Object.values(SITE_SETS)];

const plain = set => ({ map: set.color, normalMap: set.normal, roughnessMap: set.roughness });

// Which library sets are on disk. A static host has only library.json: there nothing can be downloaded.
async function library() {
  try {
    const r = await fetch('/api/textures/library');
    if (r.ok) return { list: await r.json(), server: true };
  } catch { /* static host */ }
  try {
    const r = await fetch('/textures/library.json');
    if (r.ok) return { list: (await r.json()).map(e => ({ ...e, available: !!e.bundled })), server: false };
  } catch { /* no library */ }
  return { list: [], server: false };
}

/**
 * The facade and site sets not on disk yet: { missing: [entry], mb, canFetch }. canFetch: the server can download them
 * (the button is shown only then).
 */
export async function facadeStatus() {
  const { list, server } = await library();
  const missing = ALL_SETS.map(id => list.find(e => e.id === id)).filter(e => e && !e.available);
  return { missing, mb: Math.round(missing.reduce((s, e) => s + (e.mb || 5), 0)), canFetch: server };
}

/** Download the missing facade sets one by one (the user pressed the button); onStep(done, total). */
export async function fetchFacadeSets(onStep = () => {}) {
  const { missing } = await facadeStatus();
  let done = 0;
  onStep(done, missing.length);
  for (const e of missing) {
    // The server downloads one set at a time ('busy'): wait for the other download (another visitor) and retry.
    for (let tries = 0; ; tries++) {
      const res = await fetch('/api/textures/fetch/' + encodeURIComponent(e.id), { method: 'POST' });
      if (res.ok) break;
      const body = await res.json().catch(() => ({}));
      if (res.status !== 429 || tries > 60) throw new Error(body.error || 'download_failed');
      await new Promise(r => setTimeout(r, 2000));
    }
    onStep(++done, missing.length);
  }
  return missing.length;
}

// The three maps of a library set on disk, or null.
async function libSet(entry) {
  if (!entry?.available) return null;
  const dir = `/textures/${entry.bundled ? 'sets' : 'lib'}/${entry.id}/`;
  try {
    const [color, normal, roughness] = await Promise.all(['color', 'normal', 'roughness'].map(f => bitmap(dir + f + '.jpg')));
    return { color, normal, roughness, tile: entry.tile || 1 };
  } catch {
    return null;
  }
}

/**
 * Load the photos and put them on the materials. mats: { wall, base, band, roof, wood } of the building,
 * site: { granite, curb, wood } of the site. small: the weak tier (lower resolution, no normal maps).
 * Resolves 'library' when the facade sets were used, 'bundled' for the composed look, false when the photos
 * could not be read (the procedural look stays).
 */
export async function applyPhotoFacade({ mats, site = {}, trees = null, anisotropy = 4, small = false }) {
  const { list } = await library();
  const sets = Object.fromEntries(await Promise.all(Object.entries(FACADE_SETS)
    .map(async ([k, id]) => [k, await libSet(list.find(e => e.id === id))])));
  const fromLib = Object.values(sets).every(Boolean);
  let marble, marbleN, concrete, concreteN, wood;
  if (!fromLib) {
    try {
      [marble, marbleN, concrete, concreteN, wood] = await Promise.all([
        bitmap(SETS + 'marble/color.jpg'), small ? null : bitmap(SETS + 'marble/normal.jpg'),
        bitmap(SETS + 'concrete/color.jpg'), small ? null : bitmap(SETS + 'concrete/normal.jpg'),
        bitmap('/textures/wood/color.jpg')
      ]);
    } catch {
      return false;
    }
  }
  const leafEntry = list.find(e => e.id === SITE_SETS.leaves);
  const leaves = leafEntry?.available ? await Promise.all(['color', 'opacity'].map(f => bitmap(`/textures/lib/${leafEntry.id}/${f}.jpg`)))
    .then(([color, opacity]) => ({ color, opacity }), () => null) : null;
  const siteSets = Object.fromEntries(await Promise.all(Object.entries(SITE_SETS).filter(([k]) => k !== 'leaves')
    .map(async ([k, id]) => [k, await libSet(list.find(e => e.id === id))])));
  const opt = { anisotropy };
  const swap = (m, maps, extra = {}, repeat = null) => {
    for (const k of ['map', 'normalMap', 'roughnessMap']) m[k]?.dispose();
    m.map = texture(maps.map, opt);
    m.normalMap = maps.normalMap && !small ? texture(maps.normalMap, { color: false, anisotropy }) : null;
    m.roughnessMap = maps.roughnessMap ? texture(maps.roughnessMap, { color: false, anisotropy }) : null;
    if (repeat) for (const k of ['map', 'normalMap', 'roughnessMap']) m[k]?.repeat.set(...repeat);
    if (m.normalMap) m.normalScale.set(0.6, 0.6);
    m.color.set('#ffffff');
    Object.assign(m, extra);
    m.needsUpdate = true;
  };
  // The ground: lawn, asphalt and paving photos at their real size (UVs: the lawn plane 800 m, paving 1.6 m and
  // asphalt 4 m per unit, see site.js).
  const ground = () => {
    const g = siteSets;
    const rep = (set, unit) => [unit / set.tile, unit / set.tile];
    if (g.lawn && site.lawn) {
      swap(site.lawn, plain(g.lawn), { roughness: 1 }, rep(g.lawn, 800));
      site.lawn.color.setRGB(1.45, 1.42, 1.1);   // the photo is a dark, shaded turf: lift it to a sunlit lawn
    }
    if (g.road && site.road) {
      swap(site.road, plain(g.road), { roughness: 1 }, rep(g.road, 4));
      site.road.color.set('#626468');      // the photo is a light, worn asphalt: fresh asphalt is darker
    }
    if (trees && (leaves || g.bark)) trees({ leaves, bark: g.bark }, { anisotropy, small });
    if (g.pave && site.pave) {
      swap(site.pave, plain(g.pave), { roughness: 1 }, rep(g.pave, 1.6));
      site.pave.color.set('#f4eee4');      // warm grey concrete pavers
    }
  };

  if (fromLib) {
    const px = small ? 128 : 256;     // pixels per metre of the slab textures
    const cut = (set, o) => panels(set.color, small ? null : set.normal, {
      ...o, px, base: null, scale: set.color.width / set.tile, rough: set.roughness });
    // Travertine 150 × 75, 4 × 4 slabs per repeat (6 × 3 m), each slab a shade of its own so the stone reads
    // from afar; black stone 120 × 120, 4 × 2.
    const wall = cut(sets.wall, { cols: 4, rows: 4, pw: 1.5, ph: 0.75, vary: 0.16, seam: 0.01, seamColor: '#76695a', seed: 11 });
    const base = cut(sets.base, { cols: 4, rows: 2, pw: 1.2, ph: 1.2, vary: 0.1, seam: 0.006, seamColor: '#141517', seed: 5 });
    swap(mats.wall, wall, { roughness: 1, metalness: 0 });
    mats.wall.color.set('#fdf5ec');       // warm, sunlit travertine rather than grey
    swap(mats.base, base, { roughness: 0.8, metalness: 0.05 });
    if (site.granite) swap(site.granite, base, { roughness: 0.85 });
    // Concrete and timber: the photo as it is, repeated to its real size over the world UVs.
    const size = (uv, tile) => [uv[0] / tile, uv[1] / tile];
    const conc = plain(sets.concrete), cRep = size(PHOTO_UV.concrete, sets.concrete.tile);
    for (const m of [mats.band, site.curb].filter(Boolean)) swap(m, conc, { roughness: 1 }, cRep);
    if (mats.roof) {
      swap(mats.roof, conc, { roughness: 1 }, cRep);
      mats.roof.color.set('#b9b3aa');
    }
    const woodRep = size(PHOTO_UV.wood, sets.wood.tile);
    for (const m of [mats.wood, site.wood].filter(Boolean)) swap(m, plain(sets.wood), { roughness: 1 }, woodRep);
    ground();
    return 'library';
  }

  const px = small ? 110 : 210;     // pixels per metre of the panel textures
  // Light warm stone 150 × 75, 4 × 4 panels per repeat (6 × 3 m).
  const wall = panels(marble, marbleN, { px, cols: 4, rows: 4, pw: 1.5, ph: 0.75, base: [192, 172, 146], vary: 0.14,
    mix: 0.9, seam: 0.008, seamColor: '#7a7064', seed: 11, scale: 430 });
  // Dark granite slabs 120 × 120 on the ground floor (between the shop windows), 4 × 2 per repeat.
  const base = panels(marble, marbleN, { px, cols: 4, rows: 2, pw: 1.2, ph: 1.2, base: [62, 64, 68], vary: 0.12,
    mix: 0.55, seam: 0.006, seamColor: '#1d1f22', seed: 5, scale: 640 });
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
  ground();
  return 'bundled';
}
