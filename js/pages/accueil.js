import * as M from '../model.js';
import { esc, attr, icon, fmt, badge } from '../ui.js';
import { stackedBars, lineChart, ring, spark, donut, linkDonut, mountChart, countUp, morph } from '../charts.js';
import { unseen, markSeen } from '../changelog.js';

/* Vue de la trajectoire (barres ou courbe), mémorisée sur ce poste. */
const VIEW_KEY = 'cadema-v22-traj-view';
const trajView = () => { try { return localStorage.getItem(VIEW_KEY) === 'line' ? 'line' : 'bars'; } catch { return 'bars'; } };
const setTrajView = v => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* stockage bloqué */ } };

/* Pastille de variation : signe, couleur, et libellé complet pour les lecteurs d'écran. */
const deltaPill = (d, vs) => `<span class="delta-pill ${d >= 0 ? 'up' : 'down'}" title="${attr(`${fmt.delta(d)} ${vs}`)}"><svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="${d >= 0 ? 'M5 1.5 9 7.5H1z' : 'M5 8.5 1 2.5h8z'}"/></svg>${esc(fmt.delta(d))}</span>`;

function comparable(year) {
  /* Évolution à périmètre constant : seuls les produits connus les deux
     années sont comparés, sinon un produit manquant ressemble à une baisse. */
  let a = 0, b = 0, n = 0;
  for (const t of M.TAXES) {
    const x = M.taxCell(t.code, year)?.amount, y = M.taxCell(t.code, year - 1)?.amount;
    if (x != null && y != null) { a += x; b += y; n++; }
  }
  return n && b ? {delta: a / b - 1, n} : null;
}

export function render({year, app}) {
  const tot = M.taxTotal(year);
  const cmp = comparable(year);
  const rs = M.rsYear(year);
  const tasks = M.tasks();
  const open = tasks.filter(t => t.status !== 'Terminé');
  const q = M.quality(year);
  const ys = M.taxYears().filter(y => y <= Math.max(year, ...M.taxYears()));
  const today = new Date();
  const news = unseen();
  const hello = today.getHours() < 18 ? 'Bonjour' : 'Bonsoir';
  const plans = M.plans();
  const planCounts = M.PLAN_STATUSES.map(s => [s, plans.filter(p => p.status === s).length]).filter(([, n]) => n);
  const events = M.events().filter(e => e.start && e.start >= new Date(today.toDateString())).slice(0, 4);
  const attention = q.checks.filter(c => !c.ok).sort((a, b) => ({critical: 0, warn: 1, info: 2}[a.level] - {critical: 0, warn: 1, info: 2}[b.level])).slice(0, 5);
  const sitOrder = ['Soldée', 'Titre émis', 'Pas encore titré', 'À vérifier', 'À compléter', 'Partiellement réglée', 'Non concernée', 'Sans suivi'];
  const sitColor = {'Soldée': 'var(--good)', 'Titre émis': 'var(--info)', 'Pas encore titré': 'color-mix(in srgb, var(--info) 55%, var(--surface))', 'À vérifier': 'var(--warn)', 'À compléter': 'color-mix(in srgb, var(--warn) 55%, var(--surface))', 'Partiellement réglée': 'var(--serious)', 'Non concernée': 'var(--line-2)', 'Sans suivi': 'var(--sunk)'};
  const sitTotal = rs.list.length || 1;
  /* Historiques pour les mini-courbes : uniquement des lectures du modèle. */
  const tys = M.taxYears();
  const totals = tys.map(y => M.taxTotal(y).total || null);
  const rsPrev = M.rsYear(year - 1);
  const rsDelta = rsPrev.paid > 0 && rs.paid > 0 ? rs.paid / rsPrev.paid - 1 : null;
  const rsYs = M.years().filter(y => y <= year).slice(-8);
  const paidHist = rsYs.map(y => { const r = y === year ? rs : M.rsYear(y); return r.billed ? r.paid : null; });
  const tStat = [['À traiter', 'var(--warn)'], ['En cours', 'var(--info)'], ['Terminé', 'var(--good)']].map(([s, c]) => [s, c, tasks.filter(t => t.status === s).length]);
  const view = trajView();

  return `
  <section class="ph">
    <div>
      <p class="ph-eyebrow">${esc(today.toLocaleDateString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}))}</p>
      <h1>${hello}${app.profile ? ` ${esc(app.profile)}` : ''}. Voici l’essentiel de ${year}.</h1>
      <p class="ph-lede">Recettes, redevance, priorités et qualité des données — tout est lu en direct dans le document Grist du pôle.</p>
    </div>
    <div class="ph-actions">
      <a class="btn" href="#/reunion">${icon('present', 16)}Mode réunion</a>
      <a class="btn" href="#/rapport">${icon('download', 16)}Point mensuel (PDF)</a>
      <a class="btn btn-primary" href="#/pilotage?new=1">${icon('plus', 16)}Nouvelle priorité</a>
    </div>
  </section>
  ${news.length ? `<div class="news-banner" data-news>
    <span class="news-ic">${icon('info', 16)}</span>
    <span class="row-main"><b>Le portail a été mis à jour</b><span>${esc(news.map(r => r.title).join(' · '))}</span></span>
    <a class="btn btn-sm" href="#/nouveautes">Voir les nouveautés</a>
    <button class="icon-btn" data-news-x aria-label="Masquer" data-tip="Masquer">${icon('x', 16)}</button>
  </div>` : ''}

  <section class="grid g-4">
    <a class="card kpi kpi-plus" href="#/recettes">
      <span class="kpi-link">${icon('up', 16)}</span>
      <span class="kpi-label">Produits fiscaux ${year}</span>
      <span class="kpi-value"><span data-count="${tot.total}" data-fmt="short" data-count-key="home-total">${esc(fmt.short(tot.total))}</span></span>
      <span class="kpi-meta">${cmp ? `${deltaPill(cmp.delta, `par rapport à ${year - 1}`)} vs ${year - 1} à périmètre constant` : 'Pas de comparaison possible'}</span>
      <span class="kpi-foot">
        <span class="kpi-meta">${tot.covered === 6 ? badge('6 produits sur 6', 'good') : badge(`${tot.covered} produits sur 6`, 'warn')}</span>
        <span class="kpi-spark" data-tip="${attr(`<b>Produits renseignés</b><br>${tys.map((y, i) => `${y} <span class="tip-v">${esc(fmt.short(totals[i]))}</span>`).join('<br>')}`)}">${spark(totals, {color: 'var(--accent)', mark: tys.indexOf(year), area: true, w: 104, h: 34})}</span>
      </span>
    </a>
    <a class="card kpi kpi-plus" href="#/redevance">
      <span class="kpi-link">${icon('up', 16)}</span>
      <span class="kpi-label">Redevance spéciale ${year}</span>
      <span class="kpi-value"><span data-count="${rs.paid}" data-fmt="short" data-count-key="home-rs-paid">${esc(fmt.short(rs.paid))}</span><small>encaissés</small></span>
      <span class="kpi-meta">${rsDelta !== null ? `${deltaPill(rsDelta, `d’encaissements par rapport à ${year - 1}`)} vs ${year - 1} · ` : ''}sur ${esc(fmt.eur(rs.billed))} facturés · ${esc(fmt.pct(rs.rate))}</span>
      <span class="kpi-foot">
        <div class="bar" role="img" aria-label="Taux de recouvrement ${attr(fmt.pct(rs.rate))}"><span style="width:${Math.round((rs.rate || 0) * 100)}%"></span></div>
        <span class="kpi-spark" data-tip="${attr(`<b>Encaissé par exercice</b><br>${rsYs.map((y, i) => `${y} <span class="tip-v">${esc(fmt.short(paidHist[i]))}</span>`).join('<br>')}`)}">${spark(paidHist, {color: 'var(--good)', mark: rsYs.indexOf(year), area: true, w: 104, h: 34})}</span>
      </span>
    </a>
    <a class="card kpi kpi-plus" href="#/pilotage">
      <span class="kpi-link">${icon('up', 16)}</span>
      <span class="kpi-label">Priorités ouvertes</span>
      <span class="kpi-value"><span data-count="${open.length}" data-fmt="int" data-count-key="home-open">${open.length}</span><small>/ ${tasks.length}</small></span>
      <span class="kpi-meta">${open.filter(t => t.status === 'En cours').length} en cours · ${open.filter(t => t.status === 'À traiter').length} à traiter</span>
      <span class="kpi-meta">${tasks.filter(t => t.status === 'Terminé').length} terminée(s)</span>
      ${tasks.length ? `<span class="mini-stack" role="img" aria-label="${attr(tStat.map(([s, , n]) => `${s} : ${n}`).join(', '))}">${tStat.filter(([, , n]) => n).map(([s, c, n]) => `<span style="flex:${n};background:${c}" data-tip="${attr(`<b>${esc(s)}</b> · ${n}`)}"></span>`).join('')}</span>` : ''}
    </a>
    <a class="card kpi kpi-ring kpi-plus" href="#/pilotage?tab=qualite" style="flex-direction:row;align-items:center;gap:16px">
      ${ring(q.score, {size: 84, stroke: 7, tone: q.score >= 80 ? 'good' : q.score >= 60 ? 'accent' : 'warn', key: 'home-quality'})}
      <span style="display:grid;gap:4px">
        <span class="kpi-label">Qualité des données</span>
        <span class="kpi-meta">${q.open ? `${q.open} point(s) à corriger` : 'Tout est en ordre'}</span>
        ${q.critical ? `<span>${badge(`${q.critical} critique(s)`, 'critical')}</span>` : ''}
      </span>
    </a>
  </section>

  <section class="grid g-main mt">
    <article class="card traj-card" data-traj-card data-view="${view}">
      <div class="card-head">
        <div><h2>Trajectoire des produits fiscaux</h2><p class="card-sub"><span class="v-bars">Par exercice, empilés par produit.</span><span class="v-line">Total renseigné par exercice.</span> Sous chaque année : produits renseignés sur 6.</p></div>
        <div class="card-tools">
          <div class="seg-ctl seg-mini" role="group" aria-label="Affichage de la trajectoire">
            <button type="button" data-traj="bars" aria-pressed="${view === 'bars'}">${icon('chart', 14)}Barres</button>
            <button type="button" data-traj="line" aria-pressed="${view === 'line'}">${icon('trend', 14)}Courbe</button>
          </div>
          <a class="btn btn-sm btn-ghost" href="#/recettes">${icon('table', 15)}Tableau</a>
        </div>
      </div>
      <div class="card-body">
        <div class="chart-slot" data-chart="traj"></div>
        <div class="legend mt v-bars">${M.TAXES.map(t => `<span><span class="sw" style="background:var(--s${t.slot})"></span>${esc(t.short)}</span>`).join('')}
          <span class="muted">Barre atténuée = exercice incomplet</span></div>
        <div class="legend mt v-line"><span><span class="sw sw-line"></span>Total des produits renseignés</span>
          <span class="muted">Point creux et tirets = exercice incomplet · ← → pour parcourir les exercices au clavier</span></div>
      </div>
    </article>
    <div class="stack">
      <article class="card">
        <div class="card-head"><div><h2>À corriger en priorité</h2><p class="card-sub">Contrôles calculés sur les tables</p></div></div>
        <div class="rows mt" style="margin-top:10px">
          ${attention.length ? attention.map(c => `<a class="row" href="${attr(c.route)}">
            <span class="notif-dot tone-${c.level}" aria-hidden="true"></span>
            <span class="row-main"><b>${esc(c.title)}</b><span>${esc(c.fix)}</span></span>
            <span class="num strong">${c.count}</span></a>`).join('')
          : `<div class="empty">${icon('checkCircle', 22)}<p class="empty-text">Aucun point ouvert.</p></div>`}
        </div>
      </article>
      <article class="card">
        <div class="card-head"><h2>Prochaines échéances</h2><a class="link" href="#/pilotage?tab=calendrier">Calendrier ${icon('arrow', 14)}</a></div>
        <div class="rows" style="margin-top:10px">
          ${events.length ? events.map(e => `<div class="row"><span class="date-tile"><b>${e.start.getDate()}</b><span>${esc(e.start.toLocaleDateString('fr-FR', {month: 'short'}))}</span></span>
            <span class="row-main"><b>${esc(e.title)}</b><span>${esc([e.module, e.owner].filter(Boolean).join(' · '))}</span></span></div>`).join('')
          : `<p class="card-body muted" style="padding-top:4px">Aucune échéance à venir. <a class="link" href="#/pilotage?tab=calendrier&new=1">Ajouter</a></p>`}
        </div>
      </article>
    </div>
  </section>

  <section class="grid g-3 mt">
    <article class="card card-pad" data-compo>
      <h2 class="card-title">Composition ${year}</h2>
      <p class="card-sub">Part de chaque produit dans le total renseigné</p>
      ${tot.total ? `<div class="dn-wrap mt">${donut(tot.parts.map(p => ({code: p.code, label: p.short, slot: p.slot, amount: p.amount})), {size: 168, stroke: 20, key: 'home-compo', label: `Total ${year}`})}</div>` : ''}
      <div class="compo mt">
        ${tot.parts.slice().sort((a, b) => (b.amount || 0) - (a.amount || 0)).map(p => `<a class="compo-row" href="#/recettes/${p.code}" data-code="${attr(p.code)}"${p.amount ? ` data-share="${attr(fmt.pct(p.amount / tot.total, 1))}" data-name="${attr(`${p.short} · ${fmt.short(p.amount)}`)}"` : ''}>
          <span class="compo-name"><span class="sw" style="background:var(--s${p.slot})"></span>${esc(p.short)}</span>
          <span class="compo-bar"><span style="width:${p.amount ? Math.max(1.5, p.amount / tot.total * 100) : 0}%;background:var(--s${p.slot})"></span></span>
          <span class="compo-val num">${p.amount != null ? esc(fmt.short(p.amount)) : '<i class="miss">—</i>'}</span>
          <span class="compo-pct num">${p.amount != null && tot.total ? esc(fmt.pct(p.amount / tot.total)) : ''}</span>
        </a>`).join('')}
      </div>
    </article>
    <article class="card card-pad">
      <h2 class="card-title">Redevance ${year} · ${rs.list.length} dossiers</h2>
      <p class="card-sub">Situation de chaque entreprise pour l’exercice</p>
      <div class="stackbar mt" role="img" aria-label="Répartition des situations">
        ${sitOrder.filter(s => rs.counts[s]).map(s => `<span style="flex:${rs.counts[s]};background:${sitColor[s]}" data-tip="${attr(`<b>${esc(s)}</b> · ${rs.counts[s]} dossier(s)`)}"></span>`).join('')}
      </div>
      <div class="sit-list mt">
        ${sitOrder.filter(s => rs.counts[s]).map(s => `<a class="sit-row" href="#/redevance?situation=${encodeURIComponent(s)}">
          <span class="sw" style="background:${sitColor[s]}"></span><span>${esc(s)}</span><span class="num">${rs.counts[s]}</span><span class="num muted">${esc(fmt.pct(rs.counts[s] / sitTotal))}</span></a>`).join('')}
      </div>
    </article>
    <article class="card card-pad">
      <h2 class="card-title">Plan d’actions 2026–2029</h2>
      <p class="card-sub">${plans.length} actions · ${new Set(plans.map(p => p.axis)).size} axes</p>
      <div class="sit-list mt">
        ${planCounts.map(([s, n]) => `<a class="sit-row" href="#/pilotage?tab=plans&statut=${encodeURIComponent(s)}">${badge(s, planTone(s))}<span></span><span class="num">${n}</span><span class="num muted">${esc(fmt.pct(n / (plans.length || 1)))}</span></a>`).join('')}
      </div>
      <a class="link mt" style="display:inline-flex" href="#/pilotage?tab=plans">Ouvrir le plan ${icon('arrow', 14)}</a>
    </article>
  </section>`;
}

export const planTone = s => ({'Réalisé': 'good', 'En cours': 'info', 'À sécuriser': 'warn', 'Abandonné': 'neutral'}[s] || 'accent');

export function mount(root, {year}) {
  const data = M.taxYears().map(y => ({year: y, ...M.taxTotal(y)}));
  const card = root.querySelector('[data-traj-card]');
  const drawTraj = replay => {
    const old = card.querySelector('[data-chart="traj"]');
    const slot = old.cloneNode(false);
    old.replaceWith(slot);
    const line = card.dataset.view === 'line';
    mountChart(slot, w => (line ? lineChart : stackedBars)(data, {width: w, active: year, key: 'home-traj'}), {replay});
  };
  drawTraj(false);
  countUp(root);
  root.querySelectorAll('.kpi-ring, .dn').forEach(el => morph(el));
  linkDonut(root.querySelector('[data-compo]'));
  root.addEventListener('click', e => {
    const tv = e.target.closest('[data-traj]');
    if (tv) {
      if (card.dataset.view === tv.dataset.traj) return;
      card.dataset.view = tv.dataset.traj;
      setTrajView(tv.dataset.traj);
      card.querySelectorAll('[data-traj]').forEach(b => b.setAttribute('aria-pressed', b === tv));
      drawTraj(true);
      return;
    }
    const seg = e.target.closest('.dn-seg[data-code]');
    if (seg) { location.hash = `#/recettes/${seg.dataset.code}`; return; }
    if (e.target.closest('.hit[data-year]')) { location.hash = '#/recettes'; return; }
    if (e.target.closest('[data-news-x]')) {
      markSeen();
      const b = root.querySelector('[data-news]');
      document.querySelector('.news-dot')?.remove();
      /* Sortie plus rapide que l'entrée : le bandeau s'efface, puis la place se referme. */
      b.animate([{opacity: 1, transform: 'none'}, {opacity: 0, transform: 'translateY(-4px)'}], {duration: 150, easing: 'ease-out'}).onfinish = () => {
        const h = b.offsetHeight;
        b.style.visibility = 'hidden';
        b.animate([{height: `${h}px`, marginBottom: '16px'}, {height: '0px', marginBottom: '0px'}], {duration: 180, easing: 'cubic-bezier(.23,1,.32,1)'}).onfinish = () => b.remove();
      };
    }
  });
}
