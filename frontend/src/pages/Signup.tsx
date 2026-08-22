import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../utils/errorMessages';
import './Auth.css';

const Signup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signup(email, password, displayName);
      navigate('/dashboard');
    } catch (err: any) {
      setError(getErrorMessage(err, 'Échec de l\'inscription'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="auth-signup-page" className="auth-container">
      <div className="auth-box">
        <h1>Inscription</h1>
        {error && <div data-testid="auth-signup-error" className="error-message">{error}</div>}
        <form data-testid="auth-signup-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="displayName">Nom d'affichage</label>
            <input data-testid="auth-signup-displayname-input"
              type="text"
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input data-testid="auth-signup-email-input"
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Mot de passe</label>
            <input data-testid="auth-signup-password-input"
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <small>Au moins 8 caractères, avec majuscule, minuscule et chiffre</small>
          </div>
          <button data-testid="auth-signup-submit" type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Inscription...' : 'S\'inscrire'}
          </button>
        </form>

        <p className="auth-link">
          Déjà un compte ? <Link data-testid="auth-login-link" to="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
