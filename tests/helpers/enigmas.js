import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo, table, TABLES } from './aws.js';

/**
 * Lecture de la solution d'une énigme.
 *
 * L'API ne l'expose jamais — c'est justement ce que vérifient les tests. Les
 * scénarios qui doivent soumettre une bonne réponse la lisent donc directement
 * en base. Elle ne doit jamais être écrite dans une sortie de test.
 */
export async function enigmaWithSolution() {
  const enigmas = await dynamo().send(new ScanCommand({
    TableName: table(TABLES.enigmas),
  }));

  const utilisable = (enigmas.Items ?? [])
    .filter((e) => e.isActive && e.correctPassword)
    .sort((a, b) => a.enigmaNumber - b.enigmaNumber)[0];

  if (!utilisable) {
    throw new Error('Aucune énigme active avec solution dans cet environnement.');
  }

  return {
    enigmaId: utilisable.enigmaId,
    enigmaNumber: utilisable.enigmaNumber,
    title: utilisable.title,
    solution: utilisable.correctPassword,
  };
}
