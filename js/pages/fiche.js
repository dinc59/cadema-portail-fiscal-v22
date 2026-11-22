/* Synthèses PDF (#/fiche/<module>?an=AAAA).
   La page affiche la synthèse telle qu'elle sera imprimée : c'est l'aperçu.
   « Enregistrer en PDF » ouvre la fenêtre d'impression du navigateur.
   Aucune bibliothèque, aucun envoi : tout reste sur le poste.
   Pour ajouter la synthèse d'une autre page : une entrée dans FICHES.
   Chaque recette fiscale a aussi sa fiche : #/fiche/<CODE>?an=AAAA. */
import * as M from '../model.js';
import { rows, act, fieldsFor } from '../grist.js';
import { esc, icon, fmt, toast, confirmDialog } from '../ui.js';
import { LOGO, author, CREDIT } from '../main.js';
import { statusBars, deltaBars } from '../charts.js';
import { fmtTaux } from './recettes.js';

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

/* ── Courriers de relance de la redevance spéciale ─────────────────── */
/* Un courrier par page, prêt à signer. Le ton monte avec l'étape :
   rappel, second rappel, puis dernier rappel avant transmission au
   comptable public, seul compétent pour le recouvrement forcé d'un titre. */
const LETTER = {
  'Relance 1': {object: 'rappel de paiement', open: 'Sauf erreur ou omission de notre part, les sommes ci-dessous, dues au titre de la redevance spéciale pour l’enlèvement des déchets non ménagers, restent impayées à ce jour.',
    ask: 'Nous vous invitons à les régler dans un délai de quinze jours à compter de la réception du présent courrier, auprès du comptable public, en rappelant la référence du titre de recettes.'},
  'Relance 2': {object: 'second rappel', open: 'Malgré notre précédent courrier, les sommes ci-dessous, dues au titre de la redevance spéciale pour l’enlèvement des déchets non ménagers, restent impayées à ce jour.',
    ask: 'Nous vous demandons de les régler sous quinze jours à compter de la réception du présent courrier, auprès du comptable public, en rappelant la référence du titre de recettes.'},
  'Mise en demeure': {object: 'dernier rappel avant transmission au comptable public', open: 'Malgré nos précédents rappels, les sommes ci-dessous, dues au titre de la redevance spéciale pour l’enlèvement des déchets non ménagers, restent impayées à ce jour.',
    ask: 'À défaut de règlement sous quinze jours à compter de la réception du présent courrier, le dossier sera transmis au comptable public, chargé du recouvrement forcé, qui pourra engager les poursuites prévues par la loi. Les frais qui en découlent resteraient à votre charge.'},
};
function letter(c, today) {
  const step = M.nextRelance(c);
  const w = LETTER[step] || LETTER['Relance 1'];
  const ys = M.relanceYears(c);
  const total = ys.reduce((s, y) => s + y.rest, 0);
  return `<article class="report letter">
    <header class="letter-head">${LOGO.replace('logo-mark', 'logo-mark report-logo')}
      <div><p class="report-org">Communauté d’agglomération Dembéni-Mamoudzou</p><p class="letter-from">Pôle Fiscalité</p></div></header>
    <div class="letter-to"><b>${esc(c.name)}</b>${c.contact ? `<span>À l’attention de ${esc(c.contact)}</span>` : ''}${c.address ? `<span>${esc(c.address)}</span>` : '<span class="letter-miss">Adresse à compléter</span>'}</div>
    <p class="letter-date">Mamoudzou, le ${esc(today.toLocaleDateString('fr-FR', {day: 'numeric', month: 'long', year: 'numeric'}))}</p>
    <p class="letter-ref">${c.siret ? `SIRET ${esc(c.siret)} · ` : ''}Dossier ${esc(c.id)}</p>
    <p class="letter-obj"><b>Objet :</b> redevance spéciale — ${esc(w.object)}</p>
    <p>Madame, Monsieur,</p>
    <p>${esc(w.open)}</p>
    <table class="fiche-table letter-table"><thead><tr><th>Exercice</th><th>Titre de recettes</th><th class="n">Montant dû</th><th class="n">Déjà réglé</th><th class="n">Reste à payer</th></tr></thead>
      <tbody>${ys.map(y => `<tr><td>${y.year}</td><td>${y.title ? `n° ${esc(y.title)}${y.titleDate ? ` du ${esc(fmt.date(y.titleDate))}` : ''}` : 'non encore émis'}</td><td class="n">${esc(fmt.eurc(y.billed))}</td><td class="n">${esc(fmt.eurc(y.paid))}</td><td class="n"><b>${esc(fmt.eurc(y.rest))}</b></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">Total restant dû</td><td class="n">${esc(fmt.eurc(total))}</td></tr></tfoot></table>
    <p>${esc(w.ask)}</p>
    <p>Si vous avez déjà réglé ces sommes, merci de ne pas tenir compte de ce courrier et de nous adresser une copie de votre justificatif. Pour toute contestation ou demande d’échéancier, le Pôle Fiscalité reste à votre disposition.</p>
    <p>Nous vous prions d’agréer, Madame, Monsieur, l’expression de nos salutations distinguées.</p>
    <div class="letter-sign"><span>Pour le Président et par délégation,</span><span class="letter-sign-space"></span></div>
  </article>`;
}
function relances(year, params) {
  const id = params?.get('id');
  const all = M.recovery().list;
  const list = id ? all.filter(c => c.id === id) : all.filter(c => c.stage === 'À relancer');
  return {title: 'Courriers de relance', back: '#/redevance?tab=recouvrement', letters: list, single: !!id};
}

/* ── Fiche d'une recette fiscale ──────────────────────────────────────
   Mêmes chiffres que la page de la recette (taxHistory, taxCagr, taxTotal) :
   la fiche ne recalcule rien, elle met en page. */
const TAX_TONE = {'Définitif': 'var(--good)', 'Notifié': 'var(--good)', 'Renseigné': 'var(--info)', 'Prévision': 'var(--warn)'};
const has = v => v !== null && v !== undefined && v !== '';
function taxFiche(t, sel) {
  const hist = M.taxHistory(t.code, sel);
  const cur = hist.find(h => h.year === sel);
  const c = cur?.cell;
  const known = hist.filter(h => h.amount !== null);
  const cagr = M.taxCagr(t.code);
  const total = M.taxTotal(sel);
  const share = c?.amount != null && total.total ? c.amount / total.total : null;
  const prevAmount = M.taxCell(t.code, sel - 1)?.amount;
  const prods = rows('Produits_Recettes').filter(r => M.text(r.Code_Produit).toUpperCase() === t.code).sort((a, b) => M.num(a.Exercice) - M.num(b.Exercice));
  const fisc = hist.filter(h => has(h.cell?.taux) || has(h.cell?.base));
  const color = `var(--s${t.slot})`;

  const headline = c?.amount != null
    ? `${fmt.eur(c.amount)} en ${sel}${cur.delta != null ? `, ${fmt.delta(cur.delta)} sur un an` : ''}`
    : `Produit ${sel} non renseigné`;
  const notes = [
    c?.status === 'Prévision' && `Le montant ${sel} est une <b>prévision</b> : il sera remplacé par le produit notifié.`,
    c?.dupes && `<b>${c.dupes} ligne${c.dupes > 1 ? 's' : ''} en double</b> pour ${sel} dans la table Taxes : la ligne la plus avancée est retenue.`,
    c?.amount != null && total.covered < 6 && `Total des recettes ${sel} incomplet (${total.covered} produit${total.covered > 1 ? 's' : ''} sur 6) : la part est calculée sur ce total.`,
    c?.amount == null && `Aucun produit n’est saisi pour ${sel} dans la table Taxes : il n’est pas compté comme zéro.`,
  ].filter(Boolean);

  const sections = [{kicker: 'L’essentiel', title: headline, html: `
    ${kpis([
      {label: `Produit ${sel}`, value: c?.amount != null ? fmt.eur(c.amount) : '—', sub: c ? c.status : 'Non renseigné'},
      {label: 'Évolution sur un an', value: cur?.delta != null ? fmt.delta(cur.delta) : '—', sub: cur?.delta != null ? `${fmt.eur(prevAmount)} en ${sel - 1}` : `${sel - 1} ou ${sel} non renseigné`},
      {label: 'Croissance annuelle moyenne', value: cagr ? fmt.delta(cagr.rate) : '—', sub: cagr ? `de ${cagr.from} à ${cagr.to}` : 'Au moins deux exercices nécessaires'},
      {label: `Part des recettes ${sel}`, value: share != null ? fmt.pct(share, 1) : '—', sub: share != null ? `sur ${fmt.eur(total.total)}` : ''},
    ])}
    ${notes.length ? `<div class="fiche-alert is-warn"><p class="fiche-alert-h">À savoir</p><ul>${notes.map(n => `<li>${n}</li>`).join('')}</ul></div>` : ''}
    <p class="fiche-note">${esc(t.about)}</p>`}];

  sections.push({kicker: 'Trajectoire', title: `Produit par exercice${known.length ? `, ${known[0].year}–${known[known.length - 1].year}` : ''}`, html: `
    <div class="report-chart">${statusBars(hist.map(h => ({year: h.year, amount: h.amount, status: h.cell?.status, source: h.cell?.source})), {slot: t.slot, width: W, height: 250, active: sel})}</div>
    <div class="legend status-legend fiche-status" style="--c:${color}"><span><i class="lg lg-final"></i>Définitif ou notifié</span><span><i class="lg lg-filled"></i>Renseigné</span><span><i class="lg lg-forecast"></i>Prévision</span><span><i class="lg lg-gap"></i>Non renseigné</span></div>`});

  if (hist.slice(1).some(h => h.delta != null)) sections.push({kicker: 'Dynamique', title: 'Évolution d’un exercice à l’autre', html: `
    <div class="report-chart">${deltaBars(hist.slice(1).map(h => ({year: h.year, delta: h.delta})), {width: W, height: 210, active: sel})}</div>`});

  sections.push({kicker: 'Fiscalité', title: fisc.length ? 'Taux et base nette' : 'Taux et base nette non renseignés', html: fisc.length ? `
    <table class="fiche-table"><thead><tr><th>Exercice</th><th class="n">Taux</th><th class="n">Base nette</th></tr></thead>
      <tbody>${[...fisc].reverse().map(h => `<tr class="${h.year === sel ? 'is-sel' : ''}"><td>${h.year}</td><td class="n">${esc(fmtTaux(h.cell.taux))}</td><td class="n">${has(h.cell.base) ? esc(fmt.eur(M.num(h.cell.base))) : '—'}</td></tr>`).join('')}</tbody></table>`
    : '<p class="fiche-note">Les colonnes Taux et Base_Nette de la table Taxes sont vides pour cette recette.</p>'});

  if (prods.length) sections.push({kicker: 'Budget', title: 'Exécution : prévu et réalisé', html: `
    <table class="fiche-table"><thead><tr><th>Exercice</th><th>Budget</th><th class="n">Prévu</th><th class="n">Réalisé</th><th class="n">Écart</th><th class="n">Réalisation</th></tr></thead>
      <tbody>${prods.map(p => { const pr = M.num(p.Prevision), re = M.num(p.Realise); return `<tr class="${M.num(p.Exercice) === sel ? 'is-sel' : ''}"><td>${M.num(p.Exercice)}</td><td>${esc(M.text(p.Budget))}</td>
        <td class="n">${esc(fmt.eur(pr))}</td><td class="n">${esc(fmt.eur(re))}</td><td class="n">${esc(fmt.eur(re != null && pr != null ? re - pr : null))}</td><td class="n"><b>${esc(fmt.pct(pr ? (re || 0) / pr : null, 1))}</b></td></tr>`; }).join('')}</tbody></table>`});

  sections.push({kicker: 'Traçabilité', title: 'Historique retenu', full: true, html: known.length ? `
    <table class="fiche-table"><thead><tr><th>Exercice</th><th>Statut</th><th class="n">Produit</th><th class="n">Évolution</th><th>Source</th></tr></thead>
      <tbody>${[...known].reverse().map(h => `<tr class="${h.year === sel ? 'is-sel' : ''}"><td>${h.year}</td><td><i class="fiche-dot" style="background:${TAX_TONE[h.cell?.status] || 'var(--ink-3)'}"></i>${esc(h.cell?.status || '—')}</td>
        <td class="n">${esc(fmt.eur(h.amount))}</td><td class="n">${h.delta != null ? esc(fmt.delta(h.delta)) : '—'}</td><td class="fiche-src">${esc(h.cell?.source || '—')}</td></tr>`).join('')}</tbody></table>
    <p class="fiche-note">Quand un exercice a plusieurs lignes dans la table Taxes, la plus avancée est retenue : définitif, puis renseigné, puis prévision ; à égalité, la plus récente.</p>`
    : '<p class="fiche-empty">Aucun exercice renseigné.</p>'});

  return {title: t.label, org: 'Fiche recette fiscale', tag: {code: t.code, color}, back: `#/recettes/${t.code}?an=${sel}`, crumb: t.code,
    sections, years: hist.map(h => h.year), print: `Fiche ${t.code} ${sel} - CADEMA`};
}

const FICHES = {rs: {label: 'Redevance spéciale', build: rs}, relances: {label: 'Recouvrement', build: relances}};
const taxOf = sub => M.taxByCode(String(sub || '').toUpperCase());

export function render({year, sub, params}) {
  const tax = !FICHES[sub] && taxOf(sub);
  const key = FICHES[sub] ? sub : tax ? tax.code : 'rs';
  const y = Number(params.get('an')) || year;
  const f = tax ? taxFiche(tax, y) : FICHES[key].build(y, params);
  const now = new Date();
  if (f.letters) {
    const noAddr = f.letters.filter(c => !c.address).length;
    const steps = {};
    for (const c of f.letters) { const st = M.nextRelance(c); steps[st] = (steps[st] || 0) + 1; }
    return `
  <div class="report-tools">
    <a class="crumb" href="${f.back}">${icon('left', 14)}${esc(FICHES[key].label)}</a>
    <span class="toolbar-gap"></span>
    ${f.letters.length ? `<button class="btn" data-mark-all>${icon('check', 15)}Marquer ${f.letters.length > 1 ? `les ${f.letters.length} relances` : 'la relance'} comme envoyée${f.letters.length > 1 ? 's' : ''}</button>
    <button class="btn btn-primary" data-print>${icon('download', 15)}Enregistrer en PDF</button>` : ''}
  </div>
  <p class="report-hint">${f.letters.length ? `${f.letters.length} courrier${f.letters.length > 1 ? 's' : ''}, un par page (${Object.entries(steps).map(([k, n]) => `${n} ${k === 'Mise en demeure' ? 'dernier rappel' : k.toLowerCase()}`).join(', ')}). À signer par une personne habilitée avant envoi.${noAddr ? ` <b>${noAddr} sans adresse</b> : complétez la fiche entreprise avant d’imprimer.` : ''} Après l’envoi, marquez les relances : l’étape avance et un rappel est daté à ${M.RELANCE_DELAY} jours.` : 'Aucun dossier à relancer : il faut un titre émis et un reste impayé.'}</p>
  ${f.letters.map(c => letter(c, now)).join('')}`;
  }
  const ys = [...new Set([...(f.years || []), y])].sort((a, b) => b - a).slice(0, 6);
  return `
  <div class="report-tools">
    <a class="crumb" href="${f.back}">${icon('left', 14)}${esc(f.crumb || FICHES[key].label)}</a>
    <span class="toolbar-gap"></span>
    <span class="fiche-years">${ys.map(v => `<a class="chip" aria-pressed="${v === y}" href="#/fiche/${key}?an=${v}">${v}</a>`).join('')}</span>
    <button class="btn btn-primary" data-print>${icon('download', 15)}Enregistrer en PDF</button>
  </div>
  <p class="report-hint">Aperçu de la synthèse telle qu’elle sera imprimée. Dans la fenêtre d’impression, choisissez « Enregistrer au format PDF ». Format A4 portrait.</p>
  <article class="report fiche${f.tag ? ' fiche-tax' : ''}"${f.tag ? ` style="--fc:${f.tag.color}"` : ''}>
    <header class="report-head">
      ${LOGO.replace('logo-mark', 'logo-mark report-logo')}
      <div><p class="report-org">CADEMA · Pôle fiscalité${f.org ? ` · ${esc(f.org)}` : ''}</p>${f.tag ? `<p class="fiche-tag"><i></i>${esc(f.tag.code)} · exercice ${y}</p>` : ''}<h1>${esc(f.title)}</h1>
        <p class="report-meta">Établie le ${esc(now.toLocaleDateString('fr-FR'))}${author() !== 'Portail' ? ` par ${esc(author())}` : ''} · données du document Grist</p></div>
    </header>
    ${f.sections.map((s, i) => `<section class="report-sec${s.full ? ' is-long' : ''}">
      <p class="report-kicker">${i + 1}. ${esc(s.kicker)}</p><h2>${esc(s.title)}</h2>${s.html}</section>`).join('')}
    <footer class="report-foot">Chiffres extraits du document Grist du pôle fiscalité le ${esc(now.toLocaleString('fr-FR', {dateStyle: 'long', timeStyle: 'short'}))}. Un montant absent de la table n’est pas compté comme zéro.<span class="report-credit">${CREDIT}</span></footer>
  </article>`;
}

export function mount(root, {sub, params, year}) {
  document.body.classList.add('is-report');
  root.querySelector('[data-mark-all]')?.addEventListener('click', async e => {
    const f = FICHES.relances.build(year, params);
    const n = f.letters.length;
    const ok = await confirmDialog({title: `Marquer ${n > 1 ? `${n} relances` : 'la relance'} comme envoyée${n > 1 ? 's' : ''} ?`,
      message: `À faire seulement une fois les courriers partis. Chaque dossier passe à l’étape suivante, le journal reçoit une ligne datée et un rappel est fixé à ${M.RELANCE_DELAY} jours.`, confirm: 'Marquer envoyé'});
    if (!ok) return;
    e.target.disabled = true;
    const before = f.letters.map(c => ['UpdateRecord', 'Entreprises_RS', c.rowId, fieldsFor('Entreprises_RS', {
      Etape_Actuelle: c.raw.Etape_Actuelle ?? null, Prochaine_Action: c.raw.Prochaine_Action ?? null, Date_Prochaine_Action: c.raw.Date_Prochaine_Action ?? null,
      Notes: c.raw.Notes ?? null, Pilote_Dossier: c.raw.Pilote_Dossier ?? null, Derniere_MAJ: c.raw.Derniere_MAJ ?? null})]);
    try {
      await act(f.letters.map(c => ['UpdateRecord', 'Entreprises_RS', c.rowId, fieldsFor('Entreprises_RS', M.relanceFields(c, author()).fields)]));
      location.hash = f.back;
      toast(`${n} relance${n > 1 ? 's' : ''} enregistrée${n > 1 ? 's' : ''}`, 'ok', {action: 'Annuler', timeout: 9000, onAction: async () => {
        try { await act(before); toast('Relances annulées', 'info'); } catch (err) { toast(err.message, 'error'); }
      }});
    } catch (err) { toast(err.message, 'error'); e.target.disabled = false; }
  });
  root.querySelector('[data-print]')?.addEventListener('click', () => {
    const title = document.title;
    const label = FICHES[sub]?.label || 'Synthèse';
    const tax = !FICHES[sub] && taxOf(sub);
    document.title = tax ? `Fiche ${tax.code} ${Number(params.get('an')) || year} - CADEMA` : sub === 'relances' ? `Courriers de relance RS ${new Date().toLocaleDateString('fr-CA')} - CADEMA` : `${label} ${Number(params.get('an')) || year} - synthèse CADEMA`;
    addEventListener('afterprint', () => { document.title = title; }, {once: true});
    print();
  });
}
