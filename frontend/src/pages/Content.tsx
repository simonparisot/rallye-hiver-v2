import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { contentAPI } from '../services/api';
import './Content.css';

const Content: React.FC = () => {
  const { data: accessData, isLoading: accessLoading } = useQuery({
    queryKey: ['access'],
    queryFn: () => contentAPI.checkAccess(),
  });

  const { data: enigmaData, isLoading: enigmaLoading } = useQuery({
    queryKey: ['enigma'],
    queryFn: () => contentAPI.getEnigma(),
    enabled: accessData?.hasAccess === true,
  });

  if (accessLoading) return <div className="loading">Vérification de l'accès...</div>;

  if (!accessData?.hasAccess) {
    return (
      <div className="content-locked">
        <h1>Accès restreint</h1>
        <p>{accessData?.reason || 'Vous n\'avez pas accès au contenu'}</p>
      </div>
    );
  }

  if (enigmaLoading) return <div className="loading">Chargement des énigmes...</div>;

  return (
    <div className="content">
      <h1>{enigmaData?.enigmaData.title}</h1>
      <p className="content-description">{enigmaData?.enigmaData.description}</p>

      <div className="enigmas">
        <div className="info-message">
          <h2>🎮 Le jeu a été déplacé!</h2>
          <p>Rendez-vous dans l'onglet "Jeu" pour accéder aux énigmes et parcours.</p>
          <a href="/game" className="btn btn-primary">Accéder au jeu</a>
        </div>
      </div>
    </div>
  );
};

export default Content;
