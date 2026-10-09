// Persist room, settings, items and openings in localStorage (debounced).
const KEY = 'fsp3d.plan.v1';
let timer;

export function load(state) {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (!data || !Array.isArray(data.items)) return;
    Object.assign(state.room, data.room);
    Object.assign(state.settings, data.settings);
    state.items = data.items;
    state.seq = Math.max(data.seq || 1, ...data.items.map(i => i.id + 1));
    if (Array.isArray(data.openings)) {
      state.openings = data.openings;
      state.openingsLocked = !!data.openingsLocked;
      state.opSeq = Math.max(1, ...data.openings.map(o => o.id + 1));
    }
  } catch { /* corrupted or unavailable storage — start clean */ }
}

export function save(state) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      const { room, settings, items, seq, openings, openingsLocked } = state;
      localStorage.setItem(KEY, JSON.stringify({ room, settings, items, seq, openings, openingsLocked }));
    } catch { /* ignore */ }
  }, 300);
}
