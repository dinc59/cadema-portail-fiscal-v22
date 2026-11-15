import * as M from '../model.js';
import { rows, act, fieldsFor, uploadAttachment, openAttachment, attachmentIds } from '../grist.js';
import { esc, attr, icon, fmt, badge, empty, openDrawer, closeDrawer, toast, field, select, formData, confirmDialog, flash } from '../ui.js';
import { author } from '../main.js';

const st = {q: '', type: '', year: ''};
/* Type et exercice proposés quand on dépose depuis la grille des états. */
let preset = null;
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const typeIcon = t => /1259|1386|EDET|EDAC/.test(t) ? 'table' : /onvention|élib/i.test(t) ? 'edit' : /ourrier/i.test(t) ? 'mail' : 'file';

const DOC_COLS = ['Document_ID', 'Type_Document', 'Exercice', 'Titre', 'Module', 'Fichier', 'Lien', 'Confidentialite', 'Ajoute_Par', 'Date_Ajout', 'Version', 'Statut', 'Taille_Octets'];
function orphans() {
  const all = rows('Documents_Fiscaux');
  const used = new Set(all.filter(r => M.text(r.Titre)).flatMap(r => attachmentIds(r.Fichier)));
  const empties = all.filter(r => !M.text(r.Titre));
  return {
    safe: empties.filter(r => attachmentIds(r.Fichier).every(id => used.has(id))),
    owned: empties.filter(r => attachmentIds(r.Fichier).some(id => !used.has(id))),
  };
}
/* Copie d'une ligne, pour pouvoir la recréer en cas d'annulation. */
const backupRow = r => fieldsFor('Documents_Fiscaux', Object.fromEntries(DOC_COLS.map(k => [k, k === 'Fichier' ? (attachmentIds(r.Fichier).length ? ['L', ...attachmentIds(r.Fichier)] : null) : r[k] ?? null])));

function list() {
  const words = norm(st.q).split(/\s+/).filter(Boolean);
  return M.documents().filter(d => (!st.type || d.type === st.type) && (!st.year || String(d.year) === st.year) &&
    (!words.length || words.every(w => norm(`${d.title} ${d.type} ${d.year} ${d.author}`).includes(w))));
}
function items(docs) {
  if (!docs.length) return empty('Aucun document', 'Aucun document ne correspond à ces critères.');
  return docs.map(d => {
    const ids = attachmentIds(d.file);
    return `<div class="doc" data-doc="${d.rowId}">
      <span class="doc-ic">${icon(typeIcon(d.type), 18)}</span>
      <span class="row-main"><b>${esc(d.title)}</b><span>${esc([d.type, d.year ? `exercice ${d.year}` : '', fmt.size(d.size), d.added ? `ajouté ${fmt.date(d.added)}` : '', d.author].filter(Boolean).join(' · '))}</span></span>
      ${ids.length ? `<button class="btn btn-sm btn-ghost" data-att="${ids[0]}">${icon('external', 14)}Ouvrir</button>` : d.link ? `<a class="btn btn-sm btn-ghost" href="${attr(d.link)}" target="_blank" rel="noopener noreferrer">${icon('external', 14)}Lien</a>` : '<span class="muted">Sans fichier</span>'}
      <button class="icon-btn doc-edit" data-doc-edit="${d.rowId}" aria-label="Modifier ${attr(d.title)}" data-tip="Modifier">${icon('edit', 15)}</button>
    </div>`;
  }).join('');
}

/* Grille des états fiscaux : un exercice par ligne, un état par colonne.
   Un état manquant d'un exercice clos est signalé ; l'exercice en cours
   peut ne pas être encore notifié. */
function statesCard() {
  const current = new Date().getFullYear();
  const grid = M.statesGrid(current);
  const missing = M.missingStates(current);
  const cell = (c, y) => {
    if (c.docs.length) {
      const d = c.docs[0], ids = attachmentIds(d.file);
      const more = c.docs.length > 1 ? `<span class="sg-n">${c.docs.length} pièces</span>` : '';
      const label = `${esc(c.type)} ${y}`;
      if (ids.length) return `<button class="sg-c is-ok" data-att="${ids[0]}" aria-label="Ouvrir ${label}">${icon('check', 15)}<span>Ouvrir</span>${more}</button>`;
      if (d.link) return `<a class="sg-c is-ok" href="${attr(d.link)}" target="_blank" rel="noopener noreferrer" aria-label="Ouvrir ${label}">${icon('external', 15)}<span>Lien</span>${more}</a>`;
      return `<button class="sg-c is-ok" data-doc-edit="${d.rowId}" aria-label="${label} classé sans fichier">${icon('check', 15)}<span>Sans fichier</span>${more}</button>`;
    }
    const closed = y < current;
    return `<button class="sg-c ${closed ? 'is-missing' : 'is-pending'}" data-state-upload="${attr(`${c.type}|${y}`)}" aria-label="Déposer ${esc(c.type)} ${y}">${icon(closed ? 'alert' : 'upload', 15)}<span>${closed ? 'Manquant' : 'À recevoir'}</span></button>`;
  };
  return `<article class="card mt states-card">
    <div class="card-head"><div><p class="card-eyebrow">États fiscaux</p><h2>1259, 1386, EDET et EDAC par exercice</h2>
      <p class="card-sub">Cliquez un état présent pour l’ouvrir, un état manquant pour le déposer directement au bon exercice.</p></div>
      ${missing.length ? badge(`${missing.length} manquant${missing.length > 1 ? 's' : ''}`, 'warn') : badge('Complet', 'good')}</div>
    <div class="card-body"><div class="states-grid" role="table" aria-label="États fiscaux par exercice">
      <span class="sg-h" role="columnheader">Exercice</span>${M.STATE_TYPES.map(t => `<span class="sg-h" role="columnheader">${esc(t)}</span>`).join('')}
      ${grid.map(r => `<span class="sg-y" role="rowheader">${r.year}</span>${r.cells.map(c => cell(c, r.year)).join('')}`).join('')}
    </div></div>
  </article>`;
}

export function render({params}) {
  st.q = params.get('q') || st.q;
  const all = M.documents();
  const types = [...new Set(all.map(d => d.type))].sort();
  const ys = [...new Set(all.map(d => d.year).filter(Boolean))].sort((a, b) => b - a);
  const docs = list();
  const orph = orphans();
  return `
  <section class="ph">
    <div><p class="ph-eyebrow">Centre documentaire</p><h1>${all.length} pièces fiscales classées</h1>
    <p class="ph-lede">États 1259 et 1386, EDET, conventions, courriers DGFiP. Les fichiers sont des pièces jointes du document Grist.</p></div>
    <div class="ph-actions"><button class="btn btn-primary" data-upload>${icon('upload', 16)}Déposer un document</button></div>
  </section>
  ${orph.safe.length ? `<div class="dupe-note card" data-orph>
    <span class="check-ic tone-info">${icon('info', 16)}</span>
    <span class="row-main"><b>${orph.safe.length} ligne${orph.safe.length > 1 ? 's' : ''} vide${orph.safe.length > 1 ? 's' : ''} dans Documents_Fiscaux</b>
      <span>Sans titre ni type, et leurs fichiers sont déjà classés dans d’autres lignes : les supprimer ne fait perdre aucun document.</span></span>
    <button class="btn btn-sm" data-orph-del>${icon('trash', 14)}Supprimer les ${orph.safe.length} lignes vides</button>
  </div>` : ''}
  ${orph.owned.length ? `<div class="dupe-note card">
    <span class="check-ic tone-warn">${icon('alert', 16)}</span>
    <span class="row-main"><b>${orph.owned.length} fichier${orph.owned.length > 1 ? 's' : ''} sans titre</b>
      <span>Ces lignes portent un fichier qui n’est classé nulle part ailleurs : donnez-leur un titre et un type.</span></span>
    ${orph.owned.slice(0, 3).map(r => `<button class="btn btn-sm" data-doc-edit="${r.id}">${icon('edit', 14)}Classer la ligne ${r.id}</button>`).join('')}
  </div>` : ''}
  ${statesCard()}
  <section class="grid g-docs mt">
    <aside class="card card-pad doc-facets">
      <p class="menu-label" style="padding:0 0 8px">Type</p>
      <button class="facet" aria-pressed="${!st.type}" data-type="">Tous <span class="num">${all.length}</span></button>
      ${types.map(t => `<button class="facet" aria-pressed="${st.type === t}" data-type="${attr(t)}"><span>${icon(typeIcon(t), 15)}${esc(t)}</span><span class="num">${all.filter(d => d.type === t).length}</span></button>`).join('')}
      <p class="menu-label" style="padding:16px 0 8px">Exercice</p>
      <div class="me-people" style="padding:0">${['', ...ys].map(y => `<button class="chip" aria-pressed="${st.year === String(y)}" data-dyear="${y}">${y || 'Tous'}</button>`).join('')}</div>
    </aside>
    <article class="card">
      <div class="toolbar card-toolbar">
        <label class="search-field" style="max-width:none">${icon('search', 16)}<input class="input" type="search" placeholder="Rechercher un document…" value="${attr(st.q)}" data-keep="doc-q" aria-label="Rechercher un document"></label>
        <span class="muted result-count">${docs.length} document(s)</span>
      </div>
      <div class="doc-list" data-docs>${items(docs)}</div>
    </article>
  </section>
  <input type="file" hidden data-file>`;
}

async function deleteOrphans() {
  const {safe} = orphans();
  if (!safe.length) return;
  const ok = await confirmDialog({title: `Supprimer ${safe.length} ligne${safe.length > 1 ? 's' : ''} vide${safe.length > 1 ? 's' : ''} ?`,
    message: 'Ces lignes n’ont ni titre ni type, et leurs fichiers restent classés dans d’autres lignes. Vous pourrez annuler juste après.', confirm: 'Supprimer'});
  if (!ok) return;
  const backup = safe.map(backupRow);
  try {
    await act(safe.map(r => ['RemoveRecord', 'Documents_Fiscaux', r.id]));
    toast(`${safe.length} ligne${safe.length > 1 ? 's' : ''} vide${safe.length > 1 ? 's' : ''} supprimée${safe.length > 1 ? 's' : ''}`, 'ok', {action: 'Annuler', timeout: 9000, onAction: async () => {
      try { await act(backup.map(b => ['AddRecord', 'Documents_Fiscaux', null, b])); toast('Lignes restaurées', 'info'); } catch (err) { toast(err.message, 'error'); }
    }});
  } catch (err) { toast(err.message, 'error'); }
}

function uploadDrawer(file, given = null) {
  const y = new Date().getFullYear();
  const years = [...new Set([...Array.from({length: 8}, (_, i) => y + 1 - i), given?.year].filter(Boolean))].sort((a, b) => b - a);
  openDrawer({
    title: 'Classer le document', subtitle: esc(file.name),
    body: `<form class="form-grid" id="doc-form">
      <div class="span-2">${field('Titre', `<input name="Titre" value="${attr(file.name)}" required>`)}</div>
      ${field('Type', select('Type_Document', M.DOC_TYPES, given?.type || '1259'))}
      ${field('Exercice', select('Exercice', years, given?.year || y))}
      <div class="span-2 notice">${icon('info', 16)}<span>Le fichier est envoyé dans les pièces jointes du document Grist, puis une ligne est ajoutée à Documents_Fiscaux.</span></div>
    </form>`,
    footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-send>${icon('upload', 16)}Envoyer dans Grist</button>`,
    onMount(el) {
      el.querySelector('[data-send]').addEventListener('click', async e => {
        const v = formData(el.querySelector('#doc-form'));
        e.currentTarget.disabled = true;
        try {
          const attId = await uploadAttachment(file);
          const n = Math.max(0, ...rows('Documents_Fiscaux').map(r => Number(String(r.Document_ID || '').replace(/\D/g, '')) || 0)) + 1;
          await act([['AddRecord', 'Documents_Fiscaux', null, fieldsFor('Documents_Fiscaux', {
            Document_ID: `doc-${n}`, Titre: v.Titre.trim() || file.name, Type_Document: v.Type_Document, Exercice: Number(v.Exercice), Module: 'Fiscalité',
            Fichier: ['L', attId], Confidentialite: 'Équipe', Ajoute_Par: author(), Date_Ajout: M.nowSeconds(), Version: '1.0', Statut: 'Classé', Taille_Octets: file.size,
          })]]);
          closeDrawer(); toast(`${file.name} classé dans Grist`);
        } catch (err) { toast(err.message, 'error'); e.currentTarget.disabled = false; }
      });
    },
  });
}

function editDrawer(rowId) {
  const r = rows('Documents_Fiscaux').find(x => x.id === rowId);
  if (!r) return;
  const y = new Date().getFullYear();
  const years = [...new Set([...Array.from({length: 10}, (_, i) => y + 1 - i), M.num(r.Exercice)].filter(Boolean))].sort((a, b) => b - a);
  const ids = attachmentIds(r.Fichier);
  const types = [...new Set([...M.DOC_TYPES, M.text(r.Type_Document)].filter(Boolean))];
  openDrawer({
    id: `doc:${rowId}`, title: esc(M.text(r.Titre) || 'Document sans titre'), subtitle: `Ligne ${rowId} de Documents_Fiscaux${M.text(r.Ajoute_Par) ? ` · ajouté par ${esc(M.text(r.Ajoute_Par))}` : ''}`,
    body: `<form class="form-grid" id="doc-edit">
      <div class="span-2">${field('Titre', `<input name="Titre" value="${attr(M.text(r.Titre))}" required autofocus>`)}</div>
      ${field('Type', select('Type_Document', types, M.text(r.Type_Document) || 'Autre'))}
      ${field('Exercice', select('Exercice', [['', '—'], ...years], M.num(r.Exercice) || ''))}
      ${field('Version', `<input name="Version" value="${attr(M.text(r.Version))}">`)}
      ${field('Statut', select('Statut', ['Classé', 'À vérifier', 'Archivé'], M.text(r.Statut) || 'Classé'))}
      <div class="span-2">${field('Lien (facultatif)', `<input name="Lien" value="${attr(M.text(r.Lien))}" placeholder="https://…">`)}</div>
    </form>
    <p class="form-section">Fichier</p>
    <div class="piece-line">
      <span class="piece-ic${ids.length ? ' on' : ''}">${icon('file', 18)}</span>
      <span class="row-main"><b>${ids.length ? 'Fichier joint' : 'Aucun fichier'}</b><span>${ids.length ? `${fmt.size(M.num(r.Taille_Octets)) || 'taille inconnue'} · pièce jointe Grist` : 'Déposez le fichier pour le rattacher'}</span></span>
      ${ids.length ? `<button class="btn btn-sm" data-att="${ids[0]}">${icon('external', 14)}Ouvrir</button>` : ''}
      <button class="btn btn-sm" data-replace>${icon('upload', 14)}${ids.length ? 'Remplacer' : 'Déposer'}</button>
      <input type="file" hidden data-replace-file>
    </div>`,
    footer: `<button class="btn btn-ghost left" data-doc-del>${icon('trash', 15)}Supprimer</button><button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-doc-save>${icon('check', 16)}Enregistrer</button>`,
    onMount(el) {
      el.addEventListener('click', async e => {
        const att = e.target.closest('[data-att]');
        if (att) { openAttachment(Number(att.dataset.att)).catch(err => toast(err.message, 'error')); return; }
        if (e.target.closest('[data-replace]')) { el.querySelector('[data-replace-file]').click(); return; }
        const save = e.target.closest('[data-doc-save]');
        if (save) {
          const v = formData(el.querySelector('#doc-edit'));
          if (!v.Titre.trim()) { toast('Donnez un titre au document', 'error'); return; }
          save.disabled = true;
          try {
            await act([['UpdateRecord', 'Documents_Fiscaux', rowId, fieldsFor('Documents_Fiscaux', {
              Titre: v.Titre.trim(), Type_Document: v.Type_Document, Exercice: v.Exercice ? Number(v.Exercice) : null,
              Version: v.Version, Statut: v.Statut, Lien: v.Lien.trim(), Module: M.text(r.Module) || 'Fiscalité',
              Document_ID: M.text(r.Document_ID) || `doc-${rowId}`,
            })]]);
            closeDrawer(); toast('Document mis à jour');
            flash(document.querySelector(`[data-doc="${rowId}"]`));
          } catch (err) { toast(err.message, 'error'); save.disabled = false; }
          return;
        }
        if (e.target.closest('[data-doc-del]')) {
          const title = M.text(r.Titre) || `ligne ${rowId}`;
          const ok = await confirmDialog({title: 'Supprimer ce document ?', message: `« ${title} » sera retiré de Documents_Fiscaux. Vous pourrez annuler juste après.`, confirm: 'Supprimer', danger: true});
          if (!ok) return;
          const backup = backupRow(r);
          try {
            await act([['RemoveRecord', 'Documents_Fiscaux', rowId]]);
            closeDrawer();
            toast(`« ${title} » supprimé`, 'ok', {action: 'Annuler', timeout: 9000, onAction: async () => {
              try { await act([['AddRecord', 'Documents_Fiscaux', null, backup]]); toast('Document restauré', 'info'); } catch (err) { toast(err.message, 'error'); }
            }});
          } catch (err) { toast(err.message, 'error'); }
        }
      });
      el.addEventListener('change', async e => {
        if (!e.target.matches('[data-replace-file]')) return;
        const file = e.target.files[0]; e.target.value = '';
        if (!file) return;
        toast(`Envoi de ${file.name}…`, 'info', {timeout: 2500});
        try {
          const attId = await uploadAttachment(file);
          await act([['UpdateRecord', 'Documents_Fiscaux', rowId, fieldsFor('Documents_Fiscaux', {Fichier: ['L', attId], Taille_Octets: file.size, Date_Ajout: M.nowSeconds(), Ajoute_Par: author()})]]);
          toast(`${file.name} rattaché au document`);
          editDrawer(rowId);
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

export function mount(root) {
  const box = root.querySelector('[data-docs]');
  const redraw = () => { const d = list(); box.innerHTML = items(d); root.querySelector('.result-count').textContent = `${d.length} document(s)`; };
  root.querySelector('.search-field input').addEventListener('input', e => { st.q = e.target.value; redraw(); });
  root.addEventListener('click', e => {
    const ty = e.target.closest('[data-type]');
    if (ty) { st.type = ty.dataset.type; root.querySelectorAll('[data-type]').forEach(b => b.setAttribute('aria-pressed', b === ty)); redraw(); return; }
    const yy = e.target.closest('[data-dyear]');
    if (yy) { st.year = yy.dataset.dyear; root.querySelectorAll('[data-dyear]').forEach(b => b.setAttribute('aria-pressed', b === yy)); redraw(); return; }
    const att = e.target.closest('[data-att]');
    if (att) { openAttachment(Number(att.dataset.att)).catch(err => toast(err.message, 'error')); return; }
    const ed = e.target.closest('[data-doc-edit]');
    if (ed) { editDrawer(Number(ed.dataset.docEdit)); return; }
    if (e.target.closest('[data-orph-del]')) { deleteOrphans(); return; }
    const su = e.target.closest('[data-state-upload]');
    if (su) { const [type, year] = su.dataset.stateUpload.split('|'); preset = {type, year: Number(year)}; root.querySelector('[data-file]').click(); return; }
    if (e.target.closest('[data-upload]')) { preset = null; root.querySelector('[data-file]').click(); }
  });
  root.querySelector('[data-file]').addEventListener('change', e => { const file = e.target.files[0]; e.target.value = ''; if (file) uploadDrawer(file, preset); preset = null; });
  /* Déposer un fichier n'importe où sur la page. */
  root.addEventListener('dragover', e => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); root.classList.add('is-drop'); } });
  root.addEventListener('dragleave', e => { if (e.target === root) root.classList.remove('is-drop'); });
  root.addEventListener('drop', e => { e.preventDefault(); root.classList.remove('is-drop'); const file = e.dataTransfer.files[0]; if (file) uploadDrawer(file); });
}
