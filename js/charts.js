/* Graphiques SVG faits main. Marques fines, extrémités arrondies posées sur
   la ligne de base, 2 px d'écart entre segments, grille discrète, info-bulle
   au survol de chaque marque. Les couleurs viennent des jetons --s1…--s6. */
import { esc, attr, fmt } from './ui.js';

const niceMax = v => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

/* Barres empilées par exercice. `data` = [{year, parts:[{code,label,slot,amount}], covered, total}] */
export function stackedBars(data, {height = 260, active} = {}) {
  const W = 720, H = height, padL = 52, padR = 8, padT = 12, padB = 46;
  const max = niceMax(Math.max(...data.map(d => d.total), 1));
  const iw = W - padL - padR, ih = H - padT - padB;
  const band = iw / data.length;
  const bw = Math.min(56, band * 0.56);
  const y = v => padT + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * max);
  let out = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Produits fiscaux par exercice">`;
  for (const t of ticks) {
    out += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/>`;
    out += `<text class="axis" x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${esc(fmt.short(t).replace(',0', ''))}</text>`;
  }
  data.forEach((d, i) => {
    const cx = padL + band * i + band / 2;
    const x = cx - bw / 2;
    let acc = 0;
    const segs = d.parts.filter(p => p.amount > 0);
    const incomplete = d.covered < d.parts.length;
    segs.forEach((p, j) => {
      const y0 = y(acc), y1 = y(acc + p.amount);
      const h = Math.max(0, y0 - y1 - (j < segs.length - 1 ? 2 : 0));
      const top = j === segs.length - 1;
      const r = top ? Math.min(4, h) : 0;
      out += `<path class="seg${incomplete ? ' seg-partial' : ''}" style="fill:var(--s${p.slot})" d="${roundTop(x, y1 + (j < segs.length - 1 ? 2 : 0), bw, h, r)}"/>`;
      acc += p.amount;
    });
    const missing = d.parts.filter(p => !(p.amount > 0)).map(p => p.short || p.code);
    const tip = `<b>${d.year}</b> · ${esc(fmt.eur(d.total))}<br>` + d.parts.filter(p => p.amount > 0).map(p => `<span class="tip-sw" style="background:var(--s${p.slot})"></span>${esc(p.short || p.code)} <span class="tip-v">${esc(fmt.short(p.amount))}</span>`).join('<br>') +
      (missing.length ? `<br><span class="tip-miss">Non renseigné : ${esc(missing.join(', '))}</span>` : '');
    out += `<rect class="hit" x="${cx - band / 2}" y="${padT}" width="${band}" height="${ih + padB}" data-tip="${attr(tip)}" ${active === d.year ? 'data-active' : ''} data-year="${d.year}"/>`;
    out += `<text class="axis axis-x${active === d.year ? ' is-active' : ''}" x="${cx}" y="${H - padB + 18}" text-anchor="middle">${d.year}</text>`;
    out += `<text class="axis axis-cov${incomplete ? ' is-warn' : ''}" x="${cx}" y="${H - padB + 34}" text-anchor="middle">${d.covered}/${d.parts.length}</text>`;
  });
  out += `<line class="base" x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}"/>`;
  return out + '</svg>';
}

function roundTop(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/* Barres simples d'une série (historique d'une recette). Années manquantes = emplacement vide annoté. */
export function seriesBars(points, {slot = 1, height = 220, active} = {}) {
  const W = 640, H = height, padL = 52, padR = 8, padT = 22, padB = 30;
  const vals = points.map(p => p.amount || 0);
  const max = niceMax(Math.max(...vals, 1));
  const iw = W - padL - padR, ih = H - padT - padB;
  const band = iw / Math.max(points.length, 1);
  const bw = Math.min(44, band * 0.5);
  const y = v => padT + ih - (v / max) * ih;
  let out = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Historique">`;
  for (const t of [0, 0.5, 1].map(k => k * max)) {
    out += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${esc(fmt.short(t).replace(',0', ''))}</text>`;
  }
  points.forEach((p, i) => {
    const cx = padL + band * i + band / 2;
    if (p.amount > 0) {
      const h = y(0) - y(p.amount);
      out += `<path class="seg${p.status === 'Prévision' ? ' seg-forecast' : ''}" style="fill:var(--s${slot})" d="${roundTop(cx - bw / 2, y(p.amount), bw, h, 4)}"/>`;
      if (p.label) out += `<text class="val" x="${cx}" y="${y(p.amount) - 6}" text-anchor="middle">${esc(fmt.short(p.amount))}</text>`;
    } else {
      out += `<rect class="gap" x="${cx - bw / 2}" y="${y(0) - 22}" width="${bw}" height="22" rx="4"/>`;
    }
    const tip = `<b>${p.year}</b> · ${p.amount > 0 ? esc(fmt.eur(p.amount)) : 'non renseigné'}${p.status ? `<br>${esc(p.status)}` : ''}${p.source ? `<br><span class="tip-miss">${esc(p.source)}</span>` : ''}`;
    out += `<rect class="hit" x="${cx - band / 2}" y="${padT}" width="${band}" height="${ih + padB}" data-tip="${attr(tip)}"/>`;
    out += `<text class="axis axis-x${active === p.year ? ' is-active' : ''}" x="${cx}" y="${H - 10}" text-anchor="middle">${p.year}</text>`;
  });
  out += `<line class="base" x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}"/>`;
  return out + '</svg>';
}

/* Mini-courbe pour les menus et cartes. */
export function spark(values, {slot = 1, w = 72, h = 22} = {}) {
  const pts = values.map((v, i) => [i, v]).filter(([, v]) => v !== null && v !== undefined);
  if (pts.length < 2) return `<svg width="${w}" height="${h}" aria-hidden="true"></svg>`;
  const max = Math.max(...pts.map(p => p[1])), min = Math.min(...pts.map(p => p[1]));
  const sx = i => 2 + (i / (values.length - 1)) * (w - 4);
  const sy = v => h - 3 - ((v - min) / ((max - min) || 1)) * (h - 6);
  const d = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join('');
  const [li, lv] = pts[pts.length - 1];
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" style="stroke:var(--s${slot})"/><circle cx="${sx(li)}" cy="${sy(lv)}" r="2.5" style="fill:var(--s${slot})"/></svg>`;
}

/* Anneau de score (0–100). */
export function ring(value, {size = 112, stroke = 9, tone = 'accent', label = ''} = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-val ring-${tone}" stroke-width="${stroke}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>
    <div class="ring-label"><b>${Math.round(value)}</b>${label ? `<span>${esc(label)}</span>` : ''}</div>
  </div>`;
}

/* Info-bulle unique, pilotée par [data-tip]. */
export function installTooltips() {
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  let current = null;
  const place = e => {
    const pad = 14, r = tip.getBoundingClientRect();
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };
  document.addEventListener('pointerover', e => {
    const el = e.target.closest?.('[data-tip]');
    if (el === current) return;
    current?.removeAttribute('data-hover');
    current = el;
    if (!el) { tip.removeAttribute('data-show'); return; }
    el.setAttribute('data-hover', '');
    tip.innerHTML = el.getAttribute('data-tip');
    tip.setAttribute('data-show', '');
    place(e);
  });
  document.addEventListener('pointermove', e => { if (current) place(e); }, {passive: true});
  document.addEventListener('scroll', () => { current?.removeAttribute('data-hover'); current = null; tip.removeAttribute('data-show'); }, {passive: true, capture: true});
}
