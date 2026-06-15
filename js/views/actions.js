// views/actions.js — closed-loop action tracker with escalation flags.

import { store, actionsByStatus } from '../store.js';
import { stackedBar, PALETTE } from '../charts.js';
import { fmtDate, esc, daysBetween, toast, download, toCSV } from '../utils.js';
import { filterButton, filterActions, activeFilterChips } from '../filters.js';

export async function renderActions(root) {
  const [allActions, allVisits] = await Promise.all([store.actions(), store.visits()]);
  const actions = filterActions(allActions, allVisits)
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  const open = actions.filter((a) => a.status !== 'Closed' && a.status !== 'Implemented');
  const overdue = open.filter((a) => a.dueDate && daysBetween(a.dueDate) > 0);
  const dueSoon = open.filter((a) => a.dueDate && daysBetween(a.dueDate) <= 0 && daysBetween(a.dueDate) >= -7);
  const byStatus = actionsByStatus(actions);

  const escalation = (a) => {
    if (a.status === 'Closed' || a.status === 'Implemented') return '';
    if (a.dueDate && daysBetween(a.dueDate) > 0) return '<span class="pill bad">⏰ Overdue</span>';
    if (a.dueDate && daysBetween(a.dueDate) >= -3) return '<span class="pill warn">Due soon</span>';
    return '';
  };

  const row = (a) => `
    <tr data-id="${a.id}">
      <td><span class="prio ${a.priority.toLowerCase()}">${esc(a.priority)}</span></td>
      <td><b>${esc(a.title || '(untitled)')}</b><div class="sub">${esc(a.description || '')}</div></td>
      <td>${esc(a.owner || '—')}</td>
      <td>${esc(a.site || '—')}</td>
      <td><span class="nowrap">${a.dueDate ? fmtDate(a.dueDate) : '—'}</span> ${escalation(a)}</td>
      <td>
        <select class="select small" data-status="${a.id}">
          ${['Open', 'In progress', 'Implemented', 'Closed'].map((s) => `<option ${a.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td class="num">${a.accidentId ? `<a class="link" href="#/accident/${a.accidentId}">accident ↗</a>` : a.oleId ? `<a class="link" href="#/ole/${a.oleId}">OLE ↗</a>` : a.visitId ? `<a class="link" href="#/visit/${a.visitId}">visit ↗</a>` : '—'}</td>
    </tr>`;

  root.innerHTML = `
    <header class="view-head">
      <div><h1>Action tracker</h1><p class="muted">Closed-loop follow-up of corrective & preventive actions (CAPA).</p></div>
      <div class="row-gap"><span id="filterMount"></span><button class="btn" id="exportActions">Export CSV</button></div>
    </header>
    <div id="chipMount"></div>

    <section class="kpi-grid four">
      <div class="kpi"><div class="kpi-val">${open.length}</div><div class="kpi-lbl">Open</div></div>
      <div class="kpi ${overdue.length ? 'bad' : ''}"><div class="kpi-val">${overdue.length}</div><div class="kpi-lbl">Overdue</div></div>
      <div class="kpi ${dueSoon.length ? 'warn' : ''}"><div class="kpi-val">${dueSoon.length}</div><div class="kpi-lbl">Due within 7 days</div></div>
      <div class="kpi good"><div class="kpi-val">${actions.length - open.length}</div><div class="kpi-lbl">Implemented / closed</div></div>
    </section>

    <div class="card">
      <h3>Pipeline</h3>
      ${stackedBar(byStatus)}
      <div class="legend">${byStatus.map((e, i) => `<span class="leg"><i style="background:${PALETTE[i % PALETTE.length]}"></i>${e[0]} <b>${e[1]}</b></span>`).join('')}</div>
    </div>

    <div class="toolbar">
      <input id="q" class="search" placeholder="Search title, owner, site…"/>
      <select id="fStatus" class="select"><option value="">All status</option>${['Open', 'In progress', 'Implemented', 'Closed'].map((s) => `<option>${s}</option>`).join('')}</select>
      <select id="fPriority" class="select"><option value="">All priorities</option>${['High', 'Medium', 'Low'].map((s) => `<option>${s}</option>`).join('')}</select>
      <button class="btn small" id="bulkClose">Mass-close completed</button>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Priority</th><th>Action</th><th>Owner</th><th>Site</th><th>Due</th><th>Status</th><th class="num">Source</th></tr></thead>
        <tbody id="rows">${actions.map(row).join('') || '<tr><td colspan="7" class="empty"><b>No actions here yet.</b><br>Corrective actions raised in visits, accident reports and OLEs all land in this tracker.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  root.querySelector('#rows').addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-status]');
    if (!sel) return;
    const a = await store.action(sel.dataset.status);
    a.status = sel.value;
    await store.saveAction(a);
    toast('Action updated');
    renderActions(root);
  });

  const q = root.querySelector('#q');
  const fStatus = root.querySelector('#fStatus');
  const fPriority = root.querySelector('#fPriority');
  const applyRowFilters = () => {
    const term = q.value.toLowerCase();
    const st = fStatus.value, pr = fPriority.value;
    root.querySelectorAll('#rows tr[data-id]').forEach((tr) => {
      const a = actions.find((x) => x.id === tr.dataset.id);
      const hay = `${a.title} ${a.owner} ${a.site} ${a.description}`.toLowerCase();
      const ok = (!term || hay.includes(term)) && (!st || a.status === st) && (!pr || a.priority === pr);
      tr.style.display = ok ? '' : 'none';
    });
  };
  q.addEventListener('input', applyRowFilters);
  fStatus.addEventListener('change', applyRowFilters);
  fPriority.addEventListener('change', applyRowFilters);

  root.querySelector('#bulkClose').addEventListener('click', async () => {
    const implemented = actions.filter((a) => a.status === 'Implemented');
    if (!implemented.length) { toast('No implemented actions to close'); return; }
    for (const a of implemented) { a.status = 'Closed'; await store.saveAction(a); }
    toast(`${implemented.length} ${implemented.length === 1 ? 'action' : 'actions'} closed`, 'good');
    renderActions(root);
  });

  root.querySelector('#exportActions').addEventListener('click', () => {
    const rows = actions.map((a) => ({
      title: a.title, description: a.description, type: a.type, priority: a.priority,
      status: a.status, owner: a.owner, site: a.site, dueDate: a.dueDate, createdAt: a.createdAt,
    }));
    download('actions.csv', toCSV(rows), 'text/csv');
    toast('Exported actions.csv', 'good');
  });

  const rerender = () => renderActions(root);
  root.querySelector('#filterMount').append(filterButton(allVisits.filter((v) => v.status === 'submitted'), rerender));
  const chips = activeFilterChips(rerender);
  if (chips) root.querySelector('#chipMount').append(chips);
}
