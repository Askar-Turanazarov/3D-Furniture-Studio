// The tools of «Новостройка»: apartments from ../apartments.json. Prices in sum (integers), area in m², rooms 0 = studio.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { annuity } from './mortgage.js';
import { bookViewing, BookingError } from './bookings.js';
import { logEvent, safeArgs } from './calllog.js';

const root = f => fileURLToPath(new URL('../' + f, import.meta.url));
export const FILES = { apartments: root('apartments.json'), bookings: root('booking.json'), calls: root('mcp-calls.jsonl') };

const short = ({ no, floor, rooms, area, price, status }) => ({ no, floor, rooms, area, price, status });
const kind = a => (a.rooms ? `${a.rooms}-комн.` : 'студия');
const sum = n => n.toLocaleString('ru-RU') + ' сум';
const line = a => `№${a.no}: ${kind(a)}, ${a.area} м², этаж ${a.floor}, ${sum(a.price)}, ${a.status}`;
const ok = (data, text) => ({ structuredContent: data, content: [{ type: 'text', text }] });
const fail = text => ({ isError: true, content: [{ type: 'text', text }] });

// A broken or missing data file must not show its path to the client: log the code, answer in general terms.
async function run(handler, args) {
  try { return await handler(args); } catch (e) {
    if (e instanceof BookingError) return fail(e.message);
    console.error('tool failed:', e.code || e.name);
    return fail('Внутренняя ошибка сервера, попробуйте позже');
  }
}

// The first line of the answer for the call log; a booking is logged without the client's name.
function summary(tool, r) {
  const d = r.structuredContent;
  if (r.isError || !d) return r.content[0].text.split('\n')[0];
  if (tool === 'book_viewing') return `Записано на показ: квартира №${d.no}, ${d.datetime.slice(0, 16).replace('T', ' ')}`;
  if (tool === 'calc_mortgage') return `Платёж ${sum(d.monthly)} в месяц, переплата ${sum(d.overpay)}`;
  return r.content[0].text.split('\n')[0];
}

// Every tool runs through here: errors become plain-text answers, each call lands in the call log.
const safe = (files, tool, handler, seen = {}) => async args => {
  seen.logged = true;
  const t0 = Date.now();
  const r = await run(handler, args);
  await logEvent(files.calls, { type: 'call', tool, ok: !r.isError, ms: Date.now() - t0, args: safeArgs(tool, args), msg: summary(tool, r) });
  return r;
};

export async function readApartments(file) {
  return JSON.parse(await fs.readFile(file, 'utf8')).apartments || [];
}

const STATUSES = ['free', 'booked', 'sold'];

// The manager's statuses ({ [building]: { [no]: status } }, the site's /admin.html) win over apartments.json,
// as on the showcase (server/buildings.js applyStatuses). Pure: returns new objects only where a status changed.
export function applyStatuses(list, overrides) {
  return list.map(a => {
    const own = overrides?.[a.building]?.[a.no];
    return STATUSES.includes(own) && own !== a.status ? { ...a, status: own } : a;
  });
}

// files.statuses — optional async () → the manager's statuses (index.js passes the site's storage, server/db.js).
const apartmentsOf = async files => applyStatuses(await readApartments(files.apartments), files.statuses ? await files.statuses() : {});

// Pure: the filters, free only by default, cheapest first.
export function searchApartments(list, { rooms, maxPrice, minArea, floor, status = 'free', limit = 20 } = {}) {
  const found = list.filter(a => (rooms == null || a.rooms === rooms) && (maxPrice == null || a.price <= maxPrice)
    && (minArea == null || a.area >= minArea) && (floor == null || a.floor === floor) && (status === 'any' || a.status === status))
    .sort((a, b) => a.price - b.price || a.no - b.no);
  return { total: found.length, apartments: found.slice(0, limit).map(short) };
}

// Pure: one apartment by number with the price per m², or null.
export function getApartment(list, no) {
  const a = list.find(x => x.no === no);
  return a ? { ...short(a), pricePerM2: Math.round(a.price / a.area) } : null;
}

const APT = z.object({ no: z.number(), floor: z.number(), rooms: z.number(), area: z.number(), price: z.number(), status: z.string() });

// seen.logged — set once a tool ran and wrote its line (index.js logs the calls the SDK refused before any tool ran).
export function registerTools(server, files = FILES, seen = {}) {
  const wrap = (tool, handler) => safe(files, tool, handler, seen);
  server.registerTool('search_apartments', {
    title: 'Поиск квартир',
    description: 'Квартиры новостройки по фильтрам. Цены в сумах (целые), площадь в м², rooms 0 — студия. По умолчанию только свободные (status free), сначала дешёвые.',
    inputSchema: z.strictObject({
      rooms: z.number().int().min(0).max(6).optional().describe('Число комнат, 0 — студия'),
      maxPrice: z.number().int().positive().optional().describe('Максимальная цена, сум'),
      minArea: z.number().positive().optional().describe('Минимальная площадь, м²'),
      floor: z.number().int().min(1).max(100).optional().describe('Этаж'),
      status: z.enum(['free', 'booked', 'sold', 'any']).optional().describe('free — в продаже, booked — бронь, sold — продана, any — все'),
      limit: z.number().int().min(1).max(100).optional().describe('Сколько квартир вернуть, по умолчанию 20')
    }),
    outputSchema: { total: z.number().int(), apartments: z.array(APT) }
  }, wrap('search_apartments', async args => {
    const r = searchApartments(await apartmentsOf(files), args);
    return ok(r, [`Найдено: ${r.total}`, ...r.apartments.map(line)].join('\n'));
  }));

  server.registerTool('get_apartment', {
    title: 'Квартира по номеру',
    description: 'Карточка квартиры по номеру: этаж, комнаты, площадь, цена и цена за м² в сумах, статус.',
    inputSchema: z.strictObject({ no: z.number().int().positive().describe('Номер квартиры') }),
    outputSchema: APT.extend({ pricePerM2: z.number().int() }).shape
  }, wrap('get_apartment', async ({ no }) => {
    const a = getApartment(await apartmentsOf(files), no);
    if (!a) return fail(`Квартира №${no} не найдена. Номера квартир можно найти через search_apartments`);
    return ok(a, `${line(a)}, ${sum(a.pricePerM2)}/м²`);
  }));

  server.registerTool('calc_mortgage', {
    title: 'Ипотека (аннуитет)',
    description: 'Аннуитет с месячной ставкой (годовая / 12): ежемесячный платёж, общая сумма выплат и переплата. Укажите одно из трёх: сумму кредита (loan), цену (price) с взносом downPct или номер квартиры (no) — тогда берётся её цена. Все суммы — целые сумы.',
    inputSchema: z.strictObject({
      loan: z.number().int().positive().optional().describe('Сумма кредита, сум'),
      price: z.number().int().positive().optional().describe('Цена квартиры, сум (кредит = цена − взнос)'),
      no: z.number().int().positive().optional().describe('Номер квартиры вместо цены'),
      downPct: z.number().min(0).max(90).optional().describe('Первоначальный взнос, % от цены (по умолчанию 0)'),
      years: z.number().int().min(1).max(30).describe('Срок, лет'),
      rate: z.number().min(0).max(60).describe('Ставка, % годовых')
    }),
    outputSchema: {
      price: z.number().int(), down: z.number().int(), loan: z.number().int(), months: z.number().int(),
      monthly: z.number().int(), total: z.number().int(), overpay: z.number().int(), no: z.number().int().optional()
    }
  }, wrap('calc_mortgage', async ({ loan, price, no, downPct = 0, years, rate }) => {
    if ([loan, price, no].filter(v => v != null).length !== 1) return fail('Укажите что-то одно: сумму кредита (loan), цену (price) или номер квартиры (no)');
    if (loan != null && downPct) return fail('Взнос (downPct) указывается с ценой (price) или номером (no), а не с суммой кредита');
    if (no != null) {
      const a = (await apartmentsOf(files)).find(x => x.no === no);
      if (!a) return fail(`Квартира №${no} не найдена`);
      price = a.price;
    }
    const r = { ...annuity({ price, downPct, loan, years, rate }), ...(no != null ? { no } : {}) };
    return ok(r, [
      loan != null ? `Кредит ${sum(r.loan)}` : `${no != null ? `Квартира №${no}, ц` : 'Ц'}ена ${sum(r.price)}, взнос ${downPct}% = ${sum(r.down)}, кредит ${sum(r.loan)}`,
      `${years} лет (${r.months} мес.) под ${rate}% годовых: платёж ${sum(r.monthly)} в месяц`,
      `Всего выплат ${sum(r.total)}, переплата ${sum(r.overpay)}`
    ].join('\n'));
  }));

  server.registerTool('book_viewing', {
    title: 'Запись на показ',
    description: 'Записывает на показ квартиры в booking.json (с id и временем создания). Проверяет, что квартира существует и не продана и что на это же время на эту квартиру нет другой записи. Время — Ташкент. Статус квартиры не меняется.',
    inputSchema: z.strictObject({
      name: z.string().trim().min(2).max(80).describe('Имя'),
      phone: z.string().trim().min(7).max(30).describe('Телефон, например +998 90 123 45 67'),
      datetime: z.string().max(40).describe('Дата и время показа, например 2026-10-25T15:00 (время Ташкента)'),
      no: z.number().int().positive().describe('Номер квартиры')
    }),
    outputSchema: { id: z.string(), no: z.number().int(), name: z.string(), phone: z.string(), datetime: z.string(), createdAt: z.string() }
  }, wrap('book_viewing', async args => {
    const b = await bookViewing(files.bookings, await apartmentsOf(files), args);
    return ok(b, `Записано: ${b.name}, квартира №${b.no}, ${b.datetime.slice(0, 16).replace('T', ' ')} (Ташкент). Номер записи ${b.id}`);
  }));
}
