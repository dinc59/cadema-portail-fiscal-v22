/* Taux votés (#/taux) : CFE, TEOM et versement mobilité depuis la création
   de la CADEMA. Un clic sur un taux ouvre sa fiche : historique, source,
   délibération en PDF. « Fiche des taux » s'imprime ou s'enregistre en PDF. */
import * as M from '../model.js';
import { act, fieldsFor, rows, uploadAttachment, openAttachment, attachmentIds } from '../grist.js';
import { esc, attr, icon, fmt, badge, openDrawer, closeDrawer, toast } from '../ui.js';
import { author } from '../main.js';

const pct = r => r === null || r === undefined ? '—' : `${r.toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} %`;
const color = code => `var(--s${M.taxByCode(code)?.slot || 1})`;
const span = p => p.from === p.to ? `${p.from}` : `${p.from}–${p.to}`;

function summary(code, year) {
  const hist = M.rateHistory(code, year);
  const cur = hist[hist.length - 1];
  const known = hist.filter(p => p.rate !== null);
  const changes = known.length - 1;
  const gap = hist.find(p => p.rate === null && !p.absent);
  const instituted = known[0]?.from ?? null;
  return {hist, cur, changes, gap, instituted, since: cur.rate !== null ? cur.from : null};
}

export function render({year}) {
  const current = Math.max(year, new Date().getFullYear());
  const list = M.RATE_CODES.map(code => ({code, ...summary(code, current)}));
  const first = M.FIRST_FISCAL_YEAR;
  const n = current - first + 1;
  return `
  <section class="ph">
    <div><p class="ph-eyebrow">Fiscalité</p><h1>Taux votés par la CADEMA</h1>
      <p class="ph-lede">Depuis la création de la communauté d’agglomération le 31 décembre 2015. Cliquez un taux pour son historique, sa source et sa délibération.</p></div>
    <div class="ph-actions"><button class="btn btn-primary" data-rates-print>${icon('download', 16)}Fiche des taux (PDF)</button></div>
  </section>

  <section class="grid g-3 rate-grid">
    ${list.map(r => `<article class="card rate-card" data-rate="${r.code}" role="button" tabindex="0" aria-label="Fiche du taux ${attr(r.code)}">
      <span class="rate-top"><span class="sw" style="background:${color(r.code)}"></span><b>${esc(r.code)}</b>
        ${r.cur.rate === null ? badge('À compléter', 'warn') : r.changes === 0 && !r.gap ? badge('Inchangé', 'good') : badge(`${r.changes + 1} taux successifs`, 'info')}</span>
      <span class="rate-value">${esc(pct(r.cur.rate))}</span>
      <span class="rate-label">${esc(M.RATE_INFO[r.code].label)}</span>
      <span class="rate-meta">${r.since ? `En vigueur depuis ${r.cur.effect ? esc(r.cur.effect) : r.since}` : 'Taux en vigueur non renseigné'}${r.changes > 0 && r.instituted ? ` · institué en ${r.instituted}` : ''}${r.gap ? ` · ${esc(span(r.gap))} à compléter` : ''}</span>
      <span class="rate-open">Historique et délibération ${icon('right', 14)}</span>
    </article>`).join('')}
  </section>

  <article class="card mt rate-timeline-card">
    <div class="card-head"><div><p class="card-eyebrow">Historique</p><h2>${first} – ${current}</h2>
      <p class="card-sub">Une bande par taxe ; chaque segment est une période à taux constant.</p></div></div>
    <div class="card-body">
      ${list.map(r => `<div class="rate-row">
        <span class="rate-row-name"><span class="sw" style="background:${color(r.code)}"></span>${esc(r.code)}</span>
        <span class="rate-line">${r.hist.map(p => `<span class="rate-seg${p.absent ? ' is-absent' : p.rate === null ? ' is-unknown' : ''}${p.toConfirm ? ' is-unsure' : ''}" style="flex:${p.to - p.from + 1}${p.rate === null ? '' : `;--seg:${color(r.code)}`}" data-tip="${attr(`<b>${esc(r.code)} ${esc(span(p))}</b> · ${p.absent ? 'non institué' : p.rate === null ? 'taux non renseigné' : esc(pct(p.rate))}${p.toConfirm ? ' · à confirmer' : ''}${p.source ? `<br>${esc(p.source)}` : ''}`)}">${p.absent ? 'Non institué' : p.rate === null ? 'Non renseigné' : esc(pct(p.rate))}</span>`).join('')}</span>
      </div>`).join('')}
      <div class="rate-axis" style="--n:${n}"><span>${first}</span><span>${current}</span></div>
    </div>
  </article>

  <div class="notice mt">${icon('info', 16)}<span>Un nouveau taux se saisit dans <b>Recettes</b>, sur la fiche du produit (colonne Taux de l’exercice) : l’historique se met à jour seul. Un taux saisi dans Grist l’emporte toujours sur la valeur de référence du portail.</span></div>`;
}

function rateDrawer(code) {
  const current = new Date().getFullYear();
  const {hist, cur} = summary(code, current);
  const info = M.RATE_INFO[code];
  const docs = M.rateDocs(code);
  openDrawer({
    title: `${code} · ${pct(cur.rate)}`, subtitle: esc(info.label),
    body: `<dl class="rate-facts">
        <div><dt>Assiette</dt><dd>${esc(info.base)}</dd></div>
        <div><dt>Redevables</dt><dd>${esc(info.payer)}</dd></div>
        <div><dt>En vigueur depuis</dt><dd>${cur.rate === null ? 'Non renseigné' : cur.from}</dd></div>
      </dl>
      <p class="menu-label" style="padding:18px 0 8px">Historique</p>
      <div class="rate-periods">${[...hist].reverse().map(p => `<div class="rate-period${p.rate === null && !p.absent ? ' is-unknown' : ''}">
        <span class="rate-period-y">${esc(span(p))}</span><b>${p.absent ? 'Non institué' : p.rate === null ? 'Non renseigné' : esc(pct(p.rate))}</b>
        <span class="muted">${p.rate === null && !p.absent ? 'Saisir le taux de ces exercices dans Recettes.' : esc([p.effect ? `Depuis le ${p.effect}` : '', p.source].filter(Boolean).join(' · '))}${p.toConfirm ? ' ' + badge('À confirmer', 'warn') : ''}${p.fromGrist ? ' ' + badge('Grist', 'neutral') : ''}</span></div>`).join('')}</div>
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
            Exercice: cur.rate === null ? current : cur.from, Module: code, Fichier: ['L', attId], Confidentialite: 'Équipe',
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
    if (e.target.closest('[data-rates-print]')) {
      const title = document.title;
      document.title = `Taux votés CADEMA ${new Date().getFullYear()}`;
      addEventListener('afterprint', () => { document.title = title; }, {once: true});
      try { print(); } catch { toast('Impression bloquée ici : ouvrez le portail dans un onglet pour enregistrer le PDF.', 'info', {timeout: 7000}); }
    }
  });
  root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-rate]')) { e.preventDefault(); open(e.target); } });
}
