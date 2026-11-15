// Lance tous les tests : node tests/run.mjs   (npm install une fois, pour jsdom)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const dir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(dir, '..');
const files = ['model.test.mjs', 'cfe.test.mjs', 'render.test.mjs', 'taux.render.mjs', 'docs.render.mjs', 'fiche.render.mjs', 'rs.bulk.mjs', 'banner.render.mjs'];
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir, f), repo], {encoding: 'utf8'});
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${f}`);
  if (!ok) console.log((r.stdout + r.stderr).split('\n').slice(0, 30).join('\n'));
}
console.log(failed ? `${failed} fichier(s) en échec` : 'Tous les tests passent');
process.exit(failed ? 1 : 0);
