// The visitor's own texture photos (floor, wall, wood, fabric): JPEGs kept in this browser (IndexedDB), never sent
// to the server — every visitor sees only their own. Without IndexedDB (private mode, blocked storage) there are
// none and the built-in textures are used.
const DB = 'fsp3d-tex', STORE = 'custom';
let dbp = null;
const urls = new Map();     // set → object URL of the stored photo

function open() {
  dbp ||= new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  }).catch(e => { dbp = null; throw e; });
  return dbp;
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((ok, fail) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => ok(req.result);
    tx.onerror = tx.onabort = () => fail(tx.error);
  });
}

const forget = set => { if (urls.has(set)) { URL.revokeObjectURL(urls.get(set)); urls.delete(set); } };

/** Keep a photo (Blob, JPEG) for the set. */
export async function putCustom(set, blob) {
  await run('readwrite', s => s.put(blob, set));
  forget(set);
}

/** Back to the built-in texture of the set. */
export async function deleteCustom(set) {
  await run('readwrite', s => s.delete(set));
  forget(set);
}

/** { [set]: object URL | null } for the given sets. */
export async function customUrls(sets) {
  const out = {};
  for (const set of sets) {
    out[set] = null;
    try {
      if (!urls.has(set)) {
        const blob = await run('readonly', s => s.get(set));
        if (blob) urls.set(set, URL.createObjectURL(blob));
      }
      out[set] = urls.get(set) || null;
    } catch { /* no IndexedDB: built-in */ }
  }
  return out;
}
