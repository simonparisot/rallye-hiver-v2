/**
 * Shared plumbing of the four player endpoints: who is calling, which team,
 * and the sentences of the event feed.
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { getTeamById, getUserById } from '../../utils/dynamodb';
import { OieMoveEffect } from '../../types/oie';

export interface OiePlayerContext {
  userId: string;
  teamId: string;
  teamName: string;
}

/** Refusal of a player endpoint: a message and the status to answer with. */
export class OieAccessError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'OieAccessError';
    this.statusCode = statusCode;
  }
}

/**
 * Same guard as the rest of the game: authenticated, in a team, team paid.
 * The jeu de l'oie is one of the twenty enigmas, it is not more open than them.
 */
export async function requirePlayer(event: APIGatewayProxyEvent): Promise<OiePlayerContext> {
  const userId = event.requestContext.authorizer?.userId;

  if (!userId) {
    throw new OieAccessError('Unauthorized', 401);
  }

  const user = await getUserById(userId);
  if (!user || !user.teamId) {
    throw new OieAccessError('Vous devez appartenir à une équipe pour jouer au jeu de l\'oie', 403);
  }

  const team = await getTeamById(user.teamId);
  if (!team) {
    throw new OieAccessError('Équipe introuvable', 404);
  }

  if (!team.hasPaid) {
    throw new OieAccessError('Votre équipe doit avoir réglé son inscription', 403);
  }

  return { userId, teamId: team.teamId, teamName: team.teamName };
}

// ==================== NARRATION ====================

/**
 * Turns one move effect into the sentence shown in the shared feed.
 * Returns null for the steps that are not worth a line of their own.
 */
export function narrateEffect(teamName: string, effect: OieMoveEffect): string | null {
  switch (effect.kind) {
    case 'avance':
      return null; // le deplacement est deja resume par la ligne du lancer
    case 'oie':
      return `${teamName} tombe sur l'acteur et son oie en case ${effect.at} et rejoue`;
    case 'rebond':
      return `${teamName} dépasse la case 63 de ${effect.depassement} et recule en case ${effect.to}`;
    case 'metteur_en_scene':
      return `Le metteur en scène place ${teamName} directement en case 63`;
    case 'mort':
      return `${teamName} tombe sur la répétition en case ${effect.from} et repart de la case 0`;
    case 'puits':
      return `${teamName} tombe dans le puits en case ${effect.at}`;
    case 'prison':
      return `${teamName} est enfermé dans la prison en case ${effect.at}`;
    case 'loge':
      return `${teamName} s'attarde dans la loge en case ${effect.at} et passe un tour`;
    case 'souffleur':
      return `${teamName} arrive sur une case du souffleur en case ${effect.at}`;
    case 'arrivee':
      return `${teamName} arrive en case 63`;
    default:
      return null;
  }
}
