import React, { useState } from 'react';
import { OieMyView } from '../types';

interface CarteActionProps {
  me: OieMyView;
  /** Vrai pendant l'envoi d'une reponse ou d'un lancer. */
  occupe: boolean;
  messageReponse: { texte: string; correct: boolean } | null;
  onRepondre: (reponse: string) => void;
  onLancer: () => void;
  onSouffleur: () => void;
}

/**
 * Carte d'action de mon equipe : a chaque instant, une seule chose a faire.
 * Soit repondre a la question de sa case, soit lancer les des, soit attendre,
 * et dans ce dernier cas la carte dit pourquoi et jusqu'a quand.
 */
const CarteAction: React.FC<CarteActionProps> = ({
  me,
  occupe,
  messageReponse,
  onRepondre,
  onLancer,
  onSouffleur,
}) => {
  const [reponse, setReponse] = useState('');

  const soumettre = (event: React.FormEvent) => {
    event.preventDefault();
    if (!reponse.trim() || occupe) return;
    onRepondre(reponse.trim());
    setReponse('');
  };

  if (me.finishedAt) {
    return (
      <section className="oie-carte oie-carte-arrivee" data-testid="oie-carte-action">
        <h2>Rideau</h2>
        <p data-testid="oie-arrivee-message">
          Votre equipe est arrivee en case 63
          {me.finishRank ? ` en ${me.finishRank}e position` : ''}. L'enigme est resolue.
        </p>
        <dl className="oie-chiffres">
          <div><dt>Lancers</dt><dd>{me.totalRolls}</dd></div>
          <div><dt>Mauvaises reponses</dt><dd>{me.wrongAnswers}</dd></div>
          <div><dt>63 rates</dt><dd>{me.overshootCount}</dd></div>
        </dl>
      </section>
    );
  }

  return (
    <section className="oie-carte" data-testid="oie-carte-action">
      <header className="oie-carte-entete">
        <h2>Votre equipe</h2>
        <p className="oie-carte-position" data-testid="oie-ma-position">
          Case {me.position}
          {me.flavor ? ` : ${me.flavor}` : ''}
        </p>
      </header>

      {me.questionPending && me.question && (
        <form className="oie-question" onSubmit={soumettre} data-testid="oie-formulaire-reponse">
          <p className="oie-question-texte" data-testid="oie-question">{me.question}</p>
          <div className="oie-question-saisie">
            <label className="oie-champ-label" htmlFor="oie-reponse">Votre reponse</label>
            <input
              id="oie-reponse"
              type="text"
              value={reponse}
              onChange={(event) => setReponse(event.target.value)}
              placeholder="Votre reponse"
              disabled={occupe}
              data-testid="oie-champ-reponse"
              autoComplete="off"
            />
            <button type="submit" disabled={occupe || !reponse.trim()} data-testid="oie-bouton-repondre">
              {occupe ? 'Envoi...' : 'Repondre'}
            </button>
          </div>

          {me.hintAvailable && (
            <div className="oie-souffleur">
              {me.hintRequested && me.hint ? (
                <p className="oie-souffleur-texte" data-testid="oie-indice">
                  Le souffleur : {me.hint}
                </p>
              ) : (
                <button
                  type="button"
                  className="oie-bouton-secondaire"
                  onClick={onSouffleur}
                  disabled={occupe}
                  data-testid="oie-bouton-souffleur"
                >
                  Demander au souffleur
                </button>
              )}
            </div>
          )}
        </form>
      )}

      {me.questionPending && !me.question && (
        <p className="oie-attente" data-testid="oie-question-absente">
          La question de cette case n'est pas encore ecrite. Prevenez l'organisation.
        </p>
      )}

      {messageReponse && (
        <p
          className={`oie-message ${messageReponse.correct ? 'oie-message-succes' : 'oie-message-erreur'}`}
          data-testid={messageReponse.correct ? 'oie-reponse-juste' : 'oie-reponse-fausse'}
        >
          {messageReponse.texte}
        </p>
      )}

      <div className="oie-lancer">
        <button
          type="button"
          className="oie-bouton-principal"
          onClick={onLancer}
          disabled={!me.canRoll || occupe}
          data-testid="oie-bouton-lancer"
        >
          {occupe ? 'Les des roulent...' : 'Lancer les des'}
        </button>

        <p className="oie-quota" data-testid="oie-quota">
          {me.rollsRemainingToday} lancer{me.rollsRemainingToday > 1 ? 's' : ''} restant
          {me.rollsRemainingToday > 1 ? 's' : ''} aujourd'hui sur {me.rollsPerDay}
        </p>

        {me.rollRefusal && (
          <p className="oie-blocage" data-testid="oie-blocage">{me.rollRefusal}</p>
        )}
      </div>
    </section>
  );
};

export default CarteAction;
