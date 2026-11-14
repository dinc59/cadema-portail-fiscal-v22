/* Lecture métier des tables. Fonctions pures : elles ne lisent que `rows()`
   et n'inventent aucune valeur — un montant absent reste absent. */
import { rows } from './grist.js';

/* Ordre fixe des produits = ordre fixe des couleurs (palette validée,
   jamais recyclée selon le rang). */
export const TAXES = [
  {code: 'VM', label: 'Versement mobilité', short: 'VM', slot: 1,
    about: 'Contribution des employeurs de 11 salariés et plus, affectée à la mobilité.'},
  {code: 'TEOM', label: 'Taxe d’enlèvement des ordures ménagères', short: 'TEOM', slot: 2,
    about: 'Taxe additionnelle au foncier bâti, finance la collecte et le traitement des déchets.'},
  {code: 'CFE', label: 'Cotisation foncière des entreprises', short: 'CFE', slot: 3,
    about: 'Impôt local des entreprises assis sur la valeur locative des biens.'},
  {code: 'COMP', label: 'Compensation CVAE (fraction de TVA)', short: 'Comp. CVAE', slot: 4,
    about: 'Fraction de TVA versée en remplacement de la CVAE supprimée.'},
  {code: 'TASCOM', label: 'Taxe sur les surfaces commerciales', short: 'TASCOM', slot: 5,
    about: 'Due par les commerces de détail de plus de 400 m².'},
  {code: 'IFER', label: 'Imposition forfaitaire des entreprises de réseaux', short: 'IFER', slot: 6,
    about: 'Due par les entreprises de réseaux (énergie, télécoms, transport).'},
];
export const taxByCode = code => TAXES.find(t => t.code === code);

export const num = v => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? Number(v.replace(/\s/g, '').replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : null;
};
export const text = v => (v === null || v === undefined) ? '' : String(v).trim();

/* Grist stocke Date et DateTime en secondes depuis 1970 (UTC). */
export function toDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return new Date(v * 1000);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
export const toGristDate = d => d ? Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 1000) : null;
export const nowSeconds = () => Math.floor(Date.now() / 1000);

/* ── Exercices ─────────────────────────────────────────────────────── */
export function years() {
  const set = new Set();
  for (const r of rows('Taxes')) if (num(r.Exercice) > 2000) set.add(num(r.Exercice));
  for (const r of rows('Suivi_RS_Annuel')) if (num(r.Exercice) > 2000) set.add(num(r.Exercice));
  for (const r of rows('Produits_Recettes')) if (num(r.Exercice) > 2000) set.add(num(r.Exercice));
  for (const r of rows('Budgets')) if (num(r.Exercice) > 2000) set.add(num(r.Exercice));
  const current = new Date().getFullYear();
  set.add(current);
  return [...set].sort((a, b) => a - b);
}
export function defaultYear() {
  const current = new Date().getFullYear();
  const ys = years().filter(y => y <= current);
  return ys.length ? ys[ys.length - 1] : current;
}

/* ── Recettes fiscales ─────────────────────────────────────────────── */
/* Une ligne par (code, exercice). Si Grist contient plusieurs lignes, la plus
   avancée est retenue (définitif, puis renseigné, puis prévision), puis la
   plus récente ; les autres sont signalées comme doublons. */
export const statusRank = s => /d[ée]finitif|notifi/i.test(text(s)) ? 3 : /pr[ée]vision/i.test(text(s)) ? 1 : 2;
export function taxCell(code, year) {
  const matches = rows('Taxes').filter(r => text(r.Code).toUpperCase() === code && num(r.Exercice) === year);
  if (!matches.length) {
    const p = rows('Produits_Recettes').find(r => text(r.Code_Produit).toUpperCase() === code && num(r.Exercice) === year);
    if (!p) return null;
    const amount = num(p.Realise) ?? num(p.Prevision);
    return amount === null ? null : {amount, status: 'Renseigné', source: text(p.Source), rowId: null, dupes: 0, fromProduits: true};
  }
  const best = [...matches].sort((a, b) => statusRank(b.Statut) - statusRank(a.Statut) || (num(b.Derniere_MAJ) || 0) - (num(a.Derniere_MAJ) || 0) || b.id - a.id)[0];
  return {
    amount: num(best.Produit), status: text(best.Statut) || 'Renseigné', source: text(best.Source),
    taux: best.Taux, base: best.Base_Nette, rowId: best.id, updated: toDate(best.Derniere_MAJ),
    responsable: text(best.Responsable), dupes: matches.length - 1, dupeIds: matches.filter(m => m !== best).map(m => m.id),
  };
}

/* Historique d'une recette : une entrée par exercice connu, avec l'évolution
   par rapport à l'exercice précédent quand les deux sont renseignés. */
export function taxHistory(code, extraYear) {
  const ys = new Set(taxYears());
  if (extraYear) ys.add(extraYear);
  const list = [...ys].sort((a, b) => a - b).map(y => ({year: y, cell: taxCell(code, y)}));
  return list.map((h, i) => {
    const prev = list[i - 1]?.year === h.year - 1 ? list[i - 1].cell : taxCell(code, h.year - 1);
    const a = h.cell?.amount, b = prev?.amount;
    return {...h, amount: a ?? null, delta: a != null && b ? a / b - 1 : null};
  });
}
/* Croissance annuelle moyenne entre le premier et le dernier exercice renseignés. */
export function taxCagr(code) {
  const known = taxHistory(code).filter(h => h.amount > 0);
  if (known.length < 2) return null;
  const first = known[0], last = known[known.length - 1];
  const n = last.year - first.year;
  return n > 0 ? {rate: Math.pow(last.amount / first.amount, 1 / n) - 1, from: first.year, to: last.year} : null;
}

/* Toutes les lignes non retenues de la table Taxes, tous produits et exercices. */
export function taxDupes() {
  const out = [];
  for (const t of TAXES) for (const y of taxYears()) {
    const c = taxCell(t.code, y);
    if (c?.dupeIds?.length) out.push({code: t.code, year: y, keep: c.rowId, ids: c.dupeIds});
  }
  return out;
}

export function taxYears() {
  const set = new Set();
  for (const r of rows('Taxes')) if (num(r.Exercice) > 2000) set.add(num(r.Exercice));
  for (const r of rows('Produits_Recettes')) if (num(r.Exercice) > 2000) set.add(num(r.Exercice));
  return [...set].sort((a, b) => a - b);
}

export function taxTotal(year) {
  let total = 0, covered = 0;
  const parts = [];
  for (const t of TAXES) {
    const c = taxCell(t.code, year);
    if (c && c.amount !== null) { total += c.amount; covered++; parts.push({...t, amount: c.amount, status: c.status}); }
    else parts.push({...t, amount: null});
  }
  return {total, covered, parts};
}

export function produit(code, year) {
  return rows('Produits_Recettes').find(r => text(r.Code_Produit).toUpperCase() === code && num(r.Exercice) === year) || null;
}

/* ── Redevance spéciale ─────────────────────────────────────────────── */
export const RS_SITUATIONS = [
  {key: 'À vérifier', tone: 'warn'},
  {key: 'À compléter', tone: 'warn'},
  {key: 'Pas encore titré', tone: 'info'},
  {key: 'Titre émis', tone: 'info'},
  {key: 'Partiellement réglée', tone: 'serious'},
  {key: 'Soldée', tone: 'good'},
  {key: 'Non concernée', tone: 'neutral'},
];
export const situationTone = s => RS_SITUATIONS.find(x => x.key === s)?.tone || 'neutral';

export function companies() {
  return rows('Entreprises_RS').map(r => ({
    rowId: r.id,
    id: text(r.Entreprise_ID) || `rs-${r.id}`,
    name: text(r.Raison_Sociale) || 'Entreprise sans nom',
    siret: text(r.SIRET), siren: text(r.SIREN),
    address: [text(r.Adresse), text(r.Commune)].filter(Boolean).join(', '),
    activity: text(r.Activite) || 'À renseigner',
    email: text(r.Email), phone: text(r.Telephone),
    contact: text(r.Responsable), pilot: text(r.Pilote_Dossier),
    step: text(r.Etape_Actuelle), nextAction: text(r.Prochaine_Action), nextDate: toDate(r.Date_Prochaine_Action),
    notes: text(r.Notes), convention: r.Convention_Fichier, conventionRef: text(r.Convention),
    raw: r,
  }));
}

export function annualFor(companyId, companyRowId) {
  return rows('Suivi_RS_Annuel').filter(r => {
    const ref = r.Entreprise_ID;
    return text(ref) === companyId || (typeof ref === 'number' && ref === companyRowId);
  });
}

export function rsYear(year) {
  const byCompany = new Map();
  for (const r of rows('Suivi_RS_Annuel')) {
    if (num(r.Exercice) !== year) continue;
    byCompany.set(text(r.Entreprise_ID), r);
  }
  const list = companies().map(c => {
    const a = byCompany.get(c.id) || byCompany.get(String(c.rowId)) || null;
    const billed = a ? num(a.Montant_Facture) : null;
    const paid = a ? num(a.Montant_Regle) : null;
    const rest = billed !== null ? Math.max(0, billed - (paid || 0)) : null;
    return {...c, annual: a, situation: a ? (text(a.Situation) || 'À vérifier') : 'Sans suivi', billed, paid, rest,
      titleNumber: a ? text(a.Numero_Titre) : '', titleDate: a ? toDate(a.Date_Titre) : null,
      paymentDate: a ? toDate(a.Date_Paiement) : null, observations: a ? text(a.Observations) : '', avis: a?.Avis_Fichier};
  });
  const concerned = list.filter(x => x.situation !== 'Non concernée' && x.situation !== 'Sans suivi');
  const billed = concerned.reduce((s, x) => s + (x.billed || 0), 0);
  const paid = concerned.reduce((s, x) => s + (x.paid || 0), 0);
  const counts = {};
  for (const x of list) counts[x.situation] = (counts[x.situation] || 0) + 1;
  return {list, billed, paid, rest: Math.max(0, billed - paid), rate: billed ? paid / billed : null, counts, concerned: concerned.length};
}

/* ── Recouvrement (tous exercices) ────────────────────────────────── */
/* Étapes du dossier, portées par Entreprises_RS.Etape_Actuelle. */
export const RS_STEPS = ['À qualifier', 'À titrer', 'Titre émis', 'Relance 1', 'Relance 2', 'Mise en demeure', 'Transmis au comptable', 'Soldé'];
/* Où en est le dossier, déduit des situations annuelles (pas de l'étape saisie) :
   un titre émis non réglé se relance ; un montant non titré se titre d'abord. */
export const RECOVERY_STAGES = [
  {key: 'À relancer', tone: 'serious', hint: 'Titre émis, reste impayé'},
  {key: 'À titrer', tone: 'info', hint: 'Facturé mais pas encore titré'},
  {key: 'À qualifier', tone: 'warn', hint: 'Situation à vérifier'},
];
export function recovery() {
  const today = new Date(new Date().toDateString());
  const list = companies().map(c => {
    const years = annualFor(c.id, c.rowId).map(a => {
      const billed = num(a.Montant_Facture), paid = num(a.Montant_Regle) || 0;
      return {year: num(a.Exercice), row: a, situation: text(a.Situation) || 'À vérifier', billed, paid,
        rest: billed ? Math.max(0, billed - paid) : 0, title: text(a.Numero_Titre), titleDate: toDate(a.Date_Titre)};
    }).filter(y => y.rest > 0 && !/non concern|sold/i.test(y.situation)).sort((a, b) => a.year - b.year);
    if (!years.length) return null;
    const stage = years.some(y => /titre [ée]mis|partiel/i.test(y.situation)) ? 'À relancer'
      : years.some(y => /pas encore titr/i.test(y.situation)) ? 'À titrer' : 'À qualifier';
    const relances = Number((/relance\s*(\d)/i.exec(c.step) || [])[1] || 0);
    return {...c, years, rest: years.reduce((s, y) => s + y.rest, 0), oldest: years[0].year, stage, relances,
      due: !!(c.nextDate && c.nextDate <= today), stepLabel: c.step || 'À qualifier'};
  }).filter(Boolean).sort((a, b) => b.rest - a.rest);
  const byYear = {};
  for (const c of list) for (const y of c.years) byYear[y.year] = (byYear[y.year] || 0) + y.rest;
  const counts = {}, amounts = {};
  for (const c of list) { counts[c.stage] = (counts[c.stage] || 0) + 1; amounts[c.stage] = (amounts[c.stage] || 0) + c.rest; }
  /* « Confirmé » = titré ou facturé et qualifié ; « à vérifier » n'est pas encore une créance sûre. */
  const confirmed = (amounts['À relancer'] || 0) + (amounts['À titrer'] || 0);
  return {list, byYear, counts, amounts, confirmed, unsure: amounts['À qualifier'] || 0, rest: list.reduce((s, c) => s + c.rest, 0), due: list.filter(c => c.due).length};
}

/* ── Pilotage ──────────────────────────────────────────────────────── */
export const TASK_STATUSES = ['À traiter', 'En cours', 'En attente', 'Terminé'];
export const PLAN_STATUSES = ['À lancer', 'En cours', 'À sécuriser', 'Réalisé', 'Abandonné'];

export function tasks() {
  return rows('Taches').filter(r => text(r.Titre)).map(r => ({
    rowId: r.id, id: text(r.Tache_ID), title: text(r.Titre), module: text(r.Module),
    priority: text(r.Priorite) || 'Normale', status: text(r.Statut) || 'À traiter',
    owner: text(r.Assigne_A) || text(r.Responsable), due: toDate(r.Echeance),
    progress: num(r.Progression) || 0, notes: text(r.Notes), updated: toDate(r.Derniere_MAJ), author: text(r.Dernier_Auteur),
  }));
}

export function plans() {
  return rows('Plans_Actions').filter(r => text(r.Action)).map(r => ({
    rowId: r.id, id: text(r.Action_ID), axis: text(r.Axe) || 'Autre', title: text(r.Action),
    from: num(r.Annee_Debut), to: num(r.Annee_Fin), pilot: text(r.Pilote), partners: text(r.Partenaires),
    deliverable: text(r.Livrable), indicator: text(r.Indicateur), target: text(r.Cible),
    status: text(r.Statut) || 'À lancer', comment: text(r.Commentaire),
  }));
}

export function events() {
  return rows('Calendrier_Fiscal').filter(r => text(r.Titre)).map(r => ({
    rowId: r.id, id: text(r.Evenement_ID), title: text(r.Titre), module: text(r.Module),
    start: toDate(r.Date_Debut), end: toDate(r.Date_Fin), owner: text(r.Responsable),
    priority: text(r.Priorite), status: text(r.Statut) || 'Planifié', notes: text(r.Notes),
  })).sort((a, b) => (a.start?.getTime() || 0) - (b.start?.getTime() || 0));
}

/* ── Documents ─────────────────────────────────────────────────────── */
export const DOC_TYPES = ['1259', '1386', 'EDET', 'EDAC', 'Délibérations', 'Conventions', 'Courriers DGFiP', 'Budget & CFU', 'Autre'];
export function documents() {
  return rows('Documents_Fiscaux').filter(r => text(r.Titre)).map(r => ({
    rowId: r.id, id: text(r.Document_ID), title: text(r.Titre), type: text(r.Type_Document) || 'Autre',
    year: num(r.Exercice) || null, module: text(r.Module), file: r.Fichier, link: text(r.Lien),
    author: text(r.Ajoute_Par), added: toDate(r.Date_Ajout), size: num(r.Taille_Octets), status: text(r.Statut),
  })).sort((a, b) => (b.added?.getTime() || 0) - (a.added?.getTime() || 0));
}

/* ── Équipe ────────────────────────────────────────────────────────── */
export function people() {
  const list = rows('Utilisateurs').filter(r => text(r.Nom_Affiche) && r.Actif !== false)
    .map(r => ({name: text(r.Nom_Affiche), role: text(r.Role), pole: text(r.Pole), declared: true}));
  const seen = new Set(list.map(p => p.name.toLowerCase()));
  for (const t of tasks()) for (const n of t.owner.split(/[·,;]/).map(s => s.trim()).filter(Boolean)) {
    if (!seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); list.push({name: n, role: '', pole: '', declared: false}); }
  }
  return list;
}
export function param(key) {
  return text(rows('Parametres').find(r => text(r.Cle) === key)?.Valeur);
}

/* ── Contrôle qualité ──────────────────────────────────────────────── */
/* Chaque contrôle dit ce qui manque, où, et combien. Le score est la part
   de contrôles satisfaits, pondérée par leur gravité — rien d'autre. */
export function quality(year) {
  const checks = [];
  const add = (c) => checks.push(c);
  const tYears = taxYears();
  const span = tYears.length ? [Math.min(...tYears), Math.max(year, ...tYears)] : [year, year];

  const dupes = [];
  const gaps = [];
  let cells = 0;
  for (const t of TAXES) {
    for (let y = span[0]; y <= Math.min(span[1], year); y++) {
      const c = taxCell(t.code, y);
      cells++;
      if (c?.dupes) dupes.push(`${t.code} ${y}`);
      if (!c || c.amount === null) gaps.push(`${t.code} ${y}`);
    }
  }
  add({id: 'tax-dupes', level: 'critical', title: 'Doublons dans les recettes fiscales',
    ok: !dupes.length, count: dupes.length, detail: dupes.join(' · '),
    fix: 'Les supprimer en un clic depuis Recettes (la ligne la plus avancée est conservée).', route: '#/recettes', ratio: cells ? dupes.length / cells : 0});
  add({id: 'tax-gaps', level: 'warn', title: 'Années sans produit renseigné',
    ok: !gaps.length, count: gaps.length, detail: gaps.join(' · '),
    fix: 'Saisir le produit depuis la fiche de la recette.', route: '#/recettes', ratio: cells ? gaps.length / cells : 0});

  const noRate = TAXES.filter(t => { const c = taxCell(t.code, year); return c && c.rowId && (c.taux === null || c.taux === '' || c.taux === undefined); });
  add({id: 'tax-rates', level: 'info', title: `Taux et bases ${year} non saisis`,
    ok: !noRate.length, count: noRate.length, detail: noRate.map(t => t.code).join(' · '),
    fix: 'Compléter Taux et Base_Nette dans la table Taxes.', route: '#/recettes', ratio: noRate.length / 6});

  const rs = rsYear(year);
  const toCheck = rs.list.filter(x => x.situation === 'À vérifier' || x.situation === 'À compléter');
  add({id: 'rs-check', level: 'warn', title: `Redevance ${year} : situations à vérifier`,
    ok: !toCheck.length, count: toCheck.length, detail: `${toCheck.length} dossier(s) sur ${rs.list.length}`,
    fix: 'Cochez les dossiers puis qualifiez-les en série : titré, soldé ou non concerné.', route: `#/redevance?situation=${encodeURIComponent('À vérifier')}`, ratio: rs.list.length ? toCheck.length / rs.list.length : 0});
  const noSiret = companies().filter(c => !c.siret && !c.siren);
  add({id: 'rs-siret', level: 'info', title: 'Entreprises sans SIRET',
    ok: !noSiret.length, count: noSiret.length, detail: `${noSiret.length} fiche(s) sur ${companies().length}`,
    fix: 'Saisie rapide : un numéro, Entrée, l’entreprise suivante.', route: '#/redevance?siret=0', ratio: companies().length ? noSiret.length / companies().length : 0});
  const noTrack = rs.list.filter(x => x.situation === 'Sans suivi');
  add({id: 'rs-track', level: 'warn', title: `Entreprises sans suivi ${year}`,
    ok: !noTrack.length, count: noTrack.length, detail: noTrack.slice(0, 6).map(x => x.name).join(' · '),
    fix: 'Ouvrir la fiche et créer le suivi de l’exercice.', route: `#/redevance?situation=${encodeURIComponent('Sans suivi')}`, ratio: rs.list.length ? noTrack.length / rs.list.length : 0});

  const orphanDocs = rows('Documents_Fiscaux').filter(r => !text(r.Titre));
  add({id: 'doc-orphans', level: 'info', title: 'Lignes documentaires vides',
    ok: !orphanDocs.length, count: orphanDocs.length, detail: `${orphanDocs.length} ligne(s) sans titre ni type dans Documents_Fiscaux`,
    fix: 'Les supprimer en un clic depuis Documents (aucun fichier n’est perdu).', route: '#/documents', ratio: rows('Documents_Fiscaux').length ? orphanDocs.length / rows('Documents_Fiscaux').length : 0});

  const budgets = rows('Budgets').filter(r => num(r.Exercice) === year - 1 || num(r.Exercice) === year);
  const toImport = budgets.filter(r => /importer/i.test(text(r.Source)) || num(r.Recettes_Realisees) === null);
  add({id: 'budgets', level: 'warn', title: 'Budgets annexes non importés',
    ok: !toImport.length, count: toImport.length, detail: toImport.map(r => `${text(r.Budget)} ${num(r.Exercice)}`).join(' · '),
    fix: 'Importer le compte financier unique de chaque budget.', route: '#/finances', ratio: budgets.length ? toImport.length / budgets.length : 0});
  const cfu = rows('CFU_Synthese').filter(r => /contr[oô]ler/i.test(text(r.Controle_GL)));
  add({id: 'cfu', level: 'info', title: 'CFU non rapproché du grand livre',
    ok: !cfu.length, count: cfu.length, detail: `${cfu.length} ligne(s) « À contrôler »`,
    fix: 'Rapprocher les totaux CFU du grand livre.', route: '#/finances', ratio: rows('CFU_Synthese').length ? cfu.length / rows('CFU_Synthese').length : 0});
  const fpic = rows('FPIC_Repartition').filter(r => num(r.Part_EPCI) === null);
  add({id: 'fpic', level: 'info', title: 'Répartition FPIC non saisie',
    ok: !fpic.length, count: fpic.length, detail: fpic.map(r => `FPIC ${num(r.Exercice)}`).join(' · '),
    fix: 'Saisir les parts EPCI et communes dès la notification.', route: '#/finances', ratio: rows('FPIC_Repartition').length ? fpic.length / rows('FPIC_Repartition').length : 0});

  const weight = {critical: 3, warn: 2, info: 1};
  /* Chaque contrôle compte au prorata de ce qui est conforme (ex. 31 dossiers
     qualifiés sur 109 = 28 %), pondéré par sa gravité. */
  const total = checks.reduce((s, c) => s + weight[c.level], 0);
  const passed = checks.reduce((s, c) => s + weight[c.level] * (c.ok ? 1 : Math.max(0, 1 - Math.min(1, c.ratio ?? 1))), 0);
  return {checks, score: total ? Math.round(passed / total * 100) : 100,
    open: checks.filter(c => !c.ok).length,
    critical: checks.filter(c => !c.ok && c.level === 'critical').length};
}
