import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Parcours } from '../../types';
import { getParcoursWithAccess, getParcoursPreview } from '../../services/gameService';
import { teamAPI, parcoursAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { accorder, majuscule, useEdition } from '../../editions';
import PDFViewer from '../PDFViewer';
import ResultatTentative from '../ResultatTentative';
import './ParcoursPanel.css';

interface ParcoursPanelProps {
  isExpanded: boolean;
  isCompact: boolean;
  onExpand: () => void;
  /** Voir EnigmasPanel : sélection pilotée de l'extérieur sur téléphone. */
  selectionId?: string | null;
  onSelectionner?: (parcours: Parcours) => void;
}

const ParcoursPanel: React.FC<ParcoursPanelProps> = ({ isExpanded, isCompact, onExpand, selectionId, onSelectionner }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const v = useEdition().vocabulaire;
  const realisee = accorder(v.parcours, 'réalisée', 'réalisé');

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

  const [selectionLocale, setSelectionLocale] = useState<string | null>(null);
  const idSelectionne = selectionId !== undefined ? selectionId : selectionLocale;
  const selectedParcours = parcoursList.find((p) => p.id === idSelectionne) ?? null;
  const [password, setPassword] = useState('');
  const [attemptMessage, setAttemptMessage] = useState('');
  const [attemptSuccess, setAttemptSuccess] = useState(false);

  // Une tournée se valide par le mot de passe trouvé à sa fin, comme une
  // intrigue. Il remplace l'ancien « Marquer comme réalisée ».
  const passwordMutation = useMutation({
    mutationFn: ({ parcoursId, password }: { parcoursId: string; password: string }) =>
      parcoursAPI.submitAttempt(parcoursId, password),
    onSuccess: (data) => {
      setAttemptMessage(data.message);
      setAttemptSuccess(data.success);
      if (data.success) {
        setPassword('');
        queryClient.invalidateQueries({ queryKey: ['parcours-with-access'] });
        queryClient.invalidateQueries({ queryKey: ['team-stats'] });
      }
    },
    onError: (err: any) => {
      // 403 (tournée refermée) ou 409 (mot de passe retiré) : l'affichage
      // était en retard sur le serveur, on le recharge.
      queryClient.invalidateQueries({ queryKey: ['parcours-with-access'] });
      setAttemptMessage(err?.response?.data?.error || 'Une erreur est survenue. Veuillez réessayer.');
      setAttemptSuccess(false);
    },
  });

  const handleParcoursSelect = (parcours: Parcours) => {
    if (onSelectionner) onSelectionner(parcours);
    else setSelectionLocale(parcours.id);
    if (!isExpanded) {
      onExpand();
    }
  };

  // Le champ et le message appartiennent à la tournée affichée.
  useEffect(() => {
    setPassword('');
    setAttemptMessage('');
    setAttemptSuccess(false);
  }, [idSelectionne]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParcours || !password.trim() || passwordMutation.isPending) return;
    passwordMutation.mutate({ parcoursId: selectedParcours.id, password: password.trim() });
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
          <h2>{v.parcours.Pluriel}</h2>
        </div>
        <div className="panel-content">
          <div className="loading-state" data-testid="parcours-loading">Chargement des {v.parcours.pluriel}...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`parcours-panel ${isCompact ? 'panel-compact' : ''}`} data-testid="parcours-panel">
        <div className="panel-header">
          <h2>{v.parcours.Pluriel}</h2>
        </div>
        <div className="panel-content">
          <div className="error-state" data-testid="parcours-error">Erreur lors du chargement des {v.parcours.pluriel}. Veuillez réessayer.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`parcours-panel ${isCompact ? 'panel-compact' : ''}`} data-testid="parcours-panel">
      <div className="panel-header">
        <h2>{v.parcours.Pluriel}</h2>
      </div>
      <div className="panel-content">
        {!hasAccess && (
          <div className="access-blocked-message" data-testid="parcours-access-blocked">
            Pour accéder aux {v.parcours.pluriel}, rejoignez ou créez {v.equipe.un} depuis « {v.monEquipe} », puis réglez les frais d'inscription.
          </div>
        )}
        {!isExpanded ? (
          // Compact view: Just list titles with numbers
          <div className="parcours-list-compact" data-testid="parcours-list-compact">
            {parcoursList.map((parcours, index) => (
              <div
                key={parcours.id}
                data-testid={`parcours-card-${parcours.order}`}
                className={`parcours-item-compact ${parcours.isCompleted ? 'completed' : ''} ${!hasAccess || !parcours.isUnlocked ? 'locked' : ''}`}
                onClick={() => hasAccess && handleParcoursSelect(parcours)}
              >
                <span className="parcours-number">{index + 1}</span>
                <span className="parcours-title-compact">{parcours.title}</span>
                {hasAccess && !parcours.isUnlocked && <VerrouCompteur parcours={parcours} />}
                {parcours.isCompleted && <span className="completed-badge-small" data-testid={`parcours-completed-badge-${parcours.order}`}>{majuscule(realisee)}</span>}
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
                  } ${hasAccess && !parcours.isUnlocked ? 'locked' : ''}`}
                  onClick={() => handleParcoursSelect(parcours)}
                >
                  <div className="parcours-header-item">
                    <span className="parcours-number">{index + 1}</span>
                    <span className="parcours-title">{parcours.title}</span>
                    {hasAccess && !parcours.isUnlocked && <VerrouCompteur parcours={parcours} />}
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
                      <span className="completed-badge" data-testid={`parcours-completed-badge-${parcours.order}`}>{majuscule(realisee)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="parcours-viewer" data-testid="parcours-viewer">
              {selectedParcours ? (
                hasAccess && !selectedParcours.isUnlocked ? (
                  <TourneeVerrouillee parcours={selectedParcours} />
                ) : (
                <div className="parcours-details" data-testid="parcours-details">
                  {hasAccess && (
                    <div className="parcours-header-detail">
                      <div className="parcours-completion-section">
                        {selectedParcours.isCompleted ? (
                          <div className="parcours-completed-badge" data-testid="parcours-completed-banner">
                            ✅ {v.parcours.Singulier} {realisee}
                            {selectedParcours.completedAt && (
                              <span className="completed-date">
                                {' '}le {new Date(selectedParcours.completedAt).toLocaleDateString('fr-FR')}
                              </span>
                            )}
                          </div>
                        ) : !selectedParcours.hasPassword ? (
                          <p className="parcours-password-indisponible" data-testid="parcours-password-unavailable">
                            Le mot de passe de {v.parcours.ce} n'est pas encore disponible
                          </p>
                        ) : (
                          <form
                            className="parcours-password-form"
                            data-testid="parcours-password-form"
                            onSubmit={handlePasswordSubmit}
                          >
                            <label htmlFor="parcours-password-input" className="parcours-password-label">
                              Mot de passe de fin de {v.parcours.singulier}
                            </label>
                            <div className="parcours-password-ligne">
                              <input
                                id="parcours-password-input"
                                type="text"
                                placeholder="Entrez le mot de passe"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="parcours-password-input"
                                data-testid="parcours-password-input"
                                autoComplete="off"
                                autoCapitalize="characters"
                                disabled={passwordMutation.isPending}
                              />
                              <button
                                type="submit"
                                data-testid="parcours-password-submit"
                                className="parcours-password-submit"
                                disabled={passwordMutation.isPending || !password.trim()}
                              >
                                {passwordMutation.isPending ? 'Envoi…' : 'Valider'}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </div>
                  )}
                  <ResultatTentative
                    message={attemptMessage || null}
                    reussi={attemptSuccess}
                    onFermer={() => setAttemptMessage('')}
                    testIdPrefix="parcours-attempt"
                  />
                  {selectedParcours.pdfUrl ? (
                    <div className="parcours-pdf-container" data-testid="parcours-pdf-container">
                      <PDFViewer pdfUrl={selectedParcours.pdfUrl} title={selectedParcours.title} />
                    </div>
                  ) : (
                    <div className="parcours-pdf-placeholder" data-testid="parcours-pdf-placeholder">
                      <p>PDF non disponible</p>
                      <p className="pdf-note">Le PDF de {v.parcours.ce} n'est pas encore disponible</p>
                    </div>
                  )}
                </div>
                )
              ) : (
                <div className="parcours-placeholder" data-testid="parcours-placeholder">
                  <p>Sélectionnez {v.parcours.un} pour afficher son énoncé</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Un simple « 🔒 » : une seule intrigue résolue parmi celles listées suffit à
 * ouvrir la tournée, un compte « n/m » laisserait croire qu'il les faut toutes.
 */
const VerrouCompteur: React.FC<{ parcours: Parcours }> = ({ parcours }) => {
  const v = useEdition().vocabulaire;
  const libelle = `Se débloque en résolvant ${accorder(v.enigme, "l'une", "l'un")} des ${v.enigme.pluriel} ${accorder(v.enigme, 'listées', 'listés')}`;
  return (
    <span
      className="parcours-verrou"
      data-testid={`parcours-locked-badge-${parcours.order}`}
      title={libelle}
      aria-label={libelle}
      role="img"
    >
      <span aria-hidden="true">🔒</span>
    </span>
  );
};

/** Ce que voit une troupe qui ouvre une tournée encore fermée. */
const TourneeVerrouillee: React.FC<{ parcours: Parcours }> = ({ parcours }) => {
  const v = useEdition().vocabulaire;
  const requises = parcours.requiredEnigmasDetail || [];

  return (
    <div className="parcours-locked-view" data-testid="parcours-locked-view">
      <div className="lock-icon" aria-hidden="true">🔒</div>
      <h4>{parcours.title}</h4>
      <p>
        {/* Une seule suffit : il n'y a plus de reste à afficher. */}
        {majuscule(v.parcours.ce)} s'ouvrira dès que votre {v.equipe.singulier} aura résolu{' '}
        {requises.length > 1
          ? `${accorder(v.enigme, "l'une", "l'un")} des ${v.enigme.pluriel} ${accorder(v.enigme, 'suivantes', 'suivants')}`
          : `${v.enigme.le} ${accorder(v.enigme, 'suivante', 'suivant')}`}.
      </p>
      <ul className="unlock-liste" data-testid="parcours-required-enigmas">
        {requises.map((e) => (
          <li key={e.id} className={e.isSolved ? 'resolue' : ''}>
            <span className="unlock-marque" aria-hidden="true">{e.isSolved ? '✓' : '○'}</span>
            <span>
              {e.order}. {e.title}
              <span className="sr-only">{e.isSolved ? ` (${accorder(v.enigme, 'résolue', 'résolu')})` : ' (à résoudre)'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ParcoursPanel;
