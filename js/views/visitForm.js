// views/visitForm.js — create / edit a field visit.
// Handles general & technical data, the checklist, Energy-Based Safety rows,
// JHA steps, photo capture, embedded actions, auto-save (pause/resume) and submit.

import { store, newVisit, newAction, visitScore, visitVariabilities } from '../store.js';
import { getTemplate, ANSWERS, WORK_TYPES, EMPLOYEE_TYPES, INSTALLATION_TYPES,
  TRACTION_TYPES, ENERGY_TYPES, DANGER_ZONES, CONTROL_HIERARCHY, CONTROL_CONDITION,
  ERROR_TRAPS, ENERGY_ROW, ACTION_DEFAULTS, REMARK_PLACEHOLDER } from '../checklists.js';
import { el, esc, fmtDateTime, toast, fileToCompressedDataURL, confirmDialog } from '../utils.js';
import { openHumbleInquiry } from '../humbleInquiry.js';
import { hazardWheelSVG } from '../hazardWheel.js';

let _saveTimer = null;
let _visit = null;
let _template = null;
let _root = null;

export async function renderVisitForm(root, { templateId, visitId }) {
  _root = root;
  if (visitId) {
    _visit = await store.visit(visitId);
    if (!_visit) { root.innerHTML = '<p class="empty">Visit not found.</p>'; return; }
    _template = getTemplate(_visit.templateId);
  } else {
    _template = getTemplate(templateId);
    if (!_template) { location.hash = '#/new'; return; }
    _visit = newVisit(templateId);
    await store.saveVisit(_visit);
    history.replaceState(null, '', `#/visit/${_visit.id}`);
  }
  paint();
}

function scheduleSave(immediate = false) {
  clearTimeout(_saveTimer);
  const run = async () => {
    await store.saveVisit(_visit);
    const ind = document.getElementById('saveState');
    if (ind) ind.textContent = `Saved · ${fmtDateTime(_visit.updatedAt)}`;
  };
  if (immediate) return run();
  const ind = document.getElementById('saveState');
  if (ind) ind.textContent = 'Saving…';
  _saveTimer = setTimeout(run, 600);
}

function paint() {
  const v = _visit, t = _template;
  const s = visitScore(v);
  _root.innerHTML = `
    <div class="form-head">
      <div>
        <a class="back" href="#/visits">← Visits</a>
        <h1>${esc(t.name)}</h1>
        <div class="form-sub"><span class="status ${v.status}">${v.status === 'draft' ? 'Draft' : 'Submitted'}</span>
          <span id="saveState" class="save-state">Saved · ${fmtDateTime(v.updatedAt)}</span></div>
      </div>
      <div class="form-head-actions">
        <div class="score-chip ${s.score == null ? 'muted' : s.score >= 90 ? 'good' : s.score >= 75 ? 'warn' : 'bad'}">
          <b>${s.score == null ? '—' : s.score + '%'}</b><span>compliance</span></div>
        <button class="btn" id="humbleBtn" title="Humble Inquiry — how to ask">How to ask</button>
        ${v.status === 'draft'
          ? '<button class="btn primary" id="submitBtn">Submit visit</button>'
          : '<button class="btn" id="reopenBtn">Reopen</button>'}
      </div>
    </div>

    <nav class="section-nav" id="secNav"></nav>

    <section class="card" id="sec-general">
      <h3>General data</h3>
      <div class="grid2" id="generalFields"></div>
    </section>

    ${t.hasTechnicalData ? `
    <section class="card" id="sec-technical">
      <h3>Technical data <span class="opt">(optional)</span></h3>
      <div class="grid2" id="technicalFields"></div>
    </section>` : ''}

    ${t.hasEBS ? `
    <section class="card" id="sec-ebs">
      <div class="card-head"><h3>Hazard Wheel — Energy-Based Safety</h3>
        <button class="btn small" id="addEnergy">+ Add hazard</button></div>
      <p class="hint">Identify the high-energy hazards present (Schindler Hazard Wheel — "STKY"). For each, set the danger zone, whether a <b>direct control</b> exists and its condition.</p>
      <details class="wheel-details" open>
        <summary>Schindler Hazard Wheel</summary>
        <div class="wheel-host">${hazardWheelSVG(300)}</div>
        <p class="hint wheel-cap">10 high-energy hazard types — use the wheel to systematically check what could hurt you in this task.</p>
      </details>
      <div id="energyRows"></div>
    </section>` : ''}

    ${t.isJHA ? `
    <section class="card" id="sec-errortraps">
      <h3>Error traps</h3>
      <p class="hint">Tick the conditions present today that make an error more likely.</p>
      <div id="errorTraps"></div>
    </section>` : ''}

    <div id="checklist"></div>

    ${t.isJHA ? `
    <section class="card" id="sec-jhasteps">
      <div class="card-head"><h3>Job steps · zone · hazards · controls</h3><button class="btn small" id="addStep">+ Add step</button></div>
      <div id="jhaSteps"></div>
    </section>` : ''}

    ${t.hasActions ? `
    <section class="card" id="sec-actions">
      <div class="card-head"><h3>Actions</h3><button class="btn small" id="addAction">+ Add action</button></div>
      <p class="hint">Actions feed the closed-loop tracker (assignee, due date, status, escalation).</p>
      <div id="actionsList"></div>
    </section>` : ''}

    <div class="form-footer">
      <button class="btn ghost danger" id="delBtn">Delete visit</button>
      ${v.status === 'draft' ? '<button class="btn primary" id="submitBtn2">Submit visit</button>' : ''}
    </div>
  `;

  buildGeneral();
  if (t.hasTechnicalData) buildTechnical();
  if (t.hasEBS) buildEnergy();
  if (t.isJHA) buildErrorTraps();
  buildChecklist();
  if (t.isJHA) buildJHASteps();
  if (t.hasActions) buildActions();
  buildNav();
  bindHeader();
  const hb = _root.querySelector('#humbleBtn');
  if (hb) hb.addEventListener('click', openHumbleInquiry);
}

// --- Error traps (JHA) ------------------------------------------------------
function buildErrorTraps() {
  const host = _root.querySelector('#errorTraps');
  if (!host) return;
  _visit.errorTraps = _visit.errorTraps || {};
  const dis = _visit.status !== 'draft';
  host.innerHTML = `<div class="trap-grid">${ERROR_TRAPS.map((g) => `
    <div class="trap-cat"><h4>${esc(g.group)}</h4>
      ${g.items.map((it) => {
        const id = g.group + '::' + it;
        return `<label class="trap-chk"><input type="checkbox" data-trap="${esc(id)}" ${_visit.errorTraps[id] ? 'checked' : ''} ${dis ? 'disabled' : ''}/> ${esc(it)}</label>`;
      }).join('')}
    </div>`).join('')}</div>`;
  host.querySelectorAll('[data-trap]').forEach((inp) => inp.addEventListener('change', () => {
    _visit.errorTraps[inp.dataset.trap] = inp.checked;
    scheduleSave();
  }));
}

// --- General / technical ----------------------------------------------------
function field(label, key, obj, opts = {}) {
  const id = `f_${key}`;
  const val = obj[key] ?? '';
  let input;
  if (opts.options) {
    input = `<select id="${id}" ${opts.disabled ? 'disabled' : ''}><option value="">—</option>${opts.options.map((o) => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  } else {
    input = `<input id="${id}" type="${opts.type || 'text'}" value="${esc(val)}" ${opts.disabled ? 'disabled' : ''} placeholder="${esc(opts.ph || '')}"/>`;
  }
  return `<label class="fld"><span>${esc(label)}</span>${input}</label>`;
}

function buildGeneral() {
  const g = _visit.general;
  const dis = _visit.status !== 'draft';
  _root.querySelector('#generalFields').innerHTML = [
    field('Observer', 'observer', g, { disabled: dis }),
    field('Observer ID', 'observerId', g, { disabled: dis }),
    field('Technician (name surname)', 'technician', g, { disabled: dis }),
    field('Employee type', 'employeeType', g, { options: EMPLOYEE_TYPES, disabled: dis }),
    field('Technician ID', 'technicianId', g, { disabled: dis }),
    field('Equipment / Comm. number', 'equipmentNumber', g, { disabled: dis }),
    field('Work type', 'workType', g, { options: WORK_TYPES, disabled: dis }),
    field('Date of visit', 'date', g, { type: 'date', disabled: dis }),
    field('Address', 'address', g, { disabled: dis }),
    field('Supervisor', 'supervisor', g, { disabled: dis }),
    field('Branch / Delegation', 'branch', g, { disabled: dis }),
    field('City', 'city', g, { disabled: dis }),
    field('Zone / Hub', 'zone', g, { disabled: dis }),
    field('Region', 'region', g, { disabled: dis }),
  ].join('');
  bindFields('#generalFields', _visit.general);
}

function buildTechnical() {
  const tdata = _visit.technical;
  const dis = _visit.status !== 'draft';
  _root.querySelector('#technicalFields').innerHTML = [
    field('Installation type', 'installationType', tdata, { options: INSTALLATION_TYPES, disabled: dis }),
    field('Traction type', 'tractionType', tdata, { options: TRACTION_TYPES, disabled: dis }),
  ].join('');
  bindFields('#technicalFields', _visit.technical);
}

function bindFields(sel, obj) {
  _root.querySelectorAll(`${sel} input, ${sel} select`).forEach((inp) => {
    const key = inp.id.replace('f_', '');
    inp.addEventListener('input', () => { obj[key] = inp.value; scheduleSave(); refreshTitleBits(); });
  });
}

function refreshTitleBits() {
  // keep header score in sync after answer changes (called from checklist)
}

// --- Checklist --------------------------------------------------------------
function buildChecklist() {
  const wrap = _root.querySelector('#checklist');
  wrap.innerHTML = '';
  const dis = _visit.status !== 'draft';
  for (const sec of _template.sections) {
    const card = el('section', { class: 'card checklist-sec', id: `sec-${sec.id}` });
    const done = sectionAnswered(sec);
    card.innerHTML = `<div class="card-head"><h3>${esc(sec.title)} <span class="sec-prog" data-prog="${sec.id}">${done}/${countAnswerable(sec)}</span></h3></div>
      ${sec.note ? `<p class="hint">${esc(sec.note)}</p>` : ''}`;
    const list = el('div', { class: 'items' });
    for (const it of sec.items) {
      list.append(it.open ? openItem(sec, it, dis) : checkItem(sec, it, dis));
    }
    card.append(list);
    wrap.append(card);
  }
}

function getResp(secId, itemId) {
  _visit.responses[secId] = _visit.responses[secId] || {};
  _visit.responses[secId][itemId] = _visit.responses[secId][itemId] || { answer: '', remark: '', photos: [] };
  return _visit.responses[secId][itemId];
}

function checkItem(sec, it, dis) {
  const r = getResp(sec.id, it.id);
  const node = el('div', { class: 'item' });
  node.innerHTML = `
    <div class="item-main">
      <p class="item-txt">${esc(it.text)}${it.note ? `<span class="note">ℹ ${esc(it.note)}</span>` : ''}</p>
      <div class="answers" role="group">
        ${ANSWERS.map((a) => `<button class="ans ${a.tone} ${r.answer === a.id ? 'on' : ''}" data-ans="${a.id}" ${dis ? 'disabled' : ''}>${a.label}</button>`).join('')}
      </div>
    </div>
    <div class="item-detail ${r.answer === 'variability' ? '' : 'hidden'}" data-detail>
      <textarea class="remark" placeholder="${esc(REMARK_PLACEHOLDER)}" ${dis ? 'disabled' : ''}>${esc(r.remark || '')}</textarea>
      <div class="photos" data-photos></div>
      ${dis ? '' : `<label class="photo-add"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Add photo<input type="file" accept="image/*" capture="environment" hidden></label>`}
    </div>`;

  node.querySelectorAll('.ans').forEach((btn) => btn.addEventListener('click', () => {
    r.answer = btn.dataset.ans;
    node.querySelectorAll('.ans').forEach((b) => b.classList.toggle('on', b === btn));
    node.querySelector('[data-detail]').classList.toggle('hidden', r.answer !== 'variability');
    updateSectionProg(sec);
    updateHeaderScore();
    scheduleSave();
  }));
  const ta = node.querySelector('.remark');
  if (ta) ta.addEventListener('input', () => { r.remark = ta.value; scheduleSave(); });
  bindPhotos(node, r, dis);
  return node;
}

function openItem(sec, it, dis) {
  const r = getResp(sec.id, it.id);
  if (!('text' in r)) r.text = '';
  const node = el('div', { class: 'item open' });
  node.innerHTML = `<p class="item-txt">${esc(it.text)}</p>
    <textarea class="remark" placeholder="Write your answer…" ${dis ? 'disabled' : ''}>${esc(r.remark || '')}</textarea>
    <div class="photos" data-photos></div>
    ${dis ? '' : `<label class="photo-add"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Add photo<input type="file" accept="image/*" capture="environment" hidden></label>`}`;
  if (!r.answer) r.answer = 'na'; // open answers don't count toward score
  const ta = node.querySelector('.remark');
  ta.addEventListener('input', () => { r.remark = ta.value; scheduleSave(); });
  bindPhotos(node, r, dis);
  return node;
}

// --- Photos -----------------------------------------------------------------
function bindPhotos(node, holder, dis) {
  const cont = node.querySelector('[data-photos]');
  const render = async () => {
    cont.innerHTML = '';
    for (const pid of holder.photos || []) {
      const p = await store.photo(pid);
      if (!p) continue;
      const thumb = el('div', { class: 'thumb' });
      thumb.innerHTML = `<img src="${p.dataURL}" alt="photo"/>${dis ? '' : `<button class="thumb-del" data-pid="${pid}" aria-label="Delete photo" title="Delete photo">×</button>`}`;
      thumb.querySelector('img').addEventListener('click', () => openLightbox(p.dataURL));
      const del = thumb.querySelector('.thumb-del');
      if (del) del.addEventListener('click', async () => {
        holder.photos = holder.photos.filter((x) => x !== pid);
        await store.delPhoto(pid);
        scheduleSave(); render();
      });
      cont.append(thumb);
    }
  };
  const input = node.querySelector('input[type=file]');
  if (input) input.addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      try {
        const dataURL = await fileToCompressedDataURL(file);
        const id = await store.savePhoto(dataURL);
        holder.photos = holder.photos || [];
        holder.photos.push(id);
      } catch { toast('Could not read image', 'bad'); }
    }
    input.value = '';
    scheduleSave(); render();
  });
  render();
}

function openLightbox(src) {
  const lb = el('div', { class: 'lightbox', onClick: () => lb.remove() });
  lb.innerHTML = `<img src="${src}"/>`;
  document.body.append(lb);
}

// --- Energy-Based Safety ----------------------------------------------------
function buildEnergy() {
  const wrap = _root.querySelector('#energyRows');
  const dis = _visit.status !== 'draft';
  const render = () => {
    wrap.innerHTML = '';
    if (!_visit.energy.length) wrap.innerHTML = '<p class="hint empty-row">No energy sources added yet.</p>';
    _visit.energy.forEach((row, idx) => wrap.append(energyRow(row, idx, dis, render)));
  };
  const addBtn = _root.querySelector('#addEnergy');
  if (addBtn) addBtn.addEventListener('click', () => {
    if (dis) return;
    _visit.energy.push(ENERGY_ROW());
    scheduleSave(); render();
  });
  render();
}

function energyRow(row, idx, dis, rerender) {
  const node = el('div', { class: `energy-row ${row.highEnergy ? 'high' : ''}` });
  const e = ENERGY_TYPES.find((x) => x.id === row.energyId);
  node.innerHTML = `
    <div class="energy-grid">
      <label class="fld"><span>Hazard (energy)</span>
        <select data-k="energyId" ${dis ? 'disabled' : ''}><option value="">— select —</option>
          ${ENERGY_TYPES.map((et) => `<option value="${et.id}" ${row.energyId === et.id ? 'selected' : ''}>${et.icon} ${et.label}</option>`).join('')}
        </select></label>
      <label class="fld"><span>Danger zone</span>
        <select data-k="dangerZone" ${dis ? 'disabled' : ''}><option value="">—</option>
          ${DANGER_ZONES.map((z) => `<option value="${z.id}" ${row.dangerZone === z.id ? 'selected' : ''}>${z.icon} ${z.label}</option>`).join('')}
        </select></label>
      <label class="chk"><input type="checkbox" data-k="highEnergy" ${row.highEnergy ? 'checked' : ''} ${dis ? 'disabled' : ''}/> High-energy (serious-harm potential)</label>
      <label class="chk"><input type="checkbox" data-k="directControl" ${row.directControl ? 'checked' : ''} ${dis ? 'disabled' : ''}/> Direct control present</label>
      <label class="fld"><span>Control type (hierarchy)</span>
        <select data-k="controlType" ${dis ? 'disabled' : ''}><option value="">—</option>
          ${CONTROL_HIERARCHY.map((c) => `<option value="${c.id}" ${row.controlType === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select></label>
      <label class="fld"><span>Control condition</span>
        <select data-k="controlCondition" ${dis ? 'disabled' : ''}><option value="">—</option>
          ${CONTROL_CONDITION.map((c) => `<option value="${c.id}" ${row.controlCondition === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select></label>
    </div>
    ${e ? `<p class="hint">${e.icon} ${esc(e.hint)}</p>` : ''}
    <textarea class="remark" data-k="notes" placeholder="Notes on the control…" ${dis ? 'disabled' : ''}>${esc(row.notes || '')}</textarea>
    <div class="photos" data-photos></div>
    ${dis ? '' : `<div class="energy-row-foot"><label class="photo-add"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Add photo<input type="file" accept="image/*" capture="environment" hidden></label><button class="icon-btn del" data-del><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Remove</button></div>`}`;

  node.querySelectorAll('[data-k]').forEach((inp) => {
    inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', () => {
      row[inp.dataset.k] = inp.type === 'checkbox' ? inp.checked : inp.value;
      if (inp.dataset.k === 'highEnergy') node.classList.toggle('high', inp.checked);
      scheduleSave();
    });
  });
  const del = node.querySelector('[data-del]');
  if (del) del.addEventListener('click', () => { _visit.energy.splice(idx, 1); scheduleSave(); rerender(); });
  bindPhotos(node, row, dis);
  return node;
}

// --- JHA steps --------------------------------------------------------------
function buildJHASteps() {
  _visit.jhaSteps = _visit.jhaSteps || [];
  const wrap = _root.querySelector('#jhaSteps');
  const dis = _visit.status !== 'draft';
  const render = () => {
    wrap.innerHTML = `<div class="jha-grid jha-head"><span>Job step</span><span>Danger zone</span><span>Potential hazards</span><span>Controls</span><span>Residual risk</span><span></span></div>`;
    if (!_visit.jhaSteps.length) wrap.innerHTML += '<p class="hint empty-row">No steps yet.</p>';
    _visit.jhaSteps.forEach((st, i) => {
      const r = el('div', { class: 'jha-grid' });
      r.innerHTML = `
        <textarea data-k="step" placeholder="Describe the step" ${dis ? 'disabled' : ''}>${esc(st.step || '')}</textarea>
        <select data-k="zone" ${dis ? 'disabled' : ''}><option value="">—</option>${DANGER_ZONES.map((z) => `<option value="${z.id}" ${st.zone === z.id ? 'selected' : ''}>${z.icon} ${z.label}</option>`).join('')}</select>
        <textarea data-k="hazard" placeholder="Hazards" ${dis ? 'disabled' : ''}>${esc(st.hazard || '')}</textarea>
        <textarea data-k="control" placeholder="Controls" ${dis ? 'disabled' : ''}>${esc(st.control || '')}</textarea>
        <select data-k="risk" ${dis ? 'disabled' : ''}>${['Low', 'Medium', 'High'].map((x) => `<option ${st.risk === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
        ${dis ? '<span></span>' : '<button class="icon-btn del" data-del aria-label="Remove row" title="Remove"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>'}`;
      r.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('input', () => { st[inp.dataset.k] = inp.value; scheduleSave(); }));
      const del = r.querySelector('[data-del]');
      if (del) del.addEventListener('click', () => { _visit.jhaSteps.splice(i, 1); scheduleSave(); render(); });
      wrap.append(r);
    });
  };
  const add = _root.querySelector('#addStep');
  if (add) add.addEventListener('click', () => { _visit.jhaSteps.push({ step: '', zone: '', hazard: '', control: '', risk: 'Low' }); scheduleSave(); render(); });
  render();
}

// --- Actions ----------------------------------------------------------------
async function buildActions() {
  const wrap = _root.querySelector('#actionsList');
  const dis = _visit.status !== 'draft';
  const all = (await store.actions()).filter((a) => a.visitId === _visit.id);
  const render = (list) => {
    wrap.innerHTML = '';
    if (!list.length) { wrap.innerHTML = '<p class="hint empty-row">No actions yet.</p>'; return; }
    list.forEach((a) => wrap.append(actionRow(a, dis, () => buildActions())));
  };
  const add = _root.querySelector('#addAction');
  if (add && !add._bound) {
    add._bound = true;
    add.addEventListener('click', async () => {
      const a = newAction(_visit, { type: ACTION_DEFAULTS.types[1] });
      await store.saveAction(a);
      buildActions();
    });
  }
  render(all);
}

function actionRow(a, dis, rerender) {
  const node = el('div', { class: 'action-row' });
  node.innerHTML = `
    <div class="grid2">
      <label class="fld"><span>Title</span><input data-k="title" value="${esc(a.title)}" ${dis ? 'disabled' : ''}/></label>
      <label class="fld"><span>Owner</span><input data-k="owner" value="${esc(a.owner)}" ${dis ? 'disabled' : ''}/></label>
    </div>
    <label class="fld"><span>Description</span><textarea data-k="description" ${dis ? 'disabled' : ''}>${esc(a.description)}</textarea></label>
    <div class="grid4">
      <label class="fld"><span>Type</span><select data-k="type" ${dis ? 'disabled' : ''}>${ACTION_DEFAULTS.types.map((x) => `<option ${a.type === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="fld"><span>Priority</span><select data-k="priority" ${dis ? 'disabled' : ''}>${['High', 'Medium', 'Low'].map((x) => `<option ${a.priority === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="fld"><span>Status</span><select data-k="status">${['Open', 'In progress', 'Implemented', 'Closed'].map((x) => `<option ${a.status === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="fld"><span>Due date</span><input type="date" data-k="dueDate" value="${esc(a.dueDate)}"/></label>
    </div>
    <div class="action-foot">${dis ? '' : '<button class="icon-btn del" data-del><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Remove</button>'}</div>`;
  node.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('input', async () => {
    a[inp.dataset.k] = inp.value; await store.saveAction(a);
  }));
  const del = node.querySelector('[data-del]');
  if (del) del.addEventListener('click', async () => { await store.delAction(a.id); rerender(); });
  return node;
}

// --- Section nav / progress -------------------------------------------------
function countAnswerable(sec) { return sec.items.filter((i) => !i.open).length; }
function sectionAnswered(sec) {
  const r = _visit.responses[sec.id] || {};
  return sec.items.filter((i) => !i.open && r[i.id] && r[i.id].answer && r[i.id].answer !== '').length;
}
function updateSectionProg(sec) {
  const tag = _root.querySelector(`[data-prog="${sec.id}"]`);
  if (tag) tag.textContent = `${sectionAnswered(sec)}/${countAnswerable(sec)}`;
}
function updateHeaderScore() {
  const s = visitScore(_visit);
  const chip = _root.querySelector('.score-chip');
  if (!chip) return;
  chip.className = `score-chip ${s.score == null ? 'muted' : s.score >= 90 ? 'good' : s.score >= 75 ? 'warn' : 'bad'}`;
  chip.querySelector('b').textContent = s.score == null ? '—' : s.score + '%';
}

function buildNav() {
  const nav = _root.querySelector('#secNav');
  const links = [['General', 'sec-general']];
  if (_template.hasEBS) links.push(['Hazard Wheel', 'sec-ebs']);
  if (_template.isJHA) links.push(['Error traps', 'sec-errortraps']);
  for (const sec of _template.sections) links.push([sec.title, `sec-${sec.id}`]);
  if (_template.isJHA) links.push(['Steps', 'sec-jhasteps']);
  if (_template.hasActions) links.push(['Actions', 'sec-actions']);
  nav.innerHTML = links.map(([label, id]) => `<a href="#" data-to="${id}">${esc(label)}</a>`).join('');
  nav.addEventListener('click', (e) => {
    const a = e.target.closest('[data-to]');
    if (!a) return;
    e.preventDefault();
    const t = document.getElementById(a.dataset.to);
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// --- Header actions ---------------------------------------------------------
function bindHeader() {
  const submit = async () => {
    const missing = validate();
    if (missing) { toast(missing, 'bad'); return; }
    _visit.status = 'submitted';
    await scheduleSave(true);
    toast('Visit submitted ✓', 'good');
    paint();
  };
  const reopen = async () => { _visit.status = 'draft'; await scheduleSave(true); toast('Visit reopened'); paint(); };
  const del = async () => {
    if (!(await confirmDialog('Delete this visit and its actions?'))) return;
    for (const a of (await store.actions()).filter((a) => a.visitId === _visit.id)) await store.delAction(a.id);
    await store.delVisit(_visit.id);
    toast('Visit deleted');
    location.hash = '#/visits';
  };
  ['#submitBtn', '#submitBtn2'].forEach((id) => { const b = _root.querySelector(id); if (b) b.addEventListener('click', submit); });
  const ro = _root.querySelector('#reopenBtn'); if (ro) ro.addEventListener('click', reopen);
  const db = _root.querySelector('#delBtn'); if (db) db.addEventListener('click', del);
}

function validate() {
  if (!_visit.general.observer) return 'Observer is required before submitting.';
  if (!_visit.general.date) return 'Date of visit is required.';
  let answered = 0;
  for (const sec of _template.sections) answered += sectionAnswered(sec);
  if (!_template.isJHA && answered === 0) return 'Answer at least one checklist item before submitting.';
  return null;
}
