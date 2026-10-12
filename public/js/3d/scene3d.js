// 3D view: renderer, camera, render loop. Scene units are metres (cm / 100).
import * as THREE from 'three';
import { t, onLangChange } from '../i18n.js';
import { state, onChange, emit, roomView } from '../state.js';
import { buildRoom, disposeGroup, revealParts } from './room3d.js';
import { liveRooms } from '../renderer.js';
import { doorLinks, adjacent, wallLine, posOf, roomRect, twinIds } from '../apartment.js';
import { switchRoom } from '../projects.js';
import { buildObstacles } from './obstacles3d.js';
import { buildLights, setupEnvironment, applyFixtures, lightingOf, CEILINGS, setLightTargets, tweenLights } from './lights3d.js';
import { lampsOn } from '../lighting.js';
import { buildItem } from './models3d.js';
import { validateAll } from '../validate.js';
import * as controls from './controls3d.js';
import * as anim from './anim3d.js';
import { initTouch } from './touch3d.js';
import { setQuality, resetPhoto, onLibLoaded } from './textures3d.js';
import { styleOf } from '../style.js';
import { toast } from '../ui.js';
import { compose, savePicture, canShareFiles } from '../snapshot.js';

let renderer, scene, camera, container, clock;
let running = false;
// Every room of the apartment: { group (at pos), doc, shell, key, furniture, fkey, lights, lkey }.
const rooms3d = new Map();
let outline = '';
let mainLights = null;     // lights of the active room (the walker's): sky, sun, shadows
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
    state.lighting = { ...lightingOf(state.lighting), scene: b.dataset.light, lampsOn: null };   // the scene decides the lamps again
    emit();
  }));
  // 💡 / L: lamps on or off over the scene default.
  el.querySelector('#lampBtn').addEventListener('click', toggleLamps);
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyL' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || !el.offsetParent
      || e.target.closest?.('input, textarea, select')) return;
    toggleLamps();
  });
  el.querySelectorAll('[data-finish]').forEach(b => b.addEventListener('click', () => {
    state.style = { ...styleOf(state.style), finish: b.dataset.finish };
    emit();
  }));
  // A photo-library set has arrived: rebuild the shell and furniture with it.
  onLibLoaded(() => { forget(); if (running) rebuild(); });
  el.querySelector('#ceilSel').addEventListener('change', e => {
    state.lighting = { ...lightingOf(state.lighting), ceiling: e.target.value };
    emit();
  });
  fillCeilSel();
  onLangChange(fillCeilSel);
  anim.initAnim(camera, renderer.domElement, el, id => { if (id !== state.activeRoomId) switchRoom(id); });
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
  forget();
  if (running) rebuild();
}

// Shells and furniture are rebuilt with new materials.
function forget() {
  for (const e of rooms3d.values()) e.key = e.fkey = '';
}

const T = 10;   // outer wall thickness, cm

// Rebuild only what changed: a room shell when its size, openings, structure, style or doorways change,
// its furniture when its items or their errors change. The overview is re-aimed when the outline changes.
function rebuild() {
  const rooms = liveRooms();
  const links = doorLinks(rooms);
  for (const [id, e] of rooms3d) {
    if (rooms.some(r => r.id === id)) continue;
    disposeGroup(e.group);
    rooms3d.delete(id);
  }
  let changed = false;
  for (const r of rooms) {
    let e = rooms3d.get(r.id);
    if (!e) {
      e = { group: new THREE.Group(), key: '', fkey: '', lkey: '' };
      scene.add(e.group);
      rooms3d.set(r.id, e);
    }
    const { x, y } = posOf(r.pos);
    e.group.position.set(x / 100, 0, y / 100);
    e.doc = r;
    // Doorways of the neighbours' doors in this room's walls, the doorways it owns, half partitions.
    const holes = links.filter(l => l.to === r.id).map(l => ({ wall: l.wall, offset: l.offset, width: l.width, height: l.height }));
    const own = links.filter(l => l.room === r.id && l.to !== 'outside').map(l => {
      const o = r.openings.find(d => d.id === l.door), b = rooms.find(q => q.id === l.to);
      return { wall: o.wall, offset: o.offset, width: o.width, height: o.height,
        gap: Math.abs(wallLine(b, l.wall).at - wallLine(r, o.wall).at) };
    });
    const thick = {};
    for (const b of rooms) {
      if (b === r) continue;
      for (const a of adjacent(r, b, 2 * T)) thick[a.wallA] = Math.min(thick[a.wallA] ?? T / 100, a.gap / 200);
    }
    // A twin door (the neighbour's leaf is the real one) is only a hole in this wall.
    const twins = twinIds(rooms, r.id);
    const openings = (r.openings || []).filter(o => !twins.has(o.id));
    for (const o of (r.openings || []).filter(o => twins.has(o.id))) {
      const h = holes.find(q => q.wall === o.wall && q.offset < o.offset + o.width && o.offset < q.offset + q.width);
      if (!h) continue;
      const end = Math.max(h.offset + h.width, o.offset + o.width);
      h.offset = Math.min(h.offset, o.offset);
      h.width = end - h.offset;
      h.height = Math.max(h.height, o.height);
    }
    const key = JSON.stringify([r.room, openings, r.obstacles, r.style, holes, own, thick]);
    if (key !== e.key) {
      e.key = key;
      if (e.shell) disposeGroup(e.shell.group);
      e.shell = buildRoom(r.room, openings, r.style, { holes, thick });
      e.shell.group.add(buildObstacles(r.obstacles));
      for (const d of own) e.shell.group.add(revealParts(d.wall, d.offset, d.width, d.height, d.gap, r.room.L, r.room.W, r.style));
      e.group.add(e.shell.group);
      changed = true;
    }
    if (buildFurniture(e, r)) changed = true;
  }
  const rs = rooms.map(roomRect);
  const bx = Math.min(...rs.map(q => q.x)), by = Math.min(...rs.map(q => q.y));
  const bounds = {
    x: bx / 100, z: by / 100, w: (Math.max(...rs.map(q => q.x + q.w)) - bx) / 100, d: (Math.max(...rs.map(q => q.y + q.h)) - by) / 100,
    H: Math.max(...rooms.map(r => r.room.H)) / 100
  };
  const ok = JSON.stringify(bounds);
  const resetView = ok !== outline;
  outline = ok;
  const entries = [...rooms3d].map(([id, e]) => ({ id, doc: e.doc, shell: e.shell, furniture: e.furniture, x: e.group.position.x, z: e.group.position.z }));
  if (changed) anim.attach(entries);
  controls.setApartment({
    rooms: entries, bounds,
    doorOpen: anim.doorOpen, openDoor: anim.openDoor,
    onEnter: id => switchRoom(id)
  }, resetView);
  buildAllLights();
  syncLightHud();
  syncRoomHud(rooms);
}

// Lights: the active room (where the walker is) gets sky light, sun and shadows, the others only their fixture.
// Rebuilt only for a new shell, fixture type or main room; scene and lamp changes are tweened.
function buildAllLights() {
  const ceiling = lightingOf(state.lighting).ceiling;
  const prev = mainLights?.userData.cur;
  for (const [id, e] of rooms3d) {
    const main = id === state.activeRoomId || rooms3d.size === 1;
    const lk = [ceiling, main, e.key].join('|');
    if (lk !== e.lkey) {
      e.lkey = lk;
      if (e.lights) disposeGroup(e.lights);
      e.lights = buildLights(e.shell.size, e.shell.windows[0] || null, state.lighting, prev, main);
      e.group.add(e.lights);
    } else {
      setLightTargets(e.lights, state.lighting);
    }
    if (main) mainLights = e.lights;
  }
  scene.environmentIntensity = mainLights.userData.cur.env;
  for (const e of rooms3d.values()) if (e.furniture) applyFixtures(e.furniture, mainLights.userData.cur.fix);
}

// Furniture of one room: red tint for items with errors, green for a freshly auto-placed one. True when rebuilt.
function buildFurniture(e, r) {
  const errors = validateAll(roomView(r.id));
  const now = performance.now();
  const found = r.id === state.activeRoomId && state.found && now < state.found.until ? state.found : null;
  const status = it => (errors.get(it.id) || []).length ? 'bad' : found && found.id === it.id ? 'found' : 'ok';
  const fkey = JSON.stringify([r.items, r.items.map(status), r.style, state.materials]);
  if (found) {
    clearTimeout(foundTimer);
    foundTimer = setTimeout(() => { if (running) rebuild(); }, found.until - now + 20);
  }
  if (fkey === e.fkey) return false;
  e.fkey = fkey;
  if (e.furniture) disposeGroup(e.furniture);
  e.furniture = new THREE.Group();
  e.furniture.name = 'furniture';
  for (const it of r.items) e.furniture.add(buildItem(it, status(it), state.materials, r.style, state.catalog));
  e.group.add(e.furniture);
  return true;
}

// Name of the active room (the one the walker is in) when the apartment has several.
function syncRoomHud(rooms) {
  const el = container.querySelector('#room3d');
  const r = rooms.find(q => q.id === state.activeRoomId);
  el.hidden = rooms.length < 2 || !r;
  if (r) el.textContent = '\u{1F4CD} ' + r.name;
}

function fillCeilSel() {
  const sel = container.querySelector('#ceilSel');
  sel.replaceChildren(...CEILINGS.map(c => new Option(t('light.' + c), c)));
  syncLightHud();
}

function toggleLamps() {
  state.lighting = { ...lightingOf(state.lighting), lampsOn: !lampsOn(state.lighting) };
  emit();
}

function syncLightHud() {
  const l = lightingOf(state.lighting);
  container.querySelectorAll('[data-light]').forEach(b => b.classList.toggle('active', b.dataset.light === l.scene));
  container.querySelector('#lampBtn').classList.toggle('active', lampsOn(l));
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
  let tweened = false;
  for (const e of rooms3d.values()) if (e.lights && tweenLights(e.lights, dt)) tweened = true;
  if (tweened && mainLights) {
    scene.environmentIntensity = mainLights.userData.cur.env;
    for (const e of rooms3d.values()) if (e.furniture) applyFixtures(e.furniture, mainLights.userData.cur.fix);
  }
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
