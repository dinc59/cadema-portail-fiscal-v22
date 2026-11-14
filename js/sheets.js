/* Lecture de fichiers tableur dans le navigateur, sans bibliothèque :
   - .xlsx : archive ZIP lue à la main, décompressée par DecompressionStream,
     XML lu par DOMParser (texte partagé, texte en ligne, nombres, booléens) ;
   - .csv / .txt : séparateur détecté (; , tabulation), guillemets gérés,
     encodage UTF-8 ou Windows-1252.
   Le fichier ne quitte jamais le navigateur. */

const decoder = new TextDecoder('utf-8');

async function zipReader(buffer) {
  const dv = new DataView(buffer);
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Fichier Excel illisible (archive incomplète)');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = new Map();
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    files.set(decoder.decode(new Uint8Array(buffer, p + 46, nlen)), {method, size, offset});
    p += 46 + nlen + elen + clen;
  }
  return async name => {
    const f = files.get(name);
    if (!f) return null;
    const start = f.offset + 30 + dv.getUint16(f.offset + 26, true) + dv.getUint16(f.offset + 28, true);
    const data = new Uint8Array(buffer, start, f.size);
    if (f.method === 0) return decoder.decode(data);
    if (f.method !== 8) throw new Error('Compression Excel non prise en charge');
    if (!('DecompressionStream' in window)) throw new Error('Navigateur trop ancien pour lire un .xlsx : enregistrez le fichier en CSV');
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  };
}

const xml = s => new DOMParser().parseFromString(s, 'application/xml');
const textOf = el => [...el.getElementsByTagName('t')].map(t => t.textContent).join('');
const colIndex = ref => {
  const letters = String(ref || '').replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

async function readXlsx(buffer) {
  const read = await zipReader(buffer);
  const wb = xml(await read('xl/workbook.xml') || '');
  const rels = xml(await read('xl/_rels/workbook.xml.rels') || '<r/>');
  const target = {};
  for (const r of rels.getElementsByTagName('Relationship')) target[r.getAttribute('Id')] = r.getAttribute('Target');
  const shared = [];
  const ss = await read('xl/sharedStrings.xml');
  if (ss) for (const si of xml(ss).getElementsByTagName('si')) shared.push(textOf(si));
  const sheets = [];
  for (const s of wb.getElementsByTagName('sheet')) {
    const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let path = target[rid] || '';
    path = path.startsWith('/') ? path.slice(1) : `xl/${path.replace(/^\.\//, '')}`;
    const src = await read(path);
    if (!src) continue;
    const rows = [];
    for (const row of xml(src).getElementsByTagName('row')) {
      const r = Number(row.getAttribute('r')) - 1;
      const cells = [];
      let pos = 0;
      for (const c of row.getElementsByTagName('c')) {
        const idx = c.getAttribute('r') ? colIndex(c.getAttribute('r')) : pos;
        pos = idx + 1;
        const t = c.getAttribute('t');
        const v = c.getElementsByTagName('v')[0]?.textContent;
        let val = null;
        if (t === 's') val = shared[Number(v)] ?? '';
        else if (t === 'inlineStr') val = textOf(c);
        else if (t === 'str' || t === 'e') val = v ?? '';
        else if (t === 'b') val = v === '1';
        else if (v !== undefined && v !== '') val = Number(v);
        cells[idx] = val;
      }
      rows[Number.isFinite(r) && r >= 0 ? r : rows.length] = cells;
    }
    sheets.push({name: s.getAttribute('name'), rows: Array.from(rows, r => r || [])});
  }
  return sheets;
}

function parseCsv(text) {
  const first = text.split(/\r?\n/).find(l => l.trim()) || '';
  const sep = [';', '\t', ','].map(s => [s, first.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/* Renvoie [{name, header:[...], rows:[[...]]}], l'en-tête étant la première
   ligne non vide de chaque feuille. */
export async function readSheets(file) {
  const buffer = await file.arrayBuffer();
  let sheets;
  if (/\.xlsx$/i.test(file.name) || new Uint8Array(buffer, 0, 2).join() === '80,75') sheets = await readXlsx(buffer);
  else if (/\.xls$/i.test(file.name)) throw new Error('Ancien format .xls : enregistrez le fichier en .xlsx ou en CSV depuis Excel');
  else {
    let text = new TextDecoder('utf-8').decode(buffer);
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buffer);
    sheets = [{name: file.name, rows: parseCsv(text.replace(/^﻿/, ''))}];
  }
  return sheets.map(s => {
    const clean = s.rows.map(r => r.map(v => typeof v === 'string' ? v.trim() : v));
    const h = clean.findIndex(r => r.filter(v => v !== null && v !== undefined && v !== '').length >= 2);
    if (h < 0) return {name: s.name, header: [], rows: []};
    const width = Math.max(...clean.slice(h).map(r => r.length));
    const header = Array.from({length: width}, (_, i) => String(clean[h][i] ?? '').trim() || `Colonne ${i + 1}`);
    const rows = clean.slice(h + 1).filter(r => r.some(v => v !== null && v !== undefined && v !== ''));
    return {name: s.name, header, rows};
  }).filter(s => s.header.length);
}

/* Date Excel (nombre de jours depuis 1899-12-30) → AAAA-MM-JJ. */
export function excelDate(v) {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(String(v || '').trim());
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return v === null || v === undefined ? null : String(v);
}
