/**
 * Appels reseau du jeu de l'oie.
 *
 * On reutilise les instances axios de l'application (jeton, rafraichissement,
 * redirection sur 401) plutot que d'en creer une : un essai isole ne doit pas
 * signifier une authentification parallele.
 */

import { api } from '../services/api';
import { adminApi } from '../admin/services/adminAPI';
import {
  OieAnswerResponse,
  OieAdminTeam,
  OieBoardAdmin,
  OieBoardResponse,
  OiePrompterResponse,
  OieRollResponse,
  OieSquareAdmin,
} from './types';

export const oieAPI = {
  /** Plateau complet : cases, pions de toutes les equipes, ma carte, fil. */
  getBoard: async (): Promise<OieBoardResponse> => {
    const response = await api.get('/oie');
    return response.data;
  },

  /** Repondre a la question de ma case. */
  answer: async (answer: string): Promise<OieAnswerResponse> => {
    const response = await api.post('/oie/answer', { answer });
    return response.data;
  },

  /** Lancer les deux des. Les des sont tires par le serveur. */
  roll: async (): Promise<OieRollResponse> => {
    const response = await api.post('/oie/roll');
    return response.data;
  },

  /** Demander l'indice du souffleur sur une case qui en a un. */
  prompter: async (): Promise<OiePrompterResponse> => {
    const response = await api.post('/oie/prompter');
    return response.data;
  },
};

export const oieAdminAPI = {
  getBoard: async (): Promise<{ board: OieBoardAdmin }> => {
    const response = await adminApi.get('/oie/board');
    return response.data;
  },

  saveBoard: async (payload: {
    squares: OieSquareAdmin[];
    rollsPerDay: number;
    enigmaId?: string;
  }): Promise<{ board: OieBoardAdmin }> => {
    const response = await adminApi.put('/oie/board', payload);
    return response.data;
  },

  getTeams: async (): Promise<{
    teams: OieAdminTeam[];
    count: number;
    rollsPerDay: number;
    today: string;
  }> => {
    const response = await adminApi.get('/oie/teams');
    return response.data;
  },

  resetTeam: async (teamId: string): Promise<{ teamId: string; teamName: string; message: string }> => {
    const response = await adminApi.post(`/oie/teams/${teamId}/reset`);
    return response.data;
  },
};
