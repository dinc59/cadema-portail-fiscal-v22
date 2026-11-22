/* Graphiques SVG faits main, dessinés à la largeur réelle de leur conteneur
   (1 unité SVG = 1 px : le texte garde sa taille sur téléphone comme sur
   grand écran). Marques fines, extrémités arrondies posées sur la ligne de
   base, grille discrète, info-bulle au survol de chaque marque.
   Mouvement : les barres poussent depuis la ligne de base à l'arrivée sur
   la page, une seule fois — jamais lors d'un rafraîchissement. */
import { esc, attr, fmt, motionOK } from './ui.js';

/* Libellé lisible d'une info-bulle (pour les lecteurs d'écran). */
const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const plain = html => decode(html.replace(/<br>/g, ' · ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
/* Zone active d'une marque : info-bulle, focus au clavier (flèches), Entrée = clic. */
const hitA = (tip, isActive) => `data-tip="${attr(tip)}" tabindex="${isActive ? 0 : -1}" role="button" aria-label="${attr(plain(tip))}"`;
/* Bande qui signale l'exercice affiché ; elle glisse quand on change d'exercice. */
const actBand = (key, x, y, w, h) => `<rect class="act-band" x="0" y="${y}" width="${w}" height="${h}" rx="8" style="transform:translateX(${x.toFixed(1)}px)"${key ? ` data-mk="${attr(key)}-band" data-mp="transform"` : ''}/>`;
const f1 = v => Math.round(v * 10) / 10;

const niceMax = v => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};
const axisLabel = v => fmt.short(v).replace(',0', '');

/* Dessine `draw(largeur)` dans `slot` et redessine quand la largeur change. */
export function mountChart(slot, draw, {replay = false} = {}) {
  if (!slot) return;
  let w = 0;
  const paint = first => {
    const nw = Math.max(260, Math.round(slot.clientWidth));
    if (!first && Math.abs(nw - w) < 8) return;
    w = nw;
    const b = document.body.classList;
    slot.classList.toggle('chart-still', !first || (!replay && (b.contains('no-enter') || b.contains('seen-page'))));
    slot.innerHTML = draw(w);
    const hits = slot.querySelectorAll('.hit[tabindex]');
    if (hits.length && !slot.querySelector('.hit[tabindex="0"]')) hits[0].tabIndex = 0;
    /* Changement d'exercice : la bande et les parts glissent depuis leur état
       précédent. Un simple redimensionnement ne bouge pas. */
    morph(slot, first);
  };
  paint(true);
  if ('ResizeObserver' in window) new ResizeObserver(() => paint(false)).observe(slot);
}

/* ── Transitions d'un état à l'autre ─────────────────────────────────
   Un élément marqué data-mk (clé stable) et data-mp (propriétés CSS) garde
   en mémoire ses dernières valeurs ; au rendu suivant il part de celles-ci.
   L'état final est toujours celui du HTML : si l'animation ne tourne pas
   (onglet masqué, mouvement réduit), rien n'est faux. */
const lastState = new Map();
const camel = p => p.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
export function morph(root, animate = true) {
  const ok = animate && motionOK() && !document.hidden;
  root.querySelectorAll('[data-mk]').forEach(el => {
    const props = el.dataset.mp.split(',');
    const now = props.map(p => el.style.getPropertyValue(p) || el.getAttribute(p) || '');
    const before = lastState.get(el.dataset.mk);
    lastState.set(el.dataset.mk, now);
    if (!ok || !before || before.join('|') === now.join('|')) return;
    const frame = vals => Object.fromEntries(props.map((p, i) => [camel(p), vals[i]]));
    el.animate([frame(before), frame(now)], {duration: 520, easing: 'cubic-bezier(.77, 0, .175, 1)'});
  });
}

/* ── Compteurs ───────────────────────────────────────────────────────
   <b data-count="24678300" data-fmt="short" data-count-key="home-total">.
   Première visite de la page : le chiffre monte depuis zéro ; changement
   d'exercice : il passe de l'ancienne à la nouvelle valeur. Le texte final
   est déjà dans le HTML et il est rétabli quoi qu'il arrive. */
const shown = new Map();
const FMT = {
  short: v => fmt.short(v),
  eur: v => fmt.eur(Math.round(v)),
  int: v => fmt.int(Math.round(v)),
  pct: v => fmt.pct(v),
};
export function countUp(root) {
  const b = document.body.classList;
  const fresh = !b.contains('no-enter') && !b.contains('seen-page');
  const ok = motionOK() && !document.hidden;
  root.querySelectorAll('[data-count]').forEach(el => {
    const to = Number(el.dataset.count);
    if (!Number.isFinite(to)) return;
    const key = el.dataset.countKey;
    const from = key && shown.has(key) ? shown.get(key) : fresh ? 0 : to;
    if (key) shown.set(key, to);
    if (!ok || from === to) return;
    const final = el.textContent;
    const f = FMT[el.dataset.fmt] || FMT.int;
    const dur = from === 0 ? 720 : 480;
    const t0 = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 4);
    const lo = Math.min(from, to), hi = Math.max(from, to);
    const at = t => f(Math.min(hi, Math.max(lo, from + (to - from) * ease(t))));
    /* La valeur de départ est posée tout de suite : pas d'image avec la valeur finale avant le départ. */
    el.textContent = at(0);
    el.classList.add('is-counting');
    const step = now => {
      const t = Math.min(1, Math.max(0, (now - t0) / dur));
      el.textContent = t < 1 ? at(t) : final;
      if (t < 1) requestAnimationFrame(step); else el.classList.remove('is-counting');
    };
    requestAnimationFrame(step);
    setTimeout(() => { el.textContent = final; el.classList.remove('is-counting'); }, dur + 160);
  });
}

/* Courbe lissée qui ne dépasse jamais ses points (monotone, Fritsch-Carlson). */
function smoothPath(p, asSegments = false) {
  const n = p.length;
  if (n < 2) return asSegments ? [] : '';
  if (n === 2) { const s = `M${f1(p[0][0])},${f1(p[0][1])}L${f1(p[1][0])},${f1(p[1][1])}`; return asSegments ? [s] : s; }
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = (p[i + 1][1] - p[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${f1(p[0][0])},${f1(p[0][1])}`;
  const segs = [];
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    const c = `C${f1(p[i][0] + h)},${f1(p[i][1] + t[i] * h)} ${f1(p[i + 1][0] - h)},${f1(p[i + 1][1] - t[i + 1] * h)} ${f1(p[i + 1][0])},${f1(p[i + 1][1])}`;
    d += c;
    segs.push(`M${f1(p[i][0])},${f1(p[i][1])}${c}`);
  }
  return asSegments ? segs : d;
}
let gradSeq = 0;

/* Info-bulle d'un exercice de la trajectoire (barres et courbe). */
function trajTip(d) {
  const segs = d.parts.filter(p => p.amount > 0);
  const missing = d.parts.filter(p => !(p.amount > 0)).map(p => p.short || p.code);
  return `<b>${d.year}</b> · ${esc(fmt.eur(d.total))}<br>` + segs.map(p => `<span class="tip-sw" style="background:var(--s${p.slot})"></span>${esc(p.short || p.code)} <span class="tip-v">${esc(fmt.short(p.amount))}</span>`).join('<br>') +
    (missing.length ? `<br><span class="tip-miss">Non renseigné : ${esc(missing.join(', '))}</span>` : '');
}

/* Trajectoire en courbe : total par exercice, aire dégradée, point par année.
   Exercice incomplet = point creux ; exercice vide = pas de point. */
export function lineChart(data, {width = 720, height = 280, active, key = ''} = {}) {
  const W = width, H = height, padL = 54, padR = 10, padT = 24, padB = 46;
  const max = niceMax(Math.max(...data.map(d => d.total), 1));
  const iw = W - padL - padR, ih = H - padT - padB;
  const band = iw / Math.max(data.length, 1);
  const cx = i => padL + band * i + band / 2;
  const y = v => padT + ih - (v / max) * ih;
  const gid = `lg${++gradSeq}`;
  let out = `<svg class="chart chart-line" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trajectoire des produits fiscaux">
    <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="lg-a"/><stop offset="1" class="lg-b"/></linearGradient></defs>`;
  for (const t of [0, 0.25, 0.5, 0.75, 1].map(k => k * max)) {
    out += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${esc(axisLabel(t))}</text>`;
  }
  const ai = data.findIndex(d => d.year === active);
  if (ai >= 0) out += actBand(key, cx(ai) - band / 2 + 2, padT - 14, band - 4, ih + 14);
  const pts = data.map((d, i) => [cx(i), y(d.total), d]).filter(p => p[2].total > 0);
  const line = smoothPath(pts);
  if (line) {
    out += `<path class="ln-area" d="${line}L${f1(pts[pts.length - 1][0])},${y(0)}L${f1(pts[0][0])},${y(0)}Z" style="fill:url(#${gid})"/>
      <path class="ln" d="${line}" pathLength="1"/>`;
    /* Tronçon qui touche un exercice incomplet : tireté, pour ne pas lire un
       produit manquant comme une baisse. */
    const partial = d => d.covered < d.parts.length;
    smoothPath(pts, true).forEach((s, k) => {
      if (partial(pts[k][2]) || partial(pts[k + 1][2])) out += `<path class="ln-gap" d="${s}"/>`;
    });
  }
  data.forEach((d, i) => {
    const x = cx(i), has = d.total > 0, partial = d.covered < d.parts.length;
    const isA = d.year === active;
    out += `<g class="bar-g" style="--d:${i * 50}ms">
      <rect class="hit" x="${x - band / 2}" y="${padT - 14}" width="${band}" height="${ih + padB + 14}" ${hitA(trajTip(d), isA)}${isA ? ' data-active' : ''} data-year="${d.year}"/>
      <line class="xhair" x1="${x}" x2="${x}" y1="${padT - 8}" y2="${y(0)}"/>
      ${has ? `<circle class="pt${partial ? ' pt-partial' : ''}${isA ? ' is-active' : ''}" cx="${f1(x)}" cy="${f1(y(d.total))}" r="${isA ? 5.5 : 4}"/>
        ${isA || band >= 72 ? `<text class="val${isA ? ' val-active' : ''}" x="${x}" y="${f1(y(d.total) - 12)}" text-anchor="middle">${esc(fmt.short(d.total))}</text>` : ''}` : ''}
      <text class="axis axis-x${isA ? ' is-active' : ''}" x="${x}" y="${H - padB + 18}" text-anchor="middle">${d.year}</text>
      <text class="axis axis-cov${partial ? ' is-warn' : ''}" x="${x}" y="${H - padB + 34}" text-anchor="middle">${d.covered}/${d.parts.length}</text>
    </g>`;
  });
  return out + `<line class="base" x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}"/></svg>`;
}

/* Anneau de répartition. parts = [{code, label, slot, amount}] ; chaque part
   porte data-code pour être reliée à sa ligne de légende. */
export function donut(parts, {size = 176, stroke = 22, key = '', label = 'Total', total} = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, mid = size / 2;
  const sum = total ?? parts.reduce((s, p) => s + (p.amount > 0 ? p.amount : 0), 0);
  const vis = parts.filter(p => p.amount > 0);
  const gap = vis.length > 1 ? 2.5 : 0;
  let acc = 0, segs = '';
  vis.forEach((p, i) => {
    const len = Math.max(0.5, (p.amount / sum) * c - gap);
    const tip = `<span class="tip-sw" style="background:var(--s${p.slot})"></span><b>${esc(p.label)}</b> <span class="tip-v">${esc(fmt.pct(p.amount / sum, 1))}</span><br>${esc(fmt.eur(p.amount))}`;
    segs += `<circle class="dn-seg" cx="${mid}" cy="${mid}" r="${f1(r)}" stroke-width="${stroke}" style="stroke:var(--s${p.slot});stroke-dasharray:${f1(len)} ${f1(c)};stroke-dashoffset:${f1(-acc)};--c:${f1(c)};--d:${i * 60}ms"
      transform="rotate(-90 ${mid} ${mid})" data-code="${attr(p.code)}" data-tip="${attr(tip)}"${key ? ` data-mk="${attr(key)}-${attr(p.code)}" data-mp="stroke-dasharray,stroke-dashoffset"` : ''}/>`;
    acc += len + gap;
  });
  return `<div class="dn" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${attr(`Répartition : ${vis.map(p => `${p.label} ${fmt.pct(p.amount / sum)}`).join(', ')}`)}">
      <circle class="dn-track" cx="${mid}" cy="${mid}" r="${f1(r)}" stroke-width="${stroke}"/>${segs}
    </svg>
    <div class="dn-center" aria-hidden="true"><b data-dn-v>${esc(fmt.short(sum))}</b><span data-dn-l>${esc(label)}</span></div>
  </div>`;
}

/* Survol d'une part (ou de sa ligne de légende) : les autres s'effacent et le
   centre de l'anneau affiche la part visée. */
export function linkDonut(card) {
  const dn = card?.querySelector('.dn');
  if (!dn) return;
  const v = dn.querySelector('[data-dn-v]'), l = dn.querySelector('[data-dn-l]');
  const base = [v.textContent, l.textContent];
  let cur = null;
  const set = code => {
    if (code === cur) return;
    cur = code;
    dn.toggleAttribute('data-focus', !!code);
    card.querySelectorAll('[data-code]').forEach(el => el.classList.toggle('is-focus', !!code && el.dataset.code === code));
    const seg = code && dn.querySelector(`.dn-seg[data-code="${CSS.escape(code)}"]`);
    const row = code && card.querySelector(`[data-code="${CSS.escape(code)}"][data-share]`);
    if (seg && row) { v.textContent = row.dataset.share; l.textContent = row.dataset.name; }
    else { v.textContent = base[0]; l.textContent = base[1]; }
  };
  card.addEventListener('pointerover', e => set(e.target.closest?.('[data-code]')?.dataset.code || null));
  card.addEventListener('pointerleave', () => set(null));
  card.addEventListener('focusin', e => set(e.target.closest?.('[data-code]')?.dataset.code || null));
  card.addEventListener('focusout', () => set(null));
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
export function stackedBars(data, {width = 720, height = 280, active, key = ''} = {}) {
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
  const ai = data.findIndex(d => d.year === active);
  if (ai >= 0) out += actBand(key, padL + band * ai + 2, padT - 8, band - 4, ih + 8);
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
    out += `<g class="bar-g" style="--d:${i * 40}ms">
      <rect class="hit" x="${cx - band / 2}" y="${padT}" width="${band}" height="${ih + padB}" ${hitA(trajTip(d), active === d.year)}${active === d.year ? ' data-active' : ''} data-year="${d.year}"/>
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
export function statusBars(points, {slot = 1, width = 720, height = 280, active, key = ''} = {}) {
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
  const ai = points.findIndex(p => p.year === active);
  if (ai >= 0) out += actBand(key, padL + band * ai + 2, padT - 20, band - 4, ih + 20);
  points.forEach((p, i) => {
    const cx = padL + band * i + band / 2, x = cx - bw / 2;
    const has = p.amount > 0;
    const kind = statusKind(p.status);
    const tip = `<b>${p.year}</b> · ${has ? esc(fmt.eur(p.amount)) : 'non renseigné'}${p.status ? `<br>${esc(p.status)}` : ''}${p.source ? `<br><span class="tip-miss">${esc(p.source)}</span>` : ''}`;
    out += `<g class="bar-g" style="--d:${i * 45}ms">
      <rect class="hit" x="${cx - band / 2}" y="${padT - 20}" width="${band}" height="${ih + padB + 20}" ${hitA(tip, active === p.year)}${active === p.year ? ' data-active' : ''} data-pick="${p.year}"/>
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
export function deltaBars(points, {width = 520, height = 240, active, key = ''} = {}) {
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
  const ai = points.findIndex(p => p.year === active);
  if (ai >= 0) out += actBand(key, padL + band * ai + 2, padT - 10, band - 4, ih + 10);
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
      <rect class="hit" x="${cx - band / 2}" y="${padT - 10}" width="${band}" height="${ih + padB + 10}" ${hitA(tip, active === p.year)}${active === p.year ? ' data-active' : ''} data-pick="${p.year}"/>
      ${mark}
      <text class="axis axis-x${active === p.year ? ' is-active' : ''}" x="${cx}" y="${H - 9}" text-anchor="middle">${p.year}</text>
    </g>`;
  });
  return out + `<line class="base" x1="${padL}" x2="${W - padR}" y1="${zero}" y2="${zero}"/></svg>`;
}

/* Mini-courbe pour les menus et cartes. Avec `color` et `mark` (index de
   l'exercice affiché) : courbe lissée, aire légère et point sur l'exercice. */
export function spark(values, {slot = 1, w = 72, h = 22, color, mark, area = false} = {}) {
  const pts = values.map((v, i) => [i, v]).filter(([, v]) => v !== null && v !== undefined);
  if (pts.length < 2) return `<svg width="${w}" height="${h}" aria-hidden="true"></svg>`;
  const max = Math.max(...pts.map(p => p[1])), min = Math.min(...pts.map(p => p[1]));
  const sx = i => 2 + (i / (values.length - 1)) * (w - 4);
  const sy = v => h - 3 - ((v - min) / ((max - min) || 1)) * (h - 6);
  const c = color || `var(--s${slot})`;
  const xy = pts.map(([i, v]) => [sx(i), sy(v)]);
  const d = area ? smoothPath(xy) : xy.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const at = mark !== undefined && values[mark] !== null && values[mark] !== undefined ? [sx(mark), sy(values[mark])] : xy[xy.length - 1];
  const gid = `sg${++gradSeq}`;
  return `<svg class="spark${area ? ' spark-area' : ''}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${area ? `<defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:${c};stop-opacity:.22"/><stop offset="1" style="stop-color:${c};stop-opacity:0"/></linearGradient></defs><path class="spark-fill" d="${d}L${xy[xy.length - 1][0].toFixed(1)},${h}L${xy[0][0].toFixed(1)},${h}Z" style="fill:url(#${gid})"/>` : ''}<path class="spark-line" d="${d}" pathLength="1" style="stroke:${c}"/><circle class="spark-dot" cx="${at[0].toFixed(1)}" cy="${at[1].toFixed(1)}" r="2.75" style="fill:${c}"/></svg>`;
}

/* Anneau de score (0–100). */
export function ring(value, {size = 112, stroke = 9, tone = 'accent', label = '', key = ''} = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-val ring-${tone}" stroke-width="${stroke}" style="--c:${c.toFixed(2)}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"${key ? ` data-mk="${attr(key)}" data-mp="stroke-dashoffset"` : ''}/>
    </svg>
    <div class="ring-label"><b${key ? ` data-count="${Math.round(value)}" data-fmt="int" data-count-key="${attr(key)}"` : ''}>${Math.round(value)}</b>${label ? `<span>${esc(label)}</span>` : ''}</div>
  </div>`;
}

/* Info-bulle unique, pilotée par [data-tip].
   Sur un graphique, elle se pose au-dessus de la marque visée (barre, point,
   part d'anneau) avec une flèche, et glisse d'une marque à l'autre ; ailleurs
   elle suit le pointeur. Elle s'ouvre aussi au clavier (focus). */
export function installTooltips() {
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  let current = null;
  const anchorOf = el => {
    if (!el.closest('.chart, .dn')) return null;
    const g = el.closest('.bar-g');
    const mark = g?.querySelector('.pt, .bar-m') || el;
    const r = mark.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    if (el.classList.contains('dn-seg')) return null;
    return {x: r.left + r.width / 2, y: r.top, below: mark.classList.contains('is-down') ? r.bottom : null};
  };
  const put = (x, y) => { tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; };
  const placeAnchored = a => {
    const r = tip.getBoundingClientRect();
    const x = Math.max(8, Math.min(innerWidth - r.width - 8, a.x - r.width / 2));
    let y = a.y - r.height - 12;
    const flip = y < 8;
    if (flip) y = (a.below ?? a.y) + 14;
    tip.toggleAttribute('data-flip', flip);
    tip.style.setProperty('--ax', `${Math.round(a.x - x)}px`);
    put(x, y);
  };
  const placeAt = (cx, cy) => {
    const pad = 14, r = tip.getBoundingClientRect();
    let x = cx + pad, y = cy + pad;
    if (x + r.width > innerWidth - 8) x = cx - r.width - pad;
    if (y + r.height > innerHeight - 8) y = cy - r.height - pad;
    put(x, y);
  };
  const show = (el, e) => {
    const was = tip.hasAttribute('data-show') && tip.hasAttribute('data-anchored');
    current?.removeAttribute('data-hover');
    current = el;
    if (!el) { tip.removeAttribute('data-show'); tip.removeAttribute('data-glide'); return; }
    el.setAttribute('data-hover', '');
    tip.innerHTML = el.getAttribute('data-tip');
    const a = anchorOf(el);
    tip.toggleAttribute('data-anchored', !!a);
    /* D'une marque à la voisine : la bulle glisse ; à l'ouverture, elle apparaît sur place. */
    tip.toggleAttribute('data-glide', !!a && was);
    if (a) placeAnchored(a);
    else if (e && 'clientX' in e) placeAt(e.clientX, e.clientY);
    else { const r = el.getBoundingClientRect(); placeAt(r.left + r.width / 2, r.bottom); }
    tip.setAttribute('data-show', '');
  };
  document.addEventListener('pointerover', e => {
    const el = e.target.closest?.('[data-tip]') || null;
    if (el !== current) show(el, e);
  });
  document.addEventListener('pointermove', e => {
    if (current && !tip.hasAttribute('data-anchored')) placeAt(e.clientX, e.clientY);
  }, {passive: true});
  document.addEventListener('focusin', e => {
    const el = e.target.closest?.('[data-tip]');
    if (el && el.matches(':focus-visible')) show(el);
  });
  document.addEventListener('focusout', e => { if (e.target === current) show(null); });
  document.addEventListener('scroll', () => show(null), {passive: true, capture: true});

  /* Graphiques au clavier : flèches pour passer d'un exercice à l'autre,
     Entrée ou Espace pour l'ouvrir (comme un clic). */
  document.addEventListener('keydown', e => {
    const el = e.target.closest?.('.chart .hit');
    if (!el) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.dispatchEvent(new MouseEvent('click', {bubbles: true})); return; }
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    const all = [...el.ownerSVGElement.querySelectorAll('.hit')];
    const i = all.indexOf(el);
    const n = all[e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : i + (e.key === 'ArrowRight' ? 1 : -1)];
    if (!n || n === el) return;
    e.preventDefault();
    el.tabIndex = -1; n.tabIndex = 0; n.focus();
  });
}
