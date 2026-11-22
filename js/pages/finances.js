import * as M from '../model.js';
import { rows, act, fieldsFor } from '../grist.js';
import { counted } from '../charts.js';
import { esc, attr, icon, fmt, badge, empty, openDrawer, closeDrawer, toast, field, select, formData, downloadCsv } from '../ui.js';

export function render({year, params}) {
  const tab = ['dotations', 'recettes'].includes(params.get('tab')) ? params.get('tab') : 'budget';
  const titles = {budget: 'Budgets et compte financier unique', recettes: `Recettes ${year} par budget`, dotations: 'Dotations et péréquation'};
  const ledes = {
    budget: 'Résultats par budget et par section, tels qu’importés du CFU. Le rapprochement avec le grand livre est signalé ligne par ligne.',
    recettes: 'Les recettes suivies par le pôle fiscalité, rangées dans le budget qui les encaisse : principal, déchets, mobilité. Chaque montant indique son statut et sa source.',
    dotations: 'Dotation globale de fonctionnement et fonds de péréquation intercommunal (FPIC), avec leur source.',
  };
  return `
  <section class="ph">
    <div>
      <p class="ph-eyebrow">Finances</p>
      <h1>${titles[tab]}</h1>
      <p class="ph-lede">${ledes[tab]}</p>
    </div>
    ${tab === 'recettes' ? `<div class="ph-actions">
      <button class="btn" data-rb-copy>${icon('table', 16)}Copier le tableau</button>
      <button class="btn btn-primary" data-rb-export>${icon('download', 16)}Exporter pour Excel</button>
    </div>` : ''}
  </section>
  <div class="toolbar"><nav class="tabs" aria-label="Sections">
    <a href="#/finances?tab=recettes" ${tab === 'recettes' ? 'aria-current="page"' : ''}>${icon('chart', 15)}Recettes par budget</a>
    <a href="#/finances" ${tab === 'budget' ? 'aria-current="page"' : ''}>${icon('wallet', 15)}Budget &amp; CFU</a>
    <a href="#/finances?tab=dotations" ${tab === 'dotations' ? 'aria-current="page"' : ''}>${icon('landmark', 15)}Dotations</a>
  </nav></div>
  ${tab === 'budget' ? budget(year) : tab === 'recettes' ? byBudget(year) : dotations(year)}`;
}

function budget(year) {
  const budgets = rows('Budgets');
  const cfu = rows('CFU_Synthese');
  if (!budgets.length && !cfu.length) return `<article class="card">${empty('Aucun budget importé', 'Les tables Budgets et CFU_Synthese sont vides.')}</article>`;
  const byBudget = new Map();
  for (const r of cfu) {
    const k = `${M.text(r.Budget)}|${M.num(r.Exercice)}`;
    if (!byBudget.has(k)) byBudget.set(k, []);
    byBudget.get(k).push(r);
  }
  const max = Math.max(1, ...cfu.map(r => Math.max(M.num(r.Recettes_Ligne_B) || 0, M.num(r.Depenses_Ligne_E) || 0)));
  const order = {'Fonctionnement': 0, 'Investissement': 1, 'Total': 2};
  return `
  <section class="grid g-3">
    ${budgets.map(b => {
      const rec = M.num(b.Recettes_Realisees), dep = M.num(b.Depenses_Realisees), res = M.num(b.Resultat);
      const missing = rec === null;
      return `<article class="card kpi">
        <span class="kpi-label">${esc(M.text(b.Budget))} · ${M.num(b.Exercice) ?? ''}</span>
        <span class="kpi-value">${missing ? '<span class="miss">À importer</span>' : counted(res, 'short', `fin-res-${b.id}`, esc(fmt.short(res)))}<small>${missing ? '' : 'résultat'}</small></span>
        <span class="kpi-meta">${missing ? esc(M.text(b.Source) || 'Source à préciser') : `Recettes ${esc(fmt.short(rec))} · Dépenses ${esc(fmt.short(dep))}`}</span>
        <span class="kpi-meta">${missing ? badge('Non importé', 'warn') : badge(M.text(b.Source) || 'CFU', 'neutral')}</span>
      </article>`;
    }).join('')}
  </section>

  ${[...byBudget.entries()].map(([k, list]) => {
    const [name, y] = k.split('|');
    return `<article class="card mt">
      <div class="card-head"><div><h2>${esc(name)} · CFU ${esc(y)}</h2><p class="card-sub">${esc(M.text(list[0].Tableau_Source))}${M.num(list[0].Page_Source) ? ` · page ${M.num(list[0].Page_Source)}` : ''}</p></div>
        ${list.some(r => /contr[oô]ler/i.test(M.text(r.Controle_GL))) ? badge('Rapprochement GL à faire', 'warn') : badge('Rapproché', 'good')}</div>
      <div class="card-body">
        <div class="cfu">
          ${list.sort((a, b) => (order[M.text(a.Section)] ?? 9) - (order[M.text(b.Section)] ?? 9)).map(r => {
            const rec = M.num(r.Recettes_Ligne_B) || 0, dep = M.num(r.Depenses_Ligne_E) || 0, res = M.num(r.Resultat);
            return `<div class="cfu-row${M.text(r.Section) === 'Total' ? ' is-total' : ''}">
              <span class="cfu-name">${esc(M.text(r.Section))}</span>
              <span class="cfu-bars">
                <span class="cfu-bar" data-tip="${attr(`<b>Recettes</b> (ligne B) · ${esc(fmt.eurc(rec))}`)}"><span style="width:${rec / max * 100}%;background:var(--s1)"></span><em>${esc(fmt.short(rec))}</em></span>
                <span class="cfu-bar" data-tip="${attr(`<b>Dépenses</b> (ligne E) · ${esc(fmt.eurc(dep))}`)}"><span style="width:${dep / max * 100}%;background:var(--s2)"></span><em>${esc(fmt.short(dep))}</em></span>
              </span>
              <span class="cfu-res num ${res >= 0 ? 'up' : 'down'}">${res >= 0 ? '+' : ''}${esc(fmt.short(res))}</span>
            </div>`;
          }).join('')}
        </div>
        <div class="legend mt"><span><span class="sw" style="background:var(--s1)"></span>Recettes réalisées (ligne B)</span><span><span class="sw" style="background:var(--s2)"></span>Dépenses réalisées (ligne E)</span><span class="muted">À droite : résultat de l’exercice</span></div>
      </div>
    </article>`;
  }).join('')}`;
}

function dotations(year) {
  const dgf = rows('DGF_Detail');
  const fpic = rows('FPIC_Repartition').sort((a, b) => M.num(b.Exercice) - M.num(a.Exercice));
  if (!dgf.length && !fpic.length) return `<article class="card">${empty('Aucune dotation saisie')}</article>`;
  return `
  <section class="grid g-3">
    ${dgf.map(d => {
      const pop = M.num(d.Population), amt = M.num(d.Montant);
      return `<article class="card kpi">
        <span class="kpi-label">${esc(M.text(d.Intitule))} · ${M.num(d.Exercice) ?? ''}</span>
        <span class="kpi-value">${counted(amt, 'short', `fin-dgf-${d.id}`, esc(fmt.short(amt)))}</span>
        <span class="kpi-meta">${pop ? `${esc(fmt.int(pop))} habitants · ${esc(fmt.eurc(amt / pop))} / hab.` : '&nbsp;'}</span>
        <span class="kpi-meta muted">${esc(M.text(d.Source))}</span>
      </article>`;
    }).join('')}
  </section>
  ${fpic.map(r => {
    const total = M.num(r.Total);
    const parts = [['EPCI (CADEMA)', M.num(r.Part_EPCI), 'var(--accent)'], ['Mamoudzou', M.num(r.Part_Mamoudzou), 'var(--s1)'], ['Dembéni', M.num(r.Part_Dembeni), 'var(--s4)']];
    const known = parts.filter(p => p[1] !== null);
    return `<article class="card mt">
      <div class="card-head"><div><h2>FPIC ${M.num(r.Exercice)} · répartition</h2><p class="card-sub">${esc(M.text(r.Mode))} · ${esc(M.text(r.Source))}</p></div>
        <button class="btn btn-sm" data-fpic="${r.id}">${icon('edit', 14)}Saisir la répartition</button></div>
      <div class="card-body">
        <p class="kpi-value">${counted(total, 'eur', `fin-fpic-${r.id}`, esc(fmt.eur(total)))}</p>
        ${known.length ? `<div class="stackbar mt">${known.map(([l, v, c]) => `<span style="flex:${v};background:${c}" data-tip="${attr(`<b>${esc(l)}</b> · ${esc(fmt.eur(v))}`)}"></span>`).join('')}</div>
          <div class="legend mt">${parts.map(([l, v, c]) => `<span><span class="sw" style="background:${c}"></span>${esc(l)} · ${v !== null ? esc(fmt.eur(v)) : 'non saisi'}</span>`).join('')}</div>`
        : `<div class="notice mt">${icon('info', 16)}<span>La répartition entre l’EPCI et les communes n’est pas encore saisie. Elle figure dans la notification de la préfecture.</span></div>`}
      </div>
    </article>`;
  }).join('')}`;
}

function editFpic(id) {
  const r = rows('FPIC_Repartition').find(x => x.id === id);
  if (!r) return;
  openDrawer({
    title: `FPIC ${M.num(r.Exercice)}`, subtitle: 'Répartition notifiée — table FPIC_Repartition',
    body: `<form class="form-grid" id="fpic-form">
      ${field('Montant total (€)', `<input name="Total" inputmode="decimal" value="${attr(M.num(r.Total) ?? '')}">`)}
      ${field('Mode de répartition', select('Mode', ['Droit commun', 'Dérogatoire à la majorité des 2/3', 'Dérogatoire libre'], M.text(r.Mode) || 'Droit commun'))}
      ${field('Part EPCI (€)', `<input name="Part_EPCI" inputmode="decimal" value="${attr(M.num(r.Part_EPCI) ?? '')}" autofocus>`)}
      ${field('Part Mamoudzou (€)', `<input name="Part_Mamoudzou" inputmode="decimal" value="${attr(M.num(r.Part_Mamoudzou) ?? '')}">`)}
      ${field('Part Dembéni (€)', `<input name="Part_Dembeni" inputmode="decimal" value="${attr(M.num(r.Part_Dembeni) ?? '')}">`)}
      <div class="span-2">${field('Source', `<input name="Source" value="${attr(M.text(r.Source))}">`)}</div>
    </form>`,
    footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-save>${icon('check', 16)}Enregistrer</button>`,
    onMount(el) {
      el.querySelector('[data-save]').addEventListener('click', async e => {
        const v = formData(el.querySelector('#fpic-form'));
        const n = k => M.num(v[k]);
        const sum = (n('Part_EPCI') || 0) + (n('Part_Mamoudzou') || 0) + (n('Part_Dembeni') || 0);
        if (n('Total') && sum && Math.abs(sum - n('Total')) > 1) toast(`Attention : les parts totalisent ${fmt.eur(sum)}, pas ${fmt.eur(n('Total'))}`, 'info', {timeout: 6000});
        e.currentTarget.disabled = true;
        try {
          await act([['UpdateRecord', 'FPIC_Repartition', id, fieldsFor('FPIC_Repartition', {Total: n('Total'), Mode: v.Mode, Part_EPCI: n('Part_EPCI'), Part_Mamoudzou: n('Part_Mamoudzou'), Part_Dembeni: n('Part_Dembeni'), Source: v.Source})]]);
          closeDrawer(); toast('Répartition FPIC enregistrée');
        } catch (err) { toast(err.message, 'error'); e.currentTarget.disabled = false; }
      });
    },
  });
}


/* ── Recettes par budget ───────────────────────────────────────────── */
/* Couleur d'une recette : celle de la palette fiscale pour les six produits,
   des tons distincts (jamais recyclés) pour la redevance et les dotations. */
const lineColor = l => l.slot ? `var(--s${l.slot})` : l.code === 'RS' ? 'var(--accent)' : l.code === 'DGF' ? 'var(--info)' : 'var(--ink-3)';
const statusTone = s => /d[ée]finitif|notifi/i.test(s || '') ? 'good' : /pr[ée]vision/i.test(s || '') ? 'warn' : s ? 'info' : 'neutral';

function byBudget(year) {
  const budgets = M.revenueByBudget(year);
  const grand = budgets.filter(b => b.total !== null);
  const all = grand.reduce((s, b) => s + b.total, 0);
  return `
  <section class="grid g-3">
    ${budgets.map(b => {
      const parts = b.lines.filter(l => l.amount > 0);
      return `<article class="card kpi rb-kpi" data-rb-jump="${attr(b.key)}" role="button" tabindex="0" aria-label="Voir le détail du ${attr(b.label.toLowerCase())}">
        <span class="kpi-label">${esc(b.label)}</span>
        <span class="kpi-value">${b.total === null ? '<span class="miss">Aucune donnée</span>' : counted(b.total, 'short', `fin-rb-${b.key}`, esc(fmt.short(b.total)))}</span>
        <span class="kpi-meta">${b.covered} recette${b.covered > 1 ? 's' : ''} renseignée${b.covered > 1 ? 's' : ''} sur ${b.expected}${all && b.total ? ` · ${esc(fmt.pct(b.total / all))} du total suivi` : ''}</span>
        ${parts.length ? `<span class="stackbar rb-stack" aria-hidden="true">${parts.map(l => `<span style="flex:${l.amount};background:${lineColor(l)}" data-tip="${attr(`<b>${esc(l.label)}</b> · ${esc(fmt.eur(l.amount))}`)}"></span>`).join('')}</span>` : ''}
        <span class="kpi-meta">${b.delta !== null
          ? `<span class="delta ${b.delta >= 0 ? 'up' : 'down'}">${esc(fmt.delta(b.delta))}</span> par rapport à ${year - 1}, sur ${b.comparable} recette${b.comparable > 1 ? 's' : ''} connue${b.comparable > 1 ? 's' : ''} les deux années`
          : `<span class="muted">Évolution non calculable : ${year - 1} non renseigné</span>`}</span>
        ${b.forecastShare ? `<span class="kpi-meta">${badge(`${b.forecastShare} montant${b.forecastShare > 1 ? 's' : ''} en prévision`, 'warn')}</span>` : ''}
      </article>`;
    }).join('')}
  </section>
  ${budgets.map(b => budgetCard(b, year)).join('')}
  <div class="notice mt">${icon('info', 16)}<span>Le rattachement d’une recette à un budget se corrige dans Grist, sans toucher au portail : table <b>Parametres</b>, une ligne avec la clé <b>BUDGET_</b> suivie du code (par exemple <b>BUDGET_TEOM</b>) et la valeur <b>Principal</b>, <b>Déchets</b> ou <b>Mobilité</b>. Les totaux n’additionnent que les montants renseignés : un « — » n’est jamais compté comme zéro.</span></div>`;
}

function budgetCard(b, year) {
  const hasExec = b.lines.some(l => l.forecast !== null && l.forecast !== undefined);
  const prevTotal = b.lines.filter(l => l.prev !== null).reduce((s, l) => s + l.prev, 0);
  return `<article class="card mt rb-card" data-rb-card="${attr(b.key)}">
    <div class="card-head"><div><p class="card-eyebrow">${esc(b.label)}</p><h2>${b.total === null ? 'Aucune recette renseignée' : `${esc(fmt.eur(b.total))} en ${year}`}</h2>
      <p class="card-sub">${b.lines.map(l => esc(l.code === 'RS' ? 'Redevance spéciale' : l.code === 'FPIC' ? 'FPIC' : l.code)).join(' · ')}</p></div>
      ${b.covered < b.expected ? badge(`${b.expected - b.covered} à compléter`, 'warn') : badge('Complet', 'good')}</div>
    <div class="table-wrap"><table class="t rb-table">
      <thead><tr><th>Recette</th><th>Statut</th><th class="num">${year - 1}</th><th class="num year-col">${year}</th><th class="num">Évolution</th>${hasExec ? '<th>Exécution</th>' : ''}<th>Source</th></tr></thead>
      <tbody>${b.lines.map(l => {
        const d = l.amount !== null && l.prev ? l.amount / l.prev - 1 : null;
        const exec = l.forecast ? (l.realised || 0) / l.forecast : null;
        return `<tr data-href="${attr(l.href)}">
          <td><span class="cell-name"><span class="sw" style="background:${lineColor(l)}"></span><span><span class="strong">${esc(l.code === 'RS' || l.code === 'DGF' || l.code === 'FPIC' ? l.label : l.code)}</span><span class="sub">${esc(l.kind === 'fiscal' ? l.label : l.kind === 'rs' && l.paid !== null ? `Encaissé ${fmt.eur(l.paid)} · reste ${fmt.eur(l.rest)}` : l.kind === 'rs' ? 'Montants titrés' : 'Dotation de l’État')}</span></span></span></td>
          <td>${l.status ? badge(l.status, statusTone(l.status)) : '<span class="miss">Non renseigné</span>'}</td>
          <td class="num">${l.prev !== null ? esc(fmt.eur(l.prev)) : '<span class="miss">—</span>'}</td>
          <td class="num year-col${l.amount === null ? ' miss-cell' : ''}"><span class="${/pr[ée]vision/i.test(l.status || '') ? 'is-forecast' : ''}">${l.amount !== null ? esc(fmt.eur(l.amount)) : '—'}</span></td>
          <td class="num">${d !== null ? `<span class="delta ${d >= 0 ? 'up' : 'down'}">${esc(fmt.delta(d))}</span>` : '<span class="miss">—</span>'}</td>
          ${hasExec ? `<td style="min-width:130px">${exec !== null ? `<div class="exec"><div class="bar"><span style="width:${Math.min(100, exec * 100)}%"></span></div><span class="num">${esc(fmt.pct(exec))}</span></div>` : '<span class="miss">—</span>'}</td>` : ''}
          <td class="muted">${esc(l.source) || '<span class="miss">À préciser</span>'}</td>
        </tr>`;
      }).join('')}</tbody>
      <tfoot><tr><td>Total renseigné</td><td></td><td class="num">${prevTotal ? esc(fmt.eur(prevTotal)) : '—'}</td><td class="num year-col">${b.total !== null ? esc(fmt.eur(b.total)) : '—'}<span class="sub">${b.covered}/${b.expected}</span></td><td class="num">${b.delta !== null ? `<span class="delta ${b.delta >= 0 ? 'up' : 'down'}">${esc(fmt.delta(b.delta))}</span>` : ''}</td>${hasExec ? '<td></td>' : ''}<td></td></tr></tfoot>
    </table></div>
  </article>`;
}

/* Tableau à plat, une ligne par recette : ce que la comptabilité colle dans Excel. */
function flatTable(year) {
  const head = ['Budget', 'Code', 'Recette', 'Statut', `Montant ${year - 1}`, `Montant ${year}`, 'Évolution', 'Prévision', 'Réalisé', 'Encaissé (RS)', 'Reste à recouvrer (RS)', 'Source'];
  const n = v => v === null || v === undefined ? '' : String(Math.round(v * 100) / 100).replace('.', ',');
  const lines = [];
  for (const b of M.revenueByBudget(year)) {
    for (const l of b.lines) {
      const d = l.amount !== null && l.prev ? l.amount / l.prev - 1 : null;
      lines.push([b.label, l.code, l.label, l.status || 'Non renseigné', n(l.prev), n(l.amount), d === null ? '' : fmt.delta(d), n(l.forecast), n(l.realised), n(l.paid), n(l.rest), l.source || '']);
    }
    lines.push([b.label, '', `Total renseigné (${b.covered}/${b.expected})`, '', '', n(b.total), b.delta === null ? '' : fmt.delta(b.delta), '', '', '', '', '']);
  }
  return {head, lines};
}

export function mount(root, ctx = {}) {
  root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-rb-jump]')) { e.preventDefault(); e.target.click(); } });
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-fpic]');
    if (b) { editFpic(Number(b.dataset.fpic)); return; }
    const tr = e.target.closest('tr[data-href]');
    if (tr && !e.target.closest('button, a')) { location.hash = tr.dataset.href; return; }
    const jump = e.target.closest('[data-rb-jump]');
    if (jump) { root.querySelector(`[data-rb-card="${CSS.escape(jump.dataset.rbJump)}"]`)?.scrollIntoView({behavior: 'smooth', block: 'start'}); return; }
    const year = ctx.year || M.defaultYear();
    if (e.target.closest('[data-rb-export]')) {
      const {head, lines} = flatTable(year);
      try { downloadCsv(`recettes-par-budget-${year}.csv`, head, lines); toast('Fichier prêt : il s’ouvre directement dans Excel'); }
      catch { toast('Le téléchargement est bloqué ici : utilisez « Copier le tableau », puis collez dans Excel.', 'info', {timeout: 7000}); }
      return;
    }
    if (e.target.closest('[data-rb-copy]')) {
      const {head, lines} = flatTable(year);
      const tsv = [head, ...lines].map(r => r.map(v => String(v).replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
      try { await navigator.clipboard.writeText(tsv); toast('Tableau copié : collez-le dans Excel (Ctrl+V)'); }
      catch { toast('La copie est bloquée par le navigateur : utilisez « Exporter pour Excel ».', 'error', {timeout: 7000}); }
    }
  });
}
