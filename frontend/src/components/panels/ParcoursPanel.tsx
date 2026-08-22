import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Parcours } from '../../types';
import { getParcoursWithAccess, getParcoursPreview } from '../../services/gameService';
import { teamAPI, parcoursAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import PDFViewer from '../PDFViewer';
import './ParcoursPanel.css';

interface ParcoursPanelProps {
  isExpanded: boolean;
  isCompact: boolean;
  onExpand: () => void;
}

const ParcoursPanel: React.FC<ParcoursPanelProps> = ({ isExpanded, isCompact, onExpand }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: team } = useQuery({
    queryKey: ['team', user?.teamId],
    queryFn: () => teamAPI.getTeam(user!.teamId!),
    enabled: !!user?.teamId,
  });

  const hasAccess = !!user?.teamId && !!team?.hasPaid;

  // Get parcours with access if team has paid, otherwise get preview
  const { data: parcoursList = [], isLoading, error } = useQuery({
    queryKey: hasAccess ? ['parcours-with-access'] : ['parcours-preview'],
    queryFn: hasAccess ? getParcoursWithAccess : getParcoursPreview,
    enabled: true, // Always fetch, even without team (for preview)
    staleTime: 5 * 60 * 1000, // 5 minutes - aligns with backend cache
    gcTime: 10 * 60 * 1000, // 10 minutes - garbage collection time
  });

  const [selectedParcours, setSelectedParcours] = useState<Parcours | null>(null);
  const [completionMessage, setCompletionMessage] = useState('');

  const markCompletedMutation = useMutation({
    mutationFn: (parcoursId: string) => parcoursAPI.markCompleted(parcoursId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parcours-with-access'] });
      queryClient.invalidateQueries({ queryKey: ['team-stats'] });
      setCompletionMessage('✅ Parcours déclaré comme réalisé !');
      setTimeout(() => setCompletionMessage(''), 4000);
    },
    onError: (error: any) => {
      console.error('Error marking parcours as completed:', error);
      setCompletionMessage('❌ Erreur lors de la déclaration');
      setTimeout(() => setCompletionMessage(''), 4000);
    },
  });

  const unmarkCompletedMutation = useMutation({
    mutationFn: (parcoursId: string) => parcoursAPI.unmarkCompleted(parcoursId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parcours-with-access'] });
      queryClient.invalidateQueries({ queryKey: ['team-stats'] });
      setCompletionMessage('↩️ Statut réalisé annulé');
      setTimeout(() => setCompletionMessage(''), 4000);
    },
    onError: (error: any) => {
      console.error('Error unmarking parcours completion:', error);
      setCompletionMessage('❌ Erreur lors de l\'annulation');
      setTimeout(() => setCompletionMessage(''), 4000);
    },
  });

  const handleParcoursSelect = (parcours: Parcours) => {
    setSelectedParcours(parcours);
    setCompletionMessage('');
    if (!isExpanded) {
      onExpand();
    }
  };

  const handleMarkCompleted = () => {
    if (selectedParcours && !selectedParcours.isCompleted) {
      markCompletedMutation.mutate(selectedParcours.id);
    }
  };

  const handleUnmarkCompleted = () => {
    if (selectedParcours && selectedParcours.isCompleted) {
      unmarkCompletedMutation.mutate(selectedParcours.id);
    }
  };

  const handleDownload = (e: React.MouseEvent, parcours: Parcours) => {
    e.stopPropagation(); // Prevent parcours selection
    if (parcours.pdfUrl) {
      window.open(parcours.pdfUrl, '_blank');
    }
  };

  // No early return - we'll show preview even without team

  if (isLoading) {
    return (
      <div className={`parcours-panel ${isCompact ? 'panel-compact' : ''}`} data-testid="parcours-panel">
        <div className="panel-header">
          <h2>Parcours</h2>
        </div>
        <div className="panel-content">
          <div className="loading-state" data-testid="parcours-loading">Chargement des parcours...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`parcours-panel ${isCompact ? 'panel-compact' : ''}`} data-testid="parcours-panel">
        <div className="panel-header">
          <h2>Parcours</h2>
        </div>
        <div className="panel-content">
          <div className="error-state" data-testid="parcours-error">Erreur lors du chargement des parcours. Veuillez réessayer.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`parcours-panel ${isCompact ? 'panel-compact' : ''}`} data-testid="parcours-panel">
      <div className="panel-header">
        <h2>Parcours</h2>
      </div>
      <div className="panel-content">
        {!hasAccess && (
          <div className="access-blocked-message" data-testid="parcours-access-blocked">
            Rejoignez ou créez une équipe et réglez les frais d'inscription pour accéder aux parcours.
          </div>
        )}
        {!isExpanded ? (
          // Compact view: Just list titles with numbers
          <div className="parcours-list-compact" data-testid="parcours-list-compact">
            {parcoursList.map((parcours, index) => (
              <div
                key={parcours.id}
                data-testid={`parcours-card-${parcours.order}`}
                className={`parcours-item-compact ${parcours.isCompleted ? 'completed' : ''} ${!hasAccess ? 'locked' : ''}`}
                onClick={() => hasAccess && handleParcoursSelect(parcours)}
              >
                <span className="parcours-number">{index + 1}</span>
                <span className="parcours-title-compact">{parcours.title}</span>
                {parcours.isCompleted && <span className="completed-badge-small" data-testid={`parcours-completed-badge-${parcours.order}`}>Réalisé</span>}
              </div>
            ))}
          </div>
        ) : (
          // Expanded view: List + PDF viewer
          <div className="parcours-expanded-view" data-testid="parcours-expanded-view">
            <div className="parcours-list-full" data-testid="parcours-list">
              {parcoursList.map((parcours, index) => (
                <div
                  key={parcours.id}
                  data-testid={`parcours-card-${parcours.order}`}
                  className={`parcours-item ${selectedParcours?.id === parcours.id ? 'active' : ''} ${
                    parcours.isCompleted ? 'completed' : ''
                  }`}
                  onClick={() => handleParcoursSelect(parcours)}
                >
                  <div className="parcours-header-item">
                    <span className="parcours-number">{index + 1}</span>
                    <span className="parcours-title">{parcours.title}</span>
                    {parcours.pdfUrl && selectedParcours?.id === parcours.id && (
                      <button
                        data-testid={`parcours-download-button-${parcours.order}`}
                        className="parcours-download-btn"
                        onClick={(e) => handleDownload(e, parcours)}
                        title="Télécharger le PDF"
                        aria-label="Télécharger le PDF"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 15l-5-5h3V4h4v6h3l-5 5z"/>
                          <path d="M5 18h14v2H5z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  {parcours.isCompleted && (
                    <div className="parcours-meta">
                      <span className="completed-badge" data-testid={`parcours-completed-badge-${parcours.order}`}>Réalisé</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="parcours-viewer" data-testid="parcours-viewer">
              {selectedParcours ? (
                <div className="parcours-details" data-testid="parcours-details">
                  {hasAccess && (
                    <div className="parcours-header-detail">
                      <div className="parcours-completion-section">
                        {selectedParcours.isCompleted ? (
                          <div className="parcours-completed-container">
                            <div className="parcours-completed-badge" data-testid="parcours-completed-banner">
                              ✅ Parcours réalisé
                              {selectedParcours.completedAt && (
                                <span className="completed-date">
                                  {' '}le {new Date(selectedParcours.completedAt).toLocaleDateString('fr-FR')}
                                </span>
                              )}
                            </div>
                            <button
                              data-testid="parcours-uncomplete-button"
                              className="btn-unmark-completed"
                              onClick={handleUnmarkCompleted}
                              disabled={unmarkCompletedMutation.isPending}
                              title="Annuler le marquage comme réalisé"
                            >
                              {unmarkCompletedMutation.isPending ? 'Annulation...' : 'Annuler'}
                            </button>
                          </div>
                        ) : (
                          <button
                            data-testid="parcours-complete-button"
                            className="btn-mark-completed"
                            onClick={handleMarkCompleted}
                            disabled={markCompletedMutation.isPending}
                          >
                            {markCompletedMutation.isPending ? 'Marquage...' : 'Marquer comme réalisé'}
                          </button>
                        )}
                        {completionMessage && (
                          <div className={`completion-message ${completionMessage.includes('✅') || completionMessage.includes('↩️') ? 'success' : 'error'}`} data-testid="parcours-completion-message">
                            {completionMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {selectedParcours.pdfUrl ? (
                    <div className="parcours-pdf-container" data-testid="parcours-pdf-container">
                      <PDFViewer pdfUrl={selectedParcours.pdfUrl} title={selectedParcours.title} />
                    </div>
                  ) : (
                    <div className="parcours-pdf-placeholder" data-testid="parcours-pdf-placeholder">
                      <p>PDF non disponible</p>
                      <p className="pdf-note">Le PDF de ce parcours n'est pas encore disponible</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="parcours-placeholder" data-testid="parcours-placeholder">
                  <p>Sélectionnez un parcours pour voir son PDF</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParcoursPanel;
