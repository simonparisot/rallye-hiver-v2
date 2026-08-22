import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import './AdminLayout.css';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { adminUser, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  const isActive = (path: string) => location.pathname.includes(path);

  return (
    <div data-testid="admin-layout" className="admin-layout">
      <aside data-testid="admin-sidebar" className="admin-sidebar">
        <div className="admin-logo">
          <img src="/logo.png" alt="Rallye d'Hiver" className="admin-sidebar-logo" />
          <h2>Panneau Admin</h2>
        </div>

        <nav data-testid="admin-nav" className="admin-nav">
          <Link data-testid="admin-nav-overview"
            to="/admin/overview"
            className={`admin-nav-item ${isActive('/overview') ? 'active' : ''}`}
          >
            <span className="nav-icon">📈</span>
            <span>Vue d'ensemble</span>
          </Link>

          <Link data-testid="admin-nav-enigmas"
            to="/admin/enigmas"
            className={`admin-nav-item ${isActive('/enigmas') ? 'active' : ''}`}
          >
            <span className="nav-icon">🧩</span>
            <span>Énigmes</span>
          </Link>

          <Link data-testid="admin-nav-parcours"
            to="/admin/parcours"
            className={`admin-nav-item ${isActive('/parcours') ? 'active' : ''}`}
          >
            <span className="nav-icon">🗺️</span>
            <span>Parcours</span>
          </Link>

          <Link data-testid="admin-nav-teams"
            to="/admin/teams"
            className={`admin-nav-item ${isActive('/teams') ? 'active' : ''}`}
          >
            <span className="nav-icon">👥</span>
            <span>Équipes</span>
          </Link>

          <Link data-testid="admin-nav-users"
            to="/admin/users"
            className={`admin-nav-item ${isActive('/users') ? 'active' : ''}`}
          >
            <span className="nav-icon">👤</span>
            <span>Utilisateurs</span>
          </Link>

          <Link data-testid="admin-nav-attempts"
            to="/admin/attempts"
            className={`admin-nav-item ${isActive('/attempts') ? 'active' : ''}`}
          >
            <span className="nav-icon">📝</span>
            <span>Tentatives</span>
          </Link>

          <Link data-testid="admin-nav-hints"
            to="/admin/hints"
            className={`admin-nav-item ${isActive('/hints') ? 'active' : ''}`}
          >
            <span className="nav-icon">💡</span>
            <span>Indices</span>
          </Link>
        </nav>

        <div data-testid="admin-user-info" className="admin-user-info">
          <div className="admin-user-details">
            <p data-testid="admin-user-name" className="admin-user-name">{adminUser?.displayName}</p>
            <p data-testid="admin-user-email" className="admin-user-email">{adminUser?.email}</p>
          </div>
          <button data-testid="admin-logout-button" onClick={handleLogout} className="btn btn-logout admin-logout-btn">
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div data-testid="admin-content" className="admin-content">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
