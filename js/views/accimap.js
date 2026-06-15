// views/accimap.js — AcciMap editor: systems-based accident analysis diagrams
// (Rasmussen / Svedung). Causes are arranged in hierarchical sociotechnical
// levels; unidirectional causal arrows flow downwards towards the outcome(s).
// Multiple causes may link to one effect and one cause may have many effects.

import { store } from '../store.js';
import { uid, esc, toast, confirmDialog, download } from '../utils.js';
import { icons } from '../icons.js';

// --- AcciMap levels (top → bottom, per the method) ---------------------------
export const AM_LEVELS = [
  { id: 'societal', label: 'Societal & market', hint: 'Market forces, societal values, global politics, historical events', color: '#6a6488' },
  { id: 'government', label: 'Government / Regulatory', hint: 'Legislation, budgets, regulations, certification, enforcement, auditing', color: '#5b7795' },
  { id: 'corporate', label: 'Corporate / Company policy', hint: 'Company budgeting, corporate policy, cost cutting, outsourcing', color: '#4c828a' },
  { id: 'organisational', label: 'Organisational', hint: 'Procedures, training, supervision, communication, defences, risk management', color: '#b07d44' },
  { id: 'physical', label: 'Immediate physical sequence', hint: 'Physical events, technical failures, environmental conditions', color: '#9a4f49' },
  { id: 'actor', label: 'Actor activities / Outcome', hint: 'Human actions, errors, violations — and the accident outcome(s)', color: '#E2001A' },
];
const LEVEL_IDX = Object.fromEntries(AM_LEVELS.map((l, i) => [l.id, i]));

const BAND_H = 168;          // canvas band height per level
const STAGE_W = 1720;        // scrollable stage width
const NODE_W = 178;          // node card width

let _root = null, _diagrams = [], _d = null;   // diagram list + current diagram
let _sel = { node: null, link: null };
let _saveTimer = null;
let _linkDraft = null;       // {fromId, x, y} while dragging a connection

// --- persistence (meta collection — syncs with the backend like the rest) ----
async function loadAll() {
  const rec = await store.meta('accimaps');
  _diagrams = (rec && Array.isArray(rec.value)) ? rec.value : [];
}
function persist() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    _d.updatedAt = new Date().toISOString();
    await store.setMeta('accimaps', _diagrams);
    const st = document.getElementById('amSaved');
    if (st) st.textContent = 'Saved';
  }, 500);
  const st = document.getElementById('amSaved');
  if (st) st.textContent = 'Saving…';
}

function newDiagram(title = 'Untitled AcciMap') {
  return { id: uid('am'), title, nodes: [], links: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

// --- entry -------------------------------------------------------------------
export async function renderAccimap(root) {
  _root = root;
  await loadAll();
  if (!_diagrams.length) {
    // first visit: start with the worked example so the method is self-evident
    _diagrams.push(exampleDiagram());
    await store.setMeta('accimaps', _diagrams);
  }
  _d = _diagrams[0];
  _sel = { node: null, link: null };
  paint();
}

function paint() {
  _root.innerHTML = `
    <header class="view-head">
      <div><h1>AcciMap</h1><p class="muted">Systems-based accident analysis — causal factors across sociotechnical levels, arrows flowing down to the outcome.</p></div>
      <div class="row-gap">
        <button class="btn" id="amCheck">Check logic</button>
        <button class="btn" id="amExportSvg">Export SVG</button>
        <button class="btn primary" id="amExportPng">Export PNG</button>
      </div>
    </header>

    <div class="am-wrap">
      <aside class="am-side" id="amSide">
        <div class="am-side-sec">
          <div class="am-side-h">Diagram</div>
          <select id="amPick" class="select am-block">${_diagrams.map((d) => `<option value="${d.id}" ${d.id === _d.id ? 'selected' : ''}>${esc(d.title)}</option>`).join('')}</select>
          <input id="amTitle" class="am-block" value="${esc(_d.title)}" placeholder="Diagram title" aria-label="Diagram title"/>
          <div class="am-row">
            <button class="btn small" id="amNew">+ New</button>
            <button class="btn small" id="amExample">Load example</button>
            <button class="btn small danger" id="amDel">Delete</button>
          </div>
          <p class="am-saved" id="amSaved">Saved</p>
        </div>

        <div class="am-side-sec">
          <div class="am-side-h">Add causes <span class="am-side-sub">click a level</span></div>
          <div class="am-palette">
            ${AM_LEVELS.map((l) => `
              <button class="am-pal" data-add="${l.id}" title="${esc(l.hint)}">
                <i style="background:${l.color}"></i><span>${esc(l.label)}</span><b>+</b>
              </button>`).join('')}
          </div>
        </div>

        <div class="am-side-sec" id="amProps"></div>

        <div class="am-side-sec am-help">
          <div class="am-side-h">Method</div>
          <ul>
            <li>Start at the bottom: immediate physical and actor causes.</li>
            <li>For each cause, add its contributors at the upper levels.</li>
            <li><b>Causal factor</b> = had it not been present, the incident would not have happened.</li>
            <li>All arrows face <b>downwards</b>, towards the outcome(s).</li>
            <li>Causal chains must be unbroken down to the outcome.</li>
          </ul>
        </div>
      </aside>

      <div class="am-main">
        <div class="am-toolbar">
          <button class="btn small" id="amSideTgl" aria-label="Toggle panel">☰ Panel</button>
          <span class="am-tip-inline">Drag nodes to move · drag the <b>○ port</b> to draw a causal arrow · double-click a band to add a cause</span>
        </div>
        <div class="am-canvas-wrap" id="amScroll">
          <div class="am-stage" id="amStage" style="width:${STAGE_W}px;height:${BAND_H * AM_LEVELS.length}px">
            ${AM_LEVELS.map((l, i) => `
              <div class="am-band" data-band="${l.id}" style="top:${i * BAND_H}px;height:${BAND_H}px">
                <span class="am-band-lbl"><i style="background:${l.color}"></i>${esc(l.label)}</span>
              </div>`).join('')}
            <svg class="am-links" id="amLinks" width="${STAGE_W}" height="${BAND_H * AM_LEVELS.length}">
              <defs>
                <marker id="amArrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/>
                </marker>
              </defs>
              <g id="amLinkPaths"></g>
              <path id="amDraft" class="am-draft" d="" />
            </svg>
            <div id="amNodes"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  renderNodes();
  renderLinks();
  renderProps();
  bind();
}

// --- nodes --------------------------------------------------------------------
function nodeColor(n) { return (AM_LEVELS[LEVEL_IDX[n.level]] || AM_LEVELS[5]).color; }

function renderNodes() {
  const host = _root.querySelector('#amNodes');
  host.innerHTML = _d.nodes.map((n) => `
    <div class="am-node ${n.causal ? 'causal' : ''} ${n.outcome ? 'outcome' : ''} ${_sel.node === n.id ? 'sel' : ''}"
         data-node="${n.id}" style="left:${n.x}px;top:${n.y}px;width:${NODE_W}px;--lvl:${nodeColor(n)}">
      ${n.causal ? '<span class="am-cf" title="Causal factor — without it the incident would not have happened">CF</span>' : ''}
      <div class="am-node-txt">${esc(n.text) || '<span class="am-ph">Describe the cause…</span>'}</div>
      <span class="am-port" data-port="${n.id}" title="Drag to draw a causal arrow">○</span>
    </div>`).join('');
}

function addNode(level, x = null, y = null) {
  const i = LEVEL_IDX[level];
  const scroll = _root.querySelector('#amScroll');
  const n = {
    id: uid('amn'), level, text: '', causal: false, outcome: false,
    x: x != null ? x : Math.min(STAGE_W - NODE_W - 30, scroll.scrollLeft + 90 + (_d.nodes.filter((m) => m.level === level).length % 5) * (NODE_W + 26)),
    y: y != null ? y : i * BAND_H + 48,
  };
  _d.nodes.push(n);
  _sel = { node: n.id, link: null };
  renderNodes(); renderLinks(); renderProps(); persist();
  const ta = _root.querySelector('#amText'); if (ta) ta.focus();
}

function delNode(id) {
  _d.nodes = _d.nodes.filter((n) => n.id !== id);
  _d.links = _d.links.filter((l) => l.from !== id && l.to !== id);
  if (_sel.node === id) _sel.node = null;
  renderNodes(); renderLinks(); renderProps(); persist();
}

// --- links ---------------------------------------------------------------------
function anchor(n, asSource) {
  const el2 = _root.querySelector(`[data-node="${n.id}"]`);
  const w = el2 ? el2.offsetWidth : NODE_W;
  const h = el2 ? el2.offsetHeight : 64;
  return asSource ? [n.x + w / 2, n.y + h] : [n.x + w / 2, n.y];
}

function linkPath(a, b) {
  const dy = Math.max(34, Math.abs(b[1] - a[1]) * 0.45);
  return `M${a[0]},${a[1]} C${a[0]},${a[1] + dy} ${b[0]},${b[1] - dy} ${b[0]},${b[1]}`;
}

function renderLinks() {
  const g = _root.querySelector('#amLinkPaths');
  if (!g) return;
  g.innerHTML = _d.links.map((l) => {
    const from = _d.nodes.find((n) => n.id === l.from);
    const to = _d.nodes.find((n) => n.id === l.to);
    if (!from || !to) return '';
    const up = LEVEL_IDX[to.level] < LEVEL_IDX[from.level];
    const d = linkPath(anchor(from, true), anchor(to, false));
    return `
      <path class="am-hit" data-link="${l.id}" d="${d}"/>
      <path class="am-link ${_sel.link === l.id ? 'sel' : ''} ${up ? 'up' : ''}" data-linkv="${l.id}" d="${d}" marker-end="url(#amArrow)"/>`;
  }).join('');
}

function addLink(fromId, toId) {
  if (fromId === toId) return;
  if (_d.links.some((l) => l.from === fromId && l.to === toId)) { toast('That causal link already exists'); return; }
  const from = _d.nodes.find((n) => n.id === fromId);
  const to = _d.nodes.find((n) => n.id === toId);
  _d.links.push({ id: uid('aml'), from: fromId, to: toId });
  if (LEVEL_IDX[to.level] < LEVEL_IDX[from.level]) {
    toast('AcciMap arrows should face downwards, towards the outcome', 'bad');
  }
  renderLinks(); persist();
}

// --- properties panel ------------------------------------------------------------
function renderProps() {
  const host = _root.querySelector('#amProps');
  if (!host) return;
  const n = _d.nodes.find((x) => x.id === _sel.node);
  if (!n) {
    host.innerHTML = `<div class="am-side-h">Properties</div><p class="am-empty">Select a cause on the canvas to edit it.</p>`;
    return;
  }
  const inLinks = _d.links.filter((l) => l.to === n.id);
  const outLinks = _d.links.filter((l) => l.from === n.id);
  const nameOf = (id) => { const m = _d.nodes.find((x) => x.id === id); return m ? (m.text || '(untitled)') : '?'; };
  host.innerHTML = `
    <div class="am-side-h">Properties</div>
    <label class="fld"><span>Cause description</span>
      <textarea id="amText" rows="3" placeholder="e.g. Inadequate pre-task risk assessment">${esc(n.text)}</textarea></label>
    <label class="fld"><span>Level</span>
      <select id="amLevel">${AM_LEVELS.map((l) => `<option value="${l.id}" ${n.level === l.id ? 'selected' : ''}>${l.label}</option>`).join('')}</select></label>
    <label class="chk am-chk"><input type="checkbox" id="amCausal" ${n.causal ? 'checked' : ''}/> Causal factor</label>
    <label class="chk am-chk"><input type="checkbox" id="amOutcome" ${n.outcome ? 'checked' : ''}/> Accident outcome (event)</label>
    ${inLinks.length ? `<div class="am-side-h am-mt">Caused by</div>${inLinks.map((l) => `<div class="am-linkrow"><span>${esc(nameOf(l.from).slice(0, 34))}</span><button class="linklike" data-dellink="${l.id}">remove</button></div>`).join('')}` : ''}
    ${outLinks.length ? `<div class="am-side-h am-mt">Leads to</div>${outLinks.map((l) => `<div class="am-linkrow"><span>${esc(nameOf(l.to).slice(0, 34))}</span><button class="linklike" data-dellink="${l.id}">remove</button></div>`).join('')}` : ''}
    <button class="btn small danger am-mt" id="amDelNode">Delete cause</button>
  `;
  host.querySelector('#amText').addEventListener('input', (e) => {
    n.text = e.target.value;
    const txtEl = _root.querySelector(`[data-node="${n.id}"] .am-node-txt`);
    if (txtEl) txtEl.innerHTML = esc(n.text) || '<span class="am-ph">Describe the cause…</span>';
    renderLinks(); persist();
  });
  host.querySelector('#amLevel').addEventListener('change', (e) => {
    n.level = e.target.value;
    n.y = LEVEL_IDX[n.level] * BAND_H + 48;
    renderNodes(); renderLinks(); persist();
  });
  host.querySelector('#amCausal').addEventListener('change', (e) => { n.causal = e.target.checked; renderNodes(); renderLinks(); persist(); });
  host.querySelector('#amOutcome').addEventListener('change', (e) => { n.outcome = e.target.checked; renderNodes(); renderLinks(); persist(); });
  host.querySelector('#amDelNode').addEventListener('click', async () => {
    if (await confirmDialog('Delete this cause and its links?')) delNode(n.id);
  });
  host.querySelectorAll('[data-dellink]').forEach((b) => b.addEventListener('click', () => {
    _d.links = _d.links.filter((l) => l.id !== b.dataset.dellink);
    renderLinks(); renderProps(); persist();
  }));
}

// --- interaction ------------------------------------------------------------------
function stagePoint(e) {
  const stage = _root.querySelector('#amStage');
  const r = stage.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

function bind() {
  const stage = _root.querySelector('#amStage');
  const scroll = _root.querySelector('#amScroll');

  // header actions
  _root.querySelector('#amExportPng').addEventListener('click', () => exportImage('png'));
  _root.querySelector('#amExportSvg').addEventListener('click', () => exportImage('svg'));
  _root.querySelector('#amCheck').addEventListener('click', checkLogic);
  _root.querySelector('#amSideTgl').addEventListener('click', () => _root.querySelector('#amSide').classList.toggle('closed'));

  // diagram management
  _root.querySelector('#amPick').addEventListener('change', (e) => {
    _d = _diagrams.find((d) => d.id === e.target.value) || _d;
    _sel = { node: null, link: null }; paint();
  });
  _root.querySelector('#amTitle').addEventListener('input', (e) => {
    _d.title = e.target.value;
    const opt = _root.querySelector(`#amPick option[value="${_d.id}"]`); if (opt) opt.textContent = _d.title || 'Untitled';
    persist();
  });
  _root.querySelector('#amNew').addEventListener('click', () => {
    const d = newDiagram(); _diagrams.unshift(d); _d = d; _sel = { node: null, link: null }; persist(); paint();
  });
  _root.querySelector('#amDel').addEventListener('click', async () => {
    if (!(await confirmDialog('Delete this AcciMap diagram?'))) return;
    _diagrams = _diagrams.filter((d) => d.id !== _d.id);
    if (!_diagrams.length) _diagrams.push(newDiagram());
    _d = _diagrams[0]; _sel = { node: null, link: null };
    clearTimeout(_saveTimer); store.setMeta('accimaps', _diagrams);
    paint();
  });
  _root.querySelector('#amExample').addEventListener('click', loadExample);

  // palette → add node
  _root.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => addNode(b.dataset.add)));

  // double-click a band → add a cause there
  stage.addEventListener('dblclick', (e) => {
    if (e.target.closest('.am-node')) return;
    const [x, y] = stagePoint(e);
    const idx = Math.max(0, Math.min(AM_LEVELS.length - 1, Math.floor(y / BAND_H)));
    addNode(AM_LEVELS[idx].id, Math.max(8, x - NODE_W / 2), y - 26);
  });

  // select / drag / connect (single pointerdown handler on the stage)
  stage.addEventListener('pointerdown', (e) => {
    const port = e.target.closest('[data-port]');
    const nodeEl = e.target.closest('[data-node]');
    const hit = e.target.closest('[data-link]');

    if (port) { startLinkDrag(port.dataset.port, e); return; }
    if (nodeEl) { selectNode(nodeEl.dataset.node); startNodeDrag(nodeEl.dataset.node, e); return; }
    if (hit) { _sel = { node: null, link: hit.dataset.link }; renderNodes(); renderLinks(); renderProps(); return; }
    // empty canvas → clear selection
    _sel = { node: null, link: null }; renderNodes(); renderLinks(); renderProps();
  });

  // delete selected link/node with keyboard (ignore while typing)
  stage.tabIndex = 0;
  stage.addEventListener('keydown', async (e) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (_sel.link) { _d.links = _d.links.filter((l) => l.id !== _sel.link); _sel.link = null; renderLinks(); renderProps(); persist(); }
    else if (_sel.node) { e.preventDefault(); if (await confirmDialog('Delete this cause and its links?')) delNode(_sel.node); }
  });

  function selectNode(id) {
    if (_sel.node === id) return;
    _sel = { node: id, link: null };
    _root.querySelectorAll('.am-node.sel').forEach((x) => x.classList.remove('sel'));
    const el2 = _root.querySelector(`[data-node="${id}"]`); if (el2) el2.classList.add('sel');
    renderLinks(); renderProps();
  }

  function startNodeDrag(id, e) {
    const n = _d.nodes.find((x) => x.id === id);
    const [sx, sy] = stagePoint(e);
    const ox = sx - n.x, oy = sy - n.y;
    let moved = false;
    const move = (ev) => {
      const [x, y] = stagePoint(ev);
      n.x = Math.max(4, Math.min(STAGE_W - NODE_W - 4, x - ox));
      n.y = Math.max(4, Math.min(BAND_H * AM_LEVELS.length - 60, y - oy));
      moved = true;
      const el2 = _root.querySelector(`[data-node="${id}"]`);
      el2.style.left = n.x + 'px'; el2.style.top = n.y + 'px';
      // live level = band under the node centre
      const idx = Math.max(0, Math.min(AM_LEVELS.length - 1, Math.floor((n.y + el2.offsetHeight / 2) / BAND_H)));
      if (AM_LEVELS[idx].id !== n.level) { n.level = AM_LEVELS[idx].id; el2.style.setProperty('--lvl', nodeColor(n)); }
      renderLinks();
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (moved) { renderProps(); persist(); }
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  function startLinkDrag(fromId, e) {
    e.preventDefault();
    _linkDraft = { fromId };
    const draft = _root.querySelector('#amDraft');
    const from = _d.nodes.find((n) => n.id === fromId);
    const move = (ev) => {
      const [x, y] = stagePoint(ev);
      draft.setAttribute('d', linkPath(anchor(from, true), [x, y]));
      draft.classList.add('on');
      _root.querySelectorAll('.am-node').forEach((el2) => {
        el2.classList.toggle('target', el2.dataset.node !== fromId && hitTest(el2, ev));
      });
    };
    const up = (ev) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      draft.classList.remove('on'); draft.setAttribute('d', '');
      const target = [..._root.querySelectorAll('.am-node')].find((el2) => hitTest(el2, ev));
      _root.querySelectorAll('.am-node.target').forEach((x) => x.classList.remove('target'));
      if (target && target.dataset.node !== fromId) addLink(fromId, target.dataset.node);
      _linkDraft = null;
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  function hitTest(el2, ev) {
    const r = el2.getBoundingClientRect();
    return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
  }

  // keep arrows attached while scrolling on touch devices
  scroll.addEventListener('scroll', () => {}, { passive: true });
}

// --- logic check (PDF §4 step 6 / §5D) ----------------------------------------
function checkLogic() {
  const issues = [];
  const out = _d.nodes.filter((n) => n.outcome);
  if (!_d.nodes.length) { toast('Add causes first'); return; }
  if (!out.length) issues.push('No node is marked as the accident outcome (event).');
  for (const l of _d.links) {
    const a = _d.nodes.find((n) => n.id === l.from), b = _d.nodes.find((n) => n.id === l.to);
    if (a && b && LEVEL_IDX[b.level] < LEVEL_IDX[a.level]) issues.push(`Arrow points upwards: "${(a.text || '?').slice(0, 30)}" → "${(b.text || '?').slice(0, 30)}".`);
  }
  const linked = new Set(_d.links.flatMap((l) => [l.from, l.to]));
  for (const n of _d.nodes) if (!linked.has(n.id)) issues.push(`"${(n.text || 'Untitled cause').slice(0, 36)}" is not connected to anything.`);
  // every non-outcome node should reach an outcome (unbroken chains)
  if (out.length) {
    const next = {};
    for (const l of _d.links) (next[l.from] = next[l.from] || []).push(l.to);
    const reaches = (id, seen = new Set()) => {
      if (seen.has(id)) return false;
      seen.add(id);
      const n = _d.nodes.find((x) => x.id === id);
      if (n && n.outcome) return true;
      return (next[id] || []).some((t) => reaches(t, seen));
    };
    for (const n of _d.nodes) {
      if (!n.outcome && linked.has(n.id) && !reaches(n.id)) issues.push(`"${(n.text || '?').slice(0, 36)}" has no causal chain down to an outcome.`);
    }
  }
  for (const n of _d.nodes) if (!n.text.trim()) issues.push('A cause has no description yet.');
  if (!issues.length) { toast('Logic check passed — chains are unbroken and arrows face down', 'good'); return; }
  const uniq = [...new Set(issues)].slice(0, 8);
  toast(`${uniq.length} issue${uniq.length > 1 ? 's' : ''}: ${uniq[0]}`, 'bad');
  console.info('AcciMap logic check:', uniq);
  const props = _root.querySelector('#amProps');
  props.innerHTML = `<div class="am-side-h">Logic check — ${uniq.length} issue${uniq.length > 1 ? 's' : ''}</div>
    <ul class="am-issues">${uniq.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
}

// --- example (built per the method's template & wording tips) -------------------
function exampleDiagram() {
  const N = (level, text, x, y, causal = false, outcome = false) => ({ id: uid('amn'), level, text, x, y, causal, outcome });
  const n = {
    market: N('societal', 'Market pressure for shorter installation lead times', 660, 38, false),
    values: N('societal', 'Customer priority on cost over safety in contract awards', 180, 56, false),
    enforce: N('government', 'Inadequate enforcement of working-at-height regulations', 220, BAND_H + 38, false),
    permits: N('government', 'Site permits granted without hoistway-access audit', 1080, BAND_H + 52, false),
    budget: N('corporate', 'Corporate cost cutting reduced site supervision budget', 660, BAND_H * 2 + 38, true),
    bidding: N('corporate', 'Contracts bid below cost — schedule pressure on crews', 180, BAND_H * 2 + 56, false),
    ra: N('organisational', 'Inadequate pre-task risk assessment procedure', 450, BAND_H * 3 + 30, true),
    training: N('organisational', 'Insufficient technician training on hoistway access', 90, BAND_H * 3 + 64, false),
    superv: N('organisational', 'Supervisor coverage insufficient across sites', 860, BAND_H * 3 + 64, false),
    audit: N('organisational', 'Internal audits did not cover car-securing practice', 1180, BAND_H * 3 + 30, false),
    door: N('physical', 'Landing door could be unlocked with the car away', 300, BAND_H * 4 + 40, true),
    cwt: N('physical', 'Counterweight moving in the hoistway', 800, BAND_H * 4 + 52, false),
    entry: N('actor', 'Technician entered the hoistway without securing the car', 400, BAND_H * 5 + 22, true),
    outcome: N('actor', 'Technician struck by counterweight — serious injury', 760, BAND_H * 5 + 84, false, true),
  };
  const L = (a, b) => ({ id: uid('aml'), from: n[a].id, to: n[b].id });
  const d = newDiagram('Hoistway access — example AcciMap');
  d.nodes = Object.values(n);
  d.links = [
    L('values', 'bidding'), L('market', 'budget'),
    L('bidding', 'ra'), L('budget', 'superv'), L('budget', 'ra'),
    L('enforce', 'training'), L('enforce', 'ra'), L('permits', 'audit'),
    L('audit', 'superv'),
    L('ra', 'entry'), L('training', 'entry'), L('superv', 'entry'),
    L('door', 'entry'), L('entry', 'outcome'), L('cwt', 'outcome'),
  ];
  return d;
}

function loadExample() {
  const d = exampleDiagram();
  _diagrams.unshift(d); _d = d; _sel = { node: null, link: null };
  persist(); paint();
  toast('Example AcciMap loaded', 'good');
}

// --- export: standalone SVG → file / PNG -----------------------------------------
function wrapText(text, maxChars = 26) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function buildExportSVG() {
  const H = BAND_H * AM_LEVELS.length + 70;
  const dark = document.documentElement.dataset.theme === 'dark';
  const bandFill = (i) => (i % 2 ? '#f7f8fa' : '#ffffff');
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${STAGE_W}" height="${H}" viewBox="0 0 ${STAGE_W} ${H}" font-family="Segoe UI, Helvetica, Arial, sans-serif">`;
  s += `<rect width="${STAGE_W}" height="${H}" fill="#ffffff"/>`;
  s += `<text x="24" y="34" font-size="19" font-weight="700" fill="#14161b">${esc(_d.title)}</text>`;
  s += `<text x="24" y="52" font-size="11" fill="#6c727c">AcciMap — systems-based accident analysis · Safety &amp; Health Information Tool</text>`;
  const oy = 70;
  AM_LEVELS.forEach((l, i) => {
    s += `<rect x="0" y="${oy + i * BAND_H}" width="${STAGE_W}" height="${BAND_H}" fill="${bandFill(i)}"/>`;
    s += `<line x1="0" y1="${oy + i * BAND_H}" x2="${STAGE_W}" y2="${oy + i * BAND_H}" stroke="#e8e9ee"/>`;
    s += `<rect x="14" y="${oy + i * BAND_H + 12}" width="9" height="9" rx="2.5" fill="${l.color}"/>`;
    s += `<text x="29" y="${oy + i * BAND_H + 20}" font-size="11" font-weight="650" fill="#3b4049" letter-spacing=".4">${esc(l.label.toUpperCase())}</text>`;
  });
  s += `<defs><marker id="xArrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#565d68"/></marker></defs>`;
  // node geometry (computed like the live canvas)
  const geom = {};
  for (const n of _d.nodes) {
    const lines = wrapText(n.text);
    const h = 22 + lines.length * 15;
    geom[n.id] = { x: n.x, y: n.y + oy, w: NODE_W, h, lines };
  }
  for (const l of _d.links) {
    const a = geom[l.from], b = geom[l.to];
    if (!a || !b) continue;
    const p1 = [a.x + a.w / 2, a.y + a.h], p2 = [b.x + b.w / 2, b.y];
    const dy = Math.max(30, Math.abs(p2[1] - p1[1]) * 0.45);
    s += `<path d="M${p1[0]},${p1[1]} C${p1[0]},${p1[1] + dy} ${p2[0]},${p2[1] - dy} ${p2[0]},${p2[1]}" fill="none" stroke="#565d68" stroke-width="1.6" marker-end="url(#xArrow)"/>`;
  }
  for (const n of _d.nodes) {
    const g = geom[n.id];
    const col = nodeColor(n);
    const fill = n.outcome ? '#14161b' : '#ffffff';
    const txtCol = n.outcome ? '#ffffff' : '#14161b';
    const stroke = n.causal ? '#E2001A' : '#d6d8df';
    s += `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="9" fill="${fill}" stroke="${stroke}" stroke-width="${n.causal ? 2 : 1}"/>`;
    s += `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="3.5" rx="1.75" fill="${col}"/>`;
    g.lines.forEach((line, i) => {
      s += `<text x="${g.x + g.w / 2}" y="${g.y + 18 + i * 15}" font-size="11.5" text-anchor="middle" fill="${txtCol}" ${n.causal ? 'font-weight="600"' : ''}>${esc(line)}</text>`;
    });
    if (n.causal) s += `<g><circle cx="${g.x + g.w - 2}" cy="${g.y + 2}" r="9" fill="#E2001A"/><text x="${g.x + g.w - 2}" y="${g.y + 5}" font-size="7.5" font-weight="700" text-anchor="middle" fill="#fff">CF</text></g>`;
  }
  s += `<text x="24" y="${H - 14}" font-size="10" fill="#969ba4">Causal factors marked CF · arrows flow downwards towards the outcome · ${new Date().toLocaleDateString()}</text>`;
  s += '</svg>';
  return s;
}

function exportImage(kind) {
  if (!_d.nodes.length) { toast('Nothing to export yet — add causes first'); return; }
  const svgStr = buildExportSVG();
  const name = (_d.title || 'accimap').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (kind === 'svg') { download(`${name}.svg`, svgStr, 'image/svg+xml'); toast('Exported SVG', 'good'); return; }
  const img = new Image();
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
  img.onload = () => {
    const scale = 2;
    const c = document.createElement('canvas');
    c.width = STAGE_W * scale; c.height = (BAND_H * AM_LEVELS.length + 70) * scale;
    const ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    c.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${name}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Exported PNG', 'good');
    }, 'image/png');
  };
  img.onerror = () => toast('Export failed in this browser — try Export SVG', 'bad');
  img.src = url;
}
