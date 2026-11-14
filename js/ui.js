/* Briques d'interface partagées : formatage, icônes, toasts, tiroir,
   confirmation, menus. Aucune dépendance. */

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const attr = esc;

const eur0 = new Intl.NumberFormat('fr-FR', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0});
const eur2 = new Intl.NumberFormat('fr-FR', {style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2});
const int = new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 0});
const dec1 = new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 1, minimumFractionDigits: 1});

export const fmt = {
  eur: v => v === null || v === undefined ? '—' : eur0.format(v),
  eurc: v => v === null || v === undefined ? '—' : eur2.format(v),
  int: v => v === null || v === undefined ? '—' : int.format(v),
  /* 24,7 M€ — pour les titres et les axes, jamais pour la saisie. */
  short(v) {
    if (v === null || v === undefined) return '—';
    const a = Math.abs(v);
    if (a >= 1e6) return `${dec1.format(v / 1e6)} M€`;
    if (a >= 1e3) return `${int.format(Math.round(v / 1e3))} k€`;
    return eur0.format(v);
  },
  pct: (v, digits = 0) => v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toLocaleString('fr-FR', {maximumFractionDigits: digits, minimumFractionDigits: digits})} %`,
  delta(v) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '';
    const s = (v * 100).toLocaleString('fr-FR', {maximumFractionDigits: 1, minimumFractionDigits: 1});
    return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s.replace('-', '')} %`;
  },
  date: d => d ? d.toLocaleDateString('fr-FR', {day: 'numeric', month: 'short', year: 'numeric'}) : '—',
  dateShort: d => d ? d.toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'}) : '—',
  iso: d => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '',
  size(b) {
    if (!b) return '';
    if (b > 1e6) return `${dec1.format(b / 1e6)} Mo`;
    return `${int.format(Math.max(1, Math.round(b / 1e3)))} Ko`;
  },
  rel(d) {
    if (!d) return '';
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 45) return 'à l’instant';
    if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
    return fmt.date(d);
  },
};

/* Icônes au trait, 24×24, héritent de currentColor. */
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  coins: '<circle cx="9" cy="9" r="6"/><path d="M15.5 9.3a6 6 0 1 1-6.2 6.2"/><path d="M9 6.5v5M7.2 8h2.6"/>',
  building: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M15 10h4a1 1 0 0 1 1 1v10"/><path d="M8 8h3M8 12h3M8 16h3M3 21h18"/>',
  landmark: '<path d="M3 21h18M5 21V10M19 21V10M9.5 21V10M14.5 21V10"/><path d="m12 3 9 5H3z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  alert: '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0"/><path d="M12 9v4M12 17h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1"/>',
  external: '<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  up: '<path d="M7 17 17 7M8 7h9v9"/>',
  down: '<path d="M7 7l10 10M17 8v9H8"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h12v4"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2"/><circle cx="16" cy="14" r="1.2"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  pie: '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  present: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
};
export function icon(name, size = 18, extra = '') {
  return `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

/* ── Toasts ─────────────────────────────────────────────────────────── */
let toastHost;
export function toast(message, tone = 'ok', {action, onAction, timeout = 4200} = {}) {
  toastHost ??= Object.assign(document.body.appendChild(document.createElement('div')), {className: 'toasts', role: 'status'});
  toastHost.setAttribute('aria-live', 'polite');
  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.innerHTML = `<span class="toast-dot" aria-hidden="true">${icon(tone === 'error' ? 'alert' : tone === 'ok' ? 'check' : 'info', 16)}</span><span class="toast-msg">${esc(message)}</span>${action ? `<button class="toast-act">${esc(action)}</button>` : ''}`;
  toastHost.appendChild(el);
  let timer;
  const close = () => { el.dataset.leaving = ''; setTimeout(() => el.remove(), 200); };
  const arm = () => { timer = setTimeout(close, tone === 'error' ? 8000 : timeout); };
  el.addEventListener('pointerenter', () => clearTimeout(timer));
  el.addEventListener('pointerleave', arm);
  el.querySelector('.toast-act')?.addEventListener('click', () => { onAction?.(); close(); });
  arm();
}

/* ── Tiroir latéral (fiches) ─────────────────────────────────────────── */
let drawerEl, lastFocus, drawerOnClose;
export function openDrawer({title, subtitle = '', body, footer = '', wide = false, onMount, onClose, id = ''}) {
  closeDrawer(true);
  drawerOnClose = onClose;
  lastFocus = document.activeElement;
  drawerEl = document.createElement('div');
  drawerEl.className = 'drawer-layer';
  drawerEl.dataset.id = id;
  drawerEl.innerHTML = `
    <div class="drawer-scrim" data-close></div>
    <aside class="drawer${wide ? ' drawer-wide' : ''}" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <header class="drawer-head">
        <div><h2 id="drawer-title">${title}</h2>${subtitle ? `<p class="drawer-sub">${subtitle}</p>` : ''}</div>
        <button class="icon-btn" data-close aria-label="Fermer">${icon('x')}</button>
      </header>
      <div class="drawer-body">${body}</div>
      ${footer ? `<footer class="drawer-foot">${footer}</footer>` : ''}
    </aside>`;
  document.body.appendChild(drawerEl);
  document.body.classList.add('has-overlay');
  drawerEl.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeDrawer(); });
  requestAnimationFrame(() => {
    drawerEl?.setAttribute('data-open', '');
    const target = drawerEl?.querySelector('.drawer [autofocus]') || drawerEl?.querySelector('.drawer');
    target?.focus({preventScroll: true});
  });
  onMount?.(drawerEl.querySelector('.drawer'));
  return drawerEl.querySelector('.drawer');
}
export function closeDrawer(instant = false) {
  if (!drawerEl) return;
  const el = drawerEl; drawerEl = null;
  const cb = drawerOnClose; drawerOnClose = null;
  if (!instant) cb?.();
  document.body.classList.remove('has-overlay');
  if (instant) el.remove();
  else { el.removeAttribute('data-open'); el.setAttribute('data-leaving', ''); setTimeout(() => el.remove(), 220); }
  lastFocus?.focus?.({preventScroll: true});
}
export const drawerOpen = () => !!drawerEl;
export const drawerId = () => drawerEl?.dataset.id || '';
/* Met à jour le contenu sans rejouer l'animation d'ouverture. */
export function patchDrawer({title, subtitle, body, footer}) {
  const d = drawerEl?.querySelector('.drawer');
  if (!d) return null;
  if (title !== undefined) d.querySelector('#drawer-title').innerHTML = title;
  if (subtitle !== undefined) { const s = d.querySelector('.drawer-sub'); if (s) s.innerHTML = subtitle; }
  if (body !== undefined) d.querySelector('.drawer-body').innerHTML = body;
  if (footer !== undefined) { const f = d.querySelector('.drawer-foot'); if (f) f.innerHTML = footer; }
  return d;
}

/* ── Confirmation ───────────────────────────────────────────────────── */
export function confirmDialog({title, message, confirm = 'Confirmer', danger = false}) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-layer';
    wrap.innerHTML = `<div class="modal-scrim"></div>
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="m-t" aria-describedby="m-d">
        <h2 id="m-t">${esc(title)}</h2><p id="m-d">${esc(message)}</p>
        <div class="modal-actions"><button class="btn btn-ghost" data-v="0">Annuler</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-v="1">${esc(confirm)}</button></div>
      </div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.setAttribute('data-open', ''));
    const done = v => { wrap.remove(); resolve(v); };
    wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (b) done(b.dataset.v === '1');
      else if (e.target.classList.contains('modal-scrim')) done(false);
    });
    wrap.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } });
    wrap.querySelector('[data-v="1"]').focus();
  });
}

/* ── Petits composants HTML ─────────────────────────────────────────── */
export function badge(label, tone = 'neutral') {
  return `<span class="badge badge-${tone}"><span class="badge-dot" aria-hidden="true"></span>${esc(label)}</span>`;
}
export function avatar(name, size = 28) {
  const parts = String(name || '?').trim().split(/[\s._-]+/).filter(Boolean);
  const ini = (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2)).toUpperCase();
  let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `<span class="avatar" style="--h:${h};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px" aria-hidden="true">${esc(ini)}</span>`;
}
export function empty(title, text = '', action = '') {
  return `<div class="empty"><div class="empty-mark" aria-hidden="true">${icon('folder', 22)}</div><p class="empty-title">${esc(title)}</p>${text ? `<p class="empty-text">${esc(text)}</p>` : ''}${action}</div>`;
}
export function field(label, input, hint = '') {
  return `<label class="field"><span class="field-label">${esc(label)}</span>${input}${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}</label>`;
}
export function select(name, options, value, extra = '') {
  return `<select name="${attr(name)}" ${extra}>${options.map(o => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return `<option value="${attr(v)}"${String(v) === String(value ?? '') ? ' selected' : ''}>${esc(l)}</option>`;
  }).join('')}</select>`;
}

export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    out[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return out;
}

export function downloadCsv(filename, header, lines) {
  const cell = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [header, ...lines].map(r => r.map(cell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  const a = Object.assign(document.createElement('a'), {href: url, download: filename});
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
