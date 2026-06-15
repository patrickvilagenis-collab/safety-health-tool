// views/accidents.js — Accident Reporting overview: dashboard, filters, list.

import { store, buildAccidentKpis, accidentsByMonth, accidentsBy, accidentControlSplit, monthDeltas } from '../store.js';
import { ACCIDENT_TYPES, getAccidentType, getMethodology, METHODOLOGIES, accidentEnergyIds } from '../accidents.js';
import { ENERGY_TYPES } from '../checklists.js';
import { hbarChart, lineChart, donutChart, legend, PALETTE } from '../charts.js';
import { monthLabel, fmtDate, esc, toast, confirmDialog } from '../utils.js';
import { accFilterButton, filterAccidents, accActiveChips, accFilters, setAccFilter } from '../accidentFilters.js';

export async function renderAccidents(root) {
  const [allAccidents, actions] = await Promise.all([store.accidents(), store.actions()]);
  const reportedAll = allAccidents.filter((a) => a.status !== 'draft');
  const list = filterAccidents(allAccidents);
  const reported = list.filter((a) => a.status !== 'draft');
  const k = buildAccidentKpis(list, actions);

  const months = accidentsByMonth(reported).map(([m, n]) => [monthLabel(m), n]);
  const accDate = (a) => a.occurredAt || a.createdAt;
  const typeDelta = monthDeltas(reported, accDate, (a) => a.type);
  const energyDelta = monthDeltas(reported, accDate, (a) => accidentEnergyIds(a));
  const zoneDelta = monthDeltas(reported, accDate, (a) => a.location.zone || '—');

  const typeCounts = {};
  for (const a of reported) typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  const typeList = ACCIDENT_TYPES.filter((t) => typeCounts[t.id]);
  const byType = typeList.map((t) => [t.short, typeCounts[t.id], typeDelta[t.id] ?? null]);
  const typeDrills = typeList.map((t) => 'type:' + t.id);

  const energyCounts = {};
  for (const a of reported) {
    for (const id of accidentEnergyIds(a)) energyCounts[id] = (energyCounts[id] || 0) + 1;
  }
  const energySorted = Object.entries(energyCounts).sort((x, y) => y[1] - x[1]);
  const byEnergy = energySorted.map(([id, n]) => {
    const e = ENERGY_TYPES.find((x) => x.id === id);
    return [e ? `${e.icon} ${e.label}` : id, n, energyDelta[id] ?? null];
  });
  const energyDrills = energySorted.map(([id]) => 'energyType:' + id);

  const byZone = accidentsBy(reported, (a) => a.location.zone || '—').map(([k, n]) => [k, n, zoneDelta[k] ?? null]);
  const zoneDrills = byZone.map(([k]) => (k === '—' ? null : 'zone:' + k));
  const ctrl = accidentControlSplit(reported);

  const kpi = (label, value, sub, tone = '') =>
    `<div class="kpi ${tone}"><div class="kpi-val">${value}</div><div class="kpi-lbl">${label}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`;

  const typeBadge = (id) => { const t = getAccidentType(id); return t ? `<span class="atype ${t.tone}">${esc(t.short)}</span>` : '—'; };

  const row = (a) => `
    <tr data-id="${a.id}" class="rowlink">
      <td>${typeBadge(a.type)}</td>
      <td><b>${esc(a.refNo)}</b><div class="sub">${esc(a.location.city || '')}${a.location.zone ? ' · ' + esc(a.location.zone) : ''}</div></td>
      <td>${esc((a.description || '').slice(0, 60))}${(a.description || '').length > 60 ? '…' : ''}</td>
      <td>${esc(a.injuredPerson || '—')}<div class="sub">${esc(a.employeeType || '')}</div></td>
      <td>${a.directControlPresent ? '<span class="pill good">Yes</span>' : '<span class="pill bad">No</span>'}</td>
      <td>${a.methodology ? esc((getMethodology(a.methodology) || {}).label || '') : '<span class="muted">—</span>'}</td>
      <td><span class="status ${a.status}">${esc(a.status)}</span></td>
      <td class="nowrap">${fmtDate(a.occurredAt || a.createdAt)}</td>
      <td class="num"><button class="icon-btn" data-del="${a.id}" title="Delete report" aria-label="Delete accident report"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button></td>
    </tr>`;

  root.innerHTML = `
    <header class="view-head">
      <div><h1>Accident reporting</h1><p class="muted">Energy-based incident classification, investigation (RCA) and corrective actions.</p></div>
      <div class="row-gap"><span id="filterMount"></span><a class="btn primary" href="#/accidents/new">+ New accident report</a></div>
    </header>
    <div id="chipMount"></div>

    <section class="kpi-grid">
      ${kpi('Incidents', k.total, `${k.month} this month`)}
      ${kpi('SIF events', k.sif, 'High + Low Energy SIF', k.sif ? 'bad' : 'good')}
      ${kpi('Serious near misses', k.psif, 'pSIF', k.psif ? 'warn' : '')}
      ${kpi('High energy, no control', k.highEnergyNoControl, 'SIF potential', k.highEnergyNoControl ? 'bad' : 'good')}
      ${kpi('Open investigations', k.openInvestigations, '')}
      ${kpi('Open actions', k.openActions, `${k.overdueActions} overdue`, k.overdueActions ? 'bad' : '')}
    </section>

    <section class="card-grid">
      <div class="card span2"><h3>Incidents per month</h3>${lineChart(months, { color: '#E2001A' })}</div>
      <div class="card"><h3>By classification (SIF)</h3>${hbarChart(byType, { color: '#E2001A', drills: typeDrills })}<p class="hint">▲▼ vs last month · click to filter.</p></div>
      <div class="card"><h3>Direct control present?</h3><div class="center">${donutChart(ctrl, { colors: ['#1b9e5a', '#cc1122'], drills: ['control:with', 'control:without'] })}</div>${legend(ctrl, { colors: ['#1b9e5a', '#cc1122'] })}</div>
      <div class="card"><h3>Energy involved</h3>${hbarChart(byEnergy, { color: '#b07d44', drills: energyDrills })}</div>
      <div class="card"><h3>By zone / hub</h3>${hbarChart(byZone, { color: '#2b2f36', drills: zoneDrills })}</div>
    </section>

    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Type</th><th>Ref / site</th><th>What happened</th><th>Person</th><th>Control</th><th>RCA</th><th>Status</th><th>Date</th><th></th></tr></thead>
        <tbody id="rows">${reported.map(row).join('') || '<tr><td colspan="9" class="empty"><b>No accident reports match the current filters.</b><br>Clear the filters above, or record a new incident.<br><br><a class="btn primary" href="#/accidents/new">+ New accident report</a></td></tr>'}</tbody>
      </table>
    </div>
  `;

  const rerender = () => renderAccidents(root);
  root.querySelector('#filterMount').append(accFilterButton(reportedAll, rerender));
  const chips = accActiveChips(rerender);
  if (chips) root.querySelector('#chipMount').append(chips);

  root.addEventListener('click', (e) => {
    const d = e.target.closest && e.target.closest('[data-drill]');
    if (!d || !root.contains(d)) return;
    const i = d.dataset.drill.indexOf(':');
    const key = d.dataset.drill.slice(0, i), value = d.dataset.drill.slice(i + 1);
    setAccFilter(key, accFilters[key] === value ? '' : value);
    rerender();
  });

  root.querySelector('#rows').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      if (await confirmDialog('Delete this accident report?')) {
        for (const a of (await store.actions()).filter((x) => x.accidentId === del.dataset.del)) await store.delAction(a.id);
        await store.delAccident(del.dataset.del);
        toast('Accident report deleted');
        renderAccidents(root);
      }
      return;
    }
    const tr = e.target.closest('tr.rowlink');
    if (tr) location.hash = `#/accident/${tr.dataset.id}`;
  });
}

export function renderNewAccident(root) {
  root.innerHTML = `
    <header class="view-head"><div><h1>New accident report</h1><p class="muted">Select the energy-based classification. You can change it later; drafts auto-save.</p></div></header>
    <section class="picker-grid">
      ${ACCIDENT_TYPES.map((t) => `
        <a class="picker atype-card ${t.tone}" href="#/accidents/new/${t.id}">
          <div class="atype-tag ${t.tone}">${esc(t.label)}</div>
          <p>${esc(t.desc)}</p>
          <div class="picker-meta">
            <span class="chip">${t.highEnergy === true ? 'High energy' : t.highEnergy === false ? 'Low energy' : 'Energy assessed per case'}</span>
            ${t.control === true ? '<span class="chip">Control present</span>' : t.control === false ? '<span class="chip">No direct control</span>' : ''}
            ${t.sif ? '<span class="chip">SIF</span>' : ''}
          </div>
        </a>`).join('')}
    </section>
  `;
}
