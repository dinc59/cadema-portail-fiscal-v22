/* Couche de données V22.
   Une seule règle : les tables Grist sont la seule source de vérité.
   Rien n'est gardé dans un état local qui pourrait contredire le document —
   chaque écriture est suivie d'une relecture de la table concernée. */

export const TABLES = [
  'Utilisateurs', 'Taxes', 'Produits_Recettes', 'Taches', 'Plans_Actions',
  'Documents_Fiscaux', 'Entreprises_RS', 'Suivi_RS_Annuel', 'Employeurs_VM',
  'Etablissements_CFE', 'Calendrier_Fiscal', 'Budgets', 'CFU_Synthese',
  'Parametres', 'DGF_Detail', 'FPIC_Repartition', 'CFE_Synthese',
];

export const db = {
  status: 'loading',      // loading | ready | denied | offline
  tables: {},
  columns: {},
  missing: [],
  syncedAt: null,
  saving: 0,
  error: null,
};

const listeners = new Set();
export const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = reason => listeners.forEach(fn => { try { fn(reason); } catch (e) { console.error(e); } });

export function rows(name) { return db.tables[name] || []; }
export function hasColumn(name, column) { return !!db.columns[name]?.has(column); }

function columnarToRows(table) {
  if (!table || !Array.isArray(table.id)) return [];
  const keys = Object.keys(table).filter(k => Array.isArray(table[k]) && !k.startsWith('gristHelper_'));
  return table.id.map((id, i) => {
    const row = {id};
    for (const k of keys) row[k] = table[k][i];
    return row;
  });
}

async function fetchOne(name) {
  const table = await window.grist.docApi.fetchTable(name);
  db.columns[name] = new Set(Object.keys(table || {}));
  db.tables[name] = columnarToRows(table);
}

let signature = '';
function sig() {
  return TABLES.map(n => `${n}:${(db.tables[n] || []).length}`).join('|') + JSON.stringify(db.tables).length;
}

export async function loadAll({silent = false} = {}) {
  if (!window.grist?.docApi) { db.status = 'offline'; emit('status'); return; }
  const results = await Promise.allSettled(TABLES.map(fetchOne));
  db.missing = TABLES.filter((_, i) => results[i].status === 'rejected');
  if (db.missing.length === TABLES.length) {
    const reason = String(results[0].reason?.message || results[0].reason || '');
    db.status = 'denied';
    db.error = reason;
    emit('status');
    return;
  }
  db.status = 'ready';
  db.syncedAt = new Date();
  const next = sig();
  const changed = next !== signature;
  signature = next;
  if (!silent || changed) emit(silent ? 'refresh' : 'load');
  else emit('sync');
}

export async function refresh(names) {
  await Promise.allSettled(names.map(fetchOne));
  signature = sig();
  db.syncedAt = new Date();
}

/* Écrit dans Grist puis relit les tables touchées. Lance une erreur lisible. */
export async function act(actions, refreshTables) {
  if (!actions.length) return [];
  db.saving++; emit('saving');
  try {
    const result = await window.grist.docApi.applyUserActions(actions);
    const touched = refreshTables || [...new Set(actions.map(a => a[1]))];
    await refresh(touched);
    return result?.retValues || [];
  } catch (error) {
    console.error('Écriture Grist refusée', error);
    throw new Error(friendly(error));
  } finally {
    db.saving--; emit('data');
  }
}

function friendly(error) {
  const text = String(error?.message || error || '');
  if (/access|denied|permission/i.test(text)) return "Grist refuse l'écriture : le widget doit avoir l'accès complet.";
  if (/column|colonne/i.test(text)) return `Colonne manquante dans Grist : ${text}`;
  return text || 'Écriture refusée par Grist';
}

/* Ne garde que les colonnes qui existent vraiment : un document plus ancien
   sans telle colonne ne doit pas faire échouer toute l'écriture. */
export function fieldsFor(table, fields) {
  const cols = db.columns[table];
  return Object.fromEntries(Object.entries(fields)
    .filter(([k, v]) => v !== undefined && (!cols || cols.has(k))));
}

export async function uploadAttachment(file) {
  const token = await window.grist.docApi.getAccessToken({readOnly: false});
  const form = new FormData();
  form.append('upload', file, file.name);
  const url = new URL(`${token.baseUrl.replace(/\/$/, '')}/attachments`);
  url.searchParams.set('auth', token.token);
  const response = await fetch(url, {method: 'POST', body: form, headers: {'X-Requested-With': 'XMLHttpRequest'}});
  if (!response.ok) throw new Error(`Envoi refusé par Grist (${response.status})`);
  const [id] = await response.json();
  if (!Number.isInteger(id)) throw new Error('Grist n’a pas renvoyé de pièce jointe');
  return id;
}

export async function openAttachment(id) {
  const win = window.open('', '_blank');
  try {
    const token = await window.grist.docApi.getAccessToken({readOnly: true});
    const url = new URL(`${token.baseUrl.replace(/\/$/, '')}/attachments/${id}/download`);
    url.searchParams.set('auth', token.token);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Téléchargement refusé (${response.status})`);
    const objectUrl = URL.createObjectURL(await response.blob());
    if (win) win.location.href = objectUrl; else window.open(objectUrl, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
  } catch (error) {
    win?.close();
    throw error;
  }
}

export function attachmentIds(value) {
  if (!Array.isArray(value)) return [];
  return (value[0] === 'L' ? value.slice(1) : value).filter(Number.isInteger);
}

export async function connect() {
  if (!window.grist) { db.status = 'offline'; emit('status'); return; }
  window.grist.ready({requiredAccess: 'full', allowSelectBy: false});
  /* La source du widget est Parametres : toute modification y déclenche une
     relecture. Les autres tables sont relues au retour sur l'onglet et
     toutes les 90 s tant que le portail est visible. */
  let first = true;
  window.grist.onRecords?.(() => { if (!first) loadAll({silent: true}); first = false; });
  await loadAll();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && db.status === 'ready') loadAll({silent: true});
  });
  setInterval(() => {
    if (document.visibilityState === 'visible' && db.status === 'ready' && !db.saving) loadAll({silent: true});
  }, 90000);
}
