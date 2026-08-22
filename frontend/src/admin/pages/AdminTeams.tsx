import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminTeamsAPI } from '../services/adminAPI';
import { TeamMember } from '../../types';
import './AdminTeams.css';

const AdminTeams: React.FC = () => {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['adminTeams'],
    queryFn: adminTeamsAPI.listAll,
  });

  const { data: progressData } = useQuery({
    queryKey: ['teamProgress', selectedTeam],
    queryFn: () => adminTeamsAPI.getProgress(selectedTeam!),
    enabled: !!selectedTeam,
  });

  if (isLoading) return <div data-testid="admin-teams-loading" className="loading">Chargement des équipes...</div>;
  if (error) return <div data-testid="admin-teams-error" className="error">Échec du chargement des équipes</div>;

  const teams = data?.teams || [];

  // Calculate statistics
  const totalTeams = teams.length;
  const paidTeams = teams.filter(t => t.hasPaid).length;
  const activeTeams = teams.filter(t => {
    if (!t.lastActivityAt) return false;
    const daysSinceActivity = (Date.now() - new Date(t.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceActivity <= 7;
  }).length;
  const totalMembers = teams.reduce((sum, t) => sum + t.members.length, 0);
  const avgMembers = totalTeams > 0 ? (totalMembers / totalTeams).toFixed(1) : 0;

  return (
    <div data-testid="admin-teams-page" className="admin-teams">
      <div className="admin-page-header">
        <div>
          <h1>Suivi des équipes</h1>
          <p className="admin-page-subtitle">Suivre la progression et la complétion des équipes</p>
        </div>
      </div>

      <div className="teams-overview-stats card">
        <div className="summary-stats">
          <div className="summary-stat">
            <div className="summary-value">{totalTeams}</div>
            <div className="summary-label">Équipes inscrites</div>
          </div>
          <div className="summary-stat success">
            <div className="summary-value">{paidTeams}</div>
            <div className="summary-label">Équipes payées</div>
          </div>
          <div className="summary-stat teams">
            <div className="summary-value">{activeTeams}</div>
            <div className="summary-label">Équipes actives</div>
          </div>
          <div className="summary-stat rate">
            <div className="summary-value">{avgMembers}</div>
            <div className="summary-label">Membres / équipe</div>
          </div>
        </div>
      </div>

      <div data-testid="admin-teams-list" className="teams-grid">
        {teams.map((team) => (
          <div data-testid={`admin-teams-row-${team.teamId}`}
            key={team.teamId}
            className={`team-card card ${selectedTeam === team.teamId ? 'selected' : ''}`}
            onClick={() => setSelectedTeam(team.teamId === selectedTeam ? null : team.teamId)}
          >
            <div className="team-card-header">
              <h3>{team.teamName}</h3>
              <span className={`payment-badge ${team.hasPaid ? 'paid' : 'unpaid'}`}>
                {team.hasPaid ? 'Payé' : 'Non payé'}
              </span>
            </div>

            <div className="team-stats-grid">
              <div className="team-stat">
                <span className="stat-icon">👥</span>
                <div>
                  <div className="stat-number">{team.members.length}</div>
                  <div className="stat-label">Membres</div>
                </div>
              </div>

              <div className="team-stat">
                <span className="stat-icon">🧩</span>
                <div>
                  <div className="stat-number">{team.solvedEnigmasCount || 0}</div>
                  <div className="stat-label">Énigmes résolues</div>
                </div>
              </div>

              <div className="team-stat">
                <span className="stat-icon">🗺️</span>
                <div>
                  <div className="stat-number">{team.unlockedParcoursCount || 0}</div>
                  <div className="stat-label">Parcours déverrouillés</div>
                </div>
              </div>

              <div className="team-stat">
                <span className="stat-icon">⭐</span>
                <div>
                  <div className="stat-number">{team.points || 0}</div>
                  <div className="stat-label">Points</div>
                </div>
              </div>

              <div className="team-stat">
                <span className="stat-icon">📝</span>
                <div>
                  <div className="stat-number">{team.totalAttempts || 0}</div>
                  <div className="stat-label">Total tentatives</div>
                </div>
              </div>

              <div className="team-stat">
                <span className="stat-icon">🕐</span>
                <div>
                  <div className="stat-number">
                    {team.lastActivityAt
                      ? new Date(team.lastActivityAt).toLocaleDateString('fr-FR')
                      : 'N/A'}
                  </div>
                  <div className="stat-label">Dernière activité</div>
                </div>
              </div>
            </div>

            <div className="team-members">
              <h4>Membres de l'équipe :</h4>
              <ul>
                {team.members.map((member: TeamMember) => (
                  <li key={member.userId}>
                    {member.displayName}
                    {team.leaderId === member.userId && (
                      <span className="leader-badge">Chef</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {selectedTeam === team.teamId && progressData && (
              <div className="team-progress-details">
                <h4>Détails de progression :</h4>
                <div className="progress-list">
                  {progressData.progress.map((progress: any) => (
                    <div key={progress.enigmaId} className="progress-item">
                      <span className={`progress-status ${progress.solved ? 'solved' : 'unsolved'}`}>
                        {progress.solved ? '✓' : '○'}
                      </span>
                      <div className="progress-info">
                        <div className="progress-enigma">Énigme #{progress.enigmaNumber}</div>
                        <div className="progress-attempts">
                          {progress.attemptCount} tentatives
                          {progress.solvedAt && (
                            <span> - Résolue : {new Date(progress.solvedAt).toLocaleString('fr-FR')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {teams.length === 0 && (
        <div data-testid="admin-teams-empty" className="empty-state">
          <p>Aucune équipe inscrite pour le moment.</p>
        </div>
      )}
    </div>
  );
};

export default AdminTeams;
