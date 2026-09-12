/**
 * Worker de choix d'indice, mode `queue`.
 *
 * Pourquoi il existe : l'essai se fait sans clé d'API. Le modèle est appelé par
 * l'abonnement Claude du commanditaire, via `claude -p`, depuis sa machine.
 * Un Lambda ne peut pas faire cela. La lambda se contente donc d'enregistrer la
 * demande en attente, et ce worker la traite.
 *
 * Ce qu'il ne fait pas : réécrire le prompt. Il importe `buildPrompt`,
 * `CONSIGNE_SYSTEME` et `selectHint` du service partagé, pour que ce que voit le
 * modèle soit identique dans les deux modes, et qu'une correction de prompt
 * profite aux deux.
 *
 * La parade au prompt hacking, ici, tient entièrement à `selectHint` : la
 * contrainte `tool_choice` de l'API n'existe pas en ligne de commande. Deux
 * remparts la remplacent, l'énumération du schéma JSON passé à `--json-schema`,
 * et surtout la vérification en TypeScript de l'identifiant renvoyé contre la
 * liste des indices disponibles. Le second suffit à lui seul.
 *
 * Lancement :
 *   cd backend
 *   AWS_PROFILE=rallye-test npx tsx scripts/hint-worker.ts --stage indices
 *
 * Options :
 *   --stage <nom>      Stage visé, qui donne le préfixe des tables (obligatoire,
 *                      sauf si --table et --enigmas-table sont fournies).
 *   --service <nom>    Nom de service, défaut `rallye-hiver-backend-<stage>`.
 *   --region <nom>     Défaut eu-west-1.
 *   --interval <sec>   Période de la boucle, défaut 5.
 *   --model <nom>      Modèle passé à `claude`. Par défaut, celui de l'abonnement.
 *   --once             Un seul tour, puis sortie. Pratique en vérification.
 *   --dry-run          Ne conclut rien en base, journalise seulement.
 */

import { spawn } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import {
  buildPrompt,
  CONSIGNE_SYSTEME,
  selectHint,
  HintSelectionError,
  HintSelectionInput,
  ModelCaller,
} from '../src/services/hintSelector';
import { EnigmaHint } from '../src/types';

// ---------------------------------------------------------------- Arguments

export interface Options {
  stage?: string;
  service?: string;
  table?: string;
  enigmasTable?: string;
  region: string;
  intervalMs: number;
  model?: string;
  once: boolean;
  dryRun: boolean;
}

export function lireArguments(argv: string[]): Options {
  const o: Options = { region: 'eu-west-1', intervalMs: 5000, once: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--stage') o.stage = argv[++i];
    else if (a === '--service') o.service = argv[++i];
    else if (a === '--table') o.table = argv[++i];
    else if (a === '--enigmas-table') o.enigmasTable = argv[++i];
    else if (a === '--region') o.region = argv[++i];
    else if (a === '--interval') o.intervalMs = Math.max(1, Number(argv[++i]) || 5) * 1000;
    else if (a === '--model') o.model = argv[++i];
    else if (a === '--once') o.once = true;
    else if (a === '--dry-run') o.dryRun = true;
    else throw new Error(`Option inconnue : ${a}`);
  }

  if (!o.table || !o.enigmasTable) {
    if (!o.stage) {
      throw new Error('Précisez --stage, ou bien --table et --enigmas-table.');
    }
    const service = o.service || `rallye-hiver-backend-${o.stage}`;
    o.table = o.table || `${service}-hint-requests`;
    o.enigmasTable = o.enigmasTable || `${service}-enigmas`;
  }

  return o;
}

// ------------------------------------------------------- Appel à `claude -p`

export interface ResultatClaude {
  /** Objet renvoyé par le modèle, déjà parsé. */
  sortie: any;
  /** Modèle réellement employé, tel que le rapporte la CLI. */
  modele: string;
  inputTokens?: number;
  outputTokens?: number;
}

export type ExecuteurClaude = (arg: {
  prompt: string;
  consigneSysteme: string;
  schema: object;
  model?: string;
}) => Promise<ResultatClaude>;

/**
 * Répertoire de travail du sous-processus : un dossier temporaire vide, hors du
 * dépôt. Sans cela `claude` découvrirait le CLAUDE.md du projet et les
 * paramètres locaux, qui n'ont rien à faire dans le choix d'un indice.
 */
let repertoireNeutre: string | null = null;
function dossierNeutre(): string {
  if (!repertoireNeutre) {
    repertoireNeutre = mkdtempSync(path.join(tmpdir(), 'souffleur-'));
  }
  return repertoireNeutre;
}

/** Implémentation réelle : `claude -p`, sans outil, en sortie JSON structurée. */
export const executerClaude: ExecuteurClaude = ({ prompt, consigneSysteme, schema, model }) =>
  new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--output-format', 'json',
      // Aucun outil : le modèle n'a rien d'autre à faire que choisir.
      '--tools', '',
      // Sans ces deux options, la CLI charge les skills et les serveurs MCP de la
      // machine : 105 000 jetons de contexte au lieu de 3 000, pour un appel qui
      // n'en a aucun usage.
      '--disable-slash-commands',
      '--strict-mcp-config',
      '--system-prompt', consigneSysteme,
      '--json-schema', JSON.stringify(schema),
    ];
    if (model) args.push('--model', model);

    const fils = spawn('claude', args, {
      cwd: dossierNeutre(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let sortieStd = '';
    let sortieErr = '';
    fils.stdout.on('data', (d) => { sortieStd += d.toString(); });
    fils.stderr.on('data', (d) => { sortieErr += d.toString(); });

    fils.on('error', (err) => reject(new Error(`Lancement de claude impossible : ${err.message}`)));

    fils.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`claude a terminé en erreur (code ${code}) : ${sortieErr.trim().slice(0, 300)}`));
        return;
      }
      let enveloppe: any;
      try {
        enveloppe = JSON.parse(sortieStd);
      } catch {
        reject(new Error(`Sortie de claude illisible : ${sortieStd.slice(0, 200)}`));
        return;
      }
      if (enveloppe.is_error) {
        reject(new Error(`claude signale une erreur : ${String(enveloppe.result).slice(0, 200)}`));
        return;
      }

      // `structured_output` est l'objet déjà validé contre le schéma. On retombe
      // sur `result`, qui est alors du texte à parser, si la CLI ne l'a pas posé.
      let sortie = enveloppe.structured_output;
      if (sortie === undefined) {
        try {
          sortie = JSON.parse(String(enveloppe.result));
        } catch {
          reject(new Error(`Réponse du modèle non JSON : ${String(enveloppe.result).slice(0, 200)}`));
          return;
        }
      }

      const modeles = Object.keys(enveloppe.modelUsage || {});
      resolve({
        sortie,
        // Le dernier modèle listé est celui de la conversation ; les autres sont
        // des modèles auxiliaires de la CLI.
        modele: model || modeles[modeles.length - 1] || 'inconnu',
        inputTokens: enveloppe.usage?.input_tokens,
        outputTokens: enveloppe.usage?.output_tokens,
      });
    });

    fils.stdin.write(prompt);
    fils.stdin.end();
  });

/** Schéma de sortie : l'énumération reprend les indices encore disponibles. */
export function schemaSortie(indices: EnigmaHint[]): object {
  return {
    type: 'object',
    properties: {
      hintId: {
        type: 'string',
        enum: indices.map((h) => h.id),
        description: "Identifiant de l'indice choisi.",
      },
      justification: {
        type: 'string',
        description: "En une ou deux phrases, pourquoi cet indice convient. Note interne.",
      },
    },
    required: ['hintId', 'justification'],
    additionalProperties: false,
  };
}

/** Rappel ajouté à la seconde tentative, quand la première a répondu à côté. */
export const RAPPEL_STRICT = [
  '',
  'ATTENTION. La réponse précédente était invalide.',
  "Tu dois répondre par un objet JSON et rien d'autre, de la forme exacte :",
  '{"hintId": "<un des identifiants listés ci-dessus>", "justification": "<une ou deux phrases>"}',
  "Le champ hintId doit être copié mot pour mot depuis la liste des indices encore",
  "disponibles. N'invente aucun identifiant, n'en reformate aucun, n'ajoute aucun texte",
  "avant ou après l'objet JSON.",
].join('\n');

/** Construit le `ModelCaller` que `selectHint` appellera. */
export function creerCaller(
  executeur: ExecuteurClaude,
  options: { model?: string; rappelStrict?: boolean } = {}
): ModelCaller {
  return async (input: HintSelectionInput) => {
    const prompt = buildPrompt(input) + (options.rappelStrict ? `\n${RAPPEL_STRICT}` : '');

    const resultat = await executeur({
      prompt,
      consigneSysteme: CONSIGNE_SYSTEME,
      schema: schemaSortie(input.availableHints),
      model: options.model,
    });

    const sortie = resultat.sortie;
    if (!sortie || typeof sortie !== 'object') {
      throw new HintSelectionError('Le modèle a renvoyé autre chose qu\'un objet');
    }
    if (typeof sortie.hintId !== 'string') {
      throw new HintSelectionError("Le modèle n'a pas renvoyé de champ hintId exploitable");
    }

    return {
      hintId: sortie.hintId,
      justification: typeof sortie.justification === 'string' ? sortie.justification : '',
      model: resultat.modele,
      inputTokens: resultat.inputTokens,
      outputTokens: resultat.outputTokens,
    };
  };
}

// ------------------------------------------------------------ Traitement

export interface Depots {
  demandesEnAttente: () => Promise<any[]>;
  prendreDemande: (requestId: string) => Promise<any | null>;
  conclureDemande: (requestId: string, updates: any) => Promise<any>;
  chargerEnigme: (enigmaId: string) => Promise<any>;
  demandesDeLEquipe: (teamId: string, enigmaId: string) => Promise<any[]>;
}

export interface ContexteTraitement {
  depots: Depots;
  executeur: ExecuteurClaude;
  model?: string;
  dryRun?: boolean;
  journal?: (message: string) => void;
}

function ordonnerIndices(hints: any): EnigmaHint[] {
  if (!Array.isArray(hints)) return [];
  return hints
    .filter((h: any) => h && typeof h.id === 'string' && typeof h.text === 'string')
    .map((h: any) => ({ id: h.id, order: Number(h.order) || 0, text: h.text }))
    .sort((a, b) => a.order - b.order);
}

export type Issue =
  | { issue: 'done'; hintId: string; justification: string; model: string }
  | { issue: 'failed'; raison: string }
  | { issue: 'ignoree'; raison: string };

/**
 * Traite une demande : prise du verrou, choix, conclusion.
 *
 * Une seule nouvelle tentative en cas de réponse invalide. Au-delà, l'obstination
 * coûterait plus qu'elle ne rapporte : la demande est marquée en échec, l'équipe
 * voit un message et peut redemander.
 */
export async function traiterDemande(demande: any, ctx: ContexteTraitement): Promise<Issue> {
  const log = ctx.journal || (() => {});

  const prise = await ctx.depots.prendreDemande(demande.requestId);
  if (!prise) {
    // Le passage pending -> processing a échoué : un autre worker l'a prise.
    return { issue: 'ignoree', raison: 'déjà prise par un autre worker' };
  }

  const conclure = async (updates: any) => {
    if (ctx.dryRun) {
      log(`    (simulation) ${JSON.stringify(updates.status)}`);
      return;
    }
    await ctx.depots.conclureDemande(demande.requestId, updates);
  };

  try {
    const enigme = await ctx.depots.chargerEnigme(demande.enigmaId);
    if (!enigme) {
      const raison = 'Énigme introuvable';
      await conclure({ status: 'failed', failureReason: raison, completedAt: new Date().toISOString() });
      return { issue: 'failed', raison };
    }

    const tous = ordonnerIndices(enigme.hints);
    const passees = await ctx.depots.demandesDeLEquipe(demande.teamId, demande.enigmaId);
    const idsDonnes = new Set(
      passees.filter((d: any) => d.status === 'done' && d.hintId).map((d: any) => d.hintId)
    );
    const dejaDonnes = tous.filter((h) => idsDonnes.has(h.id));
    const disponibles = tous.filter((h) => !idsDonnes.has(h.id));

    if (disponibles.length === 0) {
      const raison = 'Tous les indices de cette énigme ont déjà été donnés à cette équipe';
      await conclure({ status: 'failed', failureReason: raison, completedAt: new Date().toISOString() });
      return { issue: 'failed', raison };
    }

    const entree: HintSelectionInput = {
      enigmaTitle: enigme.title,
      enigmaDescription: enigme.description,
      solution: enigme.solution || '',
      correctPassword: enigme.correctPassword,
      availableHints: disponibles,
      alreadyGivenHints: dejaDonnes,
      progressText: demande.progressText,
    };

    let choix;
    try {
      choix = await selectHint(entree, creerCaller(ctx.executeur, { model: ctx.model }));
    } catch (premiere: any) {
      log(`    première tentative refusée : ${premiere.message}`);
      log('    seconde tentative, avec rappel strict');
      choix = await selectHint(
        entree,
        creerCaller(ctx.executeur, { model: ctx.model, rappelStrict: true })
      );
    }

    await conclure({
      status: 'done',
      hintId: choix.hint.id,
      hintText: choix.hint.text,
      justification: choix.justification,
      model: choix.model,
      inputTokens: choix.inputTokens ?? 0,
      outputTokens: choix.outputTokens ?? 0,
      completedAt: new Date().toISOString(),
    });

    return {
      issue: 'done',
      hintId: choix.hint.id,
      justification: choix.justification,
      model: choix.model,
    };
  } catch (err: any) {
    const raison =
      err instanceof HintSelectionError
        ? err.message
        : `Erreur inattendue : ${err?.message || err}`;
    await conclure({
      status: 'failed',
      failureReason: raison.slice(0, 500),
      completedAt: new Date().toISOString(),
    });
    return { issue: 'failed', raison };
  }
}

/** Un tour de boucle. Renvoie le nombre de demandes traitées. */
export async function unTour(ctx: ContexteTraitement): Promise<number> {
  const log = ctx.journal || (() => {});
  const attente = await ctx.depots.demandesEnAttente();
  if (attente.length === 0) return 0;

  log(`${horodatage()} ${attente.length} demande(s) en attente`);

  let traitees = 0;
  for (const demande of attente) {
    log(`  → ${demande.requestId} (équipe ${demande.teamId}, énigme ${demande.enigmaId})`);
    log(`    avancement : ${apercu(demande.progressText)}`);
    const debut = Date.now();
    const issue = await traiterDemande(demande, ctx);
    const duree = ((Date.now() - debut) / 1000).toFixed(1);

    if (issue.issue === 'done') {
      log(`    indice ${issue.hintId} choisi en ${duree} s par ${issue.model}`);
      log(`    justification : ${apercu(issue.justification, 300)}`);
      traitees += 1;
    } else if (issue.issue === 'failed') {
      log(`    ÉCHEC après ${duree} s : ${issue.raison}`);
      traitees += 1;
    } else {
      log(`    ignorée : ${issue.raison}`);
    }
  }
  return traitees;
}

function apercu(texte: string, taille = 160): string {
  const plat = String(texte || '').replace(/\s+/g, ' ').trim();
  return plat.length > taille ? `${plat.slice(0, taille)}…` : plat;
}

function horodatage(): string {
  return new Date().toLocaleTimeString('fr-FR');
}

// ------------------------------------------------------------------- Main

async function main() {
  const options = lireArguments(process.argv.slice(2));

  // Les noms de tables sont lus à l'import du module DynamoDB : il faut donc les
  // poser avant, et charger le module dynamiquement.
  process.env.HINT_REQUESTS_TABLE = options.table;
  process.env.ENIGMAS_TABLE = options.enigmasTable;
  process.env.COGNITO_REGION = options.region;

  const db = await import('../src/utils/dynamodb');

  const depots: Depots = {
    demandesEnAttente: () => db.scanPendingHintRequests(25),
    prendreDemande: (id) => db.claimHintRequest(id),
    conclureDemande: (id, updates) => db.completeHintRequest(id, updates),
    chargerEnigme: (id) => db.getEnigmaById(id),
    demandesDeLEquipe: (teamId, enigmaId) => db.getHintRequestsByTeamAndEnigma(teamId, enigmaId),
  };

  const ctx: ContexteTraitement = {
    depots,
    executeur: executerClaude,
    model: options.model,
    dryRun: options.dryRun,
    journal: (m) => console.log(m),
  };

  console.log('Souffleur du Rallye d\'Hiver');
  console.log(`  table    : ${options.table}`);
  console.log(`  énigmes  : ${options.enigmasTable}`);
  console.log(`  région   : ${options.region}`);
  console.log(`  profil   : ${process.env.AWS_PROFILE || '(défaut)'}`);
  console.log(`  modèle   : ${options.model || "celui de l'abonnement"}`);
  console.log(`  période  : ${options.intervalMs / 1000} s`);
  if (options.dryRun) console.log('  MODE SIMULATION : rien ne sera écrit en base');
  console.log('');

  if (options.once) {
    const n = await unTour(ctx);
    console.log(n === 0 ? 'Rien en attente.' : `${n} demande(s) traitée(s).`);
    return;
  }

  let arret = false;
  process.on('SIGINT', () => {
    console.log('\nArrêt demandé, fin du tour en cours.');
    arret = true;
  });

  console.log('En écoute. Ctrl+C pour arrêter.');
  while (!arret) {
    try {
      await unTour(ctx);
    } catch (err: any) {
      // Une panne passagère (réseau, AWS) ne doit pas tuer le worker : il
      // journalise et retente au tour suivant.
      console.error(`${horodatage()} tour en échec : ${err?.message || err}`);
    }
    if (arret) break;
    await new Promise((r) => setTimeout(r, options.intervalMs));
  }
  console.log('Arrêté.');
}

// Ne s'exécute que lancé directement, pas à l'import par les tests.
if (require.main === module) {
  main().catch((err) => {
    console.error('Échec :', err.message);
    process.exit(1);
  });
}
