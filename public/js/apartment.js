// Apartment = rooms on one plan. Pure helpers, all values in cm.
// Room doc: { id, name, purpose, pos: { x, y }, room: { L, W, H, plinth }, openings, obstacles, items, seq, style, ... }
// pos — the top-left corner of the room interior on the apartment plan; inside a room local coordinates stay
// (x along L from the west wall, y along W from the north wall), so per-room rules work unchanged.
import { validateAll } from './validate.js';
import { doorSwingRect, doorwayRect } from './openings.js';

export const PARTITION = 10;   // interior partition between two rooms, cm
export const ROW_GAP = 20;     // rooms of an old project are put in a row with this gap
export const LINK_GAP = 30;    // a door opens into a room whose wall is at most this far

export const posOf = p => ({ x: Number.isFinite(p?.x) ? p.x : 0, y: Number.isFinite(p?.y) ? p.y : 0 });
export const roomRect = r => ({ x: posOf(r.pos).x, y: posOf(r.pos).y, w: r.room.L, h: r.room.W });
export const roomArea = r => r.room.L * r.room.W / 10000;
export const apartmentArea = rooms => Math.round(rooms.reduce((s, r) => s + roomArea(r), 0) * 10) / 10;

export function roomAt(rooms, x, y) {
  return rooms.find(r => {
    const b = roomRect(r);
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }) || null;
}

// Interior of one room with the shared settings and catalog: the shape validate / autoplace / zones expect.
export function roomView(apt, id) {
  const r = apt.rooms.find(x => x.id === id);
  if (!r) return null;
  return {
    id: r.id, name: r.name, purpose: r.purpose, pos: posOf(r.pos),
    room: r.room, items: r.items || [], openings: r.openings || [], obstacles: r.obstacles || [], style: r.style,
    doorways: incomingDoorways(liveRoomsOf(apt), id),
    twins: [...twinIds(liveRoomsOf(apt), id)],
    settings: apt.settings, lighting: apt.lighting,
    catalog: apt.catalog || [], materials: apt.materials || [], pricing: apt.pricing || {}
  };
}

// Rooms of an apartment state with the active one live (its fields sit on the state itself).
export function liveRoomsOf(s) {
  return (s.rooms || []).map(r => r.id !== s.activeRoomId || !s.room ? r
    : { ...r, room: s.room, items: s.items, openings: s.openings, obstacles: s.obstacles });
}

// Doorways of the neighbours' doors in the walls of room `id`: they need free floor in front, like a door swing.
export function incomingDoorways(rooms, id) {
  const names = new Map(rooms.map(r => [r.id, r.name]));
  return doorLinks(rooms).filter(l => l.to === id)
    .map(l => ({ kind: 'doorway', wall: l.wall, offset: l.offset, width: l.width, height: l.height ?? 200, from: l.room, fromName: names.get(l.room) || '' }));
}

// Doorways of a room view, or of the active room of an apartment state.
export function doorwaysOf(s) {
  if (s.doorways) return s.doorways;
  if (!s.rooms || s.activeRoomId == null) return [];
  return incomingDoorways(liveRoomsOf(s), s.activeRoomId);
}

// Doors of room `id` that duplicate a neighbour's door in the same partition (only one leaf is real).
export function twinIds(rooms, id) {
  return new Set([...twinDoors(rooms)].filter(k => k.startsWith(id + ':')).map(k => Number(k.slice(id.length + 1))));
}

// Twin doors of a room view, or of the active room of an apartment state.
export function twinsOf(s) {
  if (s.twins) return new Set(s.twins);
  if (!s.rooms || s.activeRoomId == null) return new Set();
  return twinIds(liveRoomsOf(s), s.activeRoomId);
}

// The room's own door leaves (a twin is only a doorway: its leaf is the neighbour's).
export const leafDoors = s => {
  const tw = twinsOf(s);
  return (s.openings || []).filter(o => o.kind === 'door' && !tw.has(o.id));
};

// Floor that must stay free in front of doors and doorways (for an item at height `elev`).
export function doorZones(s, elev = 0) {
  return leafDoors(s).filter(o => elev < o.height).map(o => doorSwingRect(o, s.room))
    .concat(doorwaysOf(s).filter(d => elev < d.height).map(d => doorwayRect(d, s.room)));
}

// Pairs of rooms whose interiors overlap (touching or a partition gap is fine).
export function overlapsRooms(rooms) {
  const out = [];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = roomRect(rooms[i]), b = roomRect(rooms[j]);
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push([rooms[i].id, rooms[j].id]);
    }
  }
  return out;
}

// A wall as a segment on the apartment plan: horizontal (north / south) or vertical (west / east).
const OPPOSITE = { north: 'south', south: 'north', west: 'east', east: 'west' };
export function wallLine(r, wall) {
  const b = roomRect(r);
  if (wall === 'north') return { at: b.y, from: b.x, to: b.x + b.w, out: -1 };
  if (wall === 'south') return { at: b.y + b.h, from: b.x, to: b.x + b.w, out: 1 };
  if (wall === 'west') return { at: b.x, from: b.y, to: b.y + b.h, out: -1 };
  return { at: b.x + b.w, from: b.y, to: b.y + b.h, out: 1 };
}

// Walls of a and b facing each other across a gap of 0…maxGap: [{ wallA, wallB, gap, from, to }].
export function adjacent(a, b, maxGap = LINK_GAP) {
  const out = [];
  for (const wallA of ['north', 'south', 'west', 'east']) {
    const wallB = OPPOSITE[wallA], la = wallLine(a, wallA), lb = wallLine(b, wallB);
    const gap = (lb.at - la.at) * la.out;
    const from = Math.max(la.from, lb.from), to = Math.min(la.to, lb.to);
    if (gap >= 0 && gap <= maxGap && to > from) out.push({ wallA, wallB, gap, from, to });
  }
  return out;
}

/**
 * Where every door leads: [{ room, door, to: roomId | 'outside', wall, offset, width }].
 * The door belongs to `room`; if a neighbour's wall faces it across ≤ LINK_GAP and covers the whole doorway,
 * `wall` / `offset` / `width` describe the hole in the neighbour's wall (local offset along that wall).
 */
export function doorLinks(rooms) {
  const twins = twinDoors(rooms);
  return rawLinks(rooms).filter(l => !twins.has(l.room + ':' + l.door));
}

// Which leaf of a pair stays: doors swing into living rooms, out of bathrooms; else the first room's.
const LEAF_RANK = { bathroom: 0, hall: 1 };
const rank = r => LEAF_RANK[r.purpose] ?? 2;

/**
 * Two doors in one partition, one from each side and overlapping by at least half of the narrower one,
 * are one real door. → Set of 'roomId:doorId' of the duplicates (the other leaf of each pair stays).
 */
export function twinDoors(rooms) {
  const links = rawLinks(rooms).filter(l => l.to !== 'outside');
  const out = new Set();
  for (const l of links) {
    const a = rooms.find(r => r.id === l.room), b = rooms.find(r => r.id === l.to);
    for (const m of links) {
      if (m.room !== l.to || m.to !== l.room || m.wall !== a.openings.find(o => o.id === l.door).wall) continue;
      const o = b.openings.find(x => x.id === m.door);
      const common = Math.min(l.offset + l.width, o.offset + o.width) - Math.max(l.offset, o.offset);
      if (common < Math.min(l.width, o.width) / 2) continue;
      // l is a's door seen in b's wall, o is b's door: drop the one of the lower-ranked room.
      const ia = rooms.indexOf(a), ib = rooms.indexOf(b);
      const keepA = rank(a) > rank(b) || (rank(a) === rank(b) && ia < ib);
      out.add(keepA ? `${b.id}:${o.id}` : `${a.id}:${l.door}`);
    }
  }
  return out;
}

function rawLinks(rooms) {
  const out = [];
  for (const a of rooms) {
    for (const o of a.openings || []) {
      if (o.kind !== 'door') continue;
      const la = wallLine(a, o.wall), from = la.from + o.offset, to = from + o.width;
      let link = { room: a.id, door: o.id, to: 'outside' };
      for (const b of rooms) {
        if (b === a) continue;
        const wall = OPPOSITE[o.wall], lb = wallLine(b, wall), gap = (lb.at - la.at) * la.out;
        if (gap >= 0 && gap <= LINK_GAP && lb.from <= from && to <= lb.to) {
          link = { room: a.id, door: o.id, to: b.id, wall, offset: from - lb.from, width: o.width, height: o.height };
          break;
        }
      }
      out.push(link);
    }
  }
  return out;
}

// Entrance rooms: a door to the outside, else a hall, else the first room.
export function entrances(rooms, links = doorLinks(rooms)) {
  const ids = [...new Set(links.filter(l => l.to === 'outside').map(l => l.room))];
  if (ids.length) return ids;
  const hall = rooms.find(r => r.purpose === 'hall');
  return rooms.length ? [(hall || rooms[0]).id] : [];
}

// Rooms that can be walked into from the entrance through the doors.
export function reachable(rooms, links = doorLinks(rooms)) {
  const seen = new Set(entrances(rooms, links));
  const queue = [...seen];
  while (queue.length) {
    const id = queue.shift();
    for (const l of links) {
      const next = l.room === id ? l.to : l.to === id ? l.room : null;
      if (next && next !== 'outside' && !seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}

/**
 * Magnet while a room is dragged: its edges stick to the edges of other rooms (aligned)
 * or one partition away from them (side by side), each axis separately, within `dist`.
 */
export function snapRoom(rooms, id, x, y, dist = 30) {
  const me = rooms.find(r => r.id === id);
  const { L, W } = me.room;
  let bx = null, by = null;
  for (const o of rooms) {
    if (o.id === id) continue;
    const b = roomRect(o);
    for (const cx of [b.x, b.x + b.w - L, b.x + b.w + PARTITION, b.x - L - PARTITION]) {
      if (Math.abs(cx - x) <= dist && (bx === null || Math.abs(cx - x) < Math.abs(bx - x))) bx = cx;
    }
    for (const cy of [b.y, b.y + b.h - W, b.y + b.h + PARTITION, b.y - W - PARTITION]) {
      if (Math.abs(cy - y) <= dist && (by === null || Math.abs(cy - y) < Math.abs(by - y))) by = cy;
    }
  }
  return { x: bx ?? x, y: by ?? y };
}

// Rooms without a position (old projects, new rooms) go in a row after the others.
export function layoutRow(rooms, gap = ROW_GAP) {
  let x = 0;
  for (const r of rooms) if (r.pos) x = Math.max(x, posOf(r.pos).x + r.room.L + gap);
  for (const r of rooms) {
    if (r.pos) continue;
    r.pos = { x, y: 0 };
    x += r.room.L + gap;
  }
  return rooms;
}

// Next free place for a new room: to the right of the apartment.
export function nextRoomPos(rooms, gap = ROW_GAP) {
  if (!rooms.length) return { x: 0, y: 0 };
  const right = Math.max(...rooms.map(r => roomRect(r).x + r.room.L));
  const top = Math.min(...rooms.map(r => roomRect(r).y));
  return { x: right + gap, y: top };
}

/**
 * Move an item from one room doc to another (re-parent): it keeps its place on the apartment plan,
 * gets the next id of the target room. Returns the moved item.
 */
export function moveItemBetween(from, to, item) {
  const a = posOf(from.pos), b = posOf(to.pos);
  from.items = from.items.filter(i => i !== item);
  const moved = { ...item, id: to.seq++, x: item.x + a.x - b.x, y: item.y + a.y - b.y };
  to.items.push(moved);
  return moved;
}

// Furniture errors of every room plus overlapping rooms: { rooms: Map(roomId → Map(itemId → errors)), overlaps }.
export function validateApartment(apt) {
  const rooms = new Map(apt.rooms.map(r => [r.id, validateAll(roomView(apt, r.id))]));
  return { rooms, overlaps: overlapsRooms(apt.rooms) };
}

export const apartmentHasErrors = v =>
  v.overlaps.length > 0 || [...v.rooms.values()].some(m => [...m.values()].some(e => e.length));
