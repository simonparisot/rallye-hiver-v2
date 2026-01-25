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
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <img src="/logo.png" alt="Rallye d'Hiver" className="admin-sidebar-logo" />
          <h2>Panneau Admin</h2>
        </div>

        <nav className="admin-nav">
          <Link
            to="/admin/overview"
            className={`admin-nav-item ${isActive('/overview') ? 'active' : ''}`}
          >
            <span className="nav-icon">📈</span>
            <span>Vue d'ensemble</span>
          </Link>

          <Link
            to="/admin/enigmas"
            className={`admin-nav-item ${isActive('/enigmas') ? 'active' : ''}`}
          >
            <span className="nav-icon">🧩</span>
            <span>Énigmes</span>
          </Link>

          <Link
            to="/admin/parcours"
            className={`admin-nav-item ${isActive('/parcours') ? 'active' : ''}`}
          >
            <span className="nav-icon">🗺️</span>
            <span>Parcours</span>
          </Link>

          <Link
            to="/admin/teams"
            className={`admin-nav-item ${isActive('/teams') ? 'active' : ''}`}
          >
            <span className="nav-icon">👥</span>
            <span>Équipes</span>
          </Link>

          <Link
            to="/admin/users"
            className={`admin-nav-item ${isActive('/users') ? 'active' : ''}`}
          >
            <span className="nav-icon">👤</span>
            <span>Utilisateurs</span>
          </Link>

          <Link
            to="/admin/attempts"
            className={`admin-nav-item ${isActive('/attempts') ? 'active' : ''}`}
          >
            <span className="nav-icon">📝</span>
            <span>Tentatives</span>
          </Link>

          <Link
            to="/admin/hints"
            className={`admin-nav-item ${isActive('/hints') ? 'active' : ''}`}
          >
            <span className="nav-icon">💡</span>
            <span>Indices</span>
          </Link>
        </nav>

        <div className="admin-user-info">
          <div className="admin-user-details">
            <p className="admin-user-name">{adminUser?.displayName}</p>
            <p className="admin-user-email">{adminUser?.email}</p>
          </div>
          <button onClick={handleLogout} className="btn btn-logout admin-logout-btn">
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-content">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
