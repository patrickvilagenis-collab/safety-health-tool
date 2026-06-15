// app.js — application shell + hash router.

import { ensureSeed, store } from './store.js';
import { db, dbMode } from './db.js';
import * as sync from './sync.js';
import { renderLogin } from './auth.js';
import { renderDashboard } from './views/dashboard.js';
import { renderVisits, renderNewVisit } from './views/visits.js';
import { renderVisitForm } from './views/visitForm.js';
import { renderAnalysis } from './views/analysis.js';
import { renderActions } from './views/actions.js';
import { renderSettings } from './views/settings.js';
import { renderAccidents, renderNewAccident } from './views/accidents.js';
import { renderAccidentForm } from './views/accidentForm.js';
import { renderOles } from './views/oles.js';
import { renderOleForm } from './views/oleForm.js';
import { renderIntelligence } from './views/intelligence.js';
import { renderAccimap } from './views/accimap.js';
import { icons } from './icons.js';
import { initInstall } from './install.js';

const NAV_GROUPS = [
  ['Overview', [
    ['#/dashboard', icons.overview, 'Overview'],
    ['#/intel', icons.intel, 'Intelligence'],
  ]],
  ['Field operations', [
    ['#/visits', icons.visits, 'Field visits'],
    ['#/accidents', icons.accidents, 'Accidents'],
    ['#/oles', icons.ole, 'OLE'],
  ]],
  ['Insights', [
    ['#/analysis', icons.analysis, 'Analysis'],
    ['#/accimap', icons.accimap, 'AcciMap'],
    ['#/actions', icons.actions, 'Actions'],
  ]],
  ['System', [
    ['#/settings', icons.settings, 'Settings'],
  ]],
];
const NAV = NAV_GROUPS.flatMap(([, items]) => items);

function shell() {
  const today = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  document.getElementById('app').innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <img class="brand-logo" src="./assets/schindler.svg" alt="Schindler" />
        <div class="brand-txt"><b>Safety &amp; Health</b><small>Information Tool</small></div>
      </div>
      <nav class="nav">${NAV_GROUPS.map(([label, items]) =>
        `${label ? `<div class="nav-label">${label}</div>` : ''}` +
        items.map(([h, i, l]) => `<a href="${h}" data-nav="${h}"><span>${i}</span>${l}</a>`).join('')
      ).join('')}</nav>
      <div class="sidebar-foot"></div>
    </aside>
    <main class="content">
      <header class="topbar">
        <div class="tb-crumb"><span id="tbSection">Dashboard</span><span class="tb-date">${today}</span></div>
        <div class="tb-search">
          <span class="tb-search-ic">${icons.search}</span>
          <input id="globalSearch" placeholder="Search visits, accidents, OLEs, actions…" autocomplete="off" aria-label="Search across the platform"/>
          <kbd class="tb-kbd">Ctrl K</kbd>
          <div class="tb-results" id="tbResults"></div>
        </div>
        <div class="tb-right"><button class="theme-btn" id="themeBtn" title="Toggle dark mode" aria-label="Toggle dark mode">${icons.moon}</button><span id="netState" class="net"></span><div id="userBox" class="user-box"></div></div>
      </header>
      <div id="view"></div>
    </main>
    <nav class="tabbar">${NAV.map(([h, i, l]) => `<a href="${h}" data-nav="${h}"><span>${i}</span><small>${l}</small></a>`).join('')}</nav>
  `;
  updateNet();
  initSearch();
  initTooltip();
  initTheme();
}

function initTheme() {
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  const apply = (t) => {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('shi_theme', t); } catch {}
    btn.innerHTML = t === 'dark' ? icons.sun : icons.moon;
  };
  apply(document.documentElement.dataset.theme || 'light');
  btn.addEventListener('click', () => apply(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
}

function setActive(hash) {
  const base = '#/' + (hash.split('/')[1] || 'dashboard');
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === base);
  });
  const item = NAV.find(([h]) => h === base) || NAV.find(([h]) => base.startsWith(h.replace(/s$/, '')));
  const tb = document.getElementById('tbSection');
  if (tb && item) tb.textContent = item[2];
}

// --- floating chart tooltip (driven by data-tip attributes) -----------------
function initTooltip() {
  if (document.getElementById('tipbox')) return;
  const tip = document.createElement('div');
  tip.id = 'tipbox'; tip.className = 'tipbox';
  document.body.append(tip);
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t) { tip.textContent = t.dataset.tip; tip.classList.add('show'); }
    else tip.classList.remove('show');
  });
  document.addEventListener('mousemove', (e) => {
    if (!tip.classList.contains('show')) return;
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 10);
    const y = Math.min(e.clientY + 16, window.innerHeight - tip.offsetHeight - 10);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });
}

// --- global search (Ctrl/Cmd+K) ---------------------------------------------
function initSearch() {
  const input = document.getElementById('globalSearch');
  const results = document.getElementById('tbResults');
  if (!input) return;
  let timer = null;
  const close = () => { results.classList.remove('open'); results.innerHTML = ''; };

  const run = async () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { close(); return; }
    const [visits, accidents, oles, actions] = await Promise.all([store.visits(), store.accidents(), store.oles(), store.actions()]);
    const out = [];
    const push = (icon, label, sub, href) => out.push({ icon, label, sub, href });
    for (const v of visits) {
      const hay = `${v.templateName} ${v.general.observer} ${v.general.technician} ${v.general.city} ${v.general.zone || ''}`.toLowerCase();
      if (hay.includes(q)) push('visits', v.templateName, `${v.general.observer || ''} · ${v.general.city || ''}`, `#/visit/${v.id}`);
    }
    for (const a of accidents) {
      const hay = `${a.refNo} ${a.description} ${a.injuredPerson} ${(a.location || {}).city || ''}`.toLowerCase();
      if (hay.includes(q)) push('accidents', `${a.refNo} — ${(a.description || '').slice(0, 40)}`, (a.location || {}).city || '', `#/accident/${a.id}`);
    }
    for (const o of oles) {
      const hay = `${o.refNo} ${o.title} ${o.task} ${o.facilitator} ${(o.location || {}).city || ''}`.toLowerCase();
      if (hay.includes(q)) push('ole', `${o.refNo} — ${o.title || o.task}`, o.facilitator || '', `#/ole/${o.id}`);
    }
    for (const a of actions) {
      const hay = `${a.title} ${a.owner} ${a.site}`.toLowerCase();
      if (hay.includes(q)) push('actions', a.title || '(action)', `${a.owner || ''} · ${a.status}`, a.accidentId ? `#/accident/${a.accidentId}` : a.oleId ? `#/ole/${a.oleId}` : a.visitId ? `#/visit/${a.visitId}` : '#/actions');
    }
    const top = out.slice(0, 8);
    if (!top.length) { results.innerHTML = '<div class="tb-empty">No matches</div>'; results.classList.add('open'); return; }
    results.innerHTML = top.map((r) => `<a class="tb-hit" href="${r.href}"><span class="tb-hit-ic">${icons[r.icon] || ''}</span><span class="tb-hit-tx"><b>${escHtml(r.label)}</b><small>${escHtml(r.sub)}</small></span></a>`).join('');
    results.classList.add('open');
  };

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 180); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { input.blur(); close(); }
    if (e.key === 'Enter') { const first = results.querySelector('.tb-hit'); if (first) { location.hash = first.getAttribute('href'); input.value = ''; close(); input.blur(); } }
  });
  results.addEventListener('click', () => { input.value = ''; close(); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.tb-search')) close(); });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); input.select(); }
  });
}
function escHtml(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function updateNet() {
  const n = document.getElementById('netState');
  if (n) { n.textContent = navigator.onLine ? '● Online' : '● Offline'; n.className = `net ${navigator.onLine ? 'on' : 'off'}`; }
  renderUserBox();
}

function renderUserBox() {
  const box = document.getElementById('userBox');
  if (!box) return;
  const u = sync.currentUser();
  if (!u) { box.innerHTML = ''; return; }
  const initial = (u.username || '?').slice(0, 1).toUpperCase();
  box.innerHTML = `<div class="user-row"><span class="avatar" aria-hidden="true">${initial}</span><span class="user-name" title="${u.role}">${u.username}${u.role === 'admin' ? ' <span class="user-role">admin</span>' : ''}</span><button class="signout" id="signOut">Sign out</button></div>`;
  box.querySelector('#signOut').addEventListener('click', async () => { await sync.logout(); location.reload(); });
}

async function route() {
  const view = document.getElementById('view');
  if (!view) { shell(); return route(); }
  const hash = location.hash || '#/dashboard';
  setActive(hash);
  window.scrollTo(0, 0);
  const parts = hash.slice(2).split('/'); // drop "#/"
  const [section, a, b] = parts;
  view.innerHTML = `<div class="skel">
    <div class="skel-line w30"></div><div class="skel-line w55 thin"></div>
    <div class="skel-cards">${'<div class="skel-card"></div>'.repeat(4)}</div>
    <div class="skel-block"></div>
  </div>`;
  try {
    switch (section) {
      case '': case 'dashboard': await renderDashboard(view); break;
      case 'visits': await renderVisits(view); break;
      case 'new':
        a ? await renderVisitForm(view, { templateId: a }) : await renderNewVisit(view); break;
      case 'visit': await renderVisitForm(view, { visitId: a }); break;
      case 'accidents':
        if (a === 'new') { b ? await renderAccidentForm(view, { type: b }) : renderNewAccident(view); }
        else await renderAccidents(view);
        break;
      case 'accident': await renderAccidentForm(view, { accidentId: a }); break;
      case 'oles':
        if (a === 'new') await renderOleForm(view, {}); else await renderOles(view);
        break;
      case 'ole': await renderOleForm(view, { oleId: a }); break;
      case 'intel': await renderIntelligence(view); break;
      case 'analysis': await renderAnalysis(view); break;
      case 'accimap': await renderAccimap(view); break;
      case 'actions': await renderActions(view); break;
      case 'settings': await renderSettings(view); break;
      default: location.hash = '#/dashboard';
    }
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="empty">Something went wrong rendering this view.<br><code>${esc(err.message)}</code>
      <br><br><a class="btn primary" href="./reset.html">Refresh the app</a></div>`;
  }
}

function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function showStorageNotice() {
  const foot = document.querySelector('.sidebar-foot');
  if (foot && !document.getElementById('memNotice')) {
    const n = document.createElement('div');
    n.id = 'memNotice';
    n.className = 'mem-notice';
    n.title = 'This browser blocks persistent storage (common on corporate devices). The app works, but changes are not saved after you close it.';
    n.textContent = '⚠ Temporary storage';
    foot.prepend(n);
  }
}

async function boot() {
  // Access gate: when a backend is configured, require a valid login first.
  if (sync.enabled()) {
    const session = await sync.checkSession();
    if (!session) {
      document.getElementById('app').innerHTML = '';
      renderLogin(document.getElementById('app'), () => location.reload());
      registerServiceWorker();
      return;
    }
  }
  shell();
  // In backend mode, pull server data into the local cache before first render.
  if (sync.enabled()) {
    try { await sync.pullAll(db); await sync.flushOutbox(); }
    catch (err) { console.warn('Backend sync unavailable:', err && err.message); }
  }
  try {
    await ensureSeed();
  } catch (err) {
    console.error('Seed/DB error', err);
  }
  if (dbMode === 'memory') showStorageNotice();
  window.addEventListener('online', () => sync.flushOutbox());
  window.addEventListener('hashchange', route);
  window.addEventListener('online', updateNet);
  window.addEventListener('offline', updateNet);
  if (!location.hash) location.hash = '#/dashboard';
  route();
  registerServiceWorker();
  initInstall();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || registerServiceWorker._done) return;
  registerServiceWorker._done = true;
  // Auto-update: when a new service worker takes control, reload once so the
  // user always gets the latest version instead of a stale cached one.
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.update();
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) nw.postMessage?.('skipWaiting');
      });
    });
  }).catch(() => {});
}

boot();
