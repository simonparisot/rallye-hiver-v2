import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Enigma } from '../../types';
import { getEnigmasWithProgress, getEnigmasPreview, submitPasswordAttempt } from '../../services/gameService';
import { teamAPI, hintsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import PDFViewer from '../PDFViewer';
import ConfirmationModal from '../ConfirmationModal';
import './EnigmasPanel.css';

interface EnigmasPanelProps {
  isExpanded: boolean;
  isCompact: boolean;
  onExpand: () => void;
}

/**
 * État d'une énigme du point de vue du participant.
 *
 * Rien ne distinguait jusqu'ici une énigme résolue d'une énigme jamais ouverte :
 * les vingt cartes étaient identiques, et retrouver où l'on en était supposait
 * de toutes les parcourir.
 */
type EtatEnigme = 'resolue' | 'tentee' | 'vierge';

function etatDe(enigma: { isSolved: boolean; attemptCount?: number }): EtatEnigme {
  if (enigma.isSolved) return 'resolue';
  return (enigma.attemptCount ?? 0) > 0 ? 'tentee' : 'vierge';
}

function libelleEtat(enigma: { isSolved: boolean; attemptCount?: number }): string | null {
  const n = enigma.attemptCount ?? 0;
  if (enigma.isSolved) return 'Résolue';
  if (n > 0) return n === 1 ? '1 essai' : `${n} essais`;
  // Une énigme jamais ouverte est le cas courant : le dire sur chacune des
  // vingt cartes n'apprendrait rien et alourdirait la liste.
  return null;
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

  // Hint state
  const [showHintModal, setShowHintModal] = useState(false);
  const [hintPdfUrl, setHintPdfUrl] = useState<string | null>(null);
  const [showingHint, setShowingHint] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);

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
    // Reset hint state
    setShowingHint(false);
    setHintPdfUrl(null);
    if (!isExpanded) {
      onExpand();
    }
  };

  const handleHintClick = async () => {
    if (!selectedEnigma) return;

    // If hint already used, just fetch and show it
    if (selectedEnigma.hintUsed) {
      setHintLoading(true);
      try {
        const result = await hintsAPI.useHint(selectedEnigma.id);
        setHintPdfUrl(result.hintPdfUrl);
        setShowingHint(true);
      } catch (error) {
        console.error('Failed to get hint:', error);
      } finally {
        setHintLoading(false);
      }
    } else {
      // Show confirmation modal for first use
      setShowHintModal(true);
    }
  };

  const handleHintConfirm = async () => {
    setShowHintModal(false);
    if (!selectedEnigma) return;

    setHintLoading(true);
    try {
      const result = await hintsAPI.useHint(selectedEnigma.id);
      setHintPdfUrl(result.hintPdfUrl);
      setShowingHint(true);
      // Refresh enigmas to update hintUsed status
      queryClient.invalidateQueries({ queryKey: ['enigmas-with-progress'] });
    } catch (error) {
      console.error('Failed to use hint:', error);
    } finally {
      setHintLoading(false);
    }
  };

  const handleBackToEnigma = () => {
    setShowingHint(false);
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
      <div className={`enigmas-panel ${isCompact ? 'panel-compact' : ''}`} data-testid="enigma-panel">
        <div className="panel-header">
          <h2>Énigmes</h2>
        </div>
        <div className="panel-content">
          <div className="loading-state" data-testid="enigma-loading">Chargement des énigmes...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`enigmas-panel ${isCompact ? 'panel-compact' : ''}`} data-testid="enigma-panel">
        <div className="panel-header">
          <h2>Énigmes</h2>
        </div>
        <div className="panel-content">
          <div className="error-state" data-testid="enigma-error">Erreur lors du chargement des énigmes. Veuillez réessayer.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`enigmas-panel ${isCompact ? 'panel-compact' : ''}`} data-testid="enigma-panel">
      <div className="panel-header">
        <h2>Énigmes</h2>
      </div>
      <div className="panel-content">
        {!hasAccess && (
          <div className="access-blocked-message" data-testid="enigma-access-blocked">
            Rejoignez ou créez une équipe et réglez les frais d'inscription pour accéder aux énigmes.
          </div>
        )}
        {!isExpanded ? (
          // Compact view: Just list titles
          <div className="enigma-list-compact" data-testid="enigma-list-compact">
            {enigmas.map((enigma) => (
              <div
                key={enigma.id}
                data-testid={`enigma-card-${enigma.order}`}
                className={`enigma-item-compact etat-${etatDe(enigma)} ${enigma.isSolved ? 'solved' : ''} ${!hasAccess ? 'locked' : ''}`}
                onClick={() => hasAccess && handleEnigmaSelect(enigma)}
              >
                <span className={`enigma-number pastille-${etatDe(enigma)}`}>{enigma.order}</span>
                <span className="enigma-title-compact">{enigma.title}</span>
                {libelleEtat(enigma) && (
                  <span className={`enigma-etat etat-${etatDe(enigma)}`}>{libelleEtat(enigma)}</span>
                )}
                {enigma.isSolved && <span className="solved-badge-small visually-hidden" data-testid={`enigma-solved-badge-${enigma.order}`}>Résolu</span>}
              </div>
            ))}
          </div>
        ) : (
          // Expanded view: List + PDF viewer
          <div className="enigma-expanded-view" data-testid="enigma-expanded-view">
            <div className="enigma-list-full" data-testid="enigma-list">
              {enigmas.map((enigma) => (
                <div
                  key={enigma.id}
                  data-testid={`enigma-card-${enigma.order}`}
                  className={`enigma-item etat-${etatDe(enigma)} ${selectedEnigma?.id === enigma.id ? 'active' : ''} ${
                    enigma.isSolved ? 'solved' : ''
                  }`}
                  onClick={() => handleEnigmaSelect(enigma)}
                >
                  <div className="enigma-header-item">
                    <span className={`enigma-number pastille-${etatDe(enigma)}`}>{enigma.order}</span>
                    <span className="enigma-title">{enigma.title}</span>
                    {libelleEtat(enigma) && (
                  <span className={`enigma-etat etat-${etatDe(enigma)}`}>{libelleEtat(enigma)}</span>
                )}
                    {enigma.pdfUrl && selectedEnigma?.id === enigma.id && (
                      <button
                        data-testid={`enigma-download-button-${enigma.order}`}
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
                    <div className="enigma-meta visually-hidden">
                      <span className="solved-badge" data-testid={`enigma-solved-badge-${enigma.order}`}>Résolue</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="enigma-viewer" data-testid="enigma-viewer">
              {selectedEnigma ? (
                <div className="enigma-details" data-testid="enigma-details">
                  {selectedEnigma.isSolved && (
                    <div className="enigma-solved-banner" data-testid="enigma-solved-banner">
                      ✅ Énigme déjà résolue
                    </div>
                  )}
                  {/* L'énoncé vient avant la réponse : le geste attendu ne doit pas
                      précéder l'information qui le rend possible. */}
                  {/* PDF Viewer - show hint or enigma */}
                  {showingHint && hintPdfUrl ? (
                    <div className="enigma-pdf-container hint-pdf" data-testid="hint-pdf-container">
                      <div className="hint-pdf-header">Indice</div>
                      <PDFViewer pdfUrl={hintPdfUrl} title={`Indice - ${selectedEnigma.title}`} />
                    </div>
                  ) : selectedEnigma.pdfUrl ? (
                    <div className="enigma-pdf-container" data-testid="enigma-pdf-container">
                      <PDFViewer pdfUrl={selectedEnigma.pdfUrl} title={selectedEnigma.title} />
                    </div>
                  ) : (
                    <div className="enigma-pdf-placeholder" data-testid="enigma-pdf-placeholder">
                      <p>PDF non disponible</p>
                      <p className="pdf-note">Le PDF de cette enigme n'est pas encore disponible</p>
                    </div>
                  )}
                  {/* Hint button and toggle */}
                  {selectedEnigma.hasHint && !selectedEnigma.isSolved && (
                    <div className="hint-section" data-testid="hint-section">
                      {showingHint ? (
                        <button
                          data-testid="hint-back-button"
                          className="hint-button hint-back-btn"
                          onClick={handleBackToEnigma}
                        >
                          Retour a l'enigme
                        </button>
                      ) : (
                        <button
                          data-testid="hint-button"
                          className={`hint-button ${selectedEnigma.hintUsed ? 'hint-used' : ''}`}
                          onClick={handleHintClick}
                          disabled={hintLoading}
                        >
                          {hintLoading ? 'Chargement...' : selectedEnigma.hintUsed ? 'Revoir l\'indice' : 'Avoir un indice'}
                        </button>
                      )}
                      {selectedEnigma.hintUsed && !showingHint && (
                        <span className="hint-used-badge" data-testid="hint-used-badge">Indice utilise</span>
                      )}
                    </div>
                  )}
                  <form className="password-form password-form-compact" data-testid="enigma-password-form" onSubmit={handlePasswordSubmit}>
                    <input
                      type="text"
                      placeholder={selectedEnigma.isSolved ? "Retester un mot de passe" : "Entrez le mot de passe"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="password-input"
                      data-testid="enigma-password-input"
                      disabled={passwordMutation.isPending}
                    />
                    <button
                      type="submit"
                      data-testid="enigma-submit"
                      className="submit-btn submit-btn-principal"
                      disabled={passwordMutation.isPending || !password.trim()}
                    >
                      {passwordMutation.isPending ? 'Envoi…' : 'Valider ma réponse'}
                    </button>
                  </form>
                  {attemptMessage && (
                    <div className={`attempt-message ${attemptSuccess === true ? 'attempt-success' : 'attempt-error'}`} data-testid={attemptSuccess === true ? 'enigma-attempt-success' : 'enigma-attempt-error'}>
                      {attemptMessage}
                    </div>
                  )}
                </div>
              ) : (
                <div className="enigma-placeholder" data-testid="enigma-placeholder">
                  <p>Sélectionnez une énigme pour voir son PDF</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hint confirmation modal */}
      <ConfirmationModal
        isOpen={showHintModal}
        title="Utiliser un indice"
        message="Attention ! L'utilisation d'un indice coute 25% des points de cette enigme. Cette action est irreversible. Voulez-vous continuer ?"
        confirmText="Voir l'indice"
        cancelText="Annuler"
        onConfirm={handleHintConfirm}
        onCancel={() => setShowHintModal(false)}
        variant="warning"
      />
    </div>
  );
};

export default EnigmasPanel;
