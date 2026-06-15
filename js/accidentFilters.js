// accidentFilters.js — filter drawer for the Accident Reporting module.
// Mirrors filters.js but works on the accident data shape.

import { el, esc } from './utils.js';
import { ACCIDENT_TYPES, METHODOLOGIES, accidentEnergyIds } from './accidents.js';
import { ENERGY_TYPES } from './checklists.js';
import { INCIDENT_DEFINITION, EQUIPMENT_TYPES } from './aip.js';

const KEY = 'shi_acc_filters';
const DEFAULT = {
  type: '', status: '', region: '', zone: '', city: '', category: '',
  energyType: '', control: '', employeeType: '', methodology: '',
  incidentDefinition: '', equipmentType: '', from: '', to: '',
};

export const accFilters = load();

function load() {
  try { return { ...DEFAULT, ...(JSON.parse(sessionStorage.getItem(KEY)) || {}) }; }
  catch { return { ...DEFAULT }; }
}
function save() { try { sessionStorage.setItem(KEY, JSON.stringify(accFilters)); } catch {} }
export function accActiveCount() { return Object.values(accFilters).filter((v) => v).length; }
export function resetAccFilters() { Object.assign(accFilters, DEFAULT); save(); }
export function setAccFilter(key, value) { accFilters[key] = value; save(); }

export function matchAccident(a) {
  const l = a.location || {};
  if (accFilters.type && a.type !== accFilters.type) return false;
  if (accFilters.status && a.status !== accFilters.status) return false;
  if (accFilters.region && l.region !== accFilters.region) return false;
  if (accFilters.zone && l.zone !== accFilters.zone) return false;
  if (accFilters.city && l.city !== accFilters.city) return false;
  if (accFilters.category && a.category !== accFilters.category) return false;
  if (accFilters.energyType && !accidentEnergyIds(a).includes(accFilters.energyType)) return false;
  if (accFilters.incidentDefinition && (a.aip || {}).incidentDefinition !== accFilters.incidentDefinition) return false;
  if (accFilters.equipmentType && (a.aip || {}).equipmentType !== accFilters.equipmentType) return false;
  if (accFilters.employeeType && a.employeeType !== accFilters.employeeType) return false;
  if (accFilters.methodology && a.methodology !== accFilters.methodology) return false;
  if (accFilters.control === 'with' && !a.directControlPresent) return false;
  if (accFilters.control === 'without' && a.directControlPresent) return false;
  const d = (a.occurredAt || a.createdAt || '').slice(0, 10);
  if (accFilters.from && d < accFilters.from) return false;
  if (accFilters.to && d > accFilters.to) return false;
  return true;
}

export function filterAccidents(list) { return list.filter(matchAccident); }

const FIELD_DEFS = [
  { key: 'region', label: 'Region', get: (a) => a.location.region },
  { key: 'zone', label: 'Zone / Hub', get: (a) => a.location.zone },
  { key: 'city', label: 'Location (city)', get: (a) => a.location.city },
  { key: 'category', label: 'Category', get: (a) => a.category },
  { key: 'employeeType', label: 'Employee', get: (a) => a.employeeType },
];

export function accFilterButton(accidents, onChange) {
  const n = accActiveCount();
  const btn = el('button', { class: `btn filter-btn ${n ? 'on' : ''}`, onClick: () => openDrawer(accidents, onChange) });
  btn.innerHTML = `<span class="fi"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg></span> Filters${n ? ` <span class="fbadge">${n}</span>` : ''}`;
  return btn;
}

function distinct(list, get) {
  return [...new Set(list.map(get).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function openDrawer(accidents, onChange) {
  document.getElementById('filterDrawer')?.remove();
  document.getElementById('filterScrim')?.remove();
  const scrim = el('div', { id: 'filterScrim', class: 'filter-scrim', onClick: close });
  const drawer = el('aside', { id: 'filterDrawer', class: 'filter-drawer' });

  const fieldSelect = (def) => {
    const opts = distinct(accidents, def.get);
    return `<label class="fdrawer-fld"><span>${esc(def.label)}</span>
      <select data-fkey="${def.key}"><option value="">All</option>
      ${opts.map((o) => `<option ${accFilters[def.key] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  };

  drawer.innerHTML = `
    <div class="fdrawer-head"><h3>Filters</h3><button class="icon-btn" id="fClose" title="Close" aria-label="Close filters">✕</button></div>
    <div class="fdrawer-body">
      <label class="fdrawer-fld"><span>Incident type</span>
        <select data-fkey="type"><option value="">All</option>
        ${ACCIDENT_TYPES.map((t) => `<option value="${t.id}" ${accFilters.type === t.id ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></label>
      <label class="fdrawer-fld"><span>Status</span>
        <select data-fkey="status"><option value="">All</option>
        ${['reported', 'investigation', 'closed'].map((s) => `<option ${accFilters.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      ${FIELD_DEFS.map(fieldSelect).join('')}
      <label class="fdrawer-fld"><span>Incident definition</span>
        <select data-fkey="incidentDefinition"><option value="">All</option>
        ${INCIDENT_DEFINITION.map((d) => `<option ${accFilters.incidentDefinition === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label>
      <label class="fdrawer-fld"><span>Equipment type</span>
        <select data-fkey="equipmentType"><option value="">All</option>
        ${EQUIPMENT_TYPES.map((d) => `<option ${accFilters.equipmentType === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label>
      <label class="fdrawer-fld"><span>Energy involved</span>
        <select data-fkey="energyType"><option value="">All</option>
        ${ENERGY_TYPES.map((e) => `<option value="${e.id}" ${accFilters.energyType === e.id ? 'selected' : ''}>${e.icon} ${esc(e.label)}</option>`).join('')}</select></label>
      <label class="fdrawer-fld"><span>Direct control</span>
        <select data-fkey="control"><option value="">All</option>
          <option value="with" ${accFilters.control === 'with' ? 'selected' : ''}>Control present</option>
          <option value="without" ${accFilters.control === 'without' ? 'selected' : ''}>No direct control</option></select></label>
      <label class="fdrawer-fld"><span>RCA methodology</span>
        <select data-fkey="methodology"><option value="">All</option>
        ${METHODOLOGIES.map((m) => `<option value="${m.id}" ${accFilters.methodology === m.id ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></label>
      <div class="fdrawer-row">
        <label class="fdrawer-fld"><span>From</span><input type="date" data-fkey="from" value="${esc(accFilters.from)}"/></label>
        <label class="fdrawer-fld"><span>To</span><input type="date" data-fkey="to" value="${esc(accFilters.to)}"/></label>
      </div>
    </div>
    <div class="fdrawer-foot"><button class="btn ghost" id="fClear">Clear all</button><button class="btn primary" id="fApply">Done</button></div>`;

  function close() { drawer.classList.remove('open'); scrim.classList.remove('open'); setTimeout(() => { drawer.remove(); scrim.remove(); }, 220); }

  drawer.addEventListener('change', (e) => {
    const k = e.target.dataset.fkey; if (!k) return;
    accFilters[k] = e.target.value; save(); onChange();
  });
  drawer.querySelector('#fClose').addEventListener('click', close);
  drawer.querySelector('#fApply').addEventListener('click', close);
  drawer.querySelector('#fClear').addEventListener('click', () => { resetAccFilters(); onChange(); openDrawer(accidents, onChange); });

  document.body.append(scrim, drawer);
  requestAnimationFrame(() => { drawer.classList.add('open'); scrim.classList.add('open'); });
}

export function accActiveChips(onChange) {
  const active = Object.entries(accFilters).filter(([, v]) => v);
  if (!active.length) return '';
  const labelFor = (k, v) => {
    if (k === 'type') { const t = ACCIDENT_TYPES.find((x) => x.id === v); return t ? t.label : v; }
    if (k === 'methodology') { const m = METHODOLOGIES.find((x) => x.id === v); return m ? m.label : v; }
    if (k === 'control') return v === 'with' ? 'Control present' : 'No direct control';
    if (k === 'from') return `From ${v}`;
    if (k === 'to') return `To ${v}`;
    return v;
  };
  const wrap = el('div', { class: 'filter-chips' });
  wrap.innerHTML = active.map(([k, v]) => `<span class="fchip" data-clear="${k}">${esc(labelFor(k, v))} ✕</span>`).join('')
    + '<span class="fchip clear-all" data-clear="__all">Clear all</span>';
  wrap.addEventListener('click', (e) => {
    const c = e.target.closest('[data-clear]'); if (!c) return;
    if (c.dataset.clear === '__all') resetAccFilters(); else { accFilters[c.dataset.clear] = ''; save(); }
    onChange();
  });
  return wrap;
}
