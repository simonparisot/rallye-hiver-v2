import { normalizePassword } from './password';
import { NearMiss } from '../types';

/**
 * « Presque bons » mots de passe d'une intrigue.
 *
 * L'organisateur prévoit les réponses d'une équipe qui chauffe — une étape
 * intermédiaire, une fausse piste plausible — et le message qu'elle reçoit à
 * la place du message de refus tiré au hasard. L'intrigue n'est pas résolue.
 *
 * La comparaison est celle du vrai mot de passe (utils/password) : casse,
 * accents, espaces et ponctuation ne comptent pas.
 *
 * Ces listes ne sortent jamais vers les joueurs : seul /admin/enigmas les
 * renvoie.
 */

export const NEAR_MISS_PASSWORD_MAX = 100;
export const NEAR_MISS_MESSAGE_MAX = 500;

/**
 * Le « presque bon » qui correspond à la saisie, s'il y en a un. Une liste
 * absente ou mal formée ne correspond à rien.
 */
export function trouverNearMiss(saisie: string, nearMisses: unknown): NearMiss | undefined {
  if (!Array.isArray(nearMisses)) return undefined;
  const cle = normalizePassword(saisie);
  if (cle === '') return undefined;
  return nearMisses.find(
    (n: any) =>
      n && typeof n.password === 'string' && typeof n.message === 'string' && normalizePassword(n.password) === cle
  );
}

/**
 * Valide la liste telle qu'elle arrive du formulaire d'administration et
 * renvoie ce qu'il faut écrire (champs rognés).
 *
 * Les doublons (même forme normalisée) sont refusés plutôt que fusionnés :
 * deux lignes « Tour Eiffel » et « tour-eiffel » avec deux messages différents
 * ne se fusionnent pas sans jeter l'un des deux textes de l'organisateur, et
 * seul le premier serait jamais servi. Une erreur qui nomme les deux saisies
 * lui laisse le choix.
 */
export function lireNearMisses(
  brut: unknown,
  correctPassword: unknown
): { valeur: NearMiss[]; erreur?: string } {
  if (brut === null) return { valeur: [] };
  if (!Array.isArray(brut)) {
    return { valeur: [], erreur: 'nearMisses doit être une liste' };
  }

  const valeur: NearMiss[] = [];
  const vus = new Map<string, string>();

  for (let i = 0; i < brut.length; i += 1) {
    const ligne = brut[i];
    const rang = `Presque bon n° ${i + 1}`;
    if (!ligne || typeof ligne !== 'object') {
      return { valeur: [], erreur: `${rang} : ligne invalide` };
    }
    const { password, message } = ligne as any;
    if (typeof password !== 'string' || typeof message !== 'string') {
      return { valeur: [], erreur: `${rang} : mot de passe et message doivent être du texte` };
    }
    const mot = password.trim();
    const texte = message.trim();
    if (!mot) return { valeur: [], erreur: `${rang} : mot de passe vide` };
    if (!texte) return { valeur: [], erreur: `${rang} : message vide` };
    if (mot.length > NEAR_MISS_PASSWORD_MAX) {
      return { valeur: [], erreur: `${rang} : mot de passe trop long (${NEAR_MISS_PASSWORD_MAX} caractères au plus)` };
    }
    if (texte.length > NEAR_MISS_MESSAGE_MAX) {
      return { valeur: [], erreur: `${rang} : message trop long (${NEAR_MISS_MESSAGE_MAX} caractères au plus)` };
    }

    const cle = normalizePassword(mot);
    if (cle === '') {
      return { valeur: [], erreur: `${rang} : « ${mot} » ne contient ni lettre ni chiffre` };
    }
    const precedent = vus.get(cle);
    if (precedent !== undefined) {
      return { valeur: [], erreur: `${rang} : « ${mot} » fait doublon avec « ${precedent} »` };
    }
    vus.set(cle, mot);
    valeur.push({ password: mot, message: texte });
  }

  const conflit = conflitAvecMotDePasse(valeur, correctPassword);
  if (conflit) return { valeur: [], erreur: conflit };

  return { valeur };
}

/**
 * Un « presque bon » égal au vrai mot de passe (une fois normalisé) ne serait
 * jamais servi : le vrai est vérifié d'abord. On le refuse pour que
 * l'organisateur ne croie pas avoir prévu un message qui ne s'affichera pas.
 */
export function conflitAvecMotDePasse(nearMisses: unknown, correctPassword: unknown): string | undefined {
  if (!Array.isArray(nearMisses) || typeof correctPassword !== 'string') return undefined;
  const vrai = normalizePassword(correctPassword);
  if (vrai === '') return undefined;
  const fautif = nearMisses.find(
    (n: any) => n && typeof n.password === 'string' && normalizePassword(n.password) === vrai
  );
  return fautif
    ? `« ${fautif.password} » est le mot de passe de l'intrigue : il ne peut pas être un presque bon`
    : undefined;
}
