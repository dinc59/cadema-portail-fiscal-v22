import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) console.error(e); });
const repo = process.argv[2];
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {url: 'https://example.test/#/', virtualConsole: vc});
const w = dom.window;
for (const k of ['window','document','HTMLElement','HTMLInputElement','Node','CustomEvent','Event','KeyboardEvent','MutationObserver','getComputedStyle','location','history','navigator','DOMParser'])
  { try { globalThis[k] = k === 'window' ? w : w[k]; } catch {} }
w.matchMedia = globalThis.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}});
globalThis.localStorage = w.localStorage; globalThis.CSS = w.CSS = {escape: s => String(s).replace(/"/g, '\\"')};
globalThis.requestAnimationFrame = w.requestAnimationFrame = fn => setTimeout(fn, 0);
w.HTMLElement.prototype.scrollIntoView = function () { globalThis.__scrolled = this.dataset.rbCard; };
for (const k of ['addEventListener','removeEventListener','dispatchEvent','scrollTo']) globalThis[k] = (w[k] || (() => {})).bind(w);
globalThis.innerWidth = 1280; globalThis.innerHeight = 900; globalThis.scrollY = 0; globalThis.scrollX = 0; globalThis.devicePixelRatio = 1;
globalThis.setTimeout = setTimeout; globalThis.top = globalThis; globalThis.self = globalThis; globalThis.ResizeObserver = class { observe() {} disconnect() {} }; globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
const errors = []; w.addEventListener('error', e => errors.push(e.message));

const {db} = await import(`${repo}/js/grist.js`);
const M = await import(`${repo}/js/model.js`);
db.status = 'ready';
db.tables = {
  Taxes: [{id:1, Code:'CFE', Exercice:2026, Produit:9100000, Statut:'Définitif', Source:'1386 TH'}, {id:2, Code:'CFE', Exercice:2025, Produit:8800000, Statut:'Définitif'},
          {id:3, Code:'TEOM', Exercice:2026, Produit:6200000, Statut:'Prévision'}, {id:4, Code:'VM', Exercice:2026, Produit:3400000, Statut:'Notifié'}],
  Produits_Recettes: [{id:1, Code_Produit:'CFE', Exercice:2026, Prevision:9500000, Realise:9100000}],
  Entreprises_RS: [{id:1, Entreprise_ID:'e1', Raison_Sociale:'Entreprise fictive'}],
  Suivi_RS_Annuel: [{id:1, Entreprise_ID:'e1', Exercice:2026, Situation:'Titre émis', Montant_Facture:42000, Montant_Regle:30000}],
  DGF_Detail: [], FPIC_Repartition: [], Parametres: [],
  Documents_Fiscaux: [{id:1, Titre:'EDET 2025', Type_Document:'EDET', Exercice:2025, Fichier:['L', 7]}],
};
const year = 2026;
const fin = await import(`${repo}/js/pages/finances.js`);
const root = document.createElement('main'); document.body.appendChild(root);
root.innerHTML = fin.render({year, params: new URLSearchParams('tab=recettes')});
fin.mount(root, {year});
const txt = root.textContent;
assert.match(txt, /Recettes 2026 par budget/);
assert.equal(root.querySelectorAll('.rb-kpi').length, 3);
assert.equal(root.querySelectorAll('.rb-card').length, 3);
assert.match(txt, /Budget annexe déchets/); assert.match(txt, /Encaissé 30[\s\u202f]000[\s\u202f]€/u);
assert.ok(!/NaN|undefined|\[object/.test(root.innerHTML), 'aucune valeur cassée affichée');
root.querySelector('[data-rb-jump="Mobilité"]').click();
assert.equal(globalThis.__scrolled, 'Mobilité', 'la carte fait défiler vers le bon budget');
// Export : capture du fichier produit
let blobText = null; const realCreate = w.URL.createObjectURL;
w.URL.createObjectURL = globalThis.URL.createObjectURL = b => { blobText = b; return 'blob:x'; };
w.URL.revokeObjectURL = globalThis.URL.revokeObjectURL = () => {};
root.querySelector('[data-rb-export]').click();
await new Promise(r => setTimeout(r, 20));
const bytes = new Uint8Array(await blobText.arrayBuffer()); assert.deepEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF], 'marque UTF-8 pour Excel'); const csv = await blobText.text();
assert.match(csv, /^Budget;Code;Recette/); assert.match(csv, /Budget annexe mobilité;VM;Versement mobilité;Notifié;;3400000/);
// Copie
let copied = ''; for (const n of [w.navigator, globalThis.navigator]) Object.defineProperty(n, 'clipboard', {value: {writeText: async t => { copied = t; }}, configurable: true});
root.querySelector('[data-rb-copy]').click(); await new Promise(r => setTimeout(r, 20));
assert.match(copied, /Budget principal\tCFE\t/);
// Les autres onglets restent intacts
const r2 = document.createElement('main'); r2.innerHTML = fin.render({year, params: new URLSearchParams('')});
assert.match(r2.textContent, /Budgets et compte financier unique/);

// Documents : grille des états
const docs = await import(`${repo}/js/pages/documents.js`);
const d = document.createElement('main'); document.body.appendChild(d);
d.innerHTML = docs.render({year, params: new URLSearchParams('')}); docs.mount(d);
const now = new Date().getFullYear();
assert.equal(d.querySelectorAll('.sg-y').length, 6);
assert.ok(d.querySelector(`[data-att="7"].is-ok`), 'EDET 2025 ouvrable');
assert.ok(d.querySelector(`[data-state-upload="1259|${now - 1}"].is-missing`));
assert.ok(d.querySelector(`[data-state-upload="EDET|${now}"].is-pending`));
let picked = false; d.querySelector('[data-file]').click = () => { picked = true; };
d.querySelector(`[data-state-upload="EDET|${now - 2}"]`).click();
assert.ok(picked, 'cliquer un manquant ouvre le choix du fichier');
assert.ok(!/NaN|undefined|\[object/.test(d.innerHTML));
assert.deepEqual(errors, []);
console.log('rendu : finances et documents OK');
console.log(root.querySelector('.rb-kpi').textContent.replace(/\s+/g, ' ').trim());
