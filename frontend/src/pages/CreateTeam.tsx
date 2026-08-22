import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { teamAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../utils/errorMessages';
import './Team.css';

const CreateTeam: React.FC = () => {
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await teamAPI.createTeam(teamName);
      await refreshUser();
      navigate(`/team/${result.teamId}`);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Échec de la création de l\'équipe'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="team-create-page" className="team-container">
      <div className="team-box">
        <h1>Créer une équipe</h1>
        {error && <div data-testid="team-create-error" className="error-message">{error}</div>}
        <form data-testid="team-create-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="teamName">Nom de l'équipe</label>
            <input data-testid="team-name-input"
              type="text"
              id="teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              placeholder="Entrez le nom de votre équipe"
            />
          </div>
          <button data-testid="team-create-submit" type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Création...' : 'Créer l\'équipe'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateTeam;
