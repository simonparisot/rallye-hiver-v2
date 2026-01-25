import React from 'react';
import './InfoPanel.css';

interface GeneralInfoPanelProps {
  isExpanded: boolean;
  isCompact: boolean;
}

const GeneralInfoPanel: React.FC<GeneralInfoPanelProps> = ({ isExpanded, isCompact }) => {
  return (
    <div className={`info-panel ${isCompact ? 'panel-compact' : ''}`}>
      <div className="panel-header">
        <h2>Le Rallye d'Hiver</h2>
      </div>
      <div className="panel-content">
        {!isExpanded ? (
          <div className="info-compact">
            <p className="tagline">Une chasse au trésor hivernale</p>
          </div>
        ) : (
          <div className="info-expanded">
            <section className="info-section">
              <p>
                Chaque année depuis presque 60 ans, le Rallye d'Hiver vous propose de découvrir un Paris pittoresque à travers le prisme d'une thématique particulière (précédemment la Musique, l'eau, les dames…).
              </p>
              <p>
                En pratique, des équipes de 2 à 7 personnes ont les trois mois d'hiver pour résoudre une vingtaine d'énigmes qui les conduisent sur des lieux en rapport avec le thème du Rallye. Là, les équipes doivent répondre à un questionnaire qui guide leur découverte du lieu. C'est l'occasion de se cultiver en s'amusant, et d'occuper les longues soirées d'hiver et les weekend brumeux !
              </p>
              <p>
                Vous êtes sur le site de l'édition 2026 du Rallye d'Hiver, qui débutera le 21 décembre 2025 et se terminera le 20 mars 2026.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeneralInfoPanel;
