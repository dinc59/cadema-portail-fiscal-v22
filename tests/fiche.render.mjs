import assert from 'node:assert/strict';
const repo = process.argv[2];
const { errors } = await import('./dom-setup.mjs');
const {db} = await import(`${repo}/js/grist.js`);
const Y = 2026;
const E = (i, n) => ({id: i, Entreprise_ID: `e${i}`, Raison_Sociale: n});
const S = (id, e, y, sit, f, r, titre = '') => ({id, Entreprise_ID: `e${e}`, Exercice: y, Situation: sit, Montant_Facture: f, Montant_Regle: r, Numero_Titre: titre});
db.status = 'ready';
db.tables = {Parametres: [], Documents_Fiscaux: [], Taxes: [],
  Entreprises_RS: [E(1, 'Alpha'), E(2, 'Bêta'), E(3, 'Gamma'), E(4, 'Delta'), E(5, 'Epsilon')],
  Suivi_RS_Annuel: [S(1, 1, 2025, 'Soldée', 1000, 1000), S(2, 2, 2025, 'Titre émis', 2000, 0, 'T-12'),
    S(3, 1, 2026, 'Soldée', 1200, 1200), S(4, 2, 2026, 'Partiellement réglée', 3000, 1000, 'T-40'), S(5, 3, 2026, 'Titre émis', 500, 0, 'T-41'),
    S(6, 4, 2026, 'Non concernée', 0, 0)]};
const page = await import(`${repo}/js/pages/fiche.js`);
const root = document.createElement('main'); document.body.appendChild(root);
root.innerHTML = page.render({year: Y, sub: 'rs', params: new URLSearchParams('an=2026')});
page.mount(root, {sub: 'rs', params: new URLSearchParams('an=2026'), year: Y});
const t = root.textContent.replace(/\s+/g, ' ');
assert.ok(document.body.classList.contains('is-report'));
assert.match(t, /Redevance spéciale — synthèse 2026/);
assert.match(t, /1 entreprise sur 4 n’a rien payé en 2026/, 'le titre met l’impayé en avant');
const alert = root.querySelector('.fiche-alert').textContent.replace(/\s+/g, ' ');
assert.match(alert, /1 entreprise n’a rien payé : 500 € facturés sans aucun règlement/);
assert.match(alert, /1 a payé en partie : 2[\s ]000 € restent dus/u);
assert.match(alert, /1 dossier sans montant facturé ou sans suivi 2026/);
assert.match(t, /Entreprises à jour\s*33 %\s*1 sur 3 facturées/);
assert.match(t, /\+56,7 % par rapport à 2025/);
const secs = [...root.querySelectorAll('.report-kicker')].map(e => e.textContent.replace(/^\d+\.\s*/, ''));
assert.deepEqual(secs, ['L’essentiel', 'Impayés', 'Paiements partiels', 'Restes à recouvrer', 'Trajectoire', 'Ancienneté', 'Dossiers', 'À qualifier']);
const tables = root.querySelectorAll('.fiche-table');
assert.match(tables[0].querySelector('tbody').textContent, /Gamma.*T-41/); assert.equal(tables[0].querySelectorAll('tbody tr.pay-rien').length, 1);
assert.match(tables[1].querySelector('tbody').textContent, /Bêta.*T-40/);
assert.deepEqual([...root.querySelectorAll('.report-sec')[3].querySelectorAll('.fs-l')].map(e => e.textContent), ['Bêta', 'Gamma']);
assert.match(root.querySelectorAll('.report-sec')[7].textContent, /Epsilon/);
assert.equal(root.querySelectorAll('.fiche-svg').length, 3);
// Sélecteur d'exercice
assert.deepEqual([...root.querySelectorAll('.fiche-years .chip')].map(a => a.textContent), ['2026', '2025']);
assert.ok(root.querySelector('.fiche-years [aria-pressed="true"]').textContent === '2026');
assert.ok(!/NaN|undefined|\[object|Infinity/.test(root.innerHTML));
// Bouton PDF → impression, titre du fichier
let printed = ''; globalThis.print = window.print = () => { printed = document.title; };
root.querySelector('[data-print]').click();
assert.match(printed, /Redevance spéciale 2026 - synthèse CADEMA/);
// Exercice vide : pas de plantage
root.innerHTML = page.render({year: Y, sub: 'rs', params: new URLSearchParams('an=2019')});
assert.ok(!/NaN|undefined|Infinity/.test(root.innerHTML)); assert.match(root.textContent, /sans montant facturé ou sans suivi 2019/);
// Bouton dans Redevance spéciale
const rsPage = await import(`${repo}/js/pages/redevance.js`);
const r2 = document.createElement('main'); r2.innerHTML = rsPage.render({year: Y, params: new URLSearchParams(), sub: ''});
assert.ok(r2.querySelector('a[href="#/fiche/rs?an=2026"]'), 'bouton Synthèse PDF présent');
assert.deepEqual(errors, []);
console.log('synthèse redevance OK');
