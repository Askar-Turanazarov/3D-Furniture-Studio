// 3D view: renderer, camera, render loop. Scene units are metres (cm / 100).
import * as THREE from 'three';
import { t, onLangChange } from '../i18n.js';
import { state, onChange } from '../state.js';
import { buildRoom, disposeGroup } from './room3d.js';

let renderer, scene, camera, container, clock;
let running = false;
let roomKey = '';
let room = null;

export const CM = 0.01;

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
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.prepend(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#1e2235');
  camera = new THREE.PerspectiveCamera(60, 1, 0.05, 100);
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a7660', 1.5));
  clock = new THREE.Clock();

  new ResizeObserver(resize).observe(el);
  onChange(() => { if (running) rebuild(); });
  onLangChange(() => { if (running) updateHint(); });
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
  const key = [L, W, H, plinth].join('x');
  if (key !== roomKey) {
    roomKey = key;
    if (room) disposeGroup(room.group);
    room = buildRoom(state.room);
    scene.add(room.group);
    camera.position.set(L * CM / 2, H * CM * 1.6, W * CM * 1.9);
    camera.lookAt(L * CM / 2, 0, W * CM / 2);
  }
}

function updateHint() {
  container.querySelector('#hint3d').textContent = t('v3d.orbitHint');
}

function loop() {
  if (!running) return;
  requestAnimationFrame(loop);
  clock.getDelta();
  renderer.render(scene, camera);
}

export function show(el) {
  if (!renderer && !init(el)) return;
  running = true;
  resize();
  rebuild();
  updateHint();
  clock.start();
  loop();
}

export function hide() {
  running = false;
}

export const getScene = () => scene;
export const getCamera = () => camera;
export const getRenderer = () => renderer;
