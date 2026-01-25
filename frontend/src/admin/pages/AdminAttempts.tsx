import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAttemptsAPI, adminEnigmasAPI } from '../services/adminAPI';
import './AdminAttempts.css';

const AdminAttempts: React.FC = () => {
  const [filters, setFilters] = useState({
    success: undefined as boolean | undefined,
    enigmaId: undefined as string | undefined,
    limit: 100,
    offset: 0,
  });

  // Fetch enigmas list for filter dropdown
  const { data: enigmasData } = useQuery({
    queryKey: ['adminEnigmas'],
    queryFn: adminEnigmasAPI.listAll,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['adminAttempts', filters],
    queryFn: () => adminAttemptsAPI.listAll(filters),
  });

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters({ ...filters, ...newFilters, offset: 0 });
  };

  const handleLoadMore = () => {
    setFilters({ ...filters, offset: filters.offset + filters.limit });
  };

  if (isLoading) return <div className="loading">Chargement des tentatives...</div>;
  if (error) return <div className="error">Échec du chargement des tentatives</div>;

  const attempts = data?.attempts || [];
  const hasMore = attempts.length === filters.limit;

  return (
    <div className="admin-attempts">
      <div className="admin-page-header">
        <div>
          <h1>Suivi des tentatives</h1>
          <p className="admin-page-subtitle">Surveiller toutes les tentatives des équipes et soumissions de mots de passe</p>
        </div>
      </div>

      <div className="attempts-controls card">
        <div className="filter-controls">
          <div className="filter-group">
            <label>Énigme</label>
            <select
              value={filters.enigmaId || 'all'}
              onChange={(e) => {
                const value = e.target.value;
                handleFilterChange({
                  enigmaId: value === 'all' ? undefined : value,
                });
              }}
            >
              <option value="all">Toutes les énigmes</option>
              {enigmasData?.enigmas
                ?.sort((a, b) => a.enigmaNumber - b.enigmaNumber)
                .map((enigma) => (
                  <option key={enigma.enigmaId} value={enigma.enigmaId}>
                    Énigme #{enigma.enigmaNumber} - {enigma.title}
                  </option>
                ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Statut</label>
            <select
              value={filters.success === undefined ? 'all' : filters.success.toString()}
              onChange={(e) => {
                const value = e.target.value;
                handleFilterChange({
                  success: value === 'all' ? undefined : value === 'true',
                });
              }}
            >
              <option value="all">Toutes les tentatives</option>
              <option value="true">Réussies uniquement</option>
              <option value="false">Échouées uniquement</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Résultats par page</label>
            <select
              value={filters.limit}
              onChange={(e) => handleFilterChange({ limit: parseInt(e.target.value) })}
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="250">250</option>
              <option value="500">500</option>
            </select>
          </div>
        </div>

        {data && data.stats && (
          <div className="summary-stats">
            <div className="summary-stat">
              <div className="summary-value">{data.stats.totalAttempts}</div>
              <div className="summary-label">Total tentatives</div>
            </div>
            <div className="summary-stat success">
              <div className="summary-value">{data.stats.totalSuccessful}</div>
              <div className="summary-label">Réussies</div>
            </div>
            <div className="summary-stat teams">
              <div className="summary-value">{data.stats.activeTeams}</div>
              <div className="summary-label">Équipes actives</div>
            </div>
            <div className="summary-stat rate">
              <div className="summary-value">{data.stats.successRate.toFixed(1)}%</div>
              <div className="summary-label">Taux de réussite</div>
            </div>
          </div>
        )}
      </div>

      <div className="attempts-list">
        <table className="admin-table attempts-table">
          <thead>
            <tr>
              <th>Date/Heure</th>
              <th>Équipe</th>
              <th>Énigme</th>
              <th>Mot de passe</th>
              <th>Statut</th>
              <th>Utilisateur</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((attempt) => (
              <tr key={attempt.attemptId} className={attempt.success ? 'success-row' : 'fail-row'}>
                <td className="attempt-date">
                  {new Date(attempt.attemptedAt).toLocaleString('fr-FR', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  })}
                </td>
                <td className="team-name">{attempt.teamName}</td>
                <td className="enigma-info">
                  <div className="enigma-title">{attempt.enigmaTitle}</div>
                </td>
                <td className="password-field">
                  <code>{attempt.password}</code>
                </td>
                <td>
                  <span className={`attempt-status ${attempt.success ? 'success' : 'failed'}`}>
                    {attempt.success ? '✓ Réussi' : '✗ Échoué'}
                  </span>
                </td>
                <td className="user-info">
                  <div>{attempt.attemptedByName}</div>
                  <div className="user-email">{attempt.attemptedBy}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {attempts.length === 0 && (
          <div className="empty-state">
            <p>Aucune tentative trouvée correspondant à vos filtres.</p>
          </div>
        )}

        {hasMore && (
          <div className="load-more-container">
            <button className="btn btn-secondary" onClick={handleLoadMore}>
              Charger plus
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAttempts;
