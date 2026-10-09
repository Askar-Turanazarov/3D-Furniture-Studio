// "Photo textures (3D)" panel: apply / download the built-in CC0 set, upload own photos per surface.
import { t, onLangChange } from './i18n.js';
import { toast, escapeHtml } from './ui.js';

const SETS = ['floor', 'wall', 'wood', 'fabric'];
const MAX = 1024;          // uploaded photos are downsized to this many px
let custom = {};

export function initTextures() {
  document.getElementById('texApplyBtn').addEventListener('click', () => {
    applyPhoto();
    toast(t('tex.applied'));
  });
  render();
  refresh();
  onLangChange(render);
}

async function refresh() {
  try {
    const res = await fetch('/api/textures');
    if (res.ok) custom = (await res.json()).custom || {};
  } catch { /* offline: built-in only */ }
  render();
}

// Photo quality on: the 3D scene (if loaded) reloads now, otherwise on the next open.
function applyPhoto() {
  try { localStorage.setItem('fsp3d.quality', 'photo'); } catch { /* ignore */ }
  document.dispatchEvent(new Event('fsp3d:textures'));
  if (document.getElementById('view3d').hidden) document.getElementById('view3dBtn').click();
}

function render() {
  const list = document.getElementById('texList');
  list.innerHTML = SETS.map(s => {
    const own = custom[s];
    const src = own || `/textures/${s}/color.jpg`;
    return `<li class="tex-row">
      <img class="tex-thumb" src="${escapeHtml(src)}" alt="" loading="lazy">
      <div class="tex-info">
        <b>${escapeHtml(t('tex.' + s))}</b>
        <span class="tex-badge ${own ? 'own' : ''}">${escapeHtml(t(own ? 'tex.custom' : 'tex.builtin'))}</span>
      </div>
      <div class="tex-actions">
        <a class="btn sm" href="/textures/${s}/color.jpg" download="${s}-color.jpg" title="${escapeHtml(t('tex.download'))}">⬇</a>
        <label class="btn sm" title="${escapeHtml(t('tex.upload'))}">⬆<input type="file" accept="image/*" data-set="${s}" hidden></label>
        ${own ? `<button class="btn sm danger" data-reset="${s}" title="${escapeHtml(t('tex.reset'))}">↺</button>` : ''}
      </div>
    </li>`;
  }).join('');
  list.querySelectorAll('input[type=file]').forEach(inp => inp.addEventListener('change', () => {
    if (inp.files[0]) upload(inp.dataset.set, inp.files[0]);
  }));
  list.querySelectorAll('[data-reset]').forEach(b => b.addEventListener('click', () => reset(b.dataset.reset)));
}

// Downsize to ≤ 1024 px and re-encode as JPEG in the browser, then send the raw bytes.
async function toJpeg(file) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, MAX / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  img.close();
  return new Promise((ok, fail) => c.toBlob(b => (b ? ok(b) : fail()), 'image/jpeg', 0.9));
}

async function upload(set, file) {
  try {
    const blob = await toJpeg(file);
    const res = await fetch(`/api/texture/${set}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
    if (!res.ok) throw new Error(res.status);
    await refresh();
    applyPhoto();
    toast(t('tex.uploaded', { name: t('tex.' + set) }));
  } catch {
    toast(t('tex.fail'), true);
  }
}

async function reset(set) {
  try {
    await fetch(`/api/texture/${set}`, { method: 'DELETE' });
    await refresh();
    applyPhoto();
    toast(t('tex.resetDone'));
  } catch {
    toast(t('tex.fail'), true);
  }
}
