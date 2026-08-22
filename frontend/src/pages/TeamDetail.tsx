import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamAPI, paymentAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './Team.css';

const TeamDetail: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: team, isLoading } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => teamAPI.getTeam(teamId!),
    enabled: !!teamId,
  });

  const approveMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) => teamAPI.approveRequest(teamId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) => teamAPI.rejectRequest(teamId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: () => paymentAPI.createCheckout(teamId!),
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
  });

  if (isLoading) return <div data-testid="team-detail-loading" className="loading">Chargement...</div>;
  if (!team) return <div data-testid="team-not-found" className="error">Équipe introuvable</div>;

  const isLeader = team.leaderId === user?.userId;
  const isMember = team.members.some(m => m.userId === user?.userId);

  return (
    <div data-testid="team-detail-page" className="team-detail">
      <h1 data-testid="team-name">{team.teamName}</h1>

      <div className="team-status">
        <p data-testid="team-payment-status" className={team.hasPaid ? 'paid' : 'unpaid'}>
          {team.hasPaid ? '✓ Équipe payée' : '✗ Paiement requis'}
        </p>
      </div>

      <div data-testid="team-members" className="team-section">
        <h2>Membres ({team.members.length})</h2>
        <ul data-testid="team-members-list" className="members-list">
          {team.members.map((member) => (
            <li data-testid={`team-member-row-${member.userId}`} key={member.userId}>
              {member.displayName}
              {member.userId === team.leaderId && <span data-testid={`team-leader-badge-${member.userId}`} className="badge">Chef</span>}
            </li>
          ))}
        </ul>
      </div>

      {isMember && team.pendingRequests && team.pendingRequests.length > 0 && (
        <div data-testid="team-pending-requests" className="team-section">
          <h2>Demandes en attente ({team.pendingRequests.length})</h2>
          <ul data-testid="team-requests-list" className="requests-list">
            {team.pendingRequests.map((request) => (
              <li data-testid={`team-request-row-${request.userId}`} key={request.userId}>
                <span>{request.displayName}</span>
                <div className="request-actions">
                  <button data-testid={`team-request-approve-${request.userId}`}
                    className="btn btn-small btn-success"
                    onClick={() => approveMutation.mutate({ userId: request.userId })}
                    disabled={approveMutation.isPending}
                  >
                    Approuver
                  </button>
                  <button data-testid={`team-request-reject-${request.userId}`}
                    className="btn btn-small btn-danger"
                    onClick={() => rejectMutation.mutate({ userId: request.userId })}
                    disabled={rejectMutation.isPending}
                  >
                    Rejeter
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isLeader && !team.hasPaid && (
        <div data-testid="team-payment-section" className="team-section">
          <button data-testid="team-pay-button"
            className="btn btn-primary btn-large"
            onClick={() => paymentMutation.mutate()}
            disabled={paymentMutation.isPending}
          >
            {paymentMutation.isPending ? 'Redirection...' : 'Payer maintenant'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TeamDetail;
