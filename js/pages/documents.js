import * as M from '../model.js';
import { rows, act, fieldsFor, uploadAttachment, openAttachment, attachmentIds } from '../grist.js';
import { esc, attr, icon, fmt, badge, empty, openDrawer, closeDrawer, toast, field, select, formData } from '../ui.js';
import { author } from '../main.js';

const st = {q: '', type: '', year: ''};
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const typeIcon = t => /1259|1386|EDET|EDAC/.test(t) ? 'table' : /onvention|élib/i.test(t) ? 'edit' : /ourrier/i.test(t) ? 'mail' : 'file';

function list() {
  const words = norm(st.q).split(/\s+/).filter(Boolean);
  return M.documents().filter(d => (!st.type || d.type === st.type) && (!st.year || String(d.year) === st.year) &&
    (!words.length || words.every(w => norm(`${d.title} ${d.type} ${d.year} ${d.author}`).includes(w))));
}
function items(docs) {
  if (!docs.length) return empty('Aucun document', 'Aucun document ne correspond à ces critères.');
  return docs.map(d => {
    const ids = attachmentIds(d.file);
    return `<div class="doc">
      <span class="doc-ic">${icon(typeIcon(d.type), 18)}</span>
      <span class="row-main"><b>${esc(d.title)}</b><span>${esc([d.type, d.year ? `exercice ${d.year}` : '', fmt.size(d.size), d.added ? `ajouté ${fmt.date(d.added)}` : '', d.author].filter(Boolean).join(' · '))}</span></span>
      ${ids.length ? `<button class="btn btn-sm btn-ghost" data-att="${ids[0]}">${icon('external', 14)}Ouvrir</button>` : d.link ? `<a class="btn btn-sm btn-ghost" href="${attr(d.link)}" target="_blank" rel="noopener noreferrer">${icon('external', 14)}Lien</a>` : '<span class="muted">Sans fichier</span>'}
    </div>`;
  }).join('');
}

export function render({params}) {
  st.q = params.get('q') || st.q;
  const all = M.documents();
  const types = [...new Set(all.map(d => d.type))].sort();
  const ys = [...new Set(all.map(d => d.year).filter(Boolean))].sort((a, b) => b - a);
  const docs = list();
  const orphans = rows('Documents_Fiscaux').length - all.length;
  return `
  <section class="ph">
    <div><p class="ph-eyebrow">Centre documentaire</p><h1>${all.length} pièces fiscales classées</h1>
    <p class="ph-lede">États 1259 et 1386, EDET, conventions, courriers DGFiP. Les fichiers sont des pièces jointes du document Grist${orphans ? ` — ${orphans} ligne(s) vide(s) masquée(s)` : ''}.</p></div>
    <div class="ph-actions"><button class="btn btn-primary" data-upload>${icon('upload', 16)}Déposer un document</button></div>
  </section>
  <section class="grid g-docs">
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

function uploadDrawer(file) {
  const y = new Date().getFullYear();
  openDrawer({
    title: 'Classer le document', subtitle: esc(file.name),
    body: `<form class="form-grid" id="doc-form">
      <div class="span-2">${field('Titre', `<input name="Titre" value="${attr(file.name)}" required>`)}</div>
      ${field('Type', select('Type_Document', M.DOC_TYPES, '1259'))}
      ${field('Exercice', select('Exercice', Array.from({length: 8}, (_, i) => y + 1 - i), y))}
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
    if (e.target.closest('[data-upload]')) root.querySelector('[data-file]').click();
  });
  root.querySelector('[data-file]').addEventListener('change', e => { const file = e.target.files[0]; e.target.value = ''; if (file) uploadDrawer(file); });
  /* Déposer un fichier n'importe où sur la page. */
  root.addEventListener('dragover', e => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); root.classList.add('is-drop'); } });
  root.addEventListener('dragleave', e => { if (e.target === root) root.classList.remove('is-drop'); });
  root.addEventListener('drop', e => { e.preventDefault(); root.classList.remove('is-drop'); const file = e.dataTransfer.files[0]; if (file) uploadDrawer(file); });
}
