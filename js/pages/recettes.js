import * as M from '../model.js';
import { rows, act, fieldsFor } from '../grist.js';
import { esc, attr, icon, fmt, badge, empty, openDrawer, closeDrawer, toast, field, select, formData, confirmDialog, downloadCsv, flash, motionOK } from '../ui.js';
import { statusBars, deltaBars, spark, mountChart } from '../charts.js';
import { author, render as rerender } from '../main.js';

const STATUS = ['Définitif', 'Notifié', 'Renseigné', 'Prévision'];
const statusTone = s => ({'Définitif': 'good', 'Notifié': 'good', 'Renseigné': 'info', 'Prévision': 'warn'}[s] || 'neutral');
const dc = v => v > 0 ? 'up' : v < 0 ? 'down' : '';
const filled = v => v !== null && v !== undefined && v !== '';
/* Taux : la colonne est libre dans Grist (0,325 — 32,5 — « 32,5 % »). */
function fmtTaux(v) {
  if (!filled(v)) return '—';
  const n = typeof v === 'number' ? v : M.num(String(v).replace('%', ''));
  if (n === null) return String(v);
  if (typeof v === 'string' && v.includes('%')) return v;
  return n <= 1 ? fmt.pct(n, 2) : `${n.toLocaleString('fr-FR', {maximumFractionDigits: 2})} %`;
}

export function render(ctx) {
  const code = String(ctx.sub || '').toUpperCase();
  return M.taxByCode(code) ? detail(ctx, M.taxByCode(code)) : overview(ctx);
}

/* ── Vue d'ensemble ─────────────────────────────────────────────────── */
function overview({year}) {
  const ys = [...new Set([...M.taxYears(), year])].sort((a, b) => a - b);
  const tot = M.taxTotal(year);
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
      <button class="btn btn-primary" data-edit-tax="" data-year="${year}">${icon('plus', 16)}Saisir un produit</button>
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
              <td class="num">${d != null ? `<span class="delta ${dc(d)}">${esc(fmt.delta(d))}</span>` : '<span class="miss">—</span>'}</td>
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
    <div class="card-head"><div><p class="card-eyebrow">Budget</p><h2>Prévision et réalisé ${year}</h2></div></div>
    <div class="table-wrap mt"><table class="t">
      <thead><tr><th>Produit</th><th>Budget</th><th class="num">Prévision</th><th class="num">Réalisé</th><th class="num">Écart</th><th>Exécution</th><th>Source</th></tr></thead>
      <tbody>${prods.map(({t, p}) => {
        const pr = M.num(p.Prevision), re = M.num(p.Realise);
        const rate = pr ? (re || 0) / pr : null;
        return `<tr data-href="#/recettes/${t.code}"><td><span class="cell-name"><span class="sw" style="background:var(--s${t.slot})"></span><span class="strong">${esc(t.code)}</span></span></td><td>${esc(M.text(p.Budget))}</td>
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
  </section>`;
}

/* ── Fiche d'une recette ────────────────────────────────────────────── */
const selYear = (params, year) => Number(params.get('an')) || year;

function detail({year, params}, t) {
  const sel = selYear(params, year);
  const hist = M.taxHistory(t.code, sel);
  const cur = hist.find(h => h.year === sel);
  const c = cur?.cell;
  const known = hist.filter(h => h.amount !== null);
  const cagr = M.taxCagr(t.code);
  const total = M.taxTotal(sel);
  const share = c?.amount != null && total.total ? c.amount / total.total : null;
  const lastUpdate = hist.map(h => h.cell?.updated).filter(Boolean).sort((a, b) => b - a)[0];
  const allRows = rows('Taxes').filter(r => M.text(r.Code).toUpperCase() === t.code);
  const kept = new Set(hist.map(h => h.cell?.rowId).filter(Boolean));
  const tauxList = hist.filter(h => filled(h.cell?.taux));
  const baseList = hist.filter(h => filled(h.cell?.base));
  const prods = rows('Produits_Recettes').filter(r => M.text(r.Code_Produit).toUpperCase() === t.code).sort((a, b) => M.num(b.Exercice) - M.num(a.Exercice));
  const prodMax = Math.max(1, ...prods.map(p => Math.max(M.num(p.Prevision) || 0, M.num(p.Realise) || 0)));

  const tableRows = [...hist].reverse().flatMap(h => {
    const list = allRows.filter(r => M.num(r.Exercice) === h.year)
      .sort((a, b) => (kept.has(b.id) - kept.has(a.id)) || (M.num(b.Derniere_MAJ) || 0) - (M.num(a.Derniere_MAJ) || 0));
    if (!list.length) {
      if (!h.cell) return [];
      return [`<tr class="${h.year === sel ? 'is-sel' : ''}"><td class="strong">${h.year}</td><td>${badge(h.cell.status, statusTone(h.cell.status))}</td><td class="num">${esc(fmt.eur(h.amount))}</td>
        <td class="num">${h.delta != null ? `<span class="delta ${dc(h.delta)}">${esc(fmt.delta(h.delta))}</span>` : '—'}</td><td class="num">—</td><td class="num">—</td><td class="muted">${esc(h.cell.source)} · Produits_Recettes</td><td></td></tr>`];
    }
    return list.map(r => {
      const keep = kept.has(r.id);
      return `<tr data-row="${r.id}" class="${keep && h.year === sel ? 'is-sel' : ''}${keep ? '' : ' is-dupe'}">
        <td><span class="strong">${h.year}</span>${keep ? '' : ' <span class="sub-inline">non retenue</span>'}</td>
        <td>${badge(M.text(r.Statut) || '—', statusTone(M.text(r.Statut)))}</td>
        <td class="num">${esc(fmt.eur(M.num(r.Produit)))}</td>
        <td class="num">${keep && h.delta != null ? `<span class="delta ${dc(h.delta)}">${esc(fmt.delta(h.delta))}</span>` : '—'}</td>
        <td class="num">${esc(fmtTaux(r.Taux))}</td>
        <td class="num">${filled(r.Base_Nette) ? esc(fmt.eur(M.num(r.Base_Nette))) : '—'}</td>
        <td class="muted src">${esc(M.text(r.Source))}</td>
        <td class="num row-actions"><button class="icon-btn" data-edit-row="${r.id}" aria-label="Modifier ${h.year}" data-tip="Modifier">${icon('edit', 15)}</button>${keep ? '' : `<button class="icon-btn" data-del-row="${r.id}" aria-label="Supprimer le doublon ${h.year}" data-tip="Supprimer ce doublon">${icon('trash', 15)}</button>`}</td>
      </tr>`;
    });
  });

  const emptyFisc = (what, col) => `<div class="hollow"><b>${what} non renseigné${what === 'Base nette' ? 'e' : ''}</b>
    <p>Saisissez-${what === 'Base nette' ? 'la' : 'le'} depuis « Modifier ${sel} » : la valeur est écrite dans la table Taxes, colonne <code>${col}</code>, et son évolution s’affichera ici, exercice par exercice.</p>
    <button class="btn btn-sm" data-edit-tax="${t.code}" data-year="${sel}">${icon('edit', 14)}Saisir pour ${sel}</button></div>`;
  const fiscList = (list, f) => `<div class="fisc-now"><span class="kpi-value">${f(list.find(h => h.year === sel) || null)}</span><span class="kpi-meta">${list.some(h => h.year === sel) ? `en ${sel}` : `${sel} non renseigné`}</span></div>
    <div class="fisc-hist">${[...list].reverse().map(h => `<div class="${h.year === sel ? 'on' : ''}"><span>${h.year}</span><b class="num">${f(h)}</b></div>`).join('')}</div>`;

  return `
  <a class="crumb" href="#/recettes">${icon('left', 14)}Recettes fiscales</a>
  <section class="ph">
    <div>
      <p class="ph-eyebrow"><span class="sw" style="background:var(--s${t.slot})"></span>Recette fiscale · ${esc(t.code)}</p>
      <h1>${esc(t.label)}</h1>
      <p class="ph-lede">${known.length} exercice(s) renseigné(s)${lastUpdate ? ` · mise à jour le ${esc(lastUpdate.toLocaleDateString('fr-FR'))}` : ''}. ${esc(t.about)}</p>
    </div>
    <div class="ph-actions">
      <button class="btn btn-primary" data-edit-tax="${t.code}" data-year="${sel}">${icon('edit', 16)}${c?.rowId ? `Modifier ${sel}` : `Saisir ${sel}`}</button>
    </div>
  </section>

  <div class="year-chips" role="group" aria-label="Exercice affiché">
    ${hist.map(h => `<button class="chip chip-year${h.amount === null ? ' is-empty' : ''}" aria-pressed="${h.year === sel}" data-pick="${h.year}">${h.year}</button>`).join('')}
  </div>

  <section class="grid g-4 tax-kpis" style="--kc:var(--s${t.slot})">
    <div class="card kpi kpi-lead"><span class="kpi-label">Produit ${sel}</span><span class="kpi-value">${c?.amount != null ? esc(fmt.eur(c.amount)) : '—'}</span>
      <span class="kpi-meta">${c ? badge(c.status, statusTone(c.status)) : badge('Non renseigné', 'neutral')}${c?.dupes ? badge(`${c.dupes} doublon(s)`, 'critical') : ''}</span>
      <span class="kpi-meta muted">${esc(c?.source || 'Aucune source')}</span></div>
    <div class="card kpi"><span class="kpi-label">Évolution sur un an</span><span class="kpi-value">${cur?.delta != null ? `<span class="delta ${dc(cur.delta)}">${esc(fmt.delta(cur.delta))}</span>` : '—'}</span>
      <span class="kpi-meta">${cur?.delta != null ? `${esc(fmt.eur(M.taxCell(t.code, sel - 1).amount))} en ${sel - 1}` : c?.amount != null ? `${sel - 1} non renseigné` : `${sel} non renseigné`}</span></div>
    <div class="card kpi"><span class="kpi-label">Croissance annuelle moyenne</span><span class="kpi-value">${cagr ? `<span class="delta ${dc(cagr.rate)}">${esc(fmt.delta(cagr.rate))}</span>` : '—'}</span>
      <span class="kpi-meta">${cagr ? `de ${cagr.from} à ${cagr.to}, en moyenne chaque année` : 'Il faut au moins deux exercices renseignés'}</span></div>
    <div class="card kpi"><span class="kpi-label">Part des recettes ${sel}</span><span class="kpi-value">${share != null ? esc(fmt.pct(share, 1)) : '—'}</span>
      <div class="bar"><span style="width:${Math.round((share || 0) * 100)}%;background:var(--kc)"></span></div>
      <span class="kpi-meta">sur ${esc(fmt.eur(total.total))}${total.covered < 6 ? ` · ${total.covered}/6 produits` : ''}</span></div>
  </section>

  <section class="grid g-main mt">
    <article class="card">
      <div class="card-head"><div><p class="card-eyebrow">Progression</p><h2>Produit par exercice</h2></div>
        <div class="legend status-legend" style="--c:var(--s${t.slot})"><span><i class="lg lg-final"></i>Définitif</span><span><i class="lg lg-filled"></i>Renseigné</span><span><i class="lg lg-forecast"></i>Prévision</span><span><i class="lg lg-gap"></i>Non renseigné</span></div></div>
      <div class="card-body"><div class="chart-slot" data-chart="prog"></div></div>
    </article>
    <article class="card">
      <div class="card-head"><div><p class="card-eyebrow">Dynamique</p><h2>Évolution d’un exercice à l’autre</h2></div></div>
      <div class="card-body"><div class="chart-slot" data-chart="dyn"></div></div>
    </article>
  </section>

  <section class="grid g-2 mt">
    <article class="card card-pad"><p class="card-eyebrow">Fiscalité</p><h2 class="card-title">Taux</h2>
      <div class="fisc">${tauxList.length ? fiscList(tauxList, h => h ? esc(fmtTaux(h.cell.taux)) : '—') : emptyFisc('Taux', 'Taux')}</div></article>
    <article class="card card-pad"><p class="card-eyebrow">Fiscalité</p><h2 class="card-title">Base nette</h2>
      <div class="fisc">${baseList.length ? fiscList(baseList, h => h ? esc(fmt.eur(M.num(h.cell.base))) : '—') : emptyFisc('Base nette', 'Base_Nette')}</div></article>
  </section>

  <article class="card mt" style="--kc:var(--s${t.slot})">
    <div class="card-head"><div><p class="card-eyebrow">Budget</p><h2>Exécution : prévu et réalisé</h2></div></div>
    <div class="card-body">
      ${prods.length ? prods.map(p => {
        const pr = M.num(p.Prevision), re = M.num(p.Realise);
        const rate = pr ? (re || 0) / pr : null;
        return `<div class="execline${M.num(p.Exercice) === sel ? ' on' : ''}">
          <div class="execline-year"><b>${M.num(p.Exercice)}</b><span>${esc(M.text(p.Budget))}</span></div>
          <div class="execline-bars">
            <div><span class="execline-l">Prévu</span><span class="exec-bar"><span style="width:${(pr || 0) / prodMax * 100}%;background:var(--kc);opacity:.45"></span></span><span class="num">${esc(fmt.eur(pr))}</span></div>
            <div><span class="execline-l">Réalisé</span><span class="exec-bar"><span style="width:${(re || 0) / prodMax * 100}%;background:var(--kc)"></span></span><span class="num">${esc(fmt.eur(re))}</span></div>
          </div>
          <div class="execline-rate"><b class="${rate != null && rate >= 1 ? 'up' : ''}">${esc(fmt.pct(rate, 1))}</b><span>taux de réalisation</span></div>
        </div>`;
      }).join('') : `<div class="hollow"><b>Aucune ligne budgétaire</b><p>La table Produits_Recettes ne contient pas ${esc(t.code)}. Le prévu et le réalisé s’afficheront ici dès qu’une ligne existe.</p></div>`}
    </div>
  </article>

  <article class="card mt" style="--kc:var(--s${t.slot})">
    <div class="card-head"><div><p class="card-eyebrow">Traçabilité</p><h2>Historique détaillé</h2></div><span class="muted">${allRows.length} ligne(s) dans Taxes</span></div>
    <div class="table-wrap mt"><table class="t hist">
      <thead><tr><th>Exercice</th><th>Statut</th><th class="num">Produit</th><th class="num">Évolution</th><th class="num">Taux</th><th class="num">Base nette</th><th>Source</th><th></th></tr></thead>
      <tbody>${tableRows.join('') || `<tr><td colspan="8">${empty('Aucune ligne pour ce produit', 'Utilisez « Saisir » pour créer la première.')}</td></tr>`}</tbody>
    </table></div>
    <div class="card-foot"><span class="muted">Quand un exercice a plusieurs lignes, la plus avancée est retenue : définitif, puis renseigné, puis prévision ; à égalité, la plus récente.</span></div>
  </article>

  ${t.code === 'CFE' ? `<div id="terrain" class="mt-l"><p class="section-title">Suivi terrain</p>${terrain()}</div>` : ''}
  ${t.code === 'VM' ? `<div id="employeurs" class="mt-l"><p class="section-title">Employeurs</p>${employeurs()}</div>` : ''}`;
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
      <p class="card-eyebrow">Campagne de visites</p><h2 class="card-title">${esc(M.text(s?.Nom_Fichier) || 'Synthèse')}</h2>
      <p class="card-sub">${s?.Importe_Le ? `Importé le ${esc(fmt.date(M.toDate(s.Importe_Le)))}` : ''}</p>
      <div class="grid g-4 mt">
        <div><p class="kpi-label">Locaux suivis</p><p class="kpi-value">${total}</p></div>
        <div><p class="kpi-label">Visités</p><p class="kpi-value">${v('Visites')}</p><p class="kpi-meta">${esc(fmt.pct(total ? v('Visites') / total : null))}</p></div>
        ${parts.slice(0, 2).map(([l, n]) => `<div><p class="kpi-label">${l}</p><p class="kpi-value">${n}</p></div>`).join('')}
      </div>
      <p class="kpi-label mt">Résultat des visites</p>
      <div class="stackbar mt">${parts.filter(p => p[1]).map(([l, n, c]) => `<span style="flex:${n};background:${c}" data-tip="${attr(`<b>${l}</b> · ${n}`)}"></span>`).join('')}</div>
      <div class="legend mt">${parts.map(([l, n, c]) => `<span><span class="sw" style="background:${c}"></span>${l} · ${n}</span>`).join('')}</div>
    </article>
    <article class="card card-pad"><p class="card-eyebrow">Référentiel</p><h2 class="card-title">Établissements</h2>
      <p class="card-sub" style="margin-top:6px">${etabs.length ? `${etabs.length} ligne(s) dans Etablissements_CFE` : 'La table Etablissements_CFE est vide : seule la synthèse de l’ancien outil est disponible.'}</p></article>
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
        const btn = e.currentTarget;
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
        btn.disabled = true;
        try {
          const ret = await act([existing ? ['UpdateRecord', 'Taxes', existing.id, fields] : ['AddRecord', 'Taxes', null, fields]]);
          closeDrawer();
          toast(`${c} ${y} enregistré dans Grist`);
          flash(document.querySelector(`tr[data-row="${existing ? existing.id : ret[0]}"]`));
        } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
      });
    },
  });
}

/* Change l'exercice affiché dans la fiche sans toucher à l'exercice global. */
function pick(code, y) {
  history.replaceState(null, '', `#/recettes/${code}?an=${y}`);
  rerender({keepScroll: true});
  if (!motionOK()) return;
  document.querySelectorAll('.tax-kpis > *').forEach((el, i) => el.animate(
    [{opacity: 0, transform: 'translateY(5px)'}, {opacity: 1, transform: 'none'}],
    {duration: 220, delay: i * 30, easing: 'cubic-bezier(.23, 1, .32, 1)', fill: 'backwards'}));
}

export function mount(root, {year, sub, params}) {
  const code = String(sub || '').toUpperCase();
  const t = M.taxByCode(code);
  if (t) {
    const sel = selYear(params, year);
    const hist = M.taxHistory(code, sel);
    mountChart(root.querySelector('[data-chart="prog"]'), w => statusBars(
      hist.map(h => ({year: h.year, amount: h.amount, status: h.cell?.status, source: h.cell?.source})), {slot: t.slot, width: w, active: sel}));
    mountChart(root.querySelector('[data-chart="dyn"]'), w => deltaBars(
      hist.slice(1).map(h => ({year: h.year, delta: h.delta})), {width: w, height: 280, active: sel}));
    const target = params.get('tab');
    if (target && !document.body.classList.contains('no-enter')) root.querySelector(`#${CSS.escape(target)}`)?.scrollIntoView({block: 'start'});
  }
  root.addEventListener('click', async e => {
    const pk = e.target.closest('[data-pick]');
    if (pk && t) { pick(code, Number(pk.dataset.pick)); return; }
    const tr = e.target.closest('tr[data-href]');
    if (tr && !e.target.closest('button, a')) { location.hash = tr.dataset.href; return; }
    const ed = e.target.closest('[data-edit-tax]');
    if (ed) { editTax({code: ed.dataset.editTax || code, year: Number(ed.dataset.year) || year}); return; }
    const er = e.target.closest('[data-edit-row]');
    if (er) { editTax({rowId: Number(er.dataset.editRow), year}); return; }
    const del = e.target.closest('[data-del-row]');
    if (del) {
      const id = Number(del.dataset.delRow);
      const r = rows('Taxes').find(x => x.id === id);
      const ok = await confirmDialog({title: 'Supprimer ce doublon ?', message: `La ligne ${M.text(r?.Code)} ${M.num(r?.Exercice)} (${fmt.eur(M.num(r?.Produit))}), non retenue, sera supprimée de la table Taxes. La ligne retenue reste en place. Grist garde l’historique et permet d’annuler.`, confirm: 'Supprimer', danger: true});
      if (!ok) return;
      try { await act([['RemoveRecord', 'Taxes', id]]); toast('Doublon supprimé'); } catch (err) { toast(err.message, 'error'); }
      return;
    }
    if (e.target.closest('[data-export]')) {
      const ys = M.taxYears();
      downloadCsv('recettes-fiscales-cadema.csv', ['Code', 'Produit', ...ys.map(String)],
        M.TAXES.map(x => [x.code, x.label, ...ys.map(y => M.taxCell(x.code, y)?.amount ?? '')]));
    }
  });
}
