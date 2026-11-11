import React from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';
import { useEdition } from '../editions';

const Landing: React.FC = () => {
  const edition = useEdition();
  const v = edition.vocabulaire;
  return (
    <div className="landing">
      <div className="landing-hero">
        <h1>{edition.label}</h1>
        <p>Rejoignez l'aventure annuelle {v.enigme.dePluriel} !</p>
        <div className="landing-buttons">
          <Link to="/login" className="btn btn-primary">
            Se connecter
          </Link>
          <Link to="/signup" className="btn btn-secondary">
            S'inscrire
          </Link>
        </div>
      </div>
      <div className="landing-info">
        <h2>Comment ça marche ?</h2>
        <div className="info-cards">
          <div className="info-card">
            <h3>1. Créez ou rejoignez une équipe</h3>
            <p>Formez votre équipe ou rejoignez-en une existante</p>
          </div>
          <div className="info-card">
            <h3>2. Payez l'inscription</h3>
            <p>Un paiement unique par équipe pour accéder au jeu</p>
          </div>
          <div className="info-card">
            <h3>3. Résolvez {v.enigme.les}</h3>
            <p>Travaillez en équipe pour résoudre toutes {v.enigme.les}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
