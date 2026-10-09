import { t, initLangSwitcher, onLangChange } from './i18n.js';
import { state, onChange, emit, itemName, docFromState, applyDoc } from './state.js';
import { history } from './history.js';
import { findSpot } from './autoplace.js';
import { parseCatalog } from './catalog.js';
import { initProjects, persist } from './projects.js';
import { initProjectsDialog } from './projectsDialog.js';
import { initOrder } from './order.js';
import { initTextures } from './textures.js';
import { initSnapshot } from './snapshot.js';
import { initRenderer, requestDraw, setErrors as setDrawErrors, setObWarnings as setDrawObWarnings, setPassages as setDrawPassages } from './renderer.js';
import { validateAll, validateWarnings, obstacleWarnings } from './validate.js';
import { narrowPassages } from './passages.js';
import { clampOpening } from './openings.js';
import { fitObstacleHeight } from './obstacles.js';
import { initInteraction } from './interaction.js';
import { initUI, fillCatalog, syncForms, refresh, toast, describe, setErrors as setUiErrors, setWarnings, setObWarnings, setPassages } from './ui.js';

let lastH = null;   // full-height obstacles follow the ceiling

function update() {
  for (const o of state.openings) clampOpening(o, state.room);
  for (const o of state.obstacles) fitObstacleHeight(o, lastH ?? state.room.H, state.room);
  lastH = state.room.H;
  setWarnings(validateWarnings(state));
  const obWarn = obstacleWarnings(state);
  setObWarnings(obWarn);
  setDrawObWarnings(obWarn);
  const pass = narrowPassages(state);
  setPassages(pass);
  setDrawPassages(pass);
  const errors = validateAll(state);
  setDrawErrors(errors);
  setUiErrors(errors);
  requestDraw();
  refresh();
  persist();
  closeStaleField();
  history.record(snapshot());
  syncUndo();
}

// ---- undo / redo ----
// View toggles live in settings (saved with the room) but are not undo steps.
const VIEW_KEYS = ['showZones', 'showPassages'];
const snapshot = () => {
  const d = docFromState();
  for (const k of VIEW_KEYS) delete d.settings[k];
  return JSON.stringify(d);
};

function step(dir) {
  closeStaleField();
  const snap = dir < 0 ? history.undo() : history.redo();
  if (!snap) return;
  const view = Object.fromEntries(VIEW_KEYS.filter(k => k in state.settings).map(k => [k, state.settings[k]]));
  applyDoc(JSON.parse(snap));
  Object.assign(state.settings, view);
  syncForms();
  emit();
  toast(t(dir < 0 ? 'hist.undone' : 'hist.redone'));
}

function syncUndo() {
  document.getElementById('undoBtn').disabled = !history.canUndo();
  document.getElementById('redoBtn').disabled = !history.canRedo();
}

// Editing one field (all its keystrokes) is a single step: focus opens it, blur closes it.
let field = null;
function closeStaleField() {
  if (field && document.activeElement !== field) { field = null; history.end(); }
}

function initHistory() {
  history.setSource(snapshot);
  document.getElementById('undoBtn').addEventListener('click', () => step(-1));
  document.getElementById('redoBtn').addEventListener('click', () => step(1));
  window.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
    if (e.code === 'KeyZ') step(e.shiftKey ? 1 : -1);
    else if (e.code === 'KeyY') step(1);
    else return;
    e.preventDefault();
  });
  const sidebar = document.querySelector('.sidebar') || document.body;
  const open = e => {
    if (!e.target.matches('input, select') || field === e.target) return;
    if (field) history.end();
    field = e.target;
    history.begin();
  };
  sidebar.addEventListener('focusin', open);
  sidebar.addEventListener('input', open, true);   // capture: before the form handler changes state
  sidebar.addEventListener('focusout', e => {
    if (e.target !== field) return;
    field = null;
    history.end();
  });
}

// Move the item to the first free spot and flash it green, or explain why not.
function autoPlace(item) {
  const res = findSpot(item, state);
  if (res.ok) {
    Object.assign(item, { x: res.x, y: res.y, rot: res.rot });
    state.found = { id: item.id, until: performance.now() + 2000 };
    state.selectedId = item.id;
    emit();
    toast(t(res.soft ? 'auto.foundSoft' : 'auto.found', { name: itemName(item) }), res.soft);
  } else {
    emit();
    toast(describe(res), true);
  }
}

// 2D plan ⇄ 3D scene (the 3D module is loaded on first use).
let view3d = null;
async function setView(mode) {
  const is3d = mode === '3d';
  document.getElementById('view2dBtn').classList.toggle('active', !is3d);
  document.getElementById('view3dBtn').classList.toggle('active', is3d);
  document.getElementById('view3d').hidden = !is3d;
  document.querySelector('.stage').classList.toggle('is3d', is3d);
  if (is3d) {
    view3d ??= await import('./3d/scene3d.js');
    view3d.show(document.getElementById('view3d'));
  } else if (view3d) {
    view3d.hide();
    requestDraw();
  }
}

function initViewSwitch() {
  const wrap = document.getElementById('stageBody');
  document.getElementById('view2dBtn').addEventListener('click', () => setView('2d'));
  document.getElementById('view3dBtn').addEventListener('click', () => setView('3d'));
  document.getElementById('fullscreenBtn').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrap.requestFullscreen?.().catch(() => {});
  });
  document.getElementById('exitFsBtn').addEventListener('click', () => document.exitFullscreen());
  document.addEventListener('fullscreenchange', () => {
    document.getElementById('exitFsBtn').hidden = !document.fullscreenElement;
  });
}

async function loadCatalog() {
  try {
    const res = await fetch('/api/catalog');
    if (!res.ok) throw new Error(res.status);
    const c = parseCatalog(await res.json());
    state.catalog = c.items;
    state.materials = c.materials;
    state.pricing = c.pricing;
  } catch {
    toast(t('catalog.fail'), true);
  }
}

async function start() {
  initLangSwitcher();
  initRenderer(document.getElementById('plan'), document.getElementById('canvasWrap'));
  initInteraction(document.getElementById('plan'));
  initUI({ autoPlace });
  initOrder();
  initViewSwitch();
  initTextures();
  initHistory();
  initSnapshot();
  await loadCatalog();
  initProjects();
  initProjectsDialog();
  fillCatalog();
  syncForms();
  onChange(update);
  onLangChange(() => { fillCatalog(); update(); });
  update();
}

start();
