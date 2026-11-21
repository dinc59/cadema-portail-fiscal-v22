import * as M from '../model.js';
import { rows, db } from '../grist.js';
import { esc, icon, fmt, badge, avatar } from '../ui.js';
import { refCard, createRef } from './taux.js';

const HIDDEN = new Set(['PORTAL_STATE_JSON', 'PORTAL_STATE_UPDATED_AT']);

export function render({app}) {
  const ppl = M.people();
  const params = rows('Parametres').filter(r => !HIDDEN.has(M.text(r.Cle)));
  return `
  <section class="ph"><div><p class="ph-eyebrow">Équipe &amp; paramètres</p><h1>Le pôle fiscalité</h1>
    <p class="ph-lede">Les personnes viennent de la table Utilisateurs. Les droits d’accès réels sont ceux du partage Grist ; le choix « Vous êtes » sert seulement à signer les modifications.</p></div></section>
  <section class="grid g-main">
    <article class="card">
      <div class="rows">${ppl.map(p => `<div class="row">
        ${avatar(p.name, 36)}
        <span class="row-main"><b>${esc(p.name)}${p.name === app.profile ? ' <span class="muted">· vous</span>' : ''}</b><span>${esc([p.role, p.pole].filter(Boolean).join(' · ') || 'Rôle non renseigné')}</span></span>
        ${p.declared ? badge(p.role || 'Membre', /admin/i.test(p.role) ? 'accent' : 'neutral') : badge('Hors table Utilisateurs', 'warn')}
      </div>`).join('') || '<p class="card-body muted">Aucun utilisateur.</p>'}</div>
    </article>
    <aside class="stack">
      <article class="card">
        <div class="card-head"><h2>Paramètres du document</h2></div>
        <div class="rows" style="margin-top:8px">${params.map(r => `<div class="row"><span class="row-main"><b>${esc(M.text(r.Cle))}</b><span>${esc(M.text(r.Description) || M.text(r.Categorie))}</span></span><span class="param-v">${esc(M.text(r.Valeur))}</span></div>`).join('')}</div>
      </article>
      <article class="card card-pad">
        <h2 class="card-title">Connexion au document</h2>
        <p class="card-sub" style="margin-top:6px">Dernière lecture ${esc(fmt.rel(db.syncedAt))} · ${Object.keys(db.tables).length} tables lues${db.missing.length ? ` · absentes : ${esc(db.missing.join(', '))}` : ''}.</p>
        <button class="btn btn-sm mt" data-refresh>${icon('refresh', 14)}Relire maintenant</button>
      </article>
    </aside>
  </section>
  ${refCard()}`;
}

export function mount(root) {
  root.addEventListener('click', e => {
    const rc = e.target.closest('[data-ref-create]');
    if (rc) createRef(rc);
  });
}
