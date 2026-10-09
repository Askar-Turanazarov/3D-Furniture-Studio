// Camera controls: Overview (orbit with wall cutaway).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { t } from '../i18n.js';

const NORMALS = {
  north: new THREE.Vector3(0, 0, -1), south: new THREE.Vector3(0, 0, 1),
  west: new THREE.Vector3(-1, 0, 0), east: new THREE.Vector3(1, 0, 0)
};

let camera, container, orbit;
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

  el.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
}

// New room geometry: re-aim the overview camera.
export function setRoom(r, resetView) {
  room = r;
  if (resetView && mode === 'orbit') overview();
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
  if (mode === 'orbit') overview();
  updateHint();
}

export function updateHint() {
  container.querySelector('#hint3d').textContent = t('v3d.orbitHint');
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
  if (mode === 'orbit') orbit.update();
  cutaway();
}

export const getMode = () => mode;
