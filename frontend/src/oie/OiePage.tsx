import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { gameAPI, teamAPI } from '../services/api';
import { edition } from '../editions';
import { oieAPI } from './api';
import { OieMyView, OieRollResponse } from './types';
import Plateau from './components/Plateau';
import CarteAction from './components/CarteAction';
import ResultatLancer from './components/ResultatLancer';
import FilEvenements from './components/FilEvenements';
import './OiePage.css';

/**
 * Ce que le bouton du panneau annonce, panneau fermé : la carte d'action vit
 * désormais derrière lui, il doit donc dire s'il y a quelque chose à faire.
 */
function resumeEquipe(me: OieMyView): { texte: string; aAgir: boolean } {
  if (me.finishedAt) return { texte: 'Intrigue résolue', aAgir: false };
  switch (me.status) {
    case 'question_finale':
      return { texte: 'Question finale', aAgir: true };
    case 'question_en_attente':
      return { texte: `Question en case ${me.position}`, aAgir: true };
    case 'relance_oie':
      return { texte: 'Relancez les dés', aAgir: true };
    case 'peut_lancer':
      return { texte: 'À vous de lancer', aAgir: true };
    case 'dans_le_puits':
      return { texte: 'Au fond du puits', aAgir: false };
    case 'tour_passe':
      return { texte: me.inPrison ? 'En prison' : 'Vous passez un tour', aAgir: false };
    case 'quota_epuise':
      return { texte: 'Lancers du jour épuisés', aAgir: false };
    default:
      return { texte: `Case ${me.position}`, aAgir: false };
  }
}

/**
 * Page du jeu de l'oie, route /oie.
 *
 * Meme garde que le jeu : connecte, dans une equipe, equipe a jour de son
 * inscription, partie commencee. Aucune regle n'est evaluee ici : la page
 * affiche ce que le serveur repond et lui renvoie les clics.
 */
const OiePage: React.FC = () => {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  const [resultat, setResultat] = useState<OieRollResponse | null>(null);
  const [messageReponse, setMessageReponse] = useState<{ texte: string; correct: boolean } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Le panneau de l'équipe est masqué par défaut : le plateau prend toute la
  // largeur, et le panneau s'ouvre par-dessus quand on veut agir.
  const [panneauOuvert, setPanneauOuvert] = useState(false);
  const boutonPanneauRef = useRef<HTMLButtonElement>(null);
  const fermerPanneauRef = useRef<HTMLButtonElement>(null);

  const fermerPanneau = useCallback(() => {
    setPanneauOuvert(false);
    // Le focus revient là d'où l'on a ouvert, pour le clavier.
    boutonPanneauRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!panneauOuvert) return undefined;
    fermerPanneauRef.current?.focus();
    const echap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') fermerPanneau();
    };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [panneauOuvert, fermerPanneau]);

  const { data: gameStatus } = useQuery({
    queryKey: ['gameStatus'],
    queryFn: () => gameAPI.getStatus(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: team } = useQuery({
    queryKey: ['team', user?.teamId],
    queryFn: () => teamAPI.getTeam(user!.teamId!),
    enabled: !!user?.teamId,
  });

  const hasAccess = !!user?.teamId && !!team?.hasPaid;
  const gameStarted = gameStatus?.isStarted ?? false;

  const {
    data: plateau,
    isLoading: chargementPlateau,
    error: erreurPlateau,
  } = useQuery({
    queryKey: ['oie-board'],
    queryFn: oieAPI.getBoard,
    enabled: hasAccess && gameStarted,
    // Le plateau est partage : il bouge sans que l'on clique.
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const lancer = useMutation({
    mutationFn: oieAPI.roll,
    onSuccess: (data) => {
      setErreur(null);
      setMessageReponse(null);
      setResultat(data);
      queryClient.setQueryData(['oie-board'], data);
      // Un plateau sans question finale configuree resout encore l'intrigue
      // des l'arrivee ; sinon c'est la reponse finale qui le fera, plus bas.
      if (data.finished) {
        queryClient.invalidateQueries({ queryKey: ['enigmas-with-progress'] });
        queryClient.invalidateQueries({ queryKey: ['team-stats'] });
      }
    },
    onError: (err: any) => {
      setErreur(err?.response?.data?.error || 'Le lancer n\'a pas abouti.');
      queryClient.invalidateQueries({ queryKey: ['oie-board'] });
    },
  });

  const repondre = useMutation({
    mutationFn: oieAPI.answer,
    onSuccess: (data) => {
      setErreur(null);
      setMessageReponse({ texte: data.message, correct: data.correct });
      queryClient.setQueryData(['oie-board'], data);
      // La question finale repondue juste resout l'enigme : les listes du jeu
      // doivent le refleter, exactement comme un mot de passe trouve.
      if (data.finished) {
        queryClient.invalidateQueries({ queryKey: ['enigmas-with-progress'] });
        queryClient.invalidateQueries({ queryKey: ['team-stats'] });
      }
    },
    onError: (err: any) => {
      setErreur(err?.response?.data?.error || 'La réponse n\'a pas pu être enregistrée.');
      queryClient.invalidateQueries({ queryKey: ['oie-board'] });
    },
  });

  const souffleur = useMutation({
    mutationFn: oieAPI.prompter,
    onSuccess: () => {
      setErreur(null);
      queryClient.invalidateQueries({ queryKey: ['oie-board'] });
    },
    onError: (err: any) => {
      setErreur(err?.response?.data?.error || 'Le souffleur n\'a pas répondu.');
    },
  });

  // Le message de reponse ne doit pas survivre a un changement de case.
  useEffect(() => {
    setMessageReponse(null);
  }, [plateau?.me.position]);

  const occupe = lancer.isPending || repondre.isPending || souffleur.isPending;

  if (loading) {
    return (
      <div className="oie-page" data-testid="oie-page">
        <p className="oie-etat" data-testid="oie-chargement">Chargement...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="oie-page" data-testid="oie-page">
        <div className="oie-etat" data-testid="oie-non-connecte">
          <p>Connectez-vous pour rejoindre le plateau.</p>
          <Link className="oie-bouton-secondaire" to="/">Retour au jeu</Link>
        </div>
      </div>
    );
  }

  if (!hasAccess || !gameStarted) {
    return (
      <div className="oie-page" data-testid="oie-page">
        <div className="oie-etat" data-testid="oie-sans-acces">
          <p>
            {!hasAccess
              ? "Rejoignez une équipe à jour de son inscription pour jouer au jeu de l'oie."
              : "Le rallye n'a pas encore commencé."}
          </p>
          <Link className="oie-bouton-secondaire" to="/">Retour au jeu</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="oie-page" data-testid="oie-page">
      <header className="oie-entete">
        <div>
          <h1 data-testid="oie-titre">{edition.enigmeOie?.titre || "Le jeu de l'oie"}</h1>
          <p className="oie-sous-titre">
            Toutes les équipes jouent sur le même plateau. Répondez à la question de votre case
            pour retrouver le droit de lancer les dés. En case 63, une dernière question décide
            de l'intrigue.
          </p>
        </div>
        <Link className="oie-bouton-secondaire" to="/" data-testid="oie-retour">Retour au jeu</Link>
      </header>

      {erreur && (
        <p className="oie-message oie-message-erreur" data-testid="oie-erreur">{erreur}</p>
      )}

      {chargementPlateau && (
        <p className="oie-etat" data-testid="oie-plateau-chargement">Le plateau se dresse...</p>
      )}

      {erreurPlateau && (
        <p className="oie-etat oie-message-erreur" data-testid="oie-plateau-erreur">
          Le plateau n'a pas pu être chargé. Rechargez la page.
        </p>
      )}

      {plateau && (
        <div className="oie-scene">
          {/* La barre reste en haut de l'écran pendant qu'on parcourt le
              plateau : c'est par elle que l'on rejoint la carte d'action. */}
          <div className="oie-barre">
            <button
              type="button"
              ref={boutonPanneauRef}
              className={`oie-bouton-panneau ${resumeEquipe(plateau.me).aAgir ? 'oie-bouton-panneau-a-agir' : ''}`}
              onClick={() => (panneauOuvert ? fermerPanneau() : setPanneauOuvert(true))}
              aria-expanded={panneauOuvert}
              aria-controls="oie-panneau"
              data-testid="oie-bouton-panneau"
            >
              <span className="oie-bouton-panneau-titre">Votre équipe</span>
              <span className="oie-bouton-panneau-etat" data-testid="oie-etat-equipe">
                {resumeEquipe(plateau.me).texte}
              </span>
            </button>
          </div>

          <Plateau
            squares={plateau.board.squares}
            teams={plateau.teams}
            caseSurlignee={plateau.me.position}
          />

          {/* Toujours monté, seulement masqué : refermer le panneau ne doit
              pas effacer une réponse en cours de saisie. */}
          <aside
            id="oie-panneau"
            className="oie-panneau"
            hidden={!panneauOuvert}
            aria-label="Votre équipe, le classement et ce qui se passe"
            data-testid="oie-panneau"
          >
            <button
              type="button"
              ref={fermerPanneauRef}
              className="oie-panneau-fermer"
              onClick={fermerPanneau}
              aria-label="Fermer le panneau"
              data-testid="oie-panneau-fermer"
            >
              ×
            </button>

            {resultat && <ResultatLancer resultat={resultat} onFermer={() => setResultat(null)} />}

            <CarteAction
              me={plateau.me}
              occupe={occupe}
              messageReponse={messageReponse}
              onRepondre={(reponse) => repondre.mutate(reponse)}
              onLancer={() => lancer.mutate()}
              onSouffleur={() => souffleur.mutate()}
            />

            <FilEvenements evenements={plateau.events} teams={plateau.teams} />
          </aside>
        </div>
      )}
    </div>
  );
};

export default OiePage;
