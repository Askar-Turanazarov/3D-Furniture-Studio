// "🎲 Furnish" menu: the active room or the whole apartment from a random kit of each room's purpose.
// An empty target is furnished in place (one undo step); otherwise a new apartment variant is made
// and its rooms are refurnished, so the original stays as it was.
import { state, emit, onChange, syncActive, itemName } from './state.js';
import { roomView as aptRoomView } from './apartment.js';
import { furnish, kitsFor } from './furnish.js';
import { createVariant, PURPOSES } from './projects.js';
import { t, onLangChange } from './i18n.js';
import { toast } from './ui.js';

const $ = id => document.getElementById(id);

// Purposes that have furniture kits (the others — "other" — cannot be furnished).
const FURNISHABLE = PURPOSES.filter(p => kitsFor(p).length);

export function initFurnish() {
  $('furnishBtn').addEventListener('click', e => openMenu(e.currentTarget));
  $('furnishMenu').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    closeMenu();
    // A room without a purpose: the chosen one is set and the room furnished at once.
    if (b.dataset.purpose) { setPurpose(state.activeRoomId, b.dataset.purpose); return furnishRooms([state.activeRoomId]); }
    furnishRooms(b.dataset.act === 'apt' ? state.rooms.map(r => r.id) : [state.activeRoomId]);
  });
  initPurposeSelect();
  document.addEventListener('pointerdown', e => {
    if (!$('furnishMenu').hidden && !e.target.closest('#furnishMenu, #furnishBtn')) closeMenu();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
}

function openMenu(anchor) {
  const m = $('furnishMenu');
  if (!m.hidden) return closeMenu();
  const r = syncActive();
  const noKits = !r || !kitsFor(r.purpose, r.room).length;
  m.querySelector('[data-act="room"]').textContent = t('furn.room', { name: r?.name || '' });
  m.querySelector('[data-act="room"]').hidden = noKits;
  m.querySelector('[data-act="apt"]').hidden = state.rooms.length < 2;
  $('furnPurpose').hidden = !noKits;
  if (noKits) $('furnPurposeList').replaceChildren(...FURNISHABLE.map(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.purpose = p;
    b.textContent = t('purpose.' + p);
    return b;
  }));
  m.hidden = false;
  const a = anchor.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(a.left, window.innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = a.bottom + 4 + 'px';
}

function closeMenu() { $('furnishMenu').hidden = true; }

function setPurpose(id, purpose) {
  const r = state.rooms.find(x => x.id === id);
  if (!r || r.purpose === purpose) return;
  r.purpose = purpose;
  emit();
}

// "Purpose" in the room panel: what the room is for (the kits of "Furnish", the room names on the plan).
function initPurposeSelect() {
  const sel = $('roomPurpose');
  const fill = () => sel.replaceChildren(...['', ...PURPOSES].map(p => new Option(p ? t('purpose.' + p) : '—', p)));
  const sync = () => { sel.value = syncActive()?.purpose || ''; };
  fill();
  sync();
  onLangChange(() => { fill(); sync(); });
  onChange(sync);
  sel.addEventListener('change', () => setPurpose(state.activeRoomId, sel.value));
}

/** Furnish the given rooms (ids); rooms without kits for their purpose are left as they are. */
export function furnishRooms(ids) {
  syncActive();
  const targets = ids.map(id => state.rooms.find(r => r.id === id))
    .filter(r => r && kitsFor(r.purpose, r.room).length);
  // A variant copy gets new room ids: remember the places in the room list.
  const at = targets.map(r => state.rooms.indexOf(r));
  if (!targets.length) return toast(t('furn.noKits'), true);
  let note = '';
  if (targets.some(r => r.items.length)) {
    const v = createVariant();   // opens the copy (same rooms in the same order)
    if (!v) return;
    note = t('furn.variant', { name: v.name }) + ' · ';
    syncActive();
  }
  const seed = Math.floor(Math.random() * 2 ** 31);
  let n = 0;
  const skipped = [];
  for (const r of at.map(i => state.rooms[i])) {
    const id = r.id;
    const kits = kitsFor(r.purpose, r.room);
    const kit = kits[Math.floor(Math.random() * kits.length)];
    const res = furnish({ ...aptRoomView(state, id), items: [], seq: r.seq }, kit, { seed, catalog: state.catalog });
    r.items = res.items;
    r.seq = res.seq;
    if (id === state.activeRoomId) Object.assign(state, { items: r.items, seq: r.seq });
    n += res.items.length;
    skipped.push(...res.skipped.map(type => (targets.length > 1 ? `${r.name}: ` : '') + itemName({ type })));
  }
  Object.assign(state, { selectedId: null, selectedIds: new Set(), selectedOpening: null, selectedObstacle: null, found: null });
  emit();
  toast(note + t('furn.done', { n }) + (skipped.length ? ' · ' + t('furn.skipped', { list: skipped.join(', ') }) : ''), skipped.length > 0);
}
