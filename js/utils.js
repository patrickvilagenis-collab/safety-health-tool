// utils.js — small helpers shared across views.

export const uid = (p = 'id') =>
  `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const nowISO = () => new Date().toISOString();

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function daysBetween(a, b = new Date()) {
  return Math.floor((new Date(b) - new Date(a)) / 86400000);
}

export function monthKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

// Minimal HTML escaping for user-entered text rendered via innerHTML.
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Tagged template that escapes interpolations; pass {raw: html} to inject html.
export function html(strings, ...values) {
  return strings.reduce((out, str, i) => {
    if (i === 0) return str;
    const v = values[i - 1];
    if (v && typeof v === 'object' && 'raw' in v) return out + v.raw + str;
    if (Array.isArray(v)) return out + v.join('') + str;
    return out + esc(v) + str;
  }, '');
}
export const raw = (s) => ({ raw: s });

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

// Resize/compress an image file to a data URL (keeps photo payloads small).
export function fileToCompressedDataURL(file, maxDim = 1280, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
      else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function download(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escCell = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escCell(r[h])).join(','))].join('\n');
}

let _toastTimer = null;
export function toast(msg, tone = 'info') {
  let t = document.getElementById('toast');
  if (!t) {
    t = el('div', { id: 'toast', class: 'toast' });
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `toast show ${tone}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = 'toast'; }, 2600);
}

export function confirmDialog(message) {
  return Promise.resolve(window.confirm(message));
}
