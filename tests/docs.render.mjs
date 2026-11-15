import assert from 'node:assert/strict';
const repo = process.argv[2];
const { errors } = await import('./dom-setup.mjs');
const {db} = await import(`${repo}/js/grist.js`);
const Y = new Date().getFullYear();
const D = (id, Titre, Type_Document, Exercice, extra = {}) => ({id, Titre, Type_Document, Exercice, Statut: 'Classé', Fichier: ['L', 100 + id], ...extra});
const T = {Documents_Fiscaux: [D(1, 'EDET décembre', 'EDET', Y - 1), D(2, 'EDET janvier', 'EDET', Y - 1), D(3, 'EDET mars', 'EDET', Y - 1),
  D(4, '1259 unique', '1259', Y - 1), D(5, 'Convention X', 'Conventions', Y - 2), D(6, 'Courrier sans année', 'Courriers DGFiP', null)], Parametres: []};
db.status = 'ready'; db.tables = structuredClone(T);
const sent = [];
const columnar = rows => { const o = {id: rows.map(r => r.id)}; for (const k of new Set(rows.flatMap(r => Object.keys(r)))) if (k !== 'id') o[k] = rows.map(r => r[k] ?? null); return o; };
window.grist = globalThis.grist = {docApi: {
  async applyUserActions(a) { sent.push(...a); for (const [, t, id, f] of a) Object.assign(T[t].find(r => r.id === id), f); return {retValues: []}; },
  async fetchTable(n) { return columnar(T[n]); }}};
const docs = await import(`${repo}/js/pages/documents.js`);
const root = document.createElement('main'); document.body.appendChild(root);
const draw = () => { root.innerHTML = docs.render({year: Y, params: new URLSearchParams()}); };
draw(); docs.mount(root);
// Liste : groupée par exercice, le plus récent en haut, « Sans exercice » en dernier
assert.deepEqual([...root.querySelectorAll('.doc-group-h > span:first-child')].map(e => e.textContent), [String(Y - 1), String(Y - 2), 'Sans exercice']);
// Dans l'exercice : 1259 avant EDET, EDET dans l'ordre des mois
assert.deepEqual([...root.querySelector('.doc-group').querySelectorAll('.row-main b')].map(e => e.textContent.trim()), ['1259 unique', 'EDET janvier', 'EDET mars', 'EDET décembre']);
// Filtre par type toujours actif
root.querySelector('[data-type="EDET"]').click();
assert.equal(root.querySelectorAll('.doc').length, 3); assert.equal(root.querySelector('.result-count').textContent, '3 document(s)');
root.querySelector('[data-type=""]').click();
// Grille : une pièce → ouverture directe ; plusieurs → volet
assert.ok(root.querySelector(`.states-grid [data-att="104"]`));
const cell = root.querySelector(`[data-state-open="EDET|${Y - 1}"]`);
assert.match(cell.textContent, /Voir\s*3 pièces/);
cell.click();
let dr = document.querySelector('.drawer, [role="dialog"]');
assert.deepEqual([...dr.querySelectorAll('.piece .row-main b')].map(e => e.textContent), ['EDET janvier', 'EDET mars', 'EDET décembre']);
assert.match(dr.textContent, /Désignez avec l’étoile/);
// Désigner décembre comme récapitulatif
dr.querySelector('[data-recap="1"]').click(); await new Promise(r => setTimeout(r, 50));
assert.deepEqual(sent, [['UpdateRecord', 'Documents_Fiscaux', 1, {Statut: 'Récapitulatif annuel'}]]);
dr = document.querySelector('.drawer, [role="dialog"]');
assert.equal(dr.querySelector('.piece .row-main b').textContent, 'EDET décembre', 'le récapitulatif passe en tête');
assert.ok(dr.querySelector('.piece.is-recap [data-att="101"].btn-primary'));
// En désigner un autre retire le premier : un seul récapitulatif
sent.length = 0; dr.querySelector('[data-recap="2"]').click(); await new Promise(r => setTimeout(r, 50));
assert.deepEqual(sent, [['UpdateRecord', 'Documents_Fiscaux', 1, {Statut: 'Classé'}], ['UpdateRecord', 'Documents_Fiscaux', 2, {Statut: 'Récapitulatif annuel'}]]);
draw();
assert.match(root.querySelector(`[data-state-open="EDET|${Y - 1}"]`).textContent, /Récapitulatif\s*3 pièces/);
assert.ok(!/NaN|undefined|\[object/.test(root.innerHTML + dr.innerHTML));
assert.deepEqual(errors, []);
console.log('rendu documents OK');
