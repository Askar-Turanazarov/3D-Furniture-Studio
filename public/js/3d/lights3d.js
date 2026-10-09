// Lighting: soft ambient, ceiling lamp with shadows, daylight through the window, env reflections.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getMats } from './textures3d.js';

let envTexture = null;

// One-time: image-based lighting for soft reflections on wood/metal.
export function setupEnvironment(renderer, scene) {
  if (envTexture) return;
  const pmrem = new THREE.PMREMGenerator(renderer);
  envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = envTexture;
  scene.environmentIntensity = 0.35;
}

/**
 * @param size { L, W, H } in metres; win — window rect on the north wall
 */
export function buildLights({ L, W, H }, win) {
  const group = new THREE.Group();
  group.name = 'lights';

  // Ambient: warm floor bounce + cool sky.
  group.add(new THREE.HemisphereLight('#f4f6ff', '#8a7660', 1.4));

  // Ceiling lamp: cord + shade + point light with soft shadows.
  const lampY = H - 0.35;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.3), getMats().metal);
  cord.position.set(L / 2, H - 0.15, W / 2);
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), getMats().lampShade);
  shade.position.set(L / 2, lampY, W / 2);
  group.add(cord, shade);

  const lamp = new THREE.PointLight('#ffe2b8', 10, 0, 2);
  lamp.position.set(L / 2, lampY - 0.15, W / 2);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.bias = -0.002;
  lamp.shadow.radius = 4;
  lamp.shadow.camera.near = 0.1;
  lamp.shadow.camera.far = Math.max(L, W, H) * 2;
  group.add(lamp);

  // Daylight: directional light from outside, through the north window.
  const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
  const cx = win.x + win.w / 2;
  sun.position.set(cx - 1.5, H + 2.5, -3.5);
  sun.target.position.set(cx, 0, W * 0.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  const ext = Math.max(L, W) * 1.2;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 0.5, far: 20 });
  group.add(sun, sun.target);

  return group;
}
