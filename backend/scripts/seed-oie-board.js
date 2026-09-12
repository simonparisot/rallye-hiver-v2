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
 * Sur un environnement neuf, l'enigme ordinaire qui porte le jeu de l'oie
 * n'existe pas encore. --create-enigma la cree et rattache le plateau a son
 * identifiant, ce qui evite d'avoir a passer par le back-office pour amorcer :
 *
 *   node scripts/seed-oie-board.js --profile rallye-test \
 *     --table rallye-hiver-backend-oie-oie-board \
 *     --enigmas-table rallye-hiver-backend-oie-enigmas \
 *     --create-enigma --enigma-number 7
 *
 * Aucune valeur par defaut ne pointe vers la production : la table doit etre
 * nommee explicitement, ou fournie par la variable OIE_BOARD_TABLE.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

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
    fail('rollsPerDay doit être un entier entre 1 et 20');
  }

  const enigmaId = (args['enigma-id'] || payload.enigmaId || '').trim();

  // Reconstruit les 64 cases : le fichier peut en omettre, le type ne vient
  // jamais du fichier mais toujours du numero de la case.
  const byNumber = new Map();
  payload.squares.forEach((square) => {
    if (!Number.isInteger(square.squareNumber) || square.squareNumber < 0 || square.squareNumber > FINISH_SQUARE) {
      fail(`numéro de case invalide : ${JSON.stringify(square.squareNumber)}`);
    }
    if (byNumber.has(square.squareNumber)) {
      fail(`la case ${square.squareNumber} est définie deux fois`);
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
  console.log(`  enigmaId            : ${enigmaId || '(non défini, l\'arrivée ne marquera pas l\'énigme résolue)'}`);

  if (manquantes.length > 0) {
    console.log(`  ATTENTION, cases sans question : ${manquantes.join(', ')}`);
    console.log('  Une équipe qui s\'y arrête pourra relancer sans répondre.');
  }
  if (indicesManquants.length > 0) {
    console.log(`  ATTENTION, cases du souffleur sans indice : ${indicesManquants.join(', ')}`);
  }

  if (args['dry-run']) {
    console.log('\n--dry-run : rien n\'a été écrit.');
    return;
  }

  const table = args.table || process.env.OIE_BOARD_TABLE;
  if (!table) {
    fail('précisez la table avec --table <nom> ou la variable OIE_BOARD_TABLE');
  }

  const region = args.region || process.env.AWS_REGION || 'eu-west-1';
  if (args.profile) {
    process.env.AWS_PROFILE = args.profile;
  }

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

  let enigmaIdFinal = enigmaId;

  if (args['create-enigma']) {
    const enigmasTable = args['enigmas-table'] || process.env.ENIGMAS_TABLE;
    if (!enigmasTable) {
      fail('--create-enigma exige --enigmas-table <nom> (ou la variable ENIGMAS_TABLE)');
    }
    enigmaIdFinal = await ensureEnigma(client, enigmasTable, {
      enigmaId: enigmaIdFinal,
      enigmaNumber: Number(args['enigma-number'] || 1),
      title: args['enigma-title'] || "Le jeu de l'oie du théâtre",
    });
  }

  await client.send(
    new PutCommand({
      TableName: table,
      Item: {
        boardId: 'default',
        squares,
        rollsPerDay,
        ...(enigmaIdFinal ? { enigmaId: enigmaIdFinal } : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: 'scripts/seed-oie-board.js',
      },
    })
  );

  console.log(`\nPlateau écrit dans ${table} (région ${region}).`);
  if (enigmaIdFinal) {
    console.log(`enigmaId du plateau : ${enigmaIdFinal}`);
    console.log('Côté frontend, poser REACT_APP_OIE_ENIGMA_ID avec cette valeur');
    console.log('pour que l\'entrée de la liste des énigmes mène au plateau.');
  }
}

/**
 * Cree l'enigme ordinaire qui porte le jeu de l'oie, si elle n'existe pas deja.
 *
 * Elle n'a ni PDF ni mot de passe utile : c'est le plateau qui la resout. Mais
 * elle doit exister comme les dix-neuf autres pour que le classement et les
 * statistiques la comptent sans traitement particulier.
 *
 * Idempotent : une enigme deja marquee `isOieBoard` est reutilisee telle quelle.
 */
async function ensureEnigma(client, enigmasTable, { enigmaId, enigmaNumber, title }) {
  const existantes = await client.send(new ScanCommand({ TableName: enigmasTable }));
  const deja = (existantes.Items || []).find(
    (enigme) => enigme.isOieBoard === true || (enigmaId && enigme.enigmaId === enigmaId)
  );

  if (deja) {
    console.log(`Énigme du jeu de l'oie déjà présente : ${deja.enigmaId} (« ${deja.title} »)`);
    return deja.enigmaId;
  }

  const now = new Date().toISOString();
  const item = {
    enigmaId: enigmaId || crypto.randomUUID(),
    enigmaNumber,
    title,
    description:
      "Une des vingt énigmes, jouée sur un plateau de jeu de l'oie partagé par toutes les équipes.",
    // Ni enonce ni mot de passe : la resolution vient de l'arrivee en case 63.
    pdfUrl: '',
    correctPassword: '',
    points: 0,
    isActive: true,
    // Marqueur du script, pour rester idempotent sans deviner sur le titre.
    isOieBoard: true,
    createdAt: now,
    updatedAt: now,
  };

  await client.send(new PutCommand({ TableName: enigmasTable, Item: item }));
  console.log(`Énigme du jeu de l'oie créée : ${item.enigmaId} (numéro ${enigmaNumber})`);

  return item.enigmaId;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
