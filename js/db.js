// db.js — storage layer with a resilient fallback.
// Primary: IndexedDB (offline-first, persistent). If IndexedDB is unavailable,
// blocked, disabled by policy (common on locked-down corporate browsers) or
// slow to open, we fall back to an in-memory store so the app ALWAYS renders.
// In-memory data is not persisted across reloads, but the UI never hangs blank.

const DB_NAME = 'safety-platform';
const DB_VERSION = 3;
const STORES = ['visits', 'actions', 'photos', 'meta', 'accidents', 'oles'];
const OPEN_TIMEOUT_MS = 3500;

let _db = null;
let _mode = null;                  // 'idb' | 'memory' (decided on first use)
const mem = Object.fromEntries(STORES.map((s) => [s, new Map()]));

// Live-binding export so the UI can show a notice when running in memory mode.
export let dbMode = 'pending';

function reqProm(r) {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

function openIDB() {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, val) => { if (!settled) { settled = true; clearTimeout(timer); fn(val); } };
    const timer = setTimeout(() => done(reject, new Error('IndexedDB open timed out')), OPEN_TIMEOUT_MS);
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); }
    catch (e) { return done(reject, e); }
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => { if (settled) { try { req.result.close(); } catch {} return; } done(resolve, req.result); };
    req.onerror = () => done(reject, req.error || new Error('IndexedDB error'));
    req.onblocked = () => done(reject, new Error('IndexedDB blocked (close other tabs of this app)'));
  });
}

async function ensureOpen() {
  if (_mode) return;
  if (typeof indexedDB === 'undefined') { _mode = 'memory'; dbMode = 'memory'; return; }
  try {
    _db = await openIDB();
    _mode = 'idb';
    dbMode = 'idb';
  } catch (e) {
    console.warn('IndexedDB unavailable — using in-memory store:', e && e.message);
    _mode = 'memory';
    dbMode = 'memory';
  }
}

function store(name, mode) { return _db.transaction(name, mode).objectStore(name); }

export const db = {
  async get(name, id) {
    await ensureOpen();
    if (_mode === 'memory') return mem[name].get(id) || null;
    try { return (await reqProm(store(name).get(id))) || null; }
    catch { return mem[name].get(id) || null; }
  },
  async all(name) {
    await ensureOpen();
    if (_mode === 'memory') return [...mem[name].values()];
    try { return (await reqProm(store(name).getAll())) || []; }
    catch { return [...mem[name].values()]; }
  },
  async put(name, value) {
    await ensureOpen();
    if (_mode === 'memory') { mem[name].set(value.id, value); return value; }
    try { await reqProm(store(name, 'readwrite').put(value)); }
    catch (e) { mem[name].set(value.id, value); }
    return value;
  },
  async del(name, id) {
    await ensureOpen();
    if (_mode === 'memory') { mem[name].delete(id); return; }
    try { await reqProm(store(name, 'readwrite').delete(id)); } catch {}
  },
  async clear(name) {
    await ensureOpen();
    if (_mode === 'memory') { mem[name].clear(); return; }
    try { await reqProm(store(name, 'readwrite').clear()); } catch {}
  },
};
