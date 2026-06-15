// views/dashboard.js — Overview: a cross-module summary (visits + accidents +
// OLE + Intelligence teaser). The EBS/compliance deep-dives live in their own
// homes (Intelligence and Analysis); this page never duplicates them.

import { store, buildKpis, buildAccidentKpis, buildOleKpis, actionsByStatus } from '../store.js';
import { hbarChart, donutChart, legend, sparkline } from '../charts.js';
import { monthKey, fmtDate, esc } from '../utils.js';
import { extractExposures, sifPrecursors, barrierHealth } from '../intel.js';
import { getAccidentType } from '../accidents.js';
import { icons } from '../icons.js';

function lastMonths(n) {
  const out = []; const d = new Date(); d.setDate(1);
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setMonth(d.getMonth() - i); out.push(monthKey(x.toISOString())); }
  return out;
}
function series(items, dateFn) {
  const keys = lastMonths(6); const m = {};
  for (const it of items) { const k = monthKey(dateFn(it) || ''); if (k) m[k] = (m[k] || 0) + 1; }
  const vals = keys.map((k) => m[k] || 0);
  return { vals, total: items.length, month: vals[vals.length - 1], delta: vals.length > 1 ? vals[vals.length - 1] - vals[vals.length - 2] : 0 };
}

export async function renderDashboard(root) {
  const [visits, accidents, oles, actions] = await Promise.all([store.visits(), store.accidents(), store.oles(), store.actions()]);
  const submitted = visits.filter((v) => v.status === 'submitted');
  const reported = accidents.filter((a) => a.status !== 'draft');
  const vk = buildKpis(visits, actions);
  const ak = buildAccidentKpis(accidents, actions);
  const ok = buildOleKpis(oles, actions);
  const openActions = actions.filter((a) => a.status !== 'Closed' && a.status !== 'Implemented');
  const overdue = openActions.filter((a) => a.dueDate && new Date(a.dueDate) < new Date());
  const exposures = extractExposures(visits, accidents);
  const pre = sifPrecursors(exposures);
  const barrier = barrierHealth(exposures);

  const vMon = series(submitted, (v) => v.general.date || v.createdAt);
  const aMon = series(reported, (a) => a.occurredAt || a.createdAt);
  const oMon = series(oles, (o) => o.date || o.createdAt);

  const modDonut = [['Field visits', submitted.length], ['Accidents', reported.length], ['OLEs', oles.length]];
  const actStatus = actionsByStatus(actions);

  const feed = [
    ...submitted.map((v) => ({ icon: 'visits', t: v.templateName, sub: `${v.general.observer || ''}${v.general.city ? ' · ' + v.general.city : ''}`, date: v.general.date || v.createdAt, href: `#/visit/${v.id}` })),
    ...reported.map((a) => ({ icon: 'accidents', t: `${a.refNo} · ${(getAccidentType(a.type) || {}).short || ''}`, sub: (a.location || {}).city || '', date: a.occurredAt || a.createdAt, href: `#/accident/${a.id}` })),
    ...oles.map((o) => ({ icon: 'ole', t: `${o.refNo} · ${o.title || o.task || 'OLE'}`, sub: o.facilitator || '', date: o.date || o.createdAt, href: `#/ole/${o.id}` })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 7);

  const deltaChip = (d) => d ? `<span class="delta ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}</span>` : '';
  const kpi = (label, value, sub, tone = '', extra = '', href = '') => {
    const inner = `<div class="kpi ${tone} ${href ? 'kpi-link' : ''}"><div class="kpi-val">${value}</div><div class="kpi-lbl">${label}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}${extra}</div>`;
    return href ? `<a href="${href}">${inner}</a>` : inner;
  };

  root.innerHTML = `
    <header class="view-head">
      <div><h1>Overview</h1><p class="muted">Organisation-wide snapshot across field visits, accidents and learning events.</p></div>
      <div class="row-gap"><a class="btn" href="#/intel">${icons.intel} Intelligence</a><a class="btn primary" href="#/new">+ New field visit</a></div>
    </header>

    <section class="kpi-grid">
      ${kpi('Field visits', vk.totalVisits, `${vk.visitsThisMonth} this month ${deltaChip(vMon.delta)}`, '', `<div class="kpi-spark">${sparkline(vMon.vals)}</div>`, '#/visits')}
      ${kpi('Avg. compliance', vk.avgScore != null ? vk.avgScore + '%' : '—', `${vk.totalVariabilities} variabilities`, vk.avgScore != null && vk.avgScore < 80 ? 'warn' : 'good', '', '#/analysis')}
      ${kpi('Accidents', ak.total, `${ak.sif} SIF · ${ak.month} this month ${deltaChip(aMon.delta)}`, ak.sif ? 'bad' : '', `<div class="kpi-spark">${sparkline(aMon.vals, { color: '#cc1122' })}</div>`, '#/accidents')}
      ${kpi('Learning events', ok.total, `${ok.findings} findings · ${ok.variabilities} variabilities`, '', `<div class="kpi-spark">${sparkline(oMon.vals, { color: '#5b7795' })}</div>`, '#/oles')}
      ${kpi('Open actions', openActions.length, `${overdue.length} overdue`, overdue.length ? 'bad' : '', '', '#/actions')}
      ${kpi('SIF precursors', pre.total, 'high-energy · no control', pre.total ? 'bad' : 'good', '', '#/intel')}
    </section>

    <a class="intel-teaser" href="#/intel">
      <div class="it-left">
        <div class="it-num">${pre.total}</div>
        <div><h2>Your next SIF is likely already in your system</h2>
          <p>${pre.total} high-energy ${pre.total === 1 ? 'exposure' : 'exposures'} without an effective direct control · barrier coverage ${barrier.coverage != null ? barrier.coverage + '%' : '—'}. Open Intelligence for the heatmap, patterns and predictive model →</p></div>
      </div>
      <div class="it-chips">${pre.groups.slice(0, 4).map((g) => `<span class="it-chip">${g.energyIcon} ${esc(g.energyLabel)} · ${esc(g.zoneLabel)} <b>${g.count}</b></span>`).join('') || '<span class="it-chip good">No uncontrolled high-energy exposures</span>'}</div>
    </a>

    <section class="card-grid">
      <div class="card span2">
        <h3>Activity (last 6 months)</h3>
        <div class="act-rows">
          ${[['Field visits', vMon, '#/visits', '#E2001A'], ['Accidents', aMon, '#/accidents', '#39414f'], ['Learning events', oMon, '#/oles', '#5b7795']].map(([lbl, s, href, col]) => `
            <a class="act-row" href="${href}">
              <span class="act-lbl"><i class="dot" style="background:${col}"></i>${lbl}</span>
              <span class="act-spark">${sparkline(s.vals, { color: col, w: 200 })}</span>
              <span class="act-num">${s.month} ${deltaChip(s.delta)}</span>
            </a>`).join('')}
        </div>
      </div>
      <div class="card">
        <h3>Records by module</h3>
        <div class="center">${donutChart(modDonut, { colors: ['#E2001A', '#39414f', '#5b7795'] })}</div>
        ${legend(modDonut, { colors: ['#E2001A', '#39414f', '#5b7795'] })}
      </div>

      <div class="card">
        <h3>Open actions by status</h3>
        ${hbarChart(actStatus, { color: '#2b2f36' })}
        <p class="hint"><a class="link" href="#/actions">Open the action tracker →</a></p>
      </div>
      <div class="card span2">
        <h3>Recent activity</h3>
        ${feed.length ? `<div class="feed">${feed.map((f) => `<a class="feed-row" href="${f.href}"><span class="feed-ic">${icons[f.icon] || ''}</span><span class="feed-tx"><b>${esc(f.t)}</b><small>${esc(f.sub)}</small></span><span class="feed-date">${fmtDate(f.date)}</span></a>`).join('')}</div>` : '<p class="hint">Nothing recorded yet — new visits, accident reports and OLEs appear here.</p>'}
      </div>
    </section>
  `;

  countUpKpis(root);
}

// Animate KPI numbers on entry (skipped for users who prefer reduced motion).
function countUpKpis(root) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.querySelectorAll('.kpi-val').forEach((el) => {
    const m = /^(\d+)(%?)$/.exec(el.textContent.trim());
    if (!m) return;
    const target = +m[1];
    if (!target) return;
    const dur = 550, t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + m[2];
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
