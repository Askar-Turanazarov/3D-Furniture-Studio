// Material swatches of the selected item: body (or the whole item), facade, own colour.
import { state, emit, selected } from './state.js';
import { t, getLang } from './i18n.js';
import { hasFacade, setItemMaterial, setItemColor } from './materials.js';

const $ = id => document.getElementById(id);
const matName = m => m.name[getLang()] || m.name.ru;

export function initMatPanel() {
  $('matBox').addEventListener('click', e => {
    const b = e.target.closest('[data-mat]');
    const it = selected();
    if (!b || !it) return;
    const role = b.closest('[data-role]').dataset.role;
    setItemMaterial(it, role, state.materials.find(m => m.id === b.dataset.mat) || null);
    emit();
  });
  // 'change', not 'input': dragging in the colour picker would make a history step per pixel.
  $('itemColor').addEventListener('change', e => {
    const it = selected();
    if (!it) return;
    setItemColor(it, e.target.value);
    emit();
  });
}

export function renderMatPanel(it) {
  const facade = hasFacade(it, state.catalog);
  $('matBox').hidden = !state.materials.length;
  $('matBodyLbl').textContent = t(facade ? 'mat.body' : 'mat.material');
  $('matFacadeRow').hidden = !facade;
  for (const box of $('matBox').querySelectorAll('[data-role]')) {
    const role = box.dataset.role;
    const cur = it.materials?.[role] || '';
    // facade: "—" = same as the body
    const list = role === 'facade' ? [null, ...state.materials] : state.materials;
    const key = getLang() + list.map(m => m?.id).join();
    if (box.dataset.key !== key) {
      box.dataset.key = key;
      box.replaceChildren(...list.map(m => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = m ? `swatch k-${m.kind}` : 'swatch none';
        b.dataset.mat = m ? m.id : '';
        b.title = m ? matName(m) : t('mat.asBody');
        if (m) b.style.backgroundColor = m.color; else b.textContent = '—';
        return b;
      }));
    }
    box.querySelectorAll('[data-mat]').forEach(b => b.classList.toggle('active', b.dataset.mat === cur));
  }
  const inp = $('itemColor');
  if (document.activeElement !== inp) inp.value = /^#[0-9a-f]{6}$/i.test(it.color) ? it.color : '#90a4ae';
}
