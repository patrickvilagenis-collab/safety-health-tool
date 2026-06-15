// charts.js — dependency-free SVG charts (works offline).
// Each function returns an SVG string.

// Refined, low-saturation palette: brand red as the single accent, the rest a
// muted graphite/slate ramp so dashboards read mature rather than colourful.
const PALETTE = ['#E2001A', '#39414f', '#5b7795', '#b07d44', '#4f7d6b', '#6a6488', '#9a4f49', '#4c828a', '#8a7a66', '#838893'];

function svg(w, h, inner) {
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" preserveAspectRatio="xMidYMid meet" role="img">${inner}</svg>`;
}

let GID = 0; // unique gradient ids per render

export function barChart(data, { w = 520, h = 220, color = '#E2001A', valueFmt = (v) => v } = {}) {
  if (!data.length) return emptyChart(w, h);
  const pad = { l: 36, r: 12, t: 14, b: 28 };
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const max = Math.max(...data.map((d) => d[1]), 1);
  const bw = cw / data.length;
  const gid = `bg${GID++}`;
  let bars = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity="0.55"/></linearGradient></defs>`;
  data.forEach((d, i) => {
    const bh = Math.max(0, (d[1] / max) * ch);
    const x = pad.l + i * bw + bw * 0.16;
    const y = pad.t + ch - bh;
    const ww = bw * 0.68;
    bars += `<rect class="bar anim" x="${x}" y="${y}" width="${ww}" height="${bh}" rx="5" fill="url(#${gid})" data-tip="${escTxt(d[0])}: ${d[1]}" style="animation-delay:${i * 35}ms"/>`;
    bars += `<text x="${x + ww / 2}" y="${pad.t + ch + 18}" text-anchor="middle" class="ax">${shorten(d[0])}</text>`;
    if (d[1] > 0) bars += `<text x="${x + ww / 2}" y="${y - 5}" text-anchor="middle" class="val">${valueFmt(d[1])}</text>`;
  });
  const grid = gridLines(pad, cw, ch, max);
  return svg(w, h, grid + bars);
}

// Smooth (bezier) path through points.
function smoothPath(pts) {
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    const mx = ((p0[0] + p1[0]) / 2).toFixed(1);
    d += ` C${mx},${p0[1].toFixed(1)} ${mx},${p1[1].toFixed(1)} ${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
  }
  return d;
}

export function lineChart(data, { w = 520, h = 220, color = '#E2001A' } = {}) {
  if (data.length < 1) return emptyChart(w, h);
  const pad = { l: 36, r: 26, t: 14, b: 28 }; // right pad keeps the last axis label inside the viewBox
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const max = Math.max(...data.map((d) => d[1]), 1);
  const step = data.length > 1 ? cw / (data.length - 1) : 0;
  const pts = data.map((d, i) => [pad.l + i * step, pad.t + ch - (d[1] / max) * ch]);
  const path = smoothPath(pts);
  const gid = `lg${GID++}`;
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${pad.t + ch} L${pts[0][0].toFixed(1)},${pad.t + ch} Z`;
  let dots = '';
  pts.forEach((p, i) => {
    const last = i === pts.length - 1;
    dots += `<circle class="dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${last ? 4.5 : 3.5}" fill="${last ? color : '#fff'}" stroke="${color}" stroke-width="2" data-tip="${escTxt(data[i][0])}: ${data[i][1]}"/>`;
    dots += `<text x="${p[0].toFixed(1)}" y="${pad.t + ch + 18}" text-anchor="middle" class="ax">${shorten(data[i][0])}</text>`;
  });
  const grid = gridLines(pad, cw, ch, max);
  return svg(w, h,
    `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.22"/><stop offset="1" stop-color="${color}" stop-opacity="0.01"/></linearGradient></defs>` +
    grid +
    `<path class="area-fade" d="${area}" fill="url(#${gid})"/>` +
    `<path class="line-draw" pathLength="1" d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` +
    dots);
}

// Horizontal bars — full labels, animated, tooltip-enabled. Best for
// categorical breakdowns where vertical bars would truncate names.
// Rows may be [label, value] or [label, value, delta] (delta vs last month).
// `drills[i]` makes a row clickable ("key:value" consumed by the view).
// `deltaGoodUp` flips delta colouring (e.g. rising compliance is good).
export function hbarChart(data, { color = '#E2001A', valueFmt = (v) => v, max = null, drills = null, deltaGoodUp = false } = {}) {
  if (!data.length) return '<p class="hint">No data yet</p>';
  const m = max || Math.max(...data.map((d) => d[1]), 1);
  return `<div class="hbar">${data.map((d, i) => {
    const [label, v] = d;
    const delta = d.length > 2 ? d[2] : null;
    const drill = drills && drills[i] ? drills[i] : null;
    const dch = delta != null && delta !== 0
      ? `<i class="hb-d ${(delta > 0) === deltaGoodUp ? 'pos' : 'neg'}">${delta > 0 ? '▲' : '▼'}${Math.abs(delta)}</i>` : '';
    const tip = `${label}: ${valueFmt(v)}` +
      (delta != null ? ` · Δ vs last month: ${delta > 0 ? '+' : ''}${delta}` : '') +
      (drill ? ' · click to filter' : '');
    return `
    <div class="hbar-row${drill ? ' drillable' : ''}"${drill ? ` data-drill="${escTxt(drill)}"` : ''} data-tip="${escTxt(tip)}">
      <span class="hbar-label">${escTxt(label)}</span>
      <span class="hbar-track"><i style="width:${((v / m) * 100).toFixed(1)}%; background:linear-gradient(90deg, ${color}, ${color}cc); animation-delay:${i * 45}ms"></i></span>
      <span class="hbar-val">${valueFmt(v)}${dch}</span>
    </div>`;
  }).join('')}</div>`;
}

// Tiny inline trend for KPI cards.
export function sparkline(values, { w = 120, h = 34, color = '#E2001A' } = {}) {
  if (!values || values.length < 2) return '';
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const span = (max - min) || 1;
  const step = (w - 8) / (values.length - 1);
  const pts = values.map((v, i) => [4 + i * step, 4 + (h - 8) * (1 - (v - min) / span)]);
  const path = smoothPath(pts);
  const gid = `sp${GID++}`;
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${h - 2} L${pts[0][0].toFixed(1)},${h - 2} Z`;
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${w} ${h}" class="spark" preserveAspectRatio="none">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.25"/><stop offset="1" stop-color="${color}" stop-opacity="0.02"/></linearGradient></defs>
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3" fill="${color}"/>
  </svg>`;
}

export function donutChart(entries, { w = 220, h = 220, thickness = 34, colors = PALETTE, drills = null } = {}) {
  const total = entries.reduce((a, e) => a + e[1], 0);
  if (!total) return emptyChart(w, h);
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 8;
  let a0 = -Math.PI / 2, arcs = '';
  entries.forEach((e, i) => {
    const frac = e[1] / total;
    const a1 = a0 + frac * Math.PI * 2;
    const large = frac > 0.5 ? 1 : 0;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const drill = drills && drills[i] ? ` data-drill="${escTxt(drills[i])}" class="donut-seg drillable"` : ' class="donut-seg"';
    arcs += `<path${drill} d="M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="${thickness}" data-tip="${escTxt(e[0])}: ${e[1]} (${Math.round(frac * 100)}%)${drills && drills[i] ? ' · click to filter' : ''}"/>`;
    a0 = a1;
  });
  const inner = `<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="donut-num">${total}</text><text x="${cx}" y="${cy + 16}" text-anchor="middle" class="donut-lbl">total</text>`;
  return svg(w, h, arcs + inner);
}

export function legend(entries, { colors = PALETTE } = {}) {
  return `<div class="legend">${entries.map((e, i) =>
    `<span class="leg"><i style="background:${colors[i % colors.length]}"></i>${escTxt(e[0])} <b>${e[1]}</b></span>`).join('')}</div>`;
}

export function gauge(value, { w = 200, h = 130, label = '' } = {}) {
  if (value == null) return emptyChart(w, h, 'No data');
  const cx = w / 2, cy = h - 16, r = 78;
  const a = Math.PI * (1 - value / 100);
  const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
  const col = value >= 90 ? '#10b981' : value >= 75 ? '#f59e0b' : '#ef4444';
  return svg(w, h,
    `<path d="M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}" fill="none" stroke="var(--gauge-track, #e5e7eb)" stroke-width="14" stroke-linecap="round"/>` +
    `<path d="M${cx - r},${cy} A${r},${r} 0 0 1 ${x.toFixed(1)},${y.toFixed(1)}" fill="none" stroke="${col}" stroke-width="14" stroke-linecap="round"/>` +
    `<text x="${cx}" y="${cy - 6}" text-anchor="middle" class="gauge-num">${value}%</text>` +
    `<text x="${cx}" y="${cy + 12}" text-anchor="middle" class="gauge-lbl">${escTxt(label)}</text>`);
}

export function stackedBar(parts, { w = 520, h = 22, colors = PALETTE } = {}) {
  const total = parts.reduce((a, p) => a + p[1], 0);
  if (!total) return `<div class="sbar empty"></div>`;
  let x = 0, segs = '';
  parts.forEach((p, i) => {
    const ww = (p[1] / total) * w;
    segs += `<rect x="${x}" y="0" width="${ww}" height="${h}" fill="${colors[i % colors.length]}"><title>${p[0]}: ${p[1]}</title></rect>`;
    x += ww;
  });
  return svg(w, h, segs);
}

// Heatmap: rows × cols grid coloured by value (0..max). cells[r][c] = {v, label}.
export function heatmap(rowLabels, colLabels, cells, { max = 0, colW = 96, rowH = 52, padL = 116, padT = 54 } = {}) {
  const cols = colLabels.length, rows = rowLabels.length;
  const w = padL + cols * colW + 10, h = padT + rows * rowH + 12;
  let m = max;
  if (!m) cells.forEach((row) => row.forEach((c) => { if (c && c.v > m) m = c.v; }));
  m = m || 1;
  const color = (v) => {
    if (!v) return 'var(--hm-zero, #f4f5f7)';
    const t = 0.12 + 0.88 * Math.min(1, v / m); // floor so low values are still visible
    const r = Math.round(252 + (226 - 252) * t), g = Math.round(232 + (0 - 232) * t), b = Math.round(232 + (26 - 232) * t);
    return `rgb(${r},${g},${b})`;
  };
  // wrap a short column label onto up to two centred lines
  const colHead = (label, cx) => {
    const s = String(label);
    if (s.length <= 9 || !s.includes(' ')) return `<tspan x="${cx}" dy="0">${esc2(s)}</tspan>`;
    const words = s.split(' '), mid = Math.ceil(words.length / 2);
    return `<tspan x="${cx}" dy="-5">${esc2(words.slice(0, mid).join(' '))}</tspan><tspan x="${cx}" dy="12">${esc2(words.slice(mid).join(' '))}</tspan>`;
  };
  let out = '';
  colLabels.forEach((cl, c) => {
    const cx = padL + c * colW + colW / 2;
    out += `<text x="${cx}" y="${padT - 22}" text-anchor="middle" class="hm-col">${colHead(cl, cx)}</text>`;
  });
  rowLabels.forEach((rl, r) => {
    const cy = padT + r * rowH + rowH / 2;
    out += `<text x="${padL - 12}" y="${cy + 4}" text-anchor="end" class="hm-row">${esc2(rl)}</text>`;
    colLabels.forEach((cl, c) => {
      const cellData = (cells[r] && cells[r][c]) || { v: 0 };
      const x = padL + c * colW, y = padT + r * rowH;
      const dark = cellData.v / m > 0.5;
      out += `<rect class="hm-cell" x="${x + 4}" y="${y + 4}" width="${colW - 8}" height="${rowH - 8}" rx="8" fill="${color(cellData.v)}" data-tip="${esc2(rl)} · ${esc2(cl)}: ${cellData.label != null ? cellData.label : cellData.v}"/>`;
      const val = cellData.label != null ? cellData.label : cellData.v;
      out += `<text x="${x + colW / 2}" y="${y + rowH / 2 + 5}" text-anchor="middle" class="hm-val" fill="${cellData.v ? (dark ? '#fff' : '#7a3338') : 'var(--hm-zero-txt, #c7cad0)'}">${val}</text>`;
    });
  });
  return svg(w, h, out);
}
function esc2(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function gridLines(pad, cw, ch, max) {
  let g = '';
  const lines = 4;
  for (let i = 0; i <= lines; i++) {
    const y = pad.t + (ch / lines) * i;
    const val = Math.round(max - (max / lines) * i);
    g += `<line x1="${pad.l}" y1="${y}" x2="${pad.l + cw}" y2="${y}" class="grid"/>`;
    g += `<text x="${pad.l - 6}" y="${y + 4}" text-anchor="end" class="ax">${val}</text>`;
  }
  return g;
}

function emptyChart(w, h, msg = 'No data yet') {
  return svg(w, h, `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" class="empty-txt">${msg}</text>`);
}

function shorten(s, n = 10) {
  s = String(s);
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function escTxt(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export { PALETTE };
