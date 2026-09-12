import React, { useEffect, useRef } from 'react';
import './ResultatTentative.css';

interface ResultatTentativeProps {
  /** Message renvoyé par le serveur. Null tant qu'aucune réponse n'a été soumise. */
  message: string | null;
  /** Vrai si la réponse était la bonne. */
  reussi: boolean;
  onFermer: () => void;
}

/**
 * Annonce le résultat d'une tentative de mot de passe.
 *
 * Le message s'affichait auparavant sous le formulaire, où il se confondait
 * avec le reste de la page — sur une action que l'on répète des dizaines de
 * fois, savoir immédiatement si l'on a trouvé compte plus que tout.
 *
 * Trois façons de refermer, parce qu'on referme souvent : la croix, un clic à
 * côté, la touche d'échappement.
 */
const ResultatTentative: React.FC<ResultatTentativeProps> = ({ message, reussi, onFermer }) => {
  const boutonFermer = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!message) return;

    // Le focus vient sur la fermeture : au clavier, refermer ne doit pas
    // demander de traverser la page.
    boutonFermer.current?.focus();

    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [message, onFermer]);

  if (!message) return null;

  return (
    <div
      className="resultat-voile"
      data-testid="enigma-attempt-overlay"
      onClick={onFermer}
      role="presentation"
    >
      <div
        className={`resultat ${reussi ? 'resultat-reussi' : 'resultat-manque'}`}
        // Le testid dépend de l'issue : c'est sur lui que reposent les tests
        // qui vérifient qu'une bonne réponse est acceptée et une mauvaise refusée.
        data-testid={reussi ? 'enigma-attempt-success' : 'enigma-attempt-error'}
        role="alertdialog"
        aria-modal="true"
        aria-label={reussi ? 'Bonne réponse' : 'Réponse incorrecte'}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={boutonFermer}
          type="button"
          className="resultat-fermer"
          data-testid="enigma-attempt-close"
          onClick={onFermer}
          aria-label="Fermer"
        >
          ×
        </button>

        <p className="resultat-titre">{reussi ? 'Bravo' : 'Ce n’est pas ça'}</p>
        <p className="resultat-message">{message}</p>

        <button type="button" className="resultat-action" onClick={onFermer}>
          {reussi ? 'Continuer' : 'Réessayer'}
        </button>
      </div>
    </div>
  );
};

export default ResultatTentative;
