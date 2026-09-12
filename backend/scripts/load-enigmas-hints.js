#!/usr/bin/env node
/**
 * Chargement des solutions et des listes d'indices dans la table des enigmes.
 *
 * Le meme script sert aux deux enigmes fictives livrees avec la fonctionnalite
 * et aux vraies enigmes du commanditaire : seul le fichier de donnees change.
 *
 * Usage :
 *   node scripts/load-enigmas-hints.js --table <table> [options]
 *
 * Options :
 *   --table <nom>      Table DynamoDB des enigmes (obligatoire).
 *   --file <chemin>    Fichier de donnees (defaut : scripts/data/enigmes-demo.json).
 *   --profile <nom>    Profil AWS (defaut : celui de l'environnement).
 *   --region <nom>     Region (defaut : eu-west-1).
 *   --create           Cree l'enigme si elle n'existe pas encore.
 *   --dry-run          Affiche ce qui serait ecrit, sans rien ecrire.
 *
 * Exemples :
 *   node scripts/load-enigmas-hints.js --table rallye-hiver-backend-test-enigmas \
 *     --profile rallye-test --create --dry-run
 *
 * Format du fichier de donnees : un tableau d'objets
 *   {
 *     enigmaNumber, title, correctPassword, points, difficulty, description,
 *     solution,                       // demarche detaillee, fausses pistes comprises
 *     hints: [{ id, order, text }]    // du plus precoce au plus tardif
 *   }
 *
 * L'appariement se fait par `enigmaNumber`, puis a defaut par `title`. Sur une
 * enigme existante, seuls `solution` et `hints` sont ecrases : le PDF, le mot de
 * passe et les points en place ne sont pas touches, pour qu'un rechargement de
 * la liste d'indices en cours d'edition ne casse rien.
 */

const fs = require('fs');
const path = require('path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

function lireArguments(argv) {
  const opts = { region: 'eu-west-1', create: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--table') opts.table = argv[++i];
    else if (a === '--file') opts.file = argv[++i];
    else if (a === '--profile') opts.profile = argv[++i];
    else if (a === '--region') opts.region = argv[++i];
    else if (a === '--create') opts.create = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`Option inconnue : ${a}`);
  }
  return opts;
}

/** Controles de coherence : mieux vaut refuser que charger une liste bancale. */
function valider(enigmes) {
  const erreurs = [];
  enigmes.forEach((e, i) => {
    const ou = `entree ${i + 1} (${e.title || 'sans titre'})`;
    if (!e.title) erreurs.push(`${ou} : titre manquant`);
    if (!e.solution || e.solution.trim().length < 50) {
      erreurs.push(`${ou} : solution absente ou trop courte pour etre utile au modele`);
    }
    if (!Array.isArray(e.hints) || e.hints.length === 0) {
      erreurs.push(`${ou} : aucun indice`);
      return;
    }
    const ids = new Set();
    e.hints.forEach((h, j) => {
      if (!h.id) erreurs.push(`${ou}, indice ${j + 1} : identifiant manquant`);
      if (ids.has(h.id)) erreurs.push(`${ou} : identifiant d'indice en double (${h.id})`);
      ids.add(h.id);
      if (typeof h.order !== 'number') erreurs.push(`${ou}, indice ${h.id} : ordre manquant`);
      if (!h.text || !h.text.trim()) erreurs.push(`${ou}, indice ${h.id} : texte vide`);
    });
  });
  return erreurs;
}

async function main() {
  const opts = lireArguments(process.argv.slice(2));

  if (opts.help || !opts.table) {
    console.log(fs.readFileSync(__filename, 'utf-8').split('*/')[0].replace('#!/usr/bin/env node\n', ''));
    process.exit(opts.help ? 0 : 1);
  }

  const fichier = opts.file
    ? path.resolve(opts.file)
    : path.join(__dirname, 'data', 'enigmes-demo.json');

  const enigmes = JSON.parse(fs.readFileSync(fichier, 'utf-8'));
  const erreurs = valider(enigmes);
  if (erreurs.length > 0) {
    console.error('Donnees invalides :');
    erreurs.forEach((e) => console.error('  - ' + e));
    process.exit(1);
  }

  if (opts.profile) {
    process.env.AWS_PROFILE = opts.profile;
  }

  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: opts.region }));

  console.log(`Table   : ${opts.table}`);
  console.log(`Fichier : ${fichier}`);
  console.log(`Mode    : ${opts.dryRun ? 'simulation (rien n\'est ecrit)' : 'ecriture'}`);
  console.log('');

  // Un seul parcours de table, pour apparier toutes les entrees.
  const existantes = [];
  let lastKey;
  do {
    const r = await doc.send(
      new ScanCommand({ TableName: opts.table, ExclusiveStartKey: lastKey })
    );
    existantes.push(...(r.Items || []));
    lastKey = r.LastEvaluatedKey;
  } while (lastKey);

  for (const source of enigmes) {
    const cible =
      existantes.find((e) => e.enigmaNumber === source.enigmaNumber) ||
      existantes.find((e) => e.title === source.title);

    const maintenant = new Date().toISOString();

    if (!cible) {
      if (!opts.create) {
        console.log(`- ${source.title} : absente de la table, ignoree (utilisez --create)`);
        continue;
      }
      const enigme = {
        enigmaId: randomUUID(),
        enigmaNumber: source.enigmaNumber,
        title: source.title,
        description: source.description || '',
        pdfUrl: source.pdfUrl || '',
        correctPassword: source.correctPassword,
        points: source.points || 10,
        difficulty: source.difficulty || 'medium',
        solution: source.solution,
        hints: source.hints,
        isActive: source.isActive !== undefined ? source.isActive : true,
        createdAt: maintenant,
        updatedAt: maintenant,
      };
      console.log(
        `+ ${source.title} : creation (${source.hints.length} indices, ${enigme.points} points)`
      );
      if (!opts.dryRun) {
        await doc.send(new PutCommand({ TableName: opts.table, Item: enigme }));
      }
      continue;
    }

    console.log(
      `~ ${cible.title} (#${cible.enigmaNumber}) : mise a jour de la solution et de ${source.hints.length} indices`
    );
    if (!opts.dryRun) {
      await doc.send(
        new UpdateCommand({
          TableName: opts.table,
          Key: { enigmaId: cible.enigmaId },
          UpdateExpression: 'SET solution = :s, hints = :h, updatedAt = :u',
          ExpressionAttributeValues: {
            ':s': source.solution,
            ':h': source.hints,
            ':u': maintenant,
          },
        })
      );
    }
  }

  console.log('');
  console.log(opts.dryRun ? 'Simulation terminee.' : 'Chargement termine.');
}

main().catch((err) => {
  console.error('Echec :', err.message);
  process.exit(1);
});
