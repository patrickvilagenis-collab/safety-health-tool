// store.js — data access layer on top of db.js.
// Owns the Visit / Action data model, derived metrics and seed data.

import { db } from './db.js';
import { uid, nowISO, monthKey, daysBetween } from './utils.js';
import { getTemplate, TEMPLATE_LIST, isControlEffective, DANGER_ZONES } from './checklists.js';
import { ACCIDENT_TYPES, getAccidentType, emptyRca, accidentHighEnergy, accidentDirectControl } from './accidents.js';
import { emptyAip } from './aip.js';
import { newStep, newFinding, oleFindings } from './ole.js';
import * as sync from './sync.js';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------
export function newVisit(templateId) {
  const t = getTemplate(templateId);
  return {
    id: uid('visit'),
    templateId,
    templateName: t ? t.name : templateId,
    family: t ? t.family : '',
    status: 'draft',
    general: {
      observer: '', observerId: '', technician: '', employeeType: 'Schindler',
      technicianId: '', equipmentNumber: '', workType: '', address: '',
      supervisor: '', branch: '', city: '', region: '', zone: '',
      date: new Date().toISOString().slice(0, 10),
    },
    technical: { installationType: '', tractionType: '' },
    responses: {},          // { sectionId: { itemId: { answer, remark, photos:[id] } } }
    energy: [],             // EBS rows
    actions: [],            // embedded action ids materialised in `actions` store
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

export function newAccident(type = '') {
  return {
    id: uid('acc'),
    refNo: 'ACC-' + Date.now().toString(36).slice(-5).toUpperCase(),
    type,
    status: 'draft',
    occurredAt: new Date().toISOString().slice(0, 16),
    reportedBy: '',
    location: { site: '', city: '', zone: '', region: '', branch: '', address: '' },
    category: '',
    injuredPerson: '', role: '', employeeType: 'Schindler', workType: '',
    equipmentNumber: '', bodyPart: '', injuryNature: '',
    energyType: '', energyTypes: [], highEnergy: false, directControlPresent: false,
    description: '', immediateActions: '', photos: [],
    methodology: '', rca: emptyRca(), rootCauses: '',
    aip: emptyAip(),
    investigationLead: '', dueDate: '',
    createdAt: nowISO(), updatedAt: nowISO(),
  };
}

export function newAccidentAction(accident, partial = {}) {
  return {
    id: uid('act'),
    visitId: null,
    accidentId: accident ? accident.id : null,
    title: partial.title || '',
    description: partial.description || '',
    type: partial.type || 'Corrective',
    priority: partial.priority || 'High',
    status: partial.status || 'Open',
    owner: partial.owner || '',
    site: accident ? (accident.location.city || accident.location.site || '') : '',
    dueDate: partial.dueDate || '',
    createdAt: nowISO(), updatedAt: nowISO(),
  };
}

export function newOLE() {
  return {
    id: uid('ole'),
    refNo: 'OLE-' + Date.now().toString(36).slice(-5).toUpperCase(),
    title: '',
    task: '', process: '',
    facilitator: '',
    date: new Date().toISOString().slice(0, 10),
    location: { site: '', city: '', zone: '', region: '', branch: '' },
    status: 'new',
    attendees: [],
    prepNotes: '',
    steps: [],
    findings: [],     // each {stepId|null, description, fourD[], variability, variabilityDesc, location, severity, photos}
    survey: { rating: '', learned: '', improve: '' },
    createdAt: nowISO(), updatedAt: nowISO(),
  };
}

export function newOleAction(ole, finding, partial = {}) {
  return {
    id: uid('act'),
    visitId: null, accidentId: null,
    oleId: ole ? ole.id : null,
    findingId: finding ? finding.id : null,
    title: partial.title || '',
    description: partial.description || '',
    type: partial.type || 'Learning',
    priority: partial.priority || 'Medium',
    status: partial.status || 'Open',
    owner: partial.owner || '',
    site: ole ? (ole.location.city || ole.location.site || '') : '',
    dueDate: partial.dueDate || '',
    createdAt: nowISO(), updatedAt: nowISO(),
  };
}

export function newAction(visit, partial = {}) {
  return {
    id: uid('act'),
    visitId: visit ? visit.id : null,
    title: partial.title || '',
    description: partial.description || '',
    type: partial.type || 'Learning',
    priority: partial.priority || 'Medium',
    status: partial.status || 'Open',     // Open | In progress | Implemented | Closed
    owner: partial.owner || '',
    site: visit ? (visit.general.address || visit.general.city) : (partial.site || ''),
    dueDate: partial.dueDate || '',
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------
export const store = {
  visits: () => db.all('visits'),
  visit: (id) => db.get('visits', id),
  async saveVisit(v) { v.updatedAt = nowISO(); await db.put('visits', v); sync.push('visits', v); return v; },
  async delVisit(id) { await db.del('visits', id); sync.remove('visits', id); },

  actions: () => db.all('actions'),
  action: (id) => db.get('actions', id),
  async saveAction(a) { a.updatedAt = nowISO(); await db.put('actions', a); sync.push('actions', a); return a; },
  async delAction(id) { await db.del('actions', id); sync.remove('actions', id); },

  accidents: () => db.all('accidents'),
  accident: (id) => db.get('accidents', id),
  async saveAccident(a) { a.updatedAt = nowISO(); await db.put('accidents', a); sync.push('accidents', a); return a; },
  async delAccident(id) { await db.del('accidents', id); sync.remove('accidents', id); },

  oles: () => db.all('oles'),
  ole: (id) => db.get('oles', id),
  async saveOle(o) { o.updatedAt = nowISO(); await db.put('oles', o); sync.push('oles', o); return o; },
  async delOle(id) { await db.del('oles', id); sync.remove('oles', id); },

  async savePhoto(dataURL) {
    const id = uid('ph');
    const rec = { id, dataURL, createdAt: nowISO() };
    await db.put('photos', rec); sync.push('photos', rec);
    return id;
  },
  photo: (id) => db.get('photos', id),
  async delPhoto(id) { await db.del('photos', id); sync.remove('photos', id); },

  meta: (id) => db.get('meta', id),
  async setMeta(id, value) { const rec = { id, value }; await db.put('meta', rec); sync.push('meta', rec); return rec; },
};

// ---------------------------------------------------------------------------
// Derived metrics
// ---------------------------------------------------------------------------
// Per-visit compliance: conform / (conform + variability). N/A excluded.
export function visitScore(visit) {
  let conform = 0, variability = 0;
  for (const sec of Object.values(visit.responses || {})) {
    for (const r of Object.values(sec)) {
      if (r.answer === 'conform') conform++;
      else if (r.answer === 'variability') variability++;
    }
  }
  const total = conform + variability;
  return {
    conform, variability,
    answered: total,
    score: total ? Math.round((conform / total) * 100) : null,
  };
}

export function visitVariabilities(visit) {
  const out = [];
  const t = getTemplate(visit.templateId);
  for (const [secId, sec] of Object.entries(visit.responses || {})) {
    const tsec = t && t.sections.find((s) => s.id === secId);
    for (const [itemId, r] of Object.entries(sec)) {
      if (r.answer === 'variability') {
        const titem = tsec && tsec.items.find((i) => i.id === itemId);
        out.push({ section: tsec ? tsec.title : secId, item: titem ? titem.text : itemId, remark: r.remark || '' });
      }
    }
  }
  return out;
}

export function countPhotos(visit) {
  let n = 0;
  for (const sec of Object.values(visit.responses || {})) {
    for (const r of Object.values(sec)) n += (r.photos || []).length;
  }
  for (const e of visit.energy || []) n += (e.photos || []).length;
  return n;
}

// Dashboard aggregation.
export function buildKpis(visits, actions) {
  const submitted = visits.filter((v) => v.status === 'submitted');
  const thisMonth = monthKey(nowISO());
  const visitsThisMonth = submitted.filter((v) => monthKey(v.general.date || v.createdAt) === thisMonth).length;

  const scores = submitted.map(visitScore).filter((s) => s.score !== null);
  const avgScore = scores.length ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length) : null;
  const totalVar = scores.reduce((a, s) => a + s.variability, 0);

  const openActions = actions.filter((a) => a.status !== 'Closed' && a.status !== 'Implemented');
  const overdue = openActions.filter((a) => a.dueDate && daysBetween(a.dueDate) > 0);

  // EBS coverage: of energies flagged present, share with a direct control in place.
  let energyPresent = 0, energyControlled = 0, highEnergy = 0, highUncontrolled = 0;
  for (const v of submitted) {
    for (const e of v.energy || []) {
      if (!e.present) continue;
      energyPresent++;
      const eff = isControlEffective(e);
      if (eff) energyControlled++;
      if (e.highEnergy) {
        highEnergy++;
        if (!eff) highUncontrolled++;
      }
    }
  }

  return {
    totalVisits: submitted.length,
    drafts: visits.length - submitted.length,
    visitsThisMonth,
    avgScore,
    totalVariabilities: totalVar,
    openActions: openActions.length,
    overdueActions: overdue.length,
    energyPresent,
    controlCoverage: energyPresent ? Math.round((energyControlled / energyPresent) * 100) : null,
    highEnergy,
    highUncontrolled,
  };
}

export function visitsByMonth(visits) {
  const map = {};
  for (const v of visits) {
    const k = monthKey(v.general.date || v.createdAt);
    map[k] = (map[k] || 0) + 1;
  }
  return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
}

export function visitsByFamily(visits) {
  const map = {};
  for (const v of visits) map[v.family || 'Other'] = (map[v.family || 'Other'] || 0) + 1;
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

export function actionsByStatus(actions) {
  const order = ['Open', 'In progress', 'Implemented', 'Closed'];
  const map = Object.fromEntries(order.map((s) => [s, 0]));
  for (const a of actions) map[a.status] = (map[a.status] || 0) + 1;
  return order.map((s) => [s, map[s]]);
}

export function energyDistribution(visits) {
  const map = {};
  for (const v of visits) {
    for (const e of v.energy || []) {
      if (e.present && e.energyId) map[e.energyId] = (map[e.energyId] || 0) + 1;
    }
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

export function controlHierarchyDistribution(visits) {
  const map = {};
  for (const v of visits) {
    for (const e of v.energy || []) {
      if (e.present && e.controlType) map[e.controlType] = (map[e.controlType] || 0) + 1;
    }
  }
  return map;
}

export function topVariabilitySections(visits, limit = 6) {
  const map = {};
  for (const v of visits) {
    for (const vr of visitVariabilities(v)) {
      map[vr.section] = (map[vr.section] || 0) + 1;
    }
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Period comparison: count per key this calendar month vs the previous one.
// Returns { key: currentCount - previousCount }. keysFn may return one key or
// an array of keys per item.
// ---------------------------------------------------------------------------
export function monthDeltas(items, dateFn, keysFn) {
  const cur = monthKey(nowISO());
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  const prev = monthKey(d.toISOString());
  const c = {}, p = {};
  for (const it of items) {
    const mk = monthKey(dateFn(it) || nowISO());
    if (mk !== cur && mk !== prev) continue;
    for (const k of [].concat(keysFn(it) || [])) {
      if (!k) continue;
      if (mk === cur) c[k] = (c[k] || 0) + 1; else p[k] = (p[k] || 0) + 1;
    }
  }
  const out = {};
  for (const k of new Set([...Object.keys(c), ...Object.keys(p)])) out[k] = (c[k] || 0) - (p[k] || 0);
  return out;
}

// ---------------------------------------------------------------------------
// Accident metrics
// ---------------------------------------------------------------------------
function groupCount(list, keyFn) {
  const m = {};
  for (const x of list) { const k = keyFn(x); if (k) m[k] = (m[k] || 0) + 1; }
  return m;
}

export function buildAccidentKpis(accidents, actions) {
  const reported = accidents.filter((a) => a.status !== 'draft');
  const thisMonth = monthKey(nowISO());
  const month = reported.filter((a) => monthKey(a.occurredAt || a.createdAt) === thisMonth).length;
  const sif = reported.filter((a) => { const t = getAccidentType(a.type); return t && t.sif; }).length;
  const psif = reported.filter((a) => a.type === 'serious_near_miss').length;
  const highEnergyNoControl = reported.filter((a) => accidentHighEnergy(a) && !accidentDirectControl(a)).length;
  const openInv = reported.filter((a) => a.status === 'investigation').length;
  const accActions = actions.filter((x) => x.accidentId);
  const open = accActions.filter((x) => x.status !== 'Closed' && x.status !== 'Implemented');
  const overdue = open.filter((x) => x.dueDate && daysBetween(x.dueDate) > 0);
  return {
    total: reported.length, month, sif, psif, highEnergyNoControl, openInvestigations: openInv,
    drafts: accidents.length - reported.length, openActions: open.length, overdueActions: overdue.length,
  };
}

export function accidentsByType(list) {
  const m = groupCount(list, (a) => a.type);
  return ACCIDENT_TYPES.filter((t) => m[t.id]).map((t) => [t.short, m[t.id]]);
}
export function accidentsByMonth(list) {
  const m = groupCount(list, (a) => monthKey(a.occurredAt || a.createdAt));
  return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
}
export function accidentsBy(list, keyFn) {
  return Object.entries(groupCount(list, keyFn)).sort((a, b) => b[1] - a[1]);
}
export function accidentControlSplit(list) {
  const hi = list.filter((a) => accidentHighEnergy(a));
  const withC = hi.filter((a) => accidentDirectControl(a)).length;
  return [['Direct control present', withC], ['No direct control', hi.length - withC]];
}

// ---------------------------------------------------------------------------
// OLE metrics
// ---------------------------------------------------------------------------
export function buildOleKpis(oles, actions) {
  const thisMonth = monthKey(nowISO());
  const month = oles.filter((o) => monthKey(o.date || o.createdAt) === thisMonth).length;
  let findings = 0, variabilities = 0, outside = 0, fourD = 0;
  for (const o of oles) {
    const fs = oleFindings(o);
    findings += fs.length;
    for (const f of fs) {
      if (f.variability) variabilities++;
      if (!f.stepId) outside++;
      if ((f.fourD || []).length) fourD++;
    }
  }
  const oleActions = actions.filter((a) => a.oleId);
  const open = oleActions.filter((a) => a.status !== 'Closed' && a.status !== 'Implemented');
  const overdue = open.filter((a) => a.dueDate && daysBetween(a.dueDate) > 0);
  return {
    total: oles.length, month, findings, variabilities, outside, fourD,
    actionsPending: oles.filter((o) => o.status === 'actions_pending').length,
    openActions: open.length, overdueActions: overdue.length,
    closed: oles.filter((o) => o.status === 'closed').length,
  };
}
export function olesByStatus(list) {
  const order = ['new', 'in_progress', 'completed', 'actions_pending', 'closed'];
  const m = Object.fromEntries(order.map((s) => [s, 0]));
  for (const o of list) m[o.status] = (m[o.status] || 0) + 1;
  return order.map((s) => [s, m[s]]);
}
export function olesByMonth(list) {
  const m = {};
  for (const o of list) { const k = monthKey(o.date || o.createdAt); m[k] = (m[k] || 0) + 1; }
  return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
}

// ---------------------------------------------------------------------------
// Seed data (only on first run) so dashboards/analytics are not empty.
// ---------------------------------------------------------------------------
export async function ensureSeed() {
  // In backend mode the data comes from the server — never inject demo data.
  if (sync.enabled()) return;
  const seeded = await store.meta('seeded');
  if (seeded && seeded.value) return;
  await seedDemoData();
}

// Generate the sample data set. Exposed so it can be loaded on demand (e.g. to
// populate an empty backend). In backend mode each write is mirrored to the
// server by the store, and pushBulk can be used afterwards to be sure.
export async function seedDemoData() {

  const observers = [
    ['Marta Ruiz', 'S10231'], ['Jon Eriksen', 'S20144'], ['Li Wei', 'S33120'],
    ['Carlos Méndez', 'S40988'], ['Anke Müller', 'S55012'],
  ];
  const cities = [
    ['Madrid', 'Iberia Hub', 'Calle Gran Vía 21', 'Europe'],
    ['Milano', 'South Europe Hub', 'Via Torino 14', 'Europe'],
    ['Shanghai', 'China Hub', 'Nanjing Road 88', 'Asia Pacific'],
    ['São Paulo', 'LatAm Hub', 'Av. Paulista 1500', 'Americas'],
    ['Berlin', 'DACH Hub', 'Alexanderplatz 3', 'Europe'],
  ];
  const templates = ['safe_ni_trans', 'safe_ei', 'safety_inspection_ei', 'safety_inspection_ni', 'mini_ole'];
  const energies = ['gravity', 'motion', 'electrical', 'mechanical', 'pressure'];

  const rand = (a) => a[Math.floor(Math.random() * a.length)];
  const created = [];

  for (let i = 0; i < 28; i++) {
    const tplId = rand(templates);
    const t = getTemplate(tplId);
    const v = newVisit(tplId);
    const [name, id] = rand(observers);
    const [city, branch, addr, region] = rand(cities);
    const daysAgo = Math.floor(Math.random() * 150);
    const date = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

    v.status = 'submitted';
    v.createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
    v.updatedAt = v.createdAt;
    v.general = {
      observer: name, observerId: id, technician: rand(['A. Santos', 'P. Novak', 'R. Costa', 'M. Yilmaz', 'K. Tanaka']),
      employeeType: rand(['Schindler', 'Subcontractor']), technicianId: 'T' + (1000 + i),
      equipmentNumber: 'EQ' + (200000 + Math.floor(Math.random() * 9999)),
      workType: rand(['New installation (NI)', 'Existing installation / Maintenance (EI)', 'Modernization (MOD)']),
      address: addr, supervisor: rand(['L. Romano', 'S. Becker', 'D. Alvarez']),
      branch, city, region, zone: branch, date,
    };
    v.technical = { installationType: rand(['MR (Machine Room)', 'MRL (Machine Room-Less)']), tractionType: rand(['EG (one speed)', 'VF (variable frequency drive)']) };

    // Answer each item; mostly conform with some variabilities.
    for (const sec of t.sections) {
      if (sec.kind === 'open') continue;
      v.responses[sec.id] = {};
      for (const it of sec.items) {
        const roll = Math.random();
        const answer = roll < 0.12 ? 'variability' : roll < 0.2 ? 'na' : 'conform';
        v.responses[sec.id][it.id] = {
          answer,
          remark: answer === 'variability' ? 'Observed deviation discussed with the technician on site.' : '',
          photos: [],
        };
      }
    }

    // EBS energy rows for templates that support it.
    if (t.hasEBS) {
      const n = 2 + Math.floor(Math.random() * 3);
      const used = new Set();
      for (let k = 0; k < n; k++) {
        let eid = rand(energies);
        if (used.has(eid)) continue;
        used.add(eid);
        const high = Math.random() < 0.45;
        const controlled = Math.random() < 0.8;
        v.energy.push({
          energyId: eid, present: true, dangerZone: rand(DANGER_ZONES).id, highEnergy: high, directControl: controlled,
          controlType: controlled ? rand(['engineering', 'engineering', 'administrative', 'ppe']) : rand(['administrative', 'ppe']),
          controlCondition: controlled ? 'works' : rand(['inadequate', 'unreliable', 'not_working', 'absent']),
          controlInPlace: controlled ? 'conform' : 'variability',
          notes: '', photos: [],
        });
      }
    }

    await store.saveVisit(v);
    created.push(v);

    // Create actions from variabilities (a subset).
    const vars = visitVariabilities(v);
    for (const vr of vars) {
      if (Math.random() < 0.55) {
        const st = rand(['Open', 'Open', 'In progress', 'Implemented', 'Closed']);
        const due = new Date(Date.now() + (Math.floor(Math.random() * 40) - 15) * 86400000).toISOString().slice(0, 10);
        const a = newAction(v, {
          title: vr.section,
          description: vr.item,
          type: rand(['Training', 'Learning', 'Risk elimination']),
          priority: rand(['High', 'Medium', 'Low']),
          status: st,
          owner: rand(['L. Romano', 'S. Becker', 'D. Alvarez']),
          dueDate: due,
        });
        a.createdAt = v.createdAt;
        await store.saveAction(a);
      }
    }
  }

  await seedAccidents(rand, observers, cities);
  await seedOles(rand, observers, cities);

  await store.setMeta('seeded', true);
}

async function seedOles(rand, observers, cities) {
  const tasks = [
    'Hoistway access & STOP application', 'Counterweight screen installation', 'Door panel adjustment',
    'LOTO before electrical work', 'Hoisting the car frame', 'Pit cleaning & inspection',
  ];
  const stepNames = {
    'Hoistway access & STOP application': ['Prepare tools & PPE', 'Apply STOP / recall control', 'Attach fall protection', 'Access car roof', 'Perform task', 'Leave hoistway'],
    default: ['Prepare', 'Set up controls', 'Execute task', 'Verify', 'Close out'],
  };
  const fourDIds = ['different', 'difficult', 'dumb', 'dangerous'];
  const locs = ['Machine room', 'Car top', 'Shaft / Pit', 'Landing', 'Escalator'];
  const statuses = ['new', 'in_progress', 'completed', 'actions_pending', 'closed'];

  for (let i = 0; i < 10; i++) {
    const o = newOLE();
    const task = rand(tasks);
    const [city, branch, addr, region] = rand(cities);
    const [fac] = rand(observers);
    const daysAgo = Math.floor(Math.random() * 140);
    const when = new Date(Date.now() - daysAgo * 86400000);
    o.refNo = 'OLE-' + (4200 + i);
    o.title = task + ' — learning event';
    o.task = task; o.process = 'Field operations';
    o.facilitator = fac;
    o.date = when.toISOString().slice(0, 10);
    o.createdAt = when.toISOString(); o.updatedAt = o.createdAt;
    o.location = { site: addr, city, zone: branch, region, branch };
    o.status = rand(statuses);
    o.attendees = [
      { name: fac, role: 'Facilitator', company: 'Schindler' },
      { name: rand(['A. Santos', 'P. Novak', 'R. Costa']), role: 'Technician', company: rand(['Schindler', 'Subcontractor']) },
      { name: rand(['M. Yilmaz', 'K. Tanaka']), role: 'Participant', company: 'Schindler' },
    ];
    o.prepNotes = 'Review the standard procedure and recent events related to this task before the session.';

    const names = stepNames[task] || stepNames.default;
    o.steps = names.map((n, idx) => ({ id: newStep(idx).id, order: idx, name: n, description: '' }));

    // findings on steps + outside the swimlane
    const nFind = 2 + Math.floor(Math.random() * 4);
    for (let k = 0; k < nFind; k++) {
      const outside = Math.random() < 0.3;
      const step = outside ? null : rand(o.steps);
      const f = newFinding(outside ? null : step.id);
      const isVar = Math.random() < 0.6;
      f.description = outside
        ? rand(['Tooling not standardized across crews', 'Procedure unclear for this site layout', 'Time pressure from scheduling'])
        : rand(['Step done differently than the procedure', 'Workaround used to save time', 'Control hard to apply in this position', 'Extra effort needed due to access']);
      f.fourD = [rand(fourDIds), ...(Math.random() < 0.3 ? [rand(fourDIds)] : [])].filter((v, idx, arr) => arr.indexOf(v) === idx);
      f.variability = isVar;
      f.variabilityDesc = isVar ? 'Observed deviation from the standard discussed with the crew.' : '';
      f.location = rand(locs);
      f.severity = rand(['Low', 'Medium', 'High']);
      o.findings.push(f);
    }

    await store.saveOle(o);

    // traceable actions from a subset of findings
    for (const f of o.findings) {
      if (Math.random() < 0.5) {
        const st = o.status === 'closed' ? rand(['Implemented', 'Closed']) : rand(['Open', 'Open', 'In progress', 'Implemented']);
        const due = new Date(when.getTime() + (15 + Math.floor(Math.random() * 45)) * 86400000).toISOString().slice(0, 10);
        const a = newOleAction(o, f, {
          title: rand(['Update the procedure', 'Standardize the tooling', 'Add a quick reference card', 'Retrain the crew', 'Improve access/setup']),
          description: 'Action from OLE ' + o.refNo + ' (finding: ' + f.description.slice(0, 40) + '…)',
          type: rand(['Learning', 'Risk elimination', 'Training']),
          priority: f.severity === 'High' ? 'High' : rand(['High', 'Medium', 'Low']),
          status: st,
          owner: rand(['L. Romano', 'S. Becker', 'D. Alvarez', fac]),
          dueDate: due,
        });
        a.createdAt = o.createdAt;
        await store.saveAction(a);
      }
    }
  }
}

async function seedAccidents(rand, observers, cities) {
  const energies = ['gravity', 'motion', 'electrical', 'mechanical', 'pressure'];
  const types = ACCIDENT_TYPES.map((t) => t.id);
  const methods = ['five_whys', 'fishbone', 'tripod', 'taproot', ''];
  const persons = ['A. Santos', 'P. Novak', 'R. Costa', 'M. Yilmaz', 'K. Tanaka', 'J. Fischer'];
  const descByType = {
    he_sif: 'Technician fell from car roof during access; serious injury sustained.',
    serious_near_miss: 'Counterweight moved unexpectedly while technician was in the pit; no contact.',
    sif_exposure: 'Technician accessed hoistway with no STOP applied and no secondary safety device.',
    safeguard_worked: 'Car started to move but the engaged Wurtec block stopped it; no injury.',
    low_energy_sif: 'Hand caught between door panels causing a finger fracture.',
    low_severity: 'Minor tooling left in machine room; housekeeping issue, no harm.',
  };

  for (let i = 0; i < 16; i++) {
    const type = rand(types);
    const t = getAccidentType(type);
    const [city, branch, addr, region] = rand(cities);
    const [lead] = rand(observers);
    const daysAgo = Math.floor(Math.random() * 160);
    const when = new Date(Date.now() - daysAgo * 86400000);
    const acc = newAccident(type);
    acc.refNo = 'ACC-' + (2600 + i);
    acc.status = rand(['reported', 'investigation', 'investigation', 'closed']);
    acc.occurredAt = when.toISOString().slice(0, 16);
    acc.createdAt = when.toISOString();
    acc.updatedAt = acc.createdAt;
    acc.reportedBy = rand(persons);
    acc.location = { site: addr, city, zone: branch, region, branch, address: addr };
    acc.category = rand(['Injury / illness', 'Near miss', 'Dangerous occurrence', 'Property / equipment damage']);
    acc.injuredPerson = rand(persons);
    acc.role = rand(['Technician', 'Apprentice', 'Supervisor']);
    acc.employeeType = rand(['Schindler', 'Subcontractor']);
    acc.workType = rand(['New installation (NI)', 'Existing installation / Maintenance (EI)', 'Modernization (MOD)']);
    acc.equipmentNumber = 'EQ' + (200000 + Math.floor(Math.random() * 9999));
    acc.bodyPart = rand(['Hand / fingers', 'Back', 'Head', 'Leg', 'Multiple']);
    acc.injuryNature = t.sif ? rand(['Fracture', 'Crush', 'Amputation']) : rand(['None', 'Bruise / contusion', 'Cut / laceration']);
    acc.energyTypes = [...new Set([rand(energies), ...(Math.random() < 0.4 ? [rand(energies)] : [])])];
    acc.highEnergy = t.highEnergy != null ? t.highEnergy : Math.random() < 0.5;
    acc.directControlPresent = t.control != null ? t.control : Math.random() < 0.5;
    acc.energy = acc.energyTypes.map((id) => ({
      energyId: id, present: true, dangerZone: rand(DANGER_ZONES).id, highEnergy: acc.highEnergy,
      directControl: acc.directControlPresent, controlType: acc.directControlPresent ? 'engineering' : 'administrative',
      controlCondition: acc.directControlPresent ? 'works' : rand(['absent', 'not_working', 'inadequate']),
      controlInPlace: acc.directControlPresent ? 'conform' : 'variability', notes: '', photos: [],
    }));
    acc.description = descByType[type] || 'Incident under review.';
    acc.immediateActions = 'Area secured, work stopped, supervisor and safety team notified.';
    acc.aip = emptyAip();
    acc.aip.incidentDefinition = t.sif ? rand(['Fatality (FAT)', 'Severe injury', 'Injury']) : rand(['Near miss (NM)', 'Unsafe act', 'Unsafe condition', 'Injury']);
    acc.aip.equipmentType = rand(['Elevator', 'Elevator', 'Escalator']);
    acc.aip.accidentClass = acc.aip.equipmentType === 'Escalator' ? rand(['Fall on steps', 'Squeeze finger', 'Pulled in', 'Malfunction']) : rand(['Fall from height', 'Crushed by car', 'Hit by door', 'Entrapment', 'Electrocution']);
    acc.aip.severityRating = t.sif ? rand(['Serious', 'Fatality']) : rand(['None', 'Minor', 'Moderate']);
    acc.aip.business = rand(['NI', 'EI', 'MOD', 'REP']);
    acc.aip.process = rand(['NI', 'EI', 'Repair', 'MOD', 'SAIS']);
    acc.aip.personType = rand(['Employee', 'Subcontractor', 'User']);
    acc.aip.product.buildingType = rand(['Residential', 'Commercial', 'Hotel', 'Mall', 'Hospital']);
    acc.aip.product.manufacturer = 'Schindler';
    acc.aip.product.traction = rand(['Rope', 'Hydraulic']);
    if (Math.random() < 0.25) acc.aip.involvedBodies = [rand(['Police', 'Ambulance', 'Authority'])];
    acc.investigationLead = lead;
    acc.methodology = acc.status === 'closed' || acc.status === 'investigation' ? rand(methods.filter(Boolean)) : rand(methods);

    // Populate a light RCA for the chosen methodology.
    if (acc.methodology === 'five_whys') {
      acc.rca.five_whys = { problem: acc.description, branches: [
        { factor: 'Procedure step skipped', whys: ['Procedure step skipped', 'Time pressure on site', 'Crew under-resourced', 'Planning did not allocate enough time'], root: 'Planning standard not enforced' },
        { factor: 'Secondary safety device not used', whys: ['Device not applied', 'Crew not briefed on the step', 'Supervision gap'], root: 'Supervision standard gap' },
      ] };
      acc.rootCauses = 'Planning standard not enforced; supervision standard gap';
    } else if (acc.methodology === 'fishbone') {
      acc.rca.fishbone.effect = acc.description;
      acc.rca.fishbone.causes.People = ['Inadequate supervision', 'Fatigue'];
      acc.rca.fishbone.causes.Method = ['Procedure not followed'];
      acc.rca.fishbone.causes.Machine = ['Guard missing'];
      acc.rootCauses = 'Procedure not followed; supervision gap';
    } else if (acc.methodology === 'tripod') {
      acc.rca.tripod = { agent: 'Gravity / moving car', event: acc.description, target: 'Technician',
        barriers: [{ desc: 'Secondary safety device (STOP/block)', active: 'Not applied before access', precondition: 'Time pressure', latent: 'Planning & supervision standard gaps' }] };
      acc.rootCauses = 'Latent: planning & supervision standard gaps';
    } else if (acc.methodology === 'taproot') {
      acc.rca.taproot = { events: ['Work scheduled', 'Crew accessed hoistway', 'Energy released'],
        factors: [{ desc: 'Secondary safety device not used', category: 'Procedures', root: 'Procedure not enforced' }, { desc: 'Crew not briefed', category: 'Training', root: 'Training gap' }] };
      acc.rootCauses = 'Procedures not enforced; training gap';
    }

    await store.saveAccident(acc);

    // Corrective/preventive actions with owners & deadlines.
    const nActions = 1 + Math.floor(Math.random() * 3);
    for (let k = 0; k < nActions; k++) {
      const st = acc.status === 'closed' ? rand(['Implemented', 'Closed']) : rand(['Open', 'Open', 'In progress', 'Implemented']);
      const due = new Date(when.getTime() + (15 + Math.floor(Math.random() * 50)) * 86400000).toISOString().slice(0, 10);
      const a = newAccidentAction(acc, {
        title: rand(['Reinforce secondary safety device rule', 'Retrain crew on hoistway access', 'Review planning time allocation', 'Add physical guard', 'Update JHA for task']),
        description: 'Corrective action arising from investigation of ' + acc.refNo + '.',
        type: rand(['Corrective', 'Preventive', 'Training']),
        priority: t.sif ? 'High' : rand(['High', 'Medium', 'Low']),
        status: st,
        owner: rand(['L. Romano', 'S. Becker', 'D. Alvarez', acc.investigationLead]),
        dueDate: due,
      });
      a.createdAt = acc.createdAt;
      await store.saveAction(a);
    }
  }
}
