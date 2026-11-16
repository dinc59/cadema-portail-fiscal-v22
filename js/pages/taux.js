/* Taux votés (#/taux) : taux en vigueur depuis la création de la CADEMA,
   évolutions proposées pour 2027 et produit GEMAPI. Un clic sur un taux
   ouvre sa fiche : historique, source, délibération en PDF.
   Un taux « proposé » le reste tant que le taux voté n'est pas saisi
   dans la table Taxes pour l'exercice. */
import * as M from '../model.js';
import { act, fieldsFor, rows, uploadAttachment, openAttachment, attachmentIds } from '../grist.js';
import { esc, attr, icon, fmt, badge, openDrawer, closeDrawer, toast } from '../ui.js';
import { author } from '../main.js';

const pct = r => r === null || r === undefined ? '—' : `${r.toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} %`;
const RATE_COLOR = {TFPB: 'var(--info)', TFPNB: 'var(--warn)', THRS: 'var(--serious)'};
const color = code => RATE_COLOR[code] || `var(--s${M.taxByCode(code)?.slot || 1})`;
const span = p => p.from === p.to ? `${p.from}` : `${p.from}–${p.to}`;
const CURRENT = ['CFE', 'TEOM', 'VM'];
const PROPOSAL_ROWS = ['TEOM', 'TFPB', 'TFPNB', 'THRS', 'GEMAPI', 'CFE'];

function summary(code, current, horizon) {
  const hist = M.rateHistory(code, horizon);
  const cur = hist.find(p => p.from <= current && p.to >= current) || hist[hist.length - 1];
  const next = hist.find(p => p.from > current && p.proposed) || null;
  const known = hist.filter(p => p.rate !== null && p.to <= current);
  const gap = hist.find(p => p.rate === null && !p.absent && p.from <= current);
  return {hist, cur, next, changes: known.length - 1, gap, instituted: known[0]?.from ?? null, since: cur.rate !== null ? cur.from : null};
}

function rateCard(code, current, horizon) {
  const r = summary(code, current, horizon);
  const ceil = M.RATE_CEILING[code];
  return `<article class="card rate-card" data-rate="${code}" role="button" tabindex="0" aria-label="Fiche du taux ${attr(code)}">
    <span class="rate-top"><span class="sw" style="background:${color(code)}"></span><b>${esc(code)}</b>
      ${r.next ? badge(`Hausse proposée ${r.next.from}`, 'warn') : r.cur.rate === null ? badge('À compléter', 'warn') : r.changes === 0 && !r.gap ? badge('Inchangé', 'good') : badge(`${r.changes + 1} taux successifs`, 'info')}</span>
    <span class="rate-value">${esc(pct(r.cur.rate))}</span>
    <span class="rate-label">${esc(M.RATE_INFO[code].label)}</span>
    <span class="rate-meta">${r.since ? `En vigueur depuis ${r.cur.effect ? esc(r.cur.effect) : r.since}` : 'Taux en vigueur non renseigné'}${r.changes > 0 && r.instituted ? ` · institué en ${r.instituted}` : ''}</span>
    ${r.next ? `<span class="rate-next">${icon('right', 14)}<b>${esc(pct(r.next.rate))}</b> proposé pour ${r.next.from} · vote du ${esc(M.PROPOSAL.vote)}</span>` : ''}
    ${ceil ? `<span class="rate-meta">Plafond ${esc(pct(ceil.rate))} : ${esc(ceil.note)}</span>` : ''}
    <span class="rate-open">Historique et délibération ${icon('right', 14)}</span>
  </article>`;
}

function proposalCard(current) {
  const y = M.PROPOSAL.year;
  const total = Object.values(M.PROPOSAL_GAINS).reduce((s, v) => s + v, 0);
  const g = M.gemapiProduct(current);
  const row = code => {
    if (code === 'GEMAPI') return `<tr data-href="#gemapi"><td><span class="cell-name"><span class="sw" style="background:var(--accent)"></span><span><span class="strong">GEMAPI</span><span class="sub">Produit voté, pas de taux</span></span></span></td>
      <td class="num">${esc(fmt.eur(g?.amount ?? null))}</td><td class="num">Reconduction</td><td class="num muted">0 €</td><td>${badge('Hypothèse', 'neutral')}</td></tr>`;
    const now = M.rateFor(code, current), nxt = M.rateFor(code, y);
    const changed = nxt && nxt.rate !== (now?.rate ?? null);
    const gain = M.PROPOSAL_GAINS[code] || 0;
    return `<tr data-rate="${code}"><td><span class="cell-name"><span class="sw" style="background:${color(code)}"></span><span><span class="strong">${esc(code)}${M.RATE_INFO[code].additional ? ' additionnelle' : ''}</span><span class="sub">${esc(M.RATE_INFO[code].label)}</span></span></span></td>
      <td class="num">${now?.rate == null ? '0 %' : esc(pct(now.rate))}</td>
      <td class="num"><b>${esc(pct(nxt?.rate ?? now?.rate))}</b></td>
      <td class="num">${gain ? `<span class="delta up">+ ${esc(fmt.eur(gain))}</span>` : '<span class="muted">0 €</span>'}</td>
      <td>${!changed ? badge('Inchangé', 'neutral') : nxt.proposed ? badge('Proposé', 'warn') : badge('Voté', 'good')}</td></tr>`;
  };
  return `<article class="card mt" id="propositions">
    <div class="card-head"><div><p class="card-eyebrow">Pacte financier et fiscal</p><h2>Évolutions proposées pour ${y}</h2>
      <p class="card-sub">Soumises au conseil communautaire du ${esc(M.PROPOSAL.vote)} : ce sont des propositions tant que le vote n’a pas eu lieu.</p></div>
      ${badge(`+ ${fmt.short(total)} attendus`, 'good')}</div>
    <div class="table-wrap"><table class="t">
      <thead><tr><th>Mesure</th><th class="num">${current}</th><th class="num">${y} proposé</th><th class="num">Recette nouvelle</th><th>État</th></tr></thead>
      <tbody>${PROPOSAL_ROWS.map(row).join('')}</tbody>
      <tfoot><tr><td>Total</td><td></td><td></td><td class="num">+ ${esc(fmt.eur(total))}</td><td></td></tr></tfoot>
    </table></div>
    <div class="card-foot"><span class="muted">Estimations à base constante (bases prévisionnelles ${current}), sous réserve du vote et des bases définitives de l’état 1259 de ${y}. Source : ${esc(M.PROPOSAL.source)}.</span></div>
  </article>`;
}

function gemapiCard(current) {
  const hist = M.gemapiHistory(current);
  const cur = M.gemapiProduct(current);
  const prev24 = M.gemapiProduct(2024);
  const max = Math.max(M.GEMAPI.ceiling, ...hist.map(h => h.amount || 0));
  const hy = M.GEMAPI.hypothesis;
  const voted = M.gemapiProduct(hy.year);
  const used = cur ? cur.amount / M.GEMAPI.ceiling : 0;
  const drop = cur && prev24 ? cur.amount - prev24.amount : null;
  return `<article class="card mt" id="gemapi">
    <div class="card-head"><div><p class="card-eyebrow">Taxe GEMAPI</p><h2>${cur ? `${esc(fmt.eur(cur.amount))} votés pour ${current}` : 'Produit non renseigné'}</h2>
      <p class="card-sub">Gestion des milieux aquatiques et prévention des inondations. Pas de taux : le conseil arrête chaque année un produit, avant le 15 avril (art. 1530 bis et 1639 A du CGI).</p></div>
      ${badge('Reconduit · aucune hausse programmée', 'neutral')}</div>
    <div class="card-body">
      <div class="gemapi-kpis">
        <div><span>Par habitant</span><b>${esc(M.GEMAPI.perHabitant.toLocaleString('fr-FR', {minimumFractionDigits: 2}))} €</b><em>plafond légal ${M.GEMAPI.ceilingPerHabitant} €</em></div>
        <div><span>Plafond légal</span><b>${esc(fmt.eur(M.GEMAPI.ceiling))}</b><em>${esc(fmt.pct(used))} utilisé</em></div>
        <div><span>Marge restante</span><b>${esc(fmt.eur(cur ? M.GEMAPI.ceiling - cur.amount : null))}</b><em>sous le plafond</em></div>
      </div>
      <div class="gemapi-cap" aria-hidden="true"><span style="width:${(used * 100).toFixed(1)}%"></span></div>
      <p class="menu-label" style="padding:18px 0 8px">Produit voté par exercice</p>
      <div class="gemapi-bars">${hist.map(h => `<div class="gb${h.year === current ? ' on' : ''}"><em>${esc(fmt.short(h.amount))}</em><span style="height:${h.amount ? (h.amount / max * 100).toFixed(1) : 0}%"></span><b>${h.year}</b></div>`).join('')}
        <div class="gb is-next"><em>${voted ? esc(fmt.short(voted.amount)) : 'à arrêter'}</em><span style="height:${((voted?.amount ?? hy.amount) / max * 100).toFixed(1)}%"></span><b>${hy.year}</b></div></div>
      <p class="muted gemapi-note">${hy.year} : ${voted ? `produit saisi (${esc(fmt.eur(voted.amount))})` : `hypothèse « ${esc(hy.label.toLowerCase())} » (${esc(fmt.eur(hy.amount))}). ${esc(hy.note)}`}</p>
      ${drop ? `<div class="notice notice-warn mt">${icon('alert', 16)}<span><b>Point d’attention sur le projet de Pacte :</b> un « rétablissement de la taxe GEMAPI au niveau de 2024 » (${esc(fmt.eur(prev24.amount))}) serait une <b>baisse de ${esc(fmt.eur(drop))} par an</b> (${esc(fmt.delta(-drop / cur.amount))}) par rapport au produit actuel, et non une recette supplémentaire. La formulation est à revoir.</span></div>` : ''}
    </div>
  </article>`;
}

function calendarCard() {
  const steps = [
    ['30 novembre 2026', 'Conseil communautaire : vote du taux de TEOM et des taux additionnels (TFPB, TFPNB, THRS) applicables à compter de 2027.'],
    ['Début 2027', 'Point avec le service GEMAPI sur ses besoins, pour arrêter le produit 2027.'],
    ['Avant le 15 avril 2027', 'Vote du produit GEMAPI 2027 ; retour de l’état 1259 signé à la DRFiP avec les taux votés.'],
    ['Second semestre 2027', 'Émission des rôles et premiers encaissements des nouvelles recettes.'],
    ['À partir de 2028', 'Rien n’est décidé. Repères à réexaminer après bilan : taux d’équilibre de la TEOM à 22,14 % (13,2 M€) ; option haute des taxes additionnelles à 7,38 M€ (TFPB 9,52 %, TFPNB 4,42 %, THRS 15,91 %).'],
  ];
  return `<article class="card mt"><div class="card-head"><div><p class="card-eyebrow">Calendrier</p><h2>Prochaines étapes</h2></div></div>
    <div class="card-body"><ol class="rate-steps">${steps.map(([d, t], i) => `<li${i === steps.length - 1 ? ' class="is-later"' : ''}><b>${esc(d)}</b><span>${esc(t)}</span></li>`).join('')}</ol></div></article>`;
}

export function render({year}) {
  const current = Math.max(year, new Date().getFullYear());
  const horizon = M.rateHorizon(current);
  const first = M.FIRST_FISCAL_YEAR;
  const codes = [...CURRENT, 'TFPB', 'TFPNB', 'THRS'];
  return `
  <section class="ph">
    <div><p class="ph-eyebrow">Fiscalité</p><h1>Taux votés et évolutions prévues</h1>
      <p class="ph-lede">Les taux en vigueur depuis la création de la CADEMA (31 décembre 2015), les évolutions proposées pour ${M.PROPOSAL.year} et le produit GEMAPI. Cliquez un taux pour son historique, sa source et sa délibération.</p></div>
    <div class="ph-actions"><button class="btn btn-primary" data-rates-print>${icon('download', 16)}Fiche des taux (PDF)</button></div>
  </section>

  <section class="grid g-3 rate-grid">${CURRENT.map(c => rateCard(c, current, horizon)).join('')}</section>

  ${proposalCard(current)}

  <article class="card mt rate-timeline-card">
    <div class="card-head"><div><p class="card-eyebrow">Trajectoire</p><h2>${first} – ${horizon}</h2>
      <p class="card-sub">Une bande par taxe ; chaque segment est une période à taux constant. Les segments rayés sont proposés au vote, non encore adoptés.</p></div></div>
    <div class="card-body">
      ${codes.map(code => { const h = M.rateHistory(code, horizon); return `<div class="rate-row">
        <span class="rate-row-name"><span class="sw" style="background:${color(code)}"></span>${esc(code)}</span>
        <span class="rate-line">${h.map(p => `<span class="rate-seg${p.absent ? ' is-absent' : p.rate === null ? ' is-unknown' : ''}${p.toConfirm ? ' is-unsure' : ''}${p.proposed ? ' is-proposed' : ''}" style="flex:${p.to - p.from + 1}${p.rate === null ? '' : `;--seg:${color(code)}`}" data-tip="${attr(`<b>${esc(code)} ${esc(span(p))}</b> · ${p.absent ? 'non institué' : p.rate === null ? 'taux non renseigné' : esc(pct(p.rate))}${p.proposed ? ' · proposé' : ''}${p.toConfirm ? ' · à confirmer' : ''}${p.source ? `<br>${esc(p.source)}` : ''}`)}">${p.absent ? 'Non institué' : p.rate === null ? 'Non renseigné' : esc(pct(p.rate))}</span>`).join('')}</span>
      </div>`; }).join('')}
      <div class="rate-axis"><span>${first}</span><span>${horizon}</span></div>
      <div class="legend mt"><span><span class="hatch"></span> proposé, non encore voté</span><span class="muted">Bande claire : taux à confirmer sur délibération</span></div>
    </div>
  </article>

  ${gemapiCard(current)}
  ${calendarCard()}

  <div class="notice mt">${icon('info', 16)}<span>Un taux voté se saisit dans <b>Recettes</b>, sur la fiche du produit (colonne Taux de l’exercice) : il l’emporte sur la valeur de référence et retire la mention « proposé ». Le produit GEMAPI se saisit de même avec le code <b>GEMAPI</b> dans la table Taxes.</span></div>`;
}

function rateDrawer(code) {
  const current = new Date().getFullYear();
  const {hist, cur, next} = summary(code, current, M.rateHorizon(current));
  const info = M.RATE_INFO[code];
  const docs = M.rateDocs(code);
  openDrawer({
    title: `${code} · ${pct(cur.rate)}${next ? ` → ${pct(next.rate)} proposé` : ''}`, subtitle: esc(info.label),
    body: `<dl class="rate-facts">
        <div><dt>Assiette</dt><dd>${esc(info.base)}</dd></div>
        <div><dt>Redevables</dt><dd>${esc(info.payer)}</dd></div>
        <div><dt>En vigueur depuis</dt><dd>${cur.absent ? 'Non institué' : cur.rate === null ? 'Non renseigné' : cur.from}</dd></div>
      </dl>
      ${next ? `<div class="notice notice-warn mt">${icon('alert', 16)}<span><b>${esc(pct(next.rate))} proposé pour ${next.from}</b>, soumis au conseil communautaire du ${esc(M.PROPOSAL.vote)}${M.PROPOSAL_GAINS[code] ? ` : recette nouvelle estimée à ${esc(fmt.eur(M.PROPOSAL_GAINS[code]))} à base constante` : ''}. Saisissez le taux voté dans Recettes pour le confirmer.</span></div>` : ''}
      <p class="menu-label" style="padding:18px 0 8px">Historique</p>
      <div class="rate-periods">${[...hist].reverse().map(p => `<div class="rate-period${p.rate === null && !p.absent ? ' is-unknown' : ''}">
        <span class="rate-period-y">${esc(span(p))}</span><b>${p.absent ? 'Non institué' : p.rate === null ? 'Non renseigné' : esc(pct(p.rate))}</b>
        <span class="muted">${p.rate === null && !p.absent ? 'Saisir le taux de ces exercices dans Recettes.' : esc([p.effect ? `Depuis le ${p.effect}` : '', p.source].filter(Boolean).join(' · '))}${p.proposed ? ' ' + badge('Proposé', 'warn') : ''}${p.toConfirm ? ' ' + badge('À confirmer', 'warn') : ''}${p.fromGrist ? ' ' + badge('Grist', 'neutral') : ''}</span></div>`).join('')}</div>
      <p class="menu-label" style="padding:18px 0 8px">Délibération</p>
      ${docs.length ? docs.map(d => {
        const ids = attachmentIds(d.file);
        return `<div class="doc"><span class="doc-ic">${icon('file', 18)}</span><span class="row-main"><b>${esc(d.title)}</b><span>${esc([d.year ? `exercice ${d.year}` : '', fmt.size(d.size)].filter(Boolean).join(' · '))}</span></span>
          ${ids.length ? `<button class="btn btn-sm" data-att="${ids[0]}">${icon('download', 14)}PDF</button>` : d.link ? `<a class="btn btn-sm" href="${attr(d.link)}" target="_blank" rel="noopener noreferrer">${icon('external', 14)}Lien</a>` : ''}</div>`;
      }).join('') : `<div class="notice">${icon('info', 16)}<span>Aucune délibération ${esc(code)} n’est encore déposée. Déposez le PDF : il sera rangé dans Documents et proposé ici à toute l’équipe.</span></div>`}
      <input type="file" accept="application/pdf,.pdf" hidden data-rate-file>`,
    footer: `<button class="btn btn-ghost" data-close>Fermer</button><button class="btn btn-primary" data-rate-upload>${icon('upload', 16)}${docs.length ? 'Ajouter une délibération' : 'Déposer la délibération (PDF)'}</button>`,
    onMount(el) {
      el.addEventListener('click', e => {
        const att = e.target.closest('[data-att]');
        if (att) openAttachment(Number(att.dataset.att)).catch(err => toast(err.message, 'error'));
        if (e.target.closest('[data-rate-upload]')) el.querySelector('[data-rate-file]').click();
      });
      el.querySelector('[data-rate-file]').addEventListener('change', async e => {
        const file = e.target.files[0]; e.target.value = '';
        if (!file) return;
        try {
          toast(`Envoi de ${file.name}…`, 'info');
          const attId = await uploadAttachment(file);
          const k = Math.max(0, ...rows('Documents_Fiscaux').map(r => Number(String(r.Document_ID || '').replace(/\D/g, '')) || 0)) + 1;
          await act([['AddRecord', 'Documents_Fiscaux', null, fieldsFor('Documents_Fiscaux', {
            Document_ID: `doc-${k}`, Titre: `Délibération ${code} — ${file.name.replace(/\.pdf$/i, '')}`, Type_Document: 'Délibérations',
            Exercice: next ? next.from : cur.rate === null ? current : cur.from, Module: code, Fichier: ['L', attId], Confidentialite: 'Équipe',
            Ajoute_Par: author(), Date_Ajout: M.nowSeconds(), Version: '1.0', Statut: 'Classé', Taille_Octets: file.size,
          })]]);
          closeDrawer(); toast(`Délibération ${code} classée`); rateDrawer(code);
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

export function mount(root) {
  const open = el => rateDrawer(el.dataset.rate);
  root.addEventListener('click', e => {
    const card = e.target.closest('[data-rate]');
    if (card) { open(card); return; }
    const jump = e.target.closest('tr[data-href="#gemapi"]');
    if (jump) { root.querySelector('#gemapi')?.scrollIntoView({behavior: 'smooth', block: 'start'}); return; }
    if (e.target.closest('[data-rates-print]')) {
      const title = document.title;
      document.title = `Taux votés CADEMA ${new Date().getFullYear()}`;
      addEventListener('afterprint', () => { document.title = title; }, {once: true});
      try { print(); } catch { toast('Impression bloquée ici : ouvrez le portail dans un onglet pour enregistrer le PDF.', 'info', {timeout: 7000}); }
    }
  });
  root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-rate]')) { e.preventDefault(); open(e.target); } });
}
