// Viewing bookings in booking.json: the site's write queue (server/orderStore.js: temp file + rename, one write at a time).
// Times are Tashkent time, stored as "YYYY-MM-DDTHH:MM+05:00". A booking never changes the apartment status.
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createStore } = require('../server/orderStore.js');
export const { PHONE } = require('../server/validateOrder.js');

const TZ = '+05:00';
const TZ_MS = 5 * 3600e3;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?$/;   // to the minute: a slot is a minute

// One queue per file for the whole process: every request builds a new MCP server, the queue must outlive it.
const stores = new Map();
const storeOf = file => stores.get(file) || stores.set(file, createStore(file)).get(file);

// "2026-10-25T15:00" (Tashkent) or with an offset → { ms, local } | null. Pure.
export function parseTime(s) {
  if (!ISO.test(s)) return null;
  const ms = Date.parse(/(Z|[+-]\d{2}:\d{2})$/.test(s) ? s : s + TZ);
  if (Number.isNaN(ms)) return null;
  return { ms, local: new Date(ms + TZ_MS).toISOString().slice(0, 16) + TZ };
}

export class BookingError extends Error {}

// → the saved booking; throws BookingError when the apartment is unknown or sold, the time is past or the slot is taken.
export async function bookViewing(file, apartments, { name, phone, datetime, no }, now = Date.now()) {
  const a = apartments.find(x => x.no === no);
  if (!a) throw new BookingError(`Квартира №${no} не найдена. Номера квартир можно найти через search_apartments`);
  if (a.status === 'sold') throw new BookingError(`Квартира №${no} продана, запись на показ невозможна`);
  if (!PHONE.test(phone)) throw new BookingError('Телефон в неверном формате, например +998 90 123 45 67');
  const t = parseTime(datetime);
  if (!t) throw new BookingError('Дата и время в формате 2026-10-25T15:00 (время Ташкента)');
  if (t.ms <= now) throw new BookingError('Дата и время показа должны быть в будущем');
  return storeOf(file).update(list => {
    if (list.some(b => b.no === no && Date.parse(b.datetime) === t.ms)) throw new BookingError(`Это время занято: на ${t.local.slice(0, 16).replace('T', ' ')} (Ташкент) на квартиру №${no} уже есть запись. Выберите другое время`);
    const b = { id: crypto.randomUUID(), no, name: name.trim(), phone: phone.trim(), datetime: t.local, createdAt: new Date(now).toISOString() };
    list.push(b);
    return b;
  });
}
