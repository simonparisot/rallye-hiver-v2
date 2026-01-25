import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PendingRequests from '../components/user/PendingRequests';
import { getEnigmasWithProgress, getParcoursWithAccess } from '../services/gameService';
import { teamAPI } from '../services/api';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadAllContent = async () => {
    if (!user?.teamId) {
      alert('Vous devez être dans une équipe pour télécharger les contenus.');
      return;
    }

    try {
      setIsDownloading(true);

      // Récupérer toutes les données en parallèle
      const [enigmas, parcours, teamData] = await Promise.all([
        getEnigmasWithProgress(),
        getParcoursWithAccess(),
        teamAPI.getTeam(user.teamId),
      ]);

      // Créer l'objet de données à télécharger
      const contentData = {
        exportDate: new Date().toISOString(),
        exportedBy: user.displayName,
        team: {
          teamId: teamData.teamId,
          teamName: teamData.teamName,
          memberCount: teamData.members.length,
          hasPaid: teamData.hasPaid,
        },
        enigmas: enigmas,
        parcours: parcours,
        summary: {
          totalEnigmas: enigmas.length,
          solvedEnigmas: enigmas.filter(e => e.isSolved).length,
          totalParcours: parcours.length,
          unlockedParcours: parcours.filter(p => p.isUnlocked).length,
          completedParcours: parcours.filter(p => p.isCompleted).length,
        }
      };

      // Créer le fichier JSON
      const jsonString = JSON.stringify(contentData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Télécharger le fichier
      const link = document.createElement('a');
      link.href = url;
      const sanitizedTeamName = teamData.teamName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const dateStr = new Date().toISOString().slice(0, 10);
      link.download = `rallyehiver-${sanitizedTeamName}-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert('Contenus téléchargés avec succès !');
    } catch (error) {
      console.error('Erreur lors du téléchargement des contenus:', error);
      alert('Erreur lors du téléchargement des contenus. Veuillez réessayer.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="dashboard">
      <h1>Tableau de bord</h1>
      <div className="welcome">
        <h2>Bienvenue, {user?.displayName} !</h2>
      </div>

      {!user?.teamId ? (
        <div className="no-team">
          <p>Vous n'êtes pas encore dans une équipe.</p>

          <PendingRequests />

          <div className="dashboard-actions">
            <Link to="/team/create" className="btn btn-primary">
              Créer une équipe
            </Link>
            <Link to="/team/browse" className="btn btn-secondary">
              Rejoindre une équipe
            </Link>
          </div>
        </div>
      ) : (
        <div className="has-team">
          <p>Vous êtes membre d'une équipe ({user.role})</p>
          <div className="dashboard-actions">
            <Link to={`/team/${user.teamId}`} className="btn btn-primary">
              Voir mon équipe
            </Link>
            <Link to="/content" className="btn btn-secondary">
              Accéder aux énigmes
            </Link>
            <button
              onClick={handleDownloadAllContent}
              className="btn btn-secondary"
              disabled={isDownloading}
            >
              {isDownloading ? 'Téléchargement...' : 'Télécharger tous les contenus'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
