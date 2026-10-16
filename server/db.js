// Orders and apartment statuses: files on disk for local work (order.json, orders/<id>/, data/building-status.json),
// Postgres (Neon) when DATABASE_URL is set — on Vercel the functions have no disk that lasts.
// Both give the same interface:
//   addOrder(order, files) → id         files: [[name, Buffer]]; the order gets id, createdAt, status, files
//   listOrders() → [order]              oldest first
//   updateOrder(id, fn) → order | null  fn(order) changes it in place
//   orderFile(id, name) → Buffer | null
//   statuses() → { [building]: { [apt]: status } }
//   setStatus(building, apt, status)
//   allowOrder(ip) → bool               at most 5 orders per IP in 10 minutes
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { createStore, createRateLimit } = require('./orderStore');

const LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };

function newOrder(id, order, files) {
  const o = { id, createdAt: new Date().toISOString(), status: 'new', ...order };
  if (files.length) o.files = files.map(([f]) => `orders/${id}/${f}`);
  return o;
}

function fileDb({ ordersFile, filesDir, statusFile }) {
  const orders = createStore(ordersFile);
  const status = createStore(statusFile, () => ({}));
  const limit = createRateLimit(LIMIT);
  return {
    kind: 'files',
    addOrder: (order, files) => orders.update(async list => {
      let id = Date.now();
      while (list.some(o => o.id === id)) id++;
      if (files.length) {
        const dir = path.join(filesDir, String(id));
        await fs.mkdir(dir, { recursive: true });
        for (const [f, buf] of files) await fs.writeFile(path.join(dir, f), buf);
      }
      list.push(newOrder(id, order, files));
      return id;
    }),
    listOrders: () => orders.read(),
    updateOrder: (id, fn) => orders.update(list => {
      const o = list.find(x => x.id === id);
      if (o) fn(o);
      return o || null;
    }),
    orderFile: (id, name) => fs.readFile(path.join(filesDir, String(id), name)).catch(() => null),
    statuses: () => status.read(),
    setStatus: (b, apt, s) => status.update(all => { (all[b] ||= {})[apt] = s; }),
    allowOrder: async ip => limit(ip)
  };
}

// The schema is created on the first query of a function instance.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS orders (id bigint PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
     ip_hash text, rev integer NOT NULL DEFAULT 0, doc jsonb NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS orders_ip_time ON orders (ip_hash, created_at)',
  `CREATE TABLE IF NOT EXISTS order_files (order_id bigint NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
     name text NOT NULL, data bytea NOT NULL, PRIMARY KEY (order_id, name))`,
  `CREATE TABLE IF NOT EXISTS apt_status (building text NOT NULL, apt integer NOT NULL, status text NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (building, apt))`
];

// sql(text, params) → rows. Neon's HTTP driver: one statement per request, no connection to keep.
// batch(texts) runs several statements in one request (the schema: one round trip per function instance, not four).
function pgDb(url, { query, batch } = {}) {
  if (!query) {
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(url);
    query = (text, params = []) => sql.query(text, params);
    batch = texts => sql.transaction(texts.map(t => sql.query(t)));
  }
  batch ||= async texts => { for (const t of texts) await query(t); };
  let ready = null;
  const q = async (text, params) => {
    ready ||= batch(SCHEMA).catch(e => { ready = null; throw e; });
    await ready;
    return query(text, params);
  };
  // The IP itself is not kept: a hash, enough to count the orders.
  const ipHash = ip => crypto.createHash('sha256').update('fsp3d:' + String(ip || '')).digest('hex').slice(0, 32);

  return {
    kind: 'postgres',
    async addOrder(order, files, ip) {
      for (let id = Date.now(), tries = 0; tries < 50; id++, tries++) {
        const doc = newOrder(id, order, files);
        const rows = await q('INSERT INTO orders (id, created_at, ip_hash, doc) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING RETURNING id',
          [id, doc.createdAt, ip == null ? null : ipHash(ip), JSON.stringify(doc)]);
        if (!rows.length) continue;
        for (const [name, buf] of files) {
          await q('INSERT INTO order_files (order_id, name, data) VALUES ($1, $2, decode($3, \'base64\'))', [id, name, buf.toString('base64')]);
        }
        return id;
      }
      throw new Error('order_id');
    },
    async listOrders() {
      return (await q('SELECT doc FROM orders ORDER BY id')).map(r => (typeof r.doc === 'string' ? JSON.parse(r.doc) : r.doc));
    },
    // Read, change, write back if nobody changed it meanwhile (rev); else read again.
    async updateOrder(id, fn) {
      for (let tries = 0; tries < 10; tries++) {
        const [row] = await q('SELECT doc, rev FROM orders WHERE id = $1', [id]);
        if (!row) return null;
        const doc = typeof row.doc === 'string' ? JSON.parse(row.doc) : row.doc;
        fn(doc);
        const done = await q('UPDATE orders SET doc = $1, rev = rev + 1 WHERE id = $2 AND rev = $3 RETURNING id', [JSON.stringify(doc), id, row.rev]);
        if (done.length) return doc;
      }
      throw new Error('busy');
    },
    async orderFile(id, name) {
      const [row] = await q('SELECT encode(data, \'base64\') AS b64 FROM order_files WHERE order_id = $1 AND name = $2', [id, name]);
      return row ? Buffer.from(row.b64, 'base64') : null;
    },
    async statuses() {
      const all = {};
      for (const r of await q('SELECT building, apt, status FROM apt_status')) (all[r.building] ||= {})[r.apt] = r.status;
      return all;
    },
    async setStatus(b, apt, s) {
      await q(`INSERT INTO apt_status (building, apt, status) VALUES ($1, $2, $3)
        ON CONFLICT (building, apt) DO UPDATE SET status = EXCLUDED.status, updated_at = now()`, [b, apt, s]);
    },
    async allowOrder(ip) {
      const [r] = await q('SELECT count(*)::int AS n FROM orders WHERE ip_hash = $1 AND created_at > now() - make_interval(secs => $2)',
        [ipHash(ip), LIMIT.windowMs / 1000]);
      return r.n < LIMIT.max;
    }
  };
}

/** The storage for this process: Postgres when DATABASE_URL is set, files otherwise. */
function createDb({ url = process.env.DATABASE_URL, root, dataDir } = {}) {
  if (url) return pgDb(url);
  return fileDb({
    ordersFile: path.join(root, 'order.json'),
    filesDir: path.join(root, 'orders'),
    statusFile: path.join(dataDir, 'building-status.json')
  });
}

module.exports = { createDb, fileDb, pgDb };
