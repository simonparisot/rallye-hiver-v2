import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Enigma } from '../../types';
import { hintsAPI } from '../../services/api';
import './HintRequestSection.css';

/**
 * Demander un indice sur une énigme.
 *
 * « Souffleur » reste le nom du mécanisme dans le code, mais il a quitté
 * l'interface : hors du théâtre, le mot ne dit rien de ce que fait le bouton.
 *
 * Au repos, tout tient en un point d'interrogation posé dans la barre de
 * réponse, à côté de « Valider ma réponse ». Rien d'autre : ni consigne, ni
 * avertissement, ni les indices déjà obtenus. Ce qu'on vient faire en ouvrant
 * une énigme, c'est lire l'énoncé et répondre ; l'indice est un recours.
 *
 * Tout le reste vit dans une fenêtre qui voile la page, dans cet ordre : ce que
 * coûte un indice et ce qu'il apporte, les indices déjà reçus, puis la demande.
 * Le fil d'Ariane en trois temps a été retiré : trois étapes dont deux sont un
 * clic ne valaient pas la place qu'elles prenaient.
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

const IconeIndice: React.FC = () => (
  <svg className="souffleur-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9.2" />
    <path d="M9.2 9.3a2.9 2.9 0 015.6 1c0 1.9-2.8 2.5-2.8 4" />
    <path d="M12 17.4h.01" />
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

  // Combien d'indices cette énigme porte, quoi que l'équipe ait déjà reçu.
  // Le serveur le dit depuis peu ; tant qu'un déploiement plus ancien répond,
  // la somme « obtenus + restants » donne la même chose, à ceci près qu'elle
  // vaut zéro pendant le tout premier chargement — d'où l'attente ci-dessous.
  const nombreIndices = data?.totalHints ?? (indicesObtenus.length + indicesRestants);
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

  // Rien à proposer si l'énigme n'a pas d'indice écrit : le bouton ouvrirait
  // une fenêtre vide, et la demande échouerait côté serveur. On attend d'abord
  // la réponse — afficher le bouton puis le retirer serait pire que l'attente.
  if (!data || nombreIndices === 0) return null;

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
        <IconeIndice />
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
            <h3 id="souffleur-titre"><IconeIndice /> Demander un indice</h3>
            <button
              type="button"
              className="souffleur-fermer"
              onClick={fermer}
              aria-label="Fermer"
            >
              ×
            </button>
          </header>

          <div className="souffleur-corps">
            {/* Ce que coûte un indice et ce qu'il apporte, avant tout le reste.
                Le quart est écrit en dur : le barème dort encore côté serveur
                (backend/src/utils/hintCost.ts, nextHintCost vaut 0), mais
                c'est la règle annoncée aux équipes et elle sera rebranchée. */}
            <div className="souffleur-intro" data-testid="hint-cost-warning">
              <p>
                <b>Bloqué sur cette énigme ?</b> Décrivez où vous en êtes : un indice choisi
                pour votre situation s'affichera ici, en quelques secondes.
              </p>
              <p>
                Chaque indice coûte <b>un quart des points de l'énigme</b>. C'est toujours
                plus rentable que de rester bloqué et de n'en marquer aucun.
              </p>
            </div>

            {/* Les indices déjà donnés, rappelés avant d'en demander un autre. */}
            {indicesObtenus.length > 0 && (
              <>
              <h4 className="souffleur-acquis-titre">
                {indicesObtenus.length > 1
                  ? `Les ${indicesObtenus.length} indices déjà reçus`
                  : 'L’indice déjà reçu'}
              </h4>
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
              </>
            )}

            {/* L'indice est en cours de rédaction. */}
            {enAttente && !tropLong && (
              <div className="souffleur-attente" data-testid="hint-loading" role="status">
                <span className="souffleur-points" aria-hidden="true"><i /><i /><i /></span>
                <p className="souffleur-attente-titre">Votre indice arrive…</p>
                <p className="souffleur-attente-note">
                  Il est choisi en fonction de ce que vous avez décrit. Vous pouvez continuer à
                  chercher, il s'affichera ici.
                </p>
              </div>
            )}

            {enAttente && tropLong && (
              <p className="souffleur-alerte" data-testid="hint-slow" role="status">
                L'indice tarde à arriver. Votre demande n'est pas perdue : revenez sur cette énigme
                dans quelques minutes pour le retrouver.
              </p>
            )}

            {echouee && (
              <p className="souffleur-alerte" data-testid="hint-failed" role="alert">
                Aucun indice n'a pu être choisi pour cette demande. Rien ne vous a été décompté :
                vous pouvez redemander.
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
