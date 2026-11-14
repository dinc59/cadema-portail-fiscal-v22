import * as M from '../model.js';
import { rows, act, fieldsFor } from '../grist.js';
import { esc, attr, icon, fmt, badge, empty, openDrawer, closeDrawer, toast, field, select, formData } from '../ui.js';

export function render({year, params}) {
  const tab = params.get('tab') === 'dotations' ? 'dotations' : 'budget';
  return `
  <section class="ph">
    <div>
      <p class="ph-eyebrow">Finances</p>
      <h1>${tab === 'budget' ? 'Budgets et compte financier unique' : 'Dotations et péréquation'}</h1>
      <p class="ph-lede">${tab === 'budget' ? 'Résultats par budget et par section, tels qu’importés du CFU. Le rapprochement avec le grand livre est signalé ligne par ligne.' : 'Dotation globale de fonctionnement et fonds de péréquation intercommunal (FPIC), avec leur source.'}</p>
    </div>
  </section>
  <div class="toolbar"><nav class="tabs" aria-label="Sections">
    <a href="#/finances" ${tab === 'budget' ? 'aria-current="page"' : ''}>${icon('wallet', 15)}Budget &amp; CFU</a>
    <a href="#/finances?tab=dotations" ${tab === 'dotations' ? 'aria-current="page"' : ''}>${icon('landmark', 15)}Dotations</a>
  </nav></div>
  ${tab === 'budget' ? budget(year) : dotations(year)}`;
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
        <span class="kpi-value">${missing ? '<span class="miss">À importer</span>' : esc(fmt.short(res))}<small>${missing ? '' : 'résultat'}</small></span>
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
        <span class="kpi-value">${esc(fmt.short(amt))}</span>
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
        <p class="kpi-value">${esc(fmt.eur(total))}</p>
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

export function mount(root) {
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-fpic]');
    if (b) editFpic(Number(b.dataset.fpic));
  });
}
