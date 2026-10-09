import { t, initLangSwitcher, onLangChange } from './i18n.js';
import { state, onChange, emit, itemName } from './state.js';
import { findSpot } from './autoplace.js';
import { load, save } from './storage.js';
import { initOrder } from './order.js';
import { initTextures } from './textures.js';
import { initRenderer, requestDraw, setErrors as setDrawErrors } from './renderer.js';
import { validateAll } from './validate.js';
import { initInteraction } from './interaction.js';
import { initUI, fillCatalog, syncForms, refresh, toast, describe, setErrors as setUiErrors } from './ui.js';

function update() {
  const errors = validateAll(state);
  setDrawErrors(errors);
  setUiErrors(errors);
  requestDraw();
  refresh();
  save(state);
}

// Move the item to the first free spot and flash it green, or explain why not.
function autoPlace(item) {
  const res = findSpot(item, state);
  if (res.ok) {
    Object.assign(item, { x: res.x, y: res.y, rot: res.rot });
    state.found = { id: item.id, until: performance.now() + 2000 };
    state.selectedId = item.id;
    emit();
    toast(t('auto.found', { name: itemName(item) }));
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
    state.catalog = await res.json();
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
  await loadCatalog();
  load(state);
  fillCatalog();
  syncForms();
  onChange(update);
  onLangChange(() => { fillCatalog(); update(); });
  update();
}

start();
