import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminHintsAPI } from '../services/adminAPI';
import './AdminHintUsage.css';

const AdminHintUsage: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['adminHintsUsage'],
    queryFn: adminHintsAPI.getUsage,
  });

  if (isLoading) return <div className="loading">Chargement des utilisations d'indices...</div>;
  if (error) return <div className="error">Erreur lors du chargement des utilisations d'indices</div>;

  const usages = data?.usages || [];
  const stats = data?.stats;

  return (
    <div className="admin-hint-usage">
      <div className="admin-page-header">
        <div>
          <h1>Utilisation des indices</h1>
          <p className="admin-page-subtitle">Suivre quelles equipes ont utilise des indices</p>
        </div>
      </div>

      {stats && (
        <div className="hint-stats card">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{stats.totalUsages}</div>
              <div className="stat-label">Indices utilises</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.uniqueTeams}</div>
              <div className="stat-label">Equipes</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.uniqueEnigmas}</div>
              <div className="stat-label">Enigmes concernees</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.solvedAfterHint}</div>
              <div className="stat-label">Resolues apres indice</div>
            </div>
          </div>
        </div>
      )}

      <div className="hint-usage-list">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date/Heure</th>
              <th>Equipe</th>
              <th>Enigme</th>
              <th>Resolue</th>
            </tr>
          </thead>
          <tbody>
            {usages.map((usage, index) => (
              <tr key={`${usage.teamId}-${usage.enigmaId}-${index}`}>
                <td className="usage-date">
                  {new Date(usage.hintUsedAt).toLocaleString('fr-FR', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  })}
                </td>
                <td className="team-name">{usage.teamName}</td>
                <td className="enigma-info">
                  <span className="enigma-number">#{usage.enigmaNumber}</span>
                  <span className="enigma-title">{usage.enigmaTitle}</span>
                </td>
                <td>
                  <span className={`solved-status ${usage.solved ? 'solved' : 'not-solved'}`}>
                    {usage.solved ? 'Oui' : 'Non'}
                  </span>
                  {usage.solved && usage.solvedAt && (
                    <span className="solved-date">
                      {new Date(usage.solvedAt).toLocaleString('fr-FR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {usages.length === 0 && (
          <div className="empty-state">
            <p>Aucun indice n'a encore ete utilise.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminHintUsage;
