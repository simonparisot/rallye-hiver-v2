import React from 'react';
import './InfoPanel.css';

interface EditionInfoPanelProps {
  isExpanded: boolean;
  isCompact: boolean;
}

const EditionInfoPanel: React.FC<EditionInfoPanelProps> = ({ isExpanded, isCompact }) => {
  return (
    <div data-testid="edition-info-panel" className={`info-panel ${isCompact ? 'panel-compact' : ''}`}>
      <div className="panel-header">
        <h2>Règles du jeu</h2>
      </div>
      <div className="panel-content">
        {!isExpanded ? (
          <div className="info-compact">
            <p className="tagline">Édition Hiver 2026</p>
          </div>
        ) : (
          <div className="info-expanded">
            <section className="info-section">
              <h3>Les Énigmes</h3>
              <p>
                Le Rallye comprend environ <strong>20 énigmes</strong> à résoudre principalement depuis chez vous. Chaque énigme donne un mot de passe, que vous pouvez soumettre sur ce site pour vérifier si vous avez résolu l'énigme. Les énigmes sont de niveau de difficulté variable, mais ne nécessite aucun connaissance pointue. Seulement de la logique, de l'observation, de la communication (au sein de votre équipe) et une bonne dose de "<i>Et si j'essayais ça ...</i>".
              </p>
            </section>

            <section className="info-section">
              <h3>Les Parcours</h3>
              <p>
                "<i>Un esprit sain dans un corps sain</i>". Pour arriver au bout de ce Rallye, il ne vous suffira pas de faire marcher votre intellect, mais également vos jambes ! Une dizaine de lieux sont à visiter, tous situés dans Paris ou en proximité. Ils sont sélectionnés pour leur intérêt, leur rapport certain avec le thème du Rallye et peuvent être en extérieur (parc, quartier,...) ou en intérieur (musée, monument, ..).
              </p>
              <p>
                Chaque lieu se visite suivant un <b>Parcours</b> que vous pouvez télécharger et imprimer depuis ce site. Ce parcours vous donnera le nom du lieu à visiter, guidera votre marche et sera semé de questions. De quoi vous assurer une visite originale et pleinement active du lieu en question, tout en maintenant la compétition !
              </p>
            </section>

            <section className="info-section">
              <h3>Constitution des équipes</h3>
              <p>
                Les équipes comptent en général de <strong>2 à 7 personnes</strong>, mais il n'y a, en pratique, aucune limite. Vous pouvez jouer en famille, entre amis ou entre collègues de bureaux. Cela anime parfaitement les diners de Noël qui trainent en longueur ou les premiers rendez-vous romantiques mal engagés.
              </p>
            </section>

            <section className="info-section">
              <h3>Tarif</h3>
              <p>
                La participation coûte <strong>29€ par équipe</strong>, quel que soit le nombre de membres. Un seul paiement donne accès à tous les membres de l'équipe pour toute la durée du Rallye.
              </p>
            </section>

            <section className="info-section">
              <h3>Déroulement</h3>
              <p>
                Vous disposez de <strong>3 mois</strong> (du 21 décembre 2025 au 20 mars 2026) pour résoudre les énigmes et faire les parcours à votre rythme. Parfait pour occuper les longues soirées d'hiver et les weekends brumeux !
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditionInfoPanel;
