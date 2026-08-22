import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminTeamsAPI, adminStatsAPI } from '../services/adminAPI';
import './AdminOverview.css';

interface DailyAttempts {
  day: string;
  count: number;
  successRate: number;
}

interface TeamProgressGrid {
  teamId: string;
  teamName: string;
  hasPaid: boolean;
  memberCount: number;
  lastActivityAt: string | null;
  enigmaStatuses: boolean[]; // 20 enigmas
  parcoursStatuses: boolean[]; // 10 parcours
}

const AdminOverview: React.FC = () => {
  // Note: We don't need enigmas/parcours data anymore since the backend sends
  // the progress grid with booleans directly in the correct order

  // Fetch password attempts timeline (optimized backend endpoint)
  const { data: timelineData, isLoading: timelineLoading, error: timelineError } = useQuery({
    queryKey: ['passwordAttemptsTimeline'],
    queryFn: adminStatsAPI.getPasswordAttemptsTimeline,
    refetchInterval: 120000, // Refetch every 2 minutes
  });

  // Fetch all teams with detailed progress in one optimized call (replaces 68 individual API calls!)
  const { data: teamsWithProgress, isLoading: teamsProgressLoading } = useQuery({
    queryKey: ['allTeamsWithProgress'],
    queryFn: adminTeamsAPI.getAllWithProgress,
    refetchInterval: 60000, // Refetch every minute
  });

  // Get daily attempts from optimized backend endpoint
  const dailyAttempts: DailyAttempts[] = timelineData?.timeline.map(item => ({
    day: item.day,
    count: item.totalAttempts,
    successRate: item.successRate,
  })) || [];

  const maxAttempts = Math.max(...dailyAttempts.map(d => d.count), 1);

  // Format day for display
  const formatDay = (dayStr: string, index: number) => {
    const date = new Date(dayStr);

    // Show label every 3 days to avoid crowding (30 days total)
    if (index % 3 === 0) {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }
    return '';
  };

  // Build team progress grid using optimized backend data
  const getTeamProgressGrid = (): TeamProgressGrid[] => {
    if (!teamsWithProgress?.teams) return [];

    return teamsWithProgress.teams.map(team => {
      // Backend now sends arrays of booleans directly
      const enigmaStatuses = team.enigmasProgress.slice(0, 20);
      const parcoursStatuses = team.parcoursProgress.slice(0, 10);

      // Check if team is inactive (no activity in last 7 days)
      const isInactive = team.lastActivityAt
        ? (Date.now() - new Date(team.lastActivityAt).getTime()) > 7 * 24 * 60 * 60 * 1000
        : true;

      // Use counts from backend
      const solvedEnigmasCount = team.solvedCount;
      const completedParcoursCount = team.completedParcoursCount;

      return {
        teamId: team.teamId,
        teamName: team.teamName,
        hasPaid: team.hasPaid,
        memberCount: team.memberCount,
        lastActivityAt: team.lastActivityAt || null,
        enigmaStatuses,
        parcoursStatuses,
        isInactive,
        solvedEnigmasCount,
        completedParcoursCount,
      } as TeamProgressGrid & { isInactive: boolean; solvedEnigmasCount: number; completedParcoursCount: number };
    }).sort((a, b) => {
      // Sort by: number of enigmas solved (desc), then parcours completed (desc)
      if (a.solvedEnigmasCount !== b.solvedEnigmasCount) {
        return b.solvedEnigmasCount - a.solvedEnigmasCount;
      }
      if (a.completedParcoursCount !== b.completedParcoursCount) {
        return b.completedParcoursCount - a.completedParcoursCount;
      }
      // If same progress, paid teams first
      if (a.hasPaid !== b.hasPaid) return a.hasPaid ? -1 : 1;
      // Then by activity
      if (a.isInactive !== b.isInactive) return a.isInactive ? 1 : -1;
      // Finally by member count
      return b.memberCount - a.memberCount;
    });
  };

  const teamProgressGrid = getTeamProgressGrid();

  return (
    <div data-testid="admin-overview-page" className="admin-overview">
      <div className="admin-page-header">
        <h1>📊 Vue d'ensemble</h1>
        <p className="admin-page-subtitle">Activité et progression des équipes</p>
      </div>

      {/* Timeline Chart - Attempts per day (optimized backend endpoint) */}
      <div data-testid="admin-attempts-timeline" className="timeline-chart-section card">
        <h2>Tentatives de mots de passe (30 derniers jours)</h2>
        {timelineLoading ? (
          <div className="loading-state">
            <p>Chargement du graphique...</p>
          </div>
        ) : timelineError ? (
          <div className="error-state">
            <p>❌ Erreur lors du chargement des tentatives</p>
          </div>
        ) : (
          <>
            {timelineData?.summary && (
              <div className="timeline-summary" style={{ marginBottom: 'var(--spacing-md)', padding: 'var(--spacing-sm)', background: '#f9fafb', borderRadius: '6px', fontSize: '0.875rem' }}>
                <strong>{timelineData.summary.totalAttempts}</strong> tentatives au total
                ({timelineData.summary.correctAttempts} correctes, {timelineData.summary.incorrectAttempts} incorrectes)
                • Taux de réussite: <strong>{timelineData.summary.successRate}%</strong>
              </div>
            )}
            <div className="timeline-chart">
            <div className="chart-grid">
              {dailyAttempts.map((day, index) => (
                <div key={day.day} className="chart-bar-container">
                  <div
                    className="chart-bar"
                    style={{
                      height: `${(day.count / maxAttempts) * 100}%`,
                      minHeight: day.count > 0 ? '4px' : '0'
                    }}
                    title={`${day.day} - ${day.count} tentative${day.count > 1 ? 's' : ''} (${day.successRate}% de réussite)`}
                  >
                    {day.count > 0 && (
                      <span className="bar-value">{day.count}</span>
                    )}
                  </div>
                  <div className="chart-label">
                    {formatDay(day.day, index)}
                  </div>
                </div>
              ))}
            </div>
            </div>
          </>
        )}
      </div>

      {/* Teams Progress Grid (loads independently) */}
      <div className="teams-progress-section card">
        <h2>Progression des équipes</h2>
        <p className="section-subtitle">
          Vert = Résolu/Complété • Gris = Équipe inactive (&gt;7 jours)
        </p>

        {teamsProgressLoading ? (
          <div className="loading-state">
            <p>Chargement de la grille de progression...</p>
          </div>
        ) : (
          <div className="teams-grid-wrapper">
          <table data-testid="admin-teams-progress-table" className="teams-progress-table">
            <thead>
              <tr>
                <th className="team-name-col">Équipe</th>
                <th className="members-col">👥</th>
                <th className="payment-col">💰</th>
                <th className="enigmas-col" colSpan={20}>
                  <div className="header-label">Énigmes (1-20)</div>
                </th>
                <th className="parcours-col" colSpan={10}>
                  <div className="header-label">Parcours (1-10)</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {teamProgressGrid.map((team: any) => (
                <tr data-testid={`admin-teams-progress-row-${team.teamId}`}
                  key={team.teamId}
                  className={team.isInactive ? 'inactive-team' : ''}
                >
                  <td className="team-name-cell">
                    <div className="team-name-content">
                      <span className="team-name">{team.teamName}</span>
                      {team.isInactive && (
                        <span className="inactive-badge">Inactif</span>
                      )}
                    </div>
                  </td>
                  <td className="members-cell">{team.memberCount}</td>
                  <td className="payment-cell">
                    {team.hasPaid ? (
                      <span className="paid-icon">✓</span>
                    ) : (
                      <span className="unpaid-icon">✗</span>
                    )}
                  </td>

                  {/* Enigmas status boxes (20) */}
                  {Array.from({ length: 20 }).map((_, index) => {
                    const enigmaNumber = teamsWithProgress?.metadata?.enigmaNumbers?.[index] || index + 1;
                    const enigmaTitle = teamsWithProgress?.metadata?.enigmaTitles?.[index] || `Énigme ${index + 1}`;
                    const isSolved = team.enigmaStatuses[index];

                    return (
                      <td key={`enigma-${index}`} className="status-cell">
                        <div
                          className={`status-box ${isSolved ? 'solved' : 'unsolved'}`}
                          title={`Énigme #${enigmaNumber}: ${enigmaTitle}${isSolved ? ' ✓ Résolue' : ''}`}
                        >
                          {isSolved && <span className="check">✓</span>}
                        </div>
                      </td>
                    );
                  })}

                  {/* Parcours status boxes (10) */}
                  {Array.from({ length: 10 }).map((_, index) => {
                    const parcoursNumber = teamsWithProgress?.metadata?.parcoursNumbers?.[index] || index + 1;
                    const parcoursTitle = teamsWithProgress?.metadata?.parcoursTitles?.[index] || `Parcours ${index + 1}`;
                    const isCompleted = team.parcoursStatuses[index];

                    return (
                      <td key={`parcours-${index}`} className="status-cell">
                        <div
                          className={`status-box ${isCompleted ? 'solved' : 'unsolved'}`}
                          title={`Parcours #${parcoursNumber}: ${parcoursTitle}${isCompleted ? ' ✓ Complété' : ''}`}
                        >
                          {isCompleted && <span className="check">✓</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {teamProgressGrid.length === 0 && (
            <div data-testid="admin-teams-progress-empty" className="empty-state">
              <p>Aucune équipe enregistrée</p>
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOverview;
