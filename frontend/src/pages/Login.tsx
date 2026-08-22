import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../utils/errorMessages';
import './Auth.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(getErrorMessage(err, 'Échec de la connexion'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="auth-login-page" className="auth-container">
      <div className="auth-box">
        <h1>Connexion</h1>
        {error && <div data-testid="auth-login-error" className="error-message">{error}</div>}
        <form data-testid="auth-login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input data-testid="auth-login-email-input"
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
            <input data-testid="auth-login-password-input"
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button data-testid="auth-login-submit" type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="auth-link">
          Pas encore de compte ? <Link data-testid="auth-signup-link" to="/signup">S'inscrire</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
