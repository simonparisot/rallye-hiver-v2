import React from 'react';
import { OieSquareView, OieTeamPawn } from '../types';
import { illustrationDeCase } from '../illustrations';

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
  pont: 'Le pont',
  souffleur: 'Souffleur',
  loge: 'La loge',
  puits: 'Le puits',
  prison: 'La prison',
  mort: 'La répétition',
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

const COTE = 8;

/**
 * Place des 64 cases sur la grille, en spirale comme le plateau traditionnel :
 * depart dans le coin en haut a gauche, on longe le haut vers la droite, on
 * descend, on repart vers la gauche, on remonte, et ainsi de suite en
 * s'enroulant vers l'interieur jusqu'a la 63, au centre. Une grille de huit
 * sur huit contient exactement les 64 cases, de 0 a 63.
 */
function spirale(cote: number): { ligne: number; colonne: number }[] {
  const places: { ligne: number; colonne: number }[] = [];
  const prise = Array.from({ length: cote }, () => Array(cote).fill(false));
  // Droite, bas, gauche, haut : le sens des aiguilles d'une montre.
  const directions = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ];
  let ligne = 0;
  let colonne = 0;
  let sens = 0;

  for (let numero = 0; numero < cote * cote; numero += 1) {
    places.push({ ligne, colonne });
    prise[ligne][colonne] = true;

    const [dl, dc] = directions[sens];
    const suivante = { ligne: ligne + dl, colonne: colonne + dc };
    const libre =
      suivante.ligne >= 0 &&
      suivante.ligne < cote &&
      suivante.colonne >= 0 &&
      suivante.colonne < cote &&
      !prise[suivante.ligne][suivante.colonne];
    if (!libre) sens = (sens + 1) % 4;

    ligne += directions[sens][0];
    colonne += directions[sens][1];
  }
  return places;
}

const PLACES = spirale(COTE);

/**
 * La grille alterne pistes de cases et pistes de joints : la case (l, c) est
 * sur la piste 2l+1, 2c+1, et le joint entre deux cases voisines sur la piste
 * paire qui les separe. Le chemin de la spirale comble les joints entre deux
 * cases qui se suivent ; les autres restent vides et font office de murs.
 */
const PISTE = (index: number) => index * 2 + 1;

/**
 * Les murs : entre deux cases voisines qui ne se suivent pas, un trait sombre
 * dans le joint. Avec le chemin dore, ils dessinent le couloir de la spirale.
 */
const NUMERO_EN = new Map(PLACES.map((place, numero) => [`${place.ligne},${place.colonne}`, numero]));

const MURS: { cle: string; horizontal: boolean; gridRow: number; gridColumn: number }[] = [];
PLACES.forEach((place, numero) => {
  const droite = NUMERO_EN.get(`${place.ligne},${place.colonne + 1}`);
  if (droite !== undefined && Math.abs(droite - numero) !== 1) {
    // Deux cases cote a cote : le mur est un trait vertical.
    MURS.push({
      cle: `mur-${numero}-droite`,
      horizontal: false,
      gridRow: PISTE(place.ligne),
      gridColumn: place.colonne * 2 + 2,
    });
  }
  const dessous = NUMERO_EN.get(`${place.ligne + 1},${place.colonne}`);
  if (dessous !== undefined && Math.abs(dessous - numero) !== 1) {
    MURS.push({
      cle: `mur-${numero}-dessous`,
      horizontal: true,
      gridRow: place.ligne * 2 + 2,
      gridColumn: PISTE(place.colonne),
    });
  }
});

const LIENS = PLACES.slice(0, -1).map((place, numero) => {
  const suivante = PLACES[numero + 1];
  const horizontal = place.ligne === suivante.ligne;
  return {
    numero,
    horizontal,
    gridRow: horizontal ? PISTE(place.ligne) : Math.min(place.ligne, suivante.ligne) * 2 + 2,
    gridColumn: horizontal ? Math.min(place.colonne, suivante.colonne) * 2 + 2 : PISTE(place.colonne),
  };
});

const Plateau: React.FC<PlateauProps> = ({ squares, teams, caseSurlignee }) => {
  const parCase = new Map<number, OieTeamPawn[]>();
  teams.forEach((team) => {
    const liste = parCase.get(team.position) || [];
    liste.push(team);
    parCase.set(team.position, liste);
  });

  return (
    <div className="oie-plateau-cadre">
      <div className="oie-plateau" data-testid="oie-plateau">
        {squares.map((square) => {
          const place = PLACES[square.squareNumber];
          const pions = parCase.get(square.squareNumber) || [];
          const mienne = pions.some((pion) => pion.isMine);
          const libelle = LIBELLES[square.type];
          const illustration = illustrationDeCase(square.squareNumber);

          return (
            <div
              key={square.squareNumber}
              data-testid={`oie-case-${square.squareNumber}`}
              className={[
                'oie-case',
                `oie-case-${square.type}`,
                illustration ? 'oie-case-illustree' : '',
                mienne ? 'oie-case-mienne' : '',
                caseSurlignee === square.squareNumber ? 'oie-case-surlignee' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              title={libelle ? `Case ${square.squareNumber} : ${libelle}` : `Case ${square.squareNumber}`}
              style={{ gridRow: PISTE(place.ligne), gridColumn: PISTE(place.colonne) }}
            >
              {illustration && (
                // Decorative : le numero, le libelle et l'info-bulle portent
                // deja tout le sens de la case.
                <img className="oie-case-illustration" src={illustration} alt="" loading="lazy" />
              )}
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
        })}
        {MURS.map((mur) => (
          <span
            key={mur.cle}
            className={`oie-mur ${mur.horizontal ? 'oie-mur-horizontal' : 'oie-mur-vertical'}`}
            style={{ gridRow: mur.gridRow, gridColumn: mur.gridColumn }}
            aria-hidden="true"
          />
        ))}
        {LIENS.map((lien) => (
          <span
            key={`lien-${lien.numero}`}
            className={`oie-lien ${lien.horizontal ? 'oie-lien-horizontal' : 'oie-lien-vertical'}`}
            style={{ gridRow: lien.gridRow, gridColumn: lien.gridColumn }}
            aria-hidden="true"
          />
        ))}
      </div>

      <ul className="oie-legende" data-testid="oie-legende">
        <li><span className="oie-puce oie-case-oie" /> L'acteur sur son oie : on relance les dés</li>
        <li><span className="oie-puce oie-case-pont" /> Le pont : on passe directement en face, de 6 à 12, de 23 à 30, de 47 à 53</li>
        <li><span className="oie-puce oie-case-souffleur" /> Le souffleur : un indice sur demande</li>
        <li><span className="oie-puce oie-case-loge" /> La loge : on passe un tour</li>
        <li><span className="oie-puce oie-case-puits" /> Le puits : trois tours, sauf repêchage</li>
        <li><span className="oie-puce oie-case-prison" /> La prison : deux tours, sauf délivrance</li>
        <li><span className="oie-puce oie-case-mort" /> La répétition : retour à la case 0</li>
        <li><span className="oie-puce oie-case-arrivee" /> Rideau : la question finale, celle qui fait gagner</li>
        <li><span className="oie-puce" /> Case occupée : l'équipe qui s'y trouvait part sur la case d'où vous venez</li>
      </ul>
    </div>
  );
};

export default Plateau;
