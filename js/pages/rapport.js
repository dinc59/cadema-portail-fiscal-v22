/* Point mensuel imprimable (#/rapport). « Imprimer ou enregistrer en PDF »
   ouvre la fenêtre d'impression du navigateur : choisir « Enregistrer au
   format PDF ». Aucune bibliothèque, aucun envoi : tout reste sur le poste. */
import * as M from '../model.js';
import { esc, icon, fmt } from '../ui.js';
import { stackedBars } from '../charts.js';
import { LOGO, author, CREDIT } from '../main.js';
import { sections } from './reunion.js';

export function render({year}) {
  const now = new Date();
  const month = now.toLocaleDateString('fr-FR', {month: 'long', year: 'numeric'});
  const list = sections(year);
  return `
  <div class="report-tools">
    <a class="crumb" href="#/">${icon('left', 14)}Accueil</a>
    <span class="toolbar-gap"></span>
    <a class="btn" href="#/reunion">${icon('present', 15)}Mode réunion</a>
    <button class="btn btn-primary" data-print>${icon('download', 15)}Imprimer ou enregistrer en PDF</button>
  </div>
  <p class="report-hint">Dans la fenêtre d’impression, choisissez « Enregistrer au format PDF » comme imprimante. Format A4 portrait.</p>
  <article class="report">
    <header class="report-head">
      ${LOGO.replace('logo-mark', 'logo-mark report-logo')}
      <div><p class="report-org">CADEMA · Pôle fiscalité</p><h1>Point fiscal mensuel — ${esc(month)}</h1>
        <p class="report-meta">Exercice ${year} · établi le ${esc(now.toLocaleDateString('fr-FR'))}${author() !== 'Portail' ? ` par ${esc(author())}` : ''}</p></div>
    </header>
    ${list.map((s, i) => `<section class="report-sec">
      <p class="report-kicker">${i + 1}. ${esc(s.kicker)}</p>
      <h2>${esc(s.title)}</h2>
      ${s.id === 'trajectoire' ? `<div class="report-chart">${stackedBars(M.taxYears().map(y => ({year: y, ...M.taxTotal(y)})), {width: 680, height: 260, active: year})}</div>
        <div class="legend">${M.TAXES.map(t => `<span><span class="sw" style="background:var(--s${t.slot})"></span>${esc(t.short)}</span>`).join('')}<span class="muted">Sous chaque année : produits renseignés sur 6</span></div>` : s.html}
    </section>`).join('')}
    <footer class="report-foot">Chiffres extraits du document Grist du pôle fiscalité le ${esc(now.toLocaleString('fr-FR', {dateStyle: 'long', timeStyle: 'short'}))}. Un montant « non renseigné » est absent de la table, il n’est pas compté comme zéro.<span class="report-credit">${CREDIT}</span></footer>
  </article>`;
}

export function mount(root) {
  document.body.classList.add('is-report');
  root.querySelector('[data-print]').addEventListener('click', () => {
    const title = document.title;
    document.title = `Point fiscal ${new Date().toISOString().slice(0, 7)} - CADEMA`;
    addEventListener('afterprint', () => { document.title = title; }, {once: true});
    print();
  });
}
