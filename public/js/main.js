import { t, initLangSwitcher, onLangChange } from './i18n.js';
import { state, onChange } from './state.js';
import { initRenderer, requestDraw, setErrors as setDrawErrors } from './renderer.js';
import { validateAll } from './validate.js';
import { initInteraction } from './interaction.js';
import { initUI, fillCatalog, syncForms, refresh, toast, setErrors as setUiErrors } from './ui.js';

function update() {
  const errors = validateAll(state);
  setDrawErrors(errors);
  setUiErrors(errors);
  requestDraw();
  refresh();
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
  initUI({ autoPlace: () => {} });
  await loadCatalog();
  fillCatalog();
  syncForms();
  onChange(update);
  onLangChange(() => { fillCatalog(); update(); });
  update();
}

start();
