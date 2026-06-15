// filters.js — shared, view-spanning filter drawer used by Dashboard,
// Analysis and Actions. State is kept in sessionStorage so the selection
// carries across views ("te vaya cambiando") during a session.

import { el, esc } from './utils.js';
import { ENERGY_TYPES, isControlEffective } from './checklists.js';

const KEY = 'shi_filters';
const DEFAULT = {
  type: '', region: '', zone: '', city: '', installationType: '',
  supervisor: '', technician: '', employeeType: '', hazard: '', controls: '',
  from: '', to: '',
};

export const filters = load();

function load() {
  try { return { ...DEFAULT, ...(JSON.parse(sessionStorage.getItem(KEY)) || {}) }; }
  catch { return { ...DEFAULT }; }
}
function save() { try { sessionStorage.setItem(KEY, JSON.stringify(filters)); } catch {} }

export function activeCount() { return Object.values(filters).filter((v) => v).length; }
export function resetFilters() { Object.assign(filters, DEFAULT); save(); }
export function setFilter(key, value) { filters[key] = value; save(); }

// Control coverage status for a whole visit (used by the "Controls" filter).
export function visitControlStatus(v) {
  const present = (v.energy || []).filter((e) => e.present);
  if (!present.length) return 'none';
  const missing = present.some((e) => !isControlEffective(e));
  return missing ? 'missing' : 'with';
}

export function matchVisit(v) {
  const g = v.general || {}, t = v.technical || {};
  if (filters.type && v.family !== filters.type) return false;
  if (filters.region && g.region !== filters.region) return false;
  if (filters.zone && g.zone !== filters.zone) return false;
  if (filters.city && g.city !== filters.city) return false;
  if (filters.installationType && t.installationType !== filters.installationType) return false;
  if (filters.supervisor && g.supervisor !== filters.supervisor) return false;
  if (filters.technician && g.technician !== filters.technician) return false;
  if (filters.employeeType && g.employeeType !== filters.employeeType) return false;
  if (filters.hazard && !(v.energy || []).some((e) => e.present && e.energyId === filters.hazard)) return false;
  if (filters.controls && visitControlStatus(v) !== filters.controls) return false;
  const d = g.date || (v.createdAt || '').slice(0, 10);
  if (filters.from && d < filters.from) return false;
  if (filters.to && d > filters.to) return false;
  return true;
}

export function filterVisits(list) { return list.filter(matchVisit); }

export function filterActions(actions, visits) {
  const byId = Object.fromEntries(visits.map((v) => [v.id, v]));
  const noFilters = activeCount() === 0;
  return actions.filter((a) => {
    if (a.accidentId || a.oleId) return true; // accident/OLE actions aren't affected by visit filters
    const v = byId[a.visitId];
    if (!v) return noFilters; // orphan actions only show when nothing is filtered
    return matchVisit(v);
  });
}

// Field-based filters (simple "distinct value of a property").
const FIELD_DEFS = [
  { key: 'type', label: 'Visit type', get: (v) => v.family },
  { key: 'region', label: 'Region', get: (v) => v.general.region },
  { key: 'zone', label: 'Zone / Hub', get: (v) => v.general.zone },
  { key: 'city', label: 'Location (city)', get: (v) => v.general.city },
  { key: 'installationType', label: 'Installation type', get: (v) => (v.technical || {}).installationType },
  { key: 'supervisor', label: 'Supervisor', get: (v) => v.general.supervisor },
  { key: 'technician', label: 'Technician', get: (v) => v.general.technician },
  { key: 'employeeType', label: 'Employee', get: (v) => v.general.employeeType },
];

const CONTROL_OPTIONS = [
  ['with', 'Controls present (all energies)'],
  ['missing', 'Missing / weak controls'],
  ['none', 'No energy assessed'],
];

// Returns a button element; clicking it opens the drawer. onChange re-renders
// the current view (live filtering). Pass the full (unfiltered) visit list so
// every option stays selectable.
export function filterButton(visits, onChange) {
  const n = activeCount();
  const btn = el('button', { class: `btn filter-btn ${n ? 'on' : ''}`, onClick: () => openDrawer(visits, onChange) });
  btn.innerHTML = `<span class="fi"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg></span> Filters${n ? ` <span class="fbadge">${n}</span>` : ''}`;
  return btn;
}

function distinct(visits, get) {
  return [...new Set(visits.map(get).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function openDrawer(visits, onChange) {
  document.getElementById('filterDrawer')?.remove();
  document.getElementById('filterScrim')?.remove();

  const scrim = el('div', { id: 'filterScrim', class: 'filter-scrim', onClick: close });
  const drawer = el('aside', { id: 'filterDrawer', class: 'filter-drawer' });

  const hazardsInData = new Set(visits.flatMap((v) => (v.energy || []).filter((e) => e.present).map((e) => e.energyId)));
  const hazardOpts = ENERGY_TYPES.filter((e) => hazardsInData.has(e.id));

  const fieldSelect = (def) => {
    const opts = distinct(visits, def.get);
    return `<label class="fdrawer-fld"><span>${esc(def.label)}</span>
      <select data-fkey="${def.key}"><option value="">All</option>
      ${opts.map((o) => `<option ${filters[def.key] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  };

  drawer.innerHTML = `
    <div class="fdrawer-head">
      <h3>Filters</h3>
      <button class="icon-btn" id="fClose" title="Close" aria-label="Close filters">✕</button>
    </div>
    <div class="fdrawer-body">
      ${FIELD_DEFS.map(fieldSelect).join('')}
      <label class="fdrawer-fld"><span>Hazard type (energy)</span>
        <select data-fkey="hazard"><option value="">All</option>
        ${hazardOpts.map((e) => `<option value="${e.id}" ${filters.hazard === e.id ? 'selected' : ''}>${e.icon} ${esc(e.label)}</option>`).join('')}</select></label>
      <label class="fdrawer-fld"><span>Controls</span>
        <select data-fkey="controls"><option value="">All</option>
        ${CONTROL_OPTIONS.map(([v, l]) => `<option value="${v}" ${filters.controls === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <div class="fdrawer-row">
        <label class="fdrawer-fld"><span>From</span><input type="date" data-fkey="from" value="${esc(filters.from)}"/></label>
        <label class="fdrawer-fld"><span>To</span><input type="date" data-fkey="to" value="${esc(filters.to)}"/></label>
      </div>
    </div>
    <div class="fdrawer-foot">
      <button class="btn ghost" id="fClear">Clear all</button>
      <button class="btn primary" id="fApply">Done</button>
    </div>`;

  function close() { drawer.classList.remove('open'); scrim.classList.remove('open'); setTimeout(() => { drawer.remove(); scrim.remove(); }, 220); }

  drawer.addEventListener('change', (e) => {
    const k = e.target.dataset.fkey;
    if (!k) return;
    filters[k] = e.target.value;
    save();
    onChange();           // live re-render of the view behind the drawer
  });
  drawer.querySelector('#fClose').addEventListener('click', close);
  drawer.querySelector('#fApply').addEventListener('click', close);
  drawer.querySelector('#fClear').addEventListener('click', () => { resetFilters(); onChange(); openDrawer(visits, onChange); });

  document.body.append(scrim, drawer);
  requestAnimationFrame(() => { drawer.classList.add('open'); scrim.classList.add('open'); });
}

// Compact summary of active filters (chips) for display at the top of a view.
export function activeFilterChips(onChange) {
  const active = Object.entries(filters).filter(([, v]) => v);
  if (!active.length) return '';
  const labelFor = (k, v) => {
    if (k === 'hazard') { const e = ENERGY_TYPES.find((x) => x.id === v); return e ? `${e.icon} ${e.label}` : v; }
    if (k === 'controls') return ({ with: 'Controls present', missing: 'Missing controls', none: 'No energy' }[v] || v);
    if (k === 'from') return `From ${v}`;
    if (k === 'to') return `To ${v}`;
    return v;
  };
  const wrap = el('div', { class: 'filter-chips' });
  wrap.innerHTML = active.map(([k, v]) => `<span class="fchip" data-clear="${k}">${esc(labelFor(k, v))} ✕</span>`).join('')
    + '<span class="fchip clear-all" data-clear="__all">Clear all</span>';
  wrap.addEventListener('click', (e) => {
    const c = e.target.closest('[data-clear]'); if (!c) return;
    if (c.dataset.clear === '__all') resetFilters(); else { filters[c.dataset.clear] = ''; save(); }
    onChange();
  });
  return wrap;
}
