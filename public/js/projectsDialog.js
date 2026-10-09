// "Projects" dialog: open, create, rename, duplicate, delete, export / import a project file.
import { t, getLang } from './i18n.js';
import {
  listProjects, loadProject, saveProjectNow, deleteProject, cloneProject, exportProject, importProject, flushSave
} from './storage.js';
import { currentProject, openProject, newProject, closeProject, persist, capturePreview, renderTabs } from './projects.js';
import { toast } from './ui.js';

const $ = id => document.getElementById(id);
const LOCALE = { ru: 'ru-RU', uz: 'uz-UZ', en: 'en-GB' };

export function initProjectsDialog() {
  $('projectsBtn').addEventListener('click', show);
  $('projName').addEventListener('click', show);
  $('projClose').addEventListener('click', () => $('projectsDlg').close());
  $('projNew').addEventListener('click', () => {
    newProject();
    $('projectsDlg').close();
  });
  $('projImport').addEventListener('click', () => $('projFile').click());
  $('projFile').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 5e6) throw new Error('too big');
      const p = importProject(JSON.parse(await file.text()));
      if (!saveProjectNow(p, { last: false })) return;
      openProject(p);
      $('projectsDlg').close();
      toast(t('proj.imported', { name: p.name }));
    } catch {
      toast(t('proj.badFile'), true);
    }
  });
  $('projGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    const card = e.target.closest('[data-id]');
    if (!card || e.target.closest('input')) return;
    act(b ? b.dataset.act : 'open', card.dataset.id, card);
  });
}

function show() {
  capturePreview();
  persist();
  flushSave();
  render();
  if (!$('projectsDlg').open) $('projectsDlg').showModal();
}

// The open project is edited in memory (persist() would overwrite a loaded copy).
const get = id => (id === currentProject()?.id ? currentProject() : loadProject(id));

function render() {
  const cur = currentProject()?.id;
  const fmt = ts => new Date(ts).toLocaleString(LOCALE[getLang()] || undefined, { dateStyle: 'medium', timeStyle: 'short' });
  $('projGrid').replaceChildren(...listProjects().map(e => {
    const p = get(e.id);
    const card = document.createElement('div');
    card.className = 'proj-card' + (e.id === cur ? ' current' : '');
    card.dataset.id = e.id;
    const img = document.createElement(p?.preview ? 'img' : 'div');
    img.className = 'proj-preview';
    if (p?.preview) { img.src = p.preview; img.alt = ''; } else img.textContent = '▦';
    const name = document.createElement('div');
    name.className = 'proj-title';
    name.textContent = e.name;
    const meta = document.createElement('div');
    meta.className = 'proj-meta';
    meta.textContent = `${t('proj.rooms', { n: e.rooms })} · ${fmt(e.updatedAt)}` + (e.id === cur ? ` · ${t('proj.current')}` : '');
    const tools = document.createElement('div');
    tools.className = 'proj-tools';
    for (const [a, icon, key] of [['rename', '✎', 'proj.rename'], ['dup', '⧉', 'proj.duplicate'], ['export', '⬇', 'proj.export'], ['delete', '✕', 'proj.delete']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn icon' + (a === 'delete' ? ' danger' : '');
      b.dataset.act = a;
      b.title = t(key);
      b.textContent = icon;
      tools.append(b);
    }
    card.append(img, name, meta, tools);
    return card;
  }));
}

function act(a, id, card) {
  const p = get(id);
  if (!p) return render();
  if (a === 'open') {
    if (id !== currentProject()?.id) openProject(p);
    $('projectsDlg').close();
  } else if (a === 'rename') {
    rename(p, card.querySelector('.proj-title'));
  } else if (a === 'dup') {
    const c = cloneProject(p, t('proj.copyName', { name: p.name }));
    if (saveProjectNow(c, { last: false })) render();
  } else if (a === 'export') {
    download(p);
  } else if (a === 'delete') {
    if (!confirm(t('proj.confirmDelete', { name: p.name }))) return;
    if (id === currentProject()?.id) {
      closeProject();
      deleteProject(id);
      const next = listProjects().map(e => loadProject(e.id)).find(Boolean);
      if (next) openProject(next); else newProject();
    } else deleteProject(id);
    render();
  }
}

function rename(p, el) {
  const inp = document.createElement('input');
  inp.value = p.name;
  inp.maxLength = 100;
  inp.className = 'proj-title-input';
  el.replaceWith(inp);
  inp.focus();
  inp.select();
  let done = false;
  const finish = save => {
    if (done) return;
    done = true;
    const v = inp.value.trim();
    if (save && v && v !== p.name) {
      p.name = v;
      saveProjectNow(p, { last: p === currentProject() });
      if (p === currentProject()) renderTabs();
    }
    render();
  };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
  });
  inp.addEventListener('blur', () => finish(true));
}

function download(p) {
  const blob = new Blob([JSON.stringify(exportProject(p), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (p.name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'project') + '.fsp3d.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
