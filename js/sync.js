// sync.js — optional backend synchronisation.
// When a backend API URL is configured (Settings → Backend sync), the app
// mirrors every write to the server and pulls server data on start. Writes
// that fail (offline) are queued in an outbox and flushed when back online.
// With no URL configured, the app stays purely local (unchanged behaviour).

const CFG = 'shi_sync_cfg';
const OUTBOX = 'shi_sync_outbox';
const AUTH = 'shi_auth';
export const COLLECTIONS = ['visits', 'accidents', 'oles', 'actions', 'photos', 'meta'];

// Default backend URL so end users only need their username + password.
// Set to '' to make the app fully local (no login).
export const DEFAULT_API_URL = 'https://safety-health-backend.onrender.com';

export function getConfig() {
  try { return { url: DEFAULT_API_URL, key: '', ...(JSON.parse(localStorage.getItem(CFG)) || {}) }; }
  catch { return { url: DEFAULT_API_URL, key: '' }; }
}
export function setConfig(cfg) { localStorage.setItem(CFG, JSON.stringify({ url: (cfg.url || '').trim(), key: (cfg.key || '').trim() })); }
export function enabled() { return !!getConfig().url; }

// --- auth/session ---
export function getAuth() { try { return JSON.parse(localStorage.getItem(AUTH)) || null; } catch { return null; } }
function setAuth(a) { if (a) localStorage.setItem(AUTH, JSON.stringify(a)); else localStorage.removeItem(AUTH); }
export function currentUser() { const a = getAuth(); return a ? { username: a.username, role: a.role } : null; }
export function isAdmin() { const a = getAuth(); return !!a && a.role === 'admin'; }

function base() { return getConfig().url.replace(/\/+$/, ''); }
function headers() {
  const k = getConfig().key;
  const a = getAuth();
  const h = { 'Content-Type': 'application/json' };
  if (a && a.token) h['Authorization'] = 'Bearer ' + a.token;
  if (k) h['x-api-key'] = k;
  return h;
}

async function api(path, opts = {}) {
  const r = await fetch(base() + path, { headers: headers(), ...opts });
  if (r.status === 401) { setAuth(null); }
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.status === 204 ? null : r.json();
}

export function test() { return api('/api/health'); }

export async function login(username, password) {
  const r = await fetch(base() + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  if (r.status === 401) throw new Error('invalid');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const data = await r.json();
  setAuth({ token: data.token, username: data.username, role: data.role });
  return data;
}
export async function logout() {
  try { await api('/api/logout', { method: 'POST' }); } catch {}
  setAuth(null);
}
// Returns the session user if the stored token is still valid, else null.
export async function checkSession() {
  if (!getAuth()) return null;
  try { return await api('/api/me'); } catch { return null; }
}

// --- admin: users ---
export const users = {
  list: () => api('/api/users'),
  create: (username, password, role) => api('/api/users', { method: 'POST', body: JSON.stringify({ username, password, role }) }),
  setPassword: (username, password) => api('/api/users/' + encodeURIComponent(username) + '/password', { method: 'POST', body: JSON.stringify({ password }) }),
  remove: (username) => api('/api/users/' + encodeURIComponent(username), { method: 'DELETE' }),
};

// Returns 'ok' if the API key is accepted, 'unauthorized' on 401.
// Throws on network/other errors.
export async function verify() {
  try { await api('/api/meta'); return 'ok'; }
  catch (e) { if (String(e.message).includes('401')) return 'unauthorized'; throw e; }
}

// Push every local record up to the server (used when seeding the server from
// a device that holds the real data). Awaits each write and reports the result.
export async function pushBulk(db) {
  let pushed = 0, failed = 0, unauthorized = false;
  for (const c of COLLECTIONS) {
    const items = await db.all(c);
    for (const it of items) {
      try { await api('/api/' + c + '/' + encodeURIComponent(it.id), { method: 'PUT', body: JSON.stringify(it) }); pushed++; }
      catch (e) { failed++; if (String(e.message).includes('401')) unauthorized = true; }
    }
  }
  return { pushed, failed, unauthorized };
}

// Clear the local cache so the next pull mirrors the server exactly.
export async function clearLocal(db) { for (const c of COLLECTIONS) await db.clear(c); }

// How many records the server currently holds (visits + accidents is enough
// to decide whether the server already has data).
export async function serverCount() {
  let total = 0;
  for (const c of ['visits', 'accidents']) {
    try { const l = await api('/api/' + c); total += (l || []).length; } catch {}
  }
  return total;
}

// Pull every collection from the server into the local cache (db).
export async function pullAll(db) {
  if (!enabled()) return { pulled: 0 };
  let pulled = 0;
  for (const c of COLLECTIONS) {
    const list = await api('/api/' + c);
    for (const item of list) { await db.put(c, item); pulled++; }
  }
  return { pulled };
}

// Fire-and-forget push of a single record (queues on failure).
export function push(collection, obj) {
  if (!enabled() || !obj || !obj.id) return;
  api('/api/' + collection + '/' + encodeURIComponent(obj.id), { method: 'PUT', body: JSON.stringify(obj) })
    .catch(() => enqueue({ op: 'put', collection, id: obj.id, obj }));
}

export function remove(collection, id) {
  if (!enabled() || !id) return;
  api('/api/' + collection + '/' + encodeURIComponent(id), { method: 'DELETE' })
    .catch(() => enqueue({ op: 'del', collection, id }));
}

function readOutbox() { try { return JSON.parse(localStorage.getItem(OUTBOX)) || []; } catch { return []; } }
function writeOutbox(q) { localStorage.setItem(OUTBOX, JSON.stringify(q)); }
function enqueue(item) { const q = readOutbox(); q.push(item); writeOutbox(q); }
export function outboxCount() { return readOutbox().length; }

export async function flushOutbox() {
  if (!enabled()) return;
  const q = readOutbox();
  if (!q.length) return;
  const remaining = [];
  for (const item of q) {
    try {
      if (item.op === 'put') await api('/api/' + item.collection + '/' + encodeURIComponent(item.id), { method: 'PUT', body: JSON.stringify(item.obj) });
      else await api('/api/' + item.collection + '/' + encodeURIComponent(item.id), { method: 'DELETE' });
    } catch { remaining.push(item); }
  }
  writeOutbox(remaining);
}
