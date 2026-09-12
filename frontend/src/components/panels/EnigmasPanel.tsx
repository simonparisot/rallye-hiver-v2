import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Enigma } from '../../types';
import { edition } from '../../editions';
import { getEnigmasWithProgress, getEnigmasPreview, submitPasswordAttempt } from '../../services/gameService';
import { teamAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import PDFViewer from '../PDFViewer';
import HintRequestSection from './HintRequestSection';
import './EnigmasPanel.css';
import ResultatTentative from '../ResultatTentative';

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

function libelleEtat(enigma: { isSolved: boolean }): string | null {
  // Seule la résolution est annoncée. Le décompte des essais mettait un score
  // sous les yeux à chaque coup d'œil, là où le jeu se joue sur trois mois :
  // la pastille cerclée suffit à dire qu'une énigme est commencée.
  return enigma.isSolved ? 'Résolue' : null;
}

const EnigmasPanel: React.FC<EnigmasPanelProps> = ({ isExpanded, isCompact, onExpand }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Édition 2027 : une des vingt énigmes se joue sur un plateau de jeu de l'oie
  // partagé. Elle reste une énigme ordinaire dans cette liste, mais son entrée
  // mène au plateau au lieu d'ouvrir un PDF et un champ de mot de passe.
  const enigmeOie = edition.enigmeOie;
  const estEnigmeOie = (enigmaId: string) =>
    !!enigmeOie?.enigmaId && enigmaId === enigmeOie.enigmaId;

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
    // L'énigme du jeu de l'oie n'a ni énoncé PDF ni mot de passe : elle se joue
    // sur son plateau.
    if (estEnigmeOie(enigma.id) && enigmeOie) {
      navigate(enigmeOie.route);
      return;
    }

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

        // Le champ est vidé quand la réponse est la bonne : l'énigme est close,
        // réafficher le mot de passe trouvé n'apporte rien.
      if (result.success) {
        setPassword('');
      }
    } catch (error) {
      setAttemptMessage('Une erreur est survenue. Veuillez réessayer.');
      setAttemptSuccess(false);
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
                {estEnigmeOie(enigma.id) && (
                  <span className="enigma-oie-badge" data-testid={`enigma-oie-badge-${enigma.order}`}>Plateau</span>
                )}
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
                    {estEnigmeOie(enigma.id) && (
                      <span className="enigma-oie-badge" data-testid={`enigma-oie-badge-${enigma.order}`}>
                        Plateau partagé
                      </span>
                    )}
                    {libelleEtat(enigma) && (
                  <span className={`enigma-etat etat-${etatDe(enigma)}`}>{libelleEtat(enigma)}</span>
                )}
                    {!estEnigmeOie(enigma.id) && enigma.pdfUrl && selectedEnigma?.id === enigma.id && (
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
                  {/* La barre de réponse et l'indice précèdent l'énoncé :
                      celui-ci est un PDF long, souvent déjà lu, et ce que
                      l'on vient faire en rouvrant une énigme, c'est répondre. */}
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
                  <ResultatTentative
                    message={attemptMessage || null}
                    reussi={attemptSuccess === true}
                    onFermer={() => setAttemptMessage('')}
                  />
                  {/* La demande d'indice garde la place du bandeau qu'elle
                      remplace : après la barre de réponse, avant l'énoncé. */}
                  <HintRequestSection enigma={selectedEnigma} />
                  {selectedEnigma.pdfUrl ? (
                    <div className="enigma-pdf-container" data-testid="enigma-pdf-container">
                      <PDFViewer pdfUrl={selectedEnigma.pdfUrl} title={selectedEnigma.title} />
                    </div>
                  ) : (
                    <div className="enigma-pdf-placeholder" data-testid="enigma-pdf-placeholder">
                      <p>PDF non disponible</p>
                      <p className="pdf-note">Le PDF de cette enigme n'est pas encore disponible</p>
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

    </div>
  );
};

export default EnigmasPanel;
