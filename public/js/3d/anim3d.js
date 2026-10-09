// Opening doors, flaps and drawers in 3D with a live clearance check.
// Movers come from models3d (userData.movers on an item) and room3d (door pivots).
// Every animation frame the moving part is probed with a grid of points against the other furniture,
// structure and the walls; on contact it turns red, stops there, and the HUD says what is in the way.
import * as THREE from 'three';
import { state, itemName } from '../state.js';
import { rectOf } from '../geometry.js';
import { t } from '../i18n.js';

const SPEED = 1 / 0.6;     // a full opening takes 0.6 s
const REACH = 2.5;         // m: how far E / the crosshair reaches when walking
const TOL = 0.003;         // m: touching is not a hit

let camera, hud, allBtn, furnGroup = null;
const open = new Map();    // key → { cur, target } (0..1), survives rebuilds of the scene
let movers = [];           // { key, obj, type, axis, max, part, itemId, probe: Vector3[] }
let anyOpen = false;
const HIT = new THREE.MeshStandardMaterial({ color: '#ff5a5a', emissive: '#ff1a1a', emissiveIntensity: 0.45 });
const ray = new THREE.Raycaster();
const tmp = new THREE.Vector3();

export function initAnim(cam, canvas, el) {
  camera = cam;
  hud = el.querySelector('#anim3d');
  allBtn = el.querySelector('#openAllBtn');
  allBtn.addEventListener('click', () => { toggleAll(); allBtn.blur(); });

  // A click (not a drag) on furniture or a door toggles it.
  let down = null;
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, at: performance.now() }; });
  canvas.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.at < 400;
    down = null;
    if (moved > 5 || !quick) return;
    // With pointer lock the crosshair is in the centre.
    const centre = document.pointerLockElement === canvas;
    const r = canvas.getBoundingClientRect();
    const ndc = centre ? new THREE.Vector2(0, 0)
      : new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    pick(ndc, centre ? REACH : Infinity);
  });
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyE' || e.repeat || !el.offsetParent || e.target.closest?.('input, textarea, select')) return;
    pick(new THREE.Vector2(0, 0), REACH);
  });
  updateAllBtn();
}

// ---- registration after every rebuild ----
export function attach(furniture, room) {
  movers = [];
  furnGroup = furniture;
  furniture.updateMatrixWorld(true);
  furniture.children.forEach(obj => {
    (obj.userData.movers || []).forEach((m, i) => add({ ...m, key: `i${obj.userData.itemId}:${i}`, itemId: obj.userData.itemId }));
  });
  for (const pivot of room?.doors || []) {
    pivot.updateMatrixWorld(true);
    add({ obj: pivot, type: 'hinge', axis: 'y', max: pivot.userData.door.max, part: 'roomDoor', key: `d${pivot.userData.door.id}`, itemId: null });
  }
  // Forget parts that are gone (deleted items, a different room).
  const keys = new Set(movers.map(m => m.key));
  for (const k of open.keys()) if (!keys.has(k)) open.delete(k);
  updateAllBtn();
}

function add(m) {
  m.probe = probePoints(m.obj);
  movers.push(m);
  const s = open.get(m.key);
  if (s) setValue(m, s.cur);
}

// A grid of points over the part's own bounding box (in the mover's frame).
function probePoints(obj) {
  const inv = obj.matrixWorld.clone().invert(), box = new THREE.Box3(), mtx = new THREE.Matrix4();
  obj.traverse(o => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.union(o.geometry.boundingBox.clone().applyMatrix4(mtx.multiplyMatrices(inv, o.matrixWorld)));
  });
  const pts = [], lerp = (a, b, k) => a + (b - a) * k;
  for (let i = 0; i <= 6; i++) for (let j = 0; j <= 2; j++) for (let k = 0; k <= 2; k++) {
    pts.push(new THREE.Vector3(lerp(box.min.x, box.max.x, i / 6), lerp(box.min.y, box.max.y, j / 2), lerp(box.min.z, box.max.z, k / 2)));
  }
  return pts;
}

function setValue(m, v) {
  if (m.type === 'slide') m.obj.position[m.axis] = m.max * v;
  else m.obj.rotation[m.axis] = m.max * v;
  m.obj.updateMatrixWorld(true);
}

// ---- toggling ----
function pick(ndc, far) {
  ray.setFromCamera(ndc, camera);
  ray.far = far;
  const doors = movers.filter(m => m.itemId === null).map(m => m.obj);
  const hits = ray.intersectObjects([...(furnGroup?.children || []), ...doors], true).filter(h => visible(h.object));
  for (const h of hits) {
    let o = h.object;
    while (o && o.userData.itemId === undefined && !o.userData.door) o = o.parent;
    if (!o) continue;
    const own = o.userData.door ? movers.filter(m => m.obj === o) : movers.filter(m => m.itemId === o.userData.itemId);
    if (own.length) toggle(own);
    return;       // only the nearest thing counts
  }
}

const visible = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };

function toggle(list) {
  const opening = list.every(m => (open.get(m.key)?.target || 0) === 0);
  for (const m of list) {
    const s = open.get(m.key) || { cur: 0, target: 0 };
    s.target = opening ? 1 : 0;
    open.set(m.key, s);
    if (!opening) paint(m, false);
  }
  if (opening) hud.hidden = true;
}

function toggleAll() {
  const opening = !anyOpen;
  for (const m of movers) {
    const s = open.get(m.key) || { cur: 0, target: 0 };
    s.target = opening ? 1 : 0;
    open.set(m.key, s);
    if (!opening) paint(m, false);
  }
  hud.hidden = true;
}

// ---- per frame ----
export function update(dt) {
  let changed = false;
  let blockers = null;
  for (const m of movers) {
    const s = open.get(m.key);
    if (!s || s.cur === s.target) continue;
    changed = true;
    const prev = s.cur;
    const step = SPEED * dt * (s.target > s.cur ? 1 : -1);
    s.cur = s.target > prev ? Math.min(s.target, prev + step) : Math.max(s.target, prev + step);
    setValue(m, s.cur);
    if (s.target > prev) {
      blockers ||= solids();
      const hit = collide(m, blockers);
      if (hit) {
        s.cur = s.target = prev;
        setValue(m, prev);
        paint(m, true);
        report(m, hit, prev);
      }
    }
  }
  if (changed) updateAllBtn();
}

// Other furniture, structure (boxes in metres, world space) and the room interior.
function solids() {
  const out = [];
  for (const it of state.items) {
    const r = rectOf(it), e = (it.elev || 0) / 100;
    out.push({ id: it.id, name: `«${itemName(it)}»`, x0: r.x / 100, x1: (r.x + r.w) / 100, z0: r.y / 100, z1: (r.y + r.h) / 100, y0: e, y1: e + it.h / 100 });
  }
  for (const o of state.obstacles || []) {
    out.push({ id: null, name: `«${t('ob.' + o.kind)}»`, x0: o.x / 100, x1: (o.x + o.w) / 100, z0: o.y / 100, z1: (o.y + o.d) / 100, y0: o.elev / 100, y1: (o.elev + o.h) / 100 });
  }
  return out;
}

function collide(m, boxes) {
  const { L, W, H } = state.room;
  const inside = m.part !== 'roomDoor';     // a room door starts inside its wall
  for (const p of m.probe) {
    tmp.copy(p).applyMatrix4(m.obj.matrixWorld);
    if (inside) {
      if (tmp.x < -TOL || tmp.z < -TOL || tmp.x > L / 100 + TOL || tmp.z > W / 100 + TOL) return { name: t('anim.wall') };
      if (tmp.y < -TOL || tmp.y > H / 100 + TOL) return { name: t('anim.floor') };
    }
    for (const b of boxes) {
      if (b.id !== null && b.id === m.itemId) continue;
      if (tmp.x > b.x0 + TOL && tmp.x < b.x1 - TOL && tmp.z > b.z0 + TOL && tmp.z < b.z1 - TOL && tmp.y > b.y0 + TOL && tmp.y < b.y1 - TOL) return b;
    }
  }
  return null;
}

function paint(m, bad) {
  m.obj.traverse(o => {
    if (!o.isMesh) return;
    if (bad) { if (!o.userData.mat0) { o.userData.mat0 = o.material; o.material = HIT; } }
    else if (o.userData.mat0) { o.material = o.userData.mat0; delete o.userData.mat0; }
  });
}

function report(m, hit, v) {
  const deg = Math.round(Math.abs(m.max * v) * 180 / Math.PI), cm = Math.round(Math.abs(m.max * v) * 100);
  const key = m.part === 'roomDoor' ? 'anim.roomDoor' : m.type === 'slide' && m.part === 'drawer' ? 'anim.drawer' : 'anim.door';
  // Blocked right at the start: "does not open" instead of "at 0°".
  hud.textContent = t(deg < 1 && cm < 1 ? key + '0' : key, { name: hit.name, deg, cm });
  hud.hidden = false;
  clearTimeout(report.timer);
  report.timer = setTimeout(() => { hud.hidden = true; }, 4000);
}

function updateAllBtn() {
  anyOpen = movers.some(m => (open.get(m.key)?.target || 0) > 0);
  if (allBtn) {
    allBtn.textContent = t(anyOpen ? 'anim.closeAll' : 'anim.openAll');
    allBtn.hidden = !movers.length;
  }
}

export function onLang() { updateAllBtn(); }
