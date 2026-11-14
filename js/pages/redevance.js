import * as M from '../model.js';
import { rows, act, fieldsFor, uploadAttachment, openAttachment, attachmentIds } from '../grist.js';
import { esc, attr, icon, fmt, badge, empty, openDrawer, patchDrawer, drawerOpen, drawerId, toast, field, select, formData, downloadCsv } from '../ui.js';
import { author, render as rerender } from '../main.js';

const SORTS = [['rest', 'Reste à recouvrer'], ['name', 'Nom (A→Z)'], ['billed', 'Montant facturé'], ['updated', 'Dernière mise à jour']];
const ACTIVITIES = ['Administration', 'Commerce', 'Hôtellerie/Restauration', 'Industrie', 'Santé', 'Autre', 'À renseigner'];
const tone = s => s === 'Sans suivi' ? 'neutral' : M.situationTone(s);

const f = {q: '', situation: '', activity: '', sort: 'rest', siret: ''};
function readParams(params) {
  f.q = params.get('q') || '';
  f.situation = params.get('situation') || '';
  f.activity = params.get('act') || '';
  f.sort = params.get('sort') || 'rest';
  f.siret = params.get('siret') || '';
}
function writeParams(sub = '') {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.situation) p.set('situation', f.situation);
  if (f.activity) p.set('act', f.activity);
  if (f.sort !== 'rest') p.set('sort', f.sort);
  if (f.siret) p.set('siret', f.siret);
  history.replaceState(null, '', `#/redevance${sub ? `/${encodeURIComponent(sub)}` : ''}${p.toString() ? `?${p}` : ''}`);
}

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function filtered(data) {
  const words = norm(f.q).split(/\s+/).filter(Boolean);
  let list = data.list.filter(x =>
    (!f.situation || x.situation === f.situation) &&
    (!f.activity || x.activity === f.activity) &&
    (f.siret !== '0' || (!x.siret && !x.siren)) &&
    (!words.length || words.every(w => norm(`${x.name} ${x.siret} ${x.siren} ${x.titleNumber} ${x.address} ${x.activity}`).includes(w))));
  const by = {
    rest: (a, b) => (b.rest ?? -1) - (a.rest ?? -1) || a.name.localeCompare(b.name, 'fr'),
    name: (a, b) => a.name.localeCompare(b.name, 'fr'),
    billed: (a, b) => (b.billed ?? -1) - (a.billed ?? -1),
    updated: (a, b) => (M.num(b.annual?.Derniere_MAJ) || 0) - (M.num(a.annual?.Derniere_MAJ) || 0),
  }[f.sort] || (() => 0);
  return list.sort(by);
}

function tableRows(list) {
  if (!list.length) return `<tr><td colspan="7">${empty('Aucune entreprise ne correspond', 'Modifiez la recherche ou les filtres.', '<button class="btn btn-sm" data-reset>Effacer les filtres</button>')}</td></tr>`;
  return list.map(x => {
    const conv = attachmentIds(x.convention).length > 0;
    const avis = attachmentIds(x.avis).length > 0;
    return `<tr data-open="${attr(x.id)}" tabindex="0">
      <td><span class="strong">${esc(x.name)}</span><span class="sub">${esc(x.activity)}${x.siret ? ` · ${esc(x.siret)}` : ''}</span></td>
      <td>${badge(x.situation, tone(x.situation))}</td>
      <td class="num">${esc(fmt.eurc(x.billed))}</td>
      <td class="num">${esc(fmt.eurc(x.paid))}</td>
      <td class="num strong">${x.rest ? esc(fmt.eurc(x.rest)) : x.billed != null ? '<span class="paid-ok">0 €</span>' : '<span class="miss">—</span>'}</td>
      <td>${x.titleNumber ? esc(x.titleNumber) : '<span class="miss">—</span>'}</td>
      <td><span class="pieces"><span class="piece${conv ? ' on' : ''}" title="Convention ${conv ? 'déposée' : 'absente'}">Conv.</span><span class="piece${avis ? ' on' : ''}" title="Avis ${avis ? 'déposé' : 'absent'}">Avis</span></span></td>
    </tr>`;
  }).join('');
}

export function render({year, params, sub}) {
  readParams(params);
  const data = M.rsYear(year);
  const list = filtered(data);
  const sit = ['Sans suivi', ...M.RS_SITUATIONS.map(s => s.key)].filter(s => data.counts[s]);
  const sum = k => list.reduce((s, x) => s + (x.situation === 'Non concernée' ? 0 : (x[k] || 0)), 0);
  return `
  <section class="ph">
    <div>
      <p class="ph-eyebrow">Redevance spéciale · ${year}</p>
      <h1>${esc(fmt.eur(data.paid))} encaissés sur ${esc(fmt.eur(data.billed))}</h1>
      <p class="ph-lede">${data.list.length} entreprises suivies, ${data.concerned} concernées en ${year}. Le badge de chaque ligne est la situation saisie dans Suivi_RS_Annuel ; les montants viennent de la même table.</p>
    </div>
    <div class="ph-actions">
      <button class="btn" data-export>${icon('download', 16)}Exporter</button>
      <button class="btn btn-primary" data-new>${icon('plus', 16)}Nouvelle entreprise</button>
    </div>
  </section>

  <section class="grid g-4">
    <div class="card kpi"><span class="kpi-label">Facturé ${year}</span><span class="kpi-value">${esc(fmt.short(data.billed))}</span><span class="kpi-meta">${esc(fmt.eurc(data.billed))}</span></div>
    <div class="card kpi"><span class="kpi-label">Encaissé</span><span class="kpi-value">${esc(fmt.short(data.paid))}</span>
      <div class="bar"><span style="width:${Math.round((data.rate || 0) * 100)}%;background:var(--good)"></span></div><span class="kpi-meta">${esc(fmt.pct(data.rate, 1))} recouvré</span></div>
    <div class="card kpi"><span class="kpi-label">Reste à recouvrer</span><span class="kpi-value">${esc(fmt.short(data.rest))}</span><span class="kpi-meta">${data.list.filter(x => x.rest > 0).length} entreprise(s) redevable(s)</span></div>
    <button class="card kpi kpi-btn" data-sit="À vérifier"><span class="kpi-label">À vérifier</span><span class="kpi-value">${data.counts['À vérifier'] || 0}</span><span class="kpi-meta">dossier(s) à qualifier ${icon('arrow', 13)}</span></button>
  </section>

  <article class="card mt">
    <div class="toolbar card-toolbar">
      <label class="search-field">${icon('search', 16)}<input class="input" type="search" placeholder="Nom, SIRET, n° de titre…" value="${attr(f.q)}" data-keep="rs-q" aria-label="Rechercher une entreprise"></label>
      <select data-f="activity" aria-label="Activité"><option value="">Toutes activités</option>${ACTIVITIES.map(a => `<option${a === f.activity ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select>
      <select data-f="sort" aria-label="Trier">${SORTS.map(([v, l]) => `<option value="${v}"${v === f.sort ? ' selected' : ''}>Tri : ${esc(l)}</option>`).join('')}</select>
      <span class="toolbar-gap"></span>
      <span class="muted result-count">${list.length} / ${data.list.length}</span>
    </div>
    <div class="chips-row" role="group" aria-label="Situation">
      <button class="chip" aria-pressed="${!f.situation}" data-sit="">Toutes <span class="chip-n">${data.list.length}</span></button>
      ${sit.map(s => `<button class="chip" aria-pressed="${f.situation === s}" data-sit="${attr(s)}"><span class="chip-dot tone-${tone(s)}"></span>${esc(s)} <span class="chip-n">${data.counts[s]}</span></button>`).join('')}
      ${f.siret === '0' ? `<button class="chip" aria-pressed="true" data-siret>Sans SIRET ${icon('x', 12)}</button>` : ''}
    </div>
    <div class="table-wrap"><table class="t rs-table">
      <thead><tr><th>Entreprise</th><th>Situation ${year}</th><th class="num">Facturé</th><th class="num">Réglé</th><th class="num">Reste</th><th>N° titre</th><th>Pièces</th></tr></thead>
      <tbody data-rs-body>${tableRows(list)}</tbody>
      <tfoot><tr><td>Total de la sélection</td><td></td><td class="num" data-sum="billed">${esc(fmt.eurc(sum('billed')))}</td><td class="num" data-sum="paid">${esc(fmt.eurc(sum('paid')))}</td><td class="num" data-sum="rest">${esc(fmt.eurc(sum('rest')))}</td><td></td><td></td></tr></tfoot>
    </table></div>
  </article>`;
}

/* ── Fiche entreprise ───────────────────────────────────────────────── */
function fiche(id, year) {
  const data = M.rsYear(year);
  const x = data.list.find(c => c.id === id);
  if (!x) return null;
  const history = M.annualFor(x.id, x.rowId).sort((a, b) => M.num(b.Exercice) - M.num(a.Exercice));
  const conv = attachmentIds(x.convention);
  const situations = M.RS_SITUATIONS.map(s => s.key);
  const title = esc(x.name);
  const subtitle = `${badge(x.situation, tone(x.situation))}<span>${esc(x.activity)}</span>${x.siret ? `<span class="num">SIRET ${esc(x.siret)}</span>` : ''}`;
  const body = `
    <div class="fiche-kpis">
      <div><span class="kpi-label">Facturé ${year}</span><b class="num">${esc(fmt.eurc(x.billed))}</b></div>
      <div><span class="kpi-label">Réglé</span><b class="num">${esc(fmt.eurc(x.paid))}</b></div>
      <div><span class="kpi-label">Reste</span><b class="num${x.rest ? ' is-due' : ''}">${esc(fmt.eurc(x.rest))}</b></div>
    </div>

    <p class="form-section">Suivi ${year}</p>
    <form class="form-grid" id="annual-form">
      ${field('Situation', select('Situation', situations, x.annual ? x.situation : 'À vérifier'))}
      ${field('N° de titre', `<input name="Numero_Titre" value="${attr(x.titleNumber)}">`)}
      ${field('Montant facturé (€)', `<input name="Montant_Facture" inputmode="decimal" value="${attr(x.billed ?? '')}">`)}
      ${field('Montant réglé (€)', `<input name="Montant_Regle" inputmode="decimal" value="${attr(x.paid ?? '')}">`)}
      ${field('Date du titre', `<input type="date" name="Date_Titre" value="${attr(fmt.iso(x.titleDate))}">`)}
      ${field('Date de paiement', `<input type="date" name="Date_Paiement" value="${attr(fmt.iso(x.paymentDate))}">`)}
      <div class="span-2">${field('Observations', `<textarea name="Observations" rows="3">${esc(x.observations)}</textarea>`)}</div>
      <div class="span-2 form-actions"><span class="muted">${x.annual ? `Dernière mise à jour ${esc(fmt.date(M.toDate(x.annual.Derniere_MAJ)))}` : `Aucun suivi ${year} : l’enregistrement le créera.`}</span>
        <button type="submit" class="btn btn-primary">${icon('check', 16)}Enregistrer le suivi ${year}</button></div>
    </form>

    <p class="form-section">Tous les exercices</p>
    ${history.length ? `<div class="table-wrap mini"><table class="t">
      <thead><tr><th>Exercice</th><th>Situation</th><th class="num">Facturé</th><th class="num">Réglé</th><th>Avis</th></tr></thead>
      <tbody>${history.map(a => {
        const av = attachmentIds(a.Avis_Fichier);
        const y = M.num(a.Exercice);
        return `<tr${y === year ? ' class="is-current"' : ''}><td class="strong">${y}</td><td>${badge(M.text(a.Situation) || '—', tone(M.text(a.Situation)))}</td>
          <td class="num">${esc(fmt.eurc(M.num(a.Montant_Facture)))}</td><td class="num">${esc(fmt.eurc(M.num(a.Montant_Regle)))}</td>
          <td>${av.length ? `<button class="btn btn-sm btn-ghost" data-att="${av[0]}">${icon('file', 14)}Ouvrir</button>` : `<button class="btn btn-sm btn-ghost" data-up="avis" data-up-row="${a.id}">${icon('upload', 14)}Déposer</button>`}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="muted">Aucun suivi annuel pour cette entreprise.</p>'}

    <p class="form-section">Convention</p>
    <div class="piece-line">
      <span class="piece-ic${conv.length ? ' on' : ''}">${icon('file', 18)}</span>
      <span class="row-main"><b>${conv.length ? 'Convention déposée' : 'Aucune convention'}</b><span>${conv.length ? 'Pièce jointe Grist (Entreprises_RS.Convention_Fichier)' : 'Déposez le PDF signé'}</span></span>
      ${conv.length ? `<button class="btn btn-sm" data-att="${conv[0]}">${icon('external', 14)}Ouvrir</button>` : ''}
      <button class="btn btn-sm" data-up="convention">${icon('upload', 14)}${conv.length ? 'Remplacer' : 'Déposer'}</button>
    </div>

    <p class="form-section">Entreprise</p>
    <form class="form-grid" id="company-form">
      <div class="span-2">${field('Raison sociale', `<input name="Raison_Sociale" value="${attr(x.name)}" required>`)}</div>
      ${field('SIRET', `<input name="SIRET" value="${attr(x.siret)}" inputmode="numeric">`)}
      ${field('Activité', select('Activite', ACTIVITIES, x.activity))}
      <div class="span-2">${field('Adresse', `<input name="Adresse" value="${attr(M.text(x.raw.Adresse))}">`)}</div>
      ${field('E-mail', `<input type="email" name="Email" value="${attr(x.email)}">`)}
      ${field('Téléphone', `<input type="tel" name="Telephone" value="${attr(x.phone)}">`)}
      ${field('Suivi par', `<input name="Responsable" value="${attr(x.contact)}">`)}
      ${field('Prochaine action', `<input name="Prochaine_Action" value="${attr(x.nextAction)}">`)}
      <div class="span-2">${field('Notes', `<textarea name="Notes" rows="2">${esc(x.notes)}</textarea>`)}</div>
      <div class="span-2 form-actions"><span class="contact-links">${x.email ? `<a class="link" href="mailto:${attr(x.email)}">${icon('mail', 14)}${esc(x.email)}</a>` : ''}${x.phone ? `<a class="link" href="tel:${attr(x.phone.replace(/\s/g, ''))}">${icon('phone', 14)}${esc(x.phone)}</a>` : ''}</span>
        <button type="submit" class="btn">${icon('check', 16)}Enregistrer la fiche</button></div>
    </form>
    <input type="file" hidden data-file accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.odt">`;
  return {x, title, subtitle, body};
}

function openFiche(id, year) {
  const fc = fiche(id, year);
  if (!fc) { toast('Entreprise introuvable', 'error'); writeParams(); return; }
  if (drawerOpen() && drawerId() === id) { patchDrawer(fc); return; }
  openDrawer({
    id, wide: true, title: fc.title, subtitle: fc.subtitle, body: fc.body,
    onClose: () => writeParams(),
    onMount: el => bindFiche(el, id, year),
  });
}

function bindFiche(el, id, year) {
  let upKind = null, upRow = null;
  el.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('[type="submit"]');
    const x = M.rsYear(year).list.find(c => c.id === id);
    if (!x) return;
    btn.disabled = true;
    try {
      if (form.id === 'annual-form') {
        const v = formData(form);
        const billed = M.num(v.Montant_Facture), paid = M.num(v.Montant_Regle);
        const toDate = s => s ? M.toGristDate(new Date(`${s}T00:00:00`)) : null;
        const fields = fieldsFor('Suivi_RS_Annuel', {
          Situation: v.Situation, Montant_Facture: billed, Montant_Regle: paid,
          Reste_A_Recouvrer: billed !== null ? Math.max(0, billed - (paid || 0)) : null,
          Numero_Titre: v.Numero_Titre, Date_Titre: toDate(v.Date_Titre), Date_Paiement: toDate(v.Date_Paiement),
          Observations: v.Observations, Derniere_MAJ: M.nowSeconds(),
        });
        await act([x.annual
          ? ['UpdateRecord', 'Suivi_RS_Annuel', x.annual.id, fields]
          : ['AddRecord', 'Suivi_RS_Annuel', null, {...fieldsFor('Suivi_RS_Annuel', {Suivi_ID: `RS-${x.id}-${year}`, Entreprise_ID: x.id, Exercice: year}), ...fields}]]);
        toast(`Suivi ${year} de ${x.name} enregistré`);
      } else {
        const v = formData(form);
        if (!v.Raison_Sociale.trim()) { toast('La raison sociale est obligatoire', 'error'); btn.disabled = false; return; }
        await act([['UpdateRecord', 'Entreprises_RS', x.rowId, fieldsFor('Entreprises_RS', {...v, Derniere_MAJ: M.nowSeconds()})]]);
        toast('Fiche entreprise enregistrée');
      }
      openFiche(id, year);
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
  });
  el.addEventListener('click', async e => {
    const att = e.target.closest('[data-att]');
    if (att) { openAttachment(Number(att.dataset.att)).catch(err => toast(err.message, 'error')); return; }
    const up = e.target.closest('[data-up]');
    if (up) { upKind = up.dataset.up; upRow = Number(up.dataset.upRow) || null; el.querySelector('[data-file]').click(); }
  });
  el.addEventListener('change', async e => {
    if (!e.target.matches('[data-file]')) return;
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    const x = M.rsYear(year).list.find(c => c.id === id);
    toast(`Envoi de ${file.name}…`, 'info', {timeout: 2500});
    try {
      const attId = await uploadAttachment(file);
      if (upKind === 'convention') await act([['UpdateRecord', 'Entreprises_RS', x.rowId, {Convention_Fichier: ['L', attId]}]]);
      else await act([['UpdateRecord', 'Suivi_RS_Annuel', upRow, {Avis_Fichier: ['L', attId]}]]);
      toast(`${file.name} enregistré dans Grist`);
      openFiche(id, year);
    } catch (err) { toast(err.message, 'error'); }
  });
}

function newCompany(year) {
  openDrawer({
    title: 'Nouvelle entreprise', subtitle: `Ajoutée à Entreprises_RS avec un suivi ${year} « À vérifier »`,
    body: `<form class="form-grid" id="new-form">
      <div class="span-2">${field('Raison sociale', '<input name="Raison_Sociale" required autofocus>')}</div>
      ${field('SIRET', '<input name="SIRET" inputmode="numeric">')}
      ${field('Activité', select('Activite', ACTIVITIES, 'À renseigner'))}
      <div class="span-2">${field('Adresse', '<input name="Adresse">')}</div>
      ${field('E-mail', '<input type="email" name="Email">')}
      ${field('Téléphone', '<input type="tel" name="Telephone">')}
      ${field(`Montant facturé ${year} (€)`, '<input name="billed" inputmode="decimal">', 'Facultatif')}
    </form>`,
    footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-create>${icon('plus', 16)}Créer</button>`,
    onMount(el) {
      el.querySelector('[data-create]').addEventListener('click', async e => {
        const v = formData(el.querySelector('#new-form'));
        if (!v.Raison_Sociale.trim()) { toast('La raison sociale est obligatoire', 'error'); return; }
        const ids = rows('Entreprises_RS').map(r => M.text(r.Entreprise_ID)).filter(s => /^rs-new-\d+$/.test(s)).map(s => Number(s.split('-')[2]));
        const newId = `rs-new-${(Math.max(0, ...ids) + 1)}`;
        const billed = M.num(v.billed);
        e.currentTarget.disabled = true;
        try {
          await act([
            ['AddRecord', 'Entreprises_RS', null, fieldsFor('Entreprises_RS', {Entreprise_ID: newId, Raison_Sociale: v.Raison_Sociale.trim(), SIRET: v.SIRET, Activite: v.Activite, Adresse: v.Adresse, Email: v.Email, Telephone: v.Telephone, Responsable: author(), Statut_Paiement: 'À compléter', Etape_Actuelle: 'À qualifier', Derniere_MAJ: M.nowSeconds()})],
            ['AddRecord', 'Suivi_RS_Annuel', null, fieldsFor('Suivi_RS_Annuel', {Suivi_ID: `RS-${newId}-${year}`, Entreprise_ID: newId, Exercice: year, Situation: 'À vérifier', Montant_Facture: billed, Reste_A_Recouvrer: billed, Derniere_MAJ: M.nowSeconds()})],
          ], ['Entreprises_RS', 'Suivi_RS_Annuel']);
          toast(`${v.Raison_Sociale} ajoutée`);
          location.hash = `#/redevance/${encodeURIComponent(newId)}`;
        } catch (err) { toast(err.message, 'error'); e.currentTarget.disabled = false; }
      });
    },
  });
}

export function mount(root, {year, sub}) {
  const body = root.querySelector('[data-rs-body]');
  const refreshList = () => {
    const data = M.rsYear(year);
    const list = filtered(data);
    body.innerHTML = tableRows(list);
    root.querySelector('.result-count').textContent = `${list.length} / ${data.list.length}`;
    const sum = k => list.reduce((s, x) => s + (x.situation === 'Non concernée' ? 0 : (x[k] || 0)), 0);
    for (const k of ['billed', 'paid', 'rest']) root.querySelector(`[data-sum="${k}"]`).textContent = fmt.eurc(sum(k));
    writeParams(drawerOpen() ? drawerId() : '');
  };
  root.querySelector('.search-field input').addEventListener('input', e => { f.q = e.target.value; refreshList(); });
  root.querySelectorAll('[data-f]').forEach(s => s.addEventListener('change', e => { f[s.dataset.f] = e.target.value; refreshList(); }));
  root.addEventListener('click', e => {
    const chip = e.target.closest('[data-sit]');
    if (chip) {
      f.situation = chip.dataset.sit;
      root.querySelectorAll('.chips-row [data-sit]').forEach(c => c.setAttribute('aria-pressed', c.dataset.sit === f.situation));
      refreshList();
      if (chip.classList.contains('kpi-btn')) root.querySelector('.rs-table').scrollIntoView({behavior: 'smooth', block: 'start'});
      return;
    }
    if (e.target.closest('[data-siret]')) { f.siret = ''; e.target.closest('[data-siret]').remove(); refreshList(); return; }
    if (e.target.closest('[data-reset]')) { Object.assign(f, {q: '', situation: '', activity: '', siret: ''}); writeParams(); rerender({keepScroll: true}); return; }
    const tr = e.target.closest('tr[data-open]');
    if (tr) { writeParams(tr.dataset.open); openFiche(tr.dataset.open, year); return; }
    if (e.target.closest('[data-new]')) { newCompany(year); return; }
    if (e.target.closest('[data-export]')) {
      const list = filtered(M.rsYear(year));
      downloadCsv(`redevance-speciale-${year}.csv`, ['Entreprise', 'SIRET', 'Activité', `Situation ${year}`, 'Facturé', 'Réglé', 'Reste', 'N° titre', 'E-mail', 'Téléphone'],
        list.map(x => [x.name, x.siret, x.activity, x.situation, x.billed, x.paid, x.rest, x.titleNumber, x.email, x.phone]));
    }
  });
  body.addEventListener('keydown', e => {
    const tr = e.target.closest('tr[data-open]');
    if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); writeParams(tr.dataset.open); openFiche(tr.dataset.open, year); }
  });
  if (sub && !(drawerOpen() && drawerId() === sub)) openFiche(sub, year);
}
