import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { gameAPI, teamAPI } from '../services/api';
import { edition } from '../editions';
import { oieAPI } from './api';
import { OieRollResponse } from './types';
import Plateau from './components/Plateau';
import CarteAction from './components/CarteAction';
import ResultatLancer from './components/ResultatLancer';
import FilEvenements from './components/FilEvenements';
import './OiePage.css';

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
      // L'arrivee resout l'enigme : les listes du jeu doivent le refleter.
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
    },
    onError: (err: any) => {
      setErreur(err?.response?.data?.error || 'La reponse n\'a pas pu etre enregistree.');
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
      setErreur(err?.response?.data?.error || 'Le souffleur n\'a pas repondu.');
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
              ? "Rejoignez une equipe a jour de son inscription pour jouer au jeu de l'oie."
              : "Le rallye n'a pas encore commence."}
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
            Toutes les equipes jouent sur le meme plateau. Repondez a la question de votre case
            pour retrouver le droit de lancer les des.
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
          Le plateau n'a pas pu etre charge. Rechargez la page.
        </p>
      )}

      {plateau && (
        <div className="oie-grille">
          <div className="oie-colonne-plateau">
            <Plateau
              squares={plateau.board.squares}
              teams={plateau.teams}
              caseSurlignee={plateau.me.position}
            />
          </div>

          <div className="oie-colonne-action">
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
          </div>
        </div>
      )}
    </div>
  );
};

export default OiePage;
