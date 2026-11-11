import { useEffect, useLayoutEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gameAPI } from './api';
import { GamePhase } from '../types';
import { editionOfficielle, setThemeOfficiel } from '../editions';
import { useAuth } from '../contexts/AuthContext';

/**
 * Statut du jeu, tel que le serveur le calcule (GET /game/status) : phase,
 * heure de lancement, thème officiel débloqué pour l'utilisateur connecté.
 *
 * Le serveur est la seule source de vérité : le frontend ne recalcule ni la
 * phase ni le déblocage, il les affiche. Même clé de cache partout
 * (`['gameStatus']`, lue aussi par la page du jeu de l'oie) : une seule
 * requête, relancée chaque minute pour suivre le lancement à l'heure dite.
 */
export const CLE_STATUT_JEU = ['gameStatus'];

export function useStatutJeu() {
  return useQuery({
    queryKey: CLE_STATUT_JEU,
    queryFn: () => gameAPI.getStatus(),
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * La phase à retenir quand le serveur n'a pas (encore) répondu : celle que
 * donne l'heure de l'édition. Le serveur reste juge de ce qu'il sert.
 */
export function phaseParDefaut(): GamePhase {
  return Date.now() >= Date.parse(editionOfficielle.startsAt) ? 'lance' : 'avant-lancement';
}

/** « lundi 21 décembre 2026 à 21 h 50 », à l'heure de Paris. */
export function formaterLancement(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const jour = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  });
  const heure = date
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
    .replace(':', ' h ');
  return `${jour} à ${heure}`;
}

/** Les listes du joueur, qui changent du tout au tout au lancement. */
const LISTES_DU_JEU = [
  ['enigmas-with-progress'],
  ['enigmas-preview'],
  ['parcours-with-access'],
  ['parcours-preview'],
  ['team-stats'],
];

/**
 * Règle de déblocage du thème, côté affichage (voir editions/index.ts) :
 * applique `themeOfficiel` tel que le serveur le donne, au chargement, à
 * chaque relecture du statut et au changement d'utilisateur ou d'équipe. La
 * déconnexion est traitée dans AuthContext ; la bonne réponse à une
 * préliminaire, dans EnigmasPanel.
 *
 * Quand la phase change (lancement à l'heure dite, ou par l'orga), les listes
 * d'intrigues et de tournées sont rechargées : les préliminaires
 * disparaissent, les vraies intrigues apparaissent.
 *
 * Composant sans rendu, monté sous chaque AuthProvider (App.tsx).
 */
export function SynchroStatutJeu(): null {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useStatutJeu();

  // Avant la peinture : le thème change dans la même image que le contenu
  // qui l'attendait, sans flash de l'un ou de l'autre habillage.
  const themeOfficiel = data?.themeOfficiel;
  useLayoutEffect(() => {
    if (themeOfficiel !== undefined) setThemeOfficiel(themeOfficiel);
  }, [themeOfficiel]);

  const phase = data?.phase;
  const phasePrecedente = useRef<GamePhase | undefined>(undefined);
  useEffect(() => {
    if (!phase) return;
    if (phasePrecedente.current && phasePrecedente.current !== phase) {
      LISTES_DU_JEU.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    }
    phasePrecedente.current = phase;
  }, [phase, queryClient]);

  // Rejoindre ou quitter une équipe change le déblocage : on relit le statut.
  const equipe = user?.teamId ?? null;
  const equipePrecedente = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (equipePrecedente.current !== undefined && equipePrecedente.current !== equipe) {
      queryClient.invalidateQueries({ queryKey: CLE_STATUT_JEU });
    }
    equipePrecedente.current = equipe;
  }, [equipe, queryClient]);

  return null;
}
