// "Compare with…": this apartment and one of its variants side by side, read-only (same renderer, own canvases).
import { state } from './state.js';
import { t, onLangChange } from './i18n.js';
import { currentProject, persist } from './projects.js';
import { flushSave, variantsOf, loadProject } from './storage.js';
import { drawPlanTo } from './renderer.js';
import { validateApartment, apartmentHasErrors, apartmentArea } from './apartment.js';
import { roomEstimate } from './pricing.js';
import { priceCatalog, fmtSum } from './pricePanel.js';

const $ = id => document.getElementById(id);

export function initCompare() {
  $('compareSel').addEventListener('change', render);
  $('compareClose').addEventListener('click', () => $('compareDlg').close());
  window.addEventListener('resize', () => { if ($('compareDlg').open) render(); });
  onLangChange(() => { if ($('compareDlg').open) render(); });
}

export function openCompare() {
  persist();   // the open apartment in storage must be fresh
  flushSave();
  const p = currentProject();
  const others = variantsOf(p.id).filter(v => v.id !== p.id);
  if (!others.length) return;
  $('compareSel').replaceChildren(...others.map(v => new Option(v.name, v.id)));
  $('compareDlg').showModal();
  render();
}

function render() {
  const p = currentProject();
  const other = loadProject($('compareSel').value);
  $('compareLeftName').textContent = p.name;
  draw($('compareLeft'), $('compareLeftInfo'), p);
  if (other) draw($('compareRight'), $('compareRightInfo'), other);
}

function draw(canvas, info, apt) {
  const w = canvas.parentElement.clientWidth || 360, h = Math.round(Math.min(420, w * 0.75));
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const v = validateApartment({ ...apt, catalog: state.catalog, materials: state.materials, pricing: state.pricing });
  drawPlanTo(canvas, w, h, { apartment: apt, errors: v.rooms, dpr: window.devicePixelRatio || 1, pad: 24 });
  const bad = [...v.rooms.values()].reduce((s, m) => s + [...m.values()].filter(e => e.length).length, 0);
  const items = apt.rooms.reduce((s, r) => s + r.items.length, 0);
  const sum = apt.rooms.reduce((s, r) => s + roomEstimate(r.items, priceCatalog()).total, 0);
  info.textContent = [
    `${t('apt.rooms', { n: apt.rooms.length })} · ${apartmentArea(apt.rooms).toFixed(1)} ${t('unit.m2')}`,
    t('cmp.items', { n: items }),
    bad ? t('cmp.bad', { n: bad }) : v.overlaps.length ? t('apt.overlapShort') : t('cmp.ok'),
    sum ? t('price.from', { sum: fmtSum(sum) }) : ''
  ].filter(Boolean).join(' · ');
  info.classList.toggle('bad', apartmentHasErrors(v));
}
