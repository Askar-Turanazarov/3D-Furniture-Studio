// Test fixtures: plain room / item / state objects (cm), no DOM.
export const room = (o = {}) => ({ L: 400, W: 300, H: 270, plinth: 2, ...o });

let next = 1;
export const item = (o = {}) => ({ id: next++, type: 'box', w: 100, d: 50, h: 80, x: 2, y: 2, rot: 0, ...o });

export const state = (o = {}) => ({
  room: room(o.room),
  settings: { snap: 5, gap: 3, grid: 10, ...o.settings },
  items: o.items || [],
  openings: o.openings || []
});
