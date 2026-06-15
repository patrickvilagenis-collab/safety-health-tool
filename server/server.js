// server.js — REST API + SQLite storage for the Safety & Health Information Tool.
//
// The front-end stores each record as a self-contained JSON object with an
// `id`. The server mirrors that: one table per collection holding (id, data,
// updated_at). Data endpoints require a logged-in user (Bearer token) or the
// admin API key. User accounts are managed by admins.
//
// Env vars:
//   PORT           (default 8080)
//   API_KEY        master admin key for the `x-api-key` header (optional)
//   CORS_ORIGIN    allowed origin(s), default "*"
//   DB_FILE        sqlite file path, default ./data/safety.db
//   ADMIN_USER     initial admin username (default "admin")
//   ADMIN_PASSWORD initial admin password (default "changeme" — set this!)
//   USERS          optional JSON array of permanent users, e.g.
//                  [{"username":"jdoe","password":"secret","role":"user"}]
//                  Re-applied on every start, so users survive restarts even on
//                  free hosting with ephemeral storage.

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'safety.db');

const COLLECTIONS = ['visits', 'accidents', 'oles', 'actions', 'photos', 'meta'];

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
for (const c of COLLECTIONS) {
  db.prepare(`CREATE TABLE IF NOT EXISTS ${c} (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT)`).run();
}
db.prepare(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, pass TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at TEXT)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, username TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT)`).run();

// --- password hashing (scrypt, no extra deps) ---
function hashPw(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(String(pw), salt, 64).toString('hex');
}
function verifyPw(pw, stored) {
  const [salt, h] = String(stored).split(':');
  if (!salt || !h) return false;
  const h2 = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  const a = Buffer.from(h, 'hex'), b = Buffer.from(h2, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function upsertUser(username, password, role) {
  db.prepare(`INSERT INTO users (username, pass, role, created_at) VALUES (?, ?, ?, ?)
              ON CONFLICT(username) DO UPDATE SET pass = excluded.pass, role = excluded.role`)
    .run(username, hashPw(password), role === 'admin' ? 'admin' : 'user', new Date().toISOString());
}

// Seed / refresh users from env.
if (process.env.USERS) {
  try { for (const u of JSON.parse(process.env.USERS)) if (u.username && u.password) upsertUser(u.username, u.password, u.role); }
  catch (e) { console.warn('Could not parse USERS env:', e.message); }
}
if (db.prepare('SELECT COUNT(*) c FROM users').get().c === 0) {
  const au = process.env.ADMIN_USER || 'admin';
  const ap = process.env.ADMIN_PASSWORD || 'changeme';
  upsertUser(au, ap, 'admin');
  console.log(`Seeded admin user '${au}'.` + (process.env.ADMIN_PASSWORD ? '' : " Default password 'changeme' — set ADMIN_PASSWORD!"));
}

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '20mb' })); // photos are base64 data URLs

function sessionFromReq(req) {
  const auth = req.get('authorization') || '';
  const tok = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!tok) return null;
  return db.prepare('SELECT * FROM sessions WHERE token = ?').get(tok) || null;
}

// Auth gate: /health, /login are open; /me and /logout validate their own token.
const OPEN = new Set(['/health', '/login', '/me', '/logout']);
app.use('/api', (req, res, next) => {
  if (OPEN.has(req.path)) return next();
  if (API_KEY && req.get('x-api-key') === API_KEY) { req.role = 'admin'; req.user = 'apikey'; return next(); }
  const s = sessionFromReq(req);
  if (s) { req.user = s.username; req.role = s.role; return next(); }
  res.status(401).json({ error: 'unauthorized' });
});
function requireAdmin(req, res, next) { if (req.role === 'admin') return next(); res.status(403).json({ error: 'forbidden' }); }

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString(), collections: COLLECTIONS }));

// --- auth ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || ''));
  if (!u || !verifyPw(password, u.pass)) return res.status(401).json({ error: 'invalid credentials' });
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, username, role, created_at) VALUES (?, ?, ?, ?)').run(token, u.username, u.role, new Date().toISOString());
  res.json({ token, username: u.username, role: u.role });
});
app.get('/api/me', (req, res) => { const s = sessionFromReq(req); if (!s) return res.status(401).json({ error: 'unauthorized' }); res.json({ username: s.username, role: s.role }); });
app.post('/api/logout', (req, res) => { const s = sessionFromReq(req); if (s) db.prepare('DELETE FROM sessions WHERE token = ?').run(s.token); res.status(204).end(); });

// --- user management (admin) ---
app.get('/api/users', requireAdmin, (req, res) => res.json(db.prepare('SELECT username, role, created_at FROM users ORDER BY username').all()));
app.post('/api/users', requireAdmin, (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) return res.status(409).json({ error: 'user already exists' });
  upsertUser(username, password, role);
  res.json({ username, role: role === 'admin' ? 'admin' : 'user' });
});
app.post('/api/users/:username/password', requireAdmin, (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password required' });
  const u = db.prepare('SELECT role FROM users WHERE username = ?').get(req.params.username);
  if (!u) return res.status(404).json({ error: 'not found' });
  upsertUser(req.params.username, password, u.role);
  res.status(204).end();
});
app.delete('/api/users/:username', requireAdmin, (req, res) => {
  if (req.params.username === req.user) return res.status(400).json({ error: 'cannot delete yourself' });
  db.prepare('DELETE FROM users WHERE username = ?').run(req.params.username);
  db.prepare('DELETE FROM sessions WHERE username = ?').run(req.params.username);
  res.status(204).end();
});

function guard(c, res) {
  if (!COLLECTIONS.includes(c)) { res.status(404).json({ error: 'unknown collection' }); return false; }
  return true;
}

// List all records of a collection.
app.get('/api/:c', (req, res) => {
  const c = req.params.c; if (!guard(c, res)) return;
  const rows = db.prepare(`SELECT data FROM ${c}`).all();
  res.json(rows.map((r) => JSON.parse(r.data)));
});

// Get one record.
app.get('/api/:c/:id', (req, res) => {
  const c = req.params.c; if (!guard(c, res)) return;
  const row = db.prepare(`SELECT data FROM ${c} WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(JSON.parse(row.data));
});

// Upsert a record (full object in the body).
app.put('/api/:c/:id', (req, res) => {
  const c = req.params.c; if (!guard(c, res)) return;
  const obj = req.body || {};
  obj.id = req.params.id;
  db.prepare(`INSERT INTO ${c} (id, data, updated_at) VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
    .run(obj.id, JSON.stringify(obj), new Date().toISOString());
  res.json(obj);
});

// Delete a record.
app.delete('/api/:c/:id', (req, res) => {
  const c = req.params.c; if (!guard(c, res)) return;
  db.prepare(`DELETE FROM ${c} WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

// Optionally serve the front-end if its files are copied into ./public
// (lets you host API + app from a single container).
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`Safety & Health backend listening on :${PORT} (db: ${DB_FILE})`));
