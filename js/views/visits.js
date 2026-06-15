// views/visits.js — list of visits + template picker for new visits.

import { store, visitScore, countPhotos, visitVariabilities } from '../store.js';
import { TEMPLATE_LIST } from '../checklists.js';
import { fmtDate, esc, toast, confirmDialog } from '../utils.js';

export async function renderVisits(root) {
  const visits = (await store.visits()).sort((a, b) => (b.general.date || b.createdAt).localeCompare(a.general.date || a.createdAt));

  const row = (v) => {
    const s = visitScore(v);
    const vars = visitVariabilities(v).length;
    const photos = countPhotos(v);
    const scoreBadge = s.score == null ? '<span class="pill muted">—</span>'
      : `<span class="pill ${s.score >= 90 ? 'good' : s.score >= 75 ? 'warn' : 'bad'}">${s.score}%</span>`;
    return `
      <tr data-id="${v.id}" class="rowlink">
        <td><span class="status ${v.status}">${v.status === 'draft' ? 'Draft' : 'Submitted'}</span></td>
        <td><b>${esc(v.templateName)}</b><div class="sub">${esc(v.general.city || '')}${v.general.branch ? ' · ' + esc(v.general.branch) : ''}</div></td>
        <td>${esc(v.general.observer || '—')}</td>
        <td>${esc(v.general.technician || '—')}<div class="sub">${esc(v.general.employeeType || '')}</div></td>
        <td class="nowrap">${fmtDate(v.general.date || v.createdAt)}</td>
        <td class="num">${scoreBadge}</td>
        <td class="num">${vars ? `<span class="pill bad">${vars}</span>` : '0'}</td>
        <td class="num">${photos ? `📎 ${photos}` : '—'}</td>
        <td class="num"><button class="icon-btn del" data-del="${v.id}" title="Delete visit" aria-label="Delete visit"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button></td>
      </tr>`;
  };

  root.innerHTML = `
    <header class="view-head">
      <div><h1>Field visits</h1><p class="muted">${visits.length} ${visits.length === 1 ? 'record' : 'records'} · stored locally, available offline.</p></div>
      <a class="btn primary" href="#/new">+ New field visit</a>
    </header>
    <div class="toolbar">
      <input id="q" class="search" placeholder="Search observer, technician, city, type…" />
      <select id="fstatus" class="select"><option value="">All status</option><option value="draft">Drafts</option><option value="submitted">Submitted</option></select>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Status</th><th>Type / site</th><th>Observer</th><th>Technician</th><th>Date</th><th class="num">Score</th><th class="num">Var.</th><th class="num">Photos</th><th></th></tr></thead>
        <tbody id="rows">${visits.map(row).join('') || `<tr><td colspan="9" class="empty"><b>No field visits yet.</b><br>Capture your first observation in under two minutes.<br><br><a class="btn primary" href="#/new">+ New field visit</a></td></tr>`}</tbody>
      </table>
    </div>
  `;

  const tbody = root.querySelector('#rows');
  const q = root.querySelector('#q');
  const fstatus = root.querySelector('#fstatus');
  const apply = () => {
    const term = q.value.toLowerCase();
    const st = fstatus.value;
    tbody.querySelectorAll('tr.rowlink').forEach((tr) => {
      const v = visits.find((x) => x.id === tr.dataset.id);
      const hay = `${v.templateName} ${v.general.observer} ${v.general.technician} ${v.general.city} ${v.general.branch}`.toLowerCase();
      const ok = (!term || hay.includes(term)) && (!st || v.status === st);
      tr.style.display = ok ? '' : 'none';
    });
  };
  q.addEventListener('input', apply);
  fstatus.addEventListener('change', apply);

  tbody.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      if (await confirmDialog('Delete this visit? This cannot be undone.')) {
        await store.delVisit(del.dataset.del);
        toast('Visit deleted');
        renderVisits(root);
      }
      return;
    }
    const tr = e.target.closest('tr.rowlink');
    if (tr) location.hash = `#/visit/${tr.dataset.id}`;
  });
}

export function renderNewVisit(root) {
  root.innerHTML = `
    <header class="view-head"><div><h1>New field visit</h1><p class="muted">Pick a checklist. You can pause and resume any time — drafts auto-save.</p></div></header>
    <section class="picker-grid">
      ${TEMPLATE_LIST.map((t) => `
        <a class="picker" href="#/new/${t.id}">
          <div class="picker-tag">${esc(t.family)}</div>
          <h3>${esc(t.name)}</h3>
          <p>${esc(t.description)}</p>
          <div class="picker-meta">
            ${t.hasEBS ? '<span class="chip">Energy-Based Safety</span>' : ''}
            ${t.isJHA ? '<span class="chip">JHA</span>' : ''}
            ${t.hasActions ? '<span class="chip">Actions</span>' : ''}
            <span class="chip">Photos</span>
          </div>
        </a>`).join('')}
    </section>
  `;
}
