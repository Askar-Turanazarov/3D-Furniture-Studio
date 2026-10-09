// Camera controls: Overview (orbit with wall cutaway) and Walk (first person with collisions).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { state } from '../state.js';
import { rectOf } from '../geometry.js';
import { t } from '../i18n.js';

const NORMALS = {
  north: new THREE.Vector3(0, 0, -1), south: new THREE.Vector3(0, 0, 1),
  west: new THREE.Vector3(-1, 0, 0), east: new THREE.Vector3(1, 0, 0)
};

const RADIUS = 0.25;       // player radius, m
const WALK = 1.4, RUN = 3; // m/s

let camera, container, orbit, plc, overlay;
const keys = new Set();
export const touchInput = { f: 0, r: 0, active: false };
let room = null;           // result of buildRoom()
let mode = 'orbit';
const tmp = new THREE.Vector3();

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
    if (isTouch()) { touchInput.active = true; overlay.hidden = true; return; }
    plc.lock();
  });
  plc.addEventListener('lock', () => { overlay.hidden = true; });
  plc.addEventListener('unlock', () => { if (mode === 'walk') overlay.hidden = false; });

  const typing = e => e.target instanceof Element && e.target.closest('input, textarea, select');
  window.addEventListener('keydown', e => {
    if (mode !== 'walk' || typing(e)) return;
    keys.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  el.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
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
    spawn();
    overlay.hidden = false;
  }
  updateHint();
}

export function updateHint() {
  const key = mode === 'orbit' ? 'v3d.orbitHint' : isTouch() ? 'v3d.touchHint' : 'v3d.walkHint';
  container.querySelector('#hint3d').textContent = t(key);
}

export const isTouch = () => matchMedia('(pointer: coarse)').matches;

const eyeHeight = () => Math.min(1.6, room.size.H - 0.15);

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

// Start near the door (south-east), else the nearest free point to the room centre.
function spawn() {
  const { L, W } = room.size;
  const obs = obstacles();
  const cands = [[L - 0.6, W - 0.6]];
  for (let r = 0; r < Math.max(L, W); r += 0.1) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) cands.push([L / 2 + Math.cos(a) * r, W / 2 + Math.sin(a) * r]);
  }
  const [x, z] = cands.find(([x, z]) => !blockedAt(x, z, obs)) || [L / 2, W / 2];
  camera.position.set(x, eyeHeight(), z);
  camera.lookAt(L / 2, eyeHeight() * 0.85, W / 2);
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
}

export const getMode = () => mode;

// Leaving the 3D view: release the mouse and stop walking.
export function release() {
  if (plc.isLocked) plc.unlock();
  touchInput.active = false;
  keys.clear();
}
