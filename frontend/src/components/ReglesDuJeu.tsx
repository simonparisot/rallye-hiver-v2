import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { accorder, majuscule, useEdition, type Edition } from '../editions';
import './ReglesDuJeu.css';

/**
 * Les règles du jeu, dans une fenêtre qu'on ouvre depuis le panneau de
 * l'équipe et depuis le menu du téléphone.
 *
 * Le texte suit l'habillage affiché : sous l'habillage neutre, il ne doit
 * rien laisser deviner du thème. Tous les mots du jeu (énigme, parcours,
 * équipe, aide) passent donc par `useEdition().vocabulaire`, avec leurs
 * accords, et les dates viennent de l'édition. Rien ici ne doit être écrit
 * avec le vocabulaire d'un thème particulier.
 *
 * Fenêtre plein écran sur téléphone, colonne de lecture centrée sur grand
 * écran. Échap ferme, le focus reste dans la fenêtre tant qu'elle est
 * ouverte et revient ensuite à ce qui l'a ouverte.
 */

const FUSEAU = 'Europe/Paris';

/** « lundi 21 décembre 2026 à 21 h 50 », ou sans l'heure si l'édition n'en donne pas. */
function dateLongue(iso: string): string {
  const d = new Date(iso);
  const jour = d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: FUSEAU,
  });
  if (!iso.includes('T')) return jour;
  const parties = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: FUSEAU,
  }).formatToParts(d);
  const heure = Number(parties.find((p) => p.type === 'hour')?.value);
  const minute = parties.find((p) => p.type === 'minute')?.value;
  return `${jour} à ${heure}\u00a0h\u00a0${minute}`;
}

/** « trois mois », arrondi au mois. */
function duree(edition: Edition): string {
  const jours = (new Date(edition.endsAt).getTime() - new Date(edition.startsAt).getTime()) / 86400000;
  const mois = Math.max(1, Math.round(jours / 30.4));
  const enLettres = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six'][mois] ?? String(mois);
  return `${enLettres} mois`;
}

const ReglesContenu: React.FC = () => {
  const edition = useEdition();
  const v = edition.vocabulaire;
  const { enigme: E, parcours: P, equipe: T } = v;
  const S = v.souffleur;

  return (
    <>
      <section className="regles-section">
        <h3>Le principe</h3>
        <p>
          Chaque hiver, le Rallye d'Hiver vous fait découvrir Paris à travers un thème gardé
          secret jusqu'au lancement. Pendant {duree(edition)}, votre {T.singulier} résout
          des {E.pluriel} depuis chez {accorder(T, 'elle', 'lui')}, et part à la découverte
          de lieux de Paris en rapport avec le thème, en suivant des {P.pluriel}.
        </p>
        <p>
          Le {edition.label} se joue du {dateLongue(edition.startsAt)} (solstice d'hiver)
          au {dateLongue(edition.endsAt)} (équinoxe de printemps). Rien ne presse : avancez à
          votre rythme, les soirs, les week-ends, entre amis ou en famille.
        </p>
      </section>

      <section className="regles-section">
        <h3>Votre {T.singulier}</h3>
        <ul>
          <li>{majuscule(T.un)} compte en général de 2 à 7 personnes, sans limite stricte.</li>
          <li>
            Chacun s'inscrit avec sa propre adresse e-mail, puis crée {T.un} ou demande à en
            rejoindre {accorder(T, 'une', 'un')}. Le chef {T.du} accepte ou refuse les demandes
            depuis l'onglet « {v.monEquipe} ».
          </li>
          <li>
            La participation coûte 29 € par {T.singulier}, quel que soit le nombre de membres.
            Un seul paiement ouvre le jeu à tous les membres pour toute la durée du Rallye.
          </li>
          <li>
            Tout ce que fait un membre (mot de passe trouvé, {P.singulier}{' '}
            {accorder(P, 'validée', 'validé')}, indice obtenu) vaut pour toute {T.le}.
          </li>
        </ul>
      </section>

      <section className="regles-section">
        <h3>{majuscule(E.les)}</h3>
        <ul>
          <li>
            Le Rallye compte une vingtaine {E.dePluriel}, à télécharger en PDF depuis
            l'onglet « {E.Pluriel} ». {accorder(E, 'Elles', 'Ils')} se résolvent depuis chez
            vous, sans connaissance pointue : de la logique, de l'observation, de la
            communication entre vous, et une bonne dose de « et si j'essayais ça ? ».
          </li>
          <li>
            Chaque {E.singulier} mène à un mot de passe. Saisissez-le sous l'énoncé : le site
            vous dit aussitôt s'il est juste.
          </li>
          <li>
            Les majuscules, les accents, les espaces et la ponctuation ne comptent pas :
            « Hôtel de Ville », « hoteldeville » et « HÔTEL-DE-VILLE ! » sont équivalents.
          </li>
          <li>Les essais sont illimités.</li>
          <li>
            {majuscule(E.les)} sont de difficulté variable, et ne sont pas à résoudre dans
            l'ordre.
          </li>
        </ul>
      </section>

      <section className="regles-section">
        <h3>{majuscule(P.les)}</h3>
        <ul>
          <li>
            Une dizaine de lieux sont à visiter, dans Paris ou tout près : parcs, quartiers,
            musées, monuments… Chaque lieu se découvre en suivant {P.un}, un document à
            télécharger et à imprimer depuis l'onglet « {P.Pluriel} ».
          </li>
          <li>
            {majuscule(P.le)} vous donne le nom du lieu, guide votre marche et pose des
            questions en chemin.
          </li>
          <li>
            {accorder(P, 'Certaines', 'Certains')} {P.pluriel} s'ouvrent dès le début ;
            d'autres se débloquent dès que votre {T.singulier} a résolu{' '}
            {accorder(E, "l'une", "l'un")} des {E.pluriel} qui leur sont{' '}
            {accorder(E, 'associées', 'associés')}. {majuscule(P.un)}{' '}
            {accorder(P, 'verrouillée', 'verrouillé')} affiche la liste de ces {E.pluriel}.
          </li>
          <li>
            Au bout {P.du}, vous trouverez un mot de passe. Saisissez-le dans l'onglet
            « {P.Pluriel} » pour valider que votre {T.singulier} a bien fait {P.le}.
          </li>
        </ul>
      </section>

      <section className="regles-section">
        <h3>{majuscule(S.le)}</h3>
        <ul>
          <li>
            Bloqués sur {E.un} ? Sur {accorder(E, 'certaines', 'certains')} {E.pluriel},{' '}
            {S.le} peut vous débloquer. Décrivez-lui où vous en êtes : ce que vous avez
            essayé, trouvé, ce qui vous bloque. {accorder(S, 'Elle', 'Il')} choisit, parmi
            les indices préparés par les organisateurs, celui qui vous fera avancer sans tout
            dévoiler.
          </li>
          <li>Les indices obtenus restent affichés sous {E.le}.</li>
          <li>
            {majuscule(S.le)} n'est pas disponible sur {accorder(E, 'toutes', 'tous')}{' '}
            {E.les}, ni forcément dès le premier jour : les organisateurs l'ouvrent{' '}
            {E.singulier} par {E.singulier}.
          </li>
          <li>Les indices ne coûtent aucun point.</li>
        </ul>
      </section>

      <section className="regles-section">
        <h3>L'esprit du jeu</h3>
        <ul>
          <li>
            Le plaisir du Rallye, c'est de chercher. Ne partagez pas les mots de passe ni les
            solutions avec d'autres {T.pluriel}, et ne les publiez pas.
          </li>
          <li>
            Lors des {P.pluriel}, respectez les lieux, leurs horaires et les personnes qui y
            travaillent ou y vivent.
          </li>
        </ul>
      </section>
    </>
  );
};

interface ReglesDuJeuProps {
  ouverte: boolean;
  onFermer: () => void;
  /**
   * Où rendre le focus à la fermeture, quand ce qui a ouvert la fenêtre a
   * disparu entre-temps (le tiroir du téléphone se referme en l'ouvrant).
   * Par défaut, l'élément qui avait le focus à l'ouverture.
   */
  retourFocus?: React.RefObject<HTMLElement | null>;
}

const SELECTEUR_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ReglesDuJeu: React.FC<ReglesDuJeuProps> = ({ ouverte, onFermer, retourFocus }) => {
  const fenetre = useRef<HTMLDivElement>(null);
  const fermer = useRef<HTMLButtonElement>(null);
  const surFermer = useRef(onFermer);
  surFermer.current = onFermer;

  useEffect(() => {
    if (!ouverte) return;
    const avant = document.activeElement as HTMLElement | null;
    const debordement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    fermer.current?.focus();

    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        surFermer.current();
        return;
      }
      // Le focus reste dans la fenêtre : Tab et Maj+Tab bouclent.
      if (e.key === 'Tab' && fenetre.current) {
        const elements = Array.from(fenetre.current.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE));
        if (elements.length === 0) return;
        const premier = elements[0];
        const dernier = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === premier) {
          e.preventDefault();
          dernier.focus();
        } else if (!e.shiftKey && document.activeElement === dernier) {
          e.preventDefault();
          premier.focus();
        }
      }
    };
    document.addEventListener('keydown', auClavier);

    return () => {
      document.removeEventListener('keydown', auClavier);
      document.body.style.overflow = debordement;
      // La valeur du ref est lue à la fermeture exprès : c'est l'élément
      // présent à ce moment-là qui doit recevoir le focus.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const cible = avant && avant.isConnected && avant !== document.body ? avant : retourFocus?.current;
      cible?.focus();
    };
  }, [ouverte, retourFocus]);

  if (!ouverte) return null;

  return createPortal(
    <div
      className="regles-voile"
      data-testid="regles-voile"
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}
    >
      <div
        ref={fenetre}
        className="regles-fenetre"
        data-testid="regles-du-jeu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="regles-titre"
      >
        <header className="regles-tete">
          <h2 id="regles-titre">Règles du jeu</h2>
          <button
            ref={fermer}
            type="button"
            className="regles-fermer"
            data-testid="regles-fermer"
            onClick={onFermer}
            aria-label="Fermer les règles du jeu"
          >
            ×
          </button>
        </header>
        <div className="regles-corps" tabIndex={-1}>
          <div className="regles-texte">
            <ReglesContenu />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

/** Le bouton du panneau de l'équipe, avec sa fenêtre. */
export const BoutonReglesDuJeu: React.FC = () => {
  const [ouverte, setOuverte] = useState(false);
  return (
    <>
      <button
        type="button"
        className="regles-ouvrir"
        data-testid="regles-ouvrir"
        aria-haspopup="dialog"
        onClick={() => setOuverte(true)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5v14z" />
          <path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5" />
        </svg>
        Règles du jeu
      </button>
      <ReglesDuJeu ouverte={ouverte} onFermer={() => setOuverte(false)} />
    </>
  );
};

export default ReglesDuJeu;
