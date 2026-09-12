import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Enigma } from '../../types';
import { hintsAPI } from '../../services/api';
import './HintRequestSection.css';

/**
 * Zone « Demander un indice » d'une enigme.
 *
 * L'equipe decrit son avancement, voit le cout exact avant de confirmer, puis
 * recoit un indice. Les indices deja obtenus restent affiches sous l'enigme,
 * pour qu'elle puisse les relire sans rien repayer.
 */

const LONGUEUR_MIN = 20;
const LONGUEUR_MAX = 3000;

interface HintRequestSectionProps {
  enigma: Enigma;
}

type Etape = 'repos' | 'confirmation';

const HintRequestSection: React.FC<HintRequestSectionProps> = ({ enigma }) => {
  const queryClient = useQueryClient();
  const [avancement, setAvancement] = useState('');
  const [etape, setEtape] = useState<Etape>('repos');
  const [dernierIndice, setDernierIndice] = useState<string | null>(null);
  const [messageErreur, setMessageErreur] = useState('');

  // Une cle par saisie : elle identifie la demande cote serveur et permet de
  // distinguer un second clic (meme cle, refuse) d'une nouvelle demande.
  const [cleDemande, setCleDemande] = useState(() => creerCle());

  const { data, isLoading } = useQuery({
    queryKey: ['hints', enigma.id],
    queryFn: () => hintsAPI.listHints(enigma.id),
    enabled: !!enigma.id,
  });

  // Changer d'enigme remet la zone a zero : sans cela, le texte saisi pour une
  // enigme se retrouverait propose pour la suivante.
  useEffect(() => {
    setAvancement('');
    setEtape('repos');
    setDernierIndice(null);
    setMessageErreur('');
    setCleDemande(creerCle());
  }, [enigma.id]);

  const demande = useMutation({
    mutationFn: () => hintsAPI.requestHint(enigma.id, avancement.trim(), cleDemande),
    onSuccess: (reponse) => {
      setDernierIndice(reponse.hint.text);
      setAvancement('');
      setEtape('repos');
      setMessageErreur('');
      setCleDemande(creerCle());
      queryClient.invalidateQueries({ queryKey: ['hints', enigma.id] });
      queryClient.invalidateQueries({ queryKey: ['enigmas-with-progress'] });
      queryClient.invalidateQueries({ queryKey: ['team-stats'] });
    },
    onError: (erreur: any) => {
      setEtape('repos');
      setMessageErreur(
        erreur?.response?.data?.error ||
          "La demande n'a pas abouti. Aucun point ne vous a ete retire : reessayez dans un instant."
      );
    },
  });

  const indicesObtenus = data?.hints || [];
  const indicesRestants = data?.remainingHints ?? 0;
  const coutProchain = data?.nextHintCost ?? 0;
  const longueur = avancement.trim().length;
  const texteValide = longueur >= LONGUEUR_MIN && longueur <= LONGUEUR_MAX;

  const compteur = useMemo(() => {
    if (longueur === 0) return `${LONGUEUR_MIN} caracteres minimum`;
    if (longueur < LONGUEUR_MIN) return `Encore ${LONGUEUR_MIN - longueur} caracteres`;
    if (longueur > LONGUEUR_MAX) return `${longueur - LONGUEUR_MAX} caracteres de trop`;
    return `${longueur} / ${LONGUEUR_MAX} caracteres`;
  }, [longueur]);

  if (enigma.isSolved) {
    return null;
  }

  if (!enigma.hintsCount) {
    return null;
  }

  return (
    <div className="hint-zone" data-testid="hint-section">
      <div className="hint-zone-header">
        <h3>Demander un indice</h3>
        {isLoading ? (
          <span className="hint-zone-meta">Chargement...</span>
        ) : (
          <span className="hint-zone-meta" data-testid="hint-remaining">
            {indicesRestants > 0
              ? `${indicesRestants} indice${indicesRestants > 1 ? 's' : ''} encore disponible${indicesRestants > 1 ? 's' : ''}`
              : 'Tous les indices ont ete donnes'}
          </span>
        )}
      </div>

      {indicesObtenus.length > 0 && (
        <ul className="hint-obtained-list" data-testid="hint-obtained-list">
          {indicesObtenus.map((indice, rang) => (
            <li className="hint-obtained" key={indice.id} data-testid={`hint-obtained-${indice.id}`}>
              <div className="hint-obtained-head">
                <span className="hint-obtained-rank">Indice {rang + 1}</span>
                <span className="hint-obtained-cost">
                  {indice.pointsCharged > 0 ? `-${indice.pointsCharged} points` : 'sans cout'}
                </span>
              </div>
              <p className="hint-obtained-text">{indice.text}</p>
            </li>
          ))}
        </ul>
      )}

      {dernierIndice && (
        <div className="hint-fresh" data-testid="hint-fresh" role="status">
          <span className="hint-fresh-label">Nouvel indice</span>
          <p>{dernierIndice}</p>
        </div>
      )}

      {indicesRestants > 0 && (
        <>
          <label className="hint-label" htmlFor={`hint-progress-${enigma.id}`}>
            Ou en etes-vous ?
          </label>
          <p className="hint-help">
            Decrivez votre avancement le plus precisement possible : ce que vous avez teste, ce que
            vous avez trouve, vos blocages, vos idees. L'indice sera choisi en fonction de ce texte,
            donc plus il est detaille, plus il sera utile.
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
            placeholder="Nous avons compris que les sept horloges comptent, on a essaye de les additionner sans resultat, et on bloque sur le papier peint..."
            disabled={demande.isPending}
          />
          <div className="hint-counter" data-testid="hint-counter">
            {compteur}
          </div>

          <div className="hint-warning" data-testid="hint-cost-warning">
            Un indice coute <strong>{coutProchain} point{coutProchain > 1 ? 's' : ''}</strong> sur
            les {data?.enigmaPoints ?? enigma.points} points de cette enigme. Le prelevement est
            definitif.
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
                Confirmez-vous la demande ? {coutProchain} point{coutProchain > 1 ? 's' : ''} seront
                retires du score de cette enigme.
              </p>
              <div className="hint-confirm-actions">
                <button
                  type="button"
                  className="hint-action-btn hint-action-confirm"
                  data-testid="hint-confirm-button"
                  disabled={demande.isPending}
                  onClick={() => demande.mutate()}
                >
                  {demande.isPending ? 'Recherche de l\'indice...' : 'Oui, demander l\'indice'}
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

          {demande.isPending && (
            <div className="hint-loading" data-testid="hint-loading">
              Nous comparons votre avancement a la resolution de l'enigme. Cela prend quelques
              secondes.
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
