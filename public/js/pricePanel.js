// Configurator (sections, drawers) and the price estimate of the selected item and the whole room.
// Prices are TEST values from catalog.json → pricing.
import { state, emit, selected } from './state.js';
import { t } from './i18n.js';
import { estimate, roomEstimate } from './pricing.js';
import { CONFIG, sectionCount, drawerCount } from './config.js';
import { plateExtras } from './snapshot.js';

const $ = id => document.getElementById(id);

export const priceCatalog = () => ({ items: state.catalog, materials: state.materials, pricing: state.pricing });
// 4 850 000 сум — groups by a no-break space (toLocaleString('uz-UZ') gives commas in some browsers).
export const fmtSum = v => `${String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')} ${t('unit.sum')}`;

export function initPricePanel() {
  // 'change': one history step per edit, not per keystroke.
  $('cfgBox').addEventListener('change', e => {
    const it = selected(), c = it && CONFIG[it.type];
    if (!c) return;
    const key = e.target.name, range = c[key];
    if (!range) return;
    const v = Math.round(Number(e.target.value));
    if (Number.isFinite(v) && e.target.value !== '') it[key] = Math.max(range[0], Math.min(range[1], v));
    else delete it[key];
    emit();
  });
  plateExtras.push(() => {
    const r = roomEstimate(state.items, priceCatalog());
    return r.total > 0 && t('price.from', { sum: fmtSum(r.total) });
  });
}

export function renderPricePanel(it) {
  const c = CONFIG[it.type];
  $('cfgBox').hidden = !c;
  if (c) {
    const f = $('cfgBox').elements;
    for (const [key, count] of [['sections', sectionCount], ['drawers', drawerCount]]) {
      const range = c[key];
      f[key].closest('label').hidden = !range;
      if (!range) continue;
      f[key].min = range[0];
      f[key].max = range[1];
      if (document.activeElement !== f[key]) f[key].value = count(it);
    }
  }
  const e = estimate(it, priceCatalog()), line = $('itemPrice');
  line.textContent = e ? '≈ ' + fmtSum(e.total) : t('price.none');
  line.title = e ? e.lines.map(l => `${t('price.l.' + l.key)}: ${fmtSum(l.sum)}`).join('\n') : '';
  line.classList.toggle('muted', !e);
}

export function renderPriceTotal() {
  const r = roomEstimate(state.items, priceCatalog()), box = $('priceTotal');
  box.hidden = !r.total;
  if (!r.total) return;
  box.innerHTML = `<b>${t('price.total', { sum: fmtSum(r.total) })}</b>`
    + (r.skipped ? `<br><span>${t('price.skipped', { n: r.skipped })}</span>` : '')
    + `<br><span>${t('price.note')}</span>`;
}
