/* Synthèses PDF (#/fiche/<module>?an=AAAA).
   La page affiche la synthèse telle qu'elle sera imprimée : c'est l'aperçu.
   « Enregistrer en PDF » ouvre la fenêtre d'impression du navigateur.
   Aucune bibliothèque, aucun envoi : tout reste sur le poste.
   Pour ajouter la synthèse d'une autre page : une entrée dans FICHES. */
import * as M from '../model.js';
import { esc, icon, fmt } from '../ui.js';
import { LOGO, author, CREDIT } from '../main.js';

/* ── Graphiques SVG imprimables ───────────────────────────────────── */
const W = 682;
/* Barres horizontales triées : une ligne par élément. */
function hbars(items, {labelW = 210, valueW = 92, row = 26, fmtV = fmt.eur} = {}) {
  if (!items.length) return '<p class="fiche-empty">Aucune donnée.</p>';
  const max = Math.max(...items.map(i => i.value), 1);
  const bw = W - labelW - valueW - 16, h = items.length * row;
  return `<svg class="fiche-svg" viewBox="0 0 ${W} ${h}" role="img">${items.map((it, i) => {
    const y = i * row, w = Math.max(2, it.value / max * bw);
    return `<text x="0" y="${y + row / 2 + 4}" class="fs-l">${esc(it.label.length > 30 ? it.label.slice(0, 29) + '…' : it.label)}</text>
      <rect x="${labelW}" y="${y + 6}" width="${w.toFixed(1)}" height="${row - 12}" rx="3" fill="${it.color || 'var(--serious)'}"/>
      <text x="${W}" y="${y + row / 2 + 4}" class="fs-v" text-anchor="end">${esc(fmtV(it.value))}</text>`;
  }).join('')}</svg>`;
}
/* Barres groupées par exercice (ex. facturé / encaissé), valeurs au-dessus. */
function yearBars(rows, series, {height = 230, active} = {}) {
  if (!rows.length) return '<p class="fiche-empty">Aucun exercice renseigné.</p>';
  const top = 22, bottom = 30, ch = height - top - bottom;
  const max = Math.max(1, ...rows.flatMap(r => series.map(s => r[s.key] || 0)));
  const gw = W / rows.length, bw = Math.min(46, (gw - 24) / series.length);
  return `<svg class="fiche-svg" viewBox="0 0 ${W} ${height}" role="img">
    <line x1="0" x2="${W}" y1="${top + ch}" y2="${top + ch}" class="fs-axis"/>
    ${rows.map((r, i) => {
      const x0 = i * gw + (gw - bw * series.length) / 2;
      return series.map((s, j) => {
        const v = r[s.key] || 0, bh = v / max * ch, x = x0 + j * bw;
        return `<rect x="${x.toFixed(1)}" y="${(top + ch - bh).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${s.color}"/>
          ${v ? `<text x="${(x + (bw - 4) / 2).toFixed(1)}" y="${(top + ch - bh - 5).toFixed(1)}" class="fs-n" text-anchor="middle">${esc(fmt.short(v))}</text>` : ''}`;
      }).join('') + `<text x="${(i * gw + gw / 2).toFixed(1)}" y="${height - 10}" class="fs-y${r.year === active ? ' on' : ''}" text-anchor="middle">${r.year}${r.note ? ` · ${esc(r.note)}` : ''}</text>`;
    }).join('')}
  </svg>`;
}
/* Barre empilée et sa légende chiffrée. */
function stack(items, {fmtV = v => String(v)} = {}) {
  const parts = items.filter(i => i.value > 0);
  const total = parts.reduce((s, i) => s + i.value, 0);
  if (!total) return '<p class="fiche-empty">Aucune donnée.</p>';
  return `<div class="fiche-stack">${parts.map(i => `<span style="flex:${i.value};background:${i.color}"></span>`).join('')}</div>
    <div class="fiche-legend">${parts.map(i => `<span><i style="background:${i.color}"></i>${esc(i.label)} <b>${esc(fmtV(i.value))}</b> <em>${esc(fmt.pct(i.value / total))}</em></span>`).join('')}</div>`;
}
/* Anneau de taux. */
function donut(rate, label) {
  const r = 46, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, rate || 0));
  return `<svg class="fiche-donut" viewBox="0 0 120 120" role="img" aria-label="${esc(label)} ${esc(fmt.pct(rate))}">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--sunk)" stroke-width="12"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--good)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(c * v).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/>
    <text x="60" y="60" text-anchor="middle" class="fd-v">${esc(rate === null ? '—' : fmt.pct(rate))}</text>
    <text x="60" y="78" text-anchor="middle" class="fd-l">${esc(label)}</text></svg>`;
}
const kpis = list => `<div class="fiche-kpis">${list.map(k => `<div><span>${esc(k.label)}</span><b>${esc(k.value)}</b>${k.sub ? `<em>${esc(k.sub)}</em>` : ''}</div>`).join('')}</div>`;

/* ── Redevance spéciale ───────────────────────────────────────────── */
const SIT_COLOR = {'Soldée': 'var(--good)', 'Partiellement réglée': 'var(--s4)', 'Titre émis': 'var(--info)', 'Pas encore titré': 'var(--s5)',
  'À vérifier': 'var(--warn)', 'À compléter': 'var(--s2)', 'Non concernée': 'var(--line-2)', 'Sans suivi': 'var(--ink-3)'};

function rs(year) {
  const d = M.rsYear(year);
  const prev = M.rsYear(year - 1);
  const rec = M.recovery();
  const years = [...new Set(M.companies().flatMap(c => M.annualFor(c.id, c.rowId).map(a => M.num(a.Exercice))).filter(y => y > 2000))].sort((a, b) => a - b);
  const hist = years.map(y => { const r = M.rsYear(y); return {year: y, billed: r.billed, paid: r.paid, note: r.rate !== null ? fmt.pct(r.rate) : ''}; });
  const delta = prev.billed ? d.billed / prev.billed - 1 : null;
  const concerned = d.list.filter(x => x.situation !== 'Non concernée' && x.situation !== 'Sans suivi');
  const debtors = concerned.filter(x => x.rest > 0).sort((a, b) => b.rest - a.rest);
  const sitOrder = ['Soldée', 'Partiellement réglée', 'Titre émis', 'Pas encore titré', 'À vérifier', 'À compléter', 'Non concernée', 'Sans suivi'];
  const ages = Object.entries(rec.byYear).map(([y, v]) => ({year: Number(y), rest: v})).sort((a, b) => a.year - b.year);
  return {
    title: `Redevance spéciale — synthèse ${year}`,
    back: '#/redevance',
    sections: [
      {kicker: 'Chiffres clés', title: `${fmt.eur(d.paid)} encaissés sur ${fmt.eur(d.billed)} facturés`, html: `
        <div class="fiche-row">${donut(d.rate, 'recouvré')}${kpis([
          {label: 'Facturé', value: fmt.eur(d.billed), sub: delta === null ? '' : `${fmt.delta(delta)} par rapport à ${year - 1}`},
          {label: 'Encaissé', value: fmt.eur(d.paid)},
          {label: 'Reste à recouvrer', value: fmt.eur(d.rest)},
          {label: 'Entreprises concernées', value: `${d.concerned}`, sub: `sur ${d.list.length} suivies`},
        ])}</div>`},
      {kicker: 'Trajectoire', title: 'Facturé et encaissé par exercice', html: `${yearBars(hist, [{key: 'billed', color: 'var(--info)'}, {key: 'paid', color: 'var(--good)'}], {active: year})}
        <div class="fiche-legend"><span><i style="background:var(--info)"></i>Facturé</span><span><i style="background:var(--good)"></i>Encaissé</span><span class="muted">Sous chaque exercice : taux de recouvrement</span></div>`},
      {kicker: 'Dossiers', title: `Situation des ${d.list.length} entreprises en ${year}`, html: stack(sitOrder.map(s => ({label: s, value: d.counts[s] || 0, color: SIT_COLOR[s]})), {fmtV: v => `${v}`})},
      {kicker: 'Restes à recouvrer', title: debtors.length ? `Les ${Math.min(10, debtors.length)} plus gros restes ${year}` : `Aucun reste à recouvrer en ${year}`,
        html: debtors.length ? hbars(debtors.slice(0, 10).map(x => ({label: x.name, value: x.rest, color: SIT_COLOR[x.situation] || 'var(--serious)'})))
          + (debtors.length > 10 ? `<p class="fiche-note">${debtors.length - 10} autre(s) entreprise(s) pour ${fmt.eur(debtors.slice(10).reduce((s, x) => s + x.rest, 0))}.</p>` : '') : ''},
      {kicker: 'Ancienneté', title: `${fmt.eur(rec.rest)} restent dus, tous exercices confondus`, html: `${yearBars(ages.map(a => ({year: a.year, rest: a.rest})), [{key: 'rest', color: 'var(--serious)'}], {height: 190, active: year})}
        ${kpis(M.RECOVERY_STAGES.map(s => ({label: s.key, value: fmt.eur(rec.amounts[s.key] || 0), sub: `${rec.counts[s.key] || 0} dossier(s) · ${s.hint.toLowerCase()}`})))}`},
      {kicker: 'Annexe', title: `Détail des ${concerned.length} entreprises concernées en ${year}`, full: true, html: concerned.length ? `<table class="fiche-table">
        <thead><tr><th>Entreprise</th><th>Situation</th><th>Titre</th><th class="n">Facturé</th><th class="n">Encaissé</th><th class="n">Reste</th></tr></thead>
        <tbody>${[...concerned].sort((a, b) => (b.rest || 0) - (a.rest || 0) || a.name.localeCompare(b.name)).map(x => `<tr>
          <td>${esc(x.name)}</td><td><i class="fiche-dot" style="background:${SIT_COLOR[x.situation] || 'var(--ink-3)'}"></i>${esc(x.situation)}</td><td>${esc(x.titleNumber || '—')}</td>
          <td class="n">${esc(fmt.eur(x.billed))}</td><td class="n">${esc(fmt.eur(x.paid))}</td><td class="n">${x.rest ? `<b>${esc(fmt.eur(x.rest))}</b>` : '—'}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td class="n">${esc(fmt.eur(d.billed))}</td><td class="n">${esc(fmt.eur(d.paid))}</td><td class="n">${esc(fmt.eur(d.rest))}</td></tr></tfoot></table>` : '<p class="fiche-empty">Aucune entreprise concernée.</p>'},
    ],
    years,
  };
}

const FICHES = {rs: {label: 'Redevance spéciale', build: rs}};

export function render({year, sub, params}) {
  const key = FICHES[sub] ? sub : 'rs';
  const y = Number(params.get('an')) || year;
  const f = FICHES[key].build(y);
  const now = new Date();
  const ys = [...new Set([...(f.years || []), y])].sort((a, b) => b - a).slice(0, 6);
  return `
  <div class="report-tools">
    <a class="crumb" href="${f.back}">${icon('left', 14)}${esc(FICHES[key].label)}</a>
    <span class="toolbar-gap"></span>
    <span class="fiche-years">${ys.map(v => `<a class="chip" aria-pressed="${v === y}" href="#/fiche/${key}?an=${v}">${v}</a>`).join('')}</span>
    <button class="btn btn-primary" data-print>${icon('download', 15)}Enregistrer en PDF</button>
  </div>
  <p class="report-hint">Aperçu de la synthèse telle qu’elle sera imprimée. Dans la fenêtre d’impression, choisissez « Enregistrer au format PDF ». Format A4 portrait.</p>
  <article class="report fiche">
    <header class="report-head">
      ${LOGO.replace('logo-mark', 'logo-mark report-logo')}
      <div><p class="report-org">CADEMA · Pôle fiscalité</p><h1>${esc(f.title)}</h1>
        <p class="report-meta">Établie le ${esc(now.toLocaleDateString('fr-FR'))}${author() !== 'Portail' ? ` par ${esc(author())}` : ''} · données du document Grist</p></div>
    </header>
    ${f.sections.map((s, i) => `<section class="report-sec${s.full ? ' is-long' : ''}">
      <p class="report-kicker">${i + 1}. ${esc(s.kicker)}</p><h2>${esc(s.title)}</h2>${s.html}</section>`).join('')}
    <footer class="report-foot">Chiffres extraits du document Grist du pôle fiscalité le ${esc(now.toLocaleString('fr-FR', {dateStyle: 'long', timeStyle: 'short'}))}. Un montant absent de la table n’est pas compté comme zéro.<span class="report-credit">${CREDIT}</span></footer>
  </article>`;
}

export function mount(root, {sub, params, year}) {
  document.body.classList.add('is-report');
  root.querySelector('[data-print]').addEventListener('click', () => {
    const title = document.title;
    const label = FICHES[sub]?.label || 'Synthèse';
    document.title = `${label} ${Number(params.get('an')) || year} - synthèse CADEMA`;
    addEventListener('afterprint', () => { document.title = title; }, {once: true});
    print();
  });
}
