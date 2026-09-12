import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getTeamStats } from '../../services/gameService';
import { teamAPI, paymentAPI, userAPI } from '../../services/api';
import PendingRequests from '../user/PendingRequests';
import './StatsPanel.css';

interface StatsPanelProps {
  isCompact: boolean;
  hideStats?: boolean; // Hide stats tab when game hasn't started
}

const StatsPanel: React.FC<StatsPanelProps> = ({ isCompact, hideStats = false }) => {
  const { user, logout, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [teamName, setTeamName] = useState('');
  const [createError, setCreateError] = useState('');
  const [teamSearchQuery, setTeamSearchQuery] = useState('');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['team-stats', user?.userId, user?.teamId],
    queryFn: () => getTeamStats(user!.userId, user!.teamId!),
    enabled: !!user?.userId && !!user?.teamId,
  });

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['team', user?.teamId],
    queryFn: () => teamAPI.getTeam(user!.teamId!),
    enabled: !!user?.teamId,
  });

  const { data: pendingRequestsData } = useQuery({
    queryKey: ['pending-requests'],
    queryFn: () => userAPI.getPendingRequests(),
    enabled: !user?.teamId, // Only fetch when user doesn't have a team
  });

  const hasPendingRequests = (pendingRequestsData?.pendingRequests?.length ?? 0) > 0;

  const approveMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) => teamAPI.approveRequest(user!.teamId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', user?.teamId] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) => teamAPI.rejectRequest(user!.teamId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', user?.teamId] });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: () => paymentAPI.createCheckout(user!.teamId!),
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: (name: string) => teamAPI.createTeam(name),
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setTeamName('');
      setCreateError('');
    },
    onError: (err: any) => {
      if (err.response?.status === 409) {
        setCreateError('Ce nom d\'équipe existe déjà. Veuillez choisir un autre nom.');
      } else {
        setCreateError(err.response?.data?.error || 'Échec de la création de l\'équipe');
      }
    },
  });

  const { data: allTeams, isLoading: teamsLoading } = useQuery({
    queryKey: ['all-teams'],
    queryFn: () => teamAPI.listTeams(),
    enabled: !user?.teamId,
  });

  const joinTeamMutation = useMutation({
    mutationFn: (teamId: string) => teamAPI.joinTeam(teamId),
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['all-teams'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
    },
  });

  const handleLogout = () => {
    logout();
  };

  const isMember = team?.members.some((m: any) => m.userId === user?.userId);

  // Filter teams based on search query
  const filteredTeams = allTeams?.teams?.filter((t: any) =>
    t.teamName.toLowerCase().includes(teamSearchQuery.toLowerCase())
  ) || [];

  // If user has a team but hasn't paid, show simplified view
  if (!isCompact && user?.teamId && team && !team.hasPaid) {
    return (
      <div data-testid="stats-panel" className="stats-panel">
        <div className="panel-header">
          <h2>Tableau de bord</h2>
        </div>
        <div className="panel-content">
          <div className="stats-full">
            <div data-testid="team-section" className="team-section-panel">
              {teamLoading ? (
                <div data-testid="team-loading" className="loading-state">Chargement...</div>
              ) : (
                <>
                  <div className="info-box" style={{ marginBottom: '20px' }}>
                    <p>
                      N'oubliez pas d'inviter les autres membres de votre équipe à s'inscrire et à rejoindre cette équipe.
                      Pensez à régler les frais d'inscription (29€ par équipe) pour accéder au rallye !
                    </p>
                  </div>

                  <div data-testid="team-header" className="team-header">
                    <h3 data-testid="team-name">{team.teamName}</h3>
                    <p data-testid="team-payment-status" className="unpaid">Paiement requis</p>
                  </div>

                  <div data-testid="team-members" className="team-members">
                    <h4>Membres ({team.members.length})</h4>
                    <ul data-testid="team-members-list" className="members-list">
                      {team.members.map((member: any) => (
                        <li data-testid={`team-member-row-${member.userId}`} key={member.userId}>
                          {member.displayName}
                          {member.userId === team.leaderId && (
                            <span data-testid={`team-leader-badge-${member.userId}`} className="badge">Chef</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {isMember && team.pendingRequests && team.pendingRequests.length > 0 && (
                    <div data-testid="team-pending-requests" className="pending-requests-section">
                      <h4>Demandes en attente ({team.pendingRequests.length})</h4>
                      <ul data-testid="team-requests-list" className="requests-list">
                        {team.pendingRequests.map((request: any) => (
                          <li data-testid={`team-request-row-${request.userId}`} key={request.userId}>
                            <span>{request.displayName}</span>
                            <div className="request-actions">
                              <button data-testid={`team-request-approve-${request.userId}`}
                                className="btn btn-small btn-success"
                                onClick={() => approveMutation.mutate({ userId: request.userId })}
                                disabled={approveMutation.isPending}
                              >
                                Accepter
                              </button>
                              <button data-testid={`team-request-reject-${request.userId}`}
                                className="btn btn-small btn-danger"
                                onClick={() => rejectMutation.mutate({ userId: request.userId })}
                                disabled={rejectMutation.isPending}
                              >
                                Refuser
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div data-testid="team-payment-section" className="payment-section">
                    <button data-testid="team-pay-button"
                      className="btn btn-primary btn-large"
                      onClick={() => paymentMutation.mutate()}
                      disabled={paymentMutation.isPending}
                    >
                      {paymentMutation.isPending ? 'Redirection...' : 'Payer maintenant'}
                    </button>
                  </div>

                  <div className="logout-section">
                    <button data-testid="nav-logout-button" className="btn btn-logout" onClick={handleLogout}>
                      Déconnexion
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="stats-panel" className={`stats-panel ${isCompact ? 'panel-compact' : ''}`}>
      <div className="panel-header">
        <h2>{!user?.teamId ? `Bienvenue, ${user?.displayName} !` : 'Tableau de bord'}</h2>
      </div>
      <div className="panel-content">
        {/* Compact View */}
        {isCompact && (
          <div data-testid="stats-compact" className="stats-compact">
            {stats ? (
              <>
                <div data-testid="stats-compact-enigmas" className="compact-stat">
                  <span className="compact-label">Énigmes:</span>
                  <span data-testid="stats-compact-enigmas-value" className="compact-value">{stats.enigmasSolved}/{stats.totalEnigmas}</span>
                </div>
                <div data-testid="stats-compact-points" className="compact-stat">
                  <span className="compact-label">Points:</span>
                  <span data-testid="stats-compact-points-value" className="compact-value">{stats.totalPoints}</span>
                </div>
              </>
            ) : (
              <div data-testid="stats-compact-no-team" className="compact-stat">
                <span className="compact-value">No team</span>
              </div>
            )}
            <button data-testid="nav-logout-compact-button" className="btn-logout-compact" onClick={handleLogout} title="Déconnexion">
              ×
            </button>
          </div>
        )}

        {/* Full View */}
        {!isCompact && (
          <div data-testid="stats-full" className="stats-full">
            {/* No Team Message */}
            {!user?.teamId && (
              <div data-testid="team-no-team-message" className="no-team-message">
                <div className="info-box">
                  <p>
                    Pour participer au Rallye d'Hiver, vous devez rejoindre ou créer une équipe.
                    <br />
                    Une fois dans une équipe et après avoir réglé les frais d'inscription (29€ par équipe), vous pourrez accéder aux énigmes et aux parcours !
                  </p>
                </div>

                <PendingRequests />

                {/* Create Team Section - Now First */}
                <div data-testid="team-create-section" className="create-team-inline">
                  <h4 className="section-title">Créer une équipe</h4>
                  {createError && <div data-testid="team-create-error" className="error-message">{createError}</div>}
                  <form data-testid="team-create-form" onSubmit={(e) => {
                    e.preventDefault();
                    if (teamName.trim() && !hasPendingRequests) {
                      createTeamMutation.mutate(teamName.trim());
                    }
                  }} className="inline-form">
                    <input data-testid="team-name-input"
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      required
                      placeholder="Nom de votre équipe"
                      className="team-name-input"
                      disabled={hasPendingRequests}
                    />
                    <button data-testid="team-create-submit"
                      type="submit"
                      className="btn btn-primary"
                      disabled={createTeamMutation.isPending || !teamName.trim() || hasPendingRequests}
                    >
                      {createTeamMutation.isPending ? 'Création...' : 'Créer'}
                    </button>
                  </form>
                </div>

                {/* Show existing teams */}
                <div data-testid="team-browse-section" className="teams-section-inline">
                  <h4 className="section-title">Équipes existantes</h4>
                  <input data-testid="team-search-input"
                    type="text"
                    placeholder="Rechercher une équipe..."
                    value={teamSearchQuery}
                    onChange={(e) => setTeamSearchQuery(e.target.value)}
                    className="team-search-input"
                  />
                  {teamsLoading ? (
                    <div data-testid="team-list-loading" className="loading-state-inline">Chargement des équipes...</div>
                  ) : filteredTeams.length > 0 ? (
                    <div data-testid="team-list" className="teams-list-inline">
                      {filteredTeams.map((t: any) => (
                        <div data-testid={`team-row-${t.teamId}`} key={t.teamId} className="team-item-inline">
                          <div className="team-info-inline">
                            <h4 data-testid={`team-row-name-${t.teamId}`}>{t.teamName}</h4>
                          </div>
                          <button data-testid={`team-join-button-${t.teamId}`}
                            className="btn btn-primary btn-small"
                            onClick={() => joinTeamMutation.mutate(t.teamId)}
                            disabled={joinTeamMutation.isPending || hasPendingRequests}
                          >
                            {joinTeamMutation.isPending ? 'Envoi...' : 'Rejoindre'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div data-testid="team-list-empty" className="no-teams-inline">
                      <p>{teamSearchQuery ? 'Aucune équipe trouvée.' : 'Aucune équipe existante. Créez la première !'}</p>
                    </div>
                  )}
                </div>

                <div className="logout-section">
                  <button data-testid="nav-logout-button" className="btn btn-logout" onClick={handleLogout}>
                    Déconnexion
                  </button>
                </div>
              </div>
            )}

            {/* Tableau de bord : avancement, puis l'équipe et ses demandes. */}
            {user?.teamId && team?.hasPaid && (
              <div data-testid="stats-dashboard" className="unified-dashboard">
                {/* Stats Section - First */}
                {!hideStats && (
                  <div data-testid="stats-container" className="stats-container">
                    {statsLoading ? (
                      <div data-testid="stats-loading" className="loading-state">Chargement...</div>
                    ) : stats ? (
                      <>
                        <div data-testid="stats-enigmas-solved" className="stat-card">
                          <div className="stat-content">
                            <div data-testid="stats-enigmas-solved-value" className="stat-value">
                              {stats.enigmasSolved} / {stats.totalEnigmas}
                            </div>
                            <div className="stat-label">énigmes résolues</div>
                            {/* Ce qui reste est l'information utile en cours de rallye :
                                « 3 sur 20 » se lit moins bien que « il en reste 17 ». */}
                            <div className="stat-reste">
                              {stats.totalEnigmas - stats.enigmasSolved > 0
                                ? `il en reste ${stats.totalEnigmas - stats.enigmasSolved}`
                                : 'toutes résolues'}
                            </div>
                          </div>
                          <div className="stat-jauge" aria-hidden="true">
                            <span style={{ width: `${stats.totalEnigmas ? (stats.enigmasSolved / stats.totalEnigmas) * 100 : 0}%` }} />
                          </div>
                        </div>

                        <div data-testid="stats-parcours-completed" className="stat-card">
                          <div className="stat-content">
                            <div data-testid="stats-parcours-completed-value" className="stat-value">
                              {stats.parcoursCompleted} / {stats.totalParcours}
                            </div>
                            <div className="stat-label">parcours réalisés</div>
                            <div className="stat-reste">
                              {stats.totalParcours - stats.parcoursCompleted > 0
                                ? `il en reste ${stats.totalParcours - stats.parcoursCompleted}`
                                : 'tous réalisés'}
                            </div>
                          </div>
                          <div className="stat-jauge" aria-hidden="true">
                            <span style={{ width: `${stats.totalParcours ? (stats.parcoursCompleted / stats.totalParcours) * 100 : 0}%` }} />
                          </div>
                        </div>

                        <div data-testid="stats-attempts-count" className="stat-card">
                          <div className="stat-content">
                            <div data-testid="stats-attempts-count-value" className="stat-value">{stats.passwordAttemptsCount}</div>
                            <div className="stat-label">tentatives de mot de passe</div>
                            <div className="stat-reste">depuis le début du rallye</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div data-testid="stats-error" className="error-state">Erreur lors du chargement des statistiques.</div>
                    )}
                  </div>
                )}

                {/* L'équipe s'affiche d'emblée : ses membres et les demandes en
                    attente sont ce qu'on vient consulter, pas ce qu'on déplie. */}
                {teamLoading ? (
                  <div data-testid="team-loading" className="loading-state">Chargement...</div>
                ) : team ? (
                  <>
                    <div data-testid="team-header" className="team-header">
                      <h3 data-testid="team-name">{team.teamName}</h3>
                      <p data-testid="team-payment-status" className="paid">
                        {team.members.length} membre{team.members.length > 1 ? 's' : ''}
                        {team.pendingRequests && team.pendingRequests.length > 0
                          ? ` · ${team.pendingRequests.length} demande${team.pendingRequests.length > 1 ? 's' : ''} en attente`
                          : ''}
                      </p>
                    </div>

                    {(
                      <>
                        <div className="info-box" style={{ marginBottom: '20px' }}>
                          <p>
                            N'oubliez pas d'inviter les autres membres de votre équipe à s'inscrire et à rejoindre cette équipe !
                          </p>
                        </div>

                        <div data-testid="team-members" className="team-members">
                          <h4>Membres ({team.members.length})</h4>
                          <ul data-testid="team-members-list" className="members-list">
                            {team.members.map((member: any) => (
                              <li data-testid={`team-member-row-${member.userId}`} key={member.userId}>
                                {member.displayName}
                                {member.userId === team.leaderId && (
                                  <span data-testid={`team-leader-badge-${member.userId}`} className="badge">Chef</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {isMember && team.pendingRequests && team.pendingRequests.length > 0 && (
                          <div data-testid="team-pending-requests" className="pending-requests-section">
                            <h4>Demandes en attente ({team.pendingRequests.length})</h4>
                            <ul data-testid="team-requests-list" className="requests-list">
                              {team.pendingRequests.map((request: any) => (
                                <li data-testid={`team-request-row-${request.userId}`} key={request.userId}>
                                  <span>{request.displayName}</span>
                                  <div className="request-actions">
                                    <button data-testid={`team-request-approve-${request.userId}`}
                                      className="btn btn-small btn-success"
                                      onClick={() => approveMutation.mutate({ userId: request.userId })}
                                      disabled={approveMutation.isPending}
                                    >
                                      Accepter
                                    </button>
                                    <button data-testid={`team-request-reject-${request.userId}`}
                                      className="btn btn-small btn-danger"
                                      onClick={() => rejectMutation.mutate({ userId: request.userId })}
                                      disabled={rejectMutation.isPending}
                                    >
                                      Refuser
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}

                    <div className="logout-section">
                      <button data-testid="nav-logout-button" className="btn btn-logout" onClick={handleLogout}>
                        Déconnexion
                      </button>
                    </div>
                  </>
                ) : (
                  <div data-testid="team-not-found" className="error-state">Équipe introuvable</div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default StatsPanel;
