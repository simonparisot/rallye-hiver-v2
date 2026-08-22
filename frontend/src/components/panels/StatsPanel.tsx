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
  const [showTeamDetails, setShowTeamDetails] = useState(false);

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

            {/* Unified Dashboard Section - Stats + Discord + Team */}
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
                            <div className="stat-label">Énigmes Résolues</div>
                          </div>
                        </div>

                        <div data-testid="stats-parcours-completed" className="stat-card">
                          <div className="stat-content">
                            <div data-testid="stats-parcours-completed-value" className="stat-value">
                              {stats.parcoursCompleted} / {stats.totalParcours}
                            </div>
                            <div className="stat-label">Parcours Complétés</div>
                          </div>
                        </div>

                        <div data-testid="stats-attempts-count" className="stat-card">
                          <div className="stat-content">
                            <div data-testid="stats-attempts-count-value" className="stat-value">{stats.passwordAttemptsCount}</div>
                            <div className="stat-label">Tentatives de mots de passe</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div data-testid="stats-error" className="error-state">Erreur lors du chargement des statistiques.</div>
                    )}
                  </div>
                )}

                {/* Discord Section - Second */}
                <div data-testid="stats-discord-link"
                  className="discord-card"
                  onClick={() => window.open('https://discord.gg/cqSCHwSg', '_blank')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="discord-icon">
                    <svg width="24" height="24" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <g clipPath="url(#clip0)">
                        <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" fill="#5865F2"/>
                      </g>
                    </svg>
                  </div>
                  <div className="discord-content">
                    <h4 className="discord-title">Rejoignez notre Discord</h4>
                    <p className="discord-text">
                      Échangez avec les autres équipes, posez vos questions et partagez vos réussites !
                    </p>
                  </div>
                </div>

                {/* Team Section - Third (clickable) */}
                {teamLoading ? (
                  <div data-testid="team-loading" className="loading-state">Chargement...</div>
                ) : team ? (
                  <>
                    <div data-testid="team-header"
                      className="team-header"
                      onClick={() => setShowTeamDetails(!showTeamDetails)}
                      style={{ cursor: 'pointer' }}
                    >
                      <h3 data-testid="team-name">{team.teamName}</h3>
                      <p data-testid="team-payment-status" className="paid">
                        {team.pendingRequests && team.pendingRequests.length > 0
                          ? `${team.pendingRequests.length} demande${team.pendingRequests.length > 1 ? 's' : ''} en attente - `
                          : ''}
                        Cliquez ici pour plus d'info
                      </p>
                    </div>

                    {showTeamDetails && (
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
