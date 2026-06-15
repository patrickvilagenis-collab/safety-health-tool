// views/oleForm.js — create / edit an Operational Learning Event.
// Steps → findings (4D + variability, inside or outside the swimlane) →
// traceable actions, plus a swimlane overview and a closing survey.

import { store, newOLE, newOleAction } from '../store.js';
import {
  OLE_STATUSES, getOleStatus, FOUR_D, getFourD, FINDING_SEVERITY, ATTENDEE_ROLES,
  newStep, newFinding, newAttendee, oleFindings, oleVariabilityCount, oleOutsideFindings,
} from '../ole.js';
import { el, esc, fmtDateTime, toast, confirmDialog } from '../utils.js';

let _o = null, _root = null, _saveTimer = null, _actions = [];

export async function renderOleForm(root, { oleId }) {
  _root = root;
  if (oleId) {
    _o = await store.ole(oleId);
    if (!_o) { root.innerHTML = '<p class="empty">OLE not found.</p>'; return; }
  } else {
    _o = newOLE();
    await store.saveOle(_o);
    history.replaceState(null, '', `#/ole/${_o.id}`);
  }
  _actions = (await store.actions()).filter((a) => a.oleId === _o.id);
  paint();
}

function scheduleSave(immediate = false) {
  clearTimeout(_saveTimer);
  const run = async () => { await store.saveOle(_o); const ind = document.getElementById('saveState'); if (ind) ind.textContent = `Saved · ${fmtDateTime(_o.updatedAt)}`; };
  if (immediate) return run();
  const ind = document.getElementById('saveState'); if (ind) ind.textContent = 'Saving…';
  _saveTimer = setTimeout(run, 600);
}

function findingActions(fid) { return _actions.filter((a) => a.findingId === fid); }

function paint() {
  const o = _o;
  _root.innerHTML = `
    <div class="form-head">
      <div>
        <a class="back" href="#/oles">← OLEs</a>
        <h1>OLE <span class="muted">${esc(o.refNo)}</span></h1>
        <div class="form-sub"><span class="status ole-${o.status}">${esc(getOleStatus(o.status).label)}</span>
          <span id="saveState" class="save-state">Saved · ${fmtDateTime(o.updatedAt)}</span></div>
      </div>
      <div class="form-head-actions">
        <button class="btn" id="swimBtn">Swimlane</button>
        <label class="fld" style="min-width:160px"><span>Status</span>
          <select id="statusSel">${OLE_STATUSES.map((s) => `<option value="${s.id}" ${o.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
      </div>
    </div>

    <nav class="section-nav" id="secNav"></nav>

    <section class="card" id="sec-general"><h3>General</h3><div class="grid2" id="genFields"></div></section>

    <section class="card" id="sec-attendees">
      <div class="card-head"><h3>Attendees</h3><button class="btn small" id="addAtt">+ Add attendee</button></div>
      <div id="attList"></div>
    </section>

    <section class="card" id="sec-prep">
      <h3>Preparatory notes</h3>
      <textarea id="prep" class="remark" placeholder="Agenda, objectives, topics, references to share before the session…">${esc(o.prepNotes || '')}</textarea>
    </section>

    <section class="card" id="sec-steps">
      <div class="card-head"><h3>Process steps & findings</h3><button class="btn small" id="addStep">+ Add step</button></div>
      <p class="hint">Break the task into steps, then add findings on each step. Capture process <b>variability</b> and map the <b>4 D's</b>. Findings that aren't tied to a step go to <b>Outside the swimlane</b>.</p>
      <div id="stepsHost"></div>
    </section>

    <section class="card" id="sec-outside">
      <div class="card-head"><h3>Outside the swimlane <span class="opt">(systemic / not tied to a step)</span></h3><button class="btn small" id="addOutside">+ Add finding</button></div>
      <div id="outsideHost"></div>
    </section>

    <section class="card" id="sec-actions">
      <h3>Actions & traceability</h3>
      <p class="hint">Every action keeps a link back to its finding and step, and feeds the global action tracker.</p>
      <div id="traceHost"></div>
    </section>

    <section class="card" id="sec-survey">
      <h3>Closing survey</h3>
      <div class="grid2" id="surveyFields"></div>
    </section>

    <div class="form-footer"><button class="btn ghost danger" id="delBtn">Delete OLE</button></div>
  `;

  buildGeneral();
  buildAttendees();
  buildSteps();
  buildOutside();
  buildTrace();
  buildSurvey();
  buildNav();

  _root.querySelector('#prep').addEventListener('input', (e) => { _o.prepNotes = e.target.value; scheduleSave(); });
  _root.querySelector('#statusSel').addEventListener('change', (e) => { _o.status = e.target.value; scheduleSave(); const chip = _root.querySelector('.form-sub .status'); chip.className = `status ole-${_o.status}`; chip.textContent = getOleStatus(_o.status).label; });
  _root.querySelector('#swimBtn').addEventListener('click', openSwimlane);
  _root.querySelector('#delBtn').addEventListener('click', async () => {
    if (!(await confirmDialog('Delete this OLE and its actions?'))) return;
    for (const a of _actions) await store.delAction(a.id);
    await store.delOle(_o.id); toast('OLE deleted'); location.hash = '#/oles';
  });
}

// --- General ---------------------------------------------------------------
function fld(label, value, oninput, opts = {}) {
  const w = el('label', { class: 'fld' });
  w.innerHTML = `<span>${esc(label)}</span>`;
  let input;
  if (opts.options) input = el('select');
  else if (opts.textarea) input = el('textarea');
  else input = el('input', { type: opts.type || 'text' });
  if (opts.options) input.innerHTML = `<option value="">—</option>` + opts.options.map((o) => `<option ${value === o ? 'selected' : ''}>${esc(o)}</option>`).join('');
  else input.value = value || '';
  if (opts.ph) input.placeholder = opts.ph;
  input.addEventListener('input', () => oninput(input.value));
  if (input.tagName === 'SELECT') input.addEventListener('change', () => oninput(input.value));
  w.append(input); return w;
}
function buildGeneral() {
  const g = _root.querySelector('#genFields'); const o = _o;
  g.append(
    fld('Title', o.title, (v) => { o.title = v; scheduleSave(); }, { ph: 'Short title for the event' }),
    fld('Task observed', o.task, (v) => { o.task = v; scheduleSave(); }),
    fld('Process', o.process, (v) => { o.process = v; scheduleSave(); }),
    fld('Facilitator', o.facilitator, (v) => { o.facilitator = v; scheduleSave(); }),
    fld('Date', o.date, (v) => { o.date = v; scheduleSave(); }, { type: 'date' }),
    fld('City', o.location.city, (v) => { o.location.city = v; scheduleSave(); }),
    fld('Zone / Hub', o.location.zone, (v) => { o.location.zone = v; scheduleSave(); }),
    fld('Region', o.location.region, (v) => { o.location.region = v; scheduleSave(); }),
    fld('Site / address', o.location.site, (v) => { o.location.site = v; scheduleSave(); }),
  );
}

// --- Attendees -------------------------------------------------------------
function buildAttendees() {
  const host = _root.querySelector('#attList');
  const render = () => {
    host.innerHTML = '';
    if (!_o.attendees.length) host.innerHTML = '<p class="hint empty-row">No attendees yet.</p>';
    _o.attendees.forEach((at, i) => {
      const r = el('div', { class: 'att-row' });
      r.innerHTML = `
        <input data-k="name" value="${esc(at.name)}" placeholder="Name"/>
        <select data-k="role">${ATTENDEE_ROLES.map((x) => `<option ${at.role === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <select data-k="company">${['Schindler', 'Subcontractor', 'Third party'].map((x) => `<option ${at.company === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <button class="icon-btn" data-del aria-label="Remove" title="Remove"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>`;
      r.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('input', () => { at[inp.dataset.k] = inp.value; scheduleSave(); }));
      r.querySelector('[data-del]').addEventListener('click', () => { _o.attendees.splice(i, 1); scheduleSave(); render(); });
      host.append(r);
    });
  };
  _root.querySelector('#addAtt').addEventListener('click', () => { _o.attendees.push(newAttendee()); scheduleSave(); render(); });
  render();
}

// --- Steps & findings ------------------------------------------------------
function buildSteps() {
  const host = _root.querySelector('#stepsHost');
  const render = () => {
    host.innerHTML = '';
    if (!_o.steps.length) host.innerHTML = '<p class="hint empty-row">No steps yet — add the first one.</p>';
    _o.steps.forEach((st, i) => host.append(stepCard(st, i, render)));
  };
  _root.querySelector('#addStep').addEventListener('click', () => { _o.steps.push({ ...newStep(_o.steps.length) }); scheduleSave(); render(); });
  render();
}

function stepCard(st, idx, rerenderSteps) {
  const card = el('div', { class: 'step-card' });
  const findings = oleFindings(_o).filter((f) => f.stepId === st.id);
  card.innerHTML = `
    <div class="step-head">
      <span class="step-n">${idx + 1}</span>
      <input class="step-name" data-k="name" value="${esc(st.name)}" placeholder="Step name"/>
      <button class="btn small" data-addfind>+ Finding</button>
      <button class="icon-btn" data-delstep aria-label="Remove step" title="Remove step"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
    </div>
    <div class="step-findings"></div>`;
  card.querySelector('[data-k="name"]').addEventListener('input', (e) => { st.name = e.target.value; scheduleSave(); });
  card.querySelector('[data-delstep]').addEventListener('click', async () => {
    if (findings.length && !(await confirmDialog('Delete this step and its findings?'))) return;
    _o.findings = oleFindings(_o).filter((f) => f.stepId !== st.id);
    _o.steps.splice(idx, 1); scheduleSave(); rerenderSteps();
  });
  const fh = card.querySelector('.step-findings');
  const renderF = () => {
    fh.innerHTML = '';
    const list = oleFindings(_o).filter((f) => f.stepId === st.id);
    if (!list.length) fh.innerHTML = '<p class="hint empty-row">No findings on this step.</p>';
    list.forEach((f) => fh.append(findingCard(f, renderF)));
  };
  card.querySelector('[data-addfind]').addEventListener('click', () => { _o.findings.push(newFinding(st.id)); scheduleSave(); renderF(); });
  renderF();
  return card;
}

function buildOutside() {
  const host = _root.querySelector('#outsideHost');
  const render = () => {
    host.innerHTML = '';
    const list = oleOutsideFindings(_o);
    if (!list.length) host.innerHTML = '<p class="hint empty-row">No systemic findings outside the swimlane.</p>';
    list.forEach((f) => host.append(findingCard(f, render)));
  };
  _root.querySelector('#addOutside').addEventListener('click', () => { _o.findings.push(newFinding(null)); scheduleSave(); render(); });
  render();
}

function findingCard(f, rerender) {
  const card = el('div', { class: `finding-card ${f.variability ? 'is-var' : ''}` });
  const acts = findingActions(f.id);
  card.innerHTML = `
    <div class="finding-top">
      <textarea class="finding-desc" data-k="description" placeholder="What did the team find?">${esc(f.description)}</textarea>
      <button class="icon-btn" data-delfind aria-label="Remove finding" title="Remove finding"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
    </div>
    <div class="finding-meta">
      <div class="fourd-chips">${FOUR_D.map((d) => `<button type="button" class="fourd-chip ${(f.fourD || []).includes(d.id) ? 'on ' + d.id : ''}" data-4d="${d.id}" title="${esc(d.desc)}">${d.icon} ${d.label}</button>`).join('')}</div>
      <label class="chk var-chk"><input type="checkbox" data-k="variability" ${f.variability ? 'checked' : ''}/> Process variability</label>
      <select data-k="severity" class="sev">${FINDING_SEVERITY.map((s) => `<option ${f.severity === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <input data-k="location" class="floc" value="${esc(f.location)}" placeholder="Location"/>
    </div>
    <div class="var-desc ${f.variability ? '' : 'hidden'}"><textarea data-k="variabilityDesc" placeholder="Describe the variability observed vs. the standard">${esc(f.variabilityDesc)}</textarea></div>
    <div class="finding-actions">
      <div class="fa-head"><span>Actions <b>${acts.length}</b></span><button class="btn small" data-addact>+ Add action</button></div>
      <div class="fa-list"></div>
    </div>`;

  card.querySelector('[data-k="description"]').addEventListener('input', (e) => { f.description = e.target.value; scheduleSave(); });
  card.querySelector('[data-k="severity"]').addEventListener('change', (e) => { f.severity = e.target.value; scheduleSave(); });
  card.querySelector('[data-k="location"]').addEventListener('input', (e) => { f.location = e.target.value; scheduleSave(); });
  const varChk = card.querySelector('[data-k="variability"]');
  varChk.addEventListener('change', () => { f.variability = varChk.checked; card.classList.toggle('is-var', varChk.checked); card.querySelector('.var-desc').classList.toggle('hidden', !varChk.checked); scheduleSave(); });
  card.querySelector('[data-k="variabilityDesc"]').addEventListener('input', (e) => { f.variabilityDesc = e.target.value; scheduleSave(); });
  card.querySelectorAll('[data-4d]').forEach((b) => b.addEventListener('click', () => {
    f.fourD = f.fourD || [];
    const id = b.dataset['4d'];
    if (f.fourD.includes(id)) f.fourD = f.fourD.filter((x) => x !== id); else f.fourD.push(id);
    b.classList.toggle('on'); b.classList.toggle(id);
    scheduleSave();
  }));
  card.querySelector('[data-delfind]').addEventListener('click', async () => {
    const a = findingActions(f.id);
    if (a.length && !(await confirmDialog('Delete this finding and its actions?'))) return;
    for (const x of a) { await store.delAction(x.id); _actions = _actions.filter((y) => y.id !== x.id); }
    _o.findings = oleFindings(_o).filter((x) => x.id !== f.id); scheduleSave(); rerender();
  });

  const faList = card.querySelector('.fa-list');
  const renderActs = () => {
    faList.innerHTML = '';
    findingActions(f.id).forEach((a) => faList.append(actionRow(a, renderActs)));
  };
  card.querySelector('[data-addact]').addEventListener('click', async () => {
    const a = newOleAction(_o, f, { type: 'Learning' });
    await store.saveAction(a); _actions.push(a);
    if (_o.status === 'completed' || _o.status === 'new') { _o.status = 'actions_pending'; scheduleSave(); }
    renderActs();
    const cnt = card.querySelector('.fa-head b'); if (cnt) cnt.textContent = findingActions(f.id).length;
    buildTrace();
  });
  renderActs();
  return card;
}

function actionRow(a, rerender) {
  const node = el('div', { class: 'fa-row' });
  node.innerHTML = `
    <input data-k="title" value="${esc(a.title)}" placeholder="Action"/>
    <input data-k="owner" value="${esc(a.owner)}" placeholder="Owner"/>
    <select data-k="priority">${['High', 'Medium', 'Low'].map((x) => `<option ${a.priority === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <select data-k="status">${['Open', 'In progress', 'Implemented', 'Closed'].map((x) => `<option ${a.status === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <input type="date" data-k="dueDate" value="${esc(a.dueDate)}"/>
    <button class="icon-btn" data-del aria-label="Remove" title="Remove"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>`;
  node.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('input', async () => { a[inp.dataset.k] = inp.value; await store.saveAction(a); }));
  node.querySelector('[data-del]').addEventListener('click', async () => { await store.delAction(a.id); _actions = _actions.filter((x) => x.id !== a.id); rerender(); buildTrace(); });
  return node;
}

// --- Actions traceability summary ------------------------------------------
function buildTrace() {
  const host = _root.querySelector('#traceHost');
  if (!host) return;
  if (!_actions.length) { host.innerHTML = '<p class="hint empty-row">No actions yet — add them on findings above.</p>'; return; }
  const stepName = (id) => { const s = (_o.steps || []).find((x) => x.id === id); return s ? s.name || 'Step' : null; };
  host.innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>Action</th><th>From finding</th><th>Where</th><th>Owner</th><th>Priority</th><th>Status</th><th>Due</th></tr></thead><tbody>${
    _actions.map((a) => {
      const f = oleFindings(_o).find((x) => x.id === a.findingId);
      const where = f ? (f.stepId ? '🧩 ' + (stepName(f.stepId) || 'Step') : '🚧 Outside swimlane') : '—';
      return `<tr><td><b>${esc(a.title || '(untitled)')}</b></td><td>${esc(f ? (f.description || '').slice(0, 50) : '—')}</td><td>${esc(where)}</td><td>${esc(a.owner || '—')}</td><td><span class="prio ${a.priority.toLowerCase()}">${esc(a.priority)}</span></td><td>${esc(a.status)}</td><td>${esc(a.dueDate || '—')}</td></tr>`;
    }).join('')
  }</tbody></table></div>`;
}

// --- Survey ----------------------------------------------------------------
function buildSurvey() {
  const host = _root.querySelector('#surveyFields'); const s = _o.survey || (_o.survey = { rating: '', learned: '', improve: '' });
  host.append(
    fld('How useful was this OLE? (1–5)', s.rating, (v) => { s.rating = v; scheduleSave(); }, { options: ['1', '2', '3', '4', '5'] }),
    fld('What did we learn?', s.learned, (v) => { s.learned = v; scheduleSave(); }, { textarea: true }),
    fld('What could we improve next time?', s.improve, (v) => { s.improve = v; scheduleSave(); }, { textarea: true }),
  );
}

function buildNav() {
  const nav = _root.querySelector('#secNav');
  const links = [['General', 'sec-general'], ['Attendees', 'sec-attendees'], ['Steps & findings', 'sec-steps'], ['Outside swimlane', 'sec-outside'], ['Actions', 'sec-actions'], ['Survey', 'sec-survey']];
  nav.innerHTML = links.map(([l, id]) => `<a href="#" data-to="${id}">${esc(l)}</a>`).join('');
  nav.addEventListener('click', (e) => { const a = e.target.closest('[data-to]'); if (!a) return; e.preventDefault(); document.getElementById(a.dataset.to)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
}

// --- Swimlane overview ------------------------------------------------------
function openSwimlane() {
  document.getElementById('swimModal')?.remove();
  const modal = el('div', { class: 'swim-modal', id: 'swimModal', onClick: (e) => { if (e.target.id === 'swimModal') modal.remove(); } });
  const lane = (title, findings, cls) => {
    const body = findings.map((f) => {
      const acts = findingActions(f.id);
      const ds = (f.fourD || []).map((d) => { const x = getFourD(d); return `<span class="swim-4d ${d}" title="${esc(x ? x.label : d)}">${x ? x.icon : ''}</span>`; }).join('');
      return `<div class="swim-card ${f.variability ? 'var' : ''} sev-${(f.severity || '').toLowerCase()}">
        <div class="swim-card-d">${esc(f.description || 'Finding')}</div>
        <div class="swim-card-meta">${ds}${f.variability ? '<span class="swim-var">VAR</span>' : ''}${f.location ? `<span class="swim-loc">${esc(f.location)}</span>` : ''}${acts.length ? `<span class="swim-act">✅ ${acts.length}</span>` : ''}</div>
      </div>`;
    }).join('') || '<div class="swim-empty">—</div>';
    return `<div class="swim-lane ${cls || ''}"><div class="swim-lane-h">${esc(title)}</div><div class="swim-lane-b">${body}</div></div>`;
  };
  const stepLanes = (_o.steps || []).map((st, i) => lane(`${i + 1}. ${st.name || 'Step'}`, oleFindings(_o).filter((f) => f.stepId === st.id))).join('');
  const outsideLane = lane('🚧 Outside the swimlane', oleOutsideFindings(_o), 'outside');
  modal.innerHTML = `
    <div class="swim-panel">
      <div class="swim-head"><h2>Swimlane — ${esc(_o.refNo)}</h2><button class="icon-btn" id="swimClose" aria-label="Close swimlane" title="Close">✕</button></div>
      <p class="hint">Steps as lanes with their findings, 4D tags, variability and actions. Systemic findings sit in their own lane.</p>
      <div class="swim-board">${stepLanes || '<div class="swim-empty">No steps yet.</div>'}${outsideLane}</div>
      <div class="swim-legend">${FOUR_D.map((d) => `<span class="leg"><i class="swim-4d ${d.id}">${d.icon}</i>${d.label}</span>`).join('')}<span class="leg"><i class="swim-var">VAR</i>Variability</span></div>
    </div>`;
  document.body.append(modal);
  modal.querySelector('#swimClose').addEventListener('click', () => modal.remove());
  requestAnimationFrame(() => modal.classList.add('open'));
}
