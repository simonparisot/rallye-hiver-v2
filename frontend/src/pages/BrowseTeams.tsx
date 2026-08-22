import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../utils/errorMessages';
import './Team.css';

const BrowseTeams: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamAPI.listTeams(),
  });

  const joinMutation = useMutation({
    mutationFn: (teamId: string) => teamAPI.joinTeam(teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      refreshUser();
      alert('Demande d\'adhésion envoyée !');
    },
    onError: (err: any) => {
      alert(getErrorMessage(err, 'Échec de la demande'));
    },
  });

  if (isLoading) return <div data-testid="team-list-loading" className="loading">Chargement...</div>;
  if (error) return <div data-testid="team-list-error" className="error">Erreur lors du chargement des équipes</div>;

  return (
    <div data-testid="team-browse-page" className="browse-teams">
      <h1>Parcourir les équipes</h1>
      <div data-testid="team-list" className="teams-grid">
        {data?.teams.map((team) => (
          <div data-testid={`team-row-${team.teamId}`} key={team.teamId} className="team-card">
            <h3 data-testid={`team-row-name-${team.teamId}`}>{team.teamName}</h3>
            <p>{team.memberCount} membre{team.memberCount > 1 ? 's' : ''}</p>
            <p data-testid={`team-row-payment-status-${team.teamId}`} className={team.hasPaid ? 'paid' : 'unpaid'}>
              {team.hasPaid ? '✓ Payé' : '✗ Non payé'}
            </p>
            {!user?.teamId && (
              <button data-testid={`team-join-button-${team.teamId}`}
                className="btn btn-primary"
                onClick={() => joinMutation.mutate(team.teamId)}
                disabled={joinMutation.isPending}
              >
                {joinMutation.isPending ? 'Envoi...' : 'Demander à rejoindre'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BrowseTeams;
