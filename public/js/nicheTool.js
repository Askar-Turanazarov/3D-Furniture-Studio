// "📐 Fill a niche" mode: hover shows a ghost of the largest wardrobe along the nearest wall,
// a click fixes it, the panel offers sliding / hinged doors with the price, "Apply" adds it (one undo step).
import { state, emit } from './state.js';
import { t } from './i18n.js';
import { largestFit } from './autoplace.js';
import { overlay, requestDraw } from './renderer.js';
import { openSpec } from './zones.js';
import { slideDoors } from './config.js';
import { estimate } from './pricing.js';
import { priceCatalog, fmtSum } from './pricePanel.js';
import { toast } from './ui.js';
import { toggleRuler } from './interaction.js';

const $ = id => document.getElementById(id);
export const niche = { active: false, fixed: false, fit: null };
let canvas = null;

export function initNiche(cv) {
  canvas = cv;
  $('nicheBtn').addEventListener('click', () => toggleNiche());
  $('nicheCancel').addEventListener('click', () => unfix());
  $('nicheApply').addEventListener('click', apply);
  $('nichePanel').addEventListener('change', renderPanel);
  canvas.addEventListener('pointerleave', () => { if (niche.active && !niche.fixed) show(null); });
}

export function toggleNiche(on = !niche.active) {
  if (on === niche.active) return;
  niche.active = on;
  niche.fixed = false;
  show(null);
  if (on) { toggleRuler(false); toast(t('niche.on')); }
  canvas.style.cursor = on ? 'crosshair' : 'default';
  $('nicheBtn').classList.toggle('active', on);
}

// Esc: first drop the fixed proposal, then leave the mode.
export function nicheEscape() {
  if (niche.fixed) unfix(); else toggleNiche(false);
}

export function nicheHover(wx, wy) {
  if (niche.fixed) return;
  const fit = largestFit({ x: wx, y: wy }, state);
  show(fit.ok ? fit : null);
}

export function nicheClick(wx, wy) {
  const fit = largestFit({ x: wx, y: wy }, state);
  if (!fit.ok) { niche.fixed = false; show(null); return toast(t(fit.key, fit.params), true); }
  niche.fixed = true;
  show(fit);
}

function unfix() {
  niche.fixed = false;
  show(null);
}

function show(fit) {
  niche.fit = fit;
  overlay.niche = fit && fit.item;
  $('nichePanel').hidden = !(fit && niche.fixed);
  if (fit && niche.fixed) renderPanel();
  requestDraw();
}

const kind = () => $('nichePanel').querySelector('input[name="nicheKind"]:checked')?.value || 'slide';

function candidate(k = kind()) {
  const base = { type: 'wardrobe', ...niche.fit.item };
  const doors = k === 'slide' ? slideDoors(base) : openSpec({ ...base, open: { kind: 'swing' } }, state.catalog).doors;
  return { ...base, open: { kind: k, doors } };
}

function renderPanel() {
  if (!niche.fit) return;
  const { w, d, h } = niche.fit.item;
  const e = estimate(candidate(), priceCatalog());
  $('nicheInfo').textContent = t('niche.info', { w, d, h, free: niche.fit.free }) + (e ? ` · ≈ ${fmtSum(e.total)}` : '');
  $('nicheSlide').textContent = t('niche.slide', { n: candidate('slide').open.doors });
  $('nicheSwing').textContent = t('niche.swing', { n: candidate('swing').open.doors });
}

function apply() {
  if (!niche.fit) return;
  const c = state.catalog.find(c => c.type === 'wardrobe');
  const it = { id: state.seq++, ...candidate(), color: c ? c.color : '#8d6e63' };
  state.items.push(it);
  state.selectedId = it.id;
  state.selectedIds.clear();
  toggleNiche(false);
  emit();
  toast(t('niche.done', { w: it.w, d: it.d, h: it.h }));
}
