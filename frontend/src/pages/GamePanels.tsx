import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { teamAPI } from '../services/api';
import EnigmasPanel from '../components/panels/EnigmasPanel';
import ParcoursPanel from '../components/panels/ParcoursPanel';
import StatsPanel from '../components/panels/StatsPanel';
import GeneralInfoPanel from '../components/panels/GeneralInfoPanel';
import EditionInfoPanel from '../components/panels/EditionInfoPanel';
import AuthPanel from '../components/panels/AuthPanel';
import { AnnonceLancementParcours } from '../components/panels/AnnonceLancement';
import CompteMenu from '../components/CompteMenu';
import MenuMobile from '../components/MenuMobile';
import ModaleMotDePasse from '../components/ModaleMotDePasse';
import { Enigma, Parcours } from '../types';
import { getEnigmasWithProgress, getEnigmasPreview, getParcoursWithAccess, getParcoursPreview } from '../services/gameService';
import { useStatutJeu, phaseParDefaut } from '../services/statutJeu';
import './GamePanels.css';
import { editionOfficielle, useEdition, Vocabulaire } from '../editions';

/**
 * Les trois panneaux dépliants sont remplacés par une navigation par sections.
 *
 * Ils obligeaient à choisir entre voir la liste et lire une intrigue, réduisaient
 * les panneaux fermés à 4 % de largeur — d'où des titres pivotés à la verticale —
 * et tenaient mal sur téléphone. Une barre de navigation et une section à la fois
 * règlent les trois problèmes, sans rien retirer aux fonctions accessibles.
 */
type Section = 'enigmes' | 'parcours' | 'equipe';

// « réservé » : la section n'a de contenu qu'une fois l'équipe rejointe et
// l'inscription réglée. Avant cela l'onglet reste visible — il dit ce qui
// attend — mais il est inerte.
// Les libellés suivent le vocabulaire de l'habillage affiché.
const SECTIONS: { id: Section; libelle: (v: Vocabulaire) => string; reserve?: boolean }[] = [
  { id: 'enigmes', libelle: (v) => v.enigme.Pluriel, reserve: true },
  { id: 'parcours', libelle: (v) => v.parcours.Pluriel, reserve: true },
  { id: 'equipe', libelle: (v) => v.monEquipe },
];

const GamePanels: React.FC = () => {
  const { user, loading } = useAuth();
  // L'édition affichée : logo et libellés suivent la bascule de thème.
  const edition = useEdition();
  const [section, setSection] = useState<Section>('enigmes');
  // La sélection remonte ici : sur téléphone, c'est le menu qui la pilote, et
  // il vit en dehors des panneaux.
  const [enigmeId, setEnigmeId] = useState<string | null>(null);
  const [parcoursId, setParcoursId] = useState<string | null>(null);
  const [modaleMdp, setModaleMdp] = useState(false);

  // Phase et thème viennent du serveur. Tant qu'il n'a pas répondu, on
  // n'affiche rien : ni le thème ni le contenu d'une phase qui n'est pas la
  // bonne (SynchroStatutJeu applique le thème dans la même image).
  const { data: gameStatus, isLoading: statutEnCours } = useStatutJeu();

  const { data: team } = useQuery({
    queryKey: ['team', user?.teamId],
    queryFn: () => teamAPI.getTeam(user!.teamId!),
    enabled: !!user?.teamId,
  });

  const hasAccess = !!user?.teamId && !!team?.hasPaid;
  // Avant le lancement, le jeu est ouvert aux équipes payées, mais réduit aux
  // énigmes préliminaires (le serveur ne renvoie qu'elles) ; pas de parcours.
  const lance = (gameStatus?.phase ?? phaseParDefaut()) === 'lance';
  const launchAt = gameStatus?.launchAt ?? editionOfficielle.startsAt;

  // Mêmes clés que les panneaux : React Query sert le cache, aucune requête
  // supplémentaire n'est émise.
  const { data: enigmas = [] } = useQuery({
    queryKey: hasAccess ? ['enigmas-with-progress'] : ['enigmas-preview'],
    queryFn: hasAccess ? getEnigmasWithProgress : getEnigmasPreview,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const { data: parcours = [] } = useQuery({
    queryKey: hasAccess ? ['parcours-with-access'] : ['parcours-preview'],
    queryFn: hasAccess ? getParcoursWithAccess : getParcoursPreview,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  /* Sans équipe, rien d'autre n'est jouable : on ouvre sur « Ma troupe ».
     Un compte fraîchement créé arrivait sur la liste des intrigues, avec pour
     tout accueil une phrase disant de rejoindre une équipe — sans lien ni
     bouton, et, sur téléphone, l'écran qui le permet enfoui dans le menu.
     Le renvoi n'a lieu qu'une fois : ensuite la navigation est à l'équipe. */
  const oriente = useRef(false);
  useEffect(() => {
    if (oriente.current || loading || !user) return;
    if (team === undefined && user.teamId) return; // l'équipe n'est pas encore chargée
    if (!hasAccess) setSection('equipe');
    oriente.current = true;
  }, [loading, user, team, hasAccess]);

  /* Tant que rien n'est choisi, la première intrigue est ouverte : arriver sur
     une zone de lecture vide n'apprenait rien, il fallait encore cliquer pour
     voir un énoncé. L'intrigue du jeu de l'oie est sautée — elle mène à son
     plateau, pas à un énoncé. Sans accès, la section est fermée et rien de
     l'intrigue ne serait lu : on ne charge pas son PDF pour rien. */
  useEffect(() => {
    if (!hasAccess || enigmeId !== null) return;
    const premiere = enigmas.find((e) => e.id !== editionOfficielle.enigmeOie?.enigmaId);
    if (premiere) setEnigmeId(premiere.id);
  }, [hasAccess, enigmeId, enigmas]);

  const choisirEnigme = (e: Enigma) => { setEnigmeId(e.id); setSection('enigmes'); };
  const choisirParcours = (p: Parcours) => { setParcoursId(p.id); setSection('parcours'); };

  if (loading || statutEnCours) {
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

  /* --- Participant : navigation par sections --- */

  return (
    <div data-testid="nav-panels-container" className="scene-container">
      <header className="barre">
        <div className="barre-contenu">
          <img data-testid="nav-logo" src={edition.theme.logo} alt={edition.label} className="rallye-logo" />
          <span className="marque">
            Rallye <em>d'Hiver</em> <span className="annee">{edition.year}</span>
          </span>

          <nav className="sections" aria-label="Sections du rallye">
            {SECTIONS.map((s) => {
              const verrouille = !!s.reserve && !hasAccess;
              return (
                <button
                  key={s.id}
                  data-testid={`nav-vers-${s.id}`}
                  className={`onglet ${section === s.id ? 'actif' : ''} ${verrouille ? 'onglet-verrouille' : ''}`}
                  aria-current={section === s.id}
                  disabled={verrouille}
                  title={verrouille ? `Rejoignez ${edition.vocabulaire.equipe.un} pour y accéder` : undefined}
                  onClick={() => setSection(s.id)}
                >
                  {s.libelle(edition.vocabulaire)}
                </button>
              );
            })}
          </nav>

          <CompteMenu />
          <MenuMobile
            section={section}
            acces={hasAccess}
            enigmas={enigmas}
            parcours={parcours}
            enigmeId={enigmeId}
            parcoursId={parcoursId}
            onChoisirEnigme={choisirEnigme}
            onChoisirParcours={choisirParcours}
            onAllerTroupe={() => setSection('equipe')}
            onMotDePasse={() => setModaleMdp(true)}
          />
        </div>
      </header>

      <main className="section-contenu">
        {/* Les trois sections restent montées : passer de l'une à l'autre ne
            relance pas les requêtes, et l'intrigue ouverte est retrouvée telle
            qu'on l'avait laissée. */}
        <div data-testid="nav-panel-enigmas" className="section" hidden={section !== 'enigmes'}>
          <EnigmasPanel
            isExpanded={true}
            isCompact={false}
            onExpand={() => setSection('enigmes')}
            selectionId={enigmeId}
            onSelectionner={choisirEnigme}
          />
        </div>

        <div data-testid="nav-panel-parcours" className="section" hidden={section !== 'parcours'}>
          {lance ? (
            <ParcoursPanel
              isExpanded={true}
              isCompact={false}
              onExpand={() => setSection('parcours')}
              selectionId={parcoursId}
              onSelectionner={choisirParcours}
            />
          ) : (
            <AnnonceLancementParcours launchAt={launchAt} />
          )}
        </div>

        <div data-testid="nav-panel-stats" className="section" hidden={section !== 'equipe'}>
          {/* Avant le lancement, rien à compter : les préliminaires ne comptent pas. */}
          <StatsPanel isCompact={false} hideStats={!hasAccess || !lance} />
        </div>
      </main>

      {/* Ouverte depuis le tiroir du téléphone ; sur grand écran c'est
          CompteMenu qui porte la sienne. */}
      <ModaleMotDePasse ouverte={modaleMdp} onFermer={() => setModaleMdp(false)} />
    </div>
  );
};

export default GamePanels;
