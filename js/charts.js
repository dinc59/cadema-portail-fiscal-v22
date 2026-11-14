/* Graphiques SVG faits main, dessinés à la largeur réelle de leur conteneur
   (1 unité SVG = 1 px : le texte garde sa taille sur téléphone comme sur
   grand écran). Marques fines, extrémités arrondies posées sur la ligne de
   base, grille discrète, info-bulle au survol de chaque marque.
   Mouvement : les barres poussent depuis la ligne de base à l'arrivée sur
   la page, une seule fois — jamais lors d'un rafraîchissement. */
import { esc, attr, fmt } from './ui.js';

const niceMax = v => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};
const axisLabel = v => fmt.short(v).replace(',0', '');

/* Dessine `draw(largeur)` dans `slot` et redessine quand la largeur change. */
export function mountChart(slot, draw) {
  if (!slot) return;
  let w = 0;
  const paint = first => {
    const nw = Math.max(260, Math.round(slot.clientWidth));
    if (!first && Math.abs(nw - w) < 8) return;
    w = nw;
    slot.classList.toggle('chart-still', !first || document.body.classList.contains('no-enter'));
    slot.innerHTML = draw(w);
  };
  paint(true);
  if ('ResizeObserver' in window) new ResizeObserver(() => paint(false)).observe(slot);
}

function roundTop(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
function roundBottom(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`;
}

/* Barres empilées par exercice. `data` = [{year, parts:[{code,short,slot,amount}], covered, total}] */
export function stackedBars(data, {width = 720, height = 280, active} = {}) {
  const W = width, H = height, padL = 54, padR = 6, padT = 14, padB = 46;
  const max = niceMax(Math.max(...data.map(d => d.total), 1));
  const iw = W - padL - padR, ih = H - padT - padB;
  const band = iw / Math.max(data.length, 1);
  const bw = Math.max(14, Math.min(58, band * 0.56));
  const y = v => padT + ih - (v / max) * ih;
  let out = `<svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Produits fiscaux par exercice">`;
  for (const t of [0, 0.25, 0.5, 0.75, 1].map(k => k * max)) {
    out += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${esc(axisLabel(t))}</text>`;
  }
  data.forEach((d, i) => {
    const cx = padL + band * i + band / 2, x = cx - bw / 2;
    const segs = d.parts.filter(p => p.amount > 0);
    const incomplete = d.covered < d.parts.length;
    let acc = 0, marks = '';
    segs.forEach((p, j) => {
      const top = j === segs.length - 1;
      const y1 = y(acc + p.amount) + (top ? 0 : 2);
      const h = Math.max(0, y(acc) - y1);
      marks += `<path class="seg${incomplete ? ' seg-partial' : ''}" style="fill:var(--s${p.slot})" d="${roundTop(x, y1, bw, h, top ? 4 : 0)}"/>`;
      acc += p.amount;
    });
    const missing = d.parts.filter(p => !(p.amount > 0)).map(p => p.short || p.code);
    const tip = `<b>${d.year}</b> · ${esc(fmt.eur(d.total))}<br>` + segs.map(p => `<span class="tip-sw" style="background:var(--s${p.slot})"></span>${esc(p.short || p.code)} <span class="tip-v">${esc(fmt.short(p.amount))}</span>`).join('<br>') +
      (missing.length ? `<br><span class="tip-miss">Non renseigné : ${esc(missing.join(', '))}</span>` : '');
    out += `<g class="bar-g" style="--d:${i * 40}ms">
      <rect class="hit" x="${cx - band / 2}" y="${padT}" width="${band}" height="${ih + padB}" data-tip="${attr(tip)}"${active === d.year ? ' data-active' : ''} data-year="${d.year}"/>
      <g class="bar-m">${marks}</g>
      <text class="axis axis-x${active === d.year ? ' is-active' : ''}" x="${cx}" y="${H - padB + 18}" text-anchor="middle">${d.year}</text>
      <text class="axis axis-cov${incomplete ? ' is-warn' : ''}" x="${cx}" y="${H - padB + 34}" text-anchor="middle">${d.covered}/${d.parts.length}</text>
    </g>`;
  });
  return out + `<line class="base" x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}"/></svg>`;
}

/* Produit d'une recette par exercice. Le statut est encodé par le remplissage :
   plein = définitif, atténué = renseigné, tireté = prévision, vide = non renseigné. */
export const statusKind = s => /d[ée]finitif|notifi/i.test(s || '') ? 'final' : /pr[ée]vision/i.test(s || '') ? 'forecast' : 'filled';
export function statusBars(points, {slot = 1, width = 720, height = 280, active} = {}) {
  const W = width, H = height, padL = 54, padR = 6, padT = 26, padB = 30;
  const max = niceMax(Math.max(...points.map(p => p.amount || 0), 1));
  const iw = W - padL - padR, ih = H - padT - padB;
  const band = iw / Math.max(points.length, 1);
  const bw = Math.max(16, Math.min(64, band * 0.5));
  const y = v => padT + ih - (v / max) * ih;
  let out = `<svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Produit par exercice">`;
  for (const t of [0, 0.25, 0.5, 0.75, 1].map(k => k * max)) {
    out += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${esc(axisLabel(t))}</text>`;
  }
  points.forEach((p, i) => {
    const cx = padL + band * i + band / 2, x = cx - bw / 2;
    const has = p.amount > 0;
    const kind = statusKind(p.status);
    const tip = `<b>${p.year}</b> · ${has ? esc(fmt.eur(p.amount)) : 'non renseigné'}${p.status ? `<br>${esc(p.status)}` : ''}${p.source ? `<br><span class="tip-miss">${esc(p.source)}</span>` : ''}`;
    out += `<g class="bar-g" style="--d:${i * 45}ms">
      <rect class="hit" x="${cx - band / 2}" y="${padT - 20}" width="${band}" height="${ih + padB + 20}" data-tip="${attr(tip)}"${active === p.year ? ' data-active' : ''} data-pick="${p.year}"/>
      ${has ? `<g class="bar-m"><path class="seg seg-${kind}" style="--c:var(--s${slot})" d="${roundTop(x, y(p.amount), bw, y(0) - y(p.amount), 4)}"/></g>
        ${band >= 58 || p.year === active ? `<text class="val" x="${cx}" y="${y(p.amount) - 7}" text-anchor="middle">${esc(fmt.short(p.amount))}</text>` : ''}`
      : `<rect class="gap" x="${x}" y="${y(0) - 26}" width="${bw}" height="26" rx="4"/>`}
      <text class="axis axis-x${active === p.year ? ' is-active' : ''}" x="${cx}" y="${H - 9}" text-anchor="middle">${p.year}</text>
    </g>`;
  });
  return out + `<line class="base" x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}"/></svg>`;
}

/* Évolution d'un exercice à l'autre, en %. Barres divergentes autour de zéro ;
   les années restent sur leur propre ligne, sous le graphique. */
export function deltaBars(points, {width = 520, height = 240, active} = {}) {
  const W = width, H = height, padL = 54, padR = 6, padT = 24, padB = 30, lab = 18;
  const vals = points.map(p => p.delta).filter(v => v !== null && v !== undefined);
  const m = Math.max(0.05, niceMax(Math.max(...vals.map(Math.abs), 0.01) * 100) / 100);
  const iw = W - padL - padR, ih = H - padT - padB;
  const zero = padT + ih / 2;
  const half = ih / 2 - lab;
  const band = iw / Math.max(points.length, 1);
  const bw = Math.max(14, Math.min(54, band * 0.5));
  const pct = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toLocaleString('fr-FR', {maximumFractionDigits: 0})} %`;
  let out = `<svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution d’un exercice à l’autre">`;
  for (const [v, yy] of [[m, zero - half], [-m, zero + half]]) {
    out += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}"/><text class="axis" x="${padL - 8}" y="${yy + 4}" text-anchor="end">${esc(pct(v))}</text>`;
  }
  out += `<text class="axis" x="${padL - 8}" y="${zero + 4}" text-anchor="end">0</text>`;
  points.forEach((p, i) => {
    const cx = padL + band * i + band / 2, x = cx - bw / 2;
    const known = p.delta !== null && p.delta !== undefined;
    const tip = `<b>${p.year}</b> · ${known ? `${esc(fmt.delta(p.delta))} par rapport à ${p.year - 1}` : `pas de comparaison : ${p.year - 1} ou ${p.year} non renseigné`}`;
    let mark = '';
    if (known) {
      const h = Math.max(2, Math.abs(p.delta) / m * half);
      const up = p.delta >= 0;
      mark = `<g class="bar-m ${up ? 'is-up' : 'is-down'}"><path class="seg ${up ? 'd-up' : 'd-down'}" d="${up ? roundTop(x, zero - h, bw, h, 4) : roundBottom(x, zero, bw, h, 4)}"/></g>
        ${band >= 58 || p.year === active ? `<text class="val" x="${cx}" y="${up ? zero - h - 6 : zero + h + 14}" text-anchor="middle">${esc(fmt.delta(p.delta))}</text>` : ''}`;
    } else {
      mark = `<text class="axis" x="${cx}" y="${zero - 6}" text-anchor="middle">—</text>`;
    }
    out += `<g class="bar-g" style="--d:${i * 45}ms">
      <rect class="hit" x="${cx - band / 2}" y="${padT - 10}" width="${band}" height="${ih + padB + 10}" data-tip="${attr(tip)}"${active === p.year ? ' data-active' : ''} data-pick="${p.year}"/>
      ${mark}
      <text class="axis axis-x${active === p.year ? ' is-active' : ''}" x="${cx}" y="${H - 9}" text-anchor="middle">${p.year}</text>
    </g>`;
  });
  return out + `<line class="base" x1="${padL}" x2="${W - padR}" y1="${zero}" y2="${zero}"/></svg>`;
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
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-val ring-${tone}" stroke-width="${stroke}" style="--c:${c.toFixed(2)}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
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
