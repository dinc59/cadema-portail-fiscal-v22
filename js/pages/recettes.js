import * as M from '../model.js';
import { rows, act, fieldsFor } from '../grist.js';
import { esc, attr, icon, fmt, badge, empty, openDrawer, closeDrawer, toast, field, select, formData, confirmDialog, downloadCsv } from '../ui.js';
import { seriesBars, spark } from '../charts.js';
import { author } from '../main.js';

const STATUS = ['Définitif', 'Notifié', 'Renseigné', 'Prévision'];
const statusTone = s => ({'Définitif': 'good', 'Notifié': 'good', 'Renseigné': 'info', 'Prévision': 'warn'}[s] || 'neutral');

export function render(ctx) {
  const code = String(ctx.sub || '').toUpperCase();
  return M.taxByCode(code) ? detail(ctx, M.taxByCode(code)) : overview(ctx);
}

function overview({year}) {
  const ys = [...new Set([...M.taxYears(), year])].sort((a, b) => a - b);
  const tot = M.taxTotal(year), prev = M.taxTotal(year - 1);
  const prods = M.TAXES.map(t => ({t, p: M.produit(t.code, year)})).filter(x => x.p);
  return `
  <section class="ph">
    <div>
      <p class="ph-eyebrow">Recettes fiscales</p>
      <h1>${esc(fmt.eur(tot.total))} de produits renseignés en ${year}</h1>
      <p class="ph-lede">${tot.covered} produit(s) sur 6 renseigné(s) pour ${year}. Les cases hachurées sont des exercices sans produit dans la table Taxes — ils ne comptent pas comme zéro.</p>
    </div>
    <div class="ph-actions">
      <button class="btn" data-export>${icon('download', 16)}Exporter</button>
      <button class="btn btn-primary" data-edit-tax="">${icon('plus', 16)}Saisir un produit</button>
    </div>
  </section>

  <article class="card">
    <div class="table-wrap">
      <table class="t matrix">
        <thead><tr><th>Produit</th>${ys.map(y => `<th class="num${y === year ? ' year-col' : ''}">${y}</th>`).join('')}<th class="num">Évol. ${year}</th><th>Tendance</th></tr></thead>
        <tbody>
          ${M.TAXES.map(t => {
            const cur = M.taxCell(t.code, year)?.amount, pv = M.taxCell(t.code, year - 1)?.amount;
            const d = cur != null && pv ? cur / pv - 1 : null;
            return `<tr data-href="#/recettes/${t.code}">
              <td><span class="cell-name"><span class="sw" style="background:var(--s${t.slot})"></span><span><span class="strong">${esc(t.code)}</span><span class="sub">${esc(t.label)}</span></span></span></td>
              ${ys.map(y => {
                const c = M.taxCell(t.code, y);
                if (!c || c.amount == null) return `<td class="num miss-cell${y === year ? ' year-col' : ''}" title="Non renseigné">—</td>`;
                return `<td class="num${y === year ? ' year-col' : ''}" data-tip="${attr(`<b>${t.code} ${y}</b> · ${esc(fmt.eur(c.amount))}<br>${esc(c.status)}${c.source ? ` · ${esc(c.source)}` : ''}${c.dupes ? `<br><span class="tip-miss">${c.dupes} doublon(s) dans Grist</span>` : ''}`)}">
                  <span class="${c.status === 'Prévision' ? 'is-forecast' : ''}">${esc(fmt.short(c.amount))}</span>${c.dupes ? `<span class="dupe-flag" aria-label="doublon">${icon('alert', 12)}</span>` : ''}</td>`;
              }).join('')}
              <td class="num">${d != null ? `<span class="delta ${d >= 0 ? 'up' : 'down'}">${esc(fmt.delta(d))}</span>` : '<span class="miss">—</span>'}</td>
              <td>${spark(ys.map(y => M.taxCell(t.code, y)?.amount ?? null), {slot: t.slot, w: 84})}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr><td>Total renseigné</td>${ys.map(y => { const tt = M.taxTotal(y); return `<td class="num${y === year ? ' year-col' : ''}">${tt.covered ? esc(fmt.short(tt.total)) : '—'}<span class="sub">${tt.covered}/6</span></td>`; }).join('')}<td></td><td></td></tr></tfoot>
      </table>
    </div>
    <div class="card-foot"><span class="legend"><span><span class="is-forecast">1,2 M€</span> prévision</span><span>${icon('alert', 12)} doublon dans Grist</span><span><span class="hatch"></span> non renseigné</span></span><span class="muted">Cliquez une ligne pour la fiche du produit</span></div>
  </article>

  ${prods.length ? `<article class="card mt">
    <div class="card-head"><div><h2>Prévision et réalisé ${year}</h2><p class="card-sub">Table Produits_Recettes</p></div></div>
    <div class="table-wrap mt"><table class="t">
      <thead><tr><th>Produit</th><th>Budget</th><th class="num">Prévision</th><th class="num">Réalisé</th><th class="num">Écart</th><th>Exécution</th><th>Source</th></tr></thead>
      <tbody>${prods.map(({t, p}) => {
        const pr = M.num(p.Prevision), re = M.num(p.Realise);
        const rate = pr ? (re || 0) / pr : null;
        return `<tr><td><span class="cell-name"><span class="sw" style="background:var(--s${t.slot})"></span><span class="strong">${esc(t.code)}</span></span></td><td>${esc(M.text(p.Budget))}</td>
          <td class="num">${esc(fmt.eur(pr))}</td><td class="num">${esc(fmt.eur(re))}</td><td class="num">${esc(fmt.eur(re != null && pr != null ? re - pr : null))}</td>
          <td style="min-width:140px"><div class="exec"><div class="bar"><span style="width:${Math.min(100, (rate || 0) * 100)}%"></span></div><span class="num">${esc(fmt.pct(rate))}</span></div></td><td class="muted">${esc(M.text(p.Source))}</td></tr>`;
      }).join('')}</tbody>
    </table></div>
  </article>` : ''}

  <section class="grid g-3 mt">
    ${M.TAXES.map(t => {
      const c = M.taxCell(t.code, year);
      return `<a class="card tax-card" href="#/recettes/${t.code}">
        <span class="tax-card-top"><span class="sw" style="background:var(--s${t.slot})"></span><b>${esc(t.code)}</b>${c ? badge(c.status, statusTone(c.status)) : badge('Non renseigné', 'neutral')}</span>
        <span class="tax-card-label">${esc(t.label)}</span>
        <span class="tax-card-val">${c?.amount != null ? esc(fmt.eur(c.amount)) : '<span class="miss">—</span>'}</span>
        ${spark(ys.map(y => M.taxCell(t.code, y)?.amount ?? null), {slot: t.slot, w: 240, h: 34})}
      </a>`;
    }).join('')}
  </section>
  ${prev.covered ? '' : ''}`;
}

function detail({year, params}, t) {
  const ys = [...new Set([...M.taxYears(), year])].sort((a, b) => a - b);
  const c = M.taxCell(t.code, year);
  const pv = M.taxCell(t.code, year - 1);
  const d = c?.amount != null && pv?.amount ? c.amount / pv.amount - 1 : null;
  const tab = params.get('tab') || 'historique';
  const extraTab = t.code === 'CFE' ? ['terrain', 'Suivi terrain'] : t.code === 'VM' ? ['employeurs', 'Employeurs'] : null;
  const allRows = rows('Taxes').filter(r => M.text(r.Code).toUpperCase() === t.code)
    .sort((a, b) => M.num(b.Exercice) - M.num(a.Exercice) || (M.num(b.Derniere_MAJ) || 0) - (M.num(a.Derniere_MAJ) || 0));
  const kept = new Set(ys.map(y => M.taxCell(t.code, y)?.rowId).filter(Boolean));

  return `
  <a class="crumb" href="#/recettes">${icon('left', 14)}Recettes fiscales</a>
  <section class="ph">
    <div>
      <p class="ph-eyebrow"><span class="sw" style="background:var(--s${t.slot})"></span>${esc(t.code)}</p>
      <h1>${esc(t.label)}</h1>
      <p class="ph-lede">${esc(t.about)}</p>
    </div>
    <div class="ph-actions">
      <button class="btn btn-primary" data-edit-tax="${t.code}" data-year="${year}">${icon('edit', 16)}${c ? `Modifier ${year}` : `Saisir ${year}`}</button>
    </div>
  </section>

  <section class="grid g-4">
    <div class="card kpi"><span class="kpi-label">Produit ${year}</span><span class="kpi-value">${c?.amount != null ? esc(fmt.short(c.amount)) : '—'}</span>
      <span class="kpi-meta">${c ? `${badge(c.status, statusTone(c.status))}` : badge('Non renseigné', 'neutral')}</span></div>
    <div class="card kpi"><span class="kpi-label">Évolution vs ${year - 1}</span><span class="kpi-value">${d != null ? `<span class="delta ${d >= 0 ? 'up' : 'down'}" style="font-weight:500">${esc(fmt.delta(d))}</span>` : '—'}</span>
      <span class="kpi-meta">${pv?.amount != null ? `${esc(fmt.eur(pv.amount))} en ${year - 1}` : `${year - 1} non renseigné`}</span></div>
    <div class="card kpi"><span class="kpi-label">Taux · base nette ${year}</span><span class="kpi-value" style="font-size:22px">${c?.taux != null && c?.taux !== '' ? esc(String(c.taux)) : '—'}</span>
      <span class="kpi-meta">${c?.base != null && c?.base !== '' ? `Base : ${esc(fmt.eur(M.num(c.base)))}` : 'Base nette non saisie'}</span></div>
    <div class="card kpi"><span class="kpi-label">Source ${year}</span><span class="kpi-value" style="font-size:18px;line-height:1.3">${esc(c?.source || '—')}</span>
      <span class="kpi-meta">${c?.updated ? `Mis à jour ${esc(fmt.date(c.updated))}` : ''}</span></div>
  </section>

  <div class="toolbar mt-l">
    <nav class="tabs" aria-label="Sections">
      <a href="#/recettes/${t.code}" ${tab === 'historique' ? 'aria-current="page"' : ''}>Historique</a>
      <a href="#/recettes/${t.code}?tab=lignes" ${tab === 'lignes' ? 'aria-current="page"' : ''}>Lignes Grist <span class="count">${allRows.length}</span></a>
      ${extraTab ? `<a href="#/recettes/${t.code}?tab=${extraTab[0]}" ${tab === extraTab[0] ? 'aria-current="page"' : ''}>${extraTab[1]}</a>` : ''}
    </nav>
  </div>

  ${tab === 'historique' ? `<article class="card"><div class="card-body">
      ${seriesBars(ys.map(y => { const x = M.taxCell(t.code, y); return {year: y, amount: x?.amount ?? null, status: x?.status, source: x?.source, label: true}; }), {slot: t.slot, active: year})}
      <div class="legend mt"><span><span class="sw" style="background:var(--s${t.slot})"></span>${esc(t.code)} définitif ou renseigné</span><span><span class="sw" style="background:var(--s${t.slot});opacity:.55"></span>prévision</span><span><span class="sw gap-sw"></span>non renseigné</span></div>
    </div></article>` : ''}

  ${tab === 'lignes' ? `<article class="card"><div class="table-wrap"><table class="t">
      <thead><tr><th>Exercice</th><th class="num">Produit</th><th>Statut</th><th>Source</th><th>Mise à jour</th><th></th></tr></thead>
      <tbody>${allRows.map(r => {
        const dup = !kept.has(r.id);
        return `<tr><td class="strong">${M.num(r.Exercice) ?? '—'}</td><td class="num">${esc(fmt.eur(M.num(r.Produit)))}</td><td>${badge(M.text(r.Statut) || '—', statusTone(M.text(r.Statut)))}${dup ? ` ${badge('Doublon ignoré', 'critical')}` : ''}</td>
          <td class="muted">${esc(M.text(r.Source))}</td><td class="muted">${esc(fmt.date(M.toDate(r.Derniere_MAJ)))}</td>
          <td class="num"><button class="btn btn-sm btn-ghost" data-edit-row="${r.id}">${icon('edit', 14)}Modifier</button>${dup ? `<button class="btn btn-sm btn-ghost" data-del-row="${r.id}">${icon('trash', 14)}Supprimer</button>` : ''}</td></tr>`;
      }).join('') || `<tr><td colspan="6">${empty('Aucune ligne pour ce produit')}</td></tr>`}</tbody>
    </table></div></article>` : ''}

  ${tab === 'terrain' ? terrain() : ''}
  ${tab === 'employeurs' ? employeurs() : ''}`;
}

function terrain() {
  const s = rows('CFE_Synthese')[0];
  const etabs = rows('Etablissements_CFE');
  if (!s && !etabs.length) return `<article class="card">${empty('Aucun suivi terrain', 'Importez les établissements dans la table Etablissements_CFE.')}</article>`;
  const v = k => M.num(s?.[k]) ?? 0;
  const total = M.num(s?.Nombre_Lignes) || etabs.length;
  const parts = [['Exploités', v('Exploites'), 'var(--good)'], ['Vacants', v('Vacants'), 'var(--warn)'], ['À revoir', v('A_Revoir'), 'var(--critical)']];
  return `<section class="grid g-main">
    <article class="card card-pad">
      <h2 class="card-title">Campagne de visites</h2><p class="card-sub">${esc(M.text(s?.Nom_Fichier))}${s?.Importe_Le ? ` · importé le ${esc(fmt.date(M.toDate(s.Importe_Le)))}` : ''}</p>
      <div class="grid g-4 mt">
        <div><p class="kpi-label">Locaux suivis</p><p class="kpi-value">${total}</p></div>
        <div><p class="kpi-label">Visités</p><p class="kpi-value">${v('Visites')}</p><p class="kpi-meta">${esc(fmt.pct(total ? v('Visites') / total : null))}</p></div>
        ${parts.slice(0, 2).map(([l, n]) => `<div><p class="kpi-label">${l}</p><p class="kpi-value">${n}</p></div>`).join('')}
      </div>
      <p class="kpi-label mt">Résultat des visites</p>
      <div class="stackbar mt">${parts.filter(p => p[1]).map(([l, n, c]) => `<span style="flex:${n};background:${c}" data-tip="${attr(`<b>${l}</b> · ${n}`)}"></span>`).join('')}</div>
      <div class="legend mt">${parts.map(([l, n, c]) => `<span><span class="sw" style="background:${c}"></span>${l} · ${n}</span>`).join('')}</div>
    </article>
    <article class="card card-pad"><h2 class="card-title">Établissements</h2>
      <p class="card-sub">${etabs.length ? `${etabs.length} ligne(s) dans Etablissements_CFE` : 'La table Etablissements_CFE est vide : seule la synthèse de l’ancien outil est disponible.'}</p></article>
  </section>`;
}

function employeurs() {
  const list = rows('Employeurs_VM');
  if (!list.length) return `<article class="card">${empty('Aucun employeur suivi', 'La table Employeurs_VM est vide.')}</article>`;
  return `<article class="card"><div class="table-wrap"><table class="t">
    <thead><tr><th>Employeur</th><th>Exercice</th><th class="num">Taux</th><th class="num">Dû</th><th class="num">Encaissé</th><th>Statut</th><th>Anomalie</th><th>Suivi</th></tr></thead>
    <tbody>${list.map(r => `<tr><td><span class="strong">${esc(M.text(r.Raison_Sociale))}</span><span class="sub">${esc(M.text(r.SIRET) || M.text(r.SIREN))}</span></td>
      <td>${M.num(r.Exercice) ?? '—'}</td><td class="num">${M.num(r.Taux_VM) != null ? esc(fmt.pct(M.num(r.Taux_VM), 2)) : '—'}</td>
      <td class="num">${esc(fmt.eur(M.num(r.Montant_Du)))}</td><td class="num">${esc(fmt.eur(M.num(r.Montant_Encaisse)))}</td>
      <td>${badge(M.text(r.Statut) || '—', /anomal/i.test(M.text(r.Statut)) ? 'critical' : 'neutral')}</td><td>${esc(M.text(r.Anomalie))}</td><td>${esc(M.text(r.Responsable))}</td></tr>`).join('')}</tbody>
  </table></div></article>`;
}

/* ── Saisie ─────────────────────────────────────────────────────────── */
function editTax({code = '', year, rowId = null}) {
  const row = rowId ? rows('Taxes').find(r => r.id === rowId) : null;
  if (row) { code = M.text(row.Code).toUpperCase(); year = M.num(row.Exercice); }
  const cell = !row && code ? M.taxCell(code, year) : null;
  const src = row || (cell?.rowId ? rows('Taxes').find(r => r.id === cell.rowId) : null);
  const ys = [...new Set([...M.years(), year, new Date().getFullYear() + 1])].sort((a, b) => b - a);
  const body = `<form class="form-grid" id="tax-form">
    ${field('Produit fiscal', select('code', M.TAXES.map(t => [t.code, `${t.code} · ${t.label}`]), code || 'VM', src ? 'disabled' : ''))}
    ${field('Exercice', select('year', ys, year, src ? 'disabled' : ''))}
    ${field('Montant du produit (€)', `<input name="amount" inputmode="decimal" value="${attr(src ? (M.num(src.Produit) ?? '') : '')}" placeholder="ex. 2 269 252" autofocus>`)}
    ${field('Statut', select('status', STATUS, src ? M.text(src.Statut) || 'Prévision' : 'Prévision'))}
    ${field('Taux', `<input name="taux" value="${attr(src?.Taux ?? '')}" placeholder="ex. 32,5 %">`)}
    ${field('Base nette (€)', `<input name="base" inputmode="decimal" value="${attr(src?.Base_Nette ?? '')}">`)}
    <div class="span-2">${field('Source', `<input name="source" value="${attr(src ? M.text(src.Source) : '')}" placeholder="ex. État 1259, notification DGFiP…">`)}</div>
  </form>`;
  openDrawer({
    title: src ? `${code} ${year}` : 'Saisir un produit fiscal',
    subtitle: src ? 'Modification de la ligne existante dans la table Taxes' : 'Une ligne sera ajoutée à la table Taxes, ou mise à jour si elle existe déjà',
    body,
    footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-save>${icon('check', 16)}Enregistrer</button>`,
    onMount(el) {
      el.querySelector('[data-save]').addEventListener('click', async e => {
        const f = formData(el.querySelector('#tax-form'));
        const c = src ? code : f.code, y = src ? year : Number(f.year);
        const amount = M.num(f.amount);
        if (amount === null) { toast('Indiquez un montant valide', 'error'); return; }
        const existing = src || (M.taxCell(c, y)?.rowId ? rows('Taxes').find(r => r.id === M.taxCell(c, y).rowId) : null);
        const label = M.text(rows('Taxes').find(r => M.text(r.Code).toUpperCase() === c)?.Intitule) || M.taxByCode(c).label;
        const fields = fieldsFor('Taxes', {
          Code: c, Exercice: y, Intitule: existing ? undefined : label, Produit: amount, Statut: f.status, Source: f.source,
          Taux: f.taux || null, Base_Nette: M.num(f.base) ?? (f.base || null), Derniere_MAJ: M.nowSeconds(), Responsable: existing ? undefined : author(),
          Taxe_ID: existing ? undefined : `PORTAL-${c}-${y}`,
        });
        e.currentTarget.disabled = true;
        try {
          await act([existing ? ['UpdateRecord', 'Taxes', existing.id, fields] : ['AddRecord', 'Taxes', null, fields]]);
          closeDrawer();
          toast(`${c} ${y} enregistré dans Grist`);
        } catch (err) { toast(err.message, 'error'); e.currentTarget.disabled = false; }
      });
    },
  });
}

export function mount(root, {year, sub}) {
  root.addEventListener('click', async e => {
    const tr = e.target.closest('tr[data-href]');
    if (tr && !e.target.closest('button, a')) { location.hash = tr.dataset.href; return; }
    const ed = e.target.closest('[data-edit-tax]');
    if (ed) { editTax({code: ed.dataset.editTax || (sub || '').toUpperCase(), year: Number(ed.dataset.year) || year}); return; }
    const er = e.target.closest('[data-edit-row]');
    if (er) { editTax({rowId: Number(er.dataset.editRow), year}); return; }
    const del = e.target.closest('[data-del-row]');
    if (del) {
      const id = Number(del.dataset.delRow);
      const r = rows('Taxes').find(x => x.id === id);
      const ok = await confirmDialog({title: 'Supprimer ce doublon ?', message: `La ligne ${M.text(r?.Code)} ${M.num(r?.Exercice)} (${fmt.eur(M.num(r?.Produit))}) sera supprimée de la table Taxes. La ligne la plus récente reste en place. Grist garde l’historique et permet d’annuler.`, confirm: 'Supprimer', danger: true});
      if (!ok) return;
      try { await act([['RemoveRecord', 'Taxes', id]]); toast('Doublon supprimé'); } catch (err) { toast(err.message, 'error'); }
      return;
    }
    if (e.target.closest('[data-export]')) {
      const ys = M.taxYears();
      downloadCsv(`recettes-fiscales-cadema.csv`, ['Code', 'Produit', ...ys.map(String)],
        M.TAXES.map(t => [t.code, t.label, ...ys.map(y => M.taxCell(t.code, y)?.amount ?? '')]));
    }
  });
}
