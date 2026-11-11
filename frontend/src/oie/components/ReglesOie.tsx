import React from 'react';
import FenetreLecture from '../../components/FenetreLecture';

/**
 * Les règles du jeu de l'oie, dans la même fenêtre de lecture que les règles
 * du jeu générales.
 *
 * Ce texte décrit ce que fait le serveur, pas ce que disaient les premières
 * spécifications : chaque règle renvoie à backend/src/functions/oie/rules.ts
 * (numéros des cases, durées, recul en chaîne, rebond, metteur en scène),
 * roll.ts (quota, pénalités en jours, question finale), answer.ts (réponses)
 * et prompter.ts (souffleur). Si l'un d'eux change, ce texte doit suivre.
 *
 * La page de l'oie n'est ouverte qu'après le lancement, sous le thème
 * officiel : le vocabulaire du théâtre y est permis, comme sur le plateau.
 */

interface CaseSpeciale {
  numeros: string;
  /** Classe de couleur de la case sur le plateau (OiePage.css). */
  type: string;
  nom: string;
  effet: React.ReactNode;
}

const CASES: CaseSpeciale[] = [
  {
    numeros: '9, 18, 27, 36, 45, 54',
    type: 'oie',
    nom: "L'acteur sur son oie",
    effet: (
      <>
        Pas de question : vous gagnez un lancer supplémentaire, à jouer quand vous voulez.
        Il ne compte pas dans le quota du jour et reste permis même si vous l'avez épuisé.
      </>
    ),
  },
  {
    numeros: '6 → 12, 23 → 30, 47 → 53',
    type: 'pont',
    nom: 'Les ponts',
    effet: (
      <>
        On ne s'arrête pas sur le pont : vous passez directement sur la case d'en face,
        dont la question vous attend.
      </>
    ),
  },
  {
    numeros: '14, 39, 50, 60',
    type: 'souffleur',
    nom: 'Le souffleur',
    effet: (
      <>
        La question de la case a un indice. Demandez-le au souffleur quand vous voulez :
        c'est gratuit, et les organisateurs savent qui l'a demandé.
      </>
    ),
  },
  {
    numeros: '19',
    type: 'loge',
    nom: 'La loge',
    effet: (
      <>
        Vous passez un tour : plus de lancer ce jour-là ni le lendemain. Vous relancez
        le surlendemain (tombé un lundi, vous relancez le mercredi).
      </>
    ),
  },
  {
    numeros: '31',
    type: 'puits',
    nom: 'Le puits',
    effet: (
      <>
        Vous passez trois tours : vous relancez quatre jours plus tard (tombé un lundi,
        vous relancez le vendredi). Une autre équipe qui arrive sur la case vous en sort
        plus tôt (voir « Case occupée »).
      </>
    ),
  },
  {
    numeros: '52',
    type: 'prison',
    nom: 'La prison',
    effet: (
      <>
        Vous passez deux tours : vous relancez trois jours plus tard (tombé un lundi, vous
        relancez le jeudi). Une autre équipe qui arrive sur la case vous en sort plus tôt.
      </>
    ),
  },
  {
    numeros: '58',
    type: 'mort',
    nom: 'La répétition',
    effet: <>Tout est à refaire : retour à la case 0.</>,
  },
  {
    numeros: '63',
    type: 'arrivee',
    nom: 'Rideau',
    effet: (
      <>
        L'arrivée, à atteindre pile, ou grâce au metteur en scène (voir « La fin de
        partie »). La question finale vous y attend : c'est sa bonne réponse qui fait
        gagner.
      </>
    ),
  },
];

const ReglesOieContenu: React.FC<{ lancersParJour: number }> = ({ lancersParJour }) => (
  <>
    <section className="regles-section">
      <h3>Le but du jeu</h3>
      <p>
        Toutes les équipes jouent sur le même plateau de 63 cases. Votre équipe résout
        l'intrigue en atteignant la case 63 <strong>puis</strong> en y répondant juste à la
        question finale. Les équipes sont classées dans l'ordre de leur bonne réponse
        finale.
      </p>
    </section>

    <section className="regles-section">
      <h3>Votre tour</h3>
      <ul>
        <li>
          Vous lancez deux dés et avancez de leur somme. Les dés sont tirés par le serveur,
          pas par votre téléphone.
        </li>
        <li>
          Votre équipe a droit à{' '}
          <strong>
            {lancersParJour} lancer{lancersParJour > 1 ? 's' : ''} par jour
          </strong>
          , partagé{lancersParJour > 1 ? 's' : ''} entre tous ses membres. Le compteur
          repart à minuit, heure de Paris. Un lancer non utilisé ne se reporte pas au
          lendemain. Les organisateurs peuvent changer ce nombre en cours de partie.
        </li>
        <li>
          Sur la plupart des cases, une question vous attend. Tant que vous n'y avez pas
          répondu juste, vous ne pouvez pas relancer.
        </li>
        <li>
          Les essais sont illimités. Les majuscules, les accents, les espaces et la
          ponctuation ne comptent pas : « Moliere » vaut « Molière ! ».
        </li>
        <li>
          Pas de question sur la case 0, sur les cases de l'oie, sur les ponts ni sur la
          répétition : on ne fait qu'y passer.
        </li>
      </ul>
    </section>

    <section className="regles-section">
      <h3>Les cases spéciales</h3>
      <ul className="oie-regles-cases" data-testid="oie-regles-cases">
        {CASES.map((c) => (
          <li key={c.type}>
            <span className={`oie-regles-pastille oie-case-${c.type}`}>{c.numeros}</span>
            <span className="oie-regles-case-texte">
              <strong>{c.nom}.</strong> {c.effet}
            </span>
          </li>
        ))}
      </ul>
      <p>
        Une pénalité se compte en jours, à partir du jour où vous tombez sur la case : la
        carte de votre équipe affiche la date à laquelle vous relancez. Pendant ce temps, vous
        pouvez toujours répondre à la question de votre case.
      </p>
    </section>

    <section className="regles-section">
      <h3>La case occupée</h3>
      <ul>
        <li>
          Si vous terminez votre déplacement sur une case déjà occupée, l'équipe qui s'y
          trouvait <strong>recule d'une case</strong>. Si cette case est occupée à son tour,
          ses occupantes reculent elles aussi d'une case, et ainsi de suite.
        </li>
        <li>
          L'équipe qui recule reste sur sa nouvelle case sans en subir l'effet, même si c'est
          une oie, un pont, le puits ou la répétition : pas de lancer supplémentaire, pas de
          passage du pont, pas de chute dans le puits, pas de retour à 0. Si la case porte une
          question, elle doit y répondre avant de relancer.
        </li>
        <li>
          Reculer libère de toute pénalité (loge, puits, prison) : l'équipe repoussée peut
          relancer dès le jour même, dans la limite de son quota, une fois répondu à la
          question de sa nouvelle case s'il y en a une. En revanche, une équipe
          arrêtée sur une oie perd le lancer supplémentaire qui l'attendait.
        </li>
        <li>
          Seule la case où vous vous arrêtez compte : ni les cases traversées ni la case de
          départ d'un pont ne délogent personne.
        </li>
        <li>
          On partage sans reculer la case 0 et la case 63. Une équipe qui a gagné ne bouge
          plus.
        </li>
      </ul>
    </section>

    <section className="regles-section">
      <h3>La fin de partie</h3>
      <ul>
        <li>
          Il faut tomber pile sur la case 63. Si les dés vous emmènent plus loin, vous
          reculez d'autant de cases que vous en avez en trop : de la case 60, un 7 vous mène
          en 63 puis vous fait reculer en 59. La case où vous arrivez s'applique, oie,
          prison ou répétition comprises.
        </li>
        <li>
          Chaque dépassement compte, sur toute la partie. Au <strong>troisième</strong>, le
          metteur en scène vous place directement en case 63.
        </li>
        <li>
          En case 63, la question finale vous attend. Arriver ne suffit pas : c'est sa bonne
          réponse qui remporte l'intrigue. Les essais sont illimités.
        </li>
      </ul>
    </section>
  </>
);

interface ReglesOieProps {
  ouverte: boolean;
  onFermer: () => void;
  /** Quota quotidien en vigueur, tel que le serveur le donne. */
  lancersParJour: number;
}

const ReglesOie: React.FC<ReglesOieProps> = ({ ouverte, onFermer, lancersParJour }) => (
  <FenetreLecture
    ouverte={ouverte}
    onFermer={onFermer}
    titre="Règles du jeu de l'oie"
    idTitre="oie-regles-titre"
    libelleFermer="Fermer les règles du jeu de l'oie"
    prefixeTestId="oie-regles"
    testIdFenetre="oie-regles"
  >
    <ReglesOieContenu lancersParJour={lancersParJour} />
  </FenetreLecture>
);

export default ReglesOie;
