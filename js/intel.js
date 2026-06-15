// intel.js — Predictive Safety Analytics.
//
// Turns the platform's records into leading-indicator intelligence, grounded in
// established high-hazard-industry practice:
//  • SIF precursor model (Energy-Based Safety): a Serious-Injury-or-Fatality is
//    likely where HIGH ENERGY meets a MISSING/INEFFECTIVE direct control.
//  • Hierarchy-of-controls "barrier health" (bow-tie thinking).
//  • Heinrich/Bird pyramid: leading vs lagging indicators.
//  • Risk matrix (likelihood × severity) by energy × location.
//  • Association-rule pattern mining (which combinations precede bad outcomes).
//  • An explainable logistic-regression model trained on YOUR data.
//
// Everything runs in the browser and is fully explainable. On demo data the
// numbers are illustrative; signal strengthens as real reports accumulate.

import { ENERGY_TYPES, DANGER_ZONES, isControlEffective } from './checklists.js';
import { getAccidentType, accidentEnergyIds, accidentHighEnergy } from './accidents.js';

const energyLabel = (id) => { const e = ENERGY_TYPES.find((x) => x.id === id); return e ? e.label : id; };
const energyIcon = (id) => { const e = ENERGY_TYPES.find((x) => x.id === id); return e ? e.icon : ''; };
const zoneLabel = (id) => { const z = DANGER_ZONES.find((x) => x.id === id); return z ? z.label : (id || '—'); };

// ---------------------------------------------------------------------------
// Exposure extraction — one row per (energy present) across visits & accidents.
// ---------------------------------------------------------------------------
export function extractExposures(visits, accidents) {
  const out = [];
  for (const v of visits) {
    if (v.status !== 'submitted') continue;
    const g = v.general || {};
    for (const e of v.energy || []) {
      if (!e.present || !e.energyId) continue;
      out.push({
        source: 'visit', id: v.id, date: g.date || v.createdAt,
        energy: e.energyId, zone: e.dangerZone || '', highEnergy: !!e.highEnergy,
        effective: isControlEffective(e), employeeType: g.employeeType || '', region: g.region || '',
        zoneName: g.zone || '', city: g.city || '', task: g.workType || '', equipment: '',
        sif: false, severity: e.highEnergy ? 'High' : 'Low', ref: v.templateName,
      });
    }
  }
  for (const a of accidents) {
    if (a.status === 'draft') continue;
    const t = getAccidentType(a.type);
    const sif = !!(t && t.sif) || (a.aip && ['Serious', 'Fatality'].includes(a.aip.severityRating));
    const rows = (Array.isArray(a.energy) ? a.energy.filter((e) => e.energyId) : []);
    const list = rows.length ? rows : accidentEnergyIds(a).map((id) => ({ energyId: id, dangerZone: '', highEnergy: a.highEnergy, controlCondition: a.directControlPresent ? 'works' : 'absent', directControl: a.directControlPresent, controlInPlace: a.directControlPresent ? 'conform' : 'variability' }));
    for (const e of list) {
      out.push({
        source: 'accident', id: a.id, date: a.occurredAt || a.createdAt,
        energy: e.energyId, zone: e.dangerZone || '', highEnergy: e.highEnergy != null ? !!e.highEnergy : accidentHighEnergy(a),
        effective: isControlEffective(e), employeeType: a.employeeType || '', region: a.location ? a.location.region : '',
        zoneName: a.location ? a.location.zone : '', city: a.location ? a.location.city : '', task: a.workType || '',
        equipment: a.aip ? a.aip.equipmentType : '', sif, severity: sif ? 'SIF' : (e.highEnergy ? 'High' : 'Low'),
        ref: t ? t.label : 'Accident', refNo: a.refNo,
      });
    }
  }
  return out;
}

function recency(date) {
  const d = (Date.now() - new Date(date).getTime()) / 86400000;
  return Math.max(0.4, 1 - d / 600);
}

// ---------------------------------------------------------------------------
// SIF precursors — "your next SIF is already in your system".
// ---------------------------------------------------------------------------
export function sifPrecursors(exposures) {
  const pre = exposures.filter((x) => x.highEnergy && !x.effective);
  const groups = {};
  for (const x of pre) {
    const key = `${x.energy}|${x.zone}|${x.zoneName || x.city}`;
    (groups[key] = groups[key] || { energy: x.energy, zone: x.zone, location: x.zoneName || x.city || '—', count: 0, sif: 0, recencyW: 0, items: [] }).count++;
    if (x.sif) groups[key].sif++;
    groups[key].recencyW += recency(x.date);
    groups[key].items.push(x);
  }
  const ranked = Object.values(groups).map((g) => ({
    ...g,
    energyLabel: energyLabel(g.energy), energyIcon: energyIcon(g.energy), zoneLabel: zoneLabel(g.zone),
    risk: Math.round(g.recencyW * (1 + g.sif) * 10),
  })).sort((a, b) => b.risk - a.risk);
  return { total: pre.length, groups: ranked };
}

// ---------------------------------------------------------------------------
// Risk matrix — energy × danger zone.
// ---------------------------------------------------------------------------
export function riskMatrix(exposures) {
  const energies = ENERGY_TYPES.map((e) => e.id);
  const zones = DANGER_ZONES.map((z) => z.id);
  const cells = energies.map(() => zones.map(() => ({ v: 0, label: 0 })));
  for (const x of exposures) {
    const r = energies.indexOf(x.energy); const c = zones.indexOf(x.zone);
    if (r < 0 || c < 0) continue;
    const w = (x.highEnergy && !x.effective ? 3 : x.highEnergy ? 1 : 0.3) * recency(x.date) * (x.sif ? 2 : 1);
    cells[r][c].v += w; cells[r][c].label = Math.round(cells[r][c].v);
  }
  return {
    rowLabels: ENERGY_TYPES.map((e) => `${e.icon} ${e.label}`),
    colLabels: DANGER_ZONES.map((z) => z.label),
    cells,
  };
}

// ---------------------------------------------------------------------------
// Hotspots — ranked locations by composite risk.
// ---------------------------------------------------------------------------
export function hotspots(exposures, actions, limit = 6) {
  const g = {};
  for (const x of exposures) {
    const loc = x.zoneName || x.city || '—';
    const o = (g[loc] = g[loc] || { loc, exposures: 0, uncontrolledHE: 0, sif: 0, recencyW: 0 });
    o.exposures++;
    if (x.highEnergy && !x.effective) o.uncontrolledHE++;
    if (x.sif) o.sif++;
    o.recencyW += recency(x.date);
  }
  const overdueByLoc = {};
  for (const a of actions) {
    if (a.status === 'Closed' || a.status === 'Implemented') continue;
    if (a.dueDate && new Date(a.dueDate) < new Date()) overdueByLoc[a.site || '—'] = (overdueByLoc[a.site || '—'] || 0) + 1;
  }
  return Object.values(g).map((o) => ({
    ...o, overdue: overdueByLoc[o.loc] || 0,
    risk: Math.round((o.uncontrolledHE * 4 + o.sif * 8 + (overdueByLoc[o.loc] || 0) * 2) * (o.recencyW / Math.max(1, o.exposures) + 0.5)),
  })).sort((a, b) => b.risk - a.risk).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Barrier health.
// ---------------------------------------------------------------------------
export function barrierHealth(exposures) {
  const he = exposures.filter((x) => x.highEnergy);
  const covered = he.filter((x) => x.effective).length;
  const coverage = he.length ? Math.round((covered / he.length) * 100) : null;
  return { highEnergy: he.length, covered, uncovered: he.length - covered, coverage };
}

// ---------------------------------------------------------------------------
// SIF potential funnel (EBS / direct-control logic — not a Heinrich triangle).
// SIFs are NOT the tip of a minor-injury pyramid: they arise from high-energy
// exposure released without an effective direct control. This funnel shows that
// pathway directly.
// ---------------------------------------------------------------------------
export function sifFunnel(exposures) {
  const he = exposures.filter((x) => x.highEnergy);
  const uncontrolled = he.filter((x) => !x.effective);
  const sif = exposures.filter((x) => x.sif);
  return {
    steps: [
      ['High-energy exposures', he.length, 'ok'],
      ['Without an effective direct control (SIF precursors)', uncontrolled.length, 'warn'],
      ['Released → SIF-class event', sif.length, 'bad'],
    ],
    conversion: he.length ? Math.round((uncontrolled.length / he.length) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// Pattern mining — association rules over exposures.
// ---------------------------------------------------------------------------
export function minePatterns(exposures, { minSupport = 2, limit = 8 } = {}) {
  const txns = exposures.map((x) => {
    const items = [`⚡ ${energyLabel(x.energy)}`];
    if (x.zone) items.push(`📍 ${zoneLabel(x.zone)}`);
    if (x.highEnergy && !x.effective) items.push('🛡️ no direct control');
    else if (!x.effective) items.push('control ineffective');
    if (x.employeeType === 'Subcontractor') items.push('👷 subcontractor');
    if (x.task) items.push(x.task.replace(/\s*\(.*\)/, ''));
    return { items, bad: x.sif || (x.highEnergy && !x.effective) };
  });
  const N = txns.length || 1;
  const badN = txns.filter((t) => t.bad).length || 1;
  const baseBadRate = badN / N;

  const counts = new Map(); const badCounts = new Map();
  const add = (combo, bad) => { const k = combo.join(' + '); counts.set(k, (counts.get(k) || 0) + 1); if (bad) badCounts.set(k, (badCounts.get(k) || 0) + 1); };
  for (const t of txns) {
    const it = [...new Set(t.items)].sort();
    for (let i = 0; i < it.length; i++) for (let j = i + 1; j < it.length; j++) {
      add([it[i], it[j]], t.bad);
      for (let k = j + 1; k < it.length; k++) add([it[i], it[j], it[k]], t.bad);
    }
  }
  const rules = [];
  for (const [k, sup] of counts) {
    if (sup < minSupport) continue;
    const bad = badCounts.get(k) || 0;
    const confidence = bad / sup;
    const lift = confidence / baseBadRate;
    if (lift <= 1.05 || bad === 0) continue;
    rules.push({ pattern: k, support: sup, bad, confidence: Math.round(confidence * 100), lift: +lift.toFixed(2) });
  }
  return rules.sort((a, b) => b.lift * b.support - a.lift * a.support).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Explainable logistic-regression model trained on the exposures.
// ---------------------------------------------------------------------------
export function buildModel(exposures) {
  const energies = ENERGY_TYPES.map((e) => e.id);
  const zones = DANGER_ZONES.map((z) => z.id);
  const featNames = [
    ...energies.map((e) => `⚡ ${energyLabel(e)}`),
    'High energy', 'No effective control', 'Subcontractor',
    ...zones.map((z) => `📍 ${zoneLabel(z)}`),
  ];
  const featOf = (x) => {
    const f = new Array(featNames.length).fill(0);
    const ei = energies.indexOf(x.energy); if (ei >= 0) f[ei] = 1;
    f[energies.length] = x.highEnergy ? 1 : 0;
    f[energies.length + 1] = x.effective ? 0 : 1;
    f[energies.length + 2] = x.employeeType === 'Subcontractor' ? 1 : 0;
    const zi = zones.indexOf(x.zone); if (zi >= 0) f[energies.length + 3 + zi] = 1;
    return f;
  };
  const samples = exposures.map((x) => ({ x: featOf(x), y: x.sif ? 1 : 0 }));
  const pos = samples.filter((s) => s.y === 1).length || 1;
  const neg = samples.length - pos || 1;
  const wPos = neg / pos, wNeg = 1;
  const n = featNames.length;
  let w = new Array(n).fill(0), b = 0;
  const lr = 0.3, l2 = 1.0, iters = 600;
  const sig = (z) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
  const trained = samples.length >= 4 && pos >= 1 && neg >= 1;
  if (trained) {
    for (let it = 0; it < iters; it++) {
      const gw = new Array(n).fill(0); let gb = 0, sw = 0;
      for (const s of samples) {
        const sgw = s.y ? wPos : wNeg; sw += sgw;
        const p = sig(b + w.reduce((a, wi, i) => a + wi * s.x[i], 0));
        const err = (p - s.y) * sgw;
        for (let i = 0; i < n; i++) gw[i] += err * s.x[i];
        gb += err;
      }
      sw = sw || 1;
      for (let i = 0; i < n; i++) w[i] -= lr * (gw[i] / sw + l2 * w[i] / samples.length);
      b -= lr * (gb / sw);
    }
  }
  const predict = (f) => sig(b + w.reduce((a, wi, i) => a + wi * f[i], 0));
  const drivers = featNames.map((name, i) => ({ name, weight: +w[i].toFixed(3) }))
    .filter((d) => Math.abs(d.weight) > 0.02).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  return { featNames, energies, zones, predict, featOf, drivers, b, trained, samples: samples.length, positives: pos };
}

export function rankByModel(exposures, model, limit = 8) {
  return exposures
    .filter((x) => x.source === 'visit' && x.highEnergy && !x.effective)
    .map((x) => ({ ...x, p: model.predict(model.featOf(x)) }))
    .sort((a, b) => b.p - a.p).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Recommendations.
// ---------------------------------------------------------------------------
export function recommendations(precursors, hots, barrier) {
  const recs = [];
  for (const g of precursors.groups.slice(0, 3)) {
    recs.push({
      priority: 'High',
      text: `Verify or install a direct control for ${g.energyIcon} ${g.energyLabel} at ${g.zoneLabel}${g.location && g.location !== '—' ? ' · ' + g.location : ''} — ${g.count} uncontrolled high-energy ${g.count === 1 ? 'exposure' : 'exposures'}${g.sif ? `, ${g.sif} already SIF-class` : ''}.`,
    });
  }
  if (barrier.coverage != null && barrier.coverage < 85) {
    recs.push({ priority: 'High', text: `Direct-control coverage of high-energy work is ${barrier.coverage}% (${barrier.uncovered} exposures without an effective control). Target ≥95%.` });
  }
  if (hots[0]) recs.push({ priority: 'Medium', text: `Focus a Safety Inspection / OLE on “${hots[0].loc}” — highest composite risk (${hots[0].uncontrolledHE} uncontrolled high-energy, ${hots[0].overdue} overdue actions).` });
  return recs;
}

export { energyLabel, energyIcon, zoneLabel };
