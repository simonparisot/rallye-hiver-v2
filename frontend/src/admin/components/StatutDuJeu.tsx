import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminGameAPI } from '../services/adminAPI';
import { formaterLancement } from '../../services/statutJeu';

/**
 * Phase du jeu (backend/src/utils/gamePhase.ts) : avant-lancement ou lancé.
 *
 * Le jeu se lance tout seul à l'heure de lancement ; l'orga peut l'avancer
 * (« Lancer maintenant ») ou revenir en avant-lancement, par exemple pour
 * essayer les préliminaires sur test. Après l'heure de lancement, revenir en
 * arrière demande une nouvelle heure.
 */
const StatutDuJeu: React.FC = () => {
  const queryClient = useQueryClient();
  const [nouvelleHeure, setNouvelleHeure] = useState('');
  const [erreur, setErreur] = useState('');

  const { data: statut, isLoading } = useQuery({
    queryKey: ['adminGameStatus'],
    queryFn: adminGameAPI.getStatus,
    refetchInterval: 60000,
  });

  const apres = () => {
    setErreur('');
    queryClient.invalidateQueries({ queryKey: ['adminGameStatus'] });
  };
  const echec = (err: any) => setErreur(err?.response?.data?.error || err?.message || 'Une erreur est survenue');

  const lancer = useMutation({ mutationFn: adminGameAPI.startGame, onSuccess: apres, onError: echec });
  const revenir = useMutation({
    mutationFn: (launchAt?: string) => adminGameAPI.resetGame(launchAt),
    onSuccess: () => {
      setNouvelleHeure('');
      apres();
    },
    onError: echec,
  });

  if (isLoading || !statut) {
    return (
      <div className="statut-jeu card" data-testid="admin-game-status">
        <h2>Statut du jeu</h2>
        <p>Chargement…</p>
      </div>
    );
  }

  const lance = statut.phase === 'lance';
  const enCours = lancer.isPending || revenir.isPending;

  return (
    <div className="statut-jeu card" data-testid="admin-game-status">
      <h2>
        Statut du jeu{' '}
        <span
          className={`admin-badge ${lance ? 'admin-badge--success' : 'admin-badge--warning'}`}
          data-testid="admin-game-phase"
        >
          {lance ? 'Lancé' : 'Avant le lancement'}
        </span>
      </h2>

      <p>
        Lancement {statut.launchAtPassed ? 'prévu le' : 'automatique le'}{' '}
        <strong>{formaterLancement(statut.launchAt)}</strong>
        {statut.launchAtIsDefault ? " (date de l'édition)" : ' (date modifiée)'}.
        {statut.isStarted && statut.startedAt && (
          <> Lancé à la main le {formaterLancement(statut.startedAt)}.</>
        )}
      </p>
      <p className="statut-jeu-aide">
        {lance
          ? 'Les équipes voient les vingt intrigues et les tournées, sous le thème officiel. Les préliminaires sont closes.'
          : "Les équipes payées ne voient que les intrigues préliminaires, sous l'habillage neutre tant qu'elles n'en ont résolu aucune. Ni intrigue du rallye, ni tournée."}
      </p>

      <div className="statut-jeu-actions">
        {!lance && (
          <button
            type="button"
            className="btn btn-primary"
            data-testid="admin-game-start"
            disabled={enCours}
            onClick={() => {
              if (window.confirm('Lancer le rallye maintenant ? Toutes les équipes verront les intrigues et les tournées.')) {
                lancer.mutate();
              }
            }}
          >
            Lancer maintenant
          </button>
        )}

        {lance && !statut.launchAtPassed && (
          <button
            type="button"
            className="btn btn-danger"
            data-testid="admin-game-reset"
            disabled={enCours}
            onClick={() => {
              if (window.confirm('Revenir en avant-lancement ? Les équipes ne verront plus que les préliminaires.')) {
                revenir.mutate(undefined);
              }
            }}
          >
            Revenir en avant-lancement
          </button>
        )}

        {lance && statut.launchAtPassed && (
          <form
            className="statut-jeu-repousser"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nouvelleHeure) return;
              if (window.confirm('Revenir en avant-lancement jusqu\'à cette nouvelle heure ?')) {
                // datetime-local est une heure locale du navigateur : on la
                // convertit en instant ISO.
                revenir.mutate(new Date(nouvelleHeure).toISOString());
              }
            }}
          >
            <label htmlFor="statut-jeu-heure">
              L'heure de lancement est passée : pour revenir en avant-lancement, donnez-en une nouvelle
            </label>
            <input
              id="statut-jeu-heure"
              type="datetime-local"
              value={nouvelleHeure}
              onChange={(e) => setNouvelleHeure(e.target.value)}
              data-testid="admin-game-new-launch"
            />
            <button type="submit" className="btn btn-danger" disabled={enCours || !nouvelleHeure}>
              Revenir en avant-lancement
            </button>
          </form>
        )}
      </div>

      {erreur && (
        <div className="admin-form-error" role="alert" data-testid="admin-game-error">
          {erreur}
        </div>
      )}
    </div>
  );
};

export default StatutDuJeu;
