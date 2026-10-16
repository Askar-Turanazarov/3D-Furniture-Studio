// Texture library sets on demand: download the ambientCG 1K-JPG zip of a whitelisted set (library.json,
// bundled: false) and unpack its maps — color / normal (OpenGL) / roughness, or the set's own list (`maps`, e.g.
// leaves: color / opacity) — into public/textures/lib/<id>/, or into Vercel Blob (textures/lib/<id>/) when
// the project has a Blob store (BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID): functions there have no disk that lasts. Blob files are served through our own
// /textures/lib/:id/:file (same origin, cached by the CDN), so the pages load them from the same address either way.
const fs = require('fs/promises');
const path = require('path');
const { listZip, readEntry } = require('./zip');

const ROOT = path.join(__dirname, '..', 'public', 'textures');
const LIB_DIR = path.join(ROOT, 'lib');
const MAX_ZIP = 40 * 1024 * 1024;
const TIMEOUT = 90 * 1000;
const MAPS = { color: /_Color\.jpg$/i, normal: /_NormalGL\.jpg$/i, roughness: /_Roughness\.jpg$/i, opacity: /_Opacity\.jpg$/i };
const DEFAULT_MAPS = ['color', 'normal', 'roughness'];
const mapsOf = e => (Array.isArray(e.maps) ? e.maps.filter(k => MAPS[k]) : DEFAULT_MAPS);

async function readLibrary() {
  return JSON.parse(await fs.readFile(path.join(ROOT, 'library.json'), 'utf8'));
}

// Sets that may be downloaded: only ids from the library, never a path from the request.
async function downloadable(id) {
  const lib = await readLibrary();
  const e = lib.find(x => x.id === id && !x.bundled);
  return e && /^[A-Za-z0-9]+$/.test(e.source?.ambientcg || '') ? e : null;
}

const exists = p => fs.access(p).then(() => true, () => false);

// Where downloaded sets are kept: { has(id, map), write(id, map, buf), read(id, map) → Buffer | null }.
const diskStore = {
  kind: 'disk',
  has: async (id, map) => exists(path.join(LIB_DIR, id, map + '.jpg')),
  async write(id, map, buf) {
    await fs.mkdir(path.join(LIB_DIR, id), { recursive: true });
    await fs.writeFile(path.join(LIB_DIR, id, map + '.jpg'), buf);
  },
  read: (id, map) => fs.readFile(path.join(LIB_DIR, id, map + '.jpg')).catch(() => null)
};

// Vercel Blob: one list of textures/lib/ (cached for a minute) tells which maps are there.
function blobStore(token, sdk = require('@vercel/blob')) {
  const PREFIX = 'textures/lib/';
  let names = null, at = 0;
  async function list() {
    if (!names || Date.now() - at > 60 * 1000) {
      const all = new Set();
      let cursor;
      do {
        const r = await sdk.list({ prefix: PREFIX, cursor, limit: 1000, token });
        r.blobs.forEach(b => all.add(b.pathname));
        cursor = r.hasMore ? r.cursor : null;
      } while (cursor);
      names = all;
      at = Date.now();
    }
    return names;
  }
  const key = (id, map) => `${PREFIX}${id}/${map}.jpg`;
  return {
    kind: 'blob',
    has: async (id, map) => (await list()).has(key(id, map)),
    async write(id, map, buf) {
      await sdk.put(key(id, map), buf, { access: 'public', addRandomSuffix: false, allowOverwrite: true,
        contentType: 'image/jpeg', cacheControlMaxAge: 365 * 24 * 3600, token });
      names?.add(key(id, map));
    },
    async read(id, map) {
      const r = await sdk.get(key(id, map), { access: 'public', token });
      if (!r || r.statusCode !== 200) return null;
      return Buffer.from(await new Response(r.stream).arrayBuffer());
    }
  };
}

let store = null;
// Blob when the project has a store: BLOB_READ_WRITE_TOKEN, or BLOB_STORE_ID (newer stores — the SDK signs in with
// the function's Vercel OIDC token itself, no token is passed).
const useBlob = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const libStore = () => (store ||= useBlob() ? blobStore(process.env.BLOB_READ_WRITE_TOKEN || undefined) : diskStore);

// Library entries with `available`: bundled sets are in the project (public/textures/sets/, checked by the tests; on
// Vercel they are on the CDN, not in the function), downloaded sets — when all their maps are there.
async function libraryStatus() {
  const lib = await readLibrary();
  return Promise.all(lib.map(async e => {
    if (e.bundled) return { ...e, available: true };
    const ok = await Promise.all(mapsOf(e).map(f => libStore().has(e.id, f).catch(() => false)));
    return { ...e, available: ok.every(Boolean) };
  }));
}

/** One map of a downloaded set (a library id and one of its maps only), or null. */
async function readLibMap(id, map) {
  const e = await downloadable(id);
  if (!e || !mapsOf(e).includes(map)) return null;
  return libStore().read(id, map);
}

// The maps from a zip buffer → { color, normal, roughness } buffers (or the keys asked for).
function mapsFromZip(buf, keys = DEFAULT_MAPS) {
  const entries = listZip(buf);
  const out = {};
  for (const key of keys) {
    const re = MAPS[key];
    const e = entries.find(x => re.test(x.name) && !x.name.includes('/') && !x.name.includes('\\'));
    if (!e) throw new Error('missing ' + key);
    out[key] = readEntry(buf, e, 16 * 1024 * 1024);
  }
  return out;
}

async function download(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (Number(res.headers.get('content-length')) > MAX_ZIP) throw new Error('too large');
    const chunks = [];
    let size = 0;
    for await (const c of res.body) {
      size += c.length;
      if (size > MAX_ZIP) throw new Error('too large');
      chunks.push(c);
    }
    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timer);
  }
}

let busy = false;

// Download and unpack one set; one download at a time (per function instance).
async function fetchSet(id, { log = () => {} } = {}) {
  const e = await downloadable(id);
  if (!e) throw Object.assign(new Error('unknown set'), { status: 404 });
  if (busy) throw Object.assign(new Error('busy'), { status: 429 });
  busy = true;
  try {
    const asset = e.source.ambientcg;
    log(`${id}: downloading ${asset}_1K-JPG.zip`);
    const buf = await download(`https://ambientcg.com/get?file=${asset}_1K-JPG.zip`);
    const maps = mapsFromZip(buf, mapsOf(e));
    for (const [k, data] of Object.entries(maps)) await libStore().write(id, k, data);
    log(`${id}: ${(buf.length / 1048576).toFixed(1)} MB zip → ${libStore().kind}`);
  } finally {
    busy = false;
  }
}

module.exports = { fetchSet, libraryStatus, readLibMap, mapsFromZip, downloadable, blobStore, LIB_DIR };
