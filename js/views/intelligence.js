// views/intelligence.js — Predictive Safety Analytics dashboard.

import { store } from '../store.js';
import {
  extractExposures, sifPrecursors, riskMatrix, hotspots, barrierHealth, sifFunnel,
  minePatterns, buildModel, rankByModel, recommendations, energyLabel, zoneLabel,
} from '../intel.js';
import { ENERGY_TYPES, DANGER_ZONES } from '../checklists.js';
import { heatmap, gauge } from '../charts.js';
import { esc } from '../utils.js';

function driverBars(drivers) {
  if (!drivers.length) return '<p class="hint">Model needs more reports to learn.</p>';
  const maxAbs = Math.max(...drivers.map((d) => Math.abs(d.weight)), 0.01);
  return `<div class="drivers">${drivers.map((d) => {
    const pos = d.weight >= 0;
    const w = Math.round((Math.abs(d.weight) / maxAbs) * 100);
    return `<div class="driver-row"><span class="driver-name">${esc(d.name)}</span>
      <span class="driver-bar"><i class="${pos ? 'up' : 'down'}" style="width:${w}%"></i></span>
      <span class="driver-w ${pos ? 'up' : 'down'}">${pos ? '+' : ''}${d.weight}</span></div>`;
  }).join('')}</div>`;
}

export async function renderIntelligence(root) {
  const [visits, accidents, actions] = await Promise.all([store.visits(), store.accidents(), store.actions()]);
  const exposures = extractExposures(visits, accidents);

  const pre = sifPrecursors(exposures);
  const matrix = riskMatrix(exposures);
  const hots = hotspots(exposures, actions);
  const barrier = barrierHealth(exposures);
  const funnel = sifFunnel(exposures);
  const patterns = minePatterns(exposures);
  const model = buildModel(exposures);
  const ranked = rankByModel(exposures, model, 8);
  const recs = recommendations(pre, hots, barrier);

  const topDrivers = model.drivers.slice(0, 8);

  root.innerHTML = `
    <header class="view-head">
      <div><h1>Predictive Safety Intelligence</h1>
        <p class="muted">Leading-indicator analytics on your data — Energy-Based Safety, SIF precursors, barriers and an explainable model.</p></div>
    </header>

    <section class="hero-sif">
      <div class="hero-sif-main">
        <div class="hero-sif-num">${pre.total}</div>
        <div>
          <h2>Your next SIF is likely already in your system</h2>
          <p>${pre.total} high-energy ${pre.total === 1 ? 'exposure is' : 'exposures are'} currently recorded <b>without an effective direct control</b> — the precondition for a Serious Injury or Fatality. These are where to focus first.</p>
        </div>
      </div>
      <div class="hero-sif-list">
        ${pre.groups.slice(0, 6).map((g) => `
          <div class="precursor">
            <div class="precursor-energy">${g.energyIcon} ${esc(g.energyLabel)}</div>
            <div class="precursor-meta">${esc(g.zoneLabel)}${g.location && g.location !== '—' ? ' · ' + esc(g.location) : ''}</div>
            <div class="precursor-stats"><span class="pill bad">${g.count} uncontrolled</span>${g.sif ? `<span class="pill bad">${g.sif} SIF</span>` : ''}<span class="risk-score">risk ${g.risk}</span></div>
          </div>`).join('') || '<p class="hint">No uncontrolled high-energy exposures recorded yet.</p>'}
      </div>
    </section>

    <section class="card focus-card">
      <h3>Recommended focus (auto-generated)</h3>
      ${recs.length ? `<ol class="focus-list">${recs.map((r) => `<li><span class="prio ${r.priority.toLowerCase()}">${r.priority}</span> ${esc(r.text)}</li>`).join('')}</ol>` : '<p class="hint">No priority recommendations — keep monitoring.</p>'}
    </section>

    <section class="card-grid">
      <div class="card">
        <h3>SIF potential funnel <span class="opt">(EBS)</span></h3>
        <div class="funnel">${funnel.steps.map(([l, n, tone], i) => `
          <div class="funnel-step ${tone}" style="width:${100 - i * 22}%"><b>${n}</b><span>${esc(l)}</span></div>`).join('')}</div>
        <p class="hint">SIFs come from high energy released without a direct control — not from the count of minor injuries.</p>
      </div>
      <div class="card">
        <h3>Barrier health — direct-control coverage</h3>
        <div class="center">${gauge(barrier.coverage, { label: 'high-energy covered' })}</div>
        <p class="hint">${barrier.covered}/${barrier.highEnergy} high-energy exposures have an effective direct control. ${barrier.uncovered} are exposed.</p>
      </div>
      <div class="card">
        <h3>Risk hotspots</h3>
        ${hots.length ? `<ul class="rank">${hots.map((h, i) => `<li><span class="rank-n" style="background:${i === 0 ? '#cc1122' : '#2b2f36'}">${i + 1}</span><span class="rank-lbl">${esc(h.loc)}<small class="hot-why"> · ${h.uncontrolledHE} uncontrolled HE${h.sif ? `, ${h.sif} SIF` : ''}${h.overdue ? `, ${h.overdue} overdue` : ''}</small></span><b>${h.risk}</b></li>`).join('')}</ul>` : '<p class="hint">No data.</p>'}
      </div>
    </section>

    <section class="card">
      <h3>Risk heatmap — energy × danger zone</h3>
      <p class="hint">Darker = more uncontrolled high-energy exposure (weighted by recency and prior SIF). This is where energy and missing barriers concentrate.</p>
      <div class="heatmap-wrap">${heatmap(matrix.rowLabels, matrix.colLabels, matrix.cells, { cell: 46 })}</div>
    </section>

    <section class="card-grid">
      <div class="card span2">
        <h3>Patterns that precede bad outcomes <span class="opt">(association mining)</span></h3>
        <p class="hint">Combinations that co-occur with SIF or uncontrolled high energy more than chance. <b>Lift</b> = how many times more likely than baseline.</p>
        ${patterns.length ? `<div class="pattern-list">${patterns.map((p) => `
          <div class="pattern">
            <div class="pattern-combo">${esc(p.pattern)}</div>
            <div class="pattern-stats"><span class="pill bad">×${p.lift} lift</span><span class="pill warn">${p.confidence}% bad</span><span class="muted">${p.support} records</span></div>
          </div>`).join('')}</div>` : '<p class="hint">Not enough data yet to mine reliable patterns.</p>'}
      </div>
      <div class="card">
        <h3>What predicts a SIF in your data</h3>
        <p class="hint">Model weights — <b style="color:var(--bad)">red increases</b> predicted SIF risk, <b style="color:var(--good)">green decreases</b> it.</p>
        ${driverBars(topDrivers)}
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h3>Predictive model — what-if estimator</h3>
        <span class="${model.trained ? 'pill good' : 'pill warn'}">${model.trained ? `trained · ${model.samples} exposures` : 'learning'}</span></div>
      <p class="hint">Logistic regression trained on your exposures (energy, danger zone, high-energy, control effectiveness, workforce). Estimate the SIF probability of a scenario.</p>
      <div class="grid4 whatif">
        <label class="fld"><span>Energy</span><select id="wfEnergy">${ENERGY_TYPES.map((e) => `<option value="${e.id}">${e.icon} ${e.label}</option>`).join('')}</select></label>
        <label class="fld"><span>Danger zone</span><select id="wfZone"><option value="">—</option>${DANGER_ZONES.map((z) => `<option value="${z.id}">${z.icon} ${z.label}</option>`).join('')}</select></label>
        <label class="chk"><input type="checkbox" id="wfHigh" checked/> High energy</label>
        <label class="chk"><input type="checkbox" id="wfNoCtrl" checked/> No effective control</label>
        <label class="chk"><input type="checkbox" id="wfSub"/> Subcontractor</label>
      </div>
      <div class="whatif-out" id="wfOut"></div>
    </section>

    <section class="card">
      <h3>Open precursors ranked by predicted SIF risk</h3>
      <p class="hint">Current field exposures (high energy, no effective control), highest model risk first — your queue.</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Energy</th><th>Zone</th><th>Location</th><th>Workforce</th><th class="num">Predicted SIF risk</th><th class="num">Source</th></tr></thead>
        <tbody>${ranked.map((x) => `<tr>
          <td>${esc(energyLabel(x.energy))}</td><td>${esc(zoneLabel(x.zone))}</td><td>${esc(x.zoneName || x.city || '—')}</td><td>${esc(x.employeeType || '—')}</td>
          <td class="num"><span class="pill ${x.p > 0.6 ? 'bad' : x.p > 0.35 ? 'warn' : 'good'}">${Math.round(x.p * 100)}%</span></td>
          <td class="num"><a class="link" href="#/visit/${x.id}">open ↗</a></td></tr>`).join('') || '<tr><td colspan="6" class="empty">No open precursors.</td></tr>'}</tbody></table></div>
    </section>

    <p class="intel-note">ℹ️ Grounded in Energy-Based Safety and SIF-precursor methodology used across aerospace, oil & gas and process industries. Everything is computed in your browser and fully explainable. On sample data results are illustrative; the model sharpens as real reports accumulate.</p>
  `;

  // what-if estimator
  const wf = () => {
    const x = {
      energy: root.querySelector('#wfEnergy').value,
      zone: root.querySelector('#wfZone').value,
      highEnergy: root.querySelector('#wfHigh').checked,
      effective: !root.querySelector('#wfNoCtrl').checked,
      employeeType: root.querySelector('#wfSub').checked ? 'Subcontractor' : 'Schindler',
    };
    const p = model.predict(model.featOf(x));
    const band = p > 0.6 ? 'bad' : p > 0.35 ? 'warn' : 'good';
    const word = p > 0.6 ? 'HIGH' : p > 0.35 ? 'ELEVATED' : 'LOWER';
    root.querySelector('#wfOut').innerHTML = `<div class="wf-result ${band}"><div class="wf-pct">${Math.round(p * 100)}%</div><div class="wf-word">${word} predicted SIF risk</div></div>`;
  };
  root.querySelectorAll('.whatif select, .whatif input').forEach((el) => el.addEventListener('input', wf));
  wf();
}
