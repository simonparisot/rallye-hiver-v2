import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo, table, TABLES } from './aws.js';

/**
 * Mots de passe de fin de tournée, par identifiant de tournée.
 *
 * Comme la solution d'une énigme, l'API ne les donne jamais aux joueurs : les
 * scénarios qui valident une tournée les lisent en base. Ils ne doivent jamais
 * être écrits dans une sortie de test.
 */
export async function parcoursPasswords() {
  const parcours = await dynamo().send(new ScanCommand({
    TableName: table(TABLES.parcours),
  }));

  return new Map(
    (parcours.Items ?? [])
      .filter((p) => p.isActive && typeof p.correctPassword === 'string' && p.correctPassword.trim())
      .map((p) => [p.parcoursId, p.correctPassword])
  );
}

/** Mot de passe de la tournée publiée de ce numéro, ou `null`. */
export async function parcoursPasswordByNumber(parcoursNumber) {
  const parcours = await dynamo().send(new ScanCommand({
    TableName: table(TABLES.parcours),
  }));

  const tournee = (parcours.Items ?? []).find(
    (p) => p.isActive && p.parcoursNumber === parcoursNumber
  );
  const motDePasse = tournee?.correctPassword;
  return typeof motDePasse === 'string' && motDePasse.trim() ? motDePasse : null;
}
