// auth.js — login gate for the app.

import { el } from './utils.js';
import * as sync from './sync.js';
import { icons } from './icons.js';

// Renders a full-screen login form into `mount`. Calls onSuccess() after login.
export function renderLogin(mount, onSuccess) {
  const box = el('div', { class: 'login-screen' });
  box.innerHTML = `
    <section class="login-hero" aria-hidden="true">
      <img class="login-wheel" src="./assets/hazard-wheel.png" alt=""/>
      <div class="login-hero-inner">
        <img class="login-hero-logo" src="./assets/schindler.svg" alt=""/>
        <h2>Safety &amp; Health<br>Information Tool</h2>
        <p class="login-hero-sub">One platform for field visits, accident investigation and operational learning — in the office or on site, online or offline.</p>
        <ul class="login-points">
          <li><span>${icons.visits}</span> Digital safety checklists with photos &amp; actions</li>
          <li><span>${icons.zap}</span> Energy-based SIF classification &amp; root-cause analysis</li>
          <li><span>${icons.intel}</span> Predictive safety intelligence &amp; live KPIs</li>
          <li><span>${icons.wifi}</span> Works fully offline — syncs when you're back</li>
        </ul>
      </div>
    </section>
    <section class="login-panel">
      <form class="login-card" autocomplete="on">
        <img class="login-logo" src="./assets/schindler.svg" alt="Schindler"/>
        <h1>Welcome back</h1>
        <p class="login-sub">Sign in to your Safety &amp; Health workspace.</p>
        <label class="fld"><span>Username</span><input id="lgUser" autocomplete="username" autofocus required></label>
        <label class="fld"><span>Password</span><input id="lgPass" type="password" autocomplete="current-password" required></label>
        <button class="btn primary login-btn" id="lgBtn" type="submit">Sign in</button>
        <p class="login-msg" id="lgMsg" role="status"></p>
        <p class="login-foot">Authorised personnel only · Schindler Group</p>
      </form>
    </section>`;
  mount.innerHTML = '';
  mount.append(box);

  const msg = box.querySelector('#lgMsg');
  const btn = box.querySelector('#lgBtn');
  box.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = box.querySelector('#lgUser').value.trim();
    const p = box.querySelector('#lgPass').value;
    if (!u || !p) return;
    btn.disabled = true; msg.className = 'login-msg'; msg.textContent = 'Signing in…';
    try {
      await sync.login(u, p);
      msg.textContent = '';
      onSuccess();
    } catch (err) {
      btn.disabled = false;
      msg.className = 'login-msg err';
      msg.textContent = err.message === 'invalid'
        ? 'Wrong username or password.'
        : 'Could not reach the server (it may be waking up — wait a few seconds and try again).';
    }
  });
}
