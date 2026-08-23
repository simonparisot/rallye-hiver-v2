import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Layout.css';
import { edition } from '../../editions';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="header-content">
          <Link to="/dashboard" className="logo">
            Rallye d'Hiver
          </Link>
          <nav className="nav">
            <Link to="/dashboard">Tableau de bord</Link>
            {user?.teamId ? (
              <Link to={`/team/${user.teamId}`}>Mon équipe</Link>
            ) : (
              <Link to="/team/browse">Équipes</Link>
            )}
            <Link to="/game">Jeu</Link>
            <Link to="/content">Énigmes</Link>
            <button onClick={handleLogout} className="btn-logout">
              Déconnexion
            </button>
          </nav>
        </div>
      </header>
      <main className="main-content">{children}</main>
      <footer className="footer">
        <p>&copy; {edition.year} Rallye d'Hiver. Tous droits réservés.</p>
      </footer>
    </div>
  );
};

export default Layout;
