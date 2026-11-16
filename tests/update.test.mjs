// Lancer : node tests/update.test.mjs "$PWD"
import assert from 'node:assert/strict';
const repo = process.argv[2];
const U = await import(`${repo}/js/update.js`);
const base = 'https://x.test/portail/';
assert.equal(U.publishedVersion("export const CHANGELOG = [\n  {\n    id: '22.16', date: '…'}, {id: '22.15'}"), '22.16');
assert.equal(U.publishedVersion('rien'), null);
assert.deepEqual(U.appFiles([{name: `${base}js/main.js`}, {name: `${base}js/pages/taux.js?x=1`}, {name: `${base}css/app.css`}, {name: 'https://grist.numerique.gouv.fr/grist-plugin-api.js'}, {name: `${base}api/data`}], base),
  [`${base}js/main.js`, `${base}js/pages/taux.js`, `${base}css/app.css`]);
const mkStore = () => { const m = new Map(); return {getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v)}; };
const run = async ({published, current = '22.15', store = mkStore(), ok = true, throws = false}) => {
  const calls = []; let reloaded = 0;
  const fetchFn = async (u, o) => { calls.push([u, o?.cache]); if (throws) throw new Error('offline'); return {ok, text: async () => `{\n id: '${published}'`}; };
  const res = await U.checkForUpdate({current, base, fetchFn, entries: () => [{name: `${base}js/pages/taux.js`}, {name: `${base}css/screens.css`}], storage: store, reload: () => reloaded++});
  return {res, calls, reloaded};
};
// À jour : rien
let r = await run({published: '22.15'});
assert.equal(r.res.reason, 'up-to-date'); assert.equal(r.reloaded, 0); assert.equal(r.calls.length, 1); assert.equal(r.calls[0][1], 'no-store');
// Nouvelle version : chaque fichier redemandé sans cache, puis rechargement
const store = mkStore();
r = await run({published: '22.16', store});
assert.equal(r.res.action, 'reload'); assert.equal(r.reloaded, 1);
const refreshed = r.calls.filter(c => c[1] === 'reload').map(c => c[0]);
for (const f of ['index.html', 'js/main.js', 'js/changelog.js', 'js/pages/taux.js', 'css/screens.css']) assert.ok(refreshed.includes(base + f), f);
// Toujours en retard après rechargement (diffusion GitHub en cours) : pas de boucle
r = await run({published: '22.16', store});
assert.equal(r.res.reason, 'already-tried'); assert.equal(r.reloaded, 0);
// Hors ligne ou GitHub injoignable : on ne touche à rien
assert.equal((await run({published: '22.16', throws: true})).reloaded, 0);
assert.equal((await run({published: '22.16', ok: false})).reloaded, 0);
console.log('mise à jour automatique : tous les contrôles passent');
