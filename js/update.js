/* Mise à jour automatique du portail.
   GitHub Pages autorise les navigateurs à garder chaque fichier 10 minutes :
   après une mise en ligne, un agent pouvait voir l'ancienne version, même en
   rechargeant Grist. Au démarrage et à chaque retour sur l'onglet, le portail
   lit la version publiée (première entrée de changelog.js, sans cache). Si elle
   diffère de la sienne, il redemande à GitHub chacun de ses fichiers en
   contournant le cache, puis se recharge. Une seule tentative par version et
   par session : jamais de rechargement en boucle. */
import { LATEST } from './changelog.js';

const KEY = 'cadema-update-tried';
const EVERY = 5 * 60 * 1000;

/* Version annoncée par le fichier changelog.js publié. */
export function publishedVersion(text) {
  const m = /id:\s*'([^']+)'/.exec(String(text || ''));
  return m ? m[1] : null;
}

/* Fichiers du portail chargés par cette page (mêmes origine et dossier). */
export function appFiles(entries, base) {
  return [...new Set(entries.map(e => String(e.name || e).split('#')[0].split('?')[0])
    .filter(u => u.startsWith(base) && /\.(js|css|woff2|svg|html)$/.test(u)))];
}

/* Dépendances injectables, pour les tests. Renvoie ce qui a été fait. */
export async function checkForUpdate({
  current = LATEST,
  base = new URL('./', document.baseURI).href,
  fetchFn = (...a) => fetch(...a),
  entries = () => performance.getEntriesByType('resource'),
  storage = sessionStorage,
  reload = () => location.reload(),
} = {}) {
  let remote;
  try {
    const r = await fetchFn(`${base}js/changelog.js?v=${Date.now()}`, {cache: 'no-store'});
    if (!r.ok) return {action: 'none', reason: 'unreachable'};
    remote = publishedVersion(await r.text());
  } catch { return {action: 'none', reason: 'offline'}; }
  if (!remote || remote === current) return {action: 'none', reason: 'up-to-date', remote};
  let tried = null;
  try { tried = storage.getItem(KEY); } catch { /* stockage bloqué */ }
  if (tried === remote) return {action: 'none', reason: 'already-tried', remote};
  try { storage.setItem(KEY, remote); } catch { /* stockage bloqué */ }
  const files = [...new Set([`${base}index.html`, `${base}js/main.js`, `${base}js/changelog.js`, ...appFiles(entries(), base)])];
  await Promise.allSettled(files.map(u => fetchFn(u, {cache: 'reload'})));
  reload();
  return {action: 'reload', remote, files: files.length};
}

let last = 0;
export function installUpdateCheck() {
  const run = () => {
    if (Date.now() - last < EVERY) return;
    last = Date.now();
    checkForUpdate().catch(() => {});
  };
  setTimeout(run, 1500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run(); });
}
