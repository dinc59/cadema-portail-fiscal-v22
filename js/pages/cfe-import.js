/* Import du suivi terrain CFE (Excel ou CSV) vers Etablissements_CFE.
   Trois temps dans un même tiroir : le fichier, les colonnes (devinées puis
   corrigeables), l'aperçu et l'écriture. Un local est reconnu par son
   identifiant, sinon par son SIRET complété de sa section, sa parcelle ou
   son adresse : une entreprise peut occuper plusieurs locaux, chacun reste
   une ligne distincte. Une ligne déjà connue est mise à jour, jamais dupliquée.
   L'import entier peut être annulé juste après. */
import * as M from '../model.js';
import { rows, act, fieldsFor, refresh } from '../grist.js';
import { esc, attr, icon, fmt, openDrawer, patchDrawer, closeDrawer, toast } from '../ui.js';
import { readSheets, excelDate } from '../sheets.js';

export const CFE_FIELDS = [
  ['Etablissement_ID', 'Identifiant', ['identifiant', 'id', 'reference', 'ref', 'numero', 'n']],
  ['Raison_Sociale', 'Raison sociale', ['raison sociale', 'nom', 'denomination', 'entreprise', 'enseigne', 'occupant', 'societe', 'redevable']],
  ['SIRET', 'SIRET', ['siret']],
  ['SIREN', 'SIREN', ['siren']],
  ['Adresse', 'Adresse', ['adresse', 'adresse du local', 'voie', 'rue', 'localisation']],
  ['Commune', 'Commune', ['commune', 'ville', 'localite', 'village']],
  ['Section', 'Section cadastrale', ['section']],
  ['Parcelle', 'Parcelle', ['parcelle', 'numero de parcelle', 'cadastre', 'reference cadastrale']],
  ['Nature_Local', 'Nature du local', ['nature', 'nature du local', 'type de local', 'type']],
  ['Affectation', 'Affectation', ['affectation', 'usage', 'activite']],
  ['Categorie', 'Catégorie', ['categorie', 'cat']],
  ['Proprietaire', 'Propriétaire', ['proprietaire', 'bailleur']],
  ['Valeur_Locative', 'Valeur locative', ['valeur locative', 'vl', 'vlc', 'vlb']],
  ['Base_Nette', 'Base nette', ['base nette', 'base imposable', 'base']],
  ['Taux_CFE', 'Taux CFE', ['taux', 'taux cfe']],
  ['Produit_Theorique', 'Produit théorique', ['produit theorique', 'produit', 'cotisation', 'montant', 'cfe due']],
  ['ZFANG', 'ZFANG', ['zfang', 'zone franche', 'zfu']],
  ['Statut_Terrain', 'Statut terrain', ['statut', 'statut terrain', 'etat', 'situation', 'resultat', 'resultat visite', 'constat', 'occupation']],
  ['Binome', 'Binôme', ['binome', 'agents', 'agent', 'equipe', 'controleur']],
  ['Derniere_Visite', 'Date de visite', ['date visite', 'date de visite', 'visite', 'date de passage', 'derniere visite', 'date']],
  ['Notes', 'Observations', ['observations', 'observation', 'commentaire', 'commentaires', 'notes', 'remarque', 'remarques']],
];
const NUMERIC = new Set(['Valeur_Locative', 'Base_Nette', 'Produit_Theorique']);
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const digits = s => String(s ?? '').replace(/\D/g, '');

/* Associe chaque colonne du fichier au champ le plus probable : nom exact
   d'abord, puis nom contenu dans l'en-tête ; une colonne ne sert qu'une fois. */
function guess(header) {
  const map = {};
  const used = new Set();
  const cands = [];
  header.forEach((h, i) => {
    const n = norm(h);
    for (const [key, , syn] of CFE_FIELDS) {
      for (const s of syn) {
        if (n === s) cands.push({key, i, score: 3 + s.length / 100});
        else if (s.length > 2 && (` ${n} `).includes(` ${s} `)) cands.push({key, i, score: 1 + s.length / 100});
      }
    }
  });
  cands.sort((a, b) => b.score - a.score);
  for (const c of cands) if (!(c.key in map) && !used.has(c.i)) { map[c.key] = c.i; used.add(c.i); }
  return map;
}

function convert(key, v) {
  if (v === null || v === undefined || v === '') return null;
  if (key === 'Derniere_Visite') return excelDate(v);
  if (key === 'SIRET' || key === 'SIREN') {
    const d = digits(v);
    if (key === 'SIRET' && d.length === 14) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9, 12)} ${d.slice(12)}`;
    if (key === 'SIREN' && d.length === 9) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}`;
    return String(v);
  }
  if (NUMERIC.has(key)) { const n = M.num(typeof v === 'string' ? v.replace(/[€\s]/g, '') : v); return n ?? String(v); }
  if (key === 'Taux_CFE' && typeof v === 'number') return v;
  return typeof v === 'string' ? v : String(v);
}

/* Clé d'un local : SIRET + emplacement (section et parcelle, sinon adresse).
   Sans emplacement, la clé est le SIRET seul : plusieurs locaux peuvent la
   partager, ils sont alors rapprochés dans l'ordre (voir plan()). */
export function localKey(rec) {
  const d = digits(rec.SIRET);
  if (d.length !== 14) return null;
  const cad = [rec.Section, rec.Parcelle].map(v => norm(v ?? '')).filter(Boolean).join('-');
  const where = cad || norm(rec.Adresse ?? '');
  return `siret:${d}${where ? `|${where}` : ''}`;
}
const idKey = rec => rec.Etablissement_ID ? `id:${norm(rec.Etablissement_ID)}` : null;

let state = null;

function stepFile() {
  return `<div class="import-drop" data-drop>
      <span class="import-ic">${icon('upload', 22)}</span>
      <b>Déposez le fichier du suivi terrain</b>
      <span>Excel (.xlsx) ou CSV. Le fichier est lu dans votre navigateur : il n’est envoyé nulle part, seules les lignes validées sont écrites dans Grist.</span>
      <button class="btn btn-primary" data-pick>${icon('folder', 16)}Choisir un fichier</button>
      <input type="file" hidden data-file accept=".xlsx,.csv,.txt">
    </div>
    <p class="field-hint mt">Une ligne par local ou établissement, avec une ligne d’en-têtes (raison sociale, SIRET, adresse, statut, date de visite…). Les colonnes sont reconnues automatiquement et restent modifiables.</p>`;
}

function preview() {
  const {sheet, map} = state;
  const recs = sheet.rows.slice(0, 5).map(r => Object.fromEntries(Object.entries(map).map(([k, i]) => [k, convert(k, r[i])])));
  const keys = CFE_FIELDS.filter(([k]) => k in map);
  if (!keys.length) return '<p class="muted">Associez au moins une colonne.</p>';
  return `<div class="table-wrap mini"><table class="t import-prev"><thead><tr>${keys.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead>
    <tbody>${recs.map(rec => `<tr>${keys.map(([k]) => `<td>${rec[k] === null ? '<span class="miss">—</span>' : esc(NUMERIC.has(k) && typeof rec[k] === 'number' ? fmt.eur(rec[k]) : rec[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/* Rapprochement fichier → table.
   - Identifiant présent dans le fichier : il fait foi.
   - Sinon, clé SIRET + emplacement. Quand plusieurs lignes du fichier ont la
     même clé (une entreprise, plusieurs locaux sans adresse ni parcelle), la
     n-ième ligne du fichier est rapprochée du n-ième local connu de cette
     clé : aucun local n'est perdu, et réimporter le même fichier ne crée pas
     de doublon.
   - Seule une ligne strictement identique à une précédente est ignorée. */
export function plan() {
  const {sheet, map} = state;
  const byId = new Map(), byLocal = new Map();
  for (const r of [...rows('Etablissements_CFE')].sort((a, b) => a.id - b.id)) {
    const i = idKey(r); if (i) byId.set(i, r);
    const l = localKey(r); if (l) { if (!byLocal.has(l)) byLocal.set(l, []); byLocal.get(l).push(r); }
  }
  const recs = [];
  const sigs = new Set();
  let skip = 0;
  for (const r of sheet.rows) {
    const rec = Object.fromEntries(Object.entries(map).map(([k, i]) => [k, convert(k, r[i])]));
    if (!Object.values(rec).some(v => v !== null)) { skip++; continue; }
    const sig = JSON.stringify(rec);
    if (sigs.has(sig)) { skip++; continue; }
    sigs.add(sig);
    recs.push(rec);
  }
  const perKey = new Map();
  for (const rec of recs) { const l = !idKey(rec) && localKey(rec); if (l) perKey.set(l, (perKey.get(l) || 0) + 1); }
  const occ = new Map(), taken = new Set();
  let add = 0, upd = 0, shared = 0;
  const items = [];
  for (const rec of recs) {
    let cur = null;
    const i = idKey(rec);
    if (i) cur = byId.get(i) || null;
    else {
      const l = localKey(rec);
      if (l) {
        const n = occ.get(l) || 0; occ.set(l, n + 1);
        cur = (byLocal.get(l) || []).filter(r => !taken.has(r.id))[0] || null;
        if (perKey.get(l) > 1) shared++;
      }
    }
    if (cur) taken.add(cur.id);
    cur ? upd++ : add++;
    items.push({rec, cur});
  }
  return {items, add, upd, skip, shared};
}
export const _setState = s => { state = s; };

function stepMap() {
  const {sheet, sheets, map, file} = state;
  const p = plan();
  const opt = i => `<option value="${i}"`;
  return `
    <div class="import-file">${icon('file', 18)}<span class="row-main"><b>${esc(file.name)}</b><span>${sheet.rows.length} ligne(s) · ${sheet.header.length} colonne(s)${sheets.length > 1 ? ` · feuille « ${esc(sheet.name)} »` : ''}</span></span>
      ${sheets.length > 1 ? `<select data-sheet aria-label="Feuille">${sheets.map((s, i) => `<option value="${i}"${s === sheet ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` : ''}
      <button class="btn btn-sm btn-ghost" data-restart>Changer de fichier</button></div>

    <p class="form-section">Colonnes</p>
    <div class="map-grid">
      ${CFE_FIELDS.map(([k, l]) => `<label class="map-row${k in map ? ' on' : ''}"><span>${esc(l)}</span>
        <select data-map="${k}"><option value="">— ignorer —</option>${sheet.header.map((h, i) => `${opt(i)}${map[k] === i ? ' selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`).join('')}
    </div>

    <p class="form-section">Aperçu des 5 premières lignes</p>
    <div data-preview>${preview()}</div>

    <div class="import-plan mt" data-plan>
      <span><b class="num">${p.add}</b> à ajouter</span>
      <span><b class="num">${p.upd}</b> à mettre à jour</span>
      <span class="muted"><b class="num">${p.skip}</b> ignorée(s) : vides ou strictement identiques dans le fichier</span>
      ${p.shared ? `<span class="tone-warn"><b class="num">${p.shared}</b> locaux partagent un SIRET sans section, parcelle ni adresse : chacun est gardé, rapprochés dans l’ordre du fichier. Ajoutez une colonne d’adresse ou de parcelle pour les distinguer sûrement.</span>` : ''}
    </div>
    <p class="field-hint">Une ligne est reconnue comme déjà présente par son identifiant, sinon par son SIRET : elle est alors mise à jour, jamais dupliquée. La synthèse de campagne (CFE_Synthese) est recalculée.</p>`;
}

function footer() {
  if (!state?.sheet) return `<button class="btn btn-ghost" data-close>Fermer</button>`;
  const p = plan();
  return `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-run${p.items.length ? '' : ' disabled'}>${icon('upload', 15)}Importer ${p.items.length} ligne(s)</button>`;
}

function draw() {
  patchDrawer({body: state?.sheet ? stepMap() : stepFile(), footer: footer()});
}

async function load(file) {
  try {
    const sheets = await readSheets(file);
    if (!sheets.length) throw new Error('Aucune donnée trouvée dans ce fichier');
    const sheet = sheets.slice().sort((a, b) => b.rows.length - a.rows.length)[0];
    state = {file, sheets, sheet, map: guess(sheet.header)};
    draw();
  } catch (err) { toast(err.message, 'error'); }
}

async function run(btn) {
  const p = plan();
  if (!p.items.length) return;
  btn.disabled = true;
  const label = btn.innerHTML;
  const nextId = (() => { let n = Math.max(0, ...rows('Etablissements_CFE').map(r => Number(String(r.Etablissement_ID || '').replace(/\D/g, '')) || 0)); return () => `CFE-${String(++n).padStart(4, '0')}`; })();
  const undo = [];
  /* La synthèse est réécrite par l'import : on garde l'ancienne pour l'annulation. */
  const synth = rows('CFE_Synthese')[0];
  const synthBackup = synth ? ['UpdateRecord', 'CFE_Synthese', synth.id, fieldsFor('CFE_Synthese', Object.fromEntries(['Nom_Fichier', 'Nombre_Lignes', 'Importe_Le', 'Visites', 'Exploites', 'Vacants', 'A_Revoir'].map(k => [k, synth[k] ?? null])))] : null;
  const actions = p.items.map(({rec, cur}) => {
    if (cur) {
      const fields = fieldsFor('Etablissements_CFE', Object.fromEntries(Object.entries(rec).filter(([, v]) => v !== null)));
      undo.push(['UpdateRecord', 'Etablissements_CFE', cur.id, Object.fromEntries(Object.keys(fields).map(k => [k, cur[k] ?? null]))]);
      return ['UpdateRecord', 'Etablissements_CFE', cur.id, fields];
    }
    return ['AddRecord', 'Etablissements_CFE', null, fieldsFor('Etablissements_CFE', {...rec, Etablissement_ID: rec.Etablissement_ID || nextId()})];
  });
  try {
    /* Par paquets : Grist reste fluide et la progression s'affiche. */
    for (let i = 0; i < actions.length; i += 100) {
      btn.innerHTML = `${icon('refresh', 15)}Écriture… ${Math.min(actions.length, i + 100)} / ${actions.length}`;
      const chunk = actions.slice(i, i + 100);
      const ret = await act(chunk, []);
      chunk.forEach((a, j) => { if (a[0] === 'AddRecord' && Number.isInteger(ret[j])) undo.push(['RemoveRecord', 'Etablissements_CFE', ret[j]]); });
    }
    await refresh(['Etablissements_CFE']);
    await syncSynthese(state.file.name);
    const n = actions.length;
    closeDrawer();
    toast(`${p.add} ajoutée(s), ${p.upd} mise(s) à jour dans Etablissements_CFE`, 'ok', {
      action: 'Annuler l’import', timeout: 12000,
      onAction: async () => {
        try {
          for (let i = 0; i < undo.length; i += 100) await act(undo.slice(i, i + 100), []);
          /* La dernière écriture relit les deux tables et redessine la page. */
          if (synthBackup) await act([synthBackup], ['CFE_Synthese', 'Etablissements_CFE']);
          else await syncSynthese(null);
          toast(`Import annulé (${n} ligne(s))`, 'info');
        } catch (err) { toast(err.message, 'error'); }
      },
    });
  } catch (err) { toast(err.message, 'error'); btn.disabled = false; btn.innerHTML = label; }
}

/* Statistiques de campagne calculées à partir des établissements. */
export function terrainStats() {
  const list = rows('Etablissements_CFE');
  const s = v => norm(v);
  const visited = list.filter(r => r.Derniere_Visite || /exploit|vacant|revoir|ferme|occupe|visite/.test(s(r.Statut_Terrain)));
  return {
    total: list.length,
    visites: visited.length,
    exploites: list.filter(r => /exploit|occupe|actif/.test(s(r.Statut_Terrain))).length,
    vacants: list.filter(r => /vacant|vide|libre/.test(s(r.Statut_Terrain))).length,
    revoir: list.filter(r => /revoir|a voir|verifier|doute/.test(s(r.Statut_Terrain))).length,
  };
}

async function syncSynthese(fileName) {
  const st = terrainStats();
  const cur = rows('CFE_Synthese')[0];
  const fields = fieldsFor('CFE_Synthese', {
    Nombre_Lignes: st.total, Visites: st.visites, Exploites: st.exploites, Vacants: st.vacants, A_Revoir: st.revoir,
    ...(fileName ? {Nom_Fichier: fileName, Importe_Le: M.toGristDate(new Date())} : {}),
  });
  if (!st.total && !fileName) return;
  await act([cur ? ['UpdateRecord', 'CFE_Synthese', cur.id, fields] : ['AddRecord', 'CFE_Synthese', null, {...fields, ...fieldsFor('CFE_Synthese', {Synthese_ID: 'cfe-current'})}]]);
}

export function openImport() {
  state = null;
  openDrawer({
    id: 'cfe-import', wide: true, title: 'Importer le suivi terrain CFE', subtitle: 'Vers la table Etablissements_CFE',
    body: stepFile(), footer: footer(),
    onMount(el) {
      el.addEventListener('click', e => {
        if (e.target.closest('[data-pick]')) el.querySelector('[data-file]').click();
        if (e.target.closest('[data-restart]')) { state = null; draw(); }
        const run_ = e.target.closest('[data-run]');
        if (run_) run(run_);
      });
      el.addEventListener('change', e => {
        if (e.target.matches('[data-file]')) { const f = e.target.files[0]; e.target.value = ''; if (f) load(f); return; }
        if (e.target.matches('[data-sheet]')) { state.sheet = state.sheets[Number(e.target.value)]; state.map = guess(state.sheet.header); draw(); return; }
        const m = e.target.closest('[data-map]');
        if (m) {
          const k = m.dataset.map;
          if (m.value === '') delete state.map[k];
          else {
            const i = Number(m.value);
            for (const [kk, ii] of Object.entries(state.map)) if (ii === i && kk !== k) delete state.map[kk];
            state.map[k] = i;
          }
          draw();
        }
      });
      el.addEventListener('dragover', e => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); el.querySelector('[data-drop]')?.setAttribute('data-over', ''); } });
      el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.querySelector('[data-drop]')?.removeAttribute('data-over'); });
      el.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) load(f); });
    },
  });
}

/* Pour les tests : charge un fichier sans passer par le sélecteur. */
export const _loadForTest = load;
