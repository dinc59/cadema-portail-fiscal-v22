// Référentiel Grist, points à confirmer, simulateur, courriers de relance, lien vers un document.
// Lancer : node tests/ameliorations.mjs "$PWD"
import assert from 'node:assert/strict';
const repo = process.argv[2];
const { errors } = await import('./dom-setup.mjs');
const {db} = await import(`${repo}/js/grist.js`);
const M = await import(`${repo}/js/model.js`);
const wait = ms => new Promise(r => setTimeout(r, ms));
const clean = s => s.replace(/\s+/g, ' ').replace(/[  ]/g, ' ');

const T = {Parametres: [], Taxes: [], Documents_Fiscaux: [{id: 3, Titre: 'Délibération VM 2024', Type_Document: 'Délibérations', Module: 'VM', Fichier: ['L', 12]}],
  Entreprises_RS: [
    {id: 1, Entreprise_ID: 'e1', Raison_Sociale: 'Alpha SARL', Adresse: '1 rue du Port', Commune: 'Mamoudzou', Responsable: 'M. Ali', Etape_Actuelle: 'Relance 2', Notes: 'ancien'},
    {id: 2, Entreprise_ID: 'e2', Raison_Sociale: 'Beta', Etape_Actuelle: ''},
    {id: 3, Entreprise_ID: 'e3', Raison_Sociale: 'Gamma (non titré)'}],
  Suivi_RS_Annuel: [
    {id: 11, Entreprise_ID: 'e1', Exercice: 2025, Situation: 'Titre émis', Montant_Facture: 1200, Montant_Regle: 200, Numero_Titre: 'T-45'},
    {id: 12, Entreprise_ID: 'e2', Exercice: 2025, Situation: 'Titre émis', Montant_Facture: 500, Montant_Regle: 0, Numero_Titre: 'T-46'},
    {id: 13, Entreprise_ID: 'e3', Exercice: 2025, Situation: 'Pas encore titré', Montant_Facture: 300, Montant_Regle: 0}]};
db.status = 'ready'; db.tables = structuredClone(T);
const sent = [];
const columnar = rows => { const o = {id: rows.map(r => r.id)}; for (const k of new Set(rows.flatMap(r => Object.keys(r)))) if (k !== 'id') o[k] = rows.map(r => r[k] ?? null); return o; };
const store = structuredClone(T);
window.grist = globalThis.grist = {docApi: {
  async applyUserActions(a) {
    sent.push(...a);
    for (const x of a) {
      if (x[0] === 'AddTable') store[x[1]] = [];
      if (x[0] === 'BulkAddRecord') { const cols = x[3]; x[2].forEach((_, i) => store[x[1]].push({id: store[x[1]].length + 1, ...Object.fromEntries(Object.keys(cols).map(k => [k, cols[k][i]]))})); }
      if (x[0] === 'UpdateRecord') Object.assign(store[x[1]].find(r => r.id === x[2]), x[3]);
    }
    return {retValues: []};
  },
  async fetchTable(n) { if (!store[n]) throw new Error('KeyError ' + n); return columnar(store[n]); }}};

/* ── Modèle ── */
const checks = M.rateChecks(new Date(2026, 10, 21));
assert.deepEqual(checks.map(c => c.code), ['VM', 'VM', 'CFE', 'GEMAPI'], 'VM 2019 et 2021, plafond CFE, population DGF');
assert.equal(M.rateChecks(new Date(2026, 11, 2)).at(-1).code, 'Vote', 'après le 30 novembre, les taux encore « proposés » sont signalés');
const s0 = M.simulate({TEOM: 17.4, TFPB: 6.71, TFPNB: 3.11, THRS: 11.21}, 2026);
assert.ok(Math.abs(s0.gain - 6994870) < 5, `simulation des propositions = gains DGFiP (${s0.gain})`);
assert.ok(M.simulate({CFE: 19}, 2026).lines.find(l => l.code === 'CFE').overCeiling, 'CFE au-dessus du plafond');
assert.equal(M.referenceSeed().length, 14);
assert.equal(M.paramSeed().length, 4 + 2 + 5, 'gains, plafond CFE, bases');
db.tables.Parametres = [{id: 1, Cle: 'GAIN_TEOM_2027', Valeur: '1 800 000'}, {id: 2, Cle: 'PLAFOND_CFE', Valeur: '18,94'}, {id: 3, Cle: 'POPULATION_DGF', Valeur: '116000'}];
assert.equal(M.proposalGain('TEOM'), 1800000); assert.equal(M.rateCeiling('CFE').toConfirm, false);
assert.deepEqual(M.rateChecks(new Date(2026, 10, 21)).map(c => c.code), ['VM', 'VM'], 'plafond et population confirmés dans Parametres');
db.tables.Parametres = [];
db.tables.Referentiel_Taux = [{id: 1, Code: 'TEOM', A_partir_de: 2016, Taux: 14.4, Statut: 'Voté'}, {id: 2, Code: 'TEOM', A_partir_de: 2027, Taux: 16, Statut: 'Proposé'},
  {id: 3, Code: 'VM', A_partir_de: 2019, Taux: 0.2, Statut: 'Voté'}];
assert.equal(M.rateFor('TEOM', 2027).rate, 16, 'le référentiel Grist fait foi'); assert.ok(M.rateFor('TEOM', 2027).proposed);
assert.equal(M.rateFor('CFE', 2026).rate, 18.04, 'taxe absente du référentiel : valeur du code');
assert.equal(M.rateChecks(new Date(2026, 10, 21)).filter(c => c.code === 'VM').length, 0, 'VM confirmé dans le référentiel');
delete db.tables.Referentiel_Taux;

/* ── Page Taux ── */
const taux = await import(`${repo}/js/pages/taux.js`);
const root = document.createElement('main'); document.body.appendChild(root);
const ctx = {year: 2026, params: new URLSearchParams()};
root.innerHTML = taux.render(ctx); taux.mount(root, ctx);
assert.match(root.querySelector('[data-rate="CFE"].rate-card').textContent, /Inchangé/, 'CFE inchangé depuis 2016');
assert.match(clean(root.querySelector('[data-rate="VM"].rate-card').textContent), /4 taux successifs/);
const chk = clean(root.querySelector('#a-confirmer').textContent);
assert.match(chk, /4 chiffres à confirmer/); assert.match(chk, /Plafond CFE : 18,94 %/); assert.match(chk, /18,62 %/); assert.match(chk, /POPULATION_DGF/);
const simTxt = () => clean(root.querySelector('#simulateur').textContent);
assert.match(simTxt(), /correspond aux propositions/); assert.match(simTxt(), /\+ 6 994 87\d €/);
const teom = root.querySelector('[data-sim="TEOM"]'); teom.value = '15'; teom.dispatchEvent(new Event('input', {bubbles: true}));
assert.match(simTxt(), /Écart avec les propositions soumises au vote : − 1 433 98\d €/);
assert.equal(document.activeElement === teom || root.contains(teom), true, 'le champ n’est pas reconstruit');
const cfe = root.querySelector('[data-sim="CFE"]'); cfe.value = '19'; cfe.dispatchEvent(new Event('input', {bubbles: true}));
assert.ok(root.querySelector('[data-sim="CFE"]').closest('tr').classList.contains('is-over')); assert.match(simTxt(), /au-dessus du plafond 18,94 %/);
root.querySelector('[data-sim-reset]').click(); assert.match(simTxt(), /correspond aux propositions/);
assert.match(clean(root.querySelector('#referentiel').textContent), /14 lignes/);
root.querySelector('[data-ref-create]').click(); await wait(20);
document.querySelector('.modal button.btn-primary').click(); await wait(80);
assert.equal(sent[0][0], 'AddTable'); assert.equal(sent[0][1], 'Referentiel_Taux');
assert.equal(sent[1][0], 'BulkAddRecord'); assert.equal(sent[1][2].length, 14);
assert.equal(sent[2][1], 'Parametres'); assert.ok(sent[2][3].Cle.includes('BASE_TFPB'));
assert.equal(db.tables.Referentiel_Taux.length, 14, 'table relue après création');
assert.equal(M.rateFor('TEOM', 2027).rate, 17.4); assert.ok(M.refInGrist());
root.innerHTML = taux.render(ctx); taux.mount(root, ctx);
assert.ok(!root.querySelector('#referentiel'), 'plus de carte une fois créé'); assert.match(root.textContent, /lus dans Grist/);
root.querySelector('[data-rate="VM"]').click(); await wait(10);
assert.ok(document.querySelector('[role="dialog"] a[href="#/documents?doc=3"]'), 'délibération modifiable depuis la fiche du taux');
document.querySelector('[data-close]')?.click();
assert.ok(!/NaN|undefined|\[object/.test(root.innerHTML));

/* ── Courriers de relance ── */
sent.length = 0;
const fiche = await import(`${repo}/js/pages/fiche.js`);
const fctx = {year: 2026, sub: 'relances', params: new URLSearchParams()};
root.innerHTML = fiche.render(fctx); fiche.mount(root, fctx);
const letters = root.querySelectorAll('.letter');
assert.equal(letters.length, 2, 'les deux dossiers titrés, pas le non titré');
const L1 = clean(letters[0].textContent), L2 = clean(letters[1].textContent);
assert.match(L1, /Alpha SARL/); assert.match(L1, /dernier rappel avant transmission au comptable public/); assert.match(L1, /n° T-45/); assert.match(L1, /1 000,00 €/); assert.match(L1, /1 rue du Port, Mamoudzou/);
assert.match(L2, /Beta/); assert.match(L2, /rappel de paiement/); assert.match(L2, /Adresse à compléter/);
assert.match(clean(root.querySelector('.report-hint').textContent), /1 sans adresse/);
root.querySelector('[data-mark-all]').click(); await wait(20);
document.querySelector('.modal button.btn-primary').click(); await wait(80);
assert.equal(sent.length, 2); assert.equal(sent[0][3].Etape_Actuelle, 'Mise en demeure'); assert.equal(sent[1][3].Etape_Actuelle, 'Relance 1');
assert.match(sent[0][3].Notes, /Mise en demeure envoyée .* 1[\s\u202f\u00a0]000,00[\s\u202f\u00a0]€ relancés \(2025\)\nancien/u);
const one = {year: 2026, sub: 'relances', params: new URLSearchParams('id=e2')};
root.innerHTML = fiche.render(one); assert.equal(root.querySelectorAll('.letter').length, 1);

/* ── Documents : lien direct ── */
const docs = await import(`${repo}/js/pages/documents.js`);
location.hash = '#/documents?doc=3';
root.innerHTML = docs.render({year: 2026, params: new URLSearchParams('doc=3')}); docs.mount(root, {params: new URLSearchParams('doc=3')});
await wait(10);
assert.match(document.querySelector('[role="dialog"]').textContent, /Délibération VM 2024/); assert.equal(location.hash, '#/documents');

assert.deepEqual(errors, []);
console.log('améliorations OK');
