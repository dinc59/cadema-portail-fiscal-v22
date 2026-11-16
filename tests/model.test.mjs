// Lancer : node tests/model.test.mjs "$PWD"   (Node 20 ou plus, aucune installation)
import assert from 'node:assert/strict';
const repo = process.argv[2];
const {db} = await import(`${repo}/js/grist.js`);
const M = await import(`${repo}/js/model.js`);
const T = (o) => o;
db.tables = {
  Taxes: [
    {id:1, Code:'CFE', Exercice:2025, Produit:1000, Statut:'Définitif'},
    {id:2, Code:'CFE', Exercice:2024, Produit:800, Statut:'Définitif'},
    {id:3, Code:'TEOM', Exercice:2025, Produit:500, Statut:'Prévision'},
    {id:4, Code:'TEOM', Exercice:2024, Produit:400, Statut:'Définitif'},
    {id:5, Code:'VM', Exercice:2025, Produit:300, Statut:'Définitif'},
    {id:6, Code:'IFER', Exercice:2025, Produit:50, Statut:'Définitif'},  // pas de N-1 : hors périmètre comparable
  ],
  Produits_Recettes: [{id:1, Code_Produit:'CFE', Exercice:2025, Prevision:1100, Realise:1000, Budget:'Budget principal'}],
  Entreprises_RS: [{id:1, Entreprise_ID:'e1', Raison_Sociale:'A'}, {id:2, Entreprise_ID:'e2', Raison_Sociale:'B'}],
  Suivi_RS_Annuel: [
    {id:1, Entreprise_ID:'e1', Exercice:2025, Situation:'Titre émis', Montant_Facture:200, Montant_Regle:150},
    {id:2, Entreprise_ID:'e2', Exercice:2025, Situation:'Non concernée', Montant_Facture:999, Montant_Regle:0},
  ],
  DGF_Detail: [
    {id:1, Exercice:2025, Intitule:'Dotation d’intercommunalité', Montant:700},
    {id:2, Exercice:2025, Intitule:'Dotation de compensation', Montant:300},
    {id:3, Exercice:2024, Intitule:'Total DGF', Montant:900},
    {id:4, Exercice:2024, Intitule:'Dotation d’intercommunalité', Montant:600},
  ],
  FPIC_Repartition: [{id:1, Exercice:2025, Total:100, Part_EPCI:null}],
  Parametres: [],
  Documents_Fiscaux: [
    {id:1, Titre:'EDET 2024', Type_Document:'EDET', Exercice:2024, Fichier:['L',5]},
    {id:2, Titre:'1259 2025', Type_Document:'1259', Exercice:2025},
  ],
};
const by = Object.fromEntries(M.revenueByBudget(2025).map(b => [b.key, b]));
// Principal : CFE 1000 + IFER 50 + DGF 1000 (somme, pas de ligne Total en 2025) ; COMP, TASCOM, FPIC inconnus
// + GEMAPI : produit voté de référence (3 294 189 € en 2025, 1 350 550 € en 2024)
assert.equal(by.Principal.total, 2050 + 3294189);
assert.equal(by.Principal.covered, 4); assert.equal(by.Principal.expected, 7, 'les taxes additionnelles sans produit saisi sont masquées');
// Comparable : CFE 1000/800 et DGF 1000/900 (Total 2024 fait foi) ; IFER exclu
assert.equal(by.Principal.comparable, 3);
assert.ok(Math.abs(by.Principal.delta - ((2000 + 3294189) / (1700 + 1350550) - 1)) < 1e-9);
// Déchets : TEOM 500 (prévision) + RS facturé 200 (la non concernée est exclue)
assert.equal(by['Déchets'].total, 700);
const rs = by['Déchets'].lines.find(l => l.code === 'RS');
assert.equal(rs.paid, 150); assert.equal(rs.rest, 50);
assert.equal(by['Déchets'].forecastShare, 1);
assert.equal(by['Mobilité'].total, 300); assert.equal(by['Mobilité'].delta, null);
// Exécution budgétaire lue dans Produits_Recettes
const cfe = by.Principal.lines.find(l => l.code === 'CFE');
assert.equal(cfe.forecast, 1100); assert.equal(cfe.realised, 1000);
// Rattachement corrigé depuis Parametres
db.tables.Parametres = [{id:1, Cle:'BUDGET_TEOM', Valeur:'Budget principal'}];
assert.equal(M.budgetOf('TEOM'), 'Principal');
db.tables.Parametres = [{id:1, Cle:'BUDGET_TEOM', Valeur:'n’importe quoi'}];
assert.equal(M.budgetOf('TEOM'), 'Déchets', 'une valeur illisible garde le rattachement par défaut');
db.tables.Parametres = [];
// Grille des états
const g = M.statesGrid(2026);
assert.equal(g[0].year, 2026); assert.equal(g.at(-1).year, 2021);
assert.equal(g.find(r => r.year === 2024).cells.find(c => c.type === 'EDET').docs.length, 1);
const miss = M.missingStates(2026);
assert.ok(!miss.some(s => s.endsWith('2026')), 'exercice en cours non exigé');
assert.ok(miss.includes('EDET 2025') && !miss.includes('EDET 2024') && !miss.includes('1259 2025'));
// Contrôle qualité intégré
const q = M.quality(2026);
const st = q.checks.find(c => c.id === 'states');
assert.ok(st && !st.ok && st.detail.includes('EDET 2025'));
console.log('model: tous les contrôles passent');

// ── Taux votés ──
db.tables.Taxes = [];
assert.equal(M.parseRate('CFE', '18,04 %'), 18.04);
assert.equal(M.parseRate('CFE', 0.1804), 18.04);
assert.equal(M.parseRate('CFE', 18.04), 18.04);
assert.equal(M.parseRate('VM', 0.015), 1.5, 'VM saisi en fraction');
assert.equal(M.parseRate('VM', 1.5), 1.5);
assert.equal(M.parseRate('VM', '0,55'), 0.55, 'un ancien taux VM de 0,55 % n’est pas lu comme 55 %');
let h = M.rateHistory('CFE', 2026);
assert.equal(h.length, 1); assert.deepEqual([h[0].from, h[0].to, h[0].rate], [2016, 2026, 18.04]);
h = M.rateHistory('VM', 2026);
assert.deepEqual(h.map(p => [p.from, p.to, p.rate, p.absent]), [[2016, 2018, null, true], [2019, 2020, 0.2, false], [2021, 2021, 0.6, false], [2022, 2024, 0.9, false], [2025, 2026, 1.5, false]]);
assert.equal(h[1].toConfirm, true); assert.equal(h[3].toConfirm, false); assert.equal(h[1].effect, '1er octobre 2019');
// Un taux saisi dans Grist l'emporte et crée une nouvelle période
db.tables.Taxes = [{id: 1, Code: 'TEOM', Exercice: 2027, Taux: '15 %'}, {id: 2, Code: 'VM', Exercice: 2020, Taux: 0.0055}];
h = M.rateHistory('TEOM', 2027);
assert.deepEqual(h.map(p => [p.from, p.to, p.rate]), [[2016, 2026, 14.4], [2027, 2027, 15]]);
assert.equal(h[1].fromGrist, true);
h = M.rateHistory('VM', 2025);
assert.deepEqual(h.map(p => [p.from, p.to, p.rate]), [[2016, 2018, null], [2019, 2019, 0.2], [2020, 2020, 0.55], [2021, 2021, 0.6], [2022, 2024, 0.9], [2025, 2025, 1.5]], 'un taux saisi dans Grist remplace la référence pour son exercice');
db.tables.Taxes = [];
// Délibérations rattachées à un taux
db.tables.Documents_Fiscaux = [{id: 9, Titre: 'Délibération VM 2024', Type_Document: 'Délibérations', Module: 'VM'}, {id: 10, Titre: 'Autre', Type_Document: 'Délibérations', Module: 'CFE'}];
assert.deepEqual(M.rateDocs('VM').map(d => d.rowId), [9]);
console.log('taux : tous les contrôles passent');

// ── Pièces d'un état ──
assert.equal(M.docMonth('EDET mars 2025'), 3); assert.equal(M.docMonth('EDET_2025-11.pdf'), 11);
assert.equal(M.docMonth('edet 01/2026'), 1); assert.equal(M.docMonth('EDET Déc. 2025'), 12);
assert.equal(M.docMonth('EDET 2025'), null); assert.equal(M.docMonth('Déclaration de recettes'), null); assert.equal(M.docMonth('Octroi de mer'), null); assert.equal(M.docMonth('EDET sept 2025'), 9); assert.equal(M.docMonth('Mairie de Mamoudzou'), null, '« mai » dans un mot n’est pas un mois');
const P = (rowId, title, status = 'Classé') => ({rowId, title, status, added: new Date(2026, 0, rowId)});
assert.deepEqual(M.sortPieces([P(1, 'EDET décembre'), P(2, 'EDET sans mois'), P(3, 'EDET janvier'), P(4, 'EDET juin', M.RECAP_STATUS)]).map(d => d.rowId), [4, 3, 1, 2]);
console.log('pièces : tous les contrôles passent');

// ── Qui a payé ──
assert.equal(M.payStatus({situation: 'Soldée', billed: 100, paid: 100}), 'paye');
assert.equal(M.payStatus({situation: 'Titre émis', billed: 100, paid: 0}), 'rien');
assert.equal(M.payStatus({situation: 'Titre émis', billed: 100, paid: null}), 'rien', 'aucun règlement saisi = rien payé');
assert.equal(M.payStatus({situation: 'Partiellement réglée', billed: 100, paid: 40}), 'partiel');
assert.equal(M.payStatus({situation: 'À vérifier', billed: null, paid: null}), 'qualifier', 'sans montant facturé : inconnu, pas « payé »');
assert.equal(M.payStatus({situation: 'Sans suivi', billed: null}), 'qualifier');
console.log('paiements : tous les contrôles passent');

// ── Fiabilisation : doublons RS, trop-perçu, tables non chargées, Soldée ──
db.tables.Entreprises_RS = [{id: 1, Entreprise_ID: 'e1', Raison_Sociale: 'Alpha'}, {id: 2, Entreprise_ID: 'e2', Raison_Sociale: 'Beta'}];
db.tables.Suivi_RS_Annuel = [
  {id: 1, Entreprise_ID: 'e1', Exercice: 2025, Montant_Facture: 100, Montant_Regle: 0},
  {id: 2, Entreprise_ID: 'e1', Exercice: 2025, Montant_Facture: 100, Montant_Regle: 100},
  {id: 3, Entreprise_ID: 'e2', Exercice: 2025, Montant_Facture: 100, Montant_Regle: 150},
  {id: 4, Entreprise_ID: 'e2', Exercice: 2024, Montant_Facture: 100, Montant_Regle: 100.2}];
db.missing = ['Budgets'];
let q2 = M.quality(2026);
const chk = id => q2.checks.find(c => c.id === id);
assert.equal(chk('rs-dupes').ok, false); assert.match(chk('rs-dupes').detail, /Alpha 2025 \(2 lignes\)/);
assert.equal(chk('rs-overpaid').count, 1, 'un écart de centimes n’est pas un trop-perçu'); assert.match(chk('rs-overpaid').detail, /Beta 2025 \(\+50 €\)/);
assert.equal(chk('tables').ok, false); assert.match(chk('tables').detail, /Budgets/);
db.missing = []; db.tables.Suivi_RS_Annuel = db.tables.Suivi_RS_Annuel.filter(r => r.id !== 2 && r.id !== 3);
q2 = M.quality(2026);
assert.ok(chk('rs-dupes').ok && chk('rs-overpaid').ok && chk('tables').ok);
assert.equal(M.canSettle({billed: 100, paid: 100}), true);
assert.equal(M.canSettle({billed: 100, paid: 99}), false);
assert.equal(M.canSettle({billed: 100, paid: null}), false, 'pas de règlement saisi : pas de solde');
assert.equal(M.canSettle({billed: null, paid: null}), false);
console.log('fiabilisation : tous les contrôles passent');

// ── Export CSV ──
const U = await import(`${repo}/js/ui.js`);
const csv = U.csvText(['A'], [['=HYPERLINK("x")'], ['+33 6'], ['@SUM(1)'], ['-1200'], ['-2,5'], ['-cmd'], ['Texte; avec "guillemets"'], [1250.5], [null]]).slice(1).split('\r\n');
assert.deepEqual(csv, ['A', `"'=HYPERLINK(""x"")"`, "'+33 6", "'@SUM(1)", '-1200', '-2,5', "'-cmd", '"Texte; avec ""guillemets"""', '1250.5', '']);
console.log('export CSV : tous les contrôles passent');


// ── Propositions 2027 et GEMAPI ──
db.tables.Taxes = []; db.tables.Parametres = [];
assert.equal(M.rateFor('TEOM', 2026).rate, 14.4);
const t27 = M.rateFor('TEOM', 2027); assert.equal(t27.rate, 17.4); assert.equal(t27.proposed, true);
assert.equal(M.rateHorizon(2026), 2027);
let hp = M.rateHistory('TFPB', 2027);
assert.deepEqual(hp.map(p => [p.from, p.to, p.rate, p.absent, p.proposed]), [[2016, 2026, null, true, false], [2027, 2027, 6.71, false, true]]);
// Le taux voté saisi dans Grist confirme la proposition (ou la remplace)
db.tables.Taxes = [{id: 1, Code: 'TEOM', Exercice: 2027, Taux: '17,40 %'}, {id: 2, Code: 'THRS', Exercice: 2027, Taux: 10}];
assert.ok(!M.rateFor('TEOM', 2027).proposed, 'saisi dans Grist : plus « proposé »');
assert.equal(M.rateFor('TEOM', 2027).origin, 'grist');
assert.equal(M.rateHistory('THRS', 2027).at(-1).rate, 10, 'un vote différent de la proposition l’emporte');
const sumGains = Object.values(M.PROPOSAL_GAINS).reduce((a, b) => a + b, 0);
assert.equal(sumGains, 6994870, 'total des recettes nouvelles du document');
// GEMAPI : référence, puis saisie Grist prioritaire ; 2027 non arrêté
db.tables.Taxes = [];
assert.equal(M.gemapiProduct(2024).amount, 1350550); assert.equal(M.gemapiProduct(2027), null);
assert.deepEqual(M.gemapiHistory(2027).map(h => h.year), [2022, 2023, 2024, 2025, 2026]);
db.tables.Taxes = [{id: 1, Code: 'GEMAPI', Exercice: 2027, Produit: 3500000, Statut: 'Définitif'}];
assert.equal(M.gemapiProduct(2027).amount, 3500000); assert.equal(M.gemapiProduct(2027).origin, 'grist');
assert.equal(M.GEMAPI.ceiling - M.GEMAPI.voted[2026], 727971);
// Une taxe additionnelle apparaît dans le budget principal dès qu'un produit est saisi
db.tables.Taxes = [{id: 1, Code: 'TFPB', Exercice: 2027, Produit: 3894417, Statut: 'Prévision'}];
const p27 = M.revenueByBudget(2027).find(b => b.key === 'Principal');
assert.ok(p27.lines.some(l => l.code === 'TFPB' && l.amount === 3894417));
assert.ok(!p27.lines.some(l => l.code === 'TFPNB'));
db.tables.Taxes = [];
console.log('propositions 2027 et GEMAPI : tous les contrôles passent');
