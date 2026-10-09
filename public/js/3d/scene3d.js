// 3D view: renderer, camera, render loop. Scene units are metres (cm / 100).
import * as THREE from 'three';
import { t, onLangChange } from '../i18n.js';
import { state, onChange } from '../state.js';
import { buildRoom, disposeGroup } from './room3d.js';
import { buildLights, setupEnvironment } from './lights3d.js';
import { buildItem } from './models3d.js';
import { validateAll } from '../validate.js';
import * as controls from './controls3d.js';
import { initTouch } from './touch3d.js';

let renderer, scene, camera, container, clock;
let running = false;
let roomKey = '';
let room = null;
let lights = null;
let furniture = null;
let foundTimer = null;

function init(el) {
  container = el;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    el.querySelector('#hint3d').textContent = t('v3d.noWebgl');
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.prepend(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#1e2235');
  setupEnvironment(renderer, scene);
  camera = new THREE.PerspectiveCamera(60, 1, 0.05, 100);
  clock = new THREE.Clock();
  controls.initControls(camera, renderer.domElement, el);
  initTouch(el, renderer.domElement);

  new ResizeObserver(resize).observe(el);
  onChange(() => { if (running) rebuild(); });
  onLangChange(() => { if (running) controls.updateHint(); });
  return true;
}

function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// Rebuild the room only when its size changes; furniture on every change.
function rebuild() {
  const { L, W, H, plinth } = state.room;
  let roomChanged = false;
  const key = [L, W, H, plinth].join('x');
  if (key !== roomKey) {
    roomKey = key;
    if (room) disposeGroup(room.group);
    room = buildRoom(state.room);
    scene.add(room.group);
    if (lights) disposeGroup(lights);
    lights = buildLights(room.size, room.window);
    scene.add(lights);
    roomChanged = true;
  }
  controls.setRoom(room, roomChanged);
  buildFurniture();
}

// Furniture: red tint for items with errors, green for a freshly auto-placed one.
function buildFurniture() {
  if (furniture) disposeGroup(furniture);
  furniture = new THREE.Group();
  furniture.name = 'furniture';
  const errors = validateAll(state);
  const now = performance.now();
  const found = state.found && now < state.found.until ? state.found : null;
  for (const it of state.items) {
    const status = (errors.get(it.id) || []).length ? 'bad' : found && found.id === it.id ? 'found' : 'ok';
    furniture.add(buildItem(it, status));
  }
  scene.add(furniture);
  clearTimeout(foundTimer);
  if (found) foundTimer = setTimeout(() => { if (running) buildFurniture(); }, found.until - now + 20);
}

function loop() {
  if (!running) return;
  requestAnimationFrame(loop);
  controls.update(Math.min(clock.getDelta(), 0.1));
  renderer.render(scene, camera);
}

export function show(el) {
  if (!renderer && !init(el)) return;
  running = true;
  resize();
  rebuild();
  controls.updateHint();
  clock.start();
  loop();
}

export function hide() {
  running = false;
  if (renderer) controls.release();
}

export const getScene = () => scene;
export const getCamera = () => camera;
export const getRenderer = () => renderer;
