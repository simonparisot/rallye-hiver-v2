#!/usr/bin/env node
/**
 * Vérifie que chaque feuille de thème déclare toutes les variables CSS que les
 * composants emploient.
 *
 * Une variable indéfinie n'est pas ignorée : elle invalide toute la
 * déclaration qui la contient, et la bordure ou l'ombre disparaît sans erreur.
 * C'est le piège principal du mécanisme (voir src/editions/README.md).
 *
 * Usage, depuis frontend/ :  node scripts/verifier-variables-theme.mjs
 * Code de sortie 1 si une feuille oublie une variable.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(racine, 'src');
const dossierThemes = path.join(src, 'editions', 'themes');

function parcourir(dossier) {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? parcourir(path.join(dossier, e.name)) : [path.join(dossier, e.name)]
  );
}

const fichiers = parcourir(src).filter(
  (f) => /\.(css|tsx|ts)$/.test(f) && !f.startsWith(dossierThemes)
);

// Variables employées en var(--x), dans les CSS et dans les styles inline des TSX.
// Celles qui portent une valeur de repli, var(--x, 6px), ne sont pas exigées.
const employees = new Map();
// Variables déclarées hors des thèmes (valeurs structurelles de App.css, etc.).
const declareesAilleurs = new Set();
for (const f of fichiers) {
  const texte = fs.readFileSync(f, 'utf8');
  for (const m of texte.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
    if (m[2]) continue;
    if (!employees.has(m[1])) employees.set(m[1], new Set());
    employees.get(m[1]).add(path.relative(racine, f));
  }
  if (f.endsWith('.css')) {
    for (const m of texte.matchAll(/(--[\w-]+)\s*:/g)) declareesAilleurs.add(m[1]);
  }
}

let erreurs = 0;
for (const feuille of fs.readdirSync(dossierThemes).filter((f) => f.endsWith('.css'))) {
  const texte = fs.readFileSync(path.join(dossierThemes, feuille), 'utf8');
  const declarees = new Set([...texte.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const manquantes = [...employees.keys()].filter(
    (v) => !declarees.has(v) && !declareesAilleurs.has(v)
  );
  console.log(`${feuille} : ${declarees.size} déclarées, ${manquantes.length} manquante(s)`);
  for (const v of manquantes) {
    console.log(`  ${v}  (employée dans ${[...employees.get(v)].join(', ')})`);
  }
  erreurs += manquantes.length;
}
process.exit(erreurs ? 1 : 0);
