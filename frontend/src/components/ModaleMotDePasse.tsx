import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { getErrorMessage } from '../utils/errorMessages';
import './CompteMenu.css';

/**
 * Réinitialiser son mot de passe, une fois connecté.
 *
 * Reprend le parcours déjà en place côté déconnecté — un code par courriel,
 * puis un nouveau mot de passe — plutôt que d'en inventer un second. Rien
 * n'est pré-rempli.
 *
 * Extraite de CompteMenu pour que le tiroir du téléphone, qui a remplacé ce
 * menu sur petit écran, ouvre exactement la même fenêtre.
 */

type Etape = 'demande' | 'code' | 'fini';

interface ModaleMotDePasseProps {
  ouverte: boolean;
  onFermer: () => void;
}

const ModaleMotDePasse: React.FC<ModaleMotDePasseProps> = ({ ouverte, onFermer }) => {
  const { user } = useAuth();
  const [etape, setEtape] = useState<Etape>('demande');
  const [code, setCode] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  // Chaque ouverture repart de la première étape : rouvrir la fenêtre après
  // un échec ne doit pas rejouer l'écran d'erreur.
  useEffect(() => {
    if (!ouverte) return;
    setEtape('demande');
    setCode('');
    setMotDePasse('');
    setErreur('');
    const auClavier = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer(); };
    document.addEventListener('keydown', auClavier);
    return () => document.removeEventListener('keydown', auClavier);
  }, [ouverte, onFermer]);

  if (!ouverte || !user) return null;

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
    <div className="compte-voile" onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <div className="compte-modale" role="dialog" aria-modal="true" aria-labelledby="compte-modale-titre">
        <div className="compte-modale-tete">
          <h2 id="compte-modale-titre">Mot de passe</h2>
          <button type="button" className="compte-fermer" onClick={onFermer} aria-label="Fermer">×</button>
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
              <button type="button" className="compte-secondaire" onClick={onFermer}>Annuler</button>
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
              <button type="button" className="compte-secondaire" onClick={onFermer}>Annuler</button>
            </div>
          </form>
        )}

        {etape === 'fini' && (
          <div className="compte-modale-corps">
            <p className="compte-ok">Mot de passe changé.</p>
            <p>Il sera demandé à votre prochaine connexion.</p>
            <div className="compte-actions">
              <button type="button" className="compte-principal" onClick={onFermer}>Fermer</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModaleMotDePasse;
