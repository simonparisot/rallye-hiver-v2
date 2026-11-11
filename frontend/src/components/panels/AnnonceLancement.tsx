import React from 'react';
import './AnnonceLancement.css';
import { majuscule, useEdition } from '../../editions';
import { formaterLancement } from '../../services/statutJeu';

/**
 * Avant le lancement, au-dessus des énigmes préliminaires : la date du
 * lancement, et ce qui est ouvert d'ici là.
 */
export const AnnonceLancementEnigmes: React.FC<{ launchAt: string }> = ({ launchAt }) => {
  const v = useEdition().vocabulaire;
  return (
    <div className="annonce-lancement" data-testid="enigmes-avant-lancement" role="status">
      Lancement du rallye le <strong>{formaterLancement(launchAt)}</strong>. D'ici là, voici {v.enigme.les}{' '}
      préliminaires.
    </div>
  );
};

/**
 * Avant le lancement, à la place de la section des parcours : aucun parcours
 * n'existe encore pour les joueurs (le serveur n'en renvoie aucun).
 */
export const AnnonceLancementParcours: React.FC<{ launchAt: string }> = ({ launchAt }) => {
  const v = useEdition().vocabulaire;
  return (
    <div className="annonce-lancement-section" data-testid="parcours-avant-lancement">
      <div className="panel-header">
        <h2>{v.parcours.Pluriel}</h2>
      </div>
      <div className="annonce-lancement">
        {majuscule(v.parcours.les)} seront disponibles au lancement du rallye, le{' '}
        <strong>{formaterLancement(launchAt)}</strong>.
      </div>
    </div>
  );
};
