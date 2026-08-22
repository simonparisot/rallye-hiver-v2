import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userAPI, teamAPI } from '../../services/api';
import './PendingRequests.css';

const PendingRequests: React.FC = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: pendingRequestsData, isLoading: loading } = useQuery({
    queryKey: ['pending-requests'],
    queryFn: () => userAPI.getPendingRequests(),
  });

  const cancelMutation = useMutation({
    mutationFn: (teamId: string) => teamAPI.cancelJoinRequest(teamId),
    onSuccess: () => {
      // Invalidate and refetch pending requests
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
      setError(null);
    },
    onError: (err: any) => {
      console.error('Error cancelling request:', err);
      setError('Impossible d\'annuler la demande');
    },
  });

  const pendingRequests = pendingRequestsData?.pendingRequests || [];

  if (loading) {
    return <div data-testid="team-pending-requests-loading" className="pending-requests-loading">Chargement...</div>;
  }

  if (error) {
    return <div data-testid="team-pending-requests-error" className="pending-requests-error">{error}</div>;
  }

  if (pendingRequests.length === 0) {
    return null;
  }

  return (
    <div data-testid="team-pending-requests-sent" className="pending-requests">
      <h3>Demandes d'adhésion en attente</h3>
      <p className="pending-requests-description">
        Vous avez {pendingRequests.length} demande{pendingRequests.length > 1 ? 's' : ''} d'adhésion en attente de validation.
        <br />
        <em>Vous ne pouvez pas créer ou rejoindre une autre équipe tant qu'une demande est en attente.</em>
      </p>
      <div data-testid="team-pending-requests-sent-list" className="pending-requests-list">
        {pendingRequests.map((request) => (
          <div data-testid={`team-pending-request-row-${request.teamId}`} key={request.teamId} className="pending-request-item">
            <div className="pending-request-info">
              <strong>{request.teamName}</strong>
              <span className="pending-status">En attente</span>
            </div>
            <div className="pending-request-actions">
              <button data-testid={`team-pending-request-cancel-${request.teamId}`}
                className="btn btn-sm btn-danger"
                onClick={() => cancelMutation.mutate(request.teamId)}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? 'Annulation...' : 'Annuler'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingRequests;
