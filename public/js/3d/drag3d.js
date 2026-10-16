// Moving furniture and ceiling lights in the 3D overview: press an item of the active room and drag it over the
// floor, or a light and drag it along the ceiling. The rules are the plan's: furniture follows placement.js (the
// walls with the plinth, neighbours, structure and doors stop it), a light stays off the walls and a hanging one off
// a door swing (state.moveFixture). Where it stops a red ghost shows the wanted spot and the HUD says why.
// A click selects; a click on the selected item opens it. R turns the item (another kind of light), Delete removes.
import * as THREE from 'three';
import { state, emit, select, isSelected, snapValue, getItem, rotateItem, removeItems,
  getFixture, ownFixture, selectFixture, moveFixture, removeFixture, cycleFixture } from '../state.js';
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
const HANG = { chandelier: 0.5, pendant: 0.7, spot: 0, panel: 0 };   // m under the ceiling
const GHOST = new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.28, depthWrite: false });
const GHOST_EDGE = new THREE.LineBasicMaterial({ color: 0xff6b6b });
const UNIT = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const UNIT_EDGES = new THREE.EdgesGeometry(UNIT);

let camera, canvas, hud, api;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3();
// { what: 'item' | 'fixture', id, x, y, pointerId, wasSelected, drag: { off, origin } | null, target }
let press = null;
let ghost = null, lastEmit = 0, emitTimer = null;

/** api: { entries() → [{ id, group, doc, shell, furniture, lights }], active() → that of the active room, render() } */
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

// The nearest thing under the pointer in the active room: { what, id } (walls in front hide it).
function under(e) {
  const room = api.active();
  if (!room?.furniture) return null;
  setRay(e);
  const things = api.entries().flatMap(r => [r.shell?.group, r.furniture, r.lights]).filter(Boolean);
  const h = ray.intersectObjects(things, true).find(x => shown(x.object) && !x.object.isLine);
  for (let o = h?.object; o; o = o.parent) {
    if (o.userData.itemId !== undefined) return o.parent === room.furniture ? { what: 'item', id: o.userData.itemId } : null;
    if (o.userData.fixtureId !== undefined) return o.parent === room.lights ? { what: 'fixture', id: o.userData.fixtureId } : null;
  }
  return null;
}

const isSel = t => t.what === 'item' ? isSelected(t.id) : state.selectedFixture === t.id;

function down(e) {
  if (getMode() === 'walk' || e.button > 0 || document.pointerLockElement) return;
  const t = under(e);
  if (!t || !(t.what === 'item' ? getItem(t.id) : getFixture(t.id))) return;
  e.stopImmediatePropagation();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* not an active pointer */ }
  press = { ...t, x: e.clientX, y: e.clientY, pointerId: e.pointerId, wasSelected: isSel(t), drag: null, target: null };
  if (!press.wasSelected) t.what === 'item' ? select(t.id) : selectFixture(t.id);
}

function begin(e) {
  const room = api.active(), o = room.group.position, H = room.doc.room.H / 100;
  let cx, cz, y;
  if (press.what === 'item') {
    const it = getItem(press.id), f = footprint(it);
    y = (it.elev || 0) / 100;
    cx = o.x + (it.x + f.w / 2) / 100; cz = o.z + (it.y + f.h / 2) / 100;
  } else {
    const f = getFixture(press.id);
    y = H - HANG[f.kind];
    cx = o.x + f.x / 100; cz = o.z + f.y / 100;
  }
  plane.set(new THREE.Vector3(0, 1, 0), -y);
  setRay(e);
  if (!ray.ray.intersectPlane(plane, hit)) return false;
  press.drag = { off: { x: cx - hit.x, z: cz - hit.z }, origin: o.clone() };
  history.begin();
  canvas.style.cursor = 'grabbing';
  if (press.what === 'item') setShadows(false);
  return true;
}

function move(e) {
  if (!press) return hover(e);
  if (e.pointerId !== press.pointerId) return;
  if (!press.drag) {
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < START || !begin(e)) return;
  }
  setRay(e);
  if (!ray.ray.intersectPlane(plane, hit)) return;
  const { off, origin } = press.drag;
  const cx = (hit.x + off.x - origin.x) * 100, cy = (hit.z + off.z - origin.z) * 100;
  if (press.what === 'fixture') return moveLight(cx, cy);
  const it = getItem(press.id);
  if (!it) return;
  const f = footprint(it);
  const nx = snapValue(cx - f.w / 2), ny = snapValue(cy - f.h / 2);
  const m = moveTo(it, nx, ny, state);
  showBlock(m.blocked ? { x: nx, y: ny, w: f.w, d: f.h, h: it.h, elev: it.elev || 0, reason: m.reason } : null);
  if (m.x === it.x && m.y === it.y) return api.render();
  it.x = m.x; it.y = m.y;
  const obj = api.active().furniture.children.find(o => o.userData.itemId === it.id);
  if (obj) placeItem(obj, it);
  api.render();
  requestDraw();
  // The scene keeps the moved model (same look), so a rebuild here only refreshes checks and the plan.
  throttle(emit);
}

// A light is rebuilt with its room's lamps on every step: a few steps a second are enough.
function moveLight(x, y) {
  press.target = { x, y };
  const id = press.id;
  throttle(() => stepLight(id, x, y));
}

function stepLight(id, x, y) {
  const f = ownFixture(id);
  if (!f) return;
  const m = moveFixture(f, x, y);
  const H = api.active().doc.room.H;
  showBlock(m.ok ? null : { x: m.x - 25, y: m.y - 25, w: 50, d: 50, h: 12, elev: H - HANG[f.kind] * 100 - 6, reason: m.reason });
  api.render();
}

function throttle(fn) {
  clearTimeout(emitTimer);
  const now = performance.now();
  if (now - lastEmit > EMIT_MS) { lastEmit = now; fn(); }
  else emitTimer = setTimeout(() => { lastEmit = performance.now(); fn(); }, EMIT_MS);
}

function up(e) {
  if (!press || e.pointerId !== press.pointerId) return;
  const p = press;
  press = null;
  canvas.style.cursor = '';
  if (!p.drag) {
    // A click: the first selects, the next one opens doors and drawers as before.
    if (p.wasSelected && p.what === 'item') clickAt(e);
    return;
  }
  clearTimeout(emitTimer);
  if (p.what === 'fixture') {
    if (p.target) stepLight(p.id, p.target.x, p.target.y);
  } else {
    setShadows(true);
    emit();
  }
  showBlock(null);
  history.end();     // the whole drag is one undo step
}

// Red ghost where the thing was asked to go (cm of the room), the reason in the HUD.
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
  ghost.scale.set(b.w / 100, b.h / 100, b.d / 100);
  ghost.position.set((b.x + b.w / 2) / 100, b.elev / 100, (b.y + b.d / 2) / 100);
  hud.textContent = describe(b.reason);
  hud.dataset.by = 'drag';
  hud.hidden = false;
}

// Contact shadows stay where the item stood; hidden during the drag, rebuilt after it.
function setShadows(on) {
  for (const o of api.active()?.furniture?.children || []) if (o.userData.itemId === undefined) o.visible = on;
}

// A grab cursor over movable furniture and lights (mouse only, a few times a second).
let hoverAt = 0;
function hover(e) {
  if (e.pointerType !== 'mouse' || getMode() === 'walk' || e.buttons) return;
  const now = performance.now();
  if (now - hoverAt < 60) return;
  hoverAt = now;
  canvas.style.cursor = under(e) ? 'grab' : '';
}

function keys(e) {
  if (!keysTo3d() || getMode() === 'walk' || !canvas.offsetParent || e.ctrlKey || e.metaKey) return;
  if (e.target instanceof Element && e.target.closest('input, textarea, select, dialog')) return;
  const del = e.code === 'Delete' || e.code === 'Backspace';
  const f = getFixture(state.selectedFixture);
  if (f) {
    if (e.code === 'KeyR') cycleFixture(ownFixture(f.id));
    else if (del) removeFixture(f.id);
    else return;
    return e.preventDefault();
  }
  const it = getItem(state.selectedId);
  if (!it) return;
  if (e.code === 'KeyR') {
    const r = rotateItem(it);
    if (!r.ok) toast(describe(r.reason), true);
  } else if (del) {
    removeItems([it.id, ...state.selectedIds]);
  } else return;
  e.preventDefault();
}
