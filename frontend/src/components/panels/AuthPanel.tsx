import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';
import { getErrorMessage } from '../../utils/errorMessages';
import './AuthPanel.css';

const AuthPanel: React.FC = () => {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot-password' | 'reset-password'>('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    code: '',
    newPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
      } else if (mode === 'signup') {
        if (!formData.displayName) {
          setError('Votre nom est requis');
          setLoading(false);
          return;
        }
        await signup(formData.email, formData.password, formData.displayName);
      } else if (mode === 'forgot-password') {
        await authAPI.forgotPassword(formData.email);
        setSuccess('Un code de vérification a été envoyé à votre email');
        // Auto-switch to reset password mode
        setTimeout(() => {
          setMode('reset-password');
          setSuccess('');
        }, 2000);
      } else if (mode === 'reset-password') {
        await authAPI.resetPassword(formData.email, formData.code, formData.newPassword);
        setSuccess('Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.');
        // Auto-switch back to login mode
        setTimeout(() => {
          setMode('login');
          setSuccess('');
          setFormData({
            email: formData.email,
            password: '',
            displayName: '',
            code: '',
            newPassword: '',
          });
        }, 2000);
      }
      // Auth context will handle the redirect via user state change for login/signup
      setLoading(false);
    } catch (err: any) {
      if (mode === 'login') {
        setError('Email ou mot de passe incorrect. Pas encore inscrit ? Cliquez sur "Inscription" ci-dessus pour créer votre compte !');
      } else {
        setError(getErrorMessage(err, 'Une erreur est survenue'));
      }
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Connexion';
      case 'signup': return 'Inscription';
      case 'forgot-password': return 'Mot de passe oublié';
      case 'reset-password': return 'Réinitialiser le mot de passe';
      default: return 'Connexion';
    }
  };

  return (
    <div className="auth-panel" data-testid="auth-panel">
      <div className="panel-header">
        <h2>{getTitle()}</h2>
      </div>
      <div className="panel-content">
        <div className="auth-container">
          {(mode === 'login' || mode === 'signup') && (
            <div className="auth-tabs" data-testid="auth-tabs">
              <button
                data-testid="auth-login-tab"
                className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccess('');
                }}
              >
                Connexion
              </button>
              <button
                data-testid="auth-signup-tab"
                className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
                onClick={() => {
                  setMode('signup');
                  setError('');
                  setSuccess('');
                }}
              >
                Inscription
              </button>
            </div>
          )}

          <form className="auth-form" data-testid="auth-form" onSubmit={handleSubmit}>
            {mode === 'login' && (
              <div className="auth-info-text">
                Cette année, l'inscription est individuelle. Inscrivez-vous avec votre email personnel, vous pourrez ensuite créer ou rejoindre votre équipe.
              </div>
            )}

            {mode === 'signup' && (
              <>
                <div className="auth-info-text">
                  Cette année, l'inscription est individuelle. Inscrivez-vous avec votre email personnel, vous pourrez ensuite créer ou rejoindre votre équipe.
                </div>
                <div className="form-group">
                  <label htmlFor="displayName">Votre nom (pas celui de votre équipe)</label>
                  <input
                    type="text"
                    id="displayName"
                    name="displayName"
                    data-testid="auth-displayname-input"
                    value={formData.displayName}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    placeholder="Ex: Jean Dupont"
                  />
                </div>
              </>
            )}

            {(mode === 'login' || mode === 'signup' || mode === 'forgot-password' || mode === 'reset-password') && (
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  data-testid="auth-email-input"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>
            )}

            {(mode === 'login' || mode === 'signup') && (
              <div className="form-group">
                <label htmlFor="password">Mot de passe</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  data-testid="auth-password-input"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={8}
                  disabled={loading}
                />
                {mode === 'signup' && (
                  <small>Minimum 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre</small>
                )}
              </div>
            )}

            {mode === 'reset-password' && (
              <>
                <div className="form-group">
                  <label htmlFor="code">Code de vérification</label>
                  <input
                    type="text"
                    id="code"
                    name="code"
                    data-testid="auth-code-input"
                    value={formData.code}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    placeholder="Code à 6 chiffres"
                    maxLength={6}
                  />
                  <small>Entrez le code reçu par email</small>
                </div>

                <div className="form-group">
                  <label htmlFor="newPassword">Nouveau mot de passe</label>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    data-testid="auth-new-password-input"
                    value={formData.newPassword}
                    onChange={handleChange}
                    required
                    minLength={8}
                    disabled={loading}
                  />
                  <small>Minimum 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre</small>
                </div>
              </>
            )}

            {error && <div className="error-message" data-testid="auth-error">{error}</div>}
            {success && <div className="success-message" data-testid="auth-success">{success}</div>}

            <button type="submit" className="btn btn-primary btn-large" data-testid="auth-submit" disabled={loading}>
              {loading ? 'Chargement...' :
               mode === 'login' ? 'Se connecter' :
               mode === 'signup' ? 'S\'inscrire' :
               mode === 'forgot-password' ? 'Envoyer le code' :
               'Réinitialiser le mot de passe'}
            </button>
          </form>

          <div className="auth-help">
            {mode === 'login' && (
              <>
                <p>
                  Pas encore de compte ? Cliquez sur "Inscription" ci-dessus.
                </p>
                <p>
                  <button
                    data-testid="auth-forgot-password-link"
                    className="link-button"
                    onClick={() => {
                      setMode('forgot-password');
                      setError('');
                      setSuccess('');
                    }}
                  >
                    Mot de passe oublié ?
                  </button>
                </p>
              </>
            )}
            {mode === 'signup' && (
              <p>
                Déjà inscrit ? Cliquez sur "Connexion" ci-dessus.
              </p>
            )}
            {(mode === 'forgot-password' || mode === 'reset-password') && (
              <p>
                <button
                  data-testid="auth-back-to-login-link"
                  className="link-button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setSuccess('');
                  }}
                >
                  Retour à la connexion
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPanel;
