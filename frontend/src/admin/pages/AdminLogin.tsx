import React, { useState } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { adminAuthAPI } from '../services/adminAPI';
import { getErrorMessage } from '../../utils/errorMessages';
import './AdminLogin.css';

const AdminLogin: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'forgot-password' | 'reset-password'>('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    code: '',
    newPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAdminAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
      } else if (mode === 'forgot-password') {
        await adminAuthAPI.forgotPassword(formData.email);
        setSuccess('Un code de vérification a été envoyé à votre email');
        // Auto-switch to reset password mode
        setTimeout(() => {
          setMode('reset-password');
          setSuccess('');
        }, 2000);
      } else if (mode === 'reset-password') {
        await adminAuthAPI.resetPassword(formData.email, formData.code, formData.newPassword);
        setSuccess('Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.');
        // Auto-switch back to login mode
        setTimeout(() => {
          setMode('login');
          setSuccess('');
          setFormData({
            email: formData.email,
            password: '',
            code: '',
            newPassword: '',
          });
        }, 2000);
      }
      setLoading(false);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Une erreur est survenue'));
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
      case 'login': return 'Panneau Admin';
      case 'forgot-password': return 'Mot de passe oublié';
      case 'reset-password': return 'Réinitialiser le mot de passe';
      default: return 'Panneau Admin';
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card card">
        <div className="admin-login-header">
          <img src="/logo.png" alt="Rallye d'Hiver" className="admin-login-logo" />
          <h2>{getTitle()}</h2>
        </div>

        <form onSubmit={handleSubmit} className="admin-login-form">
          {(mode === 'login' || mode === 'forgot-password' || mode === 'reset-password') && (
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="admin@exemple.com"
                autoComplete="email"
                disabled={loading}
              />
            </div>
          )}

          {mode === 'login' && (
            <div className="form-group">
              <label htmlFor="password">Mot de passe</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Entrez votre mot de passe"
                autoComplete="current-password"
                disabled={loading}
              />
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

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button type="submit" className="btn btn-primary btn-large" disabled={loading}>
            {loading ? 'Chargement...' :
             mode === 'login' ? 'Se connecter' :
             mode === 'forgot-password' ? 'Envoyer le code' :
             'Réinitialiser le mot de passe'}
          </button>
        </form>

        <div className="admin-login-help">
          {mode === 'login' && (
            <p>
              <button
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
          )}
          {(mode === 'forgot-password' || mode === 'reset-password') && (
            <p>
              <button
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
  );
};

export default AdminLogin;
