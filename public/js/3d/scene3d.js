// 3D view: renderer, camera, render loop. Scene units are metres (cm / 100).
import * as THREE from 'three';
import { t, onLangChange } from '../i18n.js';
import { state, onChange, emit } from '../state.js';
import { buildRoom, disposeGroup } from './room3d.js';
import { buildObstacles } from './obstacles3d.js';
import { buildLights, setupEnvironment, applyFixtures, lightingOf, CEILINGS } from './lights3d.js';
import { buildItem } from './models3d.js';
import { validateAll } from '../validate.js';
import * as controls from './controls3d.js';
import * as anim from './anim3d.js';
import { initTouch } from './touch3d.js';
import { setQuality, resetPhoto } from './textures3d.js';
import { toast } from '../ui.js';
import { compose, savePicture, canShareFiles } from '../snapshot.js';

let renderer, scene, camera, container, clock;
let running = false;
let roomKey = '', lightKey = '';
let room = null;
let lights = null;
let furniture = null;
let foundTimer = null;
// Ambient occlusion (GTAO) in Photo mode: composer is loaded on first use, switched off when FPS drops.
let quality = 'simple', aoWanted = false, composer = null, aoPass = null;
let fpsTime = 0, fpsFrames = 0;

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
  el.querySelectorAll('[data-quality]').forEach(b => b.addEventListener('click', () => applyQuality(b.dataset.quality)));
  let saved = 'simple';
  try { saved = localStorage.getItem('fsp3d.quality') || 'simple'; } catch { /* ignore */ }
  try { aoWanted = localStorage.getItem('fsp3d.ao') === '1'; } catch { /* ignore */ }
  el.querySelector('#aoBtn').addEventListener('click', () => setAo(!aoWanted));
  if (saved !== 'simple') applyQuality(saved);
  // The texture panel changed the photo set: reload it and switch to Photo.
  document.addEventListener('fsp3d:textures', () => { resetPhoto(); applyQuality('photo'); });

  el.querySelector('#snap3dBtn').addEventListener('click', () => savePicture(compose(snapshotCanvas())));
  const share = el.querySelector('#share3dBtn');
  share.hidden = !canShareFiles();
  share.addEventListener('click', () => savePicture(compose(snapshotCanvas()), true));
  // Light: time of day and ceiling fixture are part of the room (saved, undoable).
  el.querySelectorAll('[data-light]').forEach(b => b.addEventListener('click', () => {
    state.lighting = { ...lightingOf(state.lighting), scene: b.dataset.light };
    emit();
  }));
  el.querySelector('#ceilSel').addEventListener('change', e => {
    state.lighting = { ...lightingOf(state.lighting), ceiling: e.target.value };
    emit();
  });
  fillCeilSel();
  onLangChange(fillCeilSel);
  anim.initAnim(camera, renderer.domElement, el);
  onLangChange(anim.onLang);

  new ResizeObserver(resize).observe(el);
  onChange(() => { if (running) rebuild(); });
  onLangChange(() => { if (running) controls.updateHint(); });
  return true;
}

function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  if (composer) {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
  }
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// Simple (procedural) / Photo (CC0) textures; the whole scene is rebuilt with new materials.
async function applyQuality(q) {
  const ok = await setQuality(q);
  quality = q;
  container.querySelectorAll('[data-quality]').forEach(b => b.classList.toggle('active', b.dataset.quality === q));
  syncAo();
  try { localStorage.setItem('fsp3d.quality', q); } catch { /* ignore */ }
  if (!ok) toast(t('v3d.photoFail'), true);
  roomKey = '';
  if (running) rebuild();
}

// Rebuild the room only when its size or openings change; furniture on every change.
// The camera is re-aimed only when the room size changes.
function rebuild() {
  const { L, W, H, plinth } = state.room;
  let roomChanged = false;
  const sizeKey = [L, W, H, plinth].join('x');
  const key = sizeKey + JSON.stringify(state.openings) + JSON.stringify(state.obstacles) + JSON.stringify(state.style);
  if (key !== roomKey) {
    roomChanged = roomKey === '' ? !room : !roomKey.startsWith(sizeKey + '[');
    roomKey = key;
    if (room) disposeGroup(room.group);
    room = buildRoom(state.room, state.openings || [], state.style);
    room.group.add(buildObstacles(state.obstacles));
    scene.add(room.group);
    lightKey = '';
  }
  const lk = JSON.stringify(lightingOf(state.lighting));
  if (lk !== lightKey) {
    lightKey = lk;
    if (lights) disposeGroup(lights);
    lights = buildLights(room.size, room.windows[0] || null, state.lighting);
    scene.environmentIntensity = lights.userData.env;
    scene.add(lights);
    syncLightHud();
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
    furniture.add(buildItem(it, status, state.materials, state.style, state.catalog));
  }
  applyFixtures(furniture, state.lighting);
  anim.attach(furniture, room);
  scene.add(furniture);
  clearTimeout(foundTimer);
  if (found) foundTimer = setTimeout(() => { if (running) buildFurniture(); }, found.until - now + 20);
}

function fillCeilSel() {
  const sel = container.querySelector('#ceilSel');
  sel.replaceChildren(...CEILINGS.map(c => new Option(t('light.' + c), c)));
  syncLightHud();
}

function syncLightHud() {
  const l = lightingOf(state.lighting);
  container.querySelectorAll('[data-light]').forEach(b => b.classList.toggle('active', b.dataset.light === l.scene));
  container.querySelector('#ceilSel').value = l.ceiling;
}

const aoActive = () => aoWanted && quality === 'photo' && composer;

function syncAo() {
  const btn = container.querySelector('#aoBtn');
  btn.hidden = quality !== 'photo';
  btn.classList.toggle('active', aoWanted);
  if (aoWanted && quality === 'photo' && !composer) loadComposer();
}

async function loadComposer() {
  try {
    const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { OutputPass }] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/GTAOPass.js'), import('three/addons/postprocessing/OutputPass.js')]);
    if (composer) return;
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    aoPass = new GTAOPass(scene, camera, w, h);
    aoPass.updateGtaoMaterial({ radius: 0.35, distanceFallOff: 1, thickness: 1, scale: 1 });
    composer.addPass(aoPass);
    composer.addPass(new OutputPass());
    resize();
  } catch {
    aoWanted = false;
    syncAo();
  }
}

function setAo(on) {
  aoWanted = on;
  fpsTime = fpsFrames = 0;
  try { localStorage.setItem('fsp3d.ao', on ? '1' : '0'); } catch { /* ignore */ }
  syncAo();
}

function draw() {
  if (aoActive()) composer.render();
  else renderer.render(scene, camera);
}

// Average FPS over 2 s; AO is turned off when it is below 24.
function watchFps(dt) {
  if (!aoActive()) return;
  fpsTime += dt;
  fpsFrames++;
  if (fpsTime < 2) return;
  const fps = fpsFrames / fpsTime;
  fpsTime = fpsFrames = 0;
  if (fps < 24) {
    setAo(false);
    toast(t('v3d.aoSlow'));
  }
}

function loop() {
  if (!running) return;
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.25);
  controls.update(dt);
  anim.update(dt);
  draw();
  watchFps(dt);
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

// One frame at 2× pixel ratio copied right after rendering (no preserveDrawingBuffer needed).
export function snapshotCanvas() {
  const pr = renderer.getPixelRatio();
  renderer.setPixelRatio(2);
  resize();
  draw();
  const c = document.createElement('canvas');
  c.width = renderer.domElement.width;
  c.height = renderer.domElement.height;
  c.getContext('2d').drawImage(renderer.domElement, 0, 0);
  renderer.setPixelRatio(pr);
  resize();
  draw();
  return c;
}

export const getScene = () => scene;
export const getCamera = () => camera;
export const getRenderer = () => renderer;
