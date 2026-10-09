// Lighting: time of day (day / evening / night), ceiling fixture, env reflections.
// roomDoc.lighting = { scene: 'day'|'evening'|'night', ceiling: 'chandelier'|'spots'|'panel'|'none' }
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { getMats } from './textures3d.js';

let envTexture = null;
export const SCENES = ['day', 'evening', 'night'];
export const CEILINGS = ['chandelier', 'spots', 'panel', 'none'];
export const DEFAULT_LIGHTING = { scene: 'day', ceiling: 'chandelier' };

// Per scene: ambient, reflections, sky colour behind the window, sun, lamps (0 = off).
const PRESETS = {
  day:     { hemi: 1.4,  env: 0.35, sky: '#bfe3ff', sun: { color: '#fff4e0', power: 2.2, height: 2.5 }, lamps: 0 },
  evening: { hemi: 0.45, env: 0.15, sky: '#f0a46e', sun: { color: '#ff9a4d', power: 1.3, height: 0.6 }, lamps: 1 },   // ≈ 2700 K, low sun
  night:   { hemi: 0.12, env: 0.05, sky: '#0b1426', sun: null, lamps: 1 }
};

export const lightingOf = l => ({
  scene: SCENES.includes(l?.scene) ? l.scene : DEFAULT_LIGHTING.scene,
  ceiling: CEILINGS.includes(l?.ceiling) ? l.ceiling : DEFAULT_LIGHTING.ceiling
});

// One-time: image-based lighting for soft reflections on wood/metal.
export function setupEnvironment(renderer, scene) {
  if (envTexture) return;
  const pmrem = new THREE.PMREMGenerator(renderer);
  envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = envTexture;
  scene.environmentIntensity = 0.35;
  RectAreaLightUniformsLib.init();
}

function shadowed(light, size, far) {
  light.castShadow = true;
  light.shadow.mapSize.set(size, size);
  light.shadow.bias = -0.002;
  light.shadow.radius = 4;
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = far;
  return light;
}

// Chandelier: stem, hub, five arms with glowing shades; one point light with shadows.
function chandelier(g, L, W, H, on) {
  const M = getMats(), cx = L / 2, cz = W / 2, y = H - 0.45;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.4), M.metal);
  stem.position.set(cx, H - 0.2, cz);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), M.metal);
  hub.position.set(cx, y, cz);
  g.add(stem, hub);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, r = 0.24;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, r), M.metal);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = -a;
    arm.position.set(cx + Math.cos(a) * r / 2, y, cz + Math.sin(a) * r / 2);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.1, 16, 1, true), M.lampShade);
    shade.position.set(cx + Math.cos(a) * r, y + 0.05, cz + Math.sin(a) * r);
    g.add(arm, shade);
  }
  const lamp = new THREE.PointLight('#ffe2b8', 14 * on, 0, 2);
  lamp.position.set(cx, y - 0.05, cz);
  g.add(shadowed(lamp, 1024, Math.max(L, W, H) * 2));
}

// Recessed spots: 2×2 … 3×3 grid of spot lights; only the first casts a shadow (performance).
function spots(g, L, W, H, on) {
  const nx = L > 4.2 ? 3 : 2, nz = W > 3.6 ? 3 : 2;
  const disc = new THREE.CylinderGeometry(0.05, 0.05, 0.01, 20);
  let first = true;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = L * (i + 0.5) / nx, z = W * (j + 0.5) / nz;
      const m = new THREE.Mesh(disc, getMats().lampShade);
      m.position.set(x, H - 0.005, z);
      g.add(m);
      const s = new THREE.SpotLight('#ffe7c4', 9 * on, 0, 1.0, 0.7, 2);
      s.position.set(x, H - 0.02, z);
      s.target.position.set(x, 0, z);
      if (first) shadowed(s, 1024, H * 2);
      first = false;
      g.add(s, s.target);
    }
  }
}

// LED panel: an area light (no shadows) + a glowing flat box.
function panel(g, L, W, H, on) {
  const pw = Math.min(1.2, L * 0.4), pd = Math.min(0.6, W * 0.3);
  const m = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.02, pd), getMats().lampShade);
  m.position.set(L / 2, H - 0.01, W / 2);
  g.add(m);
  const a = new THREE.RectAreaLight('#fff1dc', 9 * on, pw, pd);
  a.position.set(L / 2, H - 0.025, W / 2);
  a.lookAt(L / 2, 0, W / 2);
  g.add(a);
}

const FIXTURES = { chandelier, spots, panel };

/**
 * @param size { L, W, H } in metres; win — first window { cx, cz, nx, nz } (centre, outward normal) or null
 * @param lighting roomDoc.lighting
 * group.userData.env — environment intensity for the scene.
 */
export function buildLights({ L, W, H }, win, lighting) {
  const { scene, ceiling } = lightingOf(lighting);
  const p = PRESETS[scene];
  const group = new THREE.Group();
  group.name = 'lights';
  group.userData.env = p.env;

  const M = getMats();
  M.sky.color.set(p.sky);
  M.lampShade.emissiveIntensity = p.lamps ? 2 : 0.25;

  // Ambient: warm floor bounce + cool sky.
  group.add(new THREE.HemisphereLight('#f4f6ff', '#8a7660', p.hemi));

  // Ceiling fixture. With the lamps off (day) a weak glow keeps the room readable.
  if (FIXTURES[ceiling]) FIXTURES[ceiling](group, L, W, H, p.lamps || 0.15);

  // Sun from outside through the first window (north by default); low and warm in the evening, none at night.
  if (p.sun) {
    const sun = new THREE.DirectionalLight(p.sun.color, win ? p.sun.power : p.sun.power * 0.55);
    const w = win || { cx: L / 2, cz: 0, nx: 0, nz: -1 };
    const depth = w.nz ? W : L;
    const out = p.sun.height < 1 ? 5 : 3.5;
    sun.position.set(w.cx + w.nx * out + w.nz * 1.5, H + p.sun.height, w.cz + w.nz * out - w.nx * 1.5);
    sun.target.position.set(w.cx - w.nx * depth * 0.6, 0, w.cz - w.nz * depth * 0.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    const ext = Math.max(L, W) * 1.2;
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 0.5, far: 20 });
    group.add(sun, sun.target);
  }
  return group;
}

// Floor lamps and sconces carry their own light (userData.lampPower); switched by the scene.
export function applyFixtures(furniture, lighting) {
  const on = PRESETS[lightingOf(lighting).scene].lamps;
  furniture.traverse(o => { if (o.isLight && o.userData.lampPower) o.intensity = o.userData.lampPower * (on || 0.1); });
}
