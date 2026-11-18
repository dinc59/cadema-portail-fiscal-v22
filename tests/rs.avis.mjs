// Lancer : node tests/rs.avis.mjs "$PWD"
import assert from 'node:assert/strict';
const repo = process.argv[2];
await import('./dom-setup.mjs');
const {db} = await import(`${repo}/js/grist.js`);
const Y = 2026;
const T = {Parametres: [], Documents_Fiscaux: [], Taxes: [],
  Entreprises_RS: [{id: 1, Entreprise_ID: 'e1', Raison_Sociale: 'Alpha', Convention_Fichier: ['L', 7]}],
  Suivi_RS_Annuel: [{id: 5, Entreprise_ID: 'e1', Exercice: Y, Situation: 'Titre émis', Montant_Facture: 100, Montant_Regle: 0, Avis_Fichier: ['L', 9]}]};
db.status = 'ready'; db.tables = structuredClone(T);
const sent = [];
const columnar = rows => { const o = {id: rows.map(r => r.id)}; for (const k of new Set(rows.flatMap(r => Object.keys(r)))) if (k !== 'id') o[k] = rows.map(r => r[k] ?? null); return o; };
window.grist = globalThis.grist = {docApi: {async applyUserActions(a) { sent.push(...a); for (const [, t, id, f] of a) Object.assign(T[t].find(r => r.id === id), f); return {retValues: []}; }, async fetchTable(n) { return columnar(T[n] || []); }}};
const page = await import(`${repo}/js/pages/redevance.js`);
const root = document.createElement('main'); document.body.appendChild(root);
root.innerHTML = page.render({year: Y, params: new URLSearchParams(), sub: ''}); page.mount(root, {year: Y, params: new URLSearchParams(), sub: ''});
root.querySelector('tr[data-open="e1"]').click();
await new Promise(r => setTimeout(r, 30));
const dr = () => document.querySelector('.drawer, [role="dialog"]');
assert.ok(dr().querySelector('[data-att="9"]'), 'l’avis s’ouvre toujours');
assert.ok(dr().querySelector('[data-up="avis"][data-up-row="5"]'), 'bouton Remplacer l’avis');
assert.ok(dr().querySelector('[data-clear="avis"][data-clear-row="5"]'), 'bouton Retirer l’avis');
assert.ok(dr().querySelector('[data-clear="convention"]'), 'bouton Retirer la convention');
dr().querySelector('[data-clear="avis"]').click();
await new Promise(r => setTimeout(r, 30));
const modal = document.querySelector('.modal');
assert.match(modal.textContent, /Retirer l’avis de somme à payer 2026/);
modal.querySelector('button.btn-primary, .btn-danger, [data-ok]')?.click();
await new Promise(r => setTimeout(r, 80));
assert.deepEqual(sent, [['UpdateRecord', 'Suivi_RS_Annuel', 5, {Avis_Fichier: null}]], 'seul le champ de l’avis est vidé');
assert.ok(dr().querySelector('[data-up="avis"][data-up-row="5"]').textContent.includes('Déposer'), 'on peut déposer le bon document');
console.log('avis de redevance : remplacer et retirer OK');
