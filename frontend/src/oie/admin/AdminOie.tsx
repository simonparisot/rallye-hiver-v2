import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { oieAdminAPI } from '../api';
import { OieSquareAdmin } from '../types';
import './AdminOie.css';

/**
 * Page /admin/oie : les 63 questions, le quota de lancers, et l'etat des
 * equipes sur le plateau.
 *
 * Le formulaire tabulaire sert aux retouches ; pour ecrire soixante questions,
 * l'import JSON est le vrai chemin. Le format exporte est exactement celui que
 * lit backend/scripts/seed-oie-board.js, de sorte qu'il n'y a qu'un format a
 * connaitre.
 */

const LIBELLES_TYPE: Record<string, string> = {
  depart: 'Départ',
  normale: 'Ordinaire',
  oie: "L'oie (on rejoue)",
  souffleur: 'Souffleur (indice)',
  loge: 'La loge (passer un tour)',
  puits: 'Le puits',
  prison: 'La prison (2 tours)',
  mort: 'La répétition (retour à 0)',
  arrivee: 'Arrivée',
};

/** Cases ou une equipe ne s'arrete jamais : elles n'ont pas besoin de question. */
const SANS_QUESTION = [0, 63, 58, 9, 18, 27, 36, 45, 54];

const AdminOie: React.FC = () => {
  const queryClient = useQueryClient();
  const fichierRef = useRef<HTMLInputElement>(null);

  const [squares, setSquares] = useState<OieSquareAdmin[]>([]);
  const [rollsPerDay, setRollsPerDay] = useState(1);
  const [enigmaId, setEnigmaId] = useState('');
  const [message, setMessage] = useState<{ texte: string; type: 'succes' | 'erreur' } | null>(null);
  const [modifie, setModifie] = useState(false);

  const { data: plateauData, isLoading, error } = useQuery({
    queryKey: ['adminOieBoard'],
    queryFn: oieAdminAPI.getBoard,
  });

  const { data: equipesData } = useQuery({
    queryKey: ['adminOieTeams'],
    queryFn: oieAdminAPI.getTeams,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!plateauData?.board) return;
    setSquares(plateauData.board.squares);
    setRollsPerDay(plateauData.board.rollsPerDay);
    setEnigmaId(plateauData.board.enigmaId || '');
    setModifie(false);
  }, [plateauData]);

  const enregistrer = useMutation({
    mutationFn: () => oieAdminAPI.saveBoard({ squares, rollsPerDay, enigmaId: enigmaId.trim() || undefined }),
    onSuccess: () => {
      setMessage({ texte: 'Plateau enregistré.', type: 'succes' });
      setModifie(false);
      queryClient.invalidateQueries({ queryKey: ['adminOieBoard'] });
    },
    onError: (err: any) => {
      setMessage({
        texte: err?.response?.data?.error || "L'enregistrement a échoué.",
        type: 'erreur',
      });
    },
  });

  const reinitialiser = useMutation({
    mutationFn: (teamId: string) => oieAdminAPI.resetTeam(teamId),
    onSuccess: (data) => {
      setMessage({ texte: `${data.teamName} est remise en case 0.`, type: 'succes' });
      queryClient.invalidateQueries({ queryKey: ['adminOieTeams'] });
    },
    onError: (err: any) => {
      setMessage({
        texte: err?.response?.data?.error || 'La remise à zéro a échoué.',
        type: 'erreur',
      });
    },
  });

  const modifierCase = (squareNumber: number, champ: keyof OieSquareAdmin, valeur: string) => {
    setModifie(true);
    setSquares((precedent) =>
      precedent.map((square) => {
        if (square.squareNumber !== squareNumber) return square;
        if (champ === 'acceptedAnswers') {
          return {
            ...square,
            acceptedAnswers: valeur
              .split(';')
              .map((reponse) => reponse.trim())
              .filter(Boolean),
          };
        }
        return { ...square, [champ]: valeur };
      })
    );
  };

  const exporter = () => {
    const contenu = JSON.stringify({ rollsPerDay, enigmaId, squares }, null, 2);
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
    lien.download = 'plateau-oie.json';
    lien.click();
    URL.revokeObjectURL(lien.href);
  };

  const importer = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = event.target.files?.[0];
    if (!fichier) return;

    try {
      const contenu = JSON.parse(await fichier.text());
      if (!Array.isArray(contenu.squares)) {
        throw new Error('le fichier doit contenir un tableau "squares"');
      }

      // On repart des 64 cases connues : le fichier peut en omettre, et le type
      // d'une case ne se decrete pas, il vient de son numero.
      const parNumero = new Map<number, any>();
      contenu.squares.forEach((square: any) => parNumero.set(square.squareNumber, square));

      setSquares((precedent) =>
        precedent.map((square) => {
          const importee = parNumero.get(square.squareNumber);
          if (!importee) return square;
          return {
            ...square,
            question: importee.question || undefined,
            acceptedAnswers: Array.isArray(importee.acceptedAnswers) ? importee.acceptedAnswers : [],
            hint: importee.hint || undefined,
            flavor: importee.flavor || undefined,
          };
        })
      );

      if (Number.isInteger(contenu.rollsPerDay)) setRollsPerDay(contenu.rollsPerDay);
      if (typeof contenu.enigmaId === 'string') setEnigmaId(contenu.enigmaId);

      setModifie(true);
      setMessage({ texte: 'Fichier importé. Pensez à enregistrer.', type: 'succes' });
    } catch (err: any) {
      setMessage({ texte: `Import impossible : ${err.message}`, type: 'erreur' });
    } finally {
      if (fichierRef.current) fichierRef.current.value = '';
    }
  };

  if (isLoading) {
    return <div className="loading" data-testid="admin-oie-loading">Chargement du plateau...</div>;
  }

  if (error) {
    return <div className="error" data-testid="admin-oie-error">Le plateau n'a pas pu être chargé.</div>;
  }

  const manquantes = squares.filter(
    (square) =>
      !SANS_QUESTION.includes(square.squareNumber) &&
      (!square.question || square.acceptedAnswers.length === 0)
  );

  return (
    <div className="admin-oie" data-testid="admin-oie-page">
      <div className="admin-page-header">
        <div>
          <h1>Jeu de l'oie</h1>
          <p className="admin-page-subtitle">
            Les questions du plateau partagé, le quota de lancers et l'état des équipes
          </p>
        </div>
        <div className="admin-oie-actions">
          <button className="btn" onClick={exporter} data-testid="admin-oie-export">
            Exporter en JSON
          </button>
          <button
            className="btn"
            onClick={() => fichierRef.current?.click()}
            data-testid="admin-oie-import"
          >
            Importer un JSON
          </button>
          <input
            ref={fichierRef}
            type="file"
            accept="application/json,.json"
            onChange={importer}
            style={{ display: 'none' }}
            data-testid="admin-oie-fichier"
          />
          <button
            className="btn btn-primary"
            onClick={() => enregistrer.mutate()}
            disabled={enregistrer.isPending}
            data-testid="admin-oie-enregistrer"
          >
            {enregistrer.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`admin-oie-message admin-oie-message-${message.type}`}
          data-testid="admin-oie-message"
        >
          {message.texte}
        </div>
      )}

      {modifie && (
        <div className="admin-oie-message admin-oie-message-alerte" data-testid="admin-oie-modifie">
          Des modifications ne sont pas encore enregistrées.
        </div>
      )}

      <div className="card admin-oie-reglages">
        <div className="admin-oie-reglage">
          <label htmlFor="oie-rolls-per-day">Lancers par jour et par équipe</label>
          <input
            id="oie-rolls-per-day"
            type="number"
            min={1}
            max={20}
            value={rollsPerDay}
            onChange={(event) => {
              setRollsPerDay(Number(event.target.value));
              setModifie(true);
            }}
            data-testid="admin-oie-rolls-per-day"
          />
          <p className="admin-oie-aide">
            La journée change à minuit, heure de Paris. Augmenter ce nombre rend immédiatement
            des lancers aux équipes qui avaient épuisé leur quota du jour.
          </p>
        </div>

        <div className="admin-oie-reglage">
          <label htmlFor="oie-enigma-id">Identifiant de l'énigme associée</label>
          <input
            id="oie-enigma-id"
            type="text"
            value={enigmaId}
            onChange={(event) => {
              setEnigmaId(event.target.value);
              setModifie(true);
            }}
            placeholder="enigmaId de l'énigme créée pour le jeu de l'oie"
            data-testid="admin-oie-enigma-id"
          />
          <p className="admin-oie-aide">
            Sans lui, l'arrivée en case 63 ne marque aucune énigme comme résolue et le
            classement ne compte rien.
          </p>
        </div>

        <div className="admin-oie-reglage">
          <span className="admin-oie-compteur" data-testid="admin-oie-compteur">
            {squares.filter((square) => square.question).length} cases avec question
          </span>
          {manquantes.length > 0 && (
            <p className="admin-oie-aide admin-oie-aide-alerte" data-testid="admin-oie-manquantes">
              Cases sans question : {manquantes.map((square) => square.squareNumber).join(', ')}.
              Une équipe qui s'y arrête pourra relancer sans répondre.
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Les 63 cases</h2>
        <p className="admin-oie-aide">
          Séparez les réponses acceptées par un point virgule. La comparaison ignore la casse,
          les accents, les espaces et la ponctuation.
        </p>
        <div className="admin-oie-tableau">
          <table className="admin-table" data-testid="admin-oie-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Nature</th>
                <th>Question</th>
                <th>Réponses acceptées</th>
                <th>Indice du souffleur</th>
                <th>Ambiance</th>
              </tr>
            </thead>
            <tbody>
              {squares.map((square) => (
                <tr
                  key={square.squareNumber}
                  data-testid={`admin-oie-ligne-${square.squareNumber}`}
                  className={square.type !== 'normale' ? 'admin-oie-ligne-speciale' : ''}
                >
                  <td className="admin-oie-numero">{square.squareNumber}</td>
                  <td className="admin-oie-type">{LIBELLES_TYPE[square.type] || square.type}</td>
                  <td>
                    <input
                      type="text"
                      value={square.question || ''}
                      onChange={(event) =>
                        modifierCase(square.squareNumber, 'question', event.target.value)
                      }
                      data-testid={`admin-oie-question-${square.squareNumber}`}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={square.acceptedAnswers.join(' ; ')}
                      onChange={(event) =>
                        modifierCase(square.squareNumber, 'acceptedAnswers', event.target.value)
                      }
                      data-testid={`admin-oie-reponses-${square.squareNumber}`}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={square.hint || ''}
                      disabled={square.type !== 'souffleur'}
                      onChange={(event) =>
                        modifierCase(square.squareNumber, 'hint', event.target.value)
                      }
                      data-testid={`admin-oie-indice-${square.squareNumber}`}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={square.flavor || ''}
                      onChange={(event) =>
                        modifierCase(square.squareNumber, 'flavor', event.target.value)
                      }
                      data-testid={`admin-oie-ambiance-${square.squareNumber}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Les équipes sur le plateau</h2>
        <table className="admin-table" data-testid="admin-oie-equipes">
          <thead>
            <tr>
              <th>Équipe</th>
              <th>Case</th>
              <th>État</th>
              <th>Lancers restants</th>
              <th>Total lancers</th>
              <th>Erreurs</th>
              <th>Indices</th>
              <th>63 ratés</th>
              <th>Arrivée</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(equipesData?.teams || []).map((equipe) => (
              <tr key={equipe.teamId} data-testid={`admin-oie-equipe-${equipe.teamId}`}>
                <td>
                  {equipe.teamName}
                  {equipe.isTestTeam && <span className="admin-oie-badge">test</span>}
                </td>
                <td>{equipe.position}</td>
                <td>{equipe.status.replace(/_/g, ' ')}</td>
                <td>{equipe.rollsRemainingToday}</td>
                <td>{equipe.totalRolls}</td>
                <td>{equipe.wrongAnswers}</td>
                <td>{equipe.hintsUsed}</td>
                <td>{equipe.overshootCount}</td>
                <td>{equipe.finishRank ? `rang ${equipe.finishRank}` : ''}</td>
                <td>
                  <button
                    className="btn btn-danger"
                    onClick={() => reinitialiser.mutate(equipe.teamId)}
                    disabled={reinitialiser.isPending}
                    data-testid={`admin-oie-reset-${equipe.teamId}`}
                  >
                    Remettre à zéro
                  </button>
                </td>
              </tr>
            ))}
            {(equipesData?.teams || []).length === 0 && (
              <tr>
                <td colSpan={10}>Aucune équipe n'a encore ouvert le plateau.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminOie;
