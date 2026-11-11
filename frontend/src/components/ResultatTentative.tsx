import React, { useEffect, useRef } from 'react';
import './ResultatTentative.css';

interface ResultatTentativeProps {
  /** Message renvoyé par le serveur. Null tant qu'aucune réponse n'a été soumise. */
  message: string | null;
  /** Vrai si la réponse était la bonne. */
  reussi: boolean;
  /**
   * Vrai si la réponse, fausse, est un « presque bon » prévu par l'orga :
   * l'annonce prend le ton « vous chauffez » et affiche son message.
   */
  chauffe?: boolean;
  onFermer: () => void;
  /**
   * Préfixe des data-testid. Par défaut celui des intrigues ; la validation
   * d'une tournée réutilise ce composant avec le sien.
   */
  testIdPrefix?: string;
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
const ResultatTentative: React.FC<ResultatTentativeProps> = ({
  message,
  reussi,
  chauffe = false,
  onFermer,
  testIdPrefix = 'enigma-attempt',
}) => {
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

  const presque = !reussi && chauffe;
  const issue = reussi ? 'resultat-reussi' : presque ? 'resultat-presque' : 'resultat-manque';

  return (
    <div
      className="resultat-voile"
      data-testid={`${testIdPrefix}-overlay`}
      onClick={onFermer}
      role="presentation"
    >
      <div
        className={`resultat ${issue}`}
        // Le testid dépend de l'issue : c'est sur lui que reposent les tests
        // qui vérifient qu'une bonne réponse est acceptée et une mauvaise refusée.
        // Un « presque bon » reste une réponse refusée : même testid, plus un
        // attribut pour le distinguer.
        data-testid={`${testIdPrefix}-${reussi ? 'success' : 'error'}`}
        data-near-miss={presque ? 'true' : undefined}
        role="alertdialog"
        aria-modal="true"
        aria-label={reussi ? 'Bonne réponse' : presque ? 'Presque : réponse proche' : 'Réponse incorrecte'}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={boutonFermer}
          type="button"
          className="resultat-fermer"
          data-testid={`${testIdPrefix}-close`}
          onClick={onFermer}
          aria-label="Fermer"
        >
          ×
        </button>

        <p className="resultat-titre">
          {reussi ? 'Bravo' : presque ? 'Vous chauffez…' : 'Ce n’est pas ça'}
        </p>
        <p className="resultat-message">{message}</p>

        <button type="button" className="resultat-action" onClick={onFermer}>
          {reussi ? 'Continuer' : 'Réessayer'}
        </button>
      </div>
    </div>
  );
};

export default ResultatTentative;
