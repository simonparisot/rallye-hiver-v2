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

/**
 * Les trois panneaux dépliants sont remplacés par une navigation par sections.
 *
 * Ils obligeaient à choisir entre voir la liste et lire une énigme, réduisaient
 * les panneaux fermés à 4 % de largeur — d'où des titres pivotés à la verticale —
 * et tenaient mal sur téléphone. Une barre de navigation et une section à la fois
 * règlent les trois problèmes, sans rien retirer aux fonctions accessibles.
 */
type Section = 'enigmes' | 'parcours' | 'equipe';

const SECTIONS: { id: Section; libelle: string }[] = [
  { id: 'enigmes', libelle: 'Énigmes' },
  { id: 'parcours', libelle: 'Parcours' },
  { id: 'equipe', libelle: 'Mon équipe' },
];

const GamePanels: React.FC = () => {
  const { user, loading } = useAuth();
  const [section, setSection] = useState<Section>('enigmes');

  const { data: gameStatus } = useQuery({
    queryKey: ['gameStatus'],
    queryFn: () => gameAPI.getStatus(),
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: team } = useQuery({
    queryKey: ['team', user?.teamId],
    queryFn: () => teamAPI.getTeam(user!.teamId!),
    enabled: !!user?.teamId,
  });

  const { data: stats } = useQuery({
    queryKey: ['team-stats', user?.teamId],
    queryFn: () => teamAPI.getStats(),
    enabled: !!user?.teamId,
  });

  const hasAccess = !!user?.teamId && !!team?.hasPaid;
  const gameStarted = gameStatus?.isStarted ?? false;

  if (loading) {
    return (
      <div className="scene-container">
        <div data-testid="nav-loading" className="chargement">
          <span>Chargement…</span>
        </div>
      </div>
    );
  }

  /* --- Visiteur : présentation de l'édition et connexion --- */
  if (!user) {
    return (
      <div data-testid="nav-panels-container" className="scene-container accueil">
        <header className="barre">
          <div className="barre-contenu">
            <img data-testid="nav-logo" src={edition.theme.logo} alt={edition.label} className="rallye-logo" />
            <span className="marque">
              Rallye <em>d'Hiver</em> <span className="annee">{edition.year}</span>
            </span>
          </div>
        </header>

        <main className="accueil-grille">
          <div data-testid="nav-panel-auth" className="feuille feuille-auth">
            <AuthPanel />
          </div>
          <div className="accueil-textes">
            <div data-testid="nav-panel-general-info" className="feuille">
              <GeneralInfoPanel isExpanded={true} isCompact={false} />
            </div>
            <div data-testid="nav-panel-edition-info" className="feuille">
              <EditionInfoPanel isExpanded={true} isCompact={false} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* --- Le rallye n'a pas encore commencé --- */
  if (!gameStarted) {
    return (
      <div data-testid="nav-panels-container" className="scene-container">
        <header className="barre">
          <div className="barre-contenu">
            <img data-testid="nav-logo" src={edition.theme.logo} alt={edition.label} className="rallye-logo" />
            <span className="marque">Rallye <em>d'Hiver</em> <span className="annee">{edition.year}</span></span>
          </div>
        </header>
        <main className="section-contenu">
          <div className="feuille"><WaitingPanel /></div>
          <div data-testid="nav-panel-stats" className="feuille">
            <StatsPanel isCompact={false} hideStats={true} />
          </div>
        </main>
      </div>
    );
  }

  /* --- Participant : navigation par sections --- */
  const avancement = stats
    ? `${stats.enigmasSolved}/${stats.totalEnigmas}`
    : null;

  return (
    <div data-testid="nav-panels-container" className="scene-container">
      <header className="barre">
        <div className="barre-contenu">
          <img data-testid="nav-logo" src={edition.theme.logo} alt={edition.label} className="rallye-logo" />
          <span className="marque">
            Rallye <em>d'Hiver</em> <span className="annee">{edition.year}</span>
          </span>

          <nav className="sections" aria-label="Sections du rallye">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                data-testid={`nav-vers-${s.id}`}
                className={`onglet ${section === s.id ? 'actif' : ''}`}
                aria-current={section === s.id}
                onClick={() => setSection(s.id)}
              >
                {s.libelle}
              </button>
            ))}
          </nav>

          {avancement && team?.teamName && (
            <span className="avancement" title={team.teamName}>
              <span className="nom-equipe">{team.teamName}</span>
              <b>{avancement}</b>
            </span>
          )}
        </div>
      </header>

      <main className="section-contenu">
        {/* Les trois sections restent montées : passer de l'une à l'autre ne
            relance pas les requêtes, et l'énigme ouverte est retrouvée telle
            qu'on l'avait laissée. */}
        <div data-testid="nav-panel-enigmas" className="section" hidden={section !== 'enigmes'}>
          <EnigmasPanel isExpanded={true} isCompact={false} onExpand={() => setSection('enigmes')} />
        </div>

        <div data-testid="nav-panel-parcours" className="section" hidden={section !== 'parcours'}>
          <ParcoursPanel isExpanded={true} isCompact={false} onExpand={() => setSection('parcours')} />
        </div>

        <div data-testid="nav-panel-stats" className="section" hidden={section !== 'equipe'}>
          <StatsPanel isCompact={false} hideStats={!hasAccess} />
        </div>
      </main>
    </div>
  );
};

export default GamePanels;
