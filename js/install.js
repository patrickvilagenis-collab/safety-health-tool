// install.js — "Add to Home Screen" helper so the PWA installs like an app.
// Android/Chromium: captures beforeinstallprompt and offers a real install.
// iOS Safari: no programmatic prompt exists, so we show the Share→Add steps.
// Hidden when already installed (standalone) or previously dismissed.

const DISMISS_KEY = 'shi_install_dismissed';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}
function dismissed() {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}
function setDismissed() { try { localStorage.setItem(DISMISS_KEY, '1'); } catch {} }

let deferredPrompt = null;

export function initInstall() {
  if (isStandalone()) return; // already installed — nothing to do

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!dismissed()) showBanner('android');
  });

  window.addEventListener('appinstalled', () => { removeBanner(); deferredPrompt = null; });

  // iOS never fires beforeinstallprompt → show manual guidance once.
  if (isIos() && !dismissed()) setTimeout(() => { if (!isStandalone()) showBanner('ios'); }, 1600);
}

function showBanner(kind) {
  if (document.getElementById('installBanner')) return;
  const el = document.createElement('div');
  el.id = 'installBanner';
  el.className = 'install-banner';
  const shieldIcon = '<img class="ib-ic" src="./assets/icon-192.png" alt=""/>';
  if (kind === 'android') {
    el.innerHTML = `
      ${shieldIcon}
      <div class="ib-tx"><b>Install the app</b><span>Add Safety &amp; Health to your home screen for full-screen, offline access.</span></div>
      <div class="ib-actions">
        <button class="btn small ghost" id="ibClose">Not now</button>
        <button class="btn small primary" id="ibInstall">Install</button>
      </div>`;
  } else {
    const share = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';
    el.innerHTML = `
      ${shieldIcon}
      <div class="ib-tx"><b>Install on your iPhone</b><span>Tap ${share} <b>Share</b>, then <b>Add to Home Screen</b> to install the app.</span></div>
      <div class="ib-actions"><button class="btn small ghost" id="ibClose">Got it</button></div>`;
  }
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));

  const close = el.querySelector('#ibClose');
  if (close) close.addEventListener('click', () => { setDismissed(); removeBanner(); });

  const install = el.querySelector('#ibInstall');
  if (install) install.addEventListener('click', async () => {
    if (!deferredPrompt) { removeBanner(); return; }
    install.disabled = true;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch {}
    deferredPrompt = null;
    setDismissed();
    removeBanner();
  });
}

function removeBanner() {
  const el = document.getElementById('installBanner');
  if (!el) return;
  el.classList.remove('show');
  setTimeout(() => el.remove(), 250);
}
