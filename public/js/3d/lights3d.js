// Lighting in 3D: env reflections, ceiling fixture, sun. Levels come from lighting.js and move smoothly
// (tweenLights) instead of rebuilding the lights on every change.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { getMats } from './textures3d.js';
import { lightingOf, targetsFor, easeInOut, TWEEN_SEC } from '../lighting.js';

export { SCENES, CEILINGS, DEFAULT_LIGHTING, lightingOf } from '../lighting.js';

let envTexture = null;

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

// Ceiling lights carry their full power; the current level multiplies it.
function ceilLight(light, power) {
  light.userData.ceilPower = power;
  return light;
}

// Chandelier: stem, hub, five arms with glowing shades; one point light with shadows.
function chandelier(g, L, W, H) {
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
  const lamp = ceilLight(new THREE.PointLight('#ffe2b8', 0, 0, 2), 14);
  lamp.position.set(cx, y - 0.05, cz);
  g.add(shadowed(lamp, 1024, Math.max(L, W, H) * 2));
}

// Recessed spots: 2×2 … 3×3 grid of spot lights; only the first casts a shadow (performance).
function spots(g, L, W, H) {
  const nx = L > 4.2 ? 3 : 2, nz = W > 3.6 ? 3 : 2;
  const disc = new THREE.CylinderGeometry(0.05, 0.05, 0.01, 20);
  let first = true;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = L * (i + 0.5) / nx, z = W * (j + 0.5) / nz;
      const m = new THREE.Mesh(disc, getMats().lampShade);
      m.position.set(x, H - 0.005, z);
      g.add(m);
      const s = ceilLight(new THREE.SpotLight('#ffe7c4', 0, 0, 1.0, 0.7, 2), 9);
      s.position.set(x, H - 0.02, z);
      s.target.position.set(x, 0, z);
      if (first) shadowed(s, 1024, H * 2);
      first = false;
      g.add(s, s.target);
    }
  }
}

// LED panel: an area light (no shadows) + a glowing flat box.
function panel(g, L, W, H) {
  const pw = Math.min(1.2, L * 0.4), pd = Math.min(0.6, W * 0.3);
  const m = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.02, pd), getMats().lampShade);
  m.position.set(L / 2, H - 0.01, W / 2);
  g.add(m);
  const a = ceilLight(new THREE.RectAreaLight('#fff1dc', 0, pw, pd), 9);
  a.position.set(L / 2, H - 0.025, W / 2);
  a.lookAt(L / 2, 0, W / 2);
  g.add(a);
}

const FIXTURES = { chandelier, spots, panel };

/**
 * Lights of a room: built when the room, its window or the fixture type change; levels are tweened.
 * @param size { L, W, H } in metres; win — first window { cx, cz, nx, nz } (centre, outward normal) or null
 * @param prev — levels of the replaced lights group: the new one continues from them, its fixture fades in.
 * group.userData.cur.env — environment intensity for the scene.
 */
export function buildLights({ L, W, H }, win, lighting, prev = null) {
  const { ceiling } = lightingOf(lighting);
  const group = new THREE.Group();
  group.name = 'lights';

  // Ambient: warm floor bounce + cool sky.
  const hemi = new THREE.HemisphereLight('#f4f6ff', '#8a7660', 0);
  group.add(hemi);
  if (FIXTURES[ceiling]) FIXTURES[ceiling](group, L, W, H);

  // Sun from outside through the first window (north by default); it sinks and turns warm towards the evening.
  const sun = new THREE.DirectionalLight('#ffffff', 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  const ext = Math.max(L, W) * 1.2;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 0.5, far: 20 });
  const w = win || { cx: L / 2, cz: 0, nx: 0, nz: -1 };
  const depth = w.nz ? W : L;
  sun.target.position.set(w.cx - w.nx * depth * 0.6, 0, w.cz - w.nz * depth * 0.6);
  group.add(sun, sun.target);

  const ceil = [];
  group.traverse(o => { if (o.isLight && o.userData.ceilPower) ceil.push(o); });
  const place = h => {
    const out = 5 - 1.5 * Math.min(1, Math.max(0, (h - 0.6) / 1.9));    // low sun shines deeper into the room
    sun.position.set(w.cx + w.nx * out + w.nz * 1.5, H + h, w.cz + w.nz * out - w.nx * 1.5);
  };
  const to = targetsFor(lighting);
  group.userData = { hemi, sun, ceil, place, sunScale: win ? 1 : 0.55, to, from: null, t: 1,
    cur: prev ? { ...prev, ceil: 0 } : { ...to } };
  applyLevels(group);
  if (prev) setLightTargets(group, lighting, true);
  return group;
}

const COLORS = ['sky', 'sunColor'];
const ca = new THREE.Color(), cb = new THREE.Color();

// New target levels (scene, 💡); the tween starts from the current ones.
export function setLightTargets(group, lighting, force = false) {
  const u = group.userData, to = targetsFor(lighting);
  if (!force && JSON.stringify(to) === JSON.stringify(u.to)) return;
  u.from = { ...u.cur };
  u.to = to;
  u.t = 0;
}

/** Advance the tween by dt seconds; true while the levels are changing (the caller updates env and fixtures). */
export function tweenLights(group, dt) {
  const u = group.userData;
  if (u.t >= 1) return false;
  u.t = Math.min(1, u.t + dt / TWEEN_SEC);
  const k = easeInOut(u.t);
  for (const key of Object.keys(u.to)) {
    u.cur[key] = COLORS.includes(key)
      ? '#' + ca.set(u.from[key]).lerp(cb.set(u.to[key]), k).getHexString()
      : u.from[key] + (u.to[key] - u.from[key]) * k;
  }
  applyLevels(group);
  return true;
}

function applyLevels(group) {
  const u = group.userData, c = u.cur, M = getMats();
  u.hemi.intensity = c.hemi;
  M.sky.color.set(c.sky);
  M.lampShade.emissiveIntensity = c.shade;
  u.sun.color.set(c.sunColor);
  u.sun.intensity = c.sunPower * u.sunScale;
  u.sun.visible = c.sunPower > 0.01;
  u.place(c.sunHeight);
  for (const l of u.ceil) l.intensity = l.userData.ceilPower * c.ceil;
}

// Floor lamps and sconces carry their own light (userData.lampPower); level = lights.userData.cur.fix.
export function applyFixtures(furniture, level) {
  furniture.traverse(o => { if (o.isLight && o.userData.lampPower) o.intensity = o.userData.lampPower * level; });
}
