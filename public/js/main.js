import { t, initLangSwitcher, onLangChange } from './i18n.js';
import { state, onChange, emit, itemName } from './state.js';
import { findSpot } from './autoplace.js';
import { load, save } from './storage.js';
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
  await loadCatalog();
  load(state);
  fillCatalog();
  syncForms();
  onChange(update);
  onLangChange(() => { fillCatalog(); update(); });
  update();
}

start();
