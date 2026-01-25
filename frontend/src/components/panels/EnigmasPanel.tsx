import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Enigma } from '../../types';
import { getEnigmasWithProgress, getEnigmasPreview, submitPasswordAttempt } from '../../services/gameService';
import { teamAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import PDFViewer from '../PDFViewer';
import './EnigmasPanel.css';

interface EnigmasPanelProps {
  isExpanded: boolean;
  isCompact: boolean;
  onExpand: () => void;
}

const EnigmasPanel: React.FC<EnigmasPanelProps> = ({ isExpanded, isCompact, onExpand }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: team } = useQuery({
    queryKey: ['team', user?.teamId],
    queryFn: () => teamAPI.getTeam(user!.teamId!),
    enabled: !!user?.teamId,
  });

  const hasAccess = !!user?.teamId && !!team?.hasPaid;

  // Get enigmas with progress if team has paid, otherwise get preview
  const { data: enigmas = [], isLoading, error } = useQuery({
    queryKey: hasAccess ? ['enigmas-with-progress'] : ['enigmas-preview'],
    queryFn: hasAccess ? getEnigmasWithProgress : getEnigmasPreview,
    enabled: true, // Always fetch, even without team (for preview)
    staleTime: 5 * 60 * 1000, // 5 minutes - aligns with backend cache
    gcTime: 10 * 60 * 1000, // 10 minutes - garbage collection time
  });

  const [selectedEnigma, setSelectedEnigma] = useState<Enigma | null>(null);
  const [password, setPassword] = useState('');
  const [attemptMessage, setAttemptMessage] = useState('');
  const [attemptSuccess, setAttemptSuccess] = useState<boolean | null>(null);

  const passwordMutation = useMutation({
    mutationFn: ({ enigmaId, password }: { enigmaId: string; password: string }) =>
      submitPasswordAttempt(enigmaId, password),
    onSuccess: (data) => {
      if (data.success) {
        // Refresh enigmas and progress
        queryClient.invalidateQueries({ queryKey: ['enigmas-with-progress'] });
        queryClient.invalidateQueries({ queryKey: ['parcours-with-access'] });
        queryClient.invalidateQueries({ queryKey: ['team-stats'] });
      }
    },
  });

  const handleEnigmaSelect = (enigma: Enigma) => {
    setSelectedEnigma(enigma);
    setPassword('');
    setAttemptMessage('');
    setAttemptSuccess(null);
    if (!isExpanded) {
      onExpand();
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnigma || !password.trim()) return;

    try {
      const result = await passwordMutation.mutateAsync({
        enigmaId: selectedEnigma.id,
        password: password.trim(),
      });

      setAttemptMessage(result.message);
      setAttemptSuccess(result.success);

      if (result.success) {
        setPassword('');
        // Show success message for 4 seconds
        setTimeout(() => {
          setAttemptMessage('');
          setAttemptSuccess(null);
        }, 4000);
      } else {
        // Show error message for 2 minutes
        setTimeout(() => {
          setAttemptMessage('');
          setAttemptSuccess(null);
        }, 120000);
      }
    } catch (error) {
      setAttemptMessage('Une erreur est survenue. Veuillez réessayer.');
      setAttemptSuccess(false);
      setTimeout(() => {
        setAttemptMessage('');
        setAttemptSuccess(null);
      }, 120000);
    }
  };

  const handleDownload = (e: React.MouseEvent, enigma: Enigma) => {
    e.stopPropagation(); // Prevent enigma selection
    if (enigma.pdfUrl) {
      window.open(enigma.pdfUrl, '_blank');
    }
  };

  // No early return - we'll show preview even without team

  if (isLoading) {
    return (
      <div className={`enigmas-panel ${isCompact ? 'panel-compact' : ''}`}>
        <div className="panel-header">
          <h2>Énigmes</h2>
        </div>
        <div className="panel-content">
          <div className="loading-state">Chargement des énigmes...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`enigmas-panel ${isCompact ? 'panel-compact' : ''}`}>
        <div className="panel-header">
          <h2>Énigmes</h2>
        </div>
        <div className="panel-content">
          <div className="error-state">Erreur lors du chargement des énigmes. Veuillez réessayer.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`enigmas-panel ${isCompact ? 'panel-compact' : ''}`}>
      <div className="panel-header">
        <h2>Énigmes</h2>
      </div>
      <div className="panel-content">
        {!hasAccess && (
          <div className="access-blocked-message">
            Rejoignez ou créez une équipe et réglez les frais d'inscription pour accéder aux énigmes.
          </div>
        )}
        {!isExpanded ? (
          // Compact view: Just list titles
          <div className="enigma-list-compact">
            {enigmas.map((enigma) => (
              <div
                key={enigma.id}
                className={`enigma-item-compact ${enigma.isSolved ? 'solved' : ''} ${!hasAccess ? 'locked' : ''}`}
                onClick={() => hasAccess && handleEnigmaSelect(enigma)}
              >
                <span className="enigma-number">{enigma.order}</span>
                <span className="enigma-title-compact">{enigma.title}</span>
                {enigma.isSolved && <span className="solved-badge-small">Résolu</span>}
              </div>
            ))}
          </div>
        ) : (
          // Expanded view: List + PDF viewer
          <div className="enigma-expanded-view">
            <div className="enigma-list-full">
              {enigmas.map((enigma) => (
                <div
                  key={enigma.id}
                  className={`enigma-item ${selectedEnigma?.id === enigma.id ? 'active' : ''} ${
                    enigma.isSolved ? 'solved' : ''
                  }`}
                  onClick={() => handleEnigmaSelect(enigma)}
                >
                  <div className="enigma-header-item">
                    <span className="enigma-number">{enigma.order}</span>
                    <span className="enigma-title">{enigma.title}</span>
                    {enigma.pdfUrl && selectedEnigma?.id === enigma.id && (
                      <button
                        className="enigma-download-btn"
                        onClick={(e) => handleDownload(e, enigma)}
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
                  {enigma.isSolved && (
                    <div className="enigma-meta">
                      <span className="solved-badge">Résolue</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="enigma-viewer">
              {selectedEnigma ? (
                <div className="enigma-details">
                  {selectedEnigma.isSolved && (
                    <div className="enigma-solved-banner">
                      ✅ Énigme déjà résolue
                    </div>
                  )}
                  <form className="password-form password-form-compact" onSubmit={handlePasswordSubmit}>
                    <input
                      type="text"
                      placeholder={selectedEnigma.isSolved ? "Retester un mot de passe" : "Entrez le mot de passe"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="password-input"
                      disabled={passwordMutation.isPending}
                    />
                    <button
                      type="submit"
                      className="submit-btn btn-small"
                      disabled={passwordMutation.isPending || !password.trim()}
                    >
                      {passwordMutation.isPending ? 'Envoi...' : 'Tester'}
                    </button>
                  </form>
                  {attemptMessage && (
                    <div className={`attempt-message ${attemptSuccess === true ? 'attempt-success' : 'attempt-error'}`}>
                      {attemptMessage}
                    </div>
                  )}
                  {selectedEnigma.pdfUrl ? (
                    <div className="enigma-pdf-container">
                      <PDFViewer pdfUrl={selectedEnigma.pdfUrl} title={selectedEnigma.title} />
                    </div>
                  ) : (
                    <div className="enigma-pdf-placeholder">
                      <p>PDF non disponible</p>
                      <p className="pdf-note">Le PDF de cette énigme n'est pas encore disponible</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="enigma-placeholder">
                  <p>Sélectionnez une énigme pour voir son PDF</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnigmasPanel;
