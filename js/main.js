/* Portail Fiscal CADEMA — V22. Coquille : en-tête, menu horizontal,
   routeur, recherche, notifications, profil. */
import { db, connect, onChange, loadAll } from './grist.js';
import * as M from './model.js';
import { esc, attr, icon, fmt, avatar, toast, closeDrawer, drawerOpen } from './ui.js';
import { spark, installTooltips } from './charts.js';
import * as accueil from './pages/accueil.js';
import * as recettes from './pages/recettes.js';
import * as redevance from './pages/redevance.js';
import * as finances from './pages/finances.js';
import * as pilotage from './pages/pilotage.js';
import * as documents from './pages/documents.js';
import * as equipe from './pages/equipe.js';
import * as nouveautes from './pages/nouveautes.js';
import * as reunion from './pages/reunion.js';
import * as rapport from './pages/rapport.js';
import * as taux from './pages/taux.js';
import * as fiche from './pages/fiche.js';
import { unseen } from './changelog.js';
import { installUpdateCheck } from './update.js';

const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* stockage bloqué */ } },
};

export const app = {
  year: Number(store.get('cadema-v22-year')) || null,
  profile: store.get('cadema-v22-profile') || '',
  theme: store.get('cadema-v22-theme') || 'auto',
  route: {page: 'accueil', sub: '', params: new URLSearchParams()},
};
window.CADEMA_V22 = app;

export const author = () => app.profile || 'Portail';

const NAV = [
  {id: 'accueil', label: 'Accueil', href: '#/'},
  {id: 'recettes', label: 'Recettes', href: '#/recettes', menu: 'recettes'},
  {id: 'redevance', label: 'Redevance spéciale', href: '#/redevance'},
  {id: 'finances', label: 'Finances', href: '#/finances', menu: 'finances'},
  {id: 'pilotage', label: 'Pilotage', href: '#/pilotage', menu: 'pilotage'},
  {id: 'documents', label: 'Documents', href: '#/documents'},
];
export const CREDIT = '© 2026, Made with ❤️ by Dina-Ben';
const creditLine = (cls = '') => `<p class="credit${cls ? ` ${cls}` : ''}">${CREDIT}</p>`;

const PAGES = {accueil, recettes, redevance, finances, pilotage, documents, equipe, nouveautes, reunion, rapport, taux, fiche};

/* Fonds disponibles. « Tamisé » est un sombre adouci, plus clair que « Sombre ». */
const THEMES = [
  ['auto', 'Automatique', 'Suit le réglage de l’appareil', 'present'],
  ['light', 'Clair', 'Papier clair, en-tête sombre', 'sun'],
  ['dim', 'Tamisé', 'Sombre adouci, plus clair', 'half'],
  ['dark', 'Sombre', 'Fond nuit', 'moon'],
];
const themeIcon = () => app.theme === 'auto'
  ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'moon' : 'sun')
  : THEMES.find(t => t[0] === app.theme)?.[3] || 'sun';
function themeMenu() {
  return `<div class="menu theme-menu" role="menu" aria-label="Fond de l’écran"><p class="menu-label">Fond de l’écran</p>${THEMES.map(([v, l, d]) =>
    `<button class="menu-item theme-item" role="menuitemradio" aria-checked="${app.theme === v}" data-theme-set="${v}">
      <span class="theme-sw theme-sw-${v}" aria-hidden="true"><i></i></span>
      <span class="theme-txt"><b>${l}</b><span class="menu-hint">${d}</span></span>${icon('check', 16, 'theme-check')}
    </button>`).join('')}</div>`;
}

/* ── Thème ─────────────────────────────────────────────────────────── */
function applyTheme() {
  const root = document.documentElement;
  if (app.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', app.theme);
}

/* ── Logo ──────────────────────────────────────────────────────────── */
export const LOGO = `<svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true">
  <defs><linearGradient id="lg-cadema" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#1a9c96"/><stop offset="1" stop-color="#0b4d5a"/></linearGradient></defs>
  <rect width="40" height="40" rx="11" fill="url(#lg-cadema)"/>
  <rect x=".5" y=".5" width="39" height="39" rx="10.5" fill="none" stroke="#fff" stroke-opacity=".14"/>
  <path d="M25.6 10.6A11.5 11.5 0 1 0 25.6 29.4" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2.6" stroke-linecap="round"/>
  <rect x="12.4" y="21.5" width="3.4" height="6" rx="1.2" fill="#fff" fill-opacity=".72"/>
  <rect x="17.1" y="17.5" width="3.4" height="10" rx="1.2" fill="#fff" fill-opacity=".88"/>
  <rect x="21.8" y="13" width="3.4" height="14.5" rx="1.2" fill="#fff"/>
  <circle cx="30.6" cy="10.2" r="2.4" fill="#f4c25b"/>
</svg>`;

/* ── En-tête ───────────────────────────────────────────────────────── */
function header() {
  const unread = notifications().filter(n => n.tone !== 'info').length;
  return `
  <a class="skip" href="#main">Aller au contenu</a>
  <header class="top" role="banner">
    <div class="top-inner">
      <a class="brand" href="#/" aria-label="Portail Fiscal CADEMA — accueil">
        ${LOGO}
        <span class="brand-text"><span class="brand-name">Portail Fiscal</span><span class="brand-org">CADEMA</span></span>
      </a>
      <nav class="nav" aria-label="Navigation principale">
        <span class="nav-indicator" aria-hidden="true"></span>
        ${NAV.map(n => `<div class="nav-item${n.menu ? ' has-menu' : ''}">
          <a class="nav-link" href="${n.href}" data-nav="${n.id}"${app.route.page === n.id ? ' aria-current="page"' : ''}>${esc(n.label)}${n.menu ? icon('chevron', 14, 'nav-chev') : ''}</a>
          ${n.menu ? `<button class="nav-menu-btn" data-menu="${n.menu}" aria-label="Ouvrir le sous-menu ${attr(n.label)}" aria-expanded="false">${icon('chevron', 14)}</button>` : ''}
        </div>`).join('')}
      </nav>
      <div class="top-actions">
        <button class="year-btn" data-pop="year" aria-haspopup="menu" aria-expanded="false" title="Changer d’exercice">
          <span class="year-label">Exercice</span><b>${app.year}</b>${icon('chevron', 14)}
        </button>
        <button class="search-btn" data-palette aria-label="Rechercher (Ctrl K)">
          ${icon('search', 16)}<span class="search-ph">Rechercher</span><kbd>Ctrl K</kbd>
        </button>
        <button class="top-icon" data-pop="theme" aria-label="Fond de l’écran : clair, tamisé ou sombre" aria-haspopup="menu" aria-expanded="false">${icon(themeIcon(), 18)}</button>
        <button class="top-icon" data-pop="notif" aria-label="Alertes${unread ? ` (${unread})` : ''}" aria-haspopup="dialog" aria-expanded="false">
          ${icon('bell', 18)}${unread ? `<span class="dot-count">${unread}</span>` : ''}
        </button>
        <button class="me-btn" data-pop="me" aria-haspopup="menu" aria-expanded="false" aria-label="Profil et réglages">
          ${avatar(app.profile || 'Équipe', 30)}${unseen().length ? '<span class="news-dot" aria-hidden="true"></span>' : ''}<span class="sync-dot" data-sync="${db.saving ? 'saving' : 'ok'}" aria-hidden="true"></span>
        </button>
        <button class="top-icon burger" data-burger aria-label="Menu" aria-expanded="false">${icon('menu', 20)}</button>
      </div>
    </div>
  </header>`;
}

/* ── Panneaux du menu ──────────────────────────────────────────────── */
function menuPanel(kind) {
  if (kind === 'recettes') {
    const ys = M.taxYears();
    return `<div class="mega mega-recettes">
      <div class="mega-col">
        <p class="mega-kicker">Produits fiscaux · ${app.year}</p>
        ${M.TAXES.map(t => {
          const c = M.taxCell(t.code, app.year);
          return `<a class="mega-tax" href="#/recettes/${t.code}">
            <span class="sw" style="background:var(--s${t.slot})"></span>
            <span class="mega-tax-name"><b>${esc(t.code)}</b><span>${esc(t.label)}</span></span>
            ${spark(ys.map(y => M.taxCell(t.code, y)?.amount ?? null), {slot: t.slot})}
            <span class="mega-tax-val">${c?.amount != null ? esc(fmt.short(c.amount)) : '<i>—</i>'}</span>
          </a>`;
        }).join('')}
      </div>
      <div class="mega-side">
        <a class="mega-link" href="#/recettes">${icon('chart')}<span><b>Vue d’ensemble</b><span>Toutes les recettes, tous les exercices</span></span></a>
        <a class="mega-link" href="#/taux">${icon('target')}<span><b>Taux votés et GEMAPI</b><span>Taux en vigueur, propositions 2027, produit GEMAPI</span></span></a>
        <a class="mega-link" href="#/recettes/CFE?tab=terrain">${icon('map')}<span><b>CFE · suivi terrain</b><span>Visites, locaux exploités et vacants</span></span></a>
        <a class="mega-link" href="#/recettes/VM?tab=employeurs">${icon('building')}<span><b>VM · employeurs</b><span>Anomalies de déclaration</span></span></a>
      </div>
    </div>`;
  }
  if (kind === 'finances') {
    return `<div class="mega mega-simple">
      <a class="mega-link" href="#/finances?tab=recettes">${icon('chart')}<span><b>Recettes par budget</b><span>Principal, déchets, mobilité · export Excel</span></span></a>
      <a class="mega-link" href="#/finances">${icon('wallet')}<span><b>Budget &amp; CFU</b><span>Résultats par budget et section</span></span></a>
      <a class="mega-link" href="#/finances?tab=dotations">${icon('landmark')}<span><b>Dotations</b><span>DGF et péréquation FPIC</span></span></a>
    </div>`;
  }
  if (kind === 'pilotage') {
    const open = M.tasks().filter(t => t.status !== 'Terminé').length;
    const q = M.quality(app.year);
    return `<div class="mega mega-simple">
      <a class="mega-link" href="#/pilotage">${icon('list')}<span><b>Priorités</b><span>${open} action(s) ouverte(s)</span></span></a>
      <a class="mega-link" href="#/pilotage?tab=plans">${icon('target')}<span><b>Plan d’actions 2026–2029</b><span>${M.plans().length} actions par axe</span></span></a>
      <a class="mega-link" href="#/pilotage?tab=calendrier">${icon('calendar')}<span><b>Calendrier fiscal</b><span>Échéances de l’équipe</span></span></a>
      <a class="mega-link" href="#/pilotage?tab=qualite">${icon('shield')}<span><b>Qualité des données</b><span>Score ${q.score}/100 · ${q.open} point(s) ouvert(s)</span></span></a>
    </div>`;
  }
  return '';
}

/* ── Notifications : ce qui demande une action, calculé, jamais stocké ─ */
function notifications() {
  if (db.status !== 'ready') return [];
  const out = [];
  const q = M.quality(app.year);
  for (const c of q.checks.filter(c => !c.ok && c.level !== 'info')) {
    out.push({tone: c.level === 'critical' ? 'critical' : 'warn', title: c.title, text: `${c.count} · ${c.fix}`, href: c.route});
  }
  const now = new Date(); const soon = new Date(Date.now() + 30 * 86400000);
  for (const e of M.events().filter(e => e.start && e.start >= new Date(now.toDateString()) && e.start <= soon && e.status !== 'Terminé')) {
    out.push({tone: 'info', title: e.title, text: `Échéance le ${fmt.date(e.start)}${e.owner ? ` · ${e.owner}` : ''}`, href: '#/pilotage?tab=calendrier'});
  }
  for (const c of M.recovery().list.filter(c => c.due)) {
    out.push({tone: 'warn', title: `Relance à faire : ${c.name}`, text: `${c.stepLabel} · reste ${fmt.eurc(c.rest)} · prévu le ${fmt.date(c.nextDate)}`, href: `#/redevance?tab=recouvrement&relance=${encodeURIComponent(c.id)}`});
  }
  for (const t of M.tasks().filter(t => t.due && t.due < now && t.status !== 'Terminé')) {
    out.push({tone: 'warn', title: `En retard : ${t.title}`, text: `Échéance dépassée le ${fmt.date(t.due)}`, href: '#/pilotage'});
  }
  return out;
}

/* ── Popovers (exercice, alertes, profil, sous-menus) ──────────────── */
let pop = null;
function closePop() {
  if (!pop) return;
  const {el, trigger} = pop; pop = null;
  trigger?.setAttribute('aria-expanded', 'false');
  el.setAttribute('data-leaving', '');
  setTimeout(() => el.remove(), 140);
}
function openPop(trigger, html, {align = 'right', cls = ''} = {}) {
  const same = pop?.trigger === trigger;
  closePop();
  if (same) return null;
  const el = document.createElement('div');
  el.className = `pop ${cls}`;
  el.innerHTML = html;
  document.body.appendChild(el);
  const r = trigger.getBoundingClientRect();
  const w = el.offsetWidth;
  let left = align === 'right' ? r.right - w : r.left + r.width / 2 - w / 2;
  left = Math.max(12, Math.min(left, innerWidth - w - 12));
  el.style.left = `${left}px`;
  el.style.top = `${r.bottom + 8}px`;
  el.style.transformOrigin = `${Math.min(w, Math.max(0, r.left + r.width / 2 - left))}px top`;
  trigger.setAttribute('aria-expanded', 'true');
  pop = {el, trigger};
  requestAnimationFrame(() => el.setAttribute('data-open', ''));
  return el;
}

function yearMenu() {
  return `<div class="menu" role="menu" aria-label="Exercice">${M.years().slice().reverse().map(y =>
    `<button role="menuitemradio" aria-checked="${y === app.year}" class="menu-item" data-year="${y}">
      <span>${y}</span>${y === new Date().getFullYear() ? '<span class="menu-hint">en cours</span>' : ''}${y === app.year ? icon('check', 16) : ''}
    </button>`).join('')}</div>`;
}

function notifPanel() {
  const list = notifications();
  return `<div class="notif" role="dialog" aria-label="Alertes">
    <div class="notif-head"><b>À traiter</b><span>${list.length ? `${list.length} élément(s)` : 'Rien d’urgent'}</span></div>
    ${list.length ? `<div class="notif-list">${list.map(n => `<a class="notif-item" href="${attr(n.href)}">
      <span class="notif-dot tone-${n.tone}" aria-hidden="true"></span>
      <span><b>${esc(n.title)}</b><span>${esc(n.text)}</span></span></a>`).join('')}</div>`
      : `<div class="notif-empty">${icon('checkCircle', 22)}<p>Aucune alerte pour ${app.year}.</p></div>`}
    <a class="notif-foot" href="#/pilotage?tab=qualite">Voir le contrôle qualité ${icon('arrow', 14)}</a>
  </div>`;
}

function meMenu() {
  const ppl = M.people();
  return `<div class="menu me-menu" role="menu" aria-label="Profil">
    <div class="me-head">${avatar(app.profile || 'Équipe', 36)}<div><b>${esc(app.profile || 'Profil non choisi')}</b>
      <span>${esc(ppl.find(p => p.name === app.profile)?.role || 'Choisissez qui vous êtes')}</span></div></div>
    <p class="menu-label">Vous êtes</p>
    <div class="me-people">${ppl.map(p => `<button class="chip${p.name === app.profile ? ' is-on' : ''}" data-profile="${attr(p.name)}">${esc(p.name)}</button>`).join('') || '<span class="muted">Aucun utilisateur dans la table Utilisateurs</span>'}</div>
    <p class="menu-hint-line">Sert à signer vos modifications. La connexion reste gérée par Grist.</p>
    <div class="menu-sep"></div>
    <a class="menu-item" href="#/nouveautes" role="menuitem">${icon('info', 16)}<span>Nouveautés du portail</span>${unseen().length ? `<span class="badge badge-accent">${unseen().length} nouvelle${unseen().length > 1 ? 's' : ''}</span>` : ''}</a>
    <a class="menu-item" href="#/reunion" role="menuitem">${icon('present', 16)}<span>Mode réunion</span></a>
    <a class="menu-item" href="#/rapport" role="menuitem">${icon('download', 16)}<span>Point mensuel (PDF)</span></a>
    <div class="menu-sep"></div>
    <a class="menu-item" href="#/equipe" role="menuitem">${icon('users', 16)}<span>Équipe &amp; paramètres</span></a>
    <button class="menu-item" data-refresh role="menuitem">${icon('refresh', 16)}<span>Actualiser depuis Grist</span><span class="menu-hint">${db.syncedAt ? esc(fmt.rel(db.syncedAt)) : ''}</span></button>
    <div class="menu-sep"></div>
    <p class="menu-foot">Portail fiscal V22 · ${CREDIT}</p>
  </div>`;
}

/* ── Recherche (Ctrl K) : pas d'animation, on l'ouvre cent fois par jour ─ */
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function paletteItems() {
  const items = [
    ...NAV.map(n => ({kind: 'Page', label: n.label, href: n.href, ic: 'arrow'})),
    {kind: 'Page', label: 'Plan d’actions 2026–2029', href: '#/pilotage?tab=plans', ic: 'target'},
    {kind: 'Page', label: 'Calendrier fiscal', href: '#/pilotage?tab=calendrier', ic: 'calendar'},
    {kind: 'Page', label: 'Qualité des données', href: '#/pilotage?tab=qualite', ic: 'shield'},
    {kind: 'Page', label: 'Recouvrement de la redevance', href: '#/redevance?tab=recouvrement', ic: 'wallet'},
    {kind: 'Page', label: 'Nouveautés du portail', href: '#/nouveautes', ic: 'info'},
    {kind: 'Page', label: 'Mode réunion', href: '#/reunion', ic: 'present'},
    {kind: 'Page', label: 'Point mensuel (PDF)', href: '#/rapport', ic: 'download'},
    {kind: 'Page', label: 'Dotations DGF & FPIC', href: '#/finances?tab=dotations', ic: 'landmark'},
    {kind: 'Page', label: 'Recettes par budget', href: '#/finances?tab=recettes', ic: 'chart'},
    {kind: 'Page', label: 'Taux votés, propositions 2027 et GEMAPI', href: '#/taux', ic: 'target'},
    {kind: 'Page', label: 'Synthèse PDF de la redevance spéciale', href: '#/fiche/rs', ic: 'download'},
    {kind: 'Page', label: 'États fiscaux (1259, 1386, EDET, EDAC)', href: '#/documents', ic: 'table'},
    {kind: 'Page', label: 'Équipe & paramètres', href: '#/equipe', ic: 'users'},
    ...M.TAXES.map(t => ({kind: 'Recette', label: `${t.code} · ${t.label}`, href: `#/recettes/${t.code}`, ic: 'coins'})),
    ...M.companies().map(c => ({kind: 'Entreprise', label: c.name, sub: [c.activity, c.siret].filter(Boolean).join(' · '), href: `#/redevance/${encodeURIComponent(c.id)}`, ic: 'building'})),
    ...M.documents().map(d => ({kind: 'Document', label: d.title, sub: [d.type, d.year].filter(Boolean).join(' · '), href: `#/documents?q=${encodeURIComponent(d.title)}`, ic: 'file'})),
    ...M.tasks().map(t => ({kind: 'Priorité', label: t.title, sub: t.status, href: '#/pilotage', ic: 'list'})),
  ];
  return items.map(i => ({...i, key: norm(`${i.label} ${i.sub || ''} ${i.kind}`)}));
}
function openPalette() {
  if (document.querySelector('.palette-layer')) return;
  closePop();
  const all = paletteItems();
  const layer = document.createElement('div');
  layer.className = 'palette-layer';
  layer.innerHTML = `<div class="palette-scrim"></div><div class="palette" role="dialog" aria-modal="true" aria-label="Recherche">
    <div class="palette-in">${icon('search', 18)}<input type="search" placeholder="Entreprise, recette, document, page…" aria-label="Rechercher" autocomplete="off" spellcheck="false"><kbd>Échap</kbd></div>
    <div class="palette-list" role="listbox"></div></div>`;
  document.body.appendChild(layer);
  const input = layer.querySelector('input'), list = layer.querySelector('.palette-list');
  let results = [], sel = 0;
  const draw = () => {
    const words = norm(input.value).split(/\s+/).filter(Boolean);
    results = (words.length ? all.filter(i => words.every(w => i.key.includes(w))) : all.filter(i => i.kind === 'Page' || i.kind === 'Recette')).slice(0, 40);
    sel = Math.min(sel, Math.max(0, results.length - 1));
    list.innerHTML = results.length ? results.map((r, i) => `<a role="option" class="pal-item" href="${attr(r.href)}" aria-selected="${i === sel}" data-i="${i}">
      <span class="pal-ic">${icon(r.ic, 16)}</span><span class="pal-txt"><b>${esc(r.label)}</b>${r.sub ? `<span>${esc(r.sub)}</span>` : ''}</span><span class="pal-kind">${esc(r.kind)}</span></a>`).join('')
      : `<p class="pal-empty">Aucun résultat pour « ${esc(input.value)} »</p>`;
  };
  const close = () => layer.remove();
  input.addEventListener('input', () => { sel = 0; draw(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % Math.max(results.length, 1);
      draw(); list.querySelector('[aria-selected="true"]')?.scrollIntoView({block: 'nearest'});
    } else if (e.key === 'Enter' && results[sel]) { e.preventDefault(); location.hash = results[sel].href; close(); }
    else if (e.key === 'Escape') { e.stopPropagation(); close(); }
  });
  list.addEventListener('pointermove', e => { const a = e.target.closest('[data-i]'); if (a && Number(a.dataset.i) !== sel) { sel = Number(a.dataset.i); list.querySelectorAll('[aria-selected]').forEach(x => x.setAttribute('aria-selected', x === a)); } });
  list.addEventListener('click', () => close());
  layer.querySelector('.palette-scrim').addEventListener('click', close);
  draw();
  input.focus();
}

/* ── Routeur ───────────────────────────────────────────────────────── */
function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const [page = '', ...rest] = path.split('/');
  return {page: PAGES[page] ? page : 'accueil', sub: decodeURIComponent(rest.join('/')), params: new URLSearchParams(query)};
}

const root = document.getElementById('app');
let mounted = false;

function shellState() {
  if (db.status === 'loading') return `<div class="boot">${LOGO}<p>Chargement des données Grist…</p><div class="boot-bar"><span></span></div>${creditLine('credit-boot')}</div>`;
  if (db.status === 'offline') return `<div class="boot boot-msg">${LOGO}<h1>Ce portail s’ouvre dans Grist</h1>
    <p>Ajoutez-le comme vue personnalisée sur une page du document, avec l’accès complet.</p>${creditLine('credit-boot')}</div>`;
  if (db.status === 'denied') return `<div class="boot boot-msg">${LOGO}<h1>Accès aux données requis</h1>
    <p>Dans Grist, ouvrez le panneau de la vue personnalisée et choisissez <b>Accès complet au document</b>. Le portail lit et écrit directement dans les tables.</p>
    <p class="muted">${esc(db.error || '')}</p>${creditLine('credit-boot')}</div>`;
  return '';
}

let lastTab = null;
/* Pastille des onglets : elle glisse de l'ancien onglet vers le nouveau. */
function tabsPill(slide) {
  const tabs = root.querySelector('main .tabs');
  const cur = tabs?.querySelector('[aria-current="page"]');
  if (!cur) { lastTab = null; return; }
  const pill = document.createElement('span');
  pill.className = 'tabs-pill';
  tabs.prepend(pill);
  const set = r => { pill.style.width = `${r.w}px`; pill.style.transform = `translateX(${r.x}px)`; };
  const now = {page: app.route.page, x: cur.offsetLeft, w: cur.offsetWidth};
  if (slide && lastTab?.page === now.page && lastTab.x !== now.x) {
    pill.style.transition = 'none';
    set(lastTab);
    pill.getBoundingClientRect();
    pill.style.transition = '';
  }
  set(now);
  lastTab = now;
}

/* `enter` : 'full' (nouvelle page), 'soft' (changement d'onglet), 'none'
   (rafraîchissement : rien ne bouge). */
export function render({keepScroll = false, enter = keepScroll ? 'none' : 'full'} = {}) {
  document.body.classList.remove('is-meeting', 'is-report');
  const special = shellState();
  if (special) { root.innerHTML = special; mounted = false; return; }
  const years = M.years();
  if (!app.year || !years.includes(app.year)) app.year = M.defaultYear();
  app.route = parseRoute();
  const page = PAGES[app.route.page];

  const active = document.activeElement;
  const focusKey = active?.dataset?.keep;
  const selStart = active?.selectionStart, selEnd = active?.selectionEnd;
  const scroll = scrollY;

  document.body.classList.toggle('no-enter', enter === 'none');
  document.body.classList.toggle('soft-enter', enter === 'soft');
  const ctx = {year: app.year, sub: app.route.sub, params: app.route.params, app, render};
  const missingBanner = db.status === 'ready' && db.missing.length && !['fiche', 'rapport'].includes(app.route.page)
    ? `<div class="notice notice-critical missing-banner" role="alert">${icon('alert', 16)}<span><b>${db.missing.length} table${db.missing.length > 1 ? 's' : ''} Grist non chargée${db.missing.length > 1 ? 's' : ''} : ${esc(db.missing.join(', '))}.</b> Les chiffres qui en dépendent sont incomplets : un montant absent n’est pas forcément nul.</span></div>`
    : '';
  root.innerHTML = `${header()}<main id="main" class="page page-${app.route.page}" tabindex="-1">${missingBanner}${page.render(ctx)}</main>
    <footer class="foot"><span>${LOGO.replace('logo-mark', 'logo-mark logo-sm')} Portail Fiscal CADEMA</span><span>Données : document Grist du pôle · lecture et écriture en direct · <a class="link" href="#/nouveautes">Nouveautés</a></span>${creditLine()}</footer>`;
  page.mount?.(root.querySelector('main'), ctx);
  moveIndicator(false);
  tabsPill(enter === 'soft');
  mounted = true;

  if (focusKey) {
    const el = root.querySelector(`[data-keep="${focusKey}"]`);
    if (el) { el.focus({preventScroll: true}); try { el.setSelectionRange(selStart, selEnd); } catch { /* select */ } }
  }
  if (keepScroll) scrollTo(0, scroll);
}

function moveIndicator(animate = true) {
  const nav = root.querySelector('.nav');
  const ind = nav?.querySelector('.nav-indicator');
  const cur = nav?.querySelector('[aria-current="page"]');
  if (!ind) return;
  if (!cur) { ind.style.opacity = '0'; return; }
  const n = nav.getBoundingClientRect(), c = cur.getBoundingClientRect();
  ind.style.transition = animate ? '' : 'none';
  ind.style.opacity = '1';
  ind.style.transform = `translateX(${c.left - n.left + 12}px) scaleX(${(c.width - 24) / 100})`;
}

let lastPage = null, lastSub = '', lastView = '';
function onRoute() {
  closePop();
  hoverArmed = false;
  clearTimeout(hoverTimer);
  const r = parseRoute();
  const samePage = r.page === lastPage;
  if (!(r.page === 'redevance' && drawerOpen())) closeDrawer(true);
  document.body.classList.remove('nav-open');
  const prev = root.querySelector('.nav-indicator');
  const prevTransform = prev?.style.transform;
  /* Même page : un changement de fiche vaut une nouvelle page, un changement
     d'onglet une entrée douce, le reste (filtres, tiroir) ne bouge pas. */
  const view = `${r.params.get('tab') || ''}|${r.params.get('statut') || ''}`;
  const newSub = samePage && r.page !== 'redevance' && r.sub !== lastSub;
  const enter = !samePage || newSub ? 'full' : view !== lastView ? 'soft' : 'none';
  render({keepScroll: samePage && !newSub, enter});
  if (enter === 'full') scrollTo(0, 0);
  lastSub = r.sub; lastView = view;
  /* La pastille glisse de l'ancienne entrée vers la nouvelle. */
  const ind = root.querySelector('.nav-indicator');
  if (ind && prevTransform && !samePage) {
    ind.style.transition = 'none';
    ind.style.transform = prevTransform;
    ind.getBoundingClientRect();
    ind.style.transition = '';
    moveIndicator(true);
  }
  lastPage = r.page;
}

/* ── Événements globaux ────────────────────────────────────────────── */
document.addEventListener('click', e => {
  const t = e.target;
  const pal = t.closest('[data-palette]');
  if (pal) { openPalette(); return; }
  const p = t.closest('[data-pop]');
  if (p) {
    const kind = p.dataset.pop;
    const el = openPop(p, kind === 'year' ? yearMenu() : kind === 'notif' ? notifPanel() : kind === 'theme' ? themeMenu() : meMenu(), {cls: `pop-${kind}`});
    el?.querySelector('[aria-checked="true"], button, a')?.focus({preventScroll: true});
    return;
  }
  const mb = t.closest('[data-menu]');
  if (mb) { openPop(mb.closest('.nav-item'), menuPanel(mb.dataset.menu), {align: 'center', cls: 'pop-mega'}); return; }
  const y = t.closest('[data-year]');
  if (y && pop) {
    app.year = Number(y.dataset.year); store.set('cadema-v22-year', app.year); closePop();
    /* L'exercice global reprend la main sur l'exercice choisi dans une fiche. */
    if (/[?&]an=\d+/.test(location.hash)) history.replaceState(null, '', location.hash.replace(/([?&])an=\d+&?/, '$1').replace(/[?&]$/, ''));
    render({keepScroll: true});
    /* Tout le contenu vient de changer : un fondu bref le signale. */
    root.querySelector('main')?.animate([{opacity: .35}, {opacity: 1}], {duration: 220, easing: 'ease-out'});
    toast(`Exercice ${app.year}`, 'info', {timeout: 1800});
    return;
  }
  const pr = t.closest('[data-profile]');
  if (pr) { app.profile = pr.dataset.profile; store.set('cadema-v22-profile', app.profile); closePop(); render({keepScroll: true}); toast(`Bonjour ${app.profile}`, 'ok', {timeout: 2200}); return; }
  const th = t.closest('[data-theme-set]');
  if (th) { app.theme = th.dataset.themeSet; store.set('cadema-v22-theme', app.theme); applyTheme(); pop?.el.querySelectorAll('[data-theme-set]').forEach(b => b.setAttribute('aria-checked', b === th)); const tb = root.querySelector('[data-pop="theme"]'); if (tb) tb.innerHTML = icon(themeIcon(), 18); return; }
  if (t.closest('[data-refresh]')) { closePop(); loadAll().then(() => toast('Données relues depuis Grist', 'ok', {timeout: 2000})); return; }
  if (t.closest('[data-burger]')) { const open = document.body.classList.toggle('nav-open'); t.closest('[data-burger]').setAttribute('aria-expanded', open); return; }
  if (pop && !pop.el.contains(t)) closePop();
  if (pop && t.closest('a[href]')) closePop();
});

/* Survol d'une entrée à sous-menu : ouverture après une courte intention. */
let hoverTimer, closeTimer, under = null, hoverArmed = true;
/* Après un changement de page, le DOM change sous un curseur immobile : le
   navigateur émet un pointerover qui rouvrirait le sous-menu. On attend un
   vrai mouvement de la souris. */
document.addEventListener('pointermove', e => { if (e.movementX || e.movementY) hoverArmed = true; }, {passive: true});
document.addEventListener('pointerover', e => {
  under = e.target;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const megaOpen = pop?.el.classList.contains('pop-mega');
  if (megaOpen && (pop.el.contains(under) || pop.trigger.contains(under))) { clearTimeout(closeTimer); return; }
  const item = e.target.closest?.('.nav-item.has-menu');
  clearTimeout(hoverTimer);
  if (megaOpen) {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (pop?.el.classList.contains('pop-mega') && !pop.el.contains(under) && !pop.trigger.contains(under)) closePop();
    }, item ? 0 : 240);
  }
  if (!item || pop?.trigger === item || !hoverArmed) return;
  /* Une courte intention avant d'ouvrir ; passer d'un sous-menu à l'autre est instantané. */
  hoverTimer = setTimeout(() => {
    const btn = item.querySelector('[data-menu]');
    if (btn && item.contains(under)) {
      const instant = pop?.el.classList.contains('pop-mega');
      if (instant) { pop.el.remove(); pop.trigger.setAttribute('aria-expanded', 'false'); pop = null; }
      openPop(item, menuPanel(btn.dataset.menu), {align: 'center', cls: `pop-mega${instant ? ' pop-instant' : ''}`});
    }
  }, megaOpen ? 0 : 160);
});

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
  if (e.key === '/' && !e.target.closest('input, textarea, select, [contenteditable]')) { e.preventDefault(); openPalette(); return; }
  if (e.key === 'Escape') {
    if (pop) { const tr = pop.trigger; closePop(); tr?.focus?.(); }
    else if (drawerOpen()) { closeDrawer(); if (app.route.page === 'redevance' && app.route.sub) history.replaceState(null, '', `#/redevance${app.route.params.toString() ? `?${app.route.params}` : ''}`); }
    else if (document.body.classList.contains('nav-open')) document.body.classList.remove('nav-open');
  }
});
addEventListener('hashchange', onRoute);
addEventListener('resize', () => { closePop(); moveIndicator(false); });

onChange(reason => {
  if (reason === 'saving' || reason === 'sync') {
    const d = root.querySelector('.sync-dot');
    if (d) d.dataset.sync = db.saving ? 'saving' : 'ok';
    return;
  }
  if (reason === 'refresh') {
    /* Rafraîchissement automatique : on ne redessine pas sous les doigts de
       quelqu'un qui saisit. */
    if (document.activeElement?.closest('main input, main textarea, main select') || drawerOpen()) return;
    render({keepScroll: true});
    return;
  }
  if (reason === 'data') { if (mounted) render({keepScroll: true}); return; }
  onRoute();
});

applyTheme();
installTooltips();
render();
connect().catch(err => { console.error(err); db.status = 'denied'; db.error = err.message; render(); });
installUpdateCheck();
