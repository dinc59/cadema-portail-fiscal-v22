// Lancer : node tests/cfe.test.mjs "$PWD"
import assert from 'node:assert/strict';
const repo = process.argv[2];
const {db} = await import(`${repo}/js/grist.js`);
const C = await import(`${repo}/js/pages/cfe-import.js`);
const S1 = '12345678900011', S2 = '98765432100022';
const sheet = rows => ({rows});
const map = {Raison_Sociale: 0, SIRET: 1, Adresse: 2, Parcelle: 3};
const plan = (existing, fileRows) => { db.tables.Etablissements_CFE = existing; C._setState({sheet: sheet(fileRows), map}); return C.plan(); };

// 1. Une entreprise, trois locaux à des adresses différentes : trois lignes, rien d'ignoré
let p = plan([], [['Alpha', S1, 'Rue A', ''], ['Alpha', S1, 'Rue B', ''], ['Alpha', S1, 'Rue C', '']]);
assert.deepEqual([p.add, p.upd, p.skip, p.shared], [3, 0, 0, 0]);

// 2. Même SIRET, sans adresse ni parcelle : gardés tous les deux, signalés
p = plan([], [['Alpha', S1, '', ''], ['Alpha local 2', S1, '', '']]);
assert.deepEqual([p.add, p.skip, p.shared], [2, 0, 2]);

// 3. Ligne strictement identique : seule celle-ci est ignorée
p = plan([], [['Alpha', S1, 'Rue A', ''], ['Alpha', S1, 'Rue A', '']]);
assert.deepEqual([p.add, p.skip], [1, 1]);

// 4. Réimport du même fichier : tout est mis à jour, rien n'est dupliqué
//    (les lignes existantes ont un identifiant généré, le fichier n'en a pas)
const existing = [
  {id: 1, Etablissement_ID: 'CFE-0001', SIRET: '123 456 789 00011', Adresse: 'Rue A'},
  {id: 2, Etablissement_ID: 'CFE-0002', SIRET: '123 456 789 00011', Adresse: 'Rue B'},
  {id: 3, Etablissement_ID: 'CFE-0003', SIRET: '987 654 321 00022', Adresse: ''},
  {id: 4, Etablissement_ID: 'CFE-0004', SIRET: '987 654 321 00022', Adresse: ''},
];
p = plan(existing, [['Alpha', S1, 'rue  a', ''], ['Alpha', S1, 'Rue B', ''], ['Beta', S2, '', ''], ['Beta bis', S2, '', '']]);
assert.deepEqual([p.add, p.upd], [0, 4], 'adresse rapprochée malgré la casse et les espaces');
assert.deepEqual(p.items.map(i => i.cur.id), [1, 2, 3, 4], 'les locaux sans adresse sont rapprochés dans l’ordre, chacun une seule fois');

// 5. Un local de plus dans le nouveau fichier : ajouté, les autres mis à jour
p = plan(existing, [['Beta', S2, '', ''], ['Beta bis', S2, '', ''], ['Beta ter', S2, '', '']]);
assert.deepEqual([p.add, p.upd], [1, 2]);

// 6. La parcelle distingue deux locaux à la même adresse
p = plan([], [['Alpha', S1, 'Zone X', 'AB 12'], ['Alpha', S1, 'Zone X', 'AB 13']]);
assert.deepEqual([p.add, p.shared], [2, 0]);

// 7. Un identifiant dans le fichier fait foi
db.tables.Etablissements_CFE = existing;
C._setState({sheet: sheet([['CFE-0002', 'Alpha', S1, 'Rue Z']]), map: {Etablissement_ID: 0, Raison_Sociale: 1, SIRET: 2, Adresse: 3}});
p = C.plan();
assert.equal(p.items[0].cur.id, 2);
console.log('import CFE : tous les contrôles passent');
