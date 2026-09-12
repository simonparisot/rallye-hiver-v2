import React from 'react';
import { OieSquareView, OieTeamPawn } from '../types';

interface PlateauProps {
  squares: OieSquareView[];
  teams: OieTeamPawn[];
  /** Case mise en avant apres un lancer. */
  caseSurlignee?: number | null;
}

/** Libelle court de chaque case speciale, affiche sous le numero. */
const LIBELLES: Record<string, string> = {
  depart: 'Lever de rideau',
  oie: "L'oie",
  souffleur: 'Souffleur',
  loge: 'La loge',
  puits: 'Le puits',
  prison: 'La prison',
  mort: 'La repetition',
  arrivee: 'Rideau',
};

/** Nom abrege d'une equipe pour tenir sur un pion. */
function abreger(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return '?';
  if (mots.length === 1) return mots[0].slice(0, 3).toUpperCase();
  return mots
    .slice(0, 3)
    .map((mot) => mot[0])
    .join('')
    .toUpperCase();
}

/**
 * Plateau en serpentin sur une grille de huit colonnes : la spirale historique
 * n'apporte rien a la lecture sur un ecran, et surtout pas sur un telephone.
 * Les huit rangees se lisent en alternance, de gauche a droite puis de droite
 * a gauche, comme un boustrophedon.
 */
const Plateau: React.FC<PlateauProps> = ({ squares, teams, caseSurlignee }) => {
  const parCase = new Map<number, OieTeamPawn[]>();
  teams.forEach((team) => {
    const liste = parCase.get(team.position) || [];
    liste.push(team);
    parCase.set(team.position, liste);
  });

  const rangees: OieSquareView[][] = [];
  for (let index = 0; index < 8; index += 1) {
    const rangee = squares.slice(index * 8, index * 8 + 8);
    rangees.push(index % 2 === 1 ? [...rangee].reverse() : rangee);
  }

  return (
    <div className="oie-plateau-cadre">
      <div className="oie-plateau" data-testid="oie-plateau">
        {rangees.map((rangee, indexRangee) =>
          rangee.map((square) => {
            const pions = parCase.get(square.squareNumber) || [];
            const mienne = pions.some((pion) => pion.isMine);
            const libelle = LIBELLES[square.type];

            return (
              <div
                key={square.squareNumber}
                data-testid={`oie-case-${square.squareNumber}`}
                className={[
                  'oie-case',
                  `oie-case-${square.type}`,
                  mienne ? 'oie-case-mienne' : '',
                  caseSurlignee === square.squareNumber ? 'oie-case-surlignee' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                title={libelle ? `Case ${square.squareNumber} : ${libelle}` : `Case ${square.squareNumber}`}
                style={{ gridRow: indexRangee + 1 }}
              >
                <span className="oie-case-numero">{square.squareNumber}</span>
                {libelle && <span className="oie-case-libelle">{libelle}</span>}
                {pions.length > 0 && (
                  <span className="oie-case-pions">
                    {pions.slice(0, 3).map((pion) => (
                      <span
                        key={pion.teamId}
                        className={`oie-pion ${pion.isMine ? 'oie-pion-mien' : ''}`}
                        title={pion.teamName}
                        data-testid={`oie-pion-${pion.teamId}`}
                      >
                        {abreger(pion.teamName)}
                      </span>
                    ))}
                    {pions.length > 3 && (
                      <span className="oie-pion oie-pion-reste">+{pions.length - 3}</span>
                    )}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      <ul className="oie-legende" data-testid="oie-legende">
        <li><span className="oie-puce oie-case-oie" /> L'acteur sur son oie : on rejoue</li>
        <li><span className="oie-puce oie-case-souffleur" /> Le souffleur : un indice sur demande</li>
        <li><span className="oie-puce oie-case-loge" /> La loge : on passe un tour</li>
        <li><span className="oie-puce oie-case-puits" /> Le puits : on attend d'etre repeche</li>
        <li><span className="oie-puce oie-case-prison" /> La prison : deux tours, sauf delivrance</li>
        <li><span className="oie-puce oie-case-mort" /> La repetition : retour a la case 0</li>
      </ul>
    </div>
  );
};

export default Plateau;
