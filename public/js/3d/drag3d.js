// Moving furniture in the 3D overview: press an item of the active room and drag it over the floor. The rules are
// the plan's (placement.js): the walls with the plinth, neighbours, structure and doors stop it; where it stops a
// red ghost shows the wanted spot and the HUD says why. A click selects; a click on the selected item opens it.
// R turns the selected item, Delete removes it (keys of the 3D view).
import * as THREE from 'three';
import { state, emit, select, isSelected, snapValue, getItem, rotateItem, removeItems } from '../state.js';
import { footprint } from '../geometry.js';
import { moveTo } from '../placement.js';
import { history } from '../history.js';
import { requestDraw } from '../renderer.js';
import { keysTo3d } from '../pane.js';
import { describe, toast } from '../ui.js';
import { placeItem } from './models3d.js';
import { getMode } from './controls3d.js';
import { clickAt } from './anim3d.js';

const START = 4;          // px before a press becomes a drag
const EMIT_MS = 90;       // the rest of the app (plan in split, lists) follows ~10 times a second
const GHOST = new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.28, depthWrite: false });
const GHOST_EDGE = new THREE.LineBasicMaterial({ color: 0xff6b6b });
const UNIT = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const UNIT_EDGES = new THREE.EdgesGeometry(UNIT);

let camera, canvas, hud, api;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3();
let press = null;         // { id, x, y, pointerId, wasSelected, drag: { off, origin } | null }
let ghost = null, lastEmit = 0, emitTimer = null;

/** api: { entries() → [{ id, group, shell, furniture }], active() → that of the active room, render() } */
export function initDrag(cam, dom, el, a) {
  camera = cam; canvas = dom; api = a;
  hud = el.querySelector('#anim3d');
  // Capture: runs before the orbit controls, which then do not see a press on furniture.
  canvas.addEventListener('pointerdown', down, { capture: true });
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  window.addEventListener('keydown', keys);
}

function setRay(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
}

const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };

// The nearest thing under the pointer; an item of the active room → its id (walls in front hide it).
function itemUnder(e) {
  const room = api.active();
  if (!room?.furniture) return null;
  setRay(e);
  const things = api.entries().flatMap(r => [r.shell?.group, r.furniture]).filter(Boolean);
  const h = ray.intersectObjects(things, true).find(x => shown(x.object) && !x.object.isLine);
  let o = h?.object;
  while (o && o.userData.itemId === undefined) o = o.parent;
  return o && o.parent === room.furniture ? o.userData.itemId : null;
}

function down(e) {
  if (getMode() === 'walk' || e.button > 0 || document.pointerLockElement) return;
  const id = itemUnder(e);
  if (id === null || !getItem(id)) return;
  e.stopImmediatePropagation();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* not an active pointer */ }
  press = { id, x: e.clientX, y: e.clientY, pointerId: e.pointerId, wasSelected: isSelected(id), drag: null };
  if (!press.wasSelected) select(id);
}

function begin(e) {
  const it = getItem(press.id), room = api.active();
  plane.set(new THREE.Vector3(0, 1, 0), -(it.elev || 0) / 100);
  setRay(e);
  if (!ray.ray.intersectPlane(plane, hit)) return false;
  const f = footprint(it), o = room.group.position;
  const cx = o.x + (it.x + f.w / 2) / 100, cz = o.z + (it.y + f.h / 2) / 100;
  press.drag = { off: { x: cx - hit.x, z: cz - hit.z }, origin: o.clone() };
  history.begin();
  canvas.style.cursor = 'grabbing';
  setShadows(false);
  return true;
}

function move(e) {
  if (!press) return hover(e);
  if (e.pointerId !== press.pointerId) return;
  if (!press.drag) {
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < START || !begin(e)) return;
  }
  const it = getItem(press.id);
  if (!it) return;
  setRay(e);
  if (!ray.ray.intersectPlane(plane, hit)) return;
  const f = footprint(it), { off, origin } = press.drag;
  const nx = snapValue((hit.x + off.x - origin.x) * 100 - f.w / 2);
  const ny = snapValue((hit.z + off.z - origin.z) * 100 - f.h / 2);
  const m = moveTo(it, nx, ny, state);
  showBlock(m.blocked ? { it, x: nx, y: ny, f, reason: m.reason } : null);
  if (m.x === it.x && m.y === it.y) return api.render();
  it.x = m.x; it.y = m.y;
  const obj = api.active().furniture.children.find(o => o.userData.itemId === it.id);
  if (obj) placeItem(obj, it);
  api.render();
  requestDraw();
  // The scene keeps the moved model (same look), so a rebuild here only refreshes checks and the plan.
  clearTimeout(emitTimer);
  const now = performance.now();
  if (now - lastEmit > EMIT_MS) { lastEmit = now; emit(); }
  else emitTimer = setTimeout(() => { lastEmit = performance.now(); emit(); }, EMIT_MS);
}

function up(e) {
  if (!press || e.pointerId !== press.pointerId) return;
  const p = press;
  press = null;
  canvas.style.cursor = '';
  if (!p.drag) {
    // A click: the first selects, the next one opens doors and drawers as before.
    if (p.wasSelected) clickAt(e);
    return;
  }
  clearTimeout(emitTimer);
  showBlock(null);
  setShadows(true);
  emit();
  history.end();     // the whole drag is one undo step
}

// Red ghost where the item was asked to go, the reason in the HUD.
function showBlock(b) {
  if (!b) {
    if (ghost) ghost.visible = false;
    if (hud.dataset.by === 'drag') { hud.hidden = true; delete hud.dataset.by; }
    return;
  }
  if (!ghost) {
    ghost = new THREE.Group();
    ghost.add(new THREE.Mesh(UNIT, GHOST), new THREE.LineSegments(UNIT_EDGES, GHOST_EDGE));
    ghost.renderOrder = 5;
  }
  const room = api.active();
  if (ghost.parent !== room.group) room.group.add(ghost);
  ghost.visible = true;
  ghost.scale.set(b.f.w / 100, b.it.h / 100, b.f.h / 100);
  ghost.position.set((b.x + b.f.w / 2) / 100, (b.it.elev || 0) / 100, (b.y + b.f.h / 2) / 100);
  hud.textContent = describe(b.reason);
  hud.dataset.by = 'drag';
  hud.hidden = false;
}

// Contact shadows stay where the item stood; hidden during the drag, rebuilt after it.
function setShadows(on) {
  for (const o of api.active()?.furniture?.children || []) if (o.userData.itemId === undefined) o.visible = on;
}

// A grab cursor over movable furniture (mouse only, a few times a second).
let hoverAt = 0;
function hover(e) {
  if (e.pointerType !== 'mouse' || getMode() === 'walk' || e.buttons) return;
  const now = performance.now();
  if (now - hoverAt < 60) return;
  hoverAt = now;
  canvas.style.cursor = itemUnder(e) !== null ? 'grab' : '';
}

function keys(e) {
  if (!keysTo3d() || getMode() === 'walk' || !canvas.offsetParent) return;
  if (e.target instanceof Element && e.target.closest('input, textarea, select, dialog')) return;
  const it = getItem(state.selectedId);
  if (!it) return;
  if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
    const r = rotateItem(it);
    if (!r.ok) toast(describe(r.reason), true);
  } else if (e.code === 'Delete' || e.code === 'Backspace') {
    removeItems([it.id, ...state.selectedIds]);
  } else return;
  e.preventDefault();
}
