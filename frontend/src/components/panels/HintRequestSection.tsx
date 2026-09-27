import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Enigma } from '../../types';
import { hintsAPI } from '../../services/api';
import './HintRequestSection.css';

/**
 * Le souffleur : demander un indice sur une énigme.
 *
 * Au repos, le souffleur tient en une icône posée dans la barre de réponse, à
 * côté de « Valider ma réponse ». Rien d'autre : ni consigne, ni avertissement,
 * ni les indices déjà obtenus. Ce qu'on vient faire en ouvrant une énigme,
 * c'est lire l'énoncé et répondre ; l'indice est un recours.
 *
 * Tout le reste vit dans une fenêtre qui voile la page : les indices déjà
 * donnés, la marche à suivre, les mises en garde, la demande. Le parcours y est
 * montré plutôt qu'expliqué — décrire, confirmer, recevoir — et la longueur du
 * texte se lit à une jauge plutôt qu'à un décompte.
 *
 * Le composant ne sait pas comment le modèle est appelé. Selon le réglage du
 * serveur, la réponse est immédiate ou différée : il se contente du statut
 * renvoyé et réinterroge tant qu'une demande est `pending`.
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

/** Les trois temps du parcours, montrés à l'équipe. */
const ETAPES = ['Décrire', 'Confirmer', "L'indice"] as const;

const MasqueSouffleur: React.FC = () => (
  <svg className="souffleur-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3c-4.4 0-8 2.9-8 6.5 0 2 1.1 3.8 2.9 5v2.2c0 .6.6 1 1.1.7l2.2-1.3c.6.1 1.2.2 1.8.2 4.4 0 8-2.9 8-6.8S16.4 3 12 3z" />
    <path d="M9 10h.01M15 10h.01M9.5 13c.8.6 4.2.6 5 0" />
  </svg>
);

const HintRequestSection: React.FC<HintRequestSectionProps> = ({ enigma }) => {
  const queryClient = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const [avancement, setAvancement] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [messageErreur, setMessageErreur] = useState('');
  const [tropLong, setTropLong] = useState(false);

  // Identifiant de la demande suivie, pour signaler l'indice qui vient
  // d'arriver plutôt que le premier de la liste.
  const [demandeSuivie, setDemandeSuivie] = useState<string | null>(null);
  const debutAttente = useRef<number | null>(null);
  const champ = useRef<HTMLTextAreaElement>(null);

  // Une clé par saisie : elle identifie la demande côté serveur et permet de
  // distinguer un second clic (même clé, refusé) d'une nouvelle demande.
  const [cleDemande, setCleDemande] = useState(() => creerCle());

  const { data } = useQuery({
    queryKey: ['hints', enigma.id],
    queryFn: () => hintsAPI.listHints(enigma.id),
    enabled: !!enigma.id,
    refetchInterval: (query) => {
      const d: any = query.state.data;
      return d?.pendingRequest && !tropLong ? PERIODE_ATTENTE_MS : false;
    },
  });

  const enAttente = !!data?.pendingRequest;

  // Changer d'énigme remet la zone à zéro : sans cela, le texte saisi pour une
  // énigme se retrouverait proposé pour la suivante.
  useEffect(() => {
    setOuvert(false);
    setAvancement('');
    setConfirmation(false);
    setMessageErreur('');
    setDemandeSuivie(null);
    setTropLong(false);
    debutAttente.current = null;
    setCleDemande(creerCle());
  }, [enigma.id]);

  // Une demande laissée en plan ne rouvre pas la fenêtre de force — surgir
  // devant quelqu'un qui vient lire une énigme serait pire que le silence.
  // C'est la pastille du bouton qui bat pour le dire.

  // Compteur de patience, démarré à la première attente observée.
  useEffect(() => {
    if (!enAttente) {
      debutAttente.current = null;
      setTropLong(false);
      return;
    }
    if (debutAttente.current === null) debutAttente.current = Date.now();
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
      setConfirmation(false);
      setMessageErreur('');
      setTropLong(false);
      debutAttente.current = Date.now();
      setCleDemande(creerCle());
      queryClient.invalidateQueries({ queryKey: ['hints', enigma.id] });
      queryClient.invalidateQueries({ queryKey: ['enigmas-with-progress'] });
      queryClient.invalidateQueries({ queryKey: ['team-stats'] });
    },
    onError: (erreur: any) => {
      setConfirmation(false);
      setMessageErreur(
        erreur?.response?.data?.error || "La demande n'a pas abouti. Réessayez dans un instant."
      );
    },
  });

  const indicesObtenus = data?.hints || [];
  const indicesRestants = data?.remainingHints ?? 0;
  const longueur = avancement.trim().length;
  const texteValide = longueur >= LONGUEUR_MIN && longueur <= LONGUEUR_MAX;

  const suivie = useMemo(
    () => (data?.requests || []).find((r) => r.requestId === demandeSuivie),
    [data, demandeSuivie]
  );
  /** Identifiant de l'indice tout juste reçu, pour le distinguer des autres. */
  const idFrais = suivie?.status === 'done' ? suivie.hint?.id ?? null : null;
  const echouee = suivie?.status === 'failed';

  const compteur = useMemo(() => {
    if (longueur === 0) return `${LONGUEUR_MIN} caractères minimum`;
    if (longueur < LONGUEUR_MIN) return `Encore ${LONGUEUR_MIN - longueur} caractères`;
    if (longueur > LONGUEUR_MAX) return `${longueur - LONGUEUR_MAX} caractères de trop`;
    return `${longueur} caractères`;
  }, [longueur]);

  if (enigma.isSolved || !enigma.hintsCount) return null;

  const epuise = indicesRestants <= 0;
  const etapeCourante = enAttente || idFrais ? 2 : confirmation ? 1 : 0;

  const ouvrir = () => {
    setOuvert(true);
    setMessageErreur('');
    // Le champ est la seule chose à faire une fois la fenêtre ouverte.
    window.setTimeout(() => champ.current?.focus(), 60);
  };

  const fermer = () => {
    setOuvert(false);
    setConfirmation(false);
  };

  const libelleBouton = epuise
    ? 'Indices : tous donnés'
    : indicesObtenus.length > 0
      ? `Indices (${indicesObtenus.length} obtenu${indicesObtenus.length > 1 ? 's' : ''}, ${indicesRestants} restant${indicesRestants > 1 ? 's' : ''})`
      : `Demander un indice (${indicesRestants} disponible${indicesRestants > 1 ? 's' : ''})`;

  return (
    <div className="souffleur" data-testid="hint-section">
      {/* --- Au repos : une icône dans la barre de réponse. --- */}
      <button
        type="button"
        className={`souffleur-icone-btn ${enAttente ? 'souffleur-icone-btn-actif' : ''}`}
        data-testid="hint-trigger"
        onClick={ouvrir}
        aria-haspopup="dialog"
        aria-label={libelleBouton}
        title={libelleBouton}
      >
        <MasqueSouffleur />
        {/* Une pastille dit ce qu'il y a à savoir sans prendre de place :
            le nombre d'indices déjà obtenus, ou l'attente en cours. */}
        {enAttente ? (
          <span className="souffleur-pastille souffleur-pastille-attente" aria-hidden="true" />
        ) : indicesObtenus.length > 0 ? (
          <span className="souffleur-pastille" aria-hidden="true">{indicesObtenus.length}</span>
        ) : null}
      </button>

      {/* --- Ouvert : une fenêtre qui voile la page. --- */}
      {ouvert && (
        <div
          className="souffleur-voile"
          onClick={(e) => { if (e.target === e.currentTarget && !enAttente) fermer(); }}
        >
        <div className="souffleur-panneau" role="dialog" aria-modal="true" aria-labelledby="souffleur-titre">
          <header className="souffleur-tete">
            <h3 id="souffleur-titre"><MasqueSouffleur /> Le souffleur</h3>
            <button
              type="button"
              className="souffleur-fermer"
              onClick={fermer}
              aria-label="Fermer"
            >
              ×
            </button>
          </header>

          <ol className="souffleur-etapes" aria-label="Étapes de la demande">
            {ETAPES.map((libelle, i) => (
              <li
                key={libelle}
                className={i < etapeCourante ? 'faite' : i === etapeCourante ? 'courante' : ''}
                aria-current={i === etapeCourante ? 'step' : undefined}
              >
                <span className="souffleur-puce">{i < etapeCourante ? '✓' : i + 1}</span>
                {libelle}
              </li>
            ))}
          </ol>

          <div className="souffleur-corps">
            {/* Les indices déjà donnés : c'est ce que l'équipe a payé, et les
                relire ici évite d'en redemander un pour rien. */}
            {indicesObtenus.length > 0 && (
              <ul className="souffleur-acquis" data-testid="hint-obtained-list">
                {indicesObtenus.map((indice, rang) => (
                  <li
                    key={indice.id}
                    className={`souffleur-indice ${indice.id === idFrais ? 'souffleur-indice-neuf' : ''}`}
                    data-testid={`hint-obtained-${indice.id}`}
                  >
                    <span className="souffleur-indice-rang" aria-hidden="true">{rang + 1}</span>
                    <div className="souffleur-indice-corps">
                      {indice.id === idFrais && <span className="souffleur-neuf">Nouvel indice</span>}
                      <p className="souffleur-indice-texte">{indice.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Étape 3 — le souffleur cherche. */}
            {enAttente && !tropLong && (
              <div className="souffleur-attente" data-testid="hint-loading" role="status">
                <span className="souffleur-points" aria-hidden="true"><i /><i /><i /></span>
                <p className="souffleur-attente-titre">Le souffleur cherche…</p>
                <p className="souffleur-attente-note">
                  Il compare votre avancement à la résolution de l'énigme. Vous pouvez continuer à
                  chercher, l'indice s'affichera ici.
                </p>
              </div>
            )}

            {enAttente && tropLong && (
              <p className="souffleur-alerte" data-testid="hint-slow" role="status">
                Le souffleur ne répond pas pour le moment. Votre demande n'est pas perdue : revenez
                sur cette énigme dans quelques minutes pour retrouver l'indice.
              </p>
            )}

            {echouee && (
              <p className="souffleur-alerte" data-testid="hint-failed" role="alert">
                Le souffleur n'a pas su choisir un indice. Aucun indice n'a été consommé : vous
                pouvez redemander.
              </p>
            )}

            {/* Étapes 1 et 2 — décrire, puis confirmer. */}
            {!enAttente && !epuise && (
              <>
                <p className="souffleur-reste-ligne" data-testid="hint-remaining">
                  {indicesRestants} indice{indicesRestants > 1 ? 's' : ''} encore disponible{indicesRestants > 1 ? 's' : ''}
                </p>
                <label className="souffleur-label" htmlFor={`hint-progress-${enigma.id}`}>
                  Où en êtes-vous ?
                </label>
                <p className="souffleur-aide">
                  Plus vous décrivez précisément ce que vous avez testé, trouvé, ou ce qui vous
                  bloque, plus l'indice sera utile.
                </p>
                <textarea
                  id={`hint-progress-${enigma.id}`}
                  ref={champ}
                  className="souffleur-champ"
                  data-testid="hint-progress-input"
                  value={avancement}
                  onChange={(e) => {
                    setAvancement(e.target.value);
                    setMessageErreur('');
                    if (confirmation) setConfirmation(false);
                  }}
                  rows={4}
                  maxLength={LONGUEUR_MAX + 200}
                  placeholder="Nous avons compris que les sept horloges comptent, on a essayé de les additionner sans résultat, et on bloque sur le papier peint…"
                  disabled={demande.isPending}
                />

                {/* La longueur se lit d'un coup d'œil ; le texte reste, pour
                    qui ne voit pas la jauge. */}
                <div className="souffleur-jauge-ligne">
                  <span
                    className={`souffleur-jauge ${texteValide ? 'assez' : ''} ${longueur > LONGUEUR_MAX ? 'trop' : ''}`}
                    aria-hidden="true"
                  >
                    <i style={{ width: `${Math.min(100, (longueur / LONGUEUR_MIN) * 100)}%` }} />
                  </span>
                  <span className="souffleur-compteur" data-testid="hint-counter">{compteur}</span>
                </div>

                {/* Le barème n'est pas fixé : annoncer un chiffre qui changera
                    serait pire que de prévenir sans en donner. */}
                <p className="souffleur-avertissement" data-testid="hint-cost-warning">
                  Demander un indice pourra coûter des points à votre équipe.
                </p>

                {!confirmation ? (
                  <div className="souffleur-actions">
                    <button
                      type="button"
                      className="souffleur-bouton souffleur-bouton-fort"
                      data-testid="hint-request-button"
                      disabled={!texteValide || demande.isPending}
                      onClick={() => setConfirmation(true)}
                    >
                      Demander un indice
                    </button>
                  </div>
                ) : (
                  <div className="souffleur-confirme" data-testid="hint-confirm">
                    <p className="souffleur-confirme-question">Confirmez-vous la demande ?</p>
                    <div className="souffleur-actions">
                      <button
                        type="button"
                        className="souffleur-bouton souffleur-bouton-fort"
                        data-testid="hint-confirm-button"
                        disabled={demande.isPending}
                        onClick={() => demande.mutate()}
                      >
                        {demande.isPending ? 'Envoi…' : "Oui, demander l'indice"}
                      </button>
                      <button
                        type="button"
                        className="souffleur-bouton"
                        data-testid="hint-cancel-button"
                        disabled={demande.isPending}
                        onClick={() => setConfirmation(false)}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {epuise && !enAttente && (
              <p className="souffleur-aide">Tous les indices de cette énigme ont été donnés.</p>
            )}

            {messageErreur && (
              <p className="souffleur-alerte" data-testid="hint-error" role="alert">{messageErreur}</p>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

/** Identifiant de demande. `randomUUID` n'existe pas partout (Safari ancien). */
function creerCle(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export default HintRequestSection;
