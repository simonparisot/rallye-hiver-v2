import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import AdminOverview from './pages/AdminOverview';
import AdminEnigmas from './pages/AdminEnigmas';
import AdminParcours from './pages/AdminParcours';
import AdminTeams from './pages/AdminTeams';
import AdminUsers from './pages/AdminUsers';
import AdminAttempts from './pages/AdminAttempts';
import AdminHintRequests from './pages/AdminHintRequests';
import AdminLogin from './pages/AdminLogin';
import { useAdminAuth } from './contexts/AdminAuthContext';
import { edition } from '../editions';
import AdminOie from '../oie/admin/AdminOie';
import './AdminApp.css';
import './styles/admin.css';

const AdminApp: React.FC = () => {
  const { isAdmin, loading } = useAdminAuth();

  if (loading) {
    return (
      <div data-testid="admin-loading" className="admin-loading">
        <div className="loading-spinner">Chargement...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return <AdminLogin />;
  }

  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/overview" replace />} />
        <Route path="/overview" element={<AdminOverview />} />
        <Route path="/enigmas" element={<AdminEnigmas />} />
        <Route path="/parcours" element={<AdminParcours />} />
        <Route path="/teams" element={<AdminTeams />} />
        <Route path="/users" element={<AdminUsers />} />
        <Route path="/attempts" element={<AdminAttempts />} />
        <Route path="/hints" element={<AdminHintRequests />} />
        {/* Jeu de l'oie : seulement pour une édition qui le déclare */}
        {edition.enigmeOie && <Route path="/oie" element={<AdminOie />} />}
      </Routes>
    </AdminLayout>
  );
};

export default AdminApp;
