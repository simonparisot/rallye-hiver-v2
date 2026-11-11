import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './FenetreLecture.css';

/**
 * Une fenêtre de lecture : un titre, un bouton pour fermer, et un texte qui
 * défile. C'est la coquille des règles du jeu (ReglesDuJeu) et des règles du
 * jeu de l'oie (src/oie/components/ReglesOie.tsx).
 *
 * Fenêtre plein écran sur téléphone, colonne de lecture centrée sur grand
 * écran. Le focus va au texte, qui défile au clavier ; Échap ferme, le
 * focus reste dans la fenêtre tant qu'elle est ouverte et revient ensuite à
 * ce qui l'a ouverte. Le défilement de la page est bloqué pendant ce temps.
 */

interface FenetreLectureProps {
  ouverte: boolean;
  onFermer: () => void;
  /** Le titre, affiché dans la tête et qui nomme la fenêtre. */
  titre: React.ReactNode;
  /** Identifiant du titre : unique dans la page. */
  idTitre: string;
  /** Nom accessible du bouton de fermeture. */
  libelleFermer: string;
  /**
   * Préfixe des data-testid : `<prefixe>-voile`, `<prefixe>-fermer`,
   * `<prefixe>-corps`. La fenêtre elle-même porte `testIdFenetre`.
   */
  prefixeTestId: string;
  testIdFenetre: string;
  /** Classe ajoutée à la fenêtre, pour une largeur ou un style propre. */
  classeFenetre?: string;
  /**
   * Où rendre le focus à la fermeture, quand ce qui a ouvert la fenêtre a
   * disparu entre-temps (le tiroir du téléphone se referme en l'ouvrant).
   * Par défaut, l'élément qui avait le focus à l'ouverture.
   */
  retourFocus?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

const SELECTEUR_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const FenetreLecture: React.FC<FenetreLectureProps> = ({
  ouverte,
  onFermer,
  titre,
  idTitre,
  libelleFermer,
  prefixeTestId,
  testIdFenetre,
  classeFenetre,
  retourFocus,
  children,
}) => {
  const fenetre = useRef<HTMLDivElement>(null);
  const corps = useRef<HTMLDivElement>(null);
  const surFermer = useRef(onFermer);
  surFermer.current = onFermer;

  useEffect(() => {
    if (!ouverte) return;
    const avant = document.activeElement as HTMLElement | null;
    const debordement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Le focus va au texte, pas au bouton « Fermer » : c'est ce qu'on vient
    // lire, et Flèche bas, Page suivante ou Fin le font alors défiler.
    corps.current?.focus();

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
      data-testid={`${prefixeTestId}-voile`}
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}
    >
      <div
        ref={fenetre}
        className={classeFenetre ? `regles-fenetre ${classeFenetre}` : 'regles-fenetre'}
        data-testid={testIdFenetre}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
      >
        <header className="regles-tete">
          <h2 id={idTitre}>{titre}</h2>
          <button
            type="button"
            className="regles-fermer"
            data-testid={`${prefixeTestId}-fermer`}
            onClick={onFermer}
            aria-label={libelleFermer}
          >
            ×
          </button>
        </header>
        <div
          ref={corps}
          className="regles-corps"
          data-testid={`${prefixeTestId}-corps`}
          tabIndex={0}
          role="region"
          aria-labelledby={idTitre}
        >
          <div className="regles-texte">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FenetreLecture;
