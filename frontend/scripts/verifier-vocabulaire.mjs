#!/usr/bin/env node
/**
 * Vérifie qu'aucun mot du thème 2027 n'est écrit en dur dans un texte visible
 * du site principal.
 *
 * Sous l'habillage neutre, le site ne doit rien laisser deviner du thème : le
 * vocabulaire (intrigue, tournée, troupe, souffleur…) passe par
 * `useEdition().vocabulaire`, défini pour chaque habillage dans src/editions/.
 * Un mot écrit en dur dans un composant s'afficherait sous les deux.
 *
 * Ce qui est examiné : les fichiers .tsx et .ts de src/, commentaires retirés,
 * ainsi que les attributs qui ne s'affichent pas (className, data-testid, key,
 * htmlFor, id…). Un mot collé à une lettre, un tiret ou un souligné est un
 * identifiant (onAllerTroupe, souffleur-icone) et n'est pas signalé. Seuls
 * les accès à une clé du vocabulaire, `v.<clé>` et `vocabulaire.<clé>`
 * (`v.souffleur.le`), sont aussi ignorés : un mot précédé d'un autre point
 * (« la phrase.Troupe », « ...souffleur ») reste signalé.
 *
 * Exclus : src/oie/ (inaccessible avant le lancement), src/admin/ (réservé
 * aux organisateurs), src/editions/ (c'est là que vit le vocabulaire) et les
 * types. Aucune exclusion provisoire : un composant visible se migre, il ne
 * s'exclut pas.
 *
 * Usage, depuis frontend/ :  node scripts/verifier-vocabulaire.mjs
 * Code de sortie 1 si un mot est trouvé.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(racine, 'src');

const EXCLUS = [
  'src/oie/',
  'src/admin/',
  'src/editions/',
  'src/types/',
];

const MOTS = [
  'intrigues?', 'tourn[ée]es?', 'troupes?', 'souffleurs?', 'th[ée][âa]tres?',
  'th[ée][âa]tral\\w*', 'rideaux?', 'sc[èe]nes?', 'actes?', 'r[ée]p[ée]titions?',
  'coulisses?', 'loges?', 'spectacles?', 'masques?', 'com[ée]diens?', 'acteurs?',
];
const motif = new RegExp(`(?<![\\p{L}\\-_])(?<!\\b(?:v|vocabulaire)\\.)(${MOTS.join('|')})(?![\\p{L}\\-_])`, 'giu');

function parcourir(dossier) {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? parcourir(path.join(dossier, e.name)) : [path.join(dossier, e.name)]
  );
}

/** Remplace les commentaires par des espaces, en gardant les retours à la ligne. */
function sansCommentaires(texte) {
  const blanc = (m) => m.replace(/[^\n]/g, ' ');
  return texte
    .replace(/\/\*[\s\S]*?\*\//g, blanc)
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, avant) => avant + blanc(m.slice(avant.length)));
}

/** Retire les attributs qui ne s'affichent pas. */
function sansAttributsInvisibles(texte) {
  const blanc = (m) => m.replace(/[^\n]/g, ' ');
  return texte.replace(
    /\b(className|data-testid|key|htmlFor|id|aria-labelledby|aria-controls|name|type|to)=(\{`[^`]*`\}|"[^"]*"|'[^']*')/g,
    blanc
  );
}

const fichiers = parcourir(src)
  .filter((f) => /\.(tsx|ts)$/.test(f) && !/\.test\.tsx?$/.test(f))
  .filter((f) => !EXCLUS.some((e) => path.relative(racine, f).startsWith(e)));

let trouves = 0;
for (const f of fichiers) {
  const lignes = sansAttributsInvisibles(sansCommentaires(fs.readFileSync(f, 'utf8'))).split('\n');
  lignes.forEach((ligne, i) => {
    for (const m of ligne.matchAll(motif)) {
      trouves++;
      console.log(`${path.relative(racine, f)}:${i + 1}  « ${m[1]} »  ${ligne.trim().slice(0, 120)}`);
    }
  });
}
console.log(trouves ? `${trouves} mot(s) du thème en dur.` : 'Aucun mot du thème en dur.');
process.exit(trouves ? 1 : 0);
