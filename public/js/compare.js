// "Compare with…": two rooms of the project side by side, read-only (same renderer, own canvases).
import { state } from './state.js';
import { t, onLangChange } from './i18n.js';
import { currentProject, persist } from './projects.js';
import { versionGroup } from './storage.js';
import { drawPlanTo } from './renderer.js';
import { validateAll } from './validate.js';
import { roomEstimate } from './pricing.js';
import { priceCatalog, fmtSum } from './pricePanel.js';

const $ = id => document.getElementById(id);
let leftId = null;

export function initCompare() {
  $('compareSel').addEventListener('change', render);
  $('compareClose').addEventListener('click', () => $('compareDlg').close());
  window.addEventListener('resize', () => { if ($('compareDlg').open) render(); });
  onLangChange(() => { if ($('compareDlg').open) render(); });
}

export function openCompare(id) {
  persist();   // the current room's doc in the project must be fresh
  const p = currentProject(), left = p.rooms.find(r => r.id === id);
  const others = p.rooms.filter(r => r !== left);
  if (!others.length) return;
  leftId = id;
  // By default: another variant of the same room, else the next room.
  const sibling = versionGroup(p, left).find(r => r !== left);
  const next = p.rooms[(p.rooms.indexOf(left) + 1) % p.rooms.length];
  $('compareSel').replaceChildren(...others.map(r => new Option(r.name, r.id)));
  $('compareSel').value = (sibling || next).id;
  $('compareDlg').showModal();
  render();
}

function render() {
  const p = currentProject();
  const left = p.rooms.find(r => r.id === leftId), right = p.rooms.find(r => r.id === $('compareSel').value);
  $('compareLeftName').textContent = left.name;
  draw($('compareLeft'), $('compareLeftInfo'), left);
  draw($('compareRight'), $('compareRightInfo'), right);
}

function draw(canvas, info, doc) {
  const w = canvas.parentElement.clientWidth || 360, h = Math.round(Math.min(420, w * 0.75));
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = { ...doc, catalog: state.catalog };
  const errors = validateAll(ctx);
  drawPlanTo(canvas, w, h, { doc, errors, dpr: window.devicePixelRatio || 1, pad: 36 });
  const bad = [...errors.values()].filter(e => e.length).length;
  const { L, W } = doc.room, sum = roomEstimate(doc.items, priceCatalog()).total;
  info.textContent = [
    `${L}×${W} ${t('unit.cm')} · ${(L * W / 10000).toFixed(1)} ${t('unit.m2')}`,
    t('cmp.items', { n: doc.items.length }),
    bad ? t('cmp.bad', { n: bad }) : t('cmp.ok'),
    sum ? t('price.from', { sum: fmtSum(sum) }) : ''
  ].filter(Boolean).join(' · ');
  info.classList.toggle('bad', !!bad);
}
