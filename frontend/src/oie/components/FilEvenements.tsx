import React from 'react';
import { OieEventView, OieTeamPawn } from '../types';

interface FilEvenementsProps {
  evenements: OieEventView[];
  teams: OieTeamPawn[];
}

function heure(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/**
 * Ce que font les autres. Les questions et les reponses n'y figurent jamais :
 * seulement les deplacements, les cases speciales et les delivrances, qui sont
 * justement ce qui rend le plateau partage.
 */
const FilEvenements: React.FC<FilEvenementsProps> = ({ evenements, teams }) => {
  const classement = [...teams].sort((a, b) => {
    if (a.finishRank && b.finishRank) return a.finishRank - b.finishRank;
    if (a.finishRank) return -1;
    if (b.finishRank) return 1;
    return b.position - a.position;
  });

  return (
    <aside className="oie-colonne-laterale">
      <section className="oie-carte oie-classement" data-testid="oie-classement">
        <h2>Sur le plateau</h2>
        <ol className="oie-classement-liste">
          {classement.map((team) => (
            <li
              key={team.teamId}
              className={team.isMine ? 'oie-classement-mienne' : ''}
              data-testid={`oie-classement-${team.teamId}`}
            >
              <span className="oie-classement-nom">{team.teamName}</span>
              <span className="oie-classement-case">
                {team.finishedAt ? 'arrivee' : `case ${team.position}`}
                {team.inPuits ? ' (puits)' : ''}
                {team.inPrison ? ' (prison)' : ''}
              </span>
            </li>
          ))}
          {classement.length === 0 && <li className="oie-vide">Aucune equipe n'a encore joue.</li>}
        </ol>
      </section>

      <section className="oie-carte oie-fil" data-testid="oie-fil-evenements">
        <h2>Ce qui se passe</h2>
        <ul className="oie-fil-liste">
          {evenements.map((evenement) => (
            <li key={evenement.eventId} data-testid={`oie-evenement-${evenement.eventId}`}>
              <span className="oie-fil-heure">{heure(evenement.occurredAt)}</span>
              <span className="oie-fil-message">{evenement.message}</span>
            </li>
          ))}
          {evenements.length === 0 && <li className="oie-vide">Le plateau est encore silencieux.</li>}
        </ul>
      </section>
    </aside>
  );
};

export default FilEvenements;
