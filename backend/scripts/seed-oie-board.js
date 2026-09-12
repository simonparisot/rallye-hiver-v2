#!/usr/bin/env node
/**
 * Charge un plateau de jeu de l'oie dans DynamoDB.
 *
 * Le meme script sert pour les questions d'essai et pour les vraies : il lit un
 * fichier JSON au format de l'import de la page /admin/oie, verifie qu'il tient
 * debout, puis ecrit l'unique enregistrement de la table oie-board.
 *
 * Exemples :
 *   node scripts/seed-oie-board.js --profile rallye-test --table rallye-hiver-backend-test-oie-board
 *   node scripts/seed-oie-board.js --file scripts/mon-plateau.json --enigma-id abc-123 --rolls-per-day 2
 *   node scripts/seed-oie-board.js --dry-run          (verifie le fichier sans rien ecrire)
 *
 * Aucune valeur par defaut ne pointe vers la production : la table doit etre
 * nommee explicitement, ou fournie par la variable OIE_BOARD_TABLE.
 */

const fs = require('fs');
const path = require('path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const FINISH_SQUARE = 63;
const OIE_SQUARES = [9, 18, 27, 36, 45, 54];
const SOUFFLEUR_SQUARES = [14, 39, 50, 60];
const LOGE_SQUARE = 19;
const PUITS_SQUARE = 31;
const PRISON_SQUARE = 52;
const MORT_SQUARE = 58;

/** Cases ou une equipe ne s'arrete jamais : elles n'ont pas besoin de question. */
const SQUARES_WITHOUT_QUESTION = [0, FINISH_SQUARE, MORT_SQUARE, ...OIE_SQUARES];

function squareType(squareNumber) {
  if (squareNumber === 0) return 'depart';
  if (squareNumber === FINISH_SQUARE) return 'arrivee';
  if (OIE_SQUARES.includes(squareNumber)) return 'oie';
  if (squareNumber === LOGE_SQUARE) return 'loge';
  if (squareNumber === PUITS_SQUARE) return 'puits';
  if (squareNumber === PRISON_SQUARE) return 'prison';
  if (squareNumber === MORT_SQUARE) return 'mort';
  if (SOUFFLEUR_SQUARES.includes(squareNumber)) return 'souffleur';
  return 'normale';
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function fail(message) {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
    return;
  }

  const filePath = path.resolve(args.file || path.join(__dirname, 'oie-board-2027.json'));
  if (!fs.existsSync(filePath)) fail(`fichier introuvable : ${filePath}`);

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    fail(`JSON illisible (${filePath}) : ${err.message}`);
  }

  if (!Array.isArray(payload.squares)) fail('le fichier doit contenir un tableau "squares"');

  const rollsPerDay = Number(args['rolls-per-day'] || payload.rollsPerDay || 1);
  if (!Number.isInteger(rollsPerDay) || rollsPerDay < 1 || rollsPerDay > 20) {
    fail('rollsPerDay doit etre un entier entre 1 et 20');
  }

  const enigmaId = (args['enigma-id'] || payload.enigmaId || '').trim();

  // Reconstruit les 64 cases : le fichier peut en omettre, le type ne vient
  // jamais du fichier mais toujours du numero de la case.
  const byNumber = new Map();
  payload.squares.forEach((square) => {
    if (!Number.isInteger(square.squareNumber) || square.squareNumber < 0 || square.squareNumber > FINISH_SQUARE) {
      fail(`numero de case invalide : ${JSON.stringify(square.squareNumber)}`);
    }
    if (byNumber.has(square.squareNumber)) {
      fail(`la case ${square.squareNumber} est definie deux fois`);
    }
    byNumber.set(square.squareNumber, square);
  });

  const squares = [];
  const manquantes = [];
  const indicesManquants = [];

  for (let squareNumber = 0; squareNumber <= FINISH_SQUARE; squareNumber += 1) {
    const source = byNumber.get(squareNumber) || {};
    const type = squareType(squareNumber);
    const acceptedAnswers = Array.isArray(source.acceptedAnswers)
      ? source.acceptedAnswers.map((answer) => String(answer).trim()).filter(Boolean)
      : [];
    const question = typeof source.question === 'string' ? source.question.trim() : '';

    if (!SQUARES_WITHOUT_QUESTION.includes(squareNumber) && (!question || acceptedAnswers.length === 0)) {
      manquantes.push(squareNumber);
    }

    if (type === 'souffleur' && !source.hint) {
      indicesManquants.push(squareNumber);
    }

    squares.push({
      squareNumber,
      type,
      ...(question ? { question } : {}),
      acceptedAnswers,
      ...(source.hint ? { hint: String(source.hint).trim() } : {}),
      ...(source.flavor ? { flavor: String(source.flavor).trim() } : {}),
    });
  }

  console.log(`Plateau lu : ${filePath}`);
  console.log(`  cases avec question : ${squares.filter((s) => s.question).length}`);
  console.log(`  lancers par jour    : ${rollsPerDay}`);
  console.log(`  enigmaId            : ${enigmaId || '(non defini, l\'arrivee ne marquera pas l\'enigme resolue)'}`);

  if (manquantes.length > 0) {
    console.log(`  ATTENTION, cases sans question : ${manquantes.join(', ')}`);
    console.log('  Une equipe qui s\'y arrete pourra relancer sans repondre.');
  }
  if (indicesManquants.length > 0) {
    console.log(`  ATTENTION, cases du souffleur sans indice : ${indicesManquants.join(', ')}`);
  }

  if (args['dry-run']) {
    console.log('\n--dry-run : rien n\'a ete ecrit.');
    return;
  }

  const table = args.table || process.env.OIE_BOARD_TABLE;
  if (!table) {
    fail('precisez la table avec --table <nom> ou la variable OIE_BOARD_TABLE');
  }

  const region = args.region || process.env.AWS_REGION || 'eu-west-1';
  if (args.profile) {
    process.env.AWS_PROFILE = args.profile;
  }

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

  await client.send(
    new PutCommand({
      TableName: table,
      Item: {
        boardId: 'default',
        squares,
        rollsPerDay,
        ...(enigmaId ? { enigmaId } : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: 'scripts/seed-oie-board.js',
      },
    })
  );

  console.log(`\nPlateau ecrit dans ${table} (region ${region}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
