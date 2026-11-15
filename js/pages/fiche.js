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

const PAY_COLOR = {rien: 'var(--critical)', partiel: 'var(--s4)', paye: 'var(--good)', qualifier: 'var(--ink-3)'};

/* Alerte d'impayés, en tête : ce qu'on doit voir avant tout le reste. */
function unpaidAlert(p, year) {
  if (!p.total) return '';
  const lines = [
    p.unpaid.count && `<b>${p.unpaid.count}</b> entreprise${p.unpaid.count > 1 ? 's' : ''} n’${p.unpaid.count > 1 ? 'ont' : 'a'} rien payé : <b>${esc(fmt.eur(p.unpaid.amount))}</b> facturés sans aucun règlement`,
    p.partial.count && `<b>${p.partial.count}</b> ${p.partial.count > 1 ? 'ont' : 'a'} payé en partie : <b>${esc(fmt.eur(p.partial.rest))}</b> restent dus`,
    p.by.qualifier.length && `<b>${p.by.qualifier.length}</b> dossier${p.by.qualifier.length > 1 ? 's' : ''} sans montant facturé ou sans suivi ${year} : ils ne comptent pas dans le taux, leur situation est inconnue`,
  ].filter(Boolean);
  if (!lines.length) return `<div class="fiche-alert is-ok">Toutes les entreprises facturées en ${year} ont payé.</div>`;
  return `<div class="fiche-alert"><p class="fiche-alert-h">À recouvrer</p><ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul></div>`;
}

function payTable(rows, {showPaid = false} = {}) {
  return `<table class="fiche-table">
    <thead><tr><th>Entreprise</th><th>Situation</th><th>Titre</th><th class="n">Facturé</th>${showPaid ? '<th class="n">Encaissé</th>' : ''}<th class="n">Reste</th></tr></thead>
    <tbody>${rows.map(x => `<tr class="pay-${x.pay}"><td>${esc(x.name)}</td><td><i class="fiche-dot" style="background:${SIT_COLOR[x.situation] || 'var(--ink-3)'}"></i>${esc(x.situation)}</td><td>${esc(x.titleNumber || '—')}</td>
      <td class="n">${esc(fmt.eur(x.billed))}</td>${showPaid ? `<td class="n">${esc(fmt.eur(x.paid))}</td>` : ''}<td class="n">${x.rest ? `<b>${esc(fmt.eur(x.rest))}</b>` : '—'}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="3">Total · ${rows.length} entreprise${rows.length > 1 ? 's' : ''}</td><td class="n">${esc(fmt.eur(rows.reduce((s, x) => s + (x.billed || 0), 0)))}</td>${showPaid ? `<td class="n">${esc(fmt.eur(rows.reduce((s, x) => s + (x.paid || 0), 0)))}</td>` : ''}<td class="n">${esc(fmt.eur(rows.reduce((s, x) => s + (x.rest || 0), 0)))}</td></tr></tfoot></table>`;
}

function rs(year) {
  const p = M.rsPayments(year);
  const prev = M.rsYear(year - 1);
  const rec = M.recovery();
  const years = [...new Set(M.companies().flatMap(c => M.annualFor(c.id, c.rowId).map(a => M.num(a.Exercice))).filter(y => y > 2000))].sort((a, b) => a - b);
  const hist = years.map(y => { const r = M.rsYear(y); return {year: y, billed: r.billed, paid: r.paid, note: r.rate !== null ? fmt.pct(r.rate) : ''}; });
  const delta = prev.billed ? p.billed / prev.billed - 1 : null;
  const debtors = [...p.by.rien, ...p.by.partiel].sort((a, b) => b.rest - a.rest);
  const sitOrder = ['Soldée', 'Partiellement réglée', 'Titre émis', 'Pas encore titré', 'À vérifier', 'À compléter', 'Sans suivi'];
  const ages = Object.entries(rec.byYear).map(([y, v]) => ({year: Number(y), rest: v})).sort((a, b) => a.year - b.year);
  const headline = p.unpaid.count
    ? `${p.unpaid.count} entreprise${p.unpaid.count > 1 ? 's' : ''} sur ${p.total} n’${p.unpaid.count > 1 ? 'ont' : 'a'} rien payé en ${year}`
    : `${fmt.eur(p.paid)} encaissés sur ${fmt.eur(p.billed)} facturés`;
  const sections = [
    {kicker: 'L’essentiel', title: headline, html: `${unpaidAlert(p, year)}
      <p class="fiche-sub">Les ${p.total} entreprises concernées, selon ce qu’elles ont payé</p>
      ${stack(M.PAY_GROUPS.map(g => ({label: g.label, value: p.by[g.key].length, color: PAY_COLOR[g.key]})), {fmtV: v => `${v}`})}
      <div class="fiche-row mt-fiche">${donut(p.rate, 'du facturé')}${kpis([
        {label: 'Facturé', value: fmt.eur(p.billed), sub: delta === null ? '' : `${fmt.delta(delta)} par rapport à ${year - 1}`},
        {label: 'Encaissé', value: fmt.eur(p.paid)},
        {label: 'Reste à recouvrer', value: fmt.eur(p.rest)},
        {label: 'Entreprises à jour', value: p.upToDate === null ? '—' : fmt.pct(p.upToDate), sub: `${p.by.paye.length} sur ${p.by.rien.length + p.by.partiel.length + p.by.paye.length} facturées`},
      ])}</div>
      <p class="fiche-note">Le taux en montant peut rester élevé alors que beaucoup d’entreprises n’ont pas payé : quelques gros payeurs suffisent. C’est pourquoi le nombre d’entreprises est donné d’abord.</p>`},
  ];
  if (p.by.rien.length) sections.push({kicker: 'Impayés', title: `Les ${p.by.rien.length} entreprise${p.by.rien.length > 1 ? 's' : ''} qui n’ont rien payé en ${year}`, full: true,
    html: payTable([...p.by.rien].sort((a, b) => b.billed - a.billed || a.name.localeCompare(b.name)))});
  if (p.by.partiel.length) sections.push({kicker: 'Paiements partiels', title: `Les ${p.by.partiel.length} entreprise${p.by.partiel.length > 1 ? 's' : ''} qui ont payé en partie`, full: true,
    html: payTable([...p.by.partiel].sort((a, b) => b.rest - a.rest), {showPaid: true})});
  sections.push(
    {kicker: 'Restes à recouvrer', title: debtors.length ? `Les ${Math.min(10, debtors.length)} plus gros restes ${year}` : `Aucun reste à recouvrer en ${year}`,
      html: debtors.length ? hbars(debtors.slice(0, 10).map(x => ({label: x.name, value: x.rest, color: PAY_COLOR[x.pay]})))
        + `<div class="fiche-legend"><span><i style="background:${PAY_COLOR.rien}"></i>Rien payé</span><span><i style="background:${PAY_COLOR.partiel}"></i>Payé en partie</span></div>` : ''},
    {kicker: 'Trajectoire', title: 'Facturé et encaissé par exercice', html: `${yearBars(hist, [{key: 'billed', color: 'var(--info)'}, {key: 'paid', color: 'var(--good)'}], {active: year})}
      <div class="fiche-legend"><span><i style="background:var(--info)"></i>Facturé</span><span><i style="background:var(--good)"></i>Encaissé</span><span class="muted">Sous chaque exercice : taux de recouvrement</span></div>`},
    {kicker: 'Ancienneté', title: `${fmt.eur(rec.rest)} restent dus, tous exercices confondus`, html: `${yearBars(ages.map(a => ({year: a.year, rest: a.rest})), [{key: 'rest', color: 'var(--serious)'}], {height: 190, active: year})}
      ${kpis(M.RECOVERY_STAGES.map(s => ({label: s.key, value: fmt.eur(rec.amounts[s.key] || 0), sub: `${rec.counts[s.key] || 0} dossier(s) · ${s.hint.toLowerCase()}`})))}`},
    {kicker: 'Dossiers', title: 'Situation administrative saisie', html: stack(sitOrder.map(s => ({label: s, value: p.counts[s] || 0, color: SIT_COLOR[s]})), {fmtV: v => `${v}`})},
  );
  if (p.by.qualifier.length) sections.push({kicker: 'À qualifier', title: `${p.by.qualifier.length} dossier${p.by.qualifier.length > 1 ? 's' : ''} sans montant facturé ou sans suivi ${year}`, full: true,
    html: `<p class="fiche-note">Leur situation de paiement est inconnue : ils n’apparaissent pas dans les montants ci-dessus.</p><p class="fiche-names">${p.by.qualifier.map(x => esc(x.name)).sort((a, b) => a.localeCompare(b)).join(' · ')}</p>`});
  if (!p.total) sections.push({kicker: 'Annexe', title: 'Aucune entreprise concernée', html: '<p class="fiche-empty">Aucune entreprise concernée.</p>'});
  return {title: `Redevance spéciale — synthèse ${year}`, back: '#/redevance', sections, years};
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
