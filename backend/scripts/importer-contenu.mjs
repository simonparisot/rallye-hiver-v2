#!/usr/bin/env node
/**
 * Remplace le contenu de jeu d'un environnement par celui d'un dossier.
 *
 *   node backend/scripts/importer-contenu.mjs test --dossier content --verifier
 *   node backend/scripts/importer-contenu.mjs test --dossier content --vider --importer
 *
 * Le dossier suit une convention de nommage, et rien d'autre :
 *
 *   Enigme <n> - <titre>.pdf      les vingt énoncés
 *   Parcours <n> - <titre>.pdf    les parcours
 *   Mots de passe.md              une réponse par ligne, dans l'ordre des énigmes
 *   Indices.md                    « Enigme <n> : » puis un indice par ligne
 *   solutions.json                facultatif — { enigmas: [{ number, solution }] }
 *
 * Le numéro et le titre viennent du nom de fichier : c'est la seule source, il
 * n'y a pas de second endroit où les tenir à jour, donc pas de désaccord
 * possible entre le PDF affiché et la ligne de la liste.
 *
 * Trois étapes séparées, à demander explicitement :
 *   --verifier  lit tout, ne touche à rien, et dit ce qui serait écrit.
 *   --vider     supprime énigmes, parcours et avancement des équipes.
 *   --importer  téléverse les PDF puis écrit les lignes.
 *
 * --vider ne touche ni aux comptes, ni aux équipes, ni au statut du jeu :
 * effacer le contenu n'est pas remettre le rallye à zéro.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, ScanCommand, BatchWriteCommand, PutCommand, UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/* --------------------------------------------------------------------------
   Environnements

   Les noms de table sont ceux que porte le Lambda de l'environnement ; ils
   sont répétés ici plutôt que devinés, pour qu'une erreur de préfixe se voie
   à la lecture et non après coup.
   -------------------------------------------------------------------------- */
const ENVIRONNEMENTS = {
  test: {
    profil: 'rallye-test',
    region: 'eu-west-1',
    prefixe: 'rallye-hiver-backend-test',
    bucket: 'rallyehiver-enigmas-test',
    // Le préfixe que produit le backend lui-même : generatePresignedUrl.ts
    // porte « 2025 » en dur, quelle que soit l'édition. On s'aligne plutôt
    // que d'inventer un second rangement dans le même seau.
    prefixeS3: '2025',
  },
};

// Les tables vidées par --vider. Le contenu d'abord, puis tout ce qui décrit
// où en sont les équipes : garder un avancement qui pointe vers des énigmes
// disparues ne laisserait que des références mortes.
const TABLES_CONTENU = ['enigmas', 'parcours'];
const TABLES_AVANCEMENT = [
  'team-enigma-progress',
  'team-parcours-access',
  'hint-requests',
  'password-attempts',
  'enigma-difficulty-cache',
  'oie-team-state',
  'oie-events',
];

// Clés primaires, pour savoir quoi renvoyer dans une suppression par lot.
const CLES = {
  enigmas: ['enigmaId'],
  parcours: ['parcoursId'],
  'team-enigma-progress': ['teamId', 'enigmaId'],
  'team-parcours-access': ['teamId', 'parcoursId'],
  'hint-requests': ['requestId'],
  'password-attempts': ['attemptId'],
  'enigma-difficulty-cache': ['cacheKey'],
  'oie-team-state': ['teamId'],
  'oie-events': ['boardId', 'eventKey'],
};

/* --------------------------------------------------------------------------
   Barème

   Trois paliers, comme le contenu déjà en place : la difficulté n'est pas
   renseignée dans le dossier, on la déduit du numéro. Les premières énigmes
   sont les plus abordables, les dernières les plus coriaces.
   -------------------------------------------------------------------------- */
function baremeDe(numero, total) {
  const tiers = Math.ceil(total / 3);
  if (numero <= tiers) return { difficulty: 'easy', points: 10 };
  if (numero <= tiers * 2) return { difficulty: 'medium', points: 15 };
  return { difficulty: 'hard', points: 20 };
}

/* --------------------------------------------------------------------------
   Lecture du dossier
   -------------------------------------------------------------------------- */
function lireDossier(dossier) {
  const fichiers = readdirSync(dossier);

  const motsDePasse = lireLignes(join(dossier, 'Mots de passe.md'));
  const indices = lireIndices(join(dossier, 'Indices.md'));
  const solutions = lireSolutions(join(dossier, 'solutions.json'));

  const enigmas = [];
  const parcours = [];
  for (const nom of fichiers) {
    let m = /^Enigme (\d+) - (.+)\.pdf$/.exec(nom);
    if (m) { enigmas.push({ number: Number(m[1]), title: m[2], fichier: join(dossier, nom) }); continue; }
    m = /^Parcours (\d+) - (.+)\.pdf$/.exec(nom);
    if (m) parcours.push({ number: Number(m[1]), title: m[2], fichier: join(dossier, nom) });
  }
  enigmas.sort((a, b) => a.number - b.number);
  parcours.sort((a, b) => a.number - b.number);

  const soucis = [];
  const attendus = (liste) => liste.map((_, i) => i + 1);
  if (String(enigmas.map((e) => e.number)) !== String(attendus(enigmas))) {
    soucis.push(`numéros d'énigmes non contigus : ${enigmas.map((e) => e.number).join(', ')}`);
  }
  if (String(parcours.map((p) => p.number)) !== String(attendus(parcours))) {
    soucis.push(`numéros de parcours non contigus : ${parcours.map((p) => p.number).join(', ')}`);
  }
  if (motsDePasse.length !== enigmas.length) {
    soucis.push(`${motsDePasse.length} mots de passe pour ${enigmas.length} énigmes`);
  }

  for (const e of enigmas) {
    e.password = motsDePasse[e.number - 1] ?? '';
    e.hints = indices[e.number] ?? [];
    e.solution = solutions[e.number] ?? '';
    if (!e.password) soucis.push(`énigme ${e.number} sans mot de passe`);
    if (!statSync(e.fichier).size) soucis.push(`énigme ${e.number} : PDF vide`);
  }
  for (const p of parcours) {
    if (!statSync(p.fichier).size) soucis.push(`parcours ${p.number} : PDF vide`);
  }
  return { enigmas, parcours, soucis };
}

function lireLignes(chemin) {
  return readFileSync(chemin, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
}

// « Enigme 11 : » ouvre une section ; chaque ligne non vide qui suit est un
// indice, dans l'ordre. Une section sans ligne est une énigme sans indice, ce
// qui est le cas de dix-neuf d'entre elles aujourd'hui.
function lireIndices(chemin) {
  const parNumero = {};
  let courant = null;
  for (const ligne of readFileSync(chemin, 'utf8').split('\n')) {
    const t = ligne.trim();
    const m = /^Enigme\s+(\d+)\s*:\s*(.*)$/i.exec(t);
    if (m) {
      courant = Number(m[1]);
      parNumero[courant] = [];
      if (m[2].trim()) parNumero[courant].push(m[2].trim());
    } else if (t && courant !== null) {
      parNumero[courant].push(t);
    }
  }
  return parNumero;
}

function lireSolutions(chemin) {
  try {
    const brut = JSON.parse(readFileSync(chemin, 'utf8'));
    return Object.fromEntries((brut.enigmas ?? [])
      .filter((e) => e.solution)
      .map((e) => [e.number, e.solution]));
  } catch {
    return {};
  }
}

/* --------------------------------------------------------------------------
   Écriture
   -------------------------------------------------------------------------- */
async function viderTable(doc, table, cles) {
  let restant, total = 0;
  do {
    const { Items = [], LastEvaluatedKey } = await doc.send(new ScanCommand({
      TableName: table,
      ProjectionExpression: cles.map((_, i) => `#k${i}`).join(', '),
      ExpressionAttributeNames: Object.fromEntries(cles.map((c, i) => [`#k${i}`, c])),
      ExclusiveStartKey: restant,
    }));
    restant = LastEvaluatedKey;
    for (let i = 0; i < Items.length; i += 25) {
      const lot = Items.slice(i, i + 25);
      // BatchWrite peut rendre une partie du lot non traitée sans échouer :
      // sans cette reprise, une suppression « réussie » laisserait des lignes.
      let reste = { [table]: lot.map((Key) => ({ DeleteRequest: { Key } })) };
      for (let essai = 0; essai < 6 && reste[table]?.length; essai += 1) {
        const { UnprocessedItems } = await doc.send(new BatchWriteCommand({ RequestItems: reste }));
        reste = UnprocessedItems ?? {};
        if (reste[table]?.length) await new Promise((r) => setTimeout(r, 200 * 2 ** essai));
      }
      if (reste[table]?.length) throw new Error(`${table} : ${reste[table].length} suppression(s) non abouties`);
      total += lot.length;
    }
  } while (restant);
  return total;
}

async function televerser(s3, env, fichier) {
  const cle = `${env.prefixeS3}/${randomUUID()}.pdf`;
  await s3.send(new PutObjectCommand({
    Bucket: env.bucket,
    Key: cle,
    Body: readFileSync(fichier),
    ContentType: 'application/pdf',
  }));
  // Le bucket est public en lecture (politique PublicReadGetObject) : l'URL
  // est directe, sans signature, comme pour le contenu déjà en place.
  return `https://${env.bucket}.s3.${env.region}.amazonaws.com/${cle}`;
}

/* --------------------------------------------------------------------------
   Programme
   -------------------------------------------------------------------------- */
async function principal() {
  const args = process.argv.slice(2);
  const nomEnv = args[0];
  const env = ENVIRONNEMENTS[nomEnv];
  if (!env) {
    console.error(`Usage : node backend/scripts/importer-contenu.mjs <${Object.keys(ENVIRONNEMENTS).join('|')}> --dossier <chemin> [--verifier] [--vider] [--importer]`);
    process.exit(1);
  }
  const dossier = resolve(args[args.indexOf('--dossier') + 1] ?? 'content');
  const verifier = args.includes('--verifier');
  const vider = args.includes('--vider');
  const importer = args.includes('--importer');
  if (!verifier && !vider && !importer) {
    console.error('Rien à faire : précisez --verifier, --vider ou --importer.');
    process.exit(1);
  }

  process.env.AWS_PROFILE ||= env.profil;
  process.env.AWS_REGION ||= env.region;

  const { enigmas, parcours, soucis } = lireDossier(dossier);

  console.log(`\nDossier : ${dossier}`);
  console.log(`  ${enigmas.length} énigmes, ${parcours.length} parcours`);
  const avecIndices = enigmas.filter((e) => e.hints.length);
  const avecSolution = enigmas.filter((e) => e.solution);
  console.log(`  ${avecIndices.length} énigmes avec indices (${avecIndices.map((e) => e.number).join(', ') || '—'})`);
  console.log(`  ${avecSolution.length} énigmes avec solution`);
  if (soucis.length) {
    console.log('\n  À regarder :');
    for (const s of soucis) console.log(`   ⚠ ${s}`);
  }

  if (verifier) {
    console.log('\nCe qui serait écrit :');
    for (const e of enigmas) {
      const { difficulty, points } = baremeDe(e.number, enigmas.length);
      console.log(`  ${String(e.number).padStart(2)}  ${e.title.padEnd(34)} ${String(points).padStart(2)} pts  ${difficulty.padEnd(6)} mdp=${e.password.padEnd(17)} ${e.hints.length} indice(s)  ${e.solution ? 'solution ✓' : 'solution —'}`);
    }
    for (const p of parcours) console.log(`  P${p.number}  ${p.title}`);
    if (!vider && !importer) return;
  }

  const client = new DynamoDBClient({ region: env.region });
  const doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  const s3 = new S3Client({ region: env.region });
  const table = (suffixe) => `${env.prefixe}-${suffixe}`;

  if (vider) {
    console.log('\nSuppression du contenu et de l\'avancement :');
    for (const suffixe of [...TABLES_CONTENU, ...TABLES_AVANCEMENT]) {
      const n = await viderTable(doc, table(suffixe), CLES[suffixe]);
      console.log(`  ${suffixe.padEnd(26)} ${n} ligne(s) supprimée(s)`);
    }
    // Les équipes restent, mais leur compteur d'énigmes résolues comptait des
    // énigmes qui n'existent plus. On le remet à zéro sans toucher au reste
    // de la ligne : c'est l'avancement qui est effacé, pas l'équipe.
    const equipes = await doc.send(new ScanCommand({
      TableName: table('teams'), ProjectionExpression: 'teamId',
    }));
    for (const { teamId } of equipes.Items ?? []) {
      await doc.send(new UpdateCommand({
        TableName: table('teams'),
        Key: { teamId },
        UpdateExpression: 'SET solvedEnigmasCount = :zero, updatedAt = :t',
        ExpressionAttributeValues: { ':zero': 0, ':t': new Date().toISOString() },
      }));
    }
    console.log(`  ${'teams (compteur remis à 0)'.padEnd(26)} ${equipes.Items?.length ?? 0} équipe(s)`);
  }

  if (importer) {
    const maintenant = new Date().toISOString();

    console.log('\nTéléversement des énoncés et écriture des énigmes :');
    const idParNumero = {};
    for (const e of enigmas) {
      const { difficulty, points } = baremeDe(e.number, enigmas.length);
      const enigmaId = randomUUID();
      idParNumero[e.number] = enigmaId;
      const pdfUrl = await televerser(s3, env, e.fichier);
      await doc.send(new PutCommand({
        TableName: table('enigmas'),
        Item: {
          enigmaId,
          enigmaNumber: e.number,
          title: e.title,
          description: '',
          correctPassword: e.password,
          pdfUrl,
          points,
          difficulty,
          isActive: true,
          // Le pool d'indices dans lequel le modèle choisit. Absent quand
          // l'énigme n'en a pas encore : la demande d'indice le dira.
          ...(e.hints.length ? {
            hints: e.hints.map((text, i) => ({ id: `h${i + 1}`, order: i + 1, text })),
          } : {}),
          // Contexte donné au modèle pour choisir l'indice utile.
          ...(e.solution ? { solution: e.solution } : {}),
          createdAt: maintenant,
          updatedAt: maintenant,
        },
      }));
      console.log(`  ${String(e.number).padStart(2)}  ${e.title.padEnd(34)} ${enigmaId}`);
    }

    // Les parcours s'ouvrent au fil des énigmes résolues : le premier après
    // deux, puis deux de plus à chaque fois. requiredEnigmaIds nomme lesquelles
    // pour que l'ouverture ne dépende pas que d'un compte.
    console.log('\nTéléversement et écriture des parcours :');
    for (const p of parcours) {
      const nb = Math.min(p.number * 2, enigmas.length);
      const requiredEnigmaIds = Array.from({ length: nb }, (_, i) => idParNumero[i + 1]).filter(Boolean);
      const pdfUrl = await televerser(s3, env, p.fichier);
      const parcoursId = randomUUID();
      await doc.send(new PutCommand({
        TableName: table('parcours'),
        Item: {
          parcoursId,
          parcoursNumber: p.number,
          title: p.title,
          description: '',
          pdfUrl,
          requiredEnigmaIds,
          requiredEnigmasCount: nb,
          isActive: true,
          createdAt: maintenant,
          updatedAt: maintenant,
        },
      }));
      console.log(`  P${p.number}  ${p.title.padEnd(34)} ${nb} énigmes requises  ${parcoursId}`);
    }

    // Le plateau du jeu de l'oie désigne l'énigme qu'il incarne par son
    // identifiant. Celui-ci vient de disparaître avec l'ancien contenu ; sans
    // ce recollage le plateau resterait branché sur une énigme inexistante.
    const enigmeOie = enigmas.find((e) => /jeu de l.oie/i.test(e.title));
    if (enigmeOie) {
      const nouvelId = idParNumero[enigmeOie.number];
      await doc.send(new UpdateCommand({
        TableName: table('oie-board'),
        Key: { boardId: 'default' },
        UpdateExpression: 'SET enigmaId = :id, updatedAt = :t',
        ExpressionAttributeValues: { ':id': nouvelId, ':t': maintenant },
      }));
      console.log(`\nPlateau du jeu de l'oie rebranché sur l'énigme ${enigmeOie.number} (${enigmeOie.title}).`);
      console.log('À reporter dans scripts/deploy-frontend.sh :');
      console.log(`  OIE_ENIGMA_ID="${nouvelId}"`);
    } else {
      console.log("\nAucune énigme « jeu de l'oie » dans le dossier : plateau laissé tel quel.");
    }
  }

  console.log('');
}

principal().catch((e) => { console.error(e); process.exit(1); });
