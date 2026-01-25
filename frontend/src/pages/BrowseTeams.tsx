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

  if (isLoading) return <div className="loading">Chargement...</div>;
  if (error) return <div className="error">Erreur lors du chargement des équipes</div>;

  return (
    <div className="browse-teams">
      <h1>Parcourir les équipes</h1>
      <div className="teams-grid">
        {data?.teams.map((team) => (
          <div key={team.teamId} className="team-card">
            <h3>{team.teamName}</h3>
            <p>{team.memberCount} membre{team.memberCount > 1 ? 's' : ''}</p>
            <p className={team.hasPaid ? 'paid' : 'unpaid'}>
              {team.hasPaid ? '✓ Payé' : '✗ Non payé'}
            </p>
            {!user?.teamId && (
              <button
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
