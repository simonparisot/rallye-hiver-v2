import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Enigma } from '../../types';
import { hintsAPI } from '../../services/api';
import './HintRequestSection.css';

/**
 * Zone « Demander un indice » d'une énigme.
 *
 * L'équipe décrit son avancement, confirme, et reçoit un indice. Les indices
 * déjà obtenus restent affichés sous l'énigme, pour qu'elle puisse les relire
 * sans redemander.
 *
 * Le composant ne sait pas comment le modèle est appelé. Selon le réglage du
 * serveur, la réponse est immédiate (appel direct depuis la lambda) ou différée
 * (une demande part en file d'attente, un worker la traite). Il se contente donc
 * du statut renvoyé : tant qu'une demande est `pending`, il réinterroge.
 */

const LONGUEUR_MIN = 20;
const LONGUEUR_MAX = 3000;

/** Période d'interrogation pendant qu'une demande est en attente. */
const PERIODE_ATTENTE_MS = 3000;

/**
 * Au-delà, on cesse d'interroger et on le dit. La demande n'est pas perdue pour
 * autant : elle reste en attente, et rouvrir l'énigme relance l'interrogation.
 */
const PATIENCE_MAX_MS = 3 * 60 * 1000;

interface HintRequestSectionProps {
  enigma: Enigma;
}

type Etape = 'repos' | 'confirmation';

const HintRequestSection: React.FC<HintRequestSectionProps> = ({ enigma }) => {
  const queryClient = useQueryClient();
  const [avancement, setAvancement] = useState('');
  const [etape, setEtape] = useState<Etape>('repos');
  const [messageErreur, setMessageErreur] = useState('');
  const [tropLong, setTropLong] = useState(false);

  // Identifiant de la demande que l'on suit, pour mettre en avant l'indice qui
  // vient d'arriver plutôt que le premier de la liste.
  const [demandeSuivie, setDemandeSuivie] = useState<string | null>(null);
  const debutAttente = useRef<number | null>(null);

  // Une clé par saisie : elle identifie la demande côté serveur et permet de
  // distinguer un second clic (même clé, refusé) d'une nouvelle demande.
  const [cleDemande, setCleDemande] = useState(() => creerCle());

  const { data } = useQuery({
    queryKey: ['hints', enigma.id],
    queryFn: () => hintsAPI.listHints(enigma.id),
    enabled: !!enigma.id,
    // Tant qu'une demande est en attente, on réinterroge. La reprise est donc
    // automatique à la réouverture de l'énigme, sans état à restaurer.
    refetchInterval: (query) => {
      const d: any = query.state.data;
      return d?.pendingRequest && !tropLong ? PERIODE_ATTENTE_MS : false;
    },
  });

  const enAttente = !!data?.pendingRequest;

  // Changer d'énigme remet la zone à zéro : sans cela, le texte saisi pour une
  // énigme se retrouverait proposé pour la suivante.
  useEffect(() => {
    setAvancement('');
    setEtape('repos');
    setMessageErreur('');
    setDemandeSuivie(null);
    setTropLong(false);
    debutAttente.current = null;
    setCleDemande(creerCle());
  }, [enigma.id]);

  // Compteur de patience. Il démarre à la première attente observée, qu'elle
  // vienne de cette session ou d'une demande laissée en plan.
  useEffect(() => {
    if (!enAttente) {
      debutAttente.current = null;
      setTropLong(false);
      return;
    }
    if (debutAttente.current === null) {
      debutAttente.current = Date.now();
    }
    const minuteur = setInterval(() => {
      if (debutAttente.current && Date.now() - debutAttente.current > PATIENCE_MAX_MS) {
        setTropLong(true);
      }
    }, 1000);
    return () => clearInterval(minuteur);
  }, [enAttente]);

  const demande = useMutation({
    mutationFn: () => hintsAPI.requestHint(enigma.id, avancement.trim(), cleDemande),
    onSuccess: (reponse) => {
      setDemandeSuivie(reponse.requestId || null);
      setAvancement('');
      setEtape('repos');
      setMessageErreur('');
      setTropLong(false);
      debutAttente.current = Date.now();
      setCleDemande(creerCle());
      queryClient.invalidateQueries({ queryKey: ['hints', enigma.id] });
      queryClient.invalidateQueries({ queryKey: ['enigmas-with-progress'] });
      queryClient.invalidateQueries({ queryKey: ['team-stats'] });
    },
    onError: (erreur: any) => {
      setEtape('repos');
      setMessageErreur(
        erreur?.response?.data?.error ||
          "La demande n'a pas abouti. Réessayez dans un instant."
      );
    },
  });

  const indicesObtenus = data?.hints || [];
  const indicesRestants = data?.remainingHints ?? 0;
  const longueur = avancement.trim().length;
  const texteValide = longueur >= LONGUEUR_MIN && longueur <= LONGUEUR_MAX;

  // La demande que l'on vient de faire, si elle a abouti.
  const fraiche = useMemo(() => {
    if (!demandeSuivie) return null;
    const d = (data?.requests || []).find((r) => r.requestId === demandeSuivie);
    return d?.status === 'done' && d.hint ? d.hint.text : null;
  }, [data, demandeSuivie]);

  // Un échec du souffleur, à dire à l'équipe plutôt qu'à laisser en silence.
  const echouee = useMemo(() => {
    if (!demandeSuivie) return null;
    const d = (data?.requests || []).find((r) => r.requestId === demandeSuivie);
    return d?.status === 'failed' ? d : null;
  }, [data, demandeSuivie]);

  const compteur = useMemo(() => {
    if (longueur === 0) return `${LONGUEUR_MIN} caractères minimum`;
    if (longueur < LONGUEUR_MIN) return `Encore ${LONGUEUR_MIN - longueur} caractères`;
    if (longueur > LONGUEUR_MAX) return `${longueur - LONGUEUR_MAX} caractères de trop`;
    return `${longueur} / ${LONGUEUR_MAX} caractères`;
  }, [longueur]);

  if (enigma.isSolved || !enigma.hintsCount) {
    return null;
  }

  const peutDemander = indicesRestants > 0 && !enAttente;

  return (
    <div className="hint-zone" data-testid="hint-section">
      <div className="hint-zone-header">
        <h3>Demander un indice</h3>
        <span className="hint-zone-meta" data-testid="hint-remaining">
          {indicesRestants > 0
            ? `${indicesRestants} indice${indicesRestants > 1 ? 's' : ''} encore disponible${indicesRestants > 1 ? 's' : ''}`
            : 'Tous les indices ont été donnés'}
        </span>
      </div>

      {indicesObtenus.length > 0 && (
        <ul className="hint-obtained-list" data-testid="hint-obtained-list">
          {indicesObtenus.map((indice, rang) => (
            <li className="hint-obtained" key={indice.id} data-testid={`hint-obtained-${indice.id}`}>
              <div className="hint-obtained-head">
                <span className="hint-obtained-rank">Indice {rang + 1}</span>
              </div>
              <p className="hint-obtained-text">{indice.text}</p>
            </li>
          ))}
        </ul>
      )}

      {fraiche && (
        <div className="hint-fresh" data-testid="hint-fresh" role="status">
          <span className="hint-fresh-label">Nouvel indice</span>
          <p>{fraiche}</p>
        </div>
      )}

      {/* Le souffleur travaille. L'appel prend quelques secondes, parfois
          davantage : le dire vaut mieux qu'un écran figé. */}
      {enAttente && !tropLong && (
        <div className="hint-loading" data-testid="hint-loading" role="status">
          Le souffleur réfléchit...
          <span className="hint-loading-note">
            Il compare votre avancement à la résolution de l'énigme. Vous pouvez continuer à
            chercher, l'indice s'affichera ici.
          </span>
        </div>
      )}

      {enAttente && tropLong && (
        <div className="hint-slow" data-testid="hint-slow" role="status">
          Le souffleur ne répond pas pour le moment. Votre demande n'est pas perdue : l'indice
          arrivera. Revenez sur cette énigme dans quelques minutes pour le retrouver.
        </div>
      )}

      {echouee && (
        <div className="hint-error" data-testid="hint-failed" role="alert">
          Le souffleur n'a pas réussi à choisir un indice pour cette demande. Aucun indice n'a été
          consommé : vous pouvez redemander.
        </div>
      )}

      {peutDemander && (
        <>
          <label className="hint-label" htmlFor={`hint-progress-${enigma.id}`}>
            Où en êtes-vous ?
          </label>
          <p className="hint-help">
            Décrivez votre avancement le plus précisément possible : ce que vous avez testé, ce que
            vous avez trouvé, vos blocages, vos idées. L'indice sera choisi en fonction de ce texte,
            donc plus il est détaillé, plus il sera utile.
          </p>
          <textarea
            id={`hint-progress-${enigma.id}`}
            className="hint-textarea"
            data-testid="hint-progress-input"
            value={avancement}
            onChange={(e) => {
              setAvancement(e.target.value);
              setMessageErreur('');
              if (etape === 'confirmation') setEtape('repos');
            }}
            rows={5}
            maxLength={LONGUEUR_MAX + 200}
            placeholder="Nous avons compris que les sept horloges comptent, on a essayé de les additionner sans résultat, et on bloque sur le papier peint..."
            disabled={demande.isPending}
          />
          <div className="hint-counter" data-testid="hint-counter">
            {compteur}
          </div>

          {/* Le barème n'est pas fixé : annoncer un chiffre qui changera serait
              pire que de prévenir sans en donner. */}
          <div className="hint-warning" data-testid="hint-cost-warning">
            Attention : demander un indice pourra coûter des points à votre équipe.
          </div>

          {etape === 'repos' && (
            <button
              type="button"
              className="hint-action-btn"
              data-testid="hint-request-button"
              disabled={!texteValide || demande.isPending}
              onClick={() => setEtape('confirmation')}
            >
              Demander un indice
            </button>
          )}

          {etape === 'confirmation' && (
            <div className="hint-confirm" data-testid="hint-confirm">
              <p className="hint-confirm-question">
                Confirmez-vous la demande ?
              </p>
              <div className="hint-confirm-actions">
                <button
                  type="button"
                  className="hint-action-btn hint-action-confirm"
                  data-testid="hint-confirm-button"
                  disabled={demande.isPending}
                  onClick={() => demande.mutate()}
                >
                  {demande.isPending ? 'Envoi...' : "Oui, demander l'indice"}
                </button>
                <button
                  type="button"
                  className="hint-action-btn hint-action-cancel"
                  data-testid="hint-cancel-button"
                  disabled={demande.isPending}
                  onClick={() => setEtape('repos')}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {messageErreur && (
        <div className="hint-error" data-testid="hint-error" role="alert">
          {messageErreur}
        </div>
      )}
    </div>
  );
};

/** Identifiant de demande. `randomUUID` n'existe pas partout (Safari ancien). */
function creerCle(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export default HintRequestSection;
