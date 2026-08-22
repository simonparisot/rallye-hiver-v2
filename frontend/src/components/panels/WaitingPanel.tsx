import React from 'react';
import './WaitingPanel.css';

const WaitingPanel: React.FC = () => {
  return (
    <div data-testid="waiting-panel" className="waiting-panel">
      <div className="waiting-content">
        <h2>🎄 Le Rallye d'Hiver 2025 n'a pas encore commencé</h2>
        <div className="waiting-message">
          <p className="waiting-text">
            Votre équipe est prête et votre inscription est validée !
          </p>
          <p className="waiting-text">
            Le rallye débutera officiellement <strong className="highlight-date">aujourd'hui</strong> ! On est en train de caler l'heure exacte, un peu de patience ;)
          </p>
          <div className="waiting-icon">⏳</div>
        </div>
      </div>
    </div>
  );
};

export default WaitingPanel;
