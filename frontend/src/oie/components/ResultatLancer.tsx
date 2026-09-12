import React from 'react';
import { OieRollResponse } from '../types';

interface ResultatLancerProps {
  resultat: OieRollResponse;
  onFermer: () => void;
}

/**
 * Annonce du lancer : les deux des, le total, la case d'arrivee, et les effets
 * speciaux traverses. Le serveur envoie deja les phrases, on ne fait que les
 * mettre en scene.
 */
const ResultatLancer: React.FC<ResultatLancerProps> = ({ resultat, onFermer }) => (
  <section className="oie-resultat" data-testid="oie-resultat-lancer" role="status">
    <button
      type="button"
      className="oie-resultat-fermer"
      onClick={onFermer}
      aria-label="Fermer l'annonce du lancer"
      data-testid="oie-resultat-fermer"
    >
      ×
    </button>

    <div className="oie-des">
      <span className="oie-de" data-testid="oie-de-1">{resultat.dice[0]}</span>
      <span className="oie-de" data-testid="oie-de-2">{resultat.dice[1]}</span>
      <span className="oie-total" data-testid="oie-total">= {resultat.total}</span>
    </div>

    <p className="oie-resultat-trajet" data-testid="oie-trajet">
      De la case {resultat.from} a la case {resultat.to}
    </p>

    {resultat.journal.length > 0 && (
      <ul className="oie-resultat-effets" data-testid="oie-effets">
        {resultat.journal.map((ligne, index) => (
          <li key={index}>{ligne}</li>
        ))}
      </ul>
    )}

    {resultat.releases.length > 0 && (
      <ul className="oie-resultat-effets oie-resultat-liberations" data-testid="oie-liberations">
        {resultat.releases.map((ligne, index) => (
          <li key={index}>{ligne}</li>
        ))}
      </ul>
    )}

    {resultat.finished && (
      <p className="oie-resultat-arrivee" data-testid="oie-resultat-arrivee">
        Vous etes arrives en case 63. Rideau.
      </p>
    )}
  </section>
);

export default ResultatLancer;
