import assert from 'node:assert/strict';
const repo = process.argv[2];
await import('./dom-setup.mjs');
const {db} = await import(`${repo}/js/grist.js`);
const Y = 2026;
const T = {Parametres: [], Documents_Fiscaux: [], Taxes: [],
  Entreprises_RS: [1, 2, 3].map(i => ({id: i, Entreprise_ID: `e${i}`, Raison_Sociale: `E${i}`})),
  Suivi_RS_Annuel: [
    {id: 1, Entreprise_ID: 'e1', Exercice: Y, Situation: 'Titre émis', Montant_Facture: 100, Montant_Regle: 100},   // payé, soldable
    {id: 2, Entreprise_ID: 'e2', Exercice: Y, Situation: 'Titre émis', Montant_Facture: 100, Montant_Regle: 0},     // impayé
    {id: 3, Entreprise_ID: 'e3', Exercice: Y, Situation: 'Partiellement réglée', Montant_Facture: 100, Montant_Regle: 40}]};
db.status = 'ready'; db.tables = structuredClone(T);
const sent = [];
const columnar = rows => { const o = {id: rows.map(r => r.id)}; for (const k of new Set(rows.flatMap(r => Object.keys(r)))) if (k !== 'id') o[k] = rows.map(r => r[k] ?? null); return o; };
window.grist = globalThis.grist = {docApi: {async applyUserActions(a) { sent.push(...a); return {retValues: []}; }, async fetchTable(n) { return columnar(T[n] || []); }}};
const page = await import(`${repo}/js/pages/redevance.js`);
const root = document.createElement('main'); document.body.appendChild(root);
root.innerHTML = page.render({year: Y, params: new URLSearchParams(), sub: ''}); page.mount(root, {year: Y, params: new URLSearchParams(), sub: ''});
const pick = ids => { for (const id of ids) { const c = root.querySelector(`[data-sel="${id}"]`); c.checked = true; c.dispatchEvent(new window.Event('change', {bubbles: true})); } };
const choose = sit => { const s = root.querySelector('[data-bulk-sit]'); s.value = sit; s.dispatchEvent(new window.Event('change', {bubbles: true})); };
const confirmIfAny = async () => { await new Promise(r => setTimeout(r, 20)); const m = document.querySelector('.modal'); const txt = m?.textContent || ''; m?.querySelector('button.btn-primary, [data-ok]')?.click(); await new Promise(r => setTimeout(r, 50)); return txt; };
pick(['e1', 'e2', 'e3']); choose('Soldée');
root.querySelector('[data-bulk-apply]').click();
const msg = await confirmIfAny();
assert.match(msg, /Passer 1 dossier en « Soldée »/); assert.match(msg, /2 autres dossiers sélectionnés ne sont pas soldés/);
assert.equal(sent.length, 1, 'seul le dossier payé est modifié');
assert.equal(sent[0][2], 1);
assert.ok(!('Montant_Regle' in sent[0][3]), 'aucun encaissement créé');
assert.equal(sent[0][3].Situation, 'Soldée');
console.log('soldée en série OK');
