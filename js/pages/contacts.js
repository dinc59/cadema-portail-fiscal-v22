/* Contacts (#/contacts) : l'annuaire du pôle fiscalité.
   Préfecture, DGFiP, comptable public, URSSAF, communes, services internes…
   Une fiche par interlocuteur : coordonnées en un clic (appel, e-mail,
   WhatsApp, carte de visite), sujets suivis, journal des échanges et date
   du prochain suivi. Les données vivent dans la table Grist « Contacts ». */
import * as M from '../model.js';
import { act, fieldsFor, rows } from '../grist.js';
import { esc, attr, icon, fmt, badge, empty, openDrawer, closeDrawer, patchDrawer, drawerOpen, drawerId, toast, field, select, formData, confirmDialog, flash, downloadCsv, downloadText } from '../ui.js';
import { author } from '../main.js';

const st = {q: '', cat: '', view: ''};
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const initials = c => ((c.first[0] || '') + (c.last[0] || '') || c.name.slice(0, 2)).toUpperCase();
const face = (c, size = 44) => `<span class="ct-face" style="--h:${M.categoryOf(c.category).hue};width:${size}px;height:${size}px;font-size:${Math.round(size * .36)}px" aria-hidden="true">${esc(initials(c))}</span>`;
const waLink = c => { const n = M.intlPhone(c.mobile || c.phone).replace('+', ''); return n.length > 8 ? `https://wa.me/${n}` : ''; };
/* Une date sans heure (colonne Date de Grist) : en jours, jamais en heures. */
const dayRel = d => { const t = new Date(new Date().toDateString()), x = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); const n = Math.round((t - x) / 864e5);
  return n <= 0 ? 'aujourd’hui' : n === 1 ? 'hier' : n < 30 ? `il y a ${n} jours` : `le ${fmt.date(x)}`; };
const nextTxt = c => !c.next ? '' : c.late ? `Suivi en retard depuis le ${fmt.date(c.next)}` : `Prochain suivi le ${fmt.date(c.next)}`;

function filtered(list) {
  const words = norm(st.q).split(/\s+/).filter(Boolean);
  return list.filter(c => (!st.cat || c.category === st.cat)
    && (st.view !== 'fav' || c.fav) && (st.view !== 'suivi' || c.late || c.dueSoon)
    && (!words.length || words.every(w => norm(`${c.name} ${c.role} ${c.org} ${c.service} ${c.email} ${c.phone} ${c.mobile} ${c.tags.join(' ')} ${c.category}`).includes(w))));
}

function card(c) {
  const tel = c.mobile || c.phone;
  return `<article class="ct-card${c.late ? ' is-late' : ''}" data-ct="${c.rowId}" tabindex="0" role="button" aria-label="Fiche de ${attr(c.name)}">
    <span class="ct-card-top">${face(c)}<span class="ct-id"><b>${esc(c.name)}</b><span>${esc(c.role || c.service || '—')}</span></span>
      ${c.fav ? `<span class="ct-fav" aria-label="Favori">${icon('star', 15)}</span>` : ''}</span>
    <span class="ct-org" data-tip="${attr(c.category)}" style="--h:${M.categoryOf(c.category).hue}">${icon(M.categoryOf(c.category).ic, 14)}${esc(c.org || 'Organisme non renseigné')}</span>
    ${c.tags.length ? `<span class="ct-tags">${c.tags.slice(0, 3).map(t => `<span class="ct-tag">${esc(t)}</span>`).join('')}${c.tags.length > 3 ? `<span class="ct-tag">+${c.tags.length - 3}</span>` : ''}</span>` : ''}
    ${c.next ? `<span class="ct-next${c.late ? ' late' : ''}">${icon('clock', 13)}${esc(nextTxt(c))}</span>` : ''}
    <span class="ct-quick">
      ${tel ? `<a class="icon-btn" href="tel:${attr(M.intlPhone(tel))}" data-tip="Appeler ${attr(M.prettyPhone(tel))}" aria-label="Appeler">${icon('phone', 16)}</a>` : ''}
      ${c.email ? `<a class="icon-btn" href="mailto:${attr(c.email)}" data-tip="Écrire à ${attr(c.email)}" aria-label="Écrire" target="_blank" rel="noopener">${icon('mail', 16)}</a>` : ''}
      <button class="icon-btn" data-copy-ct="${c.rowId}" data-tip="Copier les coordonnées" aria-label="Copier les coordonnées">${icon('copy', 16)}</button>
    </span>
  </article>`;
}

function grid(list) {
  if (!list.length) return empty('Aucun contact', st.q || st.cat || st.view ? 'Aucun contact ne correspond à ces critères.' : 'Ajoutez votre premier interlocuteur.');
  /* Peu de fiches, ou une seule catégorie : une grille simple se lit mieux que des rubriques d'une carte. */
  const groups = M.CONTACT_CATEGORIES.map(g => ({...g, list: list.filter(c => c.category === g.key)})).filter(g => g.list.length);
  if (list.length <= 9 || groups.length === 1) return `<div class="ct-grid ct-flat">${list.map(card).join('')}</div>`;
  return groups.map(g => `<section class="ct-group"><h3 class="ct-group-h" style="--h:${g.hue}">${icon(g.ic, 16)}<span>${esc(g.key)}</span><span class="num">${g.list.length}</span></h3>
    <div class="ct-grid">${g.list.map(card).join('')}</div></section>`).join('');
}

/* Avant création de la table : ce que le module apporte, et un bouton. */
function welcome() {
  return `<section class="ct-hero">
    <div class="ct-hero-txt"><p class="ph-eyebrow">Nouveau</p><h1>Tous vos interlocuteurs, au même endroit</h1>
      <p class="ph-lede">Préfecture, DGFiP, comptable public, URSSAF, communes, services de la CADEMA : chaque contact a sa fiche, avec ses coordonnées en un clic, les sujets que vous traitez avec lui, l’historique de vos échanges et la date du prochain suivi. Toute l’équipe partage le même carnet.</p>
      <button class="btn btn-primary" data-ct-create>${icon('table', 16)}Créer l’annuaire dans Grist</button>
      <p class="muted ct-hero-note">Ajoute une table « Contacts » au document. Rien n’est modifié ailleurs.</p></div>
    <div class="ct-hero-demo" aria-hidden="true">
      ${[['Service de gestion comptable', 'Comptable public', 'DGFiP & comptable public'], ['Bureau des finances locales', 'Contrôle de légalité', 'État & Préfecture'], ['Service recouvrement', 'Versement mobilité', 'URSSAF & organismes sociaux']]
        .map(([n, r, k]) => `<div class="ct-card is-demo"><span class="ct-card-top"><span class="ct-face" style="--h:${M.categoryOf(k).hue};width:44px;height:44px;font-size:16px">${esc(n.split(' ').map(w => w[0]).slice(0, 2).join(''))}</span><span class="ct-id"><b>${esc(n)}</b><span>${esc(r)}</span></span></span><span class="ct-org">${icon(M.categoryOf(k).ic, 14)}${esc(k)}</span></div>`).join('')}
    </div></section>
    <div class="grid g-3 ct-promises">
      <div class="card card-pad">${icon('phone', 20)}<b>Un clic pour joindre</b><span>Appel, e-mail, WhatsApp, coordonnées copiées ou carte de visite pour le téléphone.</span></div>
      <div class="card card-pad">${icon('clock', 20)}<b>Rien ne tombe entre deux chaises</b><span>Journal daté des échanges et prochain suivi : les retards remontent en tête.</span></div>
      <div class="card card-pad">${icon('search', 20)}<b>Retrouvé partout</b><span>Tapez « URSSAF » ou un nom dans la recherche (Ctrl K), depuis n’importe quelle page.</span></div>
    </div>`;
}

export function render() {
  if (!M.contactsReady()) return welcome();
  const all = M.contacts();
  const list = filtered(all);
  const late = all.filter(c => c.late).length, soon = all.filter(c => c.dueSoon).length, favs = all.filter(c => c.fav).length;
  const orgs = new Set(all.map(c => c.org).filter(Boolean)).size;
  const counts = Object.fromEntries(M.CONTACT_CATEGORIES.map(g => [g.key, all.filter(c => c.category === g.key).length]));
  return `
  <section class="ph">
    <div><p class="ph-eyebrow">Annuaire du pôle</p><h1>Contacts</h1>
      <p class="ph-lede">Les interlocuteurs du pôle fiscalité, leurs coordonnées, les sujets suivis et l’historique des échanges.</p></div>
    <div class="ph-actions">
      ${all.length ? `<button class="btn" data-ct-csv>${icon('download', 16)}Exporter</button>` : ''}
      <button class="btn btn-primary" data-ct-new>${icon('plus', 16)}Nouveau contact</button></div>
  </section>
  <section class="grid g-4 ct-kpis">
    <button class="card kpi kpi-btn" data-view=""><span class="kpi-label">${icon('users', 14)}Contacts</span><span class="kpi-value">${all.length}</span><span class="kpi-meta">${orgs} organisme${orgs > 1 ? 's' : ''}</span></button>
    <button class="card kpi kpi-btn" data-view="fav"><span class="kpi-label">${icon('star', 14)}Favoris</span><span class="kpi-value">${favs}</span><span class="kpi-meta">épinglés en tête</span></button>
    <button class="card kpi kpi-btn${late ? ' is-alert' : ''}" data-view="suivi"><span class="kpi-label">${icon('clock', 14)}Suivis en retard</span><span class="kpi-value">${late}</span><span class="kpi-meta">${soon} dans les 7 jours</span></button>
    <div class="card kpi"><span class="kpi-label">${icon('chat', 14)}Échanges notés</span><span class="kpi-value">${all.reduce((s, c) => s + c.journal.length, 0)}</span><span class="kpi-meta">dans les journaux</span></div>
  </section>
  <article class="card mt">
    <div class="toolbar card-toolbar">
      <label class="search-field">${icon('search', 16)}<input class="input" type="search" placeholder="Nom, organisme, sujet, téléphone…" value="${attr(st.q)}" aria-label="Rechercher un contact"></label>
      <span class="toolbar-gap"></span><span class="muted result-count">${list.length} / ${all.length}</span>
    </div>
    <div class="chips-row" role="group" aria-label="Catégorie">
      <button class="chip" aria-pressed="${!st.cat}" data-cat="">Toutes <span class="chip-n">${all.length}</span></button>
      ${M.CONTACT_CATEGORIES.filter(g => counts[g.key]).map(g => `<button class="chip" aria-pressed="${st.cat === g.key}" data-cat="${attr(g.key)}">${esc(g.key)} <span class="chip-n">${counts[g.key]}</span></button>`).join('')}
      ${st.view ? `<button class="chip" aria-pressed="true" data-view="">${st.view === 'fav' ? 'Favoris' : 'Suivis à faire'} ${icon('x', 12)}</button>` : ''}
    </div>
    <div class="ct-body" data-ct-body>${grid(list)}</div>
  </article>`;
}

/* ── Fiche ─────────────────────────────────────────────────────────── */
const copyLine = (label, value, href = '') => value ? `<div class="ct-line"><span class="ct-line-l">${esc(label)}</span>
  ${href ? `<a href="${attr(href)}" target="_blank" rel="noopener">${esc(value)}</a>` : `<span>${esc(value)}</span>`}
  <button class="icon-btn" data-copy="${attr(value)}" data-tip="Copier" aria-label="Copier ${attr(label)}">${icon('copy', 15)}</button></div>` : '';

function ficheParts(c) {
  const g = M.categoryOf(c.category);
  const tel = c.mobile || c.phone, wa = waLink(c);
  const title = `<span class="ct-title">${esc(c.name)}</span>`;
  const subtitle = `${badge(c.category, 'neutral')}${c.org ? `<span>${esc(c.org)}</span>` : ''}`;
  const body = `
    <section class="ct-sheet" style="--h:${g.hue}">
      <div class="ct-sheet-hero">${face(c, 72)}
        <div><p class="ct-sheet-role">${esc([c.civ, c.role].filter(Boolean).join(' · ') || 'Fonction non renseignée')}</p>
          <p class="ct-sheet-org">${icon(g.ic, 15)}${esc([c.org, c.service].filter(Boolean).join(' — ') || 'Organisme non renseigné')}</p>
          ${c.lastAt ? `<p class="ct-sheet-last">Dernier échange ${esc(dayRel(c.lastAt))}</p>` : ''}</div>
        <button class="icon-btn ct-star${c.fav ? ' on' : ''}" data-fav aria-pressed="${c.fav}" data-tip="${c.fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-label="Favori">${icon('star', 20)}</button>
      </div>
      <div class="ct-actions">
        ${tel ? `<a class="ct-act" href="tel:${attr(M.intlPhone(tel))}">${icon('phone', 18)}<span>Appeler</span></a>` : `<span class="ct-act is-off">${icon('phone', 18)}<span>Appeler</span></span>`}
        ${c.email ? `<a class="ct-act" href="mailto:${attr(c.email)}" target="_blank" rel="noopener">${icon('mail', 18)}<span>Écrire</span></a>` : `<span class="ct-act is-off">${icon('mail', 18)}<span>Écrire</span></span>`}
        ${wa ? `<a class="ct-act" href="${attr(wa)}" target="_blank" rel="noopener noreferrer">${icon('chat', 18)}<span>WhatsApp</span></a>` : `<span class="ct-act is-off">${icon('chat', 18)}<span>WhatsApp</span></span>`}
        <button class="ct-act" data-copy-all>${icon('copy', 18)}<span>Copier</span></button>
        <button class="ct-act" data-vcf>${icon('card', 18)}<span>Carte</span></button>
      </div>
    </section>

    ${c.next ? `<div class="notice ${c.late ? 'notice-critical' : c.dueSoon ? 'notice-warn' : ''} mt">${icon('clock', 16)}<span><b>${esc(nextTxt(c))}</b>${c.late ? ' : à relancer.' : ''}</span></div>` : ''}

    <p class="form-section">Coordonnées</p>
    <div class="ct-lines">
      ${copyLine('E-mail', c.email, c.email ? `mailto:${c.email}` : '')}
      ${copyLine('Téléphone', c.phone ? M.prettyPhone(c.phone) : '', c.phone ? `tel:${M.intlPhone(c.phone)}` : '')}
      ${copyLine('Mobile', c.mobile ? M.prettyPhone(c.mobile) : '', c.mobile ? `tel:${M.intlPhone(c.mobile)}` : '')}
      ${copyLine('Adresse', c.address)}
      ${!c.email && !c.phone && !c.mobile && !c.address ? '<p class="muted">Aucune coordonnée : cliquez sur Modifier pour les ajouter.</p>' : ''}
    </div>

    ${c.tags.length ? `<p class="form-section">Sujets suivis</p><div class="ct-tags big">${c.tags.map(t => `<span class="ct-tag">${esc(t)}</span>`).join('')}</div>` : ''}

    <p class="form-section">Journal des échanges</p>
    <form class="ct-log-form" id="ct-log">
      ${select('kind', M.EXCHANGE_KINDS, 'Appel', 'class="input" aria-label="Type d’échange"')}
      <input class="input" name="note" placeholder="Ce qui a été dit ou décidé…" aria-label="Échange" required>
      <input class="input" type="date" name="next" aria-label="Prochain suivi" data-tip="Prochain suivi (facultatif)">
      <button class="btn btn-primary" type="submit">${icon('plus', 15)}Noter</button>
    </form>
    ${c.journal.length ? `<ol class="ct-journal">${c.journal.map(j => `<li><span class="ct-j-date">${j.date ? esc(fmt.date(j.date)) : '—'}</span>${j.kind ? `<span class="ct-j-kind">${esc(j.kind)}</span>` : ''}<span class="ct-j-txt">${esc(j.text)}</span></li>`).join('')}</ol>`
      : '<p class="muted ct-j-empty">Aucun échange noté. Chaque note est datée, signée et remonte en tête.</p>'}
    <p class="muted ct-meta">${esc([c.author ? `Ajouté par ${c.author}` : '', c.updated ? `mis à jour ${fmt.rel(new Date(c.updated * 1000))}` : ''].filter(Boolean).join(' · '))}</p>`;
  const footer = `<button class="btn btn-ghost left" data-ct-del>${icon('trash', 15)}Supprimer</button><button class="btn btn-ghost" data-close>Fermer</button><button class="btn btn-primary" data-ct-edit>${icon('edit', 15)}Modifier</button>`;
  return {title, subtitle, body, footer};
}

const byId = id => M.contacts().find(c => c.rowId === id);
const coordText = c => [c.name, [c.role, c.org].filter(Boolean).join(' — '), c.service, c.email, c.phone && `Tél. ${M.prettyPhone(c.phone)}`, c.mobile && `Mobile ${M.prettyPhone(c.mobile)}`, c.address].filter(Boolean).join('\n');
async function copy(textValue, label = 'Copié') {
  try { await navigator.clipboard.writeText(textValue); toast(label); }
  catch { toast('Copie refusée par le navigateur', 'error'); }
}

function openFiche(id) {
  const c = byId(id);
  if (!c) { toast('Contact introuvable', 'info'); return; }
  const parts = ficheParts(c);
  if (drawerOpen() && drawerId() === `ct:${id}`) { patchDrawer(parts); return; }
  openDrawer({id: `ct:${id}`, wide: true, ...parts,
    onClose: () => { if (/[?&]c=/.test(location.hash)) history.replaceState(null, '', '#/contacts'); },
    onMount: el => bindFiche(el, id)});
}

function bindFiche(el, id) {
  el.addEventListener('click', async e => {
    const cp = e.target.closest('[data-copy]');
    if (cp) { copy(cp.dataset.copy); return; }
    const c = byId(id);
    if (!c) return;
    if (e.target.closest('[data-copy-all]')) { copy(coordText(c), 'Coordonnées copiées'); return; }
    if (e.target.closest('[data-vcf]')) {
      downloadText(`${c.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'contact'}.vcf`, M.vcard(c), 'text/vcard;charset=utf-8');
      toast('Carte de visite prête : ouvrez-la pour l’ajouter à vos contacts'); return;
    }
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      fav.disabled = true;
      try { await act([['UpdateRecord', M.CONTACT_TABLE, id, {Favori: !c.fav}]]); openFiche(id); }
      catch (err) { toast(err.message, 'error'); fav.disabled = false; }
      return;
    }
    if (e.target.closest('[data-ct-edit]')) { editDrawer(id); return; }
    if (e.target.closest('[data-ct-del]')) {
      const ok = await confirmDialog({title: 'Supprimer ce contact ?', message: `${c.name} et son journal d’échanges seront retirés de l’annuaire. Vous pourrez annuler juste après.`, confirm: 'Supprimer', danger: true});
      if (!ok) return;
      const backup = fieldsFor(M.CONTACT_TABLE, Object.fromEntries(M.CONTACT_COLUMNS.map(k => [k.id, c.raw[k.id] ?? null])));
      try {
        await act([['RemoveRecord', M.CONTACT_TABLE, id]]);
        closeDrawer();
        toast(`${c.name} supprimé`, 'ok', {action: 'Annuler', timeout: 9000, onAction: async () => {
          try { await act([['AddRecord', M.CONTACT_TABLE, null, backup]]); toast('Contact restauré', 'info'); } catch (err) { toast(err.message, 'error'); }
        }});
      } catch (err) { toast(err.message, 'error'); }
    }
  });
  el.addEventListener('submit', async e => {
    if (e.target.id !== 'ct-log') return;
    e.preventDefault();
    const c = byId(id);
    const v = formData(e.target);
    if (!v.note.trim()) return;
    const btn = e.target.querySelector('[type="submit"]'); btn.disabled = true;
    const line = M.journalLine(v.kind, v.note, author());
    try {
      await act([['UpdateRecord', M.CONTACT_TABLE, id, fieldsFor(M.CONTACT_TABLE, {
        Notes: c.notes ? `${line}\n${c.notes}` : line, Dernier_Echange: M.toGristDate(new Date()),
        ...(v.next ? {Prochain_Suivi: M.toGristDate(new Date(`${v.next}T00:00:00`))} : {}), Derniere_MAJ: M.nowSeconds()})]]);
      toast(`${v.kind} noté${v.next ? ` · suivi le ${fmt.date(new Date(`${v.next}T00:00:00`))}` : ''}`);
      openFiche(id);
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
  });
}

/* ── Création / modification ───────────────────────────────────────── */
function editDrawer(id = null, preset = {}) {
  const c = id ? byId(id) : null;
  const r = c?.raw || preset;
  const orgs = [...new Set(M.contacts().map(x => x.org).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const tags = [...new Set(M.contacts().flatMap(x => x.tags))].sort((a, b) => a.localeCompare(b, 'fr'));
  const v = k => attr(M.text(r[k]));
  openDrawer({id: `ct-edit:${id || 'new'}`, title: c ? `Modifier ${esc(c.name)}` : 'Nouveau contact', subtitle: 'Seuls le nom ou l’organisme sont obligatoires',
    body: `<form class="form-grid" id="ct-form">
      ${field('Civilité', select('Civilite', [['', '—'], 'Madame', 'Monsieur'], M.text(r.Civilite)))}
      ${field('Catégorie', select('Categorie', M.CONTACT_CATEGORIES.map(g => g.key), M.text(r.Categorie) || st.cat || 'Autre'))}
      ${field('Prénom', `<input name="Prenom" value="${v('Prenom')}" autocomplete="off" autofocus>`)}
      ${field('Nom', `<input name="Nom" value="${v('Nom')}" autocomplete="off">`)}
      ${field('Fonction', `<input name="Fonction" value="${v('Fonction')}" placeholder="ex. Comptable public, chef de bureau">`)}
      ${field('Organisme', `<input name="Organisme" value="${v('Organisme')}" list="ct-orgs" placeholder="ex. Préfecture de Mayotte">`)}
      <div class="span-2">${field('Service', `<input name="Service" value="${v('Service')}" placeholder="ex. Bureau des finances locales">`)}</div>
      ${field('E-mail', `<input type="email" name="Email" value="${v('Email')}" inputmode="email">`)}
      ${field('Téléphone', `<input type="tel" name="Telephone" value="${v('Telephone')}" placeholder="0269 …" inputmode="tel">`)}
      ${field('Mobile', `<input type="tel" name="Mobile" value="${v('Mobile')}" placeholder="0639 …" inputmode="tel">`, 'Sert aussi au bouton WhatsApp')}
      ${field('Prochain suivi', `<input type="date" name="Prochain_Suivi" value="${attr(fmt.iso(M.toDate(r.Prochain_Suivi)))}">`)}
      <div class="span-2">${field('Adresse', `<input name="Adresse" value="${v('Adresse')}">`)}</div>
      <div class="span-2">${field('Sujets suivis', `<input name="Sujets" value="${v('Sujets')}" list="ct-tags" placeholder="ex. CFE, TEOM, versement mobilité">`, 'Séparés par des virgules')}</div>
      <label class="span-2 check-line"><input type="checkbox" name="Favori"${r.Favori === true ? ' checked' : ''}> Épingler dans les favoris</label>
      <datalist id="ct-orgs">${orgs.map(o => `<option value="${attr(o)}">`).join('')}</datalist>
      <datalist id="ct-tags">${tags.map(o => `<option value="${attr(o)}">`).join('')}</datalist>
    </form>`,
    footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ct-save>${icon('check', 16)}${c ? 'Enregistrer' : 'Ajouter le contact'}</button>`,
    onMount(el) {
      el.querySelector('[data-ct-save]').addEventListener('click', async e => {
        const btn = e.currentTarget;
        const f = formData(el.querySelector('#ct-form'));
        for (const k of Object.keys(f)) if (typeof f[k] === 'string') f[k] = f[k].trim();
        if (!f.Nom && !f.Prenom && !f.Organisme) { toast('Indiquez au moins un nom ou un organisme', 'error'); return; }
        if (f.Email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.Email)) { toast('Adresse e-mail invalide', 'error'); return; }
        const dup = M.contactDuplicate(f, id);
        if (dup && !await confirmDialog({title: 'Contact déjà présent ?', message: `${dup.name}${dup.org ? ` (${dup.org})` : ''} a la même adresse ou le même nom. Enregistrer quand même ?`, confirm: 'Enregistrer quand même'})) return;
        const fields = fieldsFor(M.CONTACT_TABLE, {...f, Nom: f.Nom, Prochain_Suivi: f.Prochain_Suivi ? M.toGristDate(new Date(`${f.Prochain_Suivi}T00:00:00`)) : null,
          Derniere_MAJ: M.nowSeconds(), ...(id ? {} : {Ajoute_Par: author()})});
        btn.disabled = true;
        try {
          const [newId] = await act([id ? ['UpdateRecord', M.CONTACT_TABLE, id, fields] : ['AddRecord', M.CONTACT_TABLE, null, fields]]);
          const rid = id || newId || Math.max(...rows(M.CONTACT_TABLE).map(x => x.id));
          toast(id ? 'Fiche mise à jour' : 'Contact ajouté');
          openFiche(rid);
          flash(document.querySelector(`[data-ct="${rid}"]`));
        } catch (err) { console.error(err); toast(err.message, 'error'); btn.disabled = false; }
      });
    }});
}

async function createTable(btn) {
  btn.disabled = true;
  try {
    await act([['AddTable', M.CONTACT_TABLE, M.CONTACT_COLUMNS.map(c => ({id: c.id, type: c.type, isFormula: false}))]], [M.CONTACT_TABLE]);
    toast('Annuaire créé dans Grist : ajoutez votre premier contact', 'ok', {timeout: 6000});
    setTimeout(() => editDrawer(), 150);
  } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
}

function exportCsv() {
  const list = filtered(M.contacts());
  const head = ['Catégorie', 'Organisme', 'Service', 'Civilité', 'Prénom', 'Nom', 'Fonction', 'E-mail', 'Téléphone', 'Mobile', 'Adresse', 'Sujets', 'Dernier échange', 'Prochain suivi'];
  downloadCsv(`contacts-cadema-${new Date().toLocaleDateString('fr-CA')}.csv`, head, list.map(c => [c.category, c.org, c.service, c.civ, c.first, c.last, c.role, c.email, c.phone, c.mobile, c.address, c.tags.join(', '), c.lastAt ? fmt.date(c.lastAt) : '', c.next ? fmt.date(c.next) : '']));
  toast(`${list.length} contact${list.length > 1 ? 's' : ''} exporté${list.length > 1 ? 's' : ''}`);
}

export function mount(root, {params} = {}) {
  const want = Number(params?.get?.('c'));
  if (want && M.contactsReady() && !(drawerOpen() && drawerId() === `ct:${want}`)) openFiche(want);
  if (params?.get?.('new') === '1' && M.contactsReady()) { history.replaceState(null, '', '#/contacts'); editDrawer(); }
  bindSearch(root);
  if (root.dataset.ctBound) return;
  root.dataset.ctBound = '1';
  root.addEventListener('click', e => {
    const cr = e.target.closest('[data-ct-create]');
    if (cr) { createTable(cr); return; }
    if (e.target.closest('[data-ct-new]')) { editDrawer(); return; }
    if (e.target.closest('[data-ct-csv]')) { exportCsv(); return; }
    const cp = e.target.closest('[data-copy-ct]');
    if (cp) { const c = byId(Number(cp.dataset.copyCt)); if (c) copy(coordText(c), 'Coordonnées copiées'); return; }
    if (e.target.closest('.ct-quick a')) return;
    const cat = e.target.closest('[data-cat]');
    if (cat) { st.cat = cat.dataset.cat; redraw(root); return; }
    const vw = e.target.closest('[data-view]');
    if (vw) { st.view = vw.dataset.view === st.view ? '' : vw.dataset.view; redraw(root); return; }
    const c = e.target.closest('[data-ct]');
    if (c) { history.replaceState(null, '', `#/contacts?c=${c.dataset.ct}`); openFiche(Number(c.dataset.ct)); }
  });
  root.addEventListener('keydown', e => {
    const c = e.target.closest?.('[data-ct]');
    if (c && e.target === c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openFiche(Number(c.dataset.ct)); }
  });
}
function bindSearch(root) {
  root.querySelector('.search-field input')?.addEventListener('input', ev => {
    st.q = ev.target.value;
    const list = filtered(M.contacts());
    root.querySelector('[data-ct-body]').innerHTML = grid(list);
    root.querySelector('.result-count').textContent = `${list.length} / ${M.contacts().length}`;
  });
}

/* Redessine toute la page (filtres), en gardant la recherche. */
function redraw(root) {
  const q = root.querySelector('.search-field input');
  const pos = q?.selectionStart;
  root.innerHTML = render();
  bindSearch(root);
  const nq = root.querySelector('.search-field input');
  if (q && document.activeElement === q && nq) { nq.focus(); nq.setSelectionRange(pos, pos); }
}
