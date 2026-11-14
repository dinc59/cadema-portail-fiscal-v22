/* Mode réunion (#/reunion) et point mensuel imprimable (#/rapport).
   Les deux affichent les mêmes sections, calculées depuis les tables :
   une par diapositive en réunion, toutes à la suite dans le rapport. */
import * as M from '../model.js';
import { esc, attr, icon, fmt, badge } from '../ui.js';
import { stackedBars, ring, mountChart } from '../charts.js';
import { LOGO, CREDIT } from '../main.js';
import { planTone } from './accueil.js';

const today = () => new Date();
const longDate = d => d.toLocaleDateString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'});

function comparable(year) {
  let a = 0, b = 0, n = 0;
  for (const t of M.TAXES) {
    const x = M.taxCell(t.code, year)?.amount, y = M.taxCell(t.code, year - 1)?.amount;
    if (x != null && y != null) { a += x; b += y; n++; }
  }
  return n && b ? a / b - 1 : null;
}

/* Chaque section : {id, kicker, title, html, chart?} */
export function sections(year) {
  const tot = M.taxTotal(year);
  const d = comparable(year);
  const rs = M.rsYear(year);
  const rec = M.recovery();
  const tasks = M.tasks().filter(t => t.status !== 'Terminé');
  const plans = M.plans();
  const q = M.quality(year);
  const soon = M.events().filter(e => e.start && e.start >= new Date(today().toDateString())).slice(0, 6);
  const big = (v, l) => `<div class="m-big"><b>${v}</b><span>${l}</span></div>`;
  return [
    {id: 'recettes', kicker: 'Recettes fiscales', title: `${fmt.eur(tot.total)} de produits en ${year}`,
      html: `<div class="m-row">${big(esc(fmt.short(tot.total)), `${tot.covered} produit(s) sur 6 renseigné(s)`)}${big(d != null ? esc(fmt.delta(d)) : '—', `par rapport à ${year - 1}, à périmètre constant`)}</div>
        <div class="m-compo">${tot.parts.slice().sort((a, b) => (b.amount || 0) - (a.amount || 0)).map(p => `<div class="m-compo-row"><span><span class="sw" style="background:var(--s${p.slot})"></span>${esc(p.short)}</span>
          <span class="compo-bar"><span style="width:${p.amount && tot.total ? Math.max(1.5, p.amount / tot.total * 100) : 0}%;background:var(--s${p.slot})"></span></span>
          <b class="num">${p.amount != null ? esc(fmt.eur(p.amount)) : 'non renseigné'}</b></div>`).join('')}</div>`},
    {id: 'trajectoire', kicker: 'Trajectoire', title: 'Produits fiscaux par exercice',
      html: `<div class="chart-slot" data-chart="m-traj"></div><div class="legend">${M.TAXES.map(t => `<span><span class="sw" style="background:var(--s${t.slot})"></span>${esc(t.short)}</span>`).join('')}<span class="muted">Sous chaque année : produits renseignés sur 6</span></div>`,
      chart: (slot, w) => mountChart(slot, ww => stackedBars(M.taxYears().map(y => ({year: y, ...M.taxTotal(y)})), {width: ww, height: Math.min(380, Math.max(240, w * 0.38)), active: year}))},
    {id: 'redevance', kicker: 'Redevance spéciale', title: `${fmt.eur(rs.paid)} encaissés sur ${fmt.eur(rs.billed)} facturés en ${year}`,
      html: `<div class="m-row">${big(esc(fmt.pct(rs.rate, 1)), 'recouvré sur l’exercice')}${big(esc(fmt.short(rec.confirmed)), 'à recouvrer, tous exercices (dossiers qualifiés)')}${big(esc(fmt.short(rec.unsure)), 'encore à vérifier')}</div>
        <div class="m-stages">${M.RECOVERY_STAGES.map(s => `<div>${badge(s.key, s.tone)}<b class="num">${esc(fmt.eur(rec.amounts[s.key] || 0))}</b><span>${rec.counts[s.key] || 0} dossier(s)</span></div>`).join('')}</div>`},
    {id: 'pilotage', kicker: 'Pilotage', title: `${tasks.length} priorité(s) ouverte(s)`,
      html: `<div class="m-cols"><ul class="m-list">${tasks.slice(0, 7).map(t => `<li>${badge(t.status, t.status === 'En cours' ? 'info' : 'accent')}<span>${esc(t.title)}</span>${t.owner ? `<em>${esc(t.owner)}</em>` : ''}</li>`).join('') || '<li class="muted">Aucune priorité ouverte</li>'}${tasks.length > 7 ? `<li class="muted">et ${tasks.length - 7} autre(s)</li>` : ''}</ul>
        <div><p class="m-sub">Plan d’actions 2026–2029 · ${plans.length} actions</p>${M.PLAN_STATUSES.filter(s => plans.some(p => p.status === s)).map(s => `<div class="m-stat">${badge(s, planTone(s))}<b class="num">${plans.filter(p => p.status === s).length}</b></div>`).join('')}</div></div>`},
    {id: 'qualite', kicker: 'Qualité des données', title: `Indice ${q.score} sur 100`,
      html: `<div class="m-cols"><div class="m-ring">${ring(q.score, {size: 180, stroke: 14, tone: q.score >= 80 ? 'good' : q.score >= 60 ? 'accent' : 'warn', label: 'sur 100'})}</div>
        <ul class="m-list">${q.checks.filter(c => !c.ok).slice(0, 6).map(c => `<li>${badge(c.level === 'critical' ? 'Critique' : c.level === 'warn' ? 'Vigilance' : 'À compléter', c.level === 'critical' ? 'critical' : c.level === 'warn' ? 'warn' : 'info')}<span>${esc(c.title)}</span><em class="num">${c.count}</em></li>`).join('') || '<li class="muted">Aucun point ouvert</li>'}</ul></div>`},
    {id: 'echeances', kicker: 'À venir', title: 'Prochaines échéances',
      html: soon.length ? `<ul class="m-list m-dates">${soon.map(e => `<li><span class="date-tile"><b>${e.start.getDate()}</b><span>${esc(e.start.toLocaleDateString('fr-FR', {month: 'short'}))}</span></span><span>${esc(e.title)}</span><em>${esc(e.owner || '')}</em></li>`).join('')}</ul>`
        : '<p class="muted">Aucune échéance inscrite au calendrier. Pilotage → Calendrier → « Échéances de l’année ».</p>'},
  ];
}

/* ── Mode réunion ─────────────────────────────────────────────────── */
let slide = 0;
let keyHandler = null;
export function render({year}) {
  const list = sections(year);
  slide = Math.min(slide, list.length);
  const cover = `<section class="m-slide m-cover" data-i="0"><div>${LOGO.replace('logo-mark', 'logo-mark m-logo')}
    <p class="m-kicker">Pôle fiscalité · CADEMA</p><h1>Point fiscal ${year}</h1><p class="m-date">${esc(longDate(today()))}</p></div></section>`;
  return `<div class="meeting" data-meeting>
    <div class="m-bar">
      <span class="m-brand">${LOGO.replace('logo-mark', 'logo-mark logo-sm')} Point fiscal ${year}</span>
      <span class="m-dots" role="tablist">${['Couverture', ...list.map(s => s.kicker)].map((l, i) => `<button role="tab" class="m-dot" data-go="${i}" aria-label="${attr(l)}" aria-selected="${i === slide}"></button>`).join('')}</span>
      <span class="m-actions"><button class="icon-btn" data-full aria-label="Plein écran" data-tip="Plein écran (F)">${icon('present', 18)}</button>
        <a class="btn btn-sm" href="#/rapport">${icon('download', 14)}PDF</a>
        <a class="btn btn-sm" href="#/">${icon('x', 14)}Quitter</a></span>
    </div>
    <div class="m-stage">${cover}${list.map((s, i) => `<section class="m-slide" data-i="${i + 1}"><p class="m-kicker">${esc(s.kicker)}</p><h2>${esc(s.title)}</h2><div class="m-body">${s.html}</div></section>`).join('')}</div>
    <button class="m-nav m-prev" data-step="-1" aria-label="Diapositive précédente">${icon('left', 22)}</button>
    <button class="m-nav m-next" data-step="1" aria-label="Diapositive suivante">${icon('right', 22)}</button>
    <p class="m-help"><span class="m-keys">← → pour naviguer · F plein écran · Échap pour quitter · </span>${CREDIT}</p>
  </div>`;
}

export function mount(root, {year}) {
  document.body.classList.add('is-meeting');
  const list = sections(year);
  const slides = [...root.querySelectorAll('.m-slide')];
  const charted = new Set();
  const show = (i, dir = 0) => {
    i = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, k) => {
      s.toggleAttribute('data-active', k === i);
      s.dataset.side = k < i ? 'before' : k > i ? 'after' : '';
    });
    root.querySelectorAll('[data-go]').forEach((b, k) => b.setAttribute('aria-selected', k === i));
    root.querySelector('.m-prev').disabled = i === 0;
    root.querySelector('.m-next').disabled = i === slides.length - 1;
    slide = i;
    /* Le graphique se dessine quand sa diapositive apparaît : il a sa vraie
       largeur et ses barres poussent sous les yeux de la salle. */
    const sec = list[i - 1];
    if (sec?.chart && !charted.has(sec.id)) {
      charted.add(sec.id);
      const slot = slides[i].querySelector('.chart-slot');
      sec.chart(slot, slides[i].clientWidth);
    }
  };
  slides.forEach(s => s.classList.add('m-ready'));
  show(slide);
  root.addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if (go) return show(Number(go.dataset.go));
    const st = e.target.closest('[data-step]');
    if (st) return show(slide + Number(st.dataset.step));
    if (e.target.closest('[data-full]')) {
      const el = root.querySelector('[data-meeting]');
      if (document.fullscreenElement) document.exitFullscreen?.();
      else el.requestFullscreen?.().catch(() => {});
    }
  });
  const onKey = e => {
    if (!document.body.classList.contains('is-meeting')) { removeEventListener('keydown', onKey); keyHandler = null; return; }
    if (e.target.closest?.('input, textarea, select')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); show(slide + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(slide - 1); }
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(slides.length - 1);
    else if (e.key.toLowerCase() === 'f') root.querySelector('[data-full]')?.click();
    else if (e.key === 'Escape' && !document.fullscreenElement) location.hash = '#/';
  };
  /* Un seul écouteur clavier, même si la page est redessinée. */
  if (keyHandler) removeEventListener('keydown', keyHandler);
  keyHandler = onKey;
  addEventListener('keydown', onKey);
  /* Glisser au doigt sur tablette. */
  let x0 = null;
  const stage = root.querySelector('.m-stage');
  stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') x0 = e.clientX; });
  stage.addEventListener('pointerup', e => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 50) show(slide + (dx < 0 ? 1 : -1)); });
}
