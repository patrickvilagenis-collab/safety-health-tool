// views/settings.js — account & access, data management, platform info.

import { store, seedDemoData } from '../store.js';
import { db } from '../db.js';
import * as sync from '../sync.js';
import { download, toast, confirmDialog, esc } from '../utils.js';

export async function renderSettings(root) {
  const [visits, actions, photos] = await Promise.all([store.visits(), store.actions(), db.all('photos')]);
  const me = sync.currentUser();
  const admin = sync.isAdmin();
  const onServer = sync.enabled();

  root.innerHTML = `
    <header class="view-head"><div><h1>Settings & data</h1><p class="muted">Account, access control and data management.</p></div></header>

    <section class="kpi-grid four">
      <div class="kpi"><div class="kpi-val">${visits.length}</div><div class="kpi-lbl">Visits</div></div>
      <div class="kpi"><div class="kpi-val">${actions.length}</div><div class="kpi-lbl">Actions</div></div>
      <div class="kpi"><div class="kpi-val">${photos.length}</div><div class="kpi-lbl">Photos</div></div>
      <div class="kpi"><div class="kpi-val">${navigator.onLine ? 'Online' : 'Offline'}</div><div class="kpi-lbl">Connectivity</div></div>
    </section>

    <div class="card">
      <h3>Account</h3>
      ${me
        ? `<p class="hint">Signed in as <b>${esc(me.username)}</b> · role <b>${esc(me.role)}</b>.</p>
           <button class="btn" id="signOut2">Sign out</button>`
        : `<p class="hint">Not signed in. Data is local-only in this browser.</p>`}
    </div>

    ${admin ? `
    <div class="card">
      <div class="card-head"><h3>Users — who can access</h3></div>
      <p class="hint">Create accounts for the people allowed into the platform. Only admins see this panel.</p>
      <div class="grid4" style="align-items:end">
        <label class="fld"><span>Username</span><input id="nuUser" placeholder="e.g. j.doe"></label>
        <label class="fld"><span>Password</span><input id="nuPass" type="text" placeholder="temporary password"></label>
        <label class="fld"><span>Role</span><select id="nuRole"><option value="user">user</option><option value="admin">admin</option></select></label>
        <button class="btn primary" id="nuAdd">Add user</button>
      </div>
      <p class="hint" id="usersMsg"></p>
      <div class="table-wrap" style="margin-top:8px">
        <table class="table"><thead><tr><th>Username</th><th>Role</th><th class="num">Actions</th></tr></thead>
        <tbody id="usersRows"><tr><td colspan="3" class="empty">Loading…</td></tr></tbody></table>
      </div>
      <p class="hint">Tip: on the free hosting tier, users added here reset if the server restarts. For permanent users, set the <code>USERS</code> env var in Render (a JSON list) — that survives restarts.</p>
    </div>` : ''}

    ${admin ? `
    <div class="card">
      <h3>Server (advanced)</h3>
      <div class="grid2">
        <label class="fld"><span>API base URL</span><input id="apiUrl" type="url" value="${esc(sync.getConfig().url || '')}"></label>
      </div>
      <div class="row-gap" style="margin-top:10px">
        <button class="btn" id="saveUrl">Save URL</button>
        <button class="btn" id="syncUpload">Upload this device's data → server</button>
      </div>
      <p class="hint" id="opStatus"></p>
    </div>` : ''}

    <div class="card">
      <h3>Backup & restore</h3>
      <p class="hint">Export a full backup (visits, actions and photos) to a JSON file, or import one on another device.</p>
      <div class="row-gap">
        <button class="btn primary" id="backup">Export full backup</button>
        <label class="btn">Import backup<input type="file" id="restore" accept="application/json" hidden></label>
      </div>
    </div>

    ${admin ? `
    <div class="card">
      <h3>Demo data</h3>
      <p class="hint">Load a set of sample visits and accidents. ${onServer ? 'This also uploads them to the server so every user sees them.' : ''}</p>
      <div class="row-gap">
        <button class="btn primary" id="loadSample">Load sample data${onServer ? ' → server' : ''}</button>
        <button class="btn ghost danger" id="wipe">Wipe local cache</button>
      </div>
    </div>` : ''}

    <div class="card about">
      <h3>About this platform</h3>
      <ul class="feature-list">
        <li><b>Dashboards</b> — live KPIs, trends, control coverage.</li>
        <li><b>Field visit checklists</b> — SAFE, Safety Inspection, Mini OLE, JHA + Hazard Wheel & Humble Inquiry.</li>
        <li><b>Accident reporting</b> — SIF classification, RCA (5 Whys, Fishbone, Tripod, TapRooT).</li>
        <li><b>Closed-loop actions</b> — owner, due date, escalation.</li>
        <li><b>Access control</b> — login-gated, admin-managed users.</li>
      </ul>
    </div>
  `;

  const so = root.querySelector('#signOut2');
  if (so) so.addEventListener('click', async () => { await sync.logout(); location.reload(); });

  if (admin) bindUsers(root);

  const opStatus = root.querySelector('#opStatus');
  const saveUrl = root.querySelector('#saveUrl');
  if (saveUrl) saveUrl.addEventListener('click', () => { sync.setConfig({ url: root.querySelector('#apiUrl').value.trim(), key: sync.getConfig().key }); toast('Saved'); });
  const upload = root.querySelector('#syncUpload');
  if (upload) upload.addEventListener('click', async () => {
    if (!(await confirmDialog("Upload this device's records to the server? Records with the same id are overwritten."))) return;
    if (opStatus) opStatus.textContent = 'Uploading…';
    const res = await sync.pushBulk(db);
    if (res.unauthorized) { toast('Not authorized', 'bad'); return; }
    const recWord = res.pushed === 1 ? 'record' : 'records';
    toast(`Uploaded ${res.pushed} ${recWord}`, 'good');
    if (opStatus) opStatus.textContent = `Uploaded ${res.pushed} ${recWord}.`;
  });

  root.querySelector('#backup').addEventListener('click', async () => {
    download(`safety-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), visits, actions, photos }));
    toast('Backup exported', 'good');
  });
  root.querySelector('#restore').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.visits) throw new Error('bad file');
      for (const v of data.visits) await store.saveVisit(v);
      for (const a of (data.actions || [])) await store.saveAction(a);
      for (const p of (data.photos || [])) await db.put('photos', p);
      toast('Backup imported', 'good'); renderSettings(root);
    } catch { toast('Invalid backup file', 'bad'); }
  });

  const loadSample = root.querySelector('#loadSample');
  if (loadSample) loadSample.addEventListener('click', async () => {
    if (!(await confirmDialog(onServer ? 'Load sample data and upload it to the server?' : 'Load sample data?'))) return;
    toast('Generating sample data…');
    await seedDemoData();
    if (onServer) { const res = await sync.pushBulk(db); if (res.unauthorized) { toast('Not authorized', 'bad'); return; } toast(`Sample data uploaded (${res.pushed})`, 'good'); }
    else toast('Sample data loaded', 'good');
    setTimeout(() => location.reload(), 800);
  });
  const wipeBtn = root.querySelector('#wipe');
  if (wipeBtn) wipeBtn.addEventListener('click', async () => {
    if (!(await confirmDialog('Clear the local cache in this browser? (The server keeps its data.)'))) return;
    await db.clear('visits'); await db.clear('actions'); await db.clear('photos'); await db.clear('accidents');
    toast('Local cache cleared'); location.reload();
  });
}

async function bindUsers(root) {
  const rows = root.querySelector('#usersRows');
  const msg = root.querySelector('#usersMsg');
  const me = sync.currentUser();
  const refresh = async () => {
    try {
      const list = await sync.users.list();
      rows.innerHTML = list.map((u) => `
        <tr>
          <td><b>${esc(u.username)}</b></td>
          <td>${esc(u.role)}</td>
          <td class="num">
            <button class="btn small" data-pw="${esc(u.username)}">Reset password</button>
            ${u.username === (me && me.username) ? '' : `<button class="btn small ghost danger" data-del="${esc(u.username)}">Delete</button>`}
          </td>
        </tr>`).join('') || '<tr><td colspan="3" class="empty">No users.</td></tr>';
    } catch (e) { rows.innerHTML = `<tr><td colspan="3" class="empty">Could not load users (${esc(e.message)})</td></tr>`; }
  };

  root.querySelector('#nuAdd').addEventListener('click', async () => {
    const username = root.querySelector('#nuUser').value.trim();
    const password = root.querySelector('#nuPass').value;
    const role = root.querySelector('#nuRole').value;
    if (!username || !password) { toast('Username and password required', 'bad'); return; }
    try {
      await sync.users.create(username, password, role);
      root.querySelector('#nuUser').value = ''; root.querySelector('#nuPass').value = '';
      msg.textContent = `User “${username}” created.`; toast('User created', 'good'); refresh();
    } catch (e) { toast(e.message === 'HTTP 409' ? 'User already exists' : 'Could not create user', 'bad'); }
  });

  rows.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    const pw = e.target.closest('[data-pw]');
    if (del) {
      if (!(await confirmDialog(`Delete user “${del.dataset.del}”?`))) return;
      try { await sync.users.remove(del.dataset.del); toast('User deleted'); refresh(); }
      catch { toast('Could not delete', 'bad'); }
    } else if (pw) {
      const np = prompt(`New password for “${pw.dataset.pw}”:`);
      if (!np) return;
      try { await sync.users.setPassword(pw.dataset.pw, np); toast('Password updated', 'good'); }
      catch { toast('Could not update password', 'bad'); }
    }
  });

  refresh();
}
