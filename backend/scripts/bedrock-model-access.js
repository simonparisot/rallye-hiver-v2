#!/usr/bin/env node
/**
 * Active l'accès aux modèles Anthropic sur Amazon Bedrock pour un compte AWS.
 *
 * Ce que la console fait en trois écrans, en une commande : dépôt du
 * formulaire de cas d'usage exigé par Anthropic (une fois par compte),
 * acceptation de l'offre Marketplace de chaque modèle, attente que l'accord
 * soit actif, puis un appel réel pour vérifier que le compte peut invoquer.
 *
 *   node scripts/bedrock-model-access.js --profile rallye
 *   node scripts/bedrock-model-access.js --profile rallye-test --models anthropic.claude-sonnet-5
 *
 * Idempotent : un formulaire déjà déposé et un accord déjà actif sont laissés
 * tels quels. Le nom de la région ne change rien à l'accord (il est au niveau
 * du compte) mais sert à l'appel de vérification.
 *
 * Si l'appel final répond « not available for this account » alors que
 * l'accord est AVAILABLE, c'est une restriction d'AWS sur le compte lui-même
 * (comptes récents) : seuls le support ou le commercial AWS la lèvent.
 */
const { BedrockClient, PutUseCaseForModelAccessCommand, GetUseCaseForModelAccessCommand,
  ListFoundationModelAgreementOffersCommand, CreateFoundationModelAgreementCommand,
  GetFoundationModelAvailabilityCommand } = require('@aws-sdk/client-bedrock');
const { AnthropicBedrockMantle } = require('@anthropic-ai/bedrock-sdk');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));

if (args.profile) process.env.AWS_PROFILE = args.profile;
const region = args.region || 'eu-west-1';
const modeles = (args.models ? String(args.models).split(',') : ['anthropic.claude-sonnet-5', 'anthropic.claude-opus-5']);

// Le formulaire décrit honnêtement l'usage : les valeurs de liste sont celles
// que l'API accepte (intendedUsers « 1 » = utilisateurs externes).
const FORMULAIRE = {
  companyName: "Rallye d'Hiver",
  companyWebsite: 'https://rallyehiver.fr',
  intendedUsers: '1',
  industryOption: 'Other',
  otherIndustryOption: "Association, jeu d'énigmes",
  useCases:
    "Jeu d'énigmes annuel organisé par une association (rallyehiver.fr). Le modèle choisit, " +
    "parmi une liste d'indices pré-écrits par les organisateurs, l'indice le plus adapté à " +
    "l'avancement décrit par une équipe de joueurs. Sortie contrainte à un identifiant, aucun " +
    "texte généré n'est montré aux joueurs. Quelques milliers de requêtes par an.",
};

const dodo = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const bedrock = new BedrockClient({ region });

  try {
    await bedrock.send(new GetUseCaseForModelAccessCommand({}));
    console.log('Formulaire de cas d\'usage : déjà déposé');
  } catch (e) {
    if (e.name !== 'ResourceNotFoundException') throw e;
    await bedrock.send(new PutUseCaseForModelAccessCommand({ formData: Buffer.from(JSON.stringify(FORMULAIRE)) }));
    console.log('Formulaire de cas d\'usage : déposé');
  }

  for (const modelId of modeles) {
    const etat = await bedrock.send(new GetFoundationModelAvailabilityCommand({ modelId }));
    if (etat.agreementAvailability?.status === 'AVAILABLE') {
      console.log(`${modelId} : accord déjà actif`);
      continue;
    }
    const offres = await bedrock.send(new ListFoundationModelAgreementOffersCommand({ modelId }));
    if (!offres.offers?.length) throw new Error(`${modelId} : aucune offre Marketplace disponible`);
    await bedrock.send(new CreateFoundationModelAgreementCommand({ modelId, offerToken: offres.offers[0].offerToken }));
    console.log(`${modelId} : accord demandé`);
  }

  for (let i = 0; i < 20; i++) {
    const etats = {};
    for (const modelId of modeles) {
      const a = await bedrock.send(new GetFoundationModelAvailabilityCommand({ modelId }));
      etats[modelId] = a.agreementAvailability?.status;
    }
    console.log(new Date().toISOString().slice(11, 19), JSON.stringify(etats));
    if (Object.values(etats).every((s) => s === 'AVAILABLE')) break;
    await dodo(30000);
  }

  // L'accord actif met parfois une minute à être visible par l'inférence.
  await dodo(60000);
  const client = new AnthropicBedrockMantle({ awsRegion: region });
  let succes = 0;
  for (const model of modeles) {
    const debut = Date.now();
    try {
      const r = await client.messages.create({ model, max_tokens: 30, messages: [{ role: 'user', content: 'Réponds juste : ok' }] });
      console.log(`APPEL OK    ${model} (${((Date.now() - debut) / 1000).toFixed(1)} s, ${JSON.stringify(r.usage)})`);
      succes++;
    } catch (e) {
      const message = (e.error && e.error.error && e.error.error.message) || e.message;
      console.log(`APPEL ÉCHEC ${model} : ${e.status || ''} ${String(message).slice(0, 160)}`);
    }
  }
  process.exit(succes === modeles.length ? 0 : 1);
}

main().catch((e) => {
  console.error('ERREUR', e.name, e.message);
  process.exit(1);
});
