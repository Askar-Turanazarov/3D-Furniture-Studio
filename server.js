const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

// .env.local (`vercel env pull`) and .env (KEY=value lines) without extra dependencies; real environment variables win.
for (const file of ['.env.local', '.env']) {
  try {
    for (const line of require('fs').readFileSync(path.join(__dirname, file), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch { /* no file */ }
}

const app = express();
const PORT = process.env.PORT || 3000;
const CATALOG = path.join(__dirname, 'catalog.json');
const TEMPLATES = path.join(__dirname, 'templates.json');
const APARTMENTS = path.join(__dirname, 'apartments.json');
const { validateOrder } = require('./server/validateOrder');
const { createDb } = require('./server/db');
const { writeZip } = require('./server/zip');
const { fetchSet, libraryStatus, readLibMap } = require('./server/textureFetch');
const { APT_STATUSES, BUILDING_ID, createBuildings } = require('./server/buildings');
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
// Orders and apartment statuses: files locally, Postgres (Neon) with DATABASE_URL (server/db.js).
const db = createDb({ root: __dirname, dataDir: DATA });
const buildings = createBuildings(path.join(__dirname, 'buildings'), { read: () => db.statuses(), set: db.setStatus });

app.set('trust proxy', 1);                 // the client's IP behind the Vercel / reverse proxy
// Basic security headers: no MIME sniffing, frames only from this site (the floor 3D iframe), short Referer.
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
  next();
});
app.use(express.json({ limit: '4mb' }));   // the order carries the drawing PNG and a 3D picture (≤ 1.5 MB each); Vercel takes ≤ 4.5 MB
app.use(express.static(path.join(__dirname, 'public'), { index: false }));   // "/" is rendered below
app.get('/favicon.ico', (req, res) => res.redirect(301, '/favicon.svg'));
// Vercel serves public/ from its CDN but sends "/" to the function: the planner page from here.
// The pages with the language in the address (and "/" = Russian): link previews (Open Graph) and the interface in that language.
const pages = require('./server/pages');
const sendPage = (page, self) => (req, res) => {
  const ua = req.get('user-agent') || '';
  if (/bot|telegram|whatsapp|facebookexternalhit|preview/i.test(ua)) console.log('preview fetch', req.method, req.originalUrl, ua);   // which messengers come for the preview
  res.set('Cache-Control', 'public, max-age=0, s-maxage=3600').type('html')
    .send(pages.render(page, req.params.lang ?? 'ru', `${req.protocol}://${req.get('host')}`, self));
};
app.get('/', sendPage('planner', pages.STATIC.planner));
app.get('/:lang(ru|uz|en)/?', sendPage('planner'));
app.get('/:lang(ru|uz|en)/building/?', sendPage('building'));
// three.js from the package (on Vercel this runs in the function: let the CDN keep the files, the version is pinned)
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three'), {
  setHeaders: res => res.set('Cache-Control', 'public, max-age=604800, s-maxage=31536000')
}));

// Files of the deployment: the CDN may keep them (a new deployment starts with an empty cache).
const SHARED_JSON = 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400';

// Is the server alive, which storage does it use (files / postgres). No database call, no secrets.
const { version } = require('./package.json');
app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store').json({ ok: true, db: db.kind, version });
});

app.get('/api/catalog', async (req, res) => {
  try {
    res.set('Cache-Control', SHARED_JSON).type('json').send(await fs.readFile(CATALOG, 'utf8'));
  } catch (e) {
    res.status(500).json({ error: 'catalog_unavailable' });
  }
});

app.get('/api/templates', async (req, res) => {
  try {
    res.set('Cache-Control', SHARED_JSON).type('json').send(await fs.readFile(TEMPLATES, 'utf8'));
  } catch (e) {
    res.status(500).json({ error: 'templates_unavailable' });
  }
});

app.get('/api/apartments', async (req, res) => {
  try {
    res.set('Cache-Control', SHARED_JSON).type('json').send(await fs.readFile(APARTMENTS, 'utf8'));
  } catch (e) {
    res.status(500).json({ error: 'apartments_unavailable' });
  }
});

// ---------- new-building showcase: generated buildings (scripts/gen-building.mjs) + statuses by the manager ----------
app.get('/api/buildings', async (req, res) => {
  try {
    res.json(await buildings.list());
  } catch {
    res.status(500).json({ error: 'buildings_unavailable' });
  }
});

app.get('/api/buildings/:id', async (req, res) => {
  const t0 = Date.now();
  let b;
  try { b = await buildings.get(req.params.id); } catch { return res.status(500).json({ error: 'buildings_unavailable' }); }
  if (!b) return res.status(404).json({ error: 'not_found' });
  // Server-Timing: the building file + the statuses from the database (seen in the browser's network panel).
  res.set({ 'Cache-Control': 'no-cache', 'Server-Timing': `data;desc="${db.kind}";dur=${Date.now() - t0}` });
  res.json(b);
});

app.post('/api/order', async (req, res) => {
  const body = req.body || {};
  // Honeypot: people never see the "website" field; a filled one means a bot. Answer "ok", save nothing.
  if (body.website) return res.json({ ok: true, id: Date.now() });
  const v = validateOrder(body);
  if (!v.ok) return res.status(400).json({ error: v.error, field: v.field });
  // A request for a new-building apartment: it must exist; the manager sees its type, area and price.
  const ref = v.order.apartmentRef;
  if (ref) {
    const a = await buildings.apartment(ref.building, ref.apt);
    if (!a || a.floor !== ref.floor) return res.status(400).json({ error: 'invalid_order', field: 'apartmentRef' });
    v.order.apartment = { type: a.type, rooms: a.rooms, area: a.area, price: a.price, status: a.status };
    v.order.estimate ??= a.price;
  }
  try {
    if (!(await db.allowOrder(req.ip))) return res.status(429).json({ error: 'too_many' });
    // Drawing and 3D picture: plan.png, 3d.jpg next to the order (orders/<id>/ or the order_files table).
    const id = await db.addOrder(v.order, v.files, req.ip);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: 'save_failed' });
  }
});

// ---------- manager: orders list, statuses, notes (Authorization: Bearer ADMIN_TOKEN) ----------
// A short token or the .env.example placeholder counts as not set: the manager page stays off.
const weakToken = s => s.length < 16 || /^change-me/i.test(s);
const ADMIN_TOKEN = weakToken(process.env.ADMIN_TOKEN || '') ? '' : process.env.ADMIN_TOKEN;
const STATUSES = ['new', 'inWork', 'measure', 'done', 'cancelled'];

function admin(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(503).json({ error: 'admin_disabled' });
  const got = Buffer.from(String(req.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(ADMIN_TOKEN);
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return res.status(401).json({ error: 'unauthorized' });
  res.set('Cache-Control', 'no-store');
  next();
}

app.get('/api/orders', admin, async (req, res) => {
  try {
    const orders = await db.listOrders();
    res.json(orders.map(o => ({ status: 'new', ...o })).reverse());
  } catch {
    res.status(500).json({ error: 'read_failed' });
  }
});

app.patch('/api/orders/:id', admin, async (req, res) => {
  const id = Number(req.params.id), { status, note } = req.body || {};
  if (!/^\d{1,16}$/.test(req.params.id)) return res.status(404).json({ error: 'not_found' });
  if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json({ error: 'bad_status' });
  if (note !== undefined && (typeof note !== 'string' || note.length > 2000)) return res.status(400).json({ error: 'bad_note' });
  try {
    const order = await db.updateOrder(id, o => {
      const at = new Date().toISOString();
      if (status !== undefined && status !== (o.status || 'new')) {
        o.status = status;
        (o.history ||= []).push({ status, at });
      }
      if (note !== undefined) o.note = note;
      o.updatedAt = at;
    });
    if (!order) return res.status(404).json({ error: 'not_found' });
    res.json(order);
  } catch {
    res.status(500).json({ error: 'save_failed' });
  }
});

// Apartment status in the showcase: free → booked → sold (and back).
app.patch('/api/buildings/:id/apartments/:apt', admin, async (req, res) => {
  const { id, apt } = req.params, { status } = req.body || {};
  if (!BUILDING_ID.test(id) || !/^\d{1,6}$/.test(apt)) return res.status(404).json({ error: 'not_found' });
  if (!APT_STATUSES.includes(status)) return res.status(400).json({ error: 'bad_status' });
  try {
    const r = await buildings.setStatus(id, Number(apt), status);
    if (!r) return res.status(404).json({ error: 'not_found' });
    res.json(r);
  } catch {
    res.status(500).json({ error: 'save_failed' });
  }
});

// The drawing and the 3D picture of an order (fetched with the token, shown via a blob URL).
app.get('/api/orders/:id/:file', admin, async (req, res) => {
  const { id, file } = req.params;
  if (!/^\d{1,16}$/.test(id) || !['plan.png', '3d.jpg'].includes(file)) return res.status(404).end();
  try {
    const buf = await db.orderFile(Number(id), file);
    if (!buf) return res.status(404).end();
    res.type(file.endsWith('.png') ? 'png' : 'jpeg').send(buf);
  } catch {
    res.status(500).end();
  }
});

// ---------- photo textures: the built-in CC0 set (own photos stay in the visitor's browser) ----------
const TEXTURES = path.join(__dirname, 'public', 'textures');
const SETS = ['floor', 'wall', 'wood', 'fabric'];
const MAPS = ['color', 'normal', 'roughness'];

// The whole built-in set as a ZIP (stored, no compression: JPEGs are already compressed).
let packCache = null;
app.get('/api/textures/pack.zip', async (req, res) => {
  try {
    if (!packCache) {
      const files = [{ name: 'furniture-textures-cc0/README.md', data: await fs.readFile(path.join(TEXTURES, 'README.md')) }];
      for (const s of SETS) for (const m of MAPS) {
        files.push({ name: `furniture-textures-cc0/${s}/${m}.jpg`, data: await fs.readFile(path.join(TEXTURES, s, `${m}.jpg`)) });
      }
      packCache = writeZip(files);
    }
    res.attachment('furniture-textures-cc0.zip').type('zip').send(packCache);
  } catch {
    res.status(404).json({ error: 'pack_unavailable' });
  }
});

// Texture library: which sets are on disk; download a whitelisted set from ambientCG on demand.
app.get('/api/textures/library', async (req, res) => {
  try { res.json(await libraryStatus()); } catch { res.status(500).json({ error: 'library_failed' }); }
});

// A downloaded set's map that is not a static file (Vercel: it is in Blob). Same origin for the WebGL loaders;
// the CDN keeps it (s-maxage), so the function reads each file about once.
app.get('/textures/lib/:id/:file', async (req, res) => {
  const m = /^(\w+)\.jpg$/.exec(req.params.file);
  const buf = m && await readLibMap(String(req.params.id), m[1]).catch(() => null);
  // Missing: the CDN keeps the answer for a few minutes, so the pages do not ask the store each time.
  if (!buf) return res.set('Cache-Control', 'public, s-maxage=300').status(404).end();
  res.set('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable').type('jpg').send(buf);
});

app.post('/api/textures/fetch/:id', async (req, res) => {
  try {
    await fetchSet(String(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    if (!e.status) console.error('texture set', req.params.id, 'failed:', e.message, e.cause?.message || '');
    const error = { 404: 'unknown_set', 429: 'busy', 503: 'store_unavailable' }[e.status] || 'download_failed';
    res.status(e.status || 502).json({ error });
  }
});

// Any other /api path: JSON, not the HTML "Cannot GET" page.
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

if (require.main === module) app.listen(PORT, () => console.log(`Domus: http://localhost:${PORT}`));

module.exports = app;
