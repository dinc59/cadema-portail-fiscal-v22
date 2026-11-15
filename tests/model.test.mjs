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
assert.equal(by.Principal.total, 2050);
assert.equal(by.Principal.covered, 3); assert.equal(by.Principal.expected, 6);
// Comparable : CFE 1000/800 et DGF 1000/900 (Total 2024 fait foi) ; IFER exclu
assert.equal(by.Principal.comparable, 2);
assert.ok(Math.abs(by.Principal.delta - (2000/1700 - 1)) < 1e-9);
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
