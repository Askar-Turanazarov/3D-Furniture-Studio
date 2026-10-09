// Camera controls: Overview (orbit with wall cutaway) and Walk (first person with collisions).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { state, itemName } from '../state.js';
import { rectOf } from '../geometry.js';
import { t, getLang } from '../i18n.js';

const NORMALS = {
  north: new THREE.Vector3(0, 0, -1), south: new THREE.Vector3(0, 0, 1),
  west: new THREE.Vector3(-1, 0, 0), east: new THREE.Vector3(1, 0, 0)
};

const RADIUS = 0.25;       // player radius, m
const WALK = 1.4, RUN = 3; // m/s

let camera, container, orbit, plc, overlay;
const keys = new Set();
const downAt = new Map();
// active = walking without pointer lock (touch, or a browser that refuses the lock).
export const touchInput = { f: 0, r: 0, active: false };
let room = null;           // result of buildRoom()
let mode = 'orbit';
const tmp = new THREE.Vector3();
let personH = 170;          // cm, eyes ≈ 93 % of the height
try { personH = Number(localStorage.getItem('fsp3d.height')) || 170; } catch { /* ignore */ }
const HEIGHTS = [120, 150, 155, 160, 165, 170, 175, 180, 185, 190, 195, 200];
const PRESETS = { 120: 'v3d.child', 165: 'v3d.woman', 180: 'v3d.man' };
let distAt = 0;

export function initControls(cam, dom, el) {
  camera = cam;
  container = el;
  orbit = new OrbitControls(camera, dom);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.08;
  orbit.minDistance = 0.5;
  orbit.maxDistance = 20;
  orbit.maxPolarAngle = Math.PI / 2 - 0.02;   // never below the floor

  plc = new PointerLockControls(camera, dom);
  overlay = el.querySelector('#walkOverlay');
  overlay.addEventListener('click', () => {
    if (isTouch()) return startFree();
    try { plc.lock(); } catch { return startFree(); }
    // No lock shortly after the click (denied / unsupported) → walk without it.
    setTimeout(() => { if (mode === 'walk' && !plc.isLocked && !touchInput.active) startFree(); }, 400);
  });
  document.addEventListener('pointerlockerror', () => { if (mode === 'walk') startFree(); });
  plc.addEventListener('lock', () => { document.activeElement?.blur(); touchInput.active = false; overlay.hidden = true; updateHint(); });
  plc.addEventListener('unlock', () => { if (mode === 'walk' && !touchInput.active) overlay.hidden = false; updateHint(); });

  // Mouse drag look when walking without pointer lock.
  let drag = null;
  dom.addEventListener('pointerdown', e => {
    if (mode === 'walk' && touchInput.active && e.pointerType === 'mouse') drag = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    look(e.clientX - drag.x, e.clientY - drag.y);
    drag = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointerup', () => { drag = null; });

  const typing = e => e.target instanceof Element && e.target.closest('input, textarea, select');
  window.addEventListener('keydown', e => {
    if (mode !== 'walk' || typing(e)) return;
    if (e.code === 'Escape' && touchInput.active) { stopFree(); return; }
    if (!keys.has(e.code)) downAt.set(e.code, performance.now());
    keys.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  // A short tap still counts as a ~150 ms step.
  window.addEventListener('keyup', e => {
    const held = performance.now() - (downAt.get(e.code) || 0);
    setTimeout(() => keys.delete(e.code), Math.max(0, 150 - held));
  });
  window.addEventListener('blur', () => keys.clear());

  el.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

  const sel = el.querySelector('#heightSel');
  sel.addEventListener('change', () => {
    personH = Number(sel.value);
    try { localStorage.setItem('fsp3d.height', personH); } catch { /* ignore */ }
    if (room && mode === 'walk') camera.position.y = eyeHeight();
    sel.blur();   // WASD / arrows must move the person, not the select
  });
}

function fillHeights() {
  const sel = container.querySelector('#heightSel');
  if (!HEIGHTS.includes(personH)) personH = 170;
  sel.innerHTML = HEIGHTS.map(h => `<option value="${h}">${h} ${t('unit.cm')}${PRESETS[h] ? ' · ' + t(PRESETS[h]) : ''}</option>`).join('');
  sel.value = personH;
}

// New room geometry: re-aim the overview camera.
export function setRoom(r, resetView) {
  room = r;
  if (!resetView) return;
  if (mode === 'orbit') overview(); else spawn();
}

function overview() {
  const { L, W, H } = room.size;
  orbit.target.set(L / 2, H * 0.3, W / 2);
  const dist = Math.max(L, W) * 1.25 + 1;
  camera.position.set(L / 2 + dist * 0.55, H + dist * 0.6, W / 2 + dist * 0.8);
  orbit.update();
}

export function setMode(next) {
  mode = next;
  container.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  orbit.enabled = mode === 'orbit';
  keys.clear();
  if (mode === 'orbit') {
    if (plc.isLocked) plc.unlock();
    touchInput.active = false;
    overlay.hidden = true;
    overview();
  } else {
    touchInput.active = false;
    spawn();
    overlay.hidden = false;
  }
  updateHint();
}

export function updateHint() {
  fillHeights();
  container.querySelector('#heightBox').hidden = mode !== 'walk';
  const walking = mode === 'walk' && (plc.isLocked || touchInput.active);
  container.querySelector('#dist3d').hidden = !walking;
  container.querySelector('#cross3d').hidden = !walking;
  const key = mode === 'orbit' ? 'v3d.orbitHint' : isTouch() ? 'v3d.touchHint'
    : touchInput.active ? 'v3d.dragHint' : 'v3d.walkHint';
  container.querySelector('#hint3d').textContent = t(key);
}

function startFree() {
  document.activeElement?.blur();   // keys must not re-trigger HUD buttons
  touchInput.active = true;
  overlay.hidden = true;
  updateHint();
}

function stopFree() {
  touchInput.active = false;
  touchInput.f = touchInput.r = 0;
  keys.clear();
  overlay.hidden = false;
  updateHint();
}

export const isTouch = () => matchMedia('(pointer: coarse)').matches;

const eyeHeight = () => Math.min(personH * 0.93 / 100, room.size.H - 0.15);

// Furniture footprints in metres.
function obstacles() {
  return state.items.map(it => {
    const r = rectOf(it);
    return { x: r.x / 100, z: r.y / 100, w: r.w / 100, d: r.h / 100 };
  });
}

function blockedAt(x, z, obs) {
  const { L, W } = room.size;
  const p = state.room.plinth / 100 + RADIUS;
  if (x < p || x > L - p || z < p || z > W - p) return true;
  return obs.some(o => x > o.x - RADIUS && x < o.x + o.w + RADIUS && z > o.z - RADIUS && z < o.z + o.d + RADIUS);
}

// Start just inside the first door, else the nearest free point to the room centre.
function spawn() {
  const { L, W } = room.size;
  const obs = obstacles();
  const cands = [];
  const door = (state.openings || []).find(o => o.kind === 'door');
  if (door) {
    const c = (door.offset + door.width / 2) / 100, inset = door.width / 100 + 0.3;
    const p = { north: [c, inset], south: [c, W - inset], west: [inset, c], east: [L - inset, c] }[door.wall];
    cands.push(p);
  }
  for (let r = 0; r < Math.max(L, W); r += 0.1) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) cands.push([L / 2 + Math.cos(a) * r, W / 2 + Math.sin(a) * r]);
  }
  const [x, z] = cands.find(([x, z]) => !blockedAt(x, z, obs)) || [L / 2, W / 2];
  camera.position.set(x, eyeHeight(), z);
  // Look towards the room centre; from the centre itself look at the window (north).
  let tx = L / 2 - x, tz = W / 2 - z;
  if (Math.hypot(tx, tz) < 0.3) { tx = 0; tz = -1; }
  camera.lookAt(x + tx, eyeHeight() * 0.9, z + tz);
}

// Move with sliding along obstacles: try X and Z separately.
function walk(dt) {
  const active = plc.isLocked || touchInput.active;
  if (!active) return;
  let f = touchInput.f, r = touchInput.r;
  if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) r += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) r -= 1;
  const len = Math.hypot(f, r);
  if (len < 0.01) return;
  const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN : WALK) * dt / Math.max(1, len);
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0; fwd.normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const dx = (fwd.x * f + right.x * r) * speed, dz = (fwd.z * f + right.z * r) * speed;
  const obs = obstacles();
  const pos = camera.position;
  if (!blockedAt(pos.x + dx, pos.z, obs)) pos.x += dx;
  if (!blockedAt(pos.x, pos.z + dz, obs)) pos.z += dz;
  pos.y = eyeHeight();
}

// Rotate the view by a screen delta (touch look).
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
export function look(dx, dy) {
  euler.setFromQuaternion(camera.quaternion);
  euler.y -= dx * 0.005;
  euler.x = Math.max(-1.4, Math.min(1.4, euler.x - dy * 0.005));
  camera.quaternion.setFromEuler(euler);
}

// Dollhouse cutaway: hide walls between the camera and the room, and the ceiling from above.
function cutaway() {
  if (!room) return;
  const { L, W, H } = room.size;
  const showAll = mode !== 'orbit';
  for (const [side, group] of Object.entries(room.walls)) {
    const c = side === 'north' ? tmp.set(L / 2, 0, 0) : side === 'south' ? tmp.set(L / 2, 0, W)
      : side === 'west' ? tmp.set(0, 0, W / 2) : tmp.set(L, 0, W / 2);
    const outside = camera.position.clone().sub(c).dot(NORMALS[side]) > 0;
    group.visible = showAll || !outside;
  }
  room.ceiling.visible = showAll || camera.position.y < H;
}

export function update(dt) {
  if (mode === 'orbit') orbit.update(); else walk(dt);
  cutaway();
  if (mode === 'walk' && performance.now() - distAt > 100) { distAt = performance.now(); showDistance(); }
}

// Straight distance along the floor from the person's feet (camera projected down)
// in the looking direction to the first furniture footprint or wall.
function showDistance() {
  const el = container.querySelector('#dist3d');
  if (el.hidden || !room) return;
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-6) return;
  fwd.normalize();
  const ox = camera.position.x, oz = camera.position.z;
  const { L, W } = room.size;
  // Walls: inner faces.
  let best = { d: Infinity, wall: null, item: null };
  for (const [wall, d] of [
    ['west', fwd.x < 0 ? -ox / fwd.x : Infinity], ['east', fwd.x > 0 ? (L - ox) / fwd.x : Infinity],
    ['north', fwd.z < 0 ? -oz / fwd.z : Infinity], ['south', fwd.z > 0 ? (W - oz) / fwd.z : Infinity]
  ]) if (d < best.d) best = { d, wall, item: null };
  // Furniture: ray vs AABB (slab method).
  state.items.forEach(it => {
    const r = rectOf(it);
    const d = rayBox(ox, oz, fwd.x, fwd.z, r.x / 100, r.y / 100, (r.x + r.w) / 100, (r.y + r.h) / 100);
    if (d !== null && d < best.d) best = { d, wall: null, item: it };
  });
  if (!isFinite(best.d)) return;
  const m = best.d < 0.01 ? t('v3d.distTouch') : best.d.toLocaleString(getLang(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cm = Math.round(best.d * 100);
  const text = best.item ? t('v3d.distItem', { name: itemName(best.item), m }) : t('v3d.distWall', { wall: t('wallShort.' + best.wall), m });
  el.innerHTML = '';
  el.append(text, Object.assign(document.createElement('small'), { textContent: `${cm} ${t('unit.cm')} · ${t('v3d.fromFeet')}` }));
}

function rayBox(ox, oz, dx, dz, x0, z0, x1, z1) {
  let tmin = 0, tmax = Infinity;
  for (const [o, d, a, b] of [[ox, dx, x0, x1], [oz, dz, z0, z1]]) {
    if (Math.abs(d) < 1e-9) { if (o < a || o > b) return null; continue; }
    let t1 = (a - o) / d, t2 = (b - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}

export const getMode = () => mode;

// Leaving the 3D view: release the mouse and stop walking.
export function release() {
  if (plc.isLocked) plc.unlock();
  touchInput.active = false;
  keys.clear();
}
