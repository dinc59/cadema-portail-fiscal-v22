/* Espace « Nouveautés » : l'historique des mises à jour, lisible par
   toute l'équipe, avec un lien vers chaque écran concerné. */
import { CHANGELOG, seenId, markSeen } from '../changelog.js';
import { esc, attr, icon, toast } from '../ui.js';

const tagTone = t => ({'Nouveau': 'accent', 'Amélioré': 'info', 'Corrigé': 'good'}[t] || 'neutral');
const day = iso => new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', {day: 'numeric', month: 'long', year: 'numeric'});
const cmp = (a, b) => a.localeCompare(b, 'fr', {numeric: true});

export function render() {
  const seen = seenId();
  const counts = CHANGELOG.reduce((c, r) => { for (const i of r.items) c[i.tag] = (c[i.tag] || 0) + 1; return c; }, {});
  return `
  <section class="ph">
    <div>
      <p class="ph-eyebrow">${icon('present', 14)}Nouveautés du portail</p>
      <h1>Ce qui a changé dans le portail fiscal</h1>
      <p class="ph-lede">Chaque mise à jour est décrite ici, avec un lien vers l’écran concerné. ${Object.entries(counts).map(([t, n]) => `${n} ${({'Nouveau': n > 1 ? 'nouveautés' : 'nouveauté', 'Amélioré': n > 1 ? 'améliorations' : 'amélioration', 'Corrigé': n > 1 ? 'corrections' : 'correction'})[t] || t}`).join(' · ')} depuis la mise en service de la nouvelle version.</p>
    </div>
    <div class="ph-actions"><button class="btn" data-copy-news>${icon('file', 15)}Copier le résumé pour l’équipe</button></div>
  </section>

  <ol class="releases">
    ${CHANGELOG.map((r, i) => {
      const isNew = seen && cmp(r.id, seen) > 0;
      return `<li class="release${isNew ? ' is-new' : ''}" style="--d:${i * 50}ms">
        <div class="release-when"><b>${esc(day(r.date))}</b><span>Version ${esc(r.id)}</span>${isNew ? '<span class="badge badge-accent"><span class="badge-dot"></span>Nouveau pour vous</span>' : ''}</div>
        <span class="release-dot" aria-hidden="true"></span>
        <article class="card release-card">
          <h2>${esc(r.title)}</h2>
          <p class="release-sum">${esc(r.summary)}</p>
          <ul class="release-items">
            ${r.items.map(it => `<li><span class="badge badge-${tagTone(it.tag)}">${esc(it.tag)}</span><span class="release-txt">${esc(it.text)}</span>${it.href ? `<a class="link release-go" href="${attr(it.href)}">Voir ${icon('arrow', 13)}</a>` : ''}</li>`).join('')}
          </ul>
        </article>
      </li>`;
    }).join('')}
  </ol>`;
}

/* Résumé en texte brut, à coller dans un message à l'équipe. */
function summaryText() {
  return ['Portail fiscal CADEMA — nouveautés', '',
    ...CHANGELOG.flatMap(r => [`${day(r.date)} · ${r.title}`, ...r.items.map(it => `  - [${it.tag}] ${it.text}`), '']),
    'Le détail est dans le portail : menu du profil (en haut à droite) → Nouveautés du portail.'].join('\n');
}

export function mount(root) {
  /* Ouvrir la page vaut lecture : le bandeau de l'accueil disparaît. */
  markSeen();
  document.querySelector('.news-dot')?.remove();
  root.addEventListener('click', async e => {
    if (!e.target.closest('[data-copy-news]')) return;
    try { await navigator.clipboard.writeText(summaryText()); toast('Résumé copié : collez-le dans un courriel ou une messagerie'); }
    catch { toast('Copie refusée par le navigateur', 'error'); }
  });
}
