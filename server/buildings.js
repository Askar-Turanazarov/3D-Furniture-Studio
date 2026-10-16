// New-building data for the showcase: generated buildings (buildings/<id>.json) with the manager's apartment
// statuses on top (server/db.js: { [building id]: { [apartment no]: 'free' | 'booked' | 'sold' } }).
const fs = require('fs/promises');
const path = require('path');

const APT_STATUSES = ['free', 'booked', 'sold'];
const BUILDING_ID = /^[a-z0-9-]{1,60}$/;

// Statuses changed by the manager win over the generated ones. Pure: changes and returns `b`.
function applyStatuses(b, overrides) {
  const own = (overrides && overrides[b.id]) || {};
  for (const f of b.floorsData) {
    for (const a of f.apartments) if (APT_STATUSES.includes(own[a.no])) a.status = own[a.no];
  }
  return b;
}

const findApartment = (b, no) => b.floorsData.flatMap(f => f.apartments).find(a => a.no === no) || null;

// dir — the buildings folder, statusStore — { read() → all statuses, set(building, apt, status) } (server/db.js).
function createBuildings(dir, statusStore) {
  async function raw(id) {
    if (!BUILDING_ID.test(id)) return null;
    try { return JSON.parse(await fs.readFile(path.join(dir, id + '.json'), 'utf8')); } catch { return null; }
  }
  async function get(id) {
    const b = await raw(id);
    return b && applyStatuses(b, await statusStore.read());
  }
  async function list() {
    let files = [];
    try { files = (await fs.readdir(dir)).filter(f => f.endsWith('.json')); } catch { /* no folder */ }
    const all = await Promise.all(files.map(f => raw(f.slice(0, -5))));
    return all.filter(Boolean).map(b => ({ id: b.id, name: b.name, floors: b.floors,
      apartments: b.floorsData.reduce((s, x) => s + x.apartments.length, 0) }));
  }
  // → { no, status } | null when the building or the apartment does not exist.
  async function setStatus(id, no, status) {
    const b = await raw(id);
    if (!b || !findApartment(b, no)) return null;
    await statusStore.set(id, no, status);
    return { no, status };
  }
  return { get, list, setStatus, apartment: async (id, no) => { const b = await get(id); return b && findApartment(b, no); } };
}

module.exports = { APT_STATUSES, BUILDING_ID, applyStatuses, findApartment, createBuildings };
