/* Recouvrement de la redevance spéciale, tous exercices confondus.
   Ce que le pôle doit encaisser, depuis quand, et ce qu'il reste à faire :
   titrer, relancer, mettre en demeure. Le courriel de relance est préparé
   ici mais part de la messagerie de l'agent (lien mailto) : le portail
   n'envoie rien lui-même. */
import * as M from '../model.js';
import { act, fieldsFor } from '../grist.js';
import { counted } from '../charts.js';
import { esc, attr, icon, fmt, badge, empty, openDrawer, patchDrawer, drawerOpen, drawerId, closeDrawer, toast, field, select, formData, flash } from '../ui.js';
import { author } from '../main.js';

const stageTone = s => M.RECOVERY_STAGES.find(x => x.key === s)?.tone || 'neutral';
const st = {stage: '', q: ''};
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const nextRelance = M.nextRelance;

function filtered(rec) {
  const words = norm(st.q).split(/\s+/).filter(Boolean);
  return rec.list.filter(c => (!st.stage || (st.stage === 'due' ? c.due : c.stage === st.stage)) &&
    (!words.length || words.every(w => norm(`${c.name} ${c.siret} ${c.years.map(y => y.title).join(' ')}`).includes(w))));
}

function rowsHtml(list) {
  if (!list.length) return `<tr><td colspan="6">${empty('Aucun dossier', 'Rien à recouvrer avec ces critères.')}</td></tr>`;
  const now = new Date().getFullYear();
  return list.map(c => `<tr data-reco="${attr(c.id)}" tabindex="0"${c.due ? ' class="is-due"' : ''}>
    <td><span class="strong">${esc(c.name)}</span><span class="sub">${esc([c.activity, c.contact].filter(Boolean).join(' · '))}</span></td>
    <td><span class="year-dues">${c.years.map(y => `<span class="year-due${y.year < now ? ' old' : ''}" data-tip="${attr(`<b>${y.year}</b> · ${esc(y.situation)}<br>Reste ${esc(fmt.eurc(y.rest))}${y.title ? `<br>Titre ${esc(y.title)}` : ''}`)}">${y.year}</span>`).join('')}</span></td>
    <td>${badge(c.stage, stageTone(c.stage))}</td>
    <td><span class="step">${esc(c.stepLabel)}</span>${c.nextDate ? `<span class="sub${c.due ? ' late' : ''}">${c.due ? 'à faire depuis le' : 'prévu le'} ${esc(fmt.dateShort(c.nextDate))}</span>` : ''}</td>
    <td class="num strong">${esc(fmt.eurc(c.rest))}</td>
    <td class="num"><button class="btn btn-sm" data-relance="${attr(c.id)}">${icon(c.stage === 'À relancer' ? 'mail' : 'arrow', 14)}${c.stage === 'À relancer' ? 'Relancer' : 'Ouvrir'}</button></td>
  </tr>`).join('');
}

export function render() {
  const rec = M.recovery();
  const list = filtered(rec);
  const now = new Date().getFullYear();
  const old = Object.entries(rec.byYear).filter(([y]) => Number(y) < now).reduce((s, [, v]) => s + v, 0);
  const years = Object.keys(rec.byYear).map(Number).sort((a, b) => a - b);
  const yc = y => y < now - 1 ? 'var(--critical)' : y < now ? 'var(--serious)' : 'var(--warn)';
  return `
  <section class="grid g-4">
    ${M.RECOVERY_STAGES.map(s => `<button class="card kpi kpi-btn kpi-stage" data-stage="${attr(s.key)}">
      <span class="kpi-label"><span class="chip-dot tone-${s.tone}"></span>${esc(s.key)}</span>
      <span class="kpi-value">${counted(rec.amounts[s.key] || 0, 'short', `rec-${s.key}`, esc(fmt.short(rec.amounts[s.key] || 0)))}</span>
      <span class="kpi-meta">${rec.counts[s.key] || 0} dossier(s) · ${esc(s.hint.toLowerCase())} ${icon('arrow', 13)}</span>
    </button>`).join('')}
    <button class="card kpi kpi-btn" data-stage="due"><span class="kpi-label">Relances à faire</span><span class="kpi-value">${counted(rec.due, 'int', 'rec-due', String(rec.due))}</span><span class="kpi-meta">date de prochaine action passée ${icon('arrow', 13)}</span></button>
  </section>

  <article class="card card-pad mt">
    <h2 class="card-title">Ancienneté des impayés</h2>
    <p class="card-sub">Reste dû par exercice d’origine, dossiers à vérifier compris · ${esc(fmt.pct(rec.rest ? old / rec.rest : null))} date d’avant ${now}</p>
    ${years.length ? `<div class="stackbar mt" role="img" aria-label="Reste par exercice">${years.map(y => `<span style="flex:${rec.byYear[y]};background:${yc(y)}" data-tip="${attr(`<b>${y}</b> · ${esc(fmt.eurc(rec.byYear[y]))}`)}"></span>`).join('')}</div>
    <div class="legend mt">${years.map(y => `<span><span class="sw" style="background:${yc(y)}"></span>${y} · ${esc(fmt.eur(rec.byYear[y]))}</span>`).join('')}</div>` : empty('Aucun impayé')}
  </article>

  <article class="card mt">
    <div class="toolbar card-toolbar">
      <label class="search-field">${icon('search', 16)}<input class="input" type="search" placeholder="Entreprise, SIRET, n° de titre…" value="${attr(st.q)}" data-keep="reco-q" aria-label="Rechercher un dossier"></label>
      <span class="toolbar-gap"></span>
      ${rec.counts['À relancer'] ? `<a class="btn btn-sm" href="#/fiche/relances">${icon('download', 14)}Courriers de relance (PDF) <span class="chip-n">${rec.counts['À relancer']}</span></a>` : ''}
      <span class="muted result-count">${list.length} / ${rec.list.length}</span>
    </div>
    <div class="chips-row" role="group" aria-label="Étape">
      <button class="chip" aria-pressed="${!st.stage}" data-stage="">Tous <span class="chip-n">${rec.list.length}</span></button>
      ${M.RECOVERY_STAGES.filter(s => rec.counts[s.key]).map(s => `<button class="chip" aria-pressed="${st.stage === s.key}" data-stage="${attr(s.key)}" title="${attr(s.hint)}"><span class="chip-dot tone-${s.tone}"></span>${esc(s.key)} <span class="chip-n">${rec.counts[s.key]}</span></button>`).join('')}
      ${rec.due ? `<button class="chip" aria-pressed="${st.stage === 'due'}" data-stage="due"><span class="chip-dot tone-critical"></span>Relances à faire <span class="chip-n">${rec.due}</span></button>` : ''}
    </div>
    <div class="table-wrap"><table class="t reco-table">
      <thead><tr><th>Entreprise</th><th>Exercices dus</th><th>À faire</th><th>Étape du dossier</th><th class="num">Reste dû</th><th></th></tr></thead>
      <tbody data-reco-body>${rowsHtml(list)}</tbody>
    </table></div>
  </article>`;
}

/* ── Fiche de relance ──────────────────────────────────────────────── */
const titled = c => c.years.filter(y => /titre [ée]mis|partiel/i.test(y.situation));
const relanceYears = M.relanceYears;

function mailText(c) {
  const ys = relanceYears(c);
  const total = ys.reduce((s, y) => s + y.rest, 0);
  const lines = ys.map(y => `- Exercice ${y.year} : ${fmt.eurc(y.rest)}${y.title ? ` (titre n° ${y.title}${y.titleDate ? ` du ${fmt.date(y.titleDate)}` : ''})` : ''}`);
  const subject = `Redevance spéciale — ${c.relances >= 2 ? 'dernier rappel avant mise en demeure' : 'rappel de paiement'} — ${c.name}`;
  const body = `Madame, Monsieur,

Sauf erreur de notre part, les sommes suivantes dues au titre de la redevance spéciale restent impayées à ce jour :

${lines.join('\n')}

Total restant dû : ${fmt.eurc(total)}

Nous vous remercions de bien vouloir procéder à leur règlement auprès du comptable public dans les meilleurs délais. Si vous estimez ces sommes non dues ou si le paiement a déjà été effectué, merci de nous le faire savoir en réponse à ce message.

Cordialement,

${author() === 'Portail' ? '' : `${author()}\n`}Pôle fiscalité — CADEMA`;
  return {subject, body};
}

function fiche(id) {
  const c = M.recovery().list.find(x => x.id === id);
  if (!c) return null;
  const mail = mailText(c);
  const today = new Date();
  const title = esc(c.name);
  const subtitle = `${badge(c.stage, stageTone(c.stage))}<span>Reste dû ${esc(fmt.eurc(c.rest))}</span>${c.email ? `<span>${esc(c.email)}</span>` : '<span class="late">Pas d’e-mail dans la fiche</span>'}`;
  const body = `
    <p class="form-section">Sommes dues</p>
    <div class="table-wrap mini"><table class="t">
      <thead><tr><th>Exercice</th><th>Situation</th><th>Titre</th><th class="num">Facturé</th><th class="num">Réglé</th><th class="num">Reste</th></tr></thead>
      <tbody>${c.years.map(y => `<tr${c.stage === 'À relancer' && !titled(c).includes(y) ? ' class="is-out"' : ''}><td class="strong">${y.year}</td><td>${badge(y.situation, M.situationTone(y.situation))}</td><td>${y.title ? esc(y.title) : '<span class="miss">—</span>'}</td>
        <td class="num">${esc(fmt.eurc(y.billed))}</td><td class="num">${esc(fmt.eurc(y.paid))}</td><td class="num strong">${esc(fmt.eurc(y.rest))}</td></tr>`).join('')}</tbody>
    </table></div>
    ${c.stage === 'À relancer' && titled(c).length < c.years.length ? `<p class="field-hint mt">Le courriel ne relance que les exercices titrés (${titled(c).map(y => y.year).join(', ')}). Les lignes grisées ne sont pas encore exigibles.</p>` : ''}
    ${c.stage !== 'À relancer' ? `<div class="notice mt">${icon('info', 16)}<span>${c.stage === 'À titrer' ? 'Aucun titre n’est encore émis : la relance porte sur un montant non titré. Le plus souvent, il faut d’abord émettre le titre.' : 'La situation de ces exercices est à vérifier avant toute relance.'} Pour changer la situation d’un exercice : <a class="link" href="#/redevance/${encodeURIComponent(c.id)}">fiche de suivi annuel</a>.</span></div>` : ''}

    <p class="form-section">Courriel de relance</p>
    <form class="form-grid" id="mail-form">
      <div class="span-2">${field('À', `<input type="email" name="to" value="${attr(c.email)}" placeholder="adresse e-mail de l’entreprise">`)}</div>
      <div class="span-2">${field('Objet', `<input name="subject" value="${attr(mail.subject)}">`)}</div>
      <div class="span-2">${field('Message', `<textarea name="body" rows="14" class="mail-body">${esc(mail.body)}</textarea>`, 'Modifiable avant envoi. Le message part de votre messagerie ; le portail n’envoie rien.')}</div>
      <div class="span-2 form-actions"><span></span><span class="btn-row">
        <button type="button" class="btn" data-copy>${icon('file', 15)}Copier le texte</button>
        <button type="button" class="btn btn-primary" data-mailto>${icon('mail', 15)}Ouvrir dans ma messagerie</button></span></div>
    </form>

    <p class="form-section">Suivi du dossier</p>
    <form class="form-grid" id="step-form">
      ${field('Étape actuelle', select('Etape_Actuelle', M.RS_STEPS, M.RS_STEPS.includes(c.stepLabel) ? c.stepLabel : 'À qualifier'))}
      ${field('Suivi par', select('Pilote_Dossier', [['', '—'], ...M.people().map(p => p.name)], c.pilot || ''))}
      ${field('Prochaine action', `<input name="Prochaine_Action" value="${attr(c.nextAction)}" placeholder="ex. vérifier le paiement">`)}
      ${field('Date de la prochaine action', `<input type="date" name="Date_Prochaine_Action" value="${attr(fmt.iso(c.nextDate))}">`)}
      <div class="span-2">${field('Journal', `<textarea name="Notes" rows="4">${esc(c.notes)}</textarea>`, 'Chaque relance marquée ajoute une ligne datée en tête.')}</div>
      <div class="span-2 form-actions"><span class="muted">Écrit dans Entreprises_RS</span><button type="submit" class="btn">${icon('check', 15)}Enregistrer le suivi</button></div>
    </form>`;
  const footer = `<a class="btn btn-ghost left" href="#/fiche/relances?id=${encodeURIComponent(c.id)}">${icon('download', 15)}Courrier PDF</a><button class="btn btn-ghost" data-close>Fermer</button>
    <button class="btn btn-primary" data-mark>${icon('check', 15)}Marquer « ${esc(nextRelance(c))} » envoyée</button>`;
  return {c, title, subtitle, body, footer, today};
}

function openReco(id) {
  const fc = fiche(id);
  if (!fc) { toast('Dossier introuvable ou soldé', 'info'); return; }
  if (drawerOpen() && drawerId() === `reco:${id}`) { patchDrawer(fc); return; }
  openDrawer({
    id: `reco:${id}`, wide: true, title: fc.title, subtitle: fc.subtitle, body: fc.body, footer: fc.footer,
    onClose: () => history.replaceState(null, '', '#/redevance?tab=recouvrement'),
    onMount: el => bind(el, id),
  });
}

function bind(el, id) {
  const company = () => M.recovery().list.find(x => x.id === id);
  el.addEventListener('click', async e => {
    if (e.target.closest('[data-copy]')) {
      const v = formData(el.querySelector('#mail-form'));
      try { await navigator.clipboard.writeText(`Objet : ${v.subject}\n\n${v.body}`); toast('Texte copié'); }
      catch { el.querySelector('.mail-body').select(); toast('Copie automatique refusée : texte sélectionné, faites Ctrl C', 'info'); }
      return;
    }
    if (e.target.closest('[data-mailto]')) {
      const v = formData(el.querySelector('#mail-form'));
      const href = `mailto:${encodeURIComponent(v.to.trim())}?subject=${encodeURIComponent(v.subject)}&body=${encodeURIComponent(v.body)}`;
      const a = Object.assign(document.createElement('a'), {href, target: '_blank', rel: 'noopener'});
      document.body.appendChild(a); a.click(); a.remove();
      toast('Message ouvert dans votre messagerie. Après l’envoi, marquez la relance.', 'info', {timeout: 6000});
      return;
    }
    const mark = e.target.closest('[data-mark]');
    if (mark) {
      const c = company();
      if (!c) return;
      const {step, next, fields} = M.relanceFields(c, author());
      mark.disabled = true;
      try {
        await act([['UpdateRecord', 'Entreprises_RS', c.rowId, fieldsFor('Entreprises_RS', fields)]]);
        toast(`${step} enregistrée · prochain point le ${fmt.date(next)}`);
        openReco(id);
        flash(document.querySelector(`tr[data-reco="${CSS.escape(id)}"]`));
      } catch (err) { toast(err.message, 'error'); mark.disabled = false; }
    }
  });
  el.addEventListener('submit', async e => {
    e.preventDefault();
    if (e.target.id !== 'step-form') return;
    const c = company();
    if (!c) return;
    const v = formData(e.target);
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await act([['UpdateRecord', 'Entreprises_RS', c.rowId, fieldsFor('Entreprises_RS', {
        ...v, Date_Prochaine_Action: v.Date_Prochaine_Action ? M.toGristDate(new Date(`${v.Date_Prochaine_Action}T00:00:00`)) : null, Derniere_MAJ: M.nowSeconds(),
      })]]);
      toast('Suivi du dossier enregistré');
      openReco(id);
      flash(document.querySelector(`tr[data-reco="${CSS.escape(id)}"]`));
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
  });
}

export function mount(root, params) {
  const body = root.querySelector('[data-reco-body]');
  const redraw = (fade = false) => {
    const rec = M.recovery();
    const list = filtered(rec);
    body.innerHTML = rowsHtml(list);
    if (fade) body.animate([{opacity: .3}, {opacity: 1}], {duration: 180, easing: 'ease-out'});
    root.querySelector('.result-count').textContent = `${list.length} / ${rec.list.length}`;
  };
  root.querySelector('.search-field input').addEventListener('input', e => { st.q = e.target.value; redraw(); });
  root.addEventListener('click', e => {
    const chip = e.target.closest('[data-stage]');
    if (chip) {
      st.stage = chip.dataset.stage;
      root.querySelectorAll('.chips-row [data-stage]').forEach(b => b.setAttribute('aria-pressed', b.dataset.stage === st.stage));
      redraw(true);
      if (chip.classList.contains('kpi-btn')) root.querySelector('.reco-table').scrollIntoView({behavior: 'smooth', block: 'start'});
      return;
    }
    const tr = e.target.closest('[data-relance], tr[data-reco]');
    if (tr) {
      const id = tr.dataset.relance || tr.dataset.reco;
      history.replaceState(null, '', `#/redevance?tab=recouvrement&relance=${encodeURIComponent(id)}`);
      openReco(id);
    }
  });
  body.addEventListener('keydown', e => {
    const tr = e.target.closest('tr[data-reco]');
    if (tr && e.target === tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openReco(tr.dataset.reco); }
  });
  const want = params.get('relance');
  if (want && !(drawerOpen() && drawerId() === `reco:${want}`)) openReco(want);
}
