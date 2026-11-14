import * as M from '../model.js';
import { rows, act, fieldsFor } from '../grist.js';
import { esc, attr, icon, fmt, badge, empty, avatar, openDrawer, closeDrawer, toast, field, select, formData, confirmDialog, flash } from '../ui.js';
import { ring } from '../charts.js';
import { author } from '../main.js';
import { planTone } from './accueil.js';

const TABS = [['priorites', 'Priorités', 'list'], ['plans', 'Plan d’actions', 'target'], ['calendrier', 'Calendrier', 'calendar'], ['qualite', 'Qualité des données', 'shield']];
const taskTone = s => ({'En cours': 'info', 'En attente': 'warn', 'Terminé': 'good'}[s] || 'accent');

export function render({year, params}) {
  const tab = TABS.some(t => t[0] === params.get('tab')) ? params.get('tab') : 'priorites';
  const tasks = M.tasks();
  const head = {
    priorites: ['Priorités de l’équipe', 'Ce que le pôle traite en ce moment. Chaque carte est une ligne de la table Taches.'],
    plans: ['Plan d’actions 2026–2029', 'Les actions structurantes du pôle, par axe, avec leur livrable et leur indicateur.'],
    calendrier: ['Calendrier fiscal', 'Échéances déclaratives, votes et rendez-vous de l’équipe.'],
    qualite: [`Qualité des données ${year}`, 'Chaque contrôle est calculé à partir des tables : il dit ce qui manque, combien, et où le corriger.'],
  }[tab];
  return `
  <section class="ph">
    <div><p class="ph-eyebrow">Pilotage</p><h1>${esc(head[0])}</h1><p class="ph-lede">${esc(head[1])}</p></div>
    <div class="ph-actions">
      ${tab === 'priorites' ? `<button class="btn btn-primary" data-new-task>${icon('plus', 16)}Nouvelle priorité</button>` : ''}
      ${tab === 'calendrier' ? `<button class="btn btn-primary" data-new-event>${icon('plus', 16)}Nouvelle échéance</button>` : ''}
    </div>
  </section>
  <div class="toolbar"><nav class="tabs" aria-label="Sections">
    ${TABS.map(([id, l, ic]) => `<a href="#/pilotage${id === 'priorites' ? '' : `?tab=${id}`}" ${tab === id ? 'aria-current="page"' : ''}>${icon(ic, 15)}${esc(l)}${id === 'priorites' ? ` <span class="count">${tasks.filter(t => t.status !== 'Terminé').length}</span>` : ''}</a>`).join('')}
  </nav></div>
  ${tab === 'priorites' ? board(tasks) : tab === 'plans' ? plansView(params) : tab === 'calendrier' ? calendar() : qualityView(year)}`;
}

/* ── Priorités ─────────────────────────────────────────────────────── */
function board(tasks) {
  if (!tasks.length) return `<article class="card">${empty('Aucune priorité', 'Créez la première priorité de l’équipe.', `<button class="btn btn-primary btn-sm" data-new-task>${icon('plus', 14)}Nouvelle priorité</button>`)}</article>`;
  const now = new Date();
  return `<section class="board">${M.TASK_STATUSES.map(s => {
    const list = tasks.filter(t => (M.TASK_STATUSES.includes(t.status) ? t.status : 'À traiter') === s);
    return `<div class="col" data-col="${attr(s)}">
      <div class="col-head">${badge(s, taskTone(s))}<span class="count">${list.length}</span></div>
      <div class="col-list">
        ${list.map(t => `<button class="task" data-task="${t.rowId}">
          <span class="task-title">${esc(t.title)}</span>
          ${t.progress > 0 ? `<span class="bar task-bar"><span style="width:${Math.round(t.progress * 100)}%"></span></span>` : ''}
          <span class="task-meta">
            ${t.owner ? `<span class="task-owner">${avatar(t.owner, 20)}${esc(t.owner)}</span>` : '<span class="muted">Non assignée</span>'}
            ${t.due ? `<span class="task-due${t.due < now && s !== 'Terminé' ? ' late' : ''}">${icon('calendar', 13)}${esc(fmt.dateShort(t.due))}</span>` : ''}
            ${t.priority && t.priority !== 'Normale' ? badge(t.priority, t.priority === 'Haute' || t.priority === 'Urgente' ? 'critical' : 'neutral') : ''}
          </span>
        </button>`).join('') || '<p class="col-empty">—</p>'}
      </div>
    </div>`;
  }).join('')}</section>`;
}

function taskDrawer(rowId) {
  const t = rowId ? M.tasks().find(x => x.rowId === rowId) : null;
  const ppl = M.people().map(p => p.name);
  openDrawer({
    title: t ? 'Priorité' : 'Nouvelle priorité',
    subtitle: t ? `${esc(t.module || 'Pôle fiscalité')}${t.updated ? ` · modifiée ${esc(fmt.rel(t.updated))}${t.author ? ` par ${esc(t.author)}` : ''}` : ''}` : 'Ajoutée à la table Taches',
    body: `<form class="form-grid" id="task-form">
      <div class="span-2">${field('Intitulé', `<textarea name="Titre" rows="2" required autofocus>${esc(t?.title || '')}</textarea>`)}</div>
      ${field('Statut', select('Statut', M.TASK_STATUSES, t?.status || 'À traiter'))}
      ${field('Priorité', select('Priorite', ['Basse', 'Normale', 'Haute', 'Urgente'], t?.priority || 'Normale'))}
      ${field('Assignée à', select('Assigne_A', [['', '— Personne —'], ...ppl], t?.owner || ''))}
      ${field('Échéance', `<input type="date" name="Echeance" value="${attr(fmt.iso(t?.due))}">`)}
      <div class="span-2">${field('Avancement', `<div class="range"><input type="range" name="Progression" min="0" max="100" step="5" value="${Math.round((t?.progress || 0) * 100)}"><output class="num">${Math.round((t?.progress || 0) * 100)} %</output></div>`)}</div>
      <div class="span-2">${field('Notes', `<textarea name="Notes" rows="4">${esc(t?.notes || '')}</textarea>`)}</div>
    </form>`,
    footer: `${t ? `<button class="btn btn-ghost left" data-del>${icon('trash', 15)}Supprimer</button>` : ''}<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-save>${icon('check', 16)}Enregistrer</button>`,
    onMount(el) {
      const range = el.querySelector('input[type=range]');
      range.addEventListener('input', () => { el.querySelector('output').textContent = `${range.value} %`; });
      el.querySelector('[data-save]').addEventListener('click', async e => {
        const v = formData(el.querySelector('#task-form'));
        if (!v.Titre.trim()) { toast('Donnez un intitulé', 'error'); return; }
        const progress = v.Statut === 'Terminé' ? 1 : Number(v.Progression) / 100;
        const fields = fieldsFor('Taches', {
          Titre: v.Titre.trim(), Statut: v.Statut, Priorite: v.Priorite, Assigne_A: v.Assigne_A, Responsable: v.Assigne_A,
          Echeance: v.Echeance ? M.toGristDate(new Date(`${v.Echeance}T00:00:00`)) : null,
          Progression: progress, Notes: v.Notes, Dernier_Auteur: author(), Derniere_MAJ: M.nowSeconds(),
        });
        e.currentTarget.disabled = true;
        try {
          let savedId = t?.rowId;
          if (t) await act([['UpdateRecord', 'Taches', t.rowId, fields]]);
          else {
            const n = Math.max(0, ...rows('Taches').map(r => Number(String(r.Tache_ID || '').replace(/\D/g, '')) || 0)) + 1;
            savedId = (await act([['AddRecord', 'Taches', null, {...fields, ...fieldsFor('Taches', {Tache_ID: `task-${n}`, Module: 'Pôle fiscalité', Date_Creation: M.nowSeconds(), Notes_JSON: '[]'})}]]))[0];
          }
          closeDrawer(); toast(t ? 'Priorité mise à jour' : 'Priorité créée');
          flash(document.querySelector(`[data-task="${savedId}"]`));
        } catch (err) { toast(err.message, 'error'); e.currentTarget.disabled = false; }
      });
      el.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!await confirmDialog({title: 'Supprimer cette priorité ?', message: `« ${t.title} » sera retirée de la table Taches. Grist permet d’annuler depuis son historique.`, confirm: 'Supprimer', danger: true})) return;
        try { await act([['RemoveRecord', 'Taches', t.rowId]]); closeDrawer(); toast('Priorité supprimée'); } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

/* ── Plan d'actions ─────────────────────────────────────────────────── */
function plansView(params) {
  const all = M.plans();
  const st = params.get('statut') || '';
  const list = st ? all.filter(p => p.status === st) : all;
  if (!all.length) return `<article class="card">${empty('Aucune action', 'La table Plans_Actions est vide.')}</article>`;
  const axes = [...new Set(list.map(p => p.axis))];
  const years = [2026, 2027, 2028, 2029];
  return `
  <div class="chips-row" style="padding:0 0 14px" role="group" aria-label="Statut">
    <a class="chip" aria-pressed="${!st}" href="#/pilotage?tab=plans">Toutes <span class="chip-n">${all.length}</span></a>
    ${M.PLAN_STATUSES.filter(s => all.some(p => p.status === s)).map(s => `<a class="chip" aria-pressed="${st === s}" href="#/pilotage?tab=plans&statut=${encodeURIComponent(s)}">${esc(s)} <span class="chip-n">${all.filter(p => p.status === s).length}</span></a>`).join('')}
  </div>
  ${axes.map(axis => `<article class="card plan-axis">
    <div class="card-head"><h2>${esc(axis)}</h2><span class="muted">${list.filter(p => p.axis === axis).length} action(s)</span></div>
    <div class="plan-list">
      ${list.filter(p => p.axis === axis).map(p => `<div class="plan">
        <div class="plan-main">
          <b>${esc(p.title)}</b>
          <span>${esc(p.deliverable)}</span>
          <span class="plan-meta">${p.indicator ? `${icon('target', 13)}${esc(p.indicator)}${p.target ? ` · cible ${esc(p.target)}` : ''}` : ''}${p.pilot ? ` <span class="sep">·</span> ${esc(p.pilot)}` : ''}${p.partners ? ` <span class="sep">·</span> avec ${esc(p.partners)}` : ''}</span>
          ${p.comment ? `<span class="plan-comment">${esc(p.comment)}</span>` : ''}
        </div>
        <div class="plan-years" aria-label="Période ${p.from || ''}–${p.to || ''}">${years.map(y => `<span class="${p.from && p.to && y >= p.from && y <= p.to ? 'on' : ''}">${String(y).slice(2)}</span>`).join('')}</div>
        <label class="plan-status"><span class="sr">Statut</span>${select('status', M.PLAN_STATUSES, p.status, `data-plan="${p.rowId}" class="status-select tone-${planTone(p.status)}"`)}</label>
      </div>`).join('')}
    </div>
  </article>`).join('')}`;
}

/* ── Calendrier ─────────────────────────────────────────────────────── */
function calendar() {
  const ev = M.events();
  if (!ev.length) return `<article class="card">${empty('Aucune échéance', 'Ajoutez les dates clés : votes des taux, déclarations, notifications.', `<button class="btn btn-primary btn-sm" data-new-event>${icon('plus', 14)}Nouvelle échéance</button>`)}</article>`;
  const today = new Date(new Date().toDateString());
  const groups = new Map();
  for (const e of ev) {
    const k = e.start ? e.start.toLocaleDateString('fr-FR', {month: 'long', year: 'numeric'}) : 'Sans date';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  return `<article class="card">${[...groups.entries()].map(([m, list]) => `
    <div class="month"><h3 class="month-name">${esc(m)}</h3>
    ${list.map(e => `<button class="row event${e.start && e.start < today ? ' past' : ''}" data-event="${e.rowId}">
      <span class="date-tile"><b>${e.start ? e.start.getDate() : '?'}</b><span>${e.start ? esc(e.start.toLocaleDateString('fr-FR', {weekday: 'short'})) : ''}</span></span>
      <span class="row-main"><b>${esc(e.title)}</b><span>${esc([e.module, e.owner, e.end && e.start && e.end > e.start ? `jusqu’au ${fmt.date(e.end)}` : ''].filter(Boolean).join(' · '))}</span></span>
      ${badge(e.status, e.status === 'Terminé' ? 'good' : e.start && e.start < today ? 'warn' : 'info')}
    </button>`).join('')}</div>`).join('')}</article>`;
}

function eventDrawer(rowId) {
  const e = rowId ? M.events().find(x => x.rowId === rowId) : null;
  openDrawer({
    title: e ? 'Échéance' : 'Nouvelle échéance', subtitle: 'Table Calendrier_Fiscal',
    body: `<form class="form-grid" id="ev-form">
      <div class="span-2">${field('Intitulé', `<input name="Titre" value="${attr(e?.title || '')}" required autofocus>`)}</div>
      ${field('Début', `<input type="date" name="Date_Debut" value="${attr(fmt.iso(e?.start))}" required>`)}
      ${field('Fin', `<input type="date" name="Date_Fin" value="${attr(fmt.iso(e?.end))}">`)}
      ${field('Module', select('Module', ['Pilotage', 'Recettes', 'VM', 'CFE', 'TEOM', 'Redevance spéciale', 'Budget', 'Autre'], e?.module || 'Pilotage'))}
      ${field('Responsable', select('Responsable', [['', '—'], ...M.people().map(p => p.name)], e?.owner || author()))}
      ${field('Statut', select('Statut', ['Planifié', 'En cours', 'Terminé', 'Reporté'], e?.status || 'Planifié'))}
      ${field('Récurrence', select('Recurrence', ['Aucune', 'Mensuelle', 'Trimestrielle', 'Annuelle'], M.text(rows('Calendrier_Fiscal').find(r => r.id === rowId)?.Recurrence) || 'Aucune'))}
      <div class="span-2">${field('Notes', `<textarea name="Notes" rows="3">${esc(e?.notes || '')}</textarea>`)}</div>
    </form>`,
    footer: `${e ? `<button class="btn btn-ghost left" data-del>${icon('trash', 15)}Supprimer</button>` : ''}<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-save>${icon('check', 16)}Enregistrer</button>`,
    onMount(el) {
      el.querySelector('[data-save]').addEventListener('click', async ev => {
        const v = formData(el.querySelector('#ev-form'));
        if (!v.Titre.trim() || !v.Date_Debut) { toast('Intitulé et date de début sont obligatoires', 'error'); return; }
        const d = s => s ? M.toGristDate(new Date(`${s}T00:00:00`)) : null;
        const fields = fieldsFor('Calendrier_Fiscal', {...v, Titre: v.Titre.trim(), Date_Debut: d(v.Date_Debut), Date_Fin: d(v.Date_Fin) || d(v.Date_Debut), Priorite: e?.priority || 'Normale'});
        ev.currentTarget.disabled = true;
        try {
          if (e) await act([['UpdateRecord', 'Calendrier_Fiscal', e.rowId, fields]]);
          else {
            const n = Math.max(0, ...rows('Calendrier_Fiscal').map(r => Number(String(r.Evenement_ID || '').replace(/\D/g, '')) || 0)) + 1;
            await act([['AddRecord', 'Calendrier_Fiscal', null, {...fields, ...fieldsFor('Calendrier_Fiscal', {Evenement_ID: `EVT-${String(n).padStart(3, '0')}`})}]]);
          }
          closeDrawer(); toast('Échéance enregistrée');
        } catch (err) { toast(err.message, 'error'); ev.currentTarget.disabled = false; }
      });
      el.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!await confirmDialog({title: 'Supprimer cette échéance ?', message: `« ${e.title} » sera retirée du calendrier.`, confirm: 'Supprimer', danger: true})) return;
        try { await act([['RemoveRecord', 'Calendrier_Fiscal', e.rowId]]); closeDrawer(); toast('Échéance supprimée'); } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

/* ── Qualité ────────────────────────────────────────────────────────── */
function qualityView(year) {
  const q = M.quality(year);
  const lv = {critical: ['Critique', 'critical'], warn: ['Vigilance', 'warn'], info: ['À compléter', 'info']};
  const sorted = q.checks.slice().sort((a, b) => (a.ok - b.ok) || ({critical: 0, warn: 1, info: 2}[a.level] - {critical: 0, warn: 1, info: 2}[b.level]));
  return `
  <section class="grid g-main">
    <article class="card">
      <div class="rows">${sorted.map(c => `<a class="row check${c.ok ? ' ok' : ''}" href="${attr(c.route)}">
        <span class="check-ic tone-${c.ok ? 'good' : lv[c.level][1]}">${icon(c.ok ? 'check' : 'alert', 15)}</span>
        <span class="row-main"><b>${esc(c.title)}</b><span>${c.ok ? 'Contrôle satisfait' : esc(c.fix)}</span>${!c.ok && c.detail ? `<span class="check-detail">${esc(c.detail)}</span>` : ''}</span>
        ${c.ok ? badge('OK', 'good') : `<span class="num strong">${c.count}</span>${badge(lv[c.level][0], lv[c.level][1])}`}
      </a>`).join('')}</div>
    </article>
    <aside class="stack">
      <article class="card card-pad score-card">
        ${ring(q.score, {size: 132, stroke: 10, tone: q.score >= 80 ? 'good' : q.score >= 60 ? 'accent' : 'warn', label: 'sur 100'})}
        <div><h2 class="card-title">Indice de qualité ${year}</h2>
        <p class="card-sub">${q.checks.filter(c => c.ok).length} contrôle(s) satisfait(s) sur ${q.checks.length}. Chaque contrôle compte au prorata de ce qui est conforme, pondéré : critique ×3, vigilance ×2, à compléter ×1.</p></div>
      </article>
      <article class="card card-pad"><h2 class="card-title">Comment il est calculé</h2>
        <p class="card-sub" style="margin-top:8px">Aucune valeur n’est estimée : un exercice sans produit est signalé comme manquant, jamais compté comme zéro. Les doublons de la table Taxes sont détectés par produit et exercice ; le portail retient la ligne la plus avancée (définitif, puis renseigné, puis prévision).</p></article>
    </aside>
  </section>`;
}

export function mount(root, {params}) {
  root.addEventListener('click', e => {
    if (e.target.closest('[data-new-task]')) return taskDrawer(null);
    const t = e.target.closest('[data-task]');
    if (t) return taskDrawer(Number(t.dataset.task));
    if (e.target.closest('[data-new-event]')) return eventDrawer(null);
    const ev = e.target.closest('[data-event]');
    if (ev) return eventDrawer(Number(ev.dataset.event));
  });
  root.addEventListener('change', async e => {
    const s = e.target.closest('[data-plan]');
    if (!s) return;
    s.className = `status-select tone-${planTone(s.value)}`;
    try { await act([['UpdateRecord', 'Plans_Actions', Number(s.dataset.plan), {Statut: s.value}]]); toast(`Statut : ${s.value}`); flash(document.querySelector(`[data-plan="${s.dataset.plan}"]`)?.closest('.plan')); }
    catch (err) { toast(err.message, 'error'); }
  });
  if (params.get('new') === '1') {
    history.replaceState(null, '', location.hash.replace(/[?&]new=1/, ''));
    params.get('tab') === 'calendrier' ? eventDrawer(null) : taskDrawer(null);
  }
}
