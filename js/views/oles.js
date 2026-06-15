// views/oles.js — Operational Learning Events: overview, dashboard, list.

import { store, buildOleKpis, olesByStatus, olesByMonth, monthDeltas } from '../store.js';
import { OLE_STATUSES, getOleStatus, FOUR_D, oleFindings, oleVariabilityCount, oleOutsideFindings, oleFourDTotals } from '../ole.js';
import { hbarChart, lineChart, donutChart, legend } from '../charts.js';
import { monthLabel, fmtDate, esc, toast, confirmDialog } from '../utils.js';

export async function renderOles(root) {
  const [all, actions] = await Promise.all([store.oles(), store.actions()]);
  const k = buildOleKpis(all, actions);
  const months = olesByMonth(all).map(([m, n]) => [monthLabel(m), n]);
  const statusOrder = olesByStatus(all);
  const byStatus = statusOrder.map(([s, n]) => [getOleStatus(s).label, n]);
  const statusDrills = statusOrder.map(([s]) => 'olestatus:' + s);
  const fdDelta = monthDeltas(
    all.flatMap((o) => oleFindings(o).flatMap((f) => (f.fourD || []).map((dk) => ({ date: o.date || o.createdAt, dk })))),
    (x) => x.date, (x) => x.dk);
  const fourD = oleFourDTotals(all).map((e, i) => [e[0], e[1], fdDelta[FOUR_D[i].id] ?? null]);

  const kpi = (label, value, sub, tone = '') =>
    `<div class="kpi ${tone}"><div class="kpi-val">${value}</div><div class="kpi-lbl">${label}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`;

  const statusPill = (s) => { const st = getOleStatus(s); return `<span class="status ole-${st.id}">${esc(st.label)}</span>`; };

  const row = (o) => {
    const fs = oleFindings(o).length;
    const v = oleVariabilityCount(o);
    const out = oleOutsideFindings(o).length;
    const oleActs = actions.filter((a) => a.oleId === o.id);
    return `
      <tr data-id="${o.id}" class="rowlink">
        <td><b>${esc(o.refNo)}</b><div class="sub">${esc(o.title || o.task || '')}</div></td>
        <td>${esc(o.facilitator || '—')}<div class="sub">${esc(o.location.city || '')}${o.location.zone ? ' · ' + esc(o.location.zone) : ''}</div></td>
        <td class="num">${o.steps ? o.steps.length : 0}</td>
        <td class="num">${fs}</td>
        <td class="num">${v ? `<span class="pill warn">${v}</span>` : '0'}</td>
        <td class="num">${out ? `<span class="pill bad">${out}</span>` : '0'}</td>
        <td class="num">${oleActs.length || '—'}</td>
        <td>${statusPill(o.status)}</td>
        <td class="nowrap">${fmtDate(o.date || o.createdAt)}</td>
        <td class="num"><button class="icon-btn" data-del="${o.id}" title="Delete OLE" aria-label="Delete OLE"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button></td>
      </tr>`;
  };

  root.innerHTML = `
    <header class="view-head">
      <div><h1>Operational Learning Events</h1><p class="muted">Learn how work is really done: steps, findings, variability and traceable actions.</p></div>
      <a class="btn primary" href="#/oles/new">+ New OLE</a>
    </header>

    <section class="kpi-grid">
      ${kpi('OLEs', k.total, `${k.month} this month`)}
      ${kpi('Findings', k.findings, `${k.fourD} with 4D mapping`)}
      ${kpi('Variabilities', k.variabilities, 'deviations from standard', k.variabilities ? 'warn' : 'good')}
      ${kpi('Outside swimlane', k.outside, 'systemic findings', k.outside ? 'bad' : '')}
      ${kpi('Open actions', k.openActions, `${k.overdueActions} overdue`, k.overdueActions ? 'bad' : '')}
      ${kpi('Closed OLEs', k.closed, '')}
    </section>

    <section class="card-grid">
      <div class="card span2"><h3>OLEs per month</h3>${lineChart(months, { color: '#E2001A' })}</div>
      <div class="card"><h3>By status</h3><div class="center">${donutChart(byStatus, { drills: statusDrills })}</div>${legend(byStatus)}</div>
      <div class="card span3"><h3>Findings by 4D</h3>${hbarChart(fourD, { color: '#b07d44' })}<p class="hint">▲▼ vs last month.</p></div>
    </section>

    <div class="toolbar">
      <input id="q" class="search" placeholder="Search ref, title, facilitator, city…"/>
      <select id="fStatus" class="select"><option value="">All status</option>${OLE_STATUSES.map((s) => `<option value="${s.id}">${s.label}</option>`).join('')}</select>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Ref / title</th><th>Facilitator / site</th><th class="num">Steps</th><th class="num">Findings</th><th class="num">Var.</th><th class="num">Outside</th><th class="num">Actions</th><th>Status</th><th>Date</th><th></th></tr></thead>
        <tbody id="rows">${all.sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt)).map(row).join('') || '<tr><td colspan="10" class="empty"><b>No learning events yet.</b><br>Run your first OLE to learn how work is really done.<br><br><a class="btn primary" href="#/oles/new">+ New OLE</a></td></tr>'}</tbody>
      </table>
    </div>
  `;

  const q = root.querySelector('#q');
  const fStatus = root.querySelector('#fStatus');
  const apply = () => {
    const term = q.value.toLowerCase(); const st = fStatus.value;
    root.querySelectorAll('#rows tr.rowlink').forEach((tr) => {
      const o = all.find((x) => x.id === tr.dataset.id);
      const hay = `${o.refNo} ${o.title} ${o.task} ${o.facilitator} ${o.location.city} ${o.location.zone}`.toLowerCase();
      tr.style.display = (!term || hay.includes(term)) && (!st || o.status === st) ? '' : 'none';
    });
  };
  q.addEventListener('input', apply); fStatus.addEventListener('change', apply);

  // donut drill → toggle the local status filter
  root.addEventListener('click', (e) => {
    const d = e.target.closest && e.target.closest('[data-drill]');
    if (!d || !root.contains(d)) return;
    const value = d.dataset.drill.split(':')[1];
    fStatus.value = fStatus.value === value ? '' : value;
    apply();
    fStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  root.querySelector('#rows').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      if (await confirmDialog('Delete this OLE and its actions?')) {
        for (const a of (await store.actions()).filter((x) => x.oleId === del.dataset.del)) await store.delAction(a.id);
        await store.delOle(del.dataset.del); toast('OLE deleted'); renderOles(root);
      }
      return;
    }
    const tr = e.target.closest('tr.rowlink');
    if (tr) location.hash = `#/ole/${tr.dataset.id}`;
  });
}
