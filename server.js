const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const CATALOG = path.join(__dirname, 'catalog.json');
const ORDERS = path.join(__dirname, 'order.json');

app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three')));

app.get('/api/catalog', async (req, res) => {
  try {
    res.type('json').send(await fs.readFile(CATALOG, 'utf8'));
  } catch (e) {
    res.status(500).json({ error: 'catalog_unavailable' });
  }
});

app.post('/api/order', async (req, res) => {
  const { name, phone, comment, room, items, lang } = req.body || {};
  if (!name || !phone || !room || !Array.isArray(items)) {
    return res.status(400).json({ error: 'invalid_order' });
  }
  try {
    let orders = [];
    try { orders = JSON.parse(await fs.readFile(ORDERS, 'utf8')); } catch { orders = []; }
    const order = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      name: String(name).slice(0, 100),
      phone: String(phone).slice(0, 30),
      comment: String(comment || '').slice(0, 1000),
      lang, room, items
    };
    orders.push(order);
    await fs.writeFile(ORDERS, JSON.stringify(orders, null, 2));
    res.json({ ok: true, id: order.id });
  } catch (e) {
    res.status(500).json({ error: 'save_failed' });
  }
});

// ---------- photo textures: built-in CC0 set + custom uploads ----------
const TEXTURES = path.join(__dirname, 'public', 'textures');
const CUSTOM = path.join(TEXTURES, 'custom');
const SETS = ['floor', 'wall', 'wood', 'fabric'];
const MAPS = ['color', 'normal', 'roughness'];

// Custom colour maps that exist, with a cache-busting version.
app.get('/api/textures', async (req, res) => {
  const custom = {};
  for (const s of SETS) {
    try {
      const st = await fs.stat(path.join(CUSTOM, `${s}.jpg`));
      custom[s] = `/textures/custom/${s}.jpg?v=${Math.round(st.mtimeMs)}`;
    } catch { custom[s] = null; }
  }
  res.json({ sets: SETS, custom });
});

// Upload a JPEG (the client downsizes and re-encodes it).
app.post('/api/texture/:set', express.raw({ type: 'image/jpeg', limit: '8mb' }), async (req, res) => {
  const { set } = req.params;
  const buf = req.body;
  if (!SETS.includes(set)) return res.status(400).json({ error: 'bad_set' });
  if (!Buffer.isBuffer(buf) || buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
    return res.status(400).json({ error: 'not_jpeg' });
  }
  try {
    await fs.mkdir(CUSTOM, { recursive: true });
    await fs.writeFile(path.join(CUSTOM, `${set}.jpg`), buf);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'save_failed' });
  }
});

// Back to the built-in texture.
app.delete('/api/texture/:set', async (req, res) => {
  if (!SETS.includes(req.params.set)) return res.status(400).json({ error: 'bad_set' });
  await fs.rm(path.join(CUSTOM, `${req.params.set}.jpg`), { force: true });
  res.json({ ok: true });
});

// The whole built-in set as a ZIP (stored, no compression: JPEGs are already compressed).
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const parts = [], central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const n = Buffer.from(name), crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4);
    head.writeUInt32LE(crc, 14); head.writeUInt32LE(data.length, 18); head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(n.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(n.length, 28); cd.writeUInt32LE(offset, 42);
    parts.push(head, n, data);
    central.push(cd, n);
    offset += 30 + n.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cdBuf, end]);
}

let packCache = null;
app.get('/api/textures/pack.zip', async (req, res) => {
  try {
    if (!packCache) {
      const files = [{ name: 'furniture-textures-cc0/README.md', data: await fs.readFile(path.join(TEXTURES, 'README.md')) }];
      for (const s of SETS) for (const m of MAPS) {
        files.push({ name: `furniture-textures-cc0/${s}/${m}.jpg`, data: await fs.readFile(path.join(TEXTURES, s, `${m}.jpg`)) });
      }
      packCache = zip(files);
    }
    res.attachment('furniture-textures-cc0.zip').type('zip').send(packCache);
  } catch {
    res.status(404).json({ error: 'pack_unavailable' });
  }
});

app.listen(PORT, () => console.log(`Furniture Super Planner 3D: http://localhost:${PORT}`));
