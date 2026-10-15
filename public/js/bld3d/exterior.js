// The building outside in 3D (showcase main view): light porcelain facade with anthracite frames, graphite fins
// between apartments, a glazed ground floor with a canopy over the entrance, roof parapet and lift room.
// Walls, bands and frames are merged into one mesh per material; the glass is two InstancedMeshes (daylight
// reflective glass and lit windows at night), coloured per apartment. Drawn only when something changes.
// Scene units: metres; the building stands centred on the origin, south (the entrance) towards +z.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SLAB } from '../facade.js';
import { SETTINGS, readPref, tierFor } from '../3d/perf.js';
import { createSite } from './site.js';
import { createStreetWalk } from './streetWalk.js';
import { applyPhotoFacade, PHOTO_UV } from './facadeTex.js';

const M = 0.01;          // cm → m
const T = 0.3;           // outer wall thickness, m
const GLASS_D = 0.12;    // glass plane, m from the inner face (the reveal is T − GLASS_D deep)
const PARAPET = 1.1;

export const TIMES = {
  day: { top: '#3f78bd', mid: '#9cc0e6', bottom: '#e9eff3', sun: '#fff1db', sunI: 2.7, elev: 34, azim: -38,
    hemi: 1.0, sky: '#d6e6ff', ground: '#9c927f', fog: '#dfe7ee', exposure: 0.92, lit: 0, lamp: 0 },
  evening: { top: '#2a3c6e', mid: '#a98a8a', bottom: '#f0b98e', sun: '#ffbf85', sunI: 2.0, elev: 9, azim: -62,
    hemi: 0.55, sky: '#ffcfaa', ground: '#4f4339', fog: '#e7b38e', exposure: 1.05, lit: 0.3, lamp: 0.6 },
  night: { top: '#03060f', mid: '#0b1428', bottom: '#1a2744', sun: '#9fb4ff', sunI: 0.3, elev: 42, azim: 35,
    hemi: 0.16, sky: '#33446f', ground: '#0d0d10', fog: '#111a2d', exposure: 1.15, lit: 0.55, lamp: 1 }
};

const GLASS = new THREE.Color('#41505f');       // neutral glass under the sky reflection
const GLASS_DIM = new THREE.Color('#2b3036');
const WARM = new THREE.Color('#ffcf8f');
const SHOP_LIT = new THREE.Color('#fff0d4');
const LOBBY_DAY = new THREE.Color('#d9c29a');
const DARK_IN = new THREE.Color('#1b2129');

// Seamed porcelain tiles 120 × 60 cm, in world-space UVs (1 texture = 2.4 × 1.2 m).
function tileTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ebe5db';
  g.fillRect(0, 0, 512, 256);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    const v = 226 + Math.floor(rnd() * 14);
    g.fillStyle = `rgb(${v + 6},${v + 1},${v - 7})`;
    g.fillRect(x * 256 + 2, y * 128 + 2, 252, 124);
  }
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '120,110,95'},${0.05 + rnd() * 0.06})`;
    g.fillRect(rnd() * 512, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(2, 2);     // the wall UVs repeat every 4.8 × 2.4 m (the photo panels), this tile is 2.4 × 1.2
  return t;
}

// Box UVs from world position (u along the face, v up), so tiles keep their size on every box.
function worldUV(geo, w = 2.4, h = 1.2) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const u = ny > 0.5 ? p.getX(i) : nx > 0.5 ? p.getZ(i) : p.getX(i);
    const v = ny > 0.5 ? p.getZ(i) : p.getY(i);
    uv.setXY(i, u / w, v / h);
  }
  return geo;
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP;
      void main() { float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 1.6, 0.0, 1.0), 0.8)) : mix(mid, bottom, clamp(-h * 6.0, 0.0, 1.0));
      if (h > -0.02 && h < 0.18) c = mix(c, bottom, (1.0 - smoothstep(0.0, 0.18, h)) * 0.75);
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
      }`
  });
}

/**
 * createExterior(container, { bld, fac, title, onHover(aptNo|null, event), onPick(aptNo), onFloor(n) })
 * → { paint({ colorOf, dim, hover }), setFloor, setTime, setAuto, setTitle, pause, flyToFloor, requestRender }
 * colorOf(aptNo) → CSS colour or null (neutral glass); dim(aptNo) → true when it does not match the filters.
 */
// "ПОДЪЕЗД 1" → ['ПОДЪЕЗД', '1'], "1-PODYEZD" → ['PODYEZD', '1'].
function splitNo(text) {
  const m = text.match(/\d+/);
  return m ? [text.replace(m[0], '').replace(/^[\s-]+|[\s-]+$/g, ''), m[0]] : [text, ''];
}

export function createExterior(container, { bld, fac, title = '', entrance = 'ENTRANCE 1', onHover = () => {}, onPick = () => {}, onFloor = () => {}, onDoor = null, onWalk = null, onCue = null }) {
  const tierName = tierFor(readPref()), tier = SETTINGS[tierName];
  let entranceText = entrance;
  const renderer = new THREE.WebGLRenderer({ antialias: tier.antialias });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.pixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 1500);
  const L = fac.L * M, W = fac.W * M, level = fac.level * M, top = fac.floors * level;
  const hx = L / 2, hz = W / 2;

  // ---------- sky, fog, light ----------
  const skyMat = skyMaterial();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMat);
  scene.add(sky);
  scene.fog = new THREE.Fog('#dfe7ee', 160, 520);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(sky.geometry, skyMat));
  let envRT = null;

  const hemi = new THREE.HemisphereLight('#d6e6ff', '#9c927f', 1);
  const sun = new THREE.DirectionalLight('#fff1db', 2.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(tier.shadowMap, tier.shadowMap);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 300 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);
  const lamp = new THREE.PointLight('#ffc98a', 0, 14, 1.6);   // canopy downlight at night
  scene.add(lamp);

  // ---------- site: lawn, paving, street, parking, trees, lamps ----------
  const site = createSite({ fac, site: bld.site, seed: bld.seed || 12, wallT: T, lampLights: tier.lampShadows });
  scene.add(site.group);

  // ---------- building ----------
  const mats = {
    wall: new THREE.MeshStandardMaterial({ color: '#efe6da', map: tileTexture(), roughness: 0.82 }),
    panel: new THREE.MeshStandardMaterial({ color: '#4a4f55', roughness: 0.6, metalness: 0.2 }),
    base: new THREE.MeshStandardMaterial({ color: '#2a2e33', roughness: 0.55, metalness: 0.35 }),
    band: new THREE.MeshStandardMaterial({ color: '#d6cdbf', roughness: 0.7 }),
    fin: new THREE.MeshStandardMaterial({ color: '#3b4046', roughness: 0.5, metalness: 0.3 }),
    frame: new THREE.MeshStandardMaterial({ color: '#2e3236', roughness: 0.45, metalness: 0.55 }),
    roof: new THREE.MeshStandardMaterial({ color: '#7d8287', roughness: 0.95 }),
    wood: new THREE.MeshStandardMaterial({ color: '#9a6a40', roughness: 0.6 }),
    strip: new THREE.MeshBasicMaterial({ color: '#ffe2b0' }),
    steel: new THREE.MeshStandardMaterial({ color: '#c8ccd0', roughness: 0.3, metalness: 0.85 })
  };
  const parts = Object.fromEntries(Object.keys(mats).map(k => [k, []]));
  // A box on a facade: u (m along the side), y (m), d (m outward from the inner face of the outer wall).
  const fbox = (kind, side, u0, u1, y0, y1, d0, d1) => {
    if (u1 - u0 < 1e-3 || y1 - y0 < 1e-3) return;
    const su = u1 - u0, sy = y1 - y0, sd = d1 - d0, u = (u0 + u1) / 2, d = (d0 + d1) / 2, y = (y0 + y1) / 2;
    let g;
    if (side === 'north' || side === 'south') {
      g = new THREE.BoxGeometry(su, sy, sd);
      g.translate(u - hx, y, side === 'north' ? -hz - d : hz + d);
    } else {
      g = new THREE.BoxGeometry(sd, sy, su);
      g.translate(side === 'west' ? -hx - d : hx + d, y, u - hz);
    }
    parts[kind].push(g);
  };
  const box = (kind, x, y, z, sx, sy, sz) => {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.translate(x, y, z);
    parts[kind].push(g);
  };

  // Glass bays (with the entrance doors as one more bay on the ground floor).
  const bays = [...fac.bays, { floor: 1, side: fac.entrance.side, x0: fac.entrance.x0, x1: fac.entrance.x1, sill: 0, h: fac.entrance.h, kind: 'door', aptNo: null }];
  const sideLen = side => (side === 'north' || side === 'south' ? L : W);
  for (let n = 1; n <= fac.floors; n++) {
    const y0 = (n - 1) * level, kind = n === 1 ? 'base' : 'wall';
    for (const side of ['north', 'south', 'west', 'east']) {
      const list = bays.filter(b => b.floor === n && b.side === side).sort((p, q) => p.x0 - q.x0);
      const ns = side === 'north' || side === 'south';
      let at = ns ? -T : 0;
      const end = ns ? sideLen(side) + T : sideLen(side);
      for (const b of list) {
        const u0 = b.x0 * M, u1 = b.x1 * M;
        const s = y0 + SLAB * M + b.sill * M, e = s + b.h * M;
        fbox(kind, side, at, u0, y0, y0 + level, 0, T);
        fbox(kind, side, u0, u1, y0, s, 0, T);
        fbox(kind, side, u0, u1, e, y0 + level, 0, T);
        // Frame: four bars and a mullion on wide windows, at the glass plane.
        const f = 0.05, fd0 = GLASS_D - 0.03, fd1 = GLASS_D + 0.05;
        fbox('frame', side, u0, u1, s, s + f, fd0, fd1);
        fbox('frame', side, u0, u1, e - f, e, fd0, fd1);
        fbox('frame', side, u0, u0 + f, s, e, fd0, fd1);
        fbox('frame', side, u1 - f, u1, s, e, fd0, fd1);
        if (u1 - u0 > 1.3) fbox('frame', side, (u0 + u1) / 2 - f / 2, (u0 + u1) / 2 + f / 2, s, e, fd0, fd1);
        if (b.kind === 'window' && b.sill > 20) {
          // Graphite panel under the window down to the storey band: windows of the storeys read as vertical stripes.
          fbox('panel', side, u0 - 0.05, u1 + 0.05, y0 + 0.2, s, T - 0.01, T + 0.02);
          fbox('frame', side, u0 - 0.05, u1 + 0.05, s - 0.04, s, T - 0.02, T + 0.07);   // sill
        }
        at = u1;
      }
      fbox(kind, side, at, end, y0, y0 + level, 0, T);
      // Storey band, a slight step out of the wall.
      if (n > 1) fbox('band', side, ns ? -T - 0.05 : 0, ns ? sideLen(side) + T + 0.05 : sideLen(side), y0, y0 + 0.2, T - 0.01, T + 0.05);
    }
    // Graphite fins between neighbouring apartments on the long facades.
    if (n > 1) {
      for (const side of ['north', 'south']) {
        const spans = fac.spans.filter(s => s.floor === n && s.side === side).sort((p, q) => p.x0 - q.x0);
        for (let i = 1; i < spans.length; i++) {
          const u = (spans[i - 1].x1 + spans[i].x0) / 2 * M;
          fbox('fin', side, u - 0.12, u + 0.12, y0 + 0.2, y0 + level, T - 0.01, T + 0.38);
        }
      }
    }
  }
  // Corner pilasters, roof slab, parapet, lift room.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box('fin', sx * (hx + T), (top + PARAPET) / 2, sz * (hz + T), 0.62, top + PARAPET, 0.62);
  box('roof', 0, top + 0.12, 0, L + 2 * T, 0.24, W + 2 * T);
  for (const side of ['north', 'south', 'west', 'east']) {
    const ns = side === 'north' || side === 'south';
    fbox('wall', side, ns ? -T : 0, ns ? L + T : W, top, top + PARAPET, 0, T);
    fbox('fin', side, ns ? -T : 0, ns ? L + T : W, top + PARAPET, top + PARAPET + 0.06, -0.02, T + 0.04);
  }
  const core = bld.core;
  if (core) box('fin', (core.x + core.w / 2) * M - hx, top + 1.7, (core.y + core.h / 2) * M - hz, core.w * M, 3.4, core.h * M * 0.7);
  // The entrance reads from afar: a timber portal round the doors under a deep canopy with a lit
  // "ENTRANCE 1" fascia, wall lights on the portal, long door handles, a projecting blade sign.
  const ent = fac.entrance, eu = (ent.x0 + ent.x1) / 2 * M, cw = 6.4, cd = 2.6, cy = level - 0.15;
  const du0 = ent.x0 * M, du1 = ent.x1 * M, dTop = SLAB * M + ent.h * M;
  fbox('wood', ent.side, du0 - 0.75, du0 - 0.08, 0, cy, T, T + 0.32);            // portal pillars
  fbox('wood', ent.side, du1 + 0.08, du1 + 0.75, 0, cy, T, T + 0.32);
  fbox('wood', ent.side, du0 - 0.08, du1 + 0.08, dTop + 0.05, cy, T, T + 0.32);   // lintel
  fbox('wood', ent.side, eu - cw / 2, eu + cw / 2, cy, cy + 0.16, T, T + cd);       // canopy slab
  fbox('fin', ent.side, eu - cw / 2 - 0.04, eu + cw / 2 + 0.04, cy - 0.06, cy, T, T + cd + 0.04);
  fbox('fin', ent.side, eu - cw / 2 - 0.04, eu + cw / 2 + 0.04, cy - 0.34, cy + 0.2, T + cd, T + cd + 0.07);   // fascia
  fbox('strip', ent.side, eu - cw / 2 + 0.3, eu + cw / 2 - 0.3, cy - 0.08, cy - 0.06, T + cd - 0.25, T + cd - 0.18);
  // Door handles: two long bars by the meeting stiles.
  for (const k of [-1, 1]) fbox('steel', ent.side, eu + k * 0.09 - 0.02, eu + k * 0.09 + 0.02, 0.85, 1.95, GLASS_D + 0.06, GLASS_D + 0.1);
  // Wall lights on the pillars, at eye height.
  for (const u of [du0 - 0.42, du1 + 0.42]) fbox('strip', ent.side, u - 0.09, u + 0.09, 2.0, 2.32, T + 0.32, T + 0.42);
  lamp.position.set(eu - hx, cy - 0.5, ent.side === 'south' ? hz + T + cd / 2 : -hz - T - cd / 2);

  const building = new THREE.Group();
  for (const [kind, list] of Object.entries(parts)) {
    if (!list.length) continue;
    const geo = mergeGeometries(list);
    for (const g of list) g.dispose();
    const uv = { wall: PHOTO_UV.wall, base: PHOTO_UV.base, band: PHOTO_UV.concrete, roof: PHOTO_UV.concrete, wood: PHOTO_UV.wood }[kind];
    if (uv) worldUV(geo, ...uv);
    const mesh = new THREE.Mesh(geo, mats[kind]);
    mesh.castShadow = kind !== 'strip';
    mesh.receiveShadow = kind !== 'strip';
    building.add(mesh);
  }
  scene.add(building);
  // Photo stone, concrete and timber from the bundled sets, once decoded (the procedural look until then).
  applyPhotoFacade({ mats, site: site.mats, anisotropy: Math.min(tier.anisotropy * 2, renderer.capabilities.getMaxAnisotropy()), small: tierName === 'low' })
    .then(ok => { if (ok) { shadows = true; dirty = true; } });

  // Signs: "ENTRANCE 1" glowing on the canopy fascia, the same on a blade sign beside the doors (seen from
  // along the facade), the residence name in big letters on the roof parapet over the entrance.
  const front = (d, y, u) => ent.side === 'south' ? [u - hx, y, hz + d] : [u - hx, y, -hz - d];
  const signPlane = (w, h, mat, d, y, u, rot = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(...front(d, y, u));
    m.rotation.y = (ent.side === 'north' ? Math.PI : 0) + rot;
    scene.add(m);
    return m;
  };
  const textMat = () => {
    const t = new THREE.CanvasTexture(document.createElement('canvas'));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, toneMapped: false });
  };
  const doorMat = textMat(), bladeMat = textMat(), nameMat = textMat();
  signPlane(3.6, 0.4, doorMat, T + cd + 0.075, cy - 0.07, eu);
  const bladeU = du0 - 0.42;
  const bladeBox = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.86, 0.66), mats.fin);
  bladeBox.position.set(...front(T + 0.32 + 0.4, 1.9, bladeU));
  scene.add(bladeBox);
  for (const k of [-1, 1]) signPlane(0.6, 0.8, bladeMat, T + 0.32 + 0.4, 1.9, bladeU + k * 0.045, k * Math.PI / 2);
  const nameW = Math.min(18, L * 0.6);
  const nameU = Math.max(nameW / 2 + 1, Math.min(L - nameW / 2 - 1, eu));
  signPlane(nameW, 0.95, nameMat, T + 0.02, top + PARAPET / 2 + 0.02, nameU);

  function draw(mat, w, h, paint) {
    const c = mat.map.image;
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    paint(g);
    mat.map.needsUpdate = true;
  }
  function setTitle(text, entrance = entranceText) {
    entranceText = entrance;
    draw(nameMat, 2048, 108, g => {
      g.fillStyle = '#ffffff';
      g.font = '700 84px system-ui, sans-serif';
      g.fillText(text.toUpperCase(), 1024, 58, 2000);
    });
    draw(doorMat, 1024, 114, g => {
      g.fillStyle = '#ffffff';
      g.font = '700 78px system-ui, sans-serif';
      g.fillText(entrance, 512, 60, 1000);
    });
    const [word, no] = splitNo(entrance);
    draw(bladeMat, 384, 512, g => {
      g.fillStyle = '#f6f1e7';
      g.beginPath();
      g.roundRect(8, 8, 368, 496, 36);
      g.fill();
      g.fillStyle = '#2e3236';
      g.font = '800 270px system-ui, sans-serif';
      g.fillText(no, 192, 220);
      g.font = '700 50px system-ui, sans-serif';
      g.fillText(word, 192, 430, 340);
    });
    dirty = true;
  }

  // ---------- glass: two instanced meshes, a bay is shown in one of them ----------
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const glassMat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.55, roughness: 0.05, envMapIntensity: 1.6 });
  const litMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const glass = new THREE.InstancedMesh(unit, glassMat, bays.length);
  const lit = new THREE.InstancedMesh(unit, litMat, bays.length);
  glass.receiveShadow = true;
  const mtx = bays.map(b => {
    const u = (b.x0 + b.x1) / 2 * M, su = (b.x1 - b.x0) * M, sy = b.h * M;
    const y = (b.floor - 1) * level + SLAB * M + b.sill * M + sy / 2;
    const m = new THREE.Matrix4();
    if (b.side === 'north' || b.side === 'south') {
      m.makeScale(su, sy, 0.02).setPosition(u - hx, y, b.side === 'north' ? -hz - GLASS_D : hz + GLASS_D);
    } else {
      m.makeScale(0.02, sy, su).setPosition(b.side === 'west' ? -hx - GLASS_D : hx + GLASS_D, y, u - hz);
    }
    return m;
  });
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  glass.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(bays.length * 3), 3);
  lit.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(bays.length * 3), 3);
  scene.add(glass, lit);
  // Stable "someone is home" choice per bay for the evening and night.
  const chance = bays.map((b, i) => ((Math.sin(i * 12.9898 + (b.aptNo || 0) * 78.233) * 43758.5453) % 1 + 1) % 1);

  // ---------- current floor, picking boxes ----------
  const pad = T + 0.25;
  const floorBoxes = [];
  for (let n = 1; n <= fac.floors; n++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(L + 2 * pad, level, W + 2 * pad));
    m.position.y = (n - 1) * level + level / 2;
    m.visible = false;
    m.userData.floor = n;
    m.updateMatrixWorld();
    floorBoxes.push(m);
  }
  const hiGeo = new THREE.BoxGeometry(L + 2 * pad, level, W + 2 * pad);
  const hi = new THREE.Group();
  hi.add(new THREE.LineSegments(new THREE.EdgesGeometry(hiGeo), new THREE.LineBasicMaterial({ color: '#4dabf7' })),
    new THREE.Mesh(hiGeo, new THREE.MeshBasicMaterial({ color: '#4dabf7', transparent: true, opacity: 0.1, depthWrite: false })));
  scene.add(hi);

  // ---------- camera and controls ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, top * 0.4, 0);
  camera.position.set(52, top * 0.62, 84);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 32;
  controls.maxDistance = 190;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotateSpeed = 0.55;
  controls.enablePan = false;

  // ---------- state ----------
  let time = 'day', style = { colorOf: () => null, dim: () => false, hover: null };
  let dirty = true, shadows = true, paused = false, visible = true, onScreen = true;
  let auto = true, pointerIn = false, lastTouch = -1e9, fly = null, orbitAcc = 0;
  const clock = new THREE.Clock();

  function setTime(name) {
    const p = TIMES[name] || TIMES.day;
    time = name in TIMES ? name : 'day';
    skyMat.uniforms.top.value.set(p.top);
    skyMat.uniforms.mid.value.set(p.mid);
    skyMat.uniforms.bottom.value.set(p.bottom);
    scene.fog.color.set(p.fog);
    hemi.color.set(p.sky);
    hemi.groundColor.set(p.ground);
    hemi.intensity = p.hemi;
    sun.color.set(p.sun);
    sun.intensity = p.sunI;
    const el = THREE.MathUtils.degToRad(p.elev), az = THREE.MathUtils.degToRad(p.azim);
    sun.position.set(Math.sin(az) * Math.cos(el) * 120, Math.sin(el) * 120, Math.cos(az) * Math.cos(el) * 120);
    renderer.toneMappingExposure = p.exposure;
    lamp.intensity = p.lamp * 30;
    mats.strip.color.set(p.lamp ? '#ffd9a0' : '#d9d2c4');
    nameMat.color.set(p.lamp ? '#ffe7c2' : '#2c3036');     // dark letters by day, lit at dusk and night
    doorMat.color.set(p.lamp ? '#fff1d6' : '#ffffff');
    site.setTime(p);
    envRT?.dispose();
    envRT = pmrem.fromScene(envScene, 0, 1, 1000);
    scene.environment = envRT.texture;
    scene.environmentIntensity = Math.max(0.25, p.hemi);
    paint(style);
    shadows = dirty = true;
  }

  const tmpC = new THREE.Color(), hsl = {};
  const tintOf = css => {
    const c = new THREE.Color(css);
    c.getHSL(hsl);
    return c.setHSL(hsl.h, Math.min(1, hsl.s * 1.1 + 0.15), 0.5);
  };
  function paint(next = style) {
    style = { ...style, ...next };
    const p = TIMES[time];
    bays.forEach((b, i) => {
      const css = b.aptNo ? style.colorOf(b.aptNo) : null;
      const dim = b.aptNo ? style.dim(b.aptNo) : false;
      const hov = b.aptNo && b.aptNo === style.hover;
      // Lit at night: chosen apartments (not dimmed) and some neighbours; shops and lobby always.
      const on = p.lit > 0 && (b.kind !== 'window' ? true : !dim && (css ? chance[i] < p.lit + 0.25 : chance[i] < p.lit));
      if (on) {
        tmpC.copy(b.kind === 'window' ? WARM : SHOP_LIT);
        if (css) tmpC.lerp(tintOf(css), 0.35);
        if (hov) tmpC.lerp(new THREE.Color('#ffffff'), 0.5);
        lit.setColorAt(i, tmpC);
        lit.setMatrixAt(i, mtx[i]);
        glass.setMatrixAt(i, zero);
      } else {
        if (b.kind === 'door') tmpC.copy(GLASS).lerp(LOBBY_DAY, 0.55);    // the warm lobby through the doors by day
        else if (b.kind !== 'window') tmpC.copy(DARK_IN).lerp(GLASS, 0.4);
        else if (dim) tmpC.copy(GLASS_DIM);
        else if (css) tmpC.copy(GLASS).lerp(tintOf(css), 0.62);
        else tmpC.copy(GLASS);
        if (hov) tmpC.lerp(new THREE.Color('#ffffff'), 0.55);
        glass.setColorAt(i, tmpC);
        glass.setMatrixAt(i, mtx[i]);
        lit.setMatrixAt(i, zero);
      }
    });
    glass.instanceMatrix.needsUpdate = lit.instanceMatrix.needsUpdate = true;
    glass.instanceColor.needsUpdate = lit.instanceColor.needsUpdate = true;
    glass.computeBoundingSphere();
    lit.computeBoundingSphere();
    dirty = true;
  }

  function setFloor(n) {
    hi.position.y = (n - 1) * level + level / 2;
    hi.visible = n >= 1 && n <= fac.floors;
    dirty = true;
  }

  function flyToFloor(n) {
    const y = (n - 1) * level + level / 2;
    const dir = camera.position.clone().sub(controls.target);
    dir.y = 0;
    dir.setLength(48);
    fly = { t: 0, fromT: controls.target.clone(), toT: new THREE.Vector3(0, y, 0),
      fromP: camera.position.clone(), toP: new THREE.Vector3(dir.x, y + 4, dir.z) };
    lastTouch = performance.now();
  }

  // ---------- picking ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hitG = ray.intersectObjects([glass, lit, building], false)[0];
    if (hitG && hitG.object !== building && hitG.instanceId != null) {
      const b = bays[hitG.instanceId];
      return { aptNo: b.aptNo, floor: b.floor };
    }
    const hitF = ray.intersectObjects(floorBoxes, false)[0];
    if (!hitF || (hitG && hitG.distance < hitF.distance - 1)) return hitG ? { aptNo: null, floor: floorFromY(hitG.point.y) } : null;
    return { aptNo: null, floor: hitF.object.userData.floor };
  }
  const floorFromY = y => Math.min(fac.floors, Math.max(1, Math.floor(y / level) + 1));

  const cv = renderer.domElement;
  cv.addEventListener('pointerenter', () => { pointerIn = true; });
  cv.addEventListener('pointerleave', () => { pointerIn = false; onHover(null); });
  let down = null, hoverFrame = 0;
  cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; lastTouch = performance.now(); });
  cv.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || hoverFrame || walker.active) return;
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0;
      const h = pick(e);
      cv.style.cursor = h?.aptNo ? 'pointer' : h ? 'zoom-in' : 'grab';
      onHover(h?.aptNo ?? null, e);
    });
  });
  cv.addEventListener('click', e => {
    if (walker.active) return;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const h = pick(e);
    if (!h) return;
    if (h.floor) onFloor(h.floor);
    if (h.aptNo) onPick(h.aptNo);
  });
  cv.addEventListener('dblclick', e => {
    if (walker.active) return;
    const h = pick(e);
    if (h?.floor) flyToFloor(h.floor);
  });
  controls.addEventListener('start', () => { lastTouch = performance.now(); fly = null; });

  // ---------- walking on the site ----------
  const walker = createStreetWalk({ camera, dom: renderer.domElement, walk: site.walk, obstacles: site.obstacles,
    onDoor: () => onDoor?.(), onStop: () => endWalk(true) });
  // Where the entrance is from the walker: distance (m) and the turn to it (rad, + to the right), sent when it
  // changes noticeably.
  const fwd = new THREE.Vector3();
  let lastCue = '';
  function cue() {
    if (!onCue) return;
    const d = site.walk.door, tx = (d.x0 + d.x1) / 2 - camera.position.x, tz = d.z - camera.position.z;
    camera.getWorldDirection(fwd);
    const angle = Math.atan2(fwd.x * tz - fwd.z * tx, fwd.x * tx + fwd.z * tz);
    const dist = Math.hypot(tx, tz);
    const key = Math.round(dist) + ':' + Math.round(angle / 0.2);
    if (key === lastCue) return;
    lastCue = key;
    onCue({ dist, angle });
  }
  function startWalk(at = 'street') {
    fly = null;
    controls.enabled = false;
    controls.autoRotate = false;
    walker.start(at);
    lastCue = '';
    cue();
    onHover(null);
    cv.style.cursor = 'crosshair';
    dirty = true;
    onWalk?.(true);
  }
  function endWalk(fromKey = false) {
    if (!walker.active && !fromKey) return;
    walker.stop();
    onCue?.(null);
    controls.enabled = true;
    lastTouch = performance.now();
    cv.style.cursor = '';
    dirty = true;
    onWalk?.(false);
  }
  controls.addEventListener('change', () => { dirty = true; });

  // ---------- loop: draws only on change; the auto-orbit draws every frame while it turns ----------
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  new ResizeObserver(resize).observe(container);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; }).observe(container);

  function frame() {
    requestAnimationFrame(frame);
    let dt = Math.min(clock.getDelta(), 0.1);
    if (paused || !visible || !onScreen) return;
    if (walker.active) {
      if (walker.update(dt)) { dirty = true; cue(); }
      if (!dirty) return;
      dirty = false;
      if (shadows) { renderer.shadowMap.needsUpdate = true; shadows = false; }
      renderer.render(scene, camera);
      return;
    }
    controls.autoRotate = auto && !pointerIn && !fly && performance.now() - lastTouch > 8000;
    // The slow orbit alone does not need the screen's full rate: 40 frames a second.
    if (controls.autoRotate && !fly && !dirty) {
      orbitAcc += dt;
      if (orbitAcc < 1 / 40) return;
      dt = orbitAcc;
    }
    orbitAcc = 0;
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / 1.1);
      const k = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - (-2 * fly.t + 2) ** 2 / 2;
      controls.target.lerpVectors(fly.fromT, fly.toT, k);
      camera.position.lerpVectors(fly.fromP, fly.toP, k);
      if (fly.t >= 1) fly = null;
      dirty = true;
    }
    if (controls.update(dt)) dirty = true;
    if (!dirty) return;
    dirty = false;
    if (shadows) { renderer.shadowMap.needsUpdate = true; shadows = false; }
    renderer.render(scene, camera);
  }

  setTitle(title);
  setTime('day');
  setFloor(0);
  resize();
  frame();

  return {
    paint, setFloor, setTime, setTitle, flyToFloor, startWalk, endWalk,
    isWalking: () => walker.active, walkPad: walker.pad,
    getTime: () => time,
    setAuto(on) { auto = on; if (on) lastTouch = -1e9; dirty = true; },
    getAuto: () => auto,
    pause(on) { paused = on; dirty = true; clock.getDelta(); },
    requestRender() { dirty = true; },
    renderer, scene, camera, site
  };
}
