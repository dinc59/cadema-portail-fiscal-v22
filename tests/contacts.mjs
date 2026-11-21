// Lancer : node tests/contacts.mjs "$PWD"
import assert from 'node:assert/strict';
const repo = process.argv[2];
const { errors } = await import('./dom-setup.mjs');
const {db} = await import(`${repo}/js/grist.js`);
const M = await import(`${repo}/js/model.js`);
const wait = ms => new Promise(r => setTimeout(r, ms));
const clean = s => s.replace(/\s+/g, ' ').replace(/[  ]/g, ' ');
const store = {Parametres: [], Taxes: [], Documents_Fiscaux: [], Entreprises_RS: [], Suivi_RS_Annuel: []};
db.status = 'ready'; db.tables = structuredClone(store);
const sent = [];
const cols = {};
const columnar = (rows, n) => { const o = {id: rows.map(r => r.id)}; for (const k of cols[n] || []) o[k] = rows.map(r => r[k] ?? null); for (const k of new Set(rows.flatMap(r => Object.keys(r)))) if (k !== 'id') o[k] = rows.map(r => r[k] ?? null); return o; };
window.grist = globalThis.grist = {docApi: {
  async applyUserActions(a) { const ret = []; sent.push(...a); for (const x of a) {
    if (x[0] === 'AddTable') { store[x[1]] = []; cols[x[1]] = x[2].map(c => c.id); ret.push(null); }
    if (x[0] === 'AddRecord') { const id = store[x[1]].length + 1; store[x[1]].push({id, ...x[3]}); ret.push(id); }
    if (x[0] === 'UpdateRecord') { Object.assign(store[x[1]].find(r => r.id === x[2]), x[3]); ret.push(null); }
    if (x[0] === 'RemoveRecord') { store[x[1]] = store[x[1]].filter(r => r.id !== x[2]); ret.push(null); }
  } return {retValues: ret}; },
  async fetchTable(n) { if (!store[n]) throw new Error('KeyError'); return columnar(store[n], n); }}};
navigator.clipboard ??= {}; let clip = ''; Object.defineProperty(navigator, 'clipboard', {value: {writeText: async t => { clip = t; }}, configurable: true});

assert.equal(M.intlPhone('0639 12 34 56'), '+262639123456'); assert.equal(M.intlPhone('0269 61 00 00'), '+262269610000'); assert.equal(M.intlPhone('06 12 34 56 78'), '+33612345678');
assert.equal(M.prettyPhone('0639123456'), '0639 12 34 56'); assert.equal(M.prettyPhone('0612345678'), '06 12 34 56 78');
const j = M.parseJournal('21/11/2026 · Appel · point sur la CFE (Dina)\nvieille note');
assert.equal(j[0].kind, 'Appel'); assert.equal(j[0].date.getDate(), 21); assert.equal(j[1].text, 'vieille note');

const page = await import(`${repo}/js/pages/contacts.js`);
const root = document.createElement('main'); document.body.appendChild(root);
const ctx = {year: 2026, params: new URLSearchParams()};
root.innerHTML = page.render(ctx); page.mount(root, ctx);
assert.match(root.textContent, /Tous vos interlocuteurs/);
root.querySelector('[data-ct-create]').click(); await wait(250);
assert.equal(sent[0][0], 'AddTable'); assert.equal(sent[0][1], 'Contacts'); assert.ok(M.contactsReady());
const form = () => document.querySelector('#ct-form');
assert.ok(form(), 'le formulaire s’ouvre après création');
const set = (n, v) => { const el = form().querySelector(`[name="${n}"]`); if (el.type === 'checkbox') el.checked = v; else el.value = v; };
set('Prenom', 'Awa'); set('Nom', 'Fictive'); set('Fonction', 'Comptable public'); set('Organisme', 'SGC test'); set('Categorie', 'DGFiP & comptable public');
set('Email', 'awa@example.test'); set('Mobile', '0639 11 22 33'); set('Sujets', 'CFE, TEOM'); set('Favori', true); set('Prochain_Suivi', '2020-01-15');
document.querySelector('[data-ct-save]').click(); await wait(80);
const add = sent.find(a => a[0] === 'AddRecord');
assert.equal(add[3].Nom, 'Fictive'); assert.equal(add[3].Favori, true); assert.equal(add[3].Ajoute_Par, 'Portail'); assert.ok(add[3].Prochain_Suivi > 0);
const dr = () => document.querySelector('[role="dialog"]');
let d = clean(dr().textContent);
assert.match(d, /Awa Fictive/); assert.match(d, /Comptable public/); assert.match(d, /Suivi en retard/); assert.match(d, /0639 11 22 33/);
assert.equal(dr().querySelector('a[href^="https://wa.me/"]').getAttribute('href'), 'https://wa.me/262639112233');
assert.equal(dr().querySelector('.ct-act[href^="tel:"]').getAttribute('href'), 'tel:+262639112233');
dr().querySelector('[data-copy-all]').click(); await wait(10); assert.match(clip, /Awa Fictive\nComptable public — SGC test/);
const lf = dr().querySelector('#ct-log'); lf.querySelector('[name="note"]').value = 'Point sur les rôles TEOM'; lf.querySelector('[name="kind"]').value = 'Réunion';
lf.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true})); await wait(80);
const up = sent.filter(a => a[0] === 'UpdateRecord').at(-1);
assert.match(up[3].Notes, /^\d{2}\/\d{2}\/\d{4} · Réunion · Point sur les rôles TEOM$/); assert.ok(up[3].Dernier_Echange);
assert.match(clean(dr().textContent), /Dernier échange aujourd’hui/); assert.match(clean(dr().textContent), /RéunionPoint sur les rôles TEOM/);
const v = M.vcard(M.contacts()[0]); assert.match(v, /BEGIN:VCARD/); assert.match(v, /TEL;TYPE=CELL:\+262639112233/); assert.match(v, /ORG:SGC test/);
document.querySelector('[data-close]').click(); await wait(250);
root.innerHTML = page.render(ctx); page.mount(root, ctx);
const t = clean(root.textContent);
assert.match(t, /DGFiP & comptable public/); assert.equal(root.querySelectorAll('.ct-card').length, 1); assert.ok(root.querySelector('.ct-card.is-late'));
root.querySelector('.search-field input').value = 'urssaf'; root.querySelector('.search-field input').dispatchEvent(new Event('input'));
assert.equal(root.querySelectorAll('.ct-card').length, 0);
root.querySelector('.search-field input').value = 'teom'; root.querySelector('.search-field input').dispatchEvent(new Event('input'));
assert.equal(root.querySelectorAll('.ct-card').length, 1, 'recherche par sujet');
/* Doublon */
assert.ok(M.contactDuplicate({Email: 'AWA@example.test'}), 'doublon par e-mail');
assert.ok(!/NaN|undefined|\[object/.test(root.innerHTML));
assert.deepEqual(errors, []);
console.log('contacts OK');
