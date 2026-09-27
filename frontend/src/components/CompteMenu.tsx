import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ModaleMotDePasse from './ModaleMotDePasse';
import './CompteMenu.css';

/**
 * Le compte, dans la barre de navigation.
 *
 * Cette place était occupée par le nom de l'équipe et son avancement. Les deux
 * sont déjà donnés par la section « Ma troupe » et par les compteurs des
 * onglets ; en tête de page ils ne servaient qu'à remplir. Le bouton qui les
 * remplace mène à ce qu'on ne trouvait nulle part ailleurs une fois connecté :
 * changer son mot de passe, et se déconnecter.
 *
 * La réinitialisation elle-même vit dans ModaleMotDePasse, partagée avec le
 * tiroir du téléphone qui remplace ce menu sur petit écran.
 *
 * Ce menu n'existe qu'à partir de 861 px : en deçà, c'est le burger qui porte
 * le compte, avec le reste de la navigation.
 */

const CompteMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const [modale, setModale] = useState(false);
  const zone = useRef<HTMLDivElement>(null);

  // Un clic à côté ou la touche Échap referment le menu ; sans cela il reste
  // ouvert derrière la page et capte le clic suivant.
  useEffect(() => {
    const auClic = (e: MouseEvent) => {
      if (zone.current && !zone.current.contains(e.target as Node)) setOuvert(false);
    };
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false);
    };
    document.addEventListener('mousedown', auClic);
    document.addEventListener('keydown', auClavier);
    return () => {
      document.removeEventListener('mousedown', auClic);
      document.removeEventListener('keydown', auClavier);
    };
  }, []);

  if (!user) return null;

  const initiales = (user.displayName || user.email || '?')
    .split(/[\s.@]+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join('');

  const ouvrirModale = () => { setOuvert(false); setModale(true); };

  return (
    <div className="compte" ref={zone}>
      <button
        type="button"
        data-testid="compte-bouton"
        className="compte-bouton"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label={`Mon compte — ${user.displayName || user.email}`}
        title={user.displayName || user.email}
        onClick={() => setOuvert((o) => !o)}
      >
        <span className="compte-initiales" aria-hidden="true">{initiales}</span>
      </button>

      {ouvert && (
        <div className="compte-menu" role="menu">
          <p className="compte-identite">
            <span className="compte-nom">{user.displayName}</span>
            <span className="compte-mail">{user.email}</span>
          </p>
          <hr />
          <button type="button" role="menuitem" data-testid="compte-mot-de-passe" onClick={ouvrirModale}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            Réinitialiser mon mot de passe
          </button>
          <button type="button" role="menuitem" className="compte-sortie" data-testid="compte-deconnexion" onClick={logout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
            </svg>
            Se déconnecter
          </button>
        </div>
      )}

      <ModaleMotDePasse ouverte={modale} onFermer={() => setModale(false)} />
    </div>
  );
};

export default CompteMenu;
