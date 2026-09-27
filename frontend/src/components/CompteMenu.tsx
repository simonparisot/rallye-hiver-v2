import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { getErrorMessage } from '../utils/errorMessages';
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
 * La réinitialisation reprend le parcours déjà en place côté déconnecté
 * (`forgot-password` puis `reset-password`) : un code arrive par courriel, puis
 * on choisit un nouveau mot de passe. Rien n'est pré-rempli.
 */

type Etape = 'demande' | 'code' | 'fini';

const CompteMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const [modale, setModale] = useState(false);
  const [etape, setEtape] = useState<Etape>('demande');
  const [code, setCode] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const zone = useRef<HTMLDivElement>(null);

  // Un clic à côté ou la touche Échap referment le menu ; sans cela il reste
  // ouvert derrière la page et capte le clic suivant.
  useEffect(() => {
    const auClic = (e: MouseEvent) => {
      if (zone.current && !zone.current.contains(e.target as Node)) setOuvert(false);
    };
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOuvert(false); fermerModale(); }
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

  const ouvrirModale = () => {
    setOuvert(false);
    setEtape('demande');
    setCode('');
    setMotDePasse('');
    setErreur('');
    setModale(true);
  };

  const fermerModale = () => {
    setModale(false);
    setCode('');
    setMotDePasse('');
  };

  const envoyerCode = async () => {
    setEnCours(true);
    setErreur('');
    try {
      await authAPI.forgotPassword(user.email);
      setEtape('code');
    } catch (err: any) {
      setErreur(getErrorMessage(err, "L'envoi du code a échoué. Réessayez dans un instant."));
    } finally {
      setEnCours(false);
    }
  };

  const reinitialiser = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      await authAPI.resetPassword(user.email, code.trim(), motDePasse);
      setEtape('fini');
    } catch (err: any) {
      setErreur(getErrorMessage(err, 'Code invalide ou expiré.'));
    } finally {
      setEnCours(false);
    }
  };

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

      {modale && (
        <div className="compte-voile" onClick={(e) => { if (e.target === e.currentTarget) fermerModale(); }}>
          <div className="compte-modale" role="dialog" aria-modal="true" aria-labelledby="compte-modale-titre">
            <div className="compte-modale-tete">
              <h2 id="compte-modale-titre">Mot de passe</h2>
              <button type="button" className="compte-fermer" onClick={fermerModale} aria-label="Fermer">×</button>
            </div>

            {etape === 'demande' && (
              <div className="compte-modale-corps">
                <p>Un code de vérification va être envoyé à l'adresse de votre compte.</p>
                <p className="compte-adresse"><span>Adresse du compte</span><b>{user.email}</b></p>
                {erreur && <p className="compte-erreur">{erreur}</p>}
                <div className="compte-actions">
                  <button type="button" className="compte-principal" onClick={envoyerCode} disabled={enCours}>
                    {enCours ? 'Envoi…' : 'Envoyer le code'}
                  </button>
                  <button type="button" className="compte-secondaire" onClick={fermerModale}>Annuler</button>
                </div>
              </div>
            )}

            {etape === 'code' && (
              <form className="compte-modale-corps" onSubmit={reinitialiser}>
                <p>Saisissez le code reçu à l'adresse <b>{user.email}</b>, puis votre nouveau mot de passe.</p>
                <label className="compte-champ">
                  Code reçu par courriel
                  <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" required />
                </label>
                <label className="compte-champ">
                  Nouveau mot de passe
                  <input type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoComplete="new-password" required />
                </label>
                {erreur && <p className="compte-erreur">{erreur}</p>}
                <div className="compte-actions">
                  <button type="submit" className="compte-principal" disabled={enCours || !code.trim() || !motDePasse}>
                    {enCours ? 'Validation…' : 'Réinitialiser'}
                  </button>
                  <button type="button" className="compte-secondaire" onClick={fermerModale}>Annuler</button>
                </div>
              </form>
            )}

            {etape === 'fini' && (
              <div className="compte-modale-corps">
                <p className="compte-ok">Mot de passe changé.</p>
                <p>Il sera demandé à votre prochaine connexion.</p>
                <div className="compte-actions">
                  <button type="button" className="compte-principal" onClick={fermerModale}>Fermer</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompteMenu;
