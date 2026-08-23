import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { teamAPI, gameAPI } from '../services/api';
import EnigmasPanel from '../components/panels/EnigmasPanel';
import ParcoursPanel from '../components/panels/ParcoursPanel';
import StatsPanel from '../components/panels/StatsPanel';
import GeneralInfoPanel from '../components/panels/GeneralInfoPanel';
import EditionInfoPanel from '../components/panels/EditionInfoPanel';
import AuthPanel from '../components/panels/AuthPanel';
import WaitingPanel from '../components/panels/WaitingPanel';
import './GamePanels.css';
import { edition } from '../editions';

type PanelState = 'none' | 'panel1' | 'panel2';

const GamePanels: React.FC = () => {
  const { user, loading } = useAuth();
  const [expandedPanel, setExpandedPanel] = useState<PanelState>('none');

  // Poll game status every 60 seconds
  const { data: gameStatus } = useQuery({
    queryKey: ['gameStatus'],
    queryFn: () => gameAPI.getStatus(),
    refetchInterval: 60000, // Poll every 60 seconds
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000, // 5 minutes - aligns with backend cache
    gcTime: 10 * 60 * 1000, // 10 minutes - garbage collection time
  });

  const { data: team } = useQuery({
    queryKey: ['team', user?.teamId],
    queryFn: () => teamAPI.getTeam(user!.teamId!),
    enabled: !!user?.teamId,
  });

  const hasAccess = !!user?.teamId && !!team?.hasPaid;
  const gameStarted = gameStatus?.isStarted ?? false;

  const handlePanelClick = (panel: 'panel1' | 'panel2') => {
    // Prevent expansion if user doesn't have access or game hasn't started
    if (!hasAccess || !gameStarted) {
      return;
    }

    if (expandedPanel === panel) {
      setExpandedPanel('none');
    } else {
      setExpandedPanel(panel);
    }
  };

  const handleClose = () => {
    setExpandedPanel('none');
  };

  if (loading) {
    return (
      <div data-testid="nav-panels-container" className="game-panels-container">
        <div data-testid="nav-loading" className="loading-overlay">
          <div className="loading-spinner">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="nav-panels-container" className="game-panels-container">
      {/* Logo positioned at top right */}
      <img data-testid="nav-logo" src={edition.theme.logo} alt={edition.label} className="rallye-logo" />

      {!user ? (
        // Unauthenticated State
        <>
          {/* Panel 1: Authentication */}
          <div data-testid="nav-panel-auth" className="panel panel-1">
            <AuthPanel />
          </div>

          {/* Panel 2: General Information */}
          <div data-testid="nav-panel-general-info" className="panel panel-2">
            <GeneralInfoPanel
              isExpanded={true}
              isCompact={false}
            />
          </div>

          {/* Panel 3: Edition Information */}
          <div data-testid="nav-panel-edition-info" className="panel panel-3">
            <EditionInfoPanel
              isExpanded={true}
              isCompact={false}
            />
          </div>
        </>
      ) : (
        // Authenticated State
        <>
          {hasAccess ? (
            // User with paid team
            <>
              {/* Panel 1: Stats & Dashboard */}
              <div data-testid="nav-panel-stats"
                className={`panel panel-1 ${expandedPanel !== 'none' ? 'collapsed' : ''}`}
                onClick={() => expandedPanel !== 'none' && handleClose()}
              >
                <StatsPanel isCompact={expandedPanel !== 'none'} hideStats={!gameStarted} />
              </div>

              {/* Panel 2: Enigmas OR Waiting State */}
              <div data-testid="nav-panel-enigmas"
                className={`panel panel-2 ${
                  expandedPanel === 'panel1' ? 'expanded' : expandedPanel !== 'none' ? 'collapsed' : ''
                } ${!gameStarted ? 'non-expandable' : ''}`}
                onClick={() => expandedPanel !== 'panel1' && handlePanelClick('panel1')}
              >
                {expandedPanel === 'panel1' && gameStarted && (
                  <button data-testid="nav-panel-close-button" className="panel-close-btn" onClick={(e) => { e.stopPropagation(); handleClose(); }} aria-label="Refermer le panneau">
                    <span aria-hidden="true">←</span> Retour
                  </button>
                )}
                {!gameStarted ? (
                  <WaitingPanel />
                ) : (
                  <EnigmasPanel
                    isExpanded={expandedPanel === 'panel1'}
                    isCompact={expandedPanel !== 'none' && expandedPanel !== 'panel1'}
                    onExpand={() => setExpandedPanel('panel1')}
                  />
                )}
              </div>

              {/* Panel 3: Parcours (hidden when game hasn't started) */}
              {gameStarted && (
                <div data-testid="nav-panel-parcours"
                  className={`panel panel-3 ${
                    expandedPanel === 'panel2' ? 'expanded' : expandedPanel !== 'none' ? 'collapsed' : ''
                  }`}
                  onClick={() => expandedPanel !== 'panel2' && handlePanelClick('panel2')}
                >
                  {expandedPanel === 'panel2' && (
                    <button data-testid="nav-panel-close-button" className="panel-close-btn" onClick={(e) => { e.stopPropagation(); handleClose(); }} aria-label="Refermer le panneau">
                      <span aria-hidden="true">←</span> Retour
                    </button>
                  )}
                  <ParcoursPanel
                    isExpanded={expandedPanel === 'panel2'}
                    isCompact={expandedPanel !== 'none' && expandedPanel !== 'panel2'}
                    onExpand={() => setExpandedPanel('panel2')}
                  />
                </div>
              )}
            </>
          ) : (
            // User without access (no team, pending request, or unpaid team) - show info panels
            <>
              {/* Panel 1: Stats & Dashboard (for team management) */}
              <div data-testid="nav-panel-stats" className="panel panel-1">
                <StatsPanel isCompact={false} hideStats={true} />
              </div>

              {/* Panel 2: General Information */}
              <div data-testid="nav-panel-general-info" className="panel panel-2">
                <GeneralInfoPanel
                  isExpanded={true}
                  isCompact={false}
                />
              </div>

              {/* Panel 3: Edition Information */}
              <div data-testid="nav-panel-edition-info" className="panel panel-3">
                <EditionInfoPanel
                  isExpanded={true}
                  isCompact={false}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default GamePanels;
