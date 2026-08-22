import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminUsersAPI } from '../services/adminAPI';
import './AdminUsers.css';

type TeamStatus = 'all' | 'no_team' | 'pending' | 'member';
type UserRole = 'all' | 'leader' | 'member';

interface User {
  userId: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastLoginAt: string | null;
  teamId: string | null;
  teamName: string | null;
  isTeamLeader: boolean;
  teamStatus: 'no_team' | 'pending' | 'member';
  pendingTeamName: string | null;
  passwordAttemptsCount: number;
  isAdmin: boolean;
}

const AdminUsers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TeamStatus>('all');
  const [roleFilter, setRoleFilter] = useState<UserRole>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['adminAllUsers'],
    queryFn: adminUsersAPI.listAllUsers,
  });

  const users = data?.users || [];

  // Filter and search logic
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Search filter (name or email)
      const matchesSearch =
        user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === 'all' || user.teamStatus === statusFilter;

      // Role filter
      const matchesRole =
        roleFilter === 'all' ||
        (roleFilter === 'leader' && user.isTeamLeader) ||
        (roleFilter === 'member' && user.teamId && !user.isTeamLeader);

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [users, searchTerm, statusFilter, roleFilter]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (user: User) => {
    if (user.teamStatus === 'member') {
      return <span className="status-badge member">{user.isTeamLeader ? '👑 Chef' : 'Membre'}</span>;
    }
    if (user.teamStatus === 'pending') {
      return <span className="status-badge pending">⏳ En attente</span>;
    }
    return <span className="status-badge no-team">Pas d'équipe</span>;
  };

  const getTeamDisplay = (user: User) => {
    if (user.teamName) {
      return (
        <div className="team-info">
          <span className="user-team-name">{user.teamName}</span>
          {user.isTeamLeader && <span className="leader-badge">👑</span>}
        </div>
      );
    }
    if (user.pendingTeamName) {
      return <span className="pending-team">→ {user.pendingTeamName}</span>;
    }
    return <span className="no-team-text">-</span>;
  };

  if (isLoading) return <div data-testid="admin-users-loading" className="loading">Chargement des utilisateurs...</div>;
  if (error) return <div data-testid="admin-users-error" className="error">Échec du chargement des utilisateurs</div>;

  // Calculate statistics
  const totalUsers = users.length;
  const activeUsers = users.filter(user => user.passwordAttemptsCount > 0).length;

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const recentUsers = users.filter(user => {
    if (!user.lastLoginAt) return false;
    return new Date(user.lastLoginAt) >= twoWeeksAgo;
  }).length;

  return (
    <div data-testid="admin-users-page" className="admin-users">
      <div className="admin-page-header">
        <div>
          <h1>Gestion des utilisateurs</h1>
          <p className="admin-page-subtitle">
            {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''}
            {users.length !== filteredUsers.length && ` (${users.length} au total)`}
          </p>
        </div>
      </div>

      <div className="users-filters card">
        <div className="search-box">
          <input data-testid="admin-users-search-input"
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="admin-input"
          />
        </div>

        <div className="filter-controls">
          <div className="filter-group">
            <label>Statut d'inscription</label>
            <select data-testid="admin-users-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TeamStatus)}
              className="admin-select"
            >
              <option value="all">Tous les statuts</option>
              <option value="member">Dans une équipe</option>
              <option value="pending">En attente</option>
              <option value="no_team">Pas d'équipe</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Rôle</label>
            <select data-testid="admin-users-role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole)}
              className="admin-select"
            >
              <option value="all">Tous les rôles</option>
              <option value="leader">Chef d'équipe</option>
              <option value="member">Membre d'équipe</option>
            </select>
          </div>
        </div>

        {/* Statistics */}
        <div className="summary-stats">
          <div className="summary-stat">
            <div className="summary-stat__value">{totalUsers}</div>
            <div className="summary-stat__label">Inscrits</div>
          </div>
          <div className="summary-stat summary-stat--success">
            <div className="summary-stat__value">{activeUsers}</div>
            <div className="summary-stat__label">Actifs (tentatives)</div>
          </div>
          <div className="summary-stat summary-stat--purple">
            <div className="summary-stat__value">{recentUsers}</div>
            <div className="summary-stat__label">Connectés (14j)</div>
          </div>
        </div>
      </div>

      <div className="users-list">
        <table data-testid="admin-users-table" className="admin-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Inscription</th>
              <th>Équipe</th>
              <th>Statut</th>
              <th>Tentatives</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td data-testid="admin-users-empty" colSpan={6} className="empty-state-cell">
                  {searchTerm || statusFilter !== 'all' || roleFilter !== 'all' ? (
                    <p>Aucun utilisateur ne correspond aux filtres sélectionnés.</p>
                  ) : (
                    <p>Aucun utilisateur inscrit pour le moment.</p>
                  )}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr data-testid={`admin-users-row-${user.userId}`} key={user.userId} className={user.isAdmin ? 'admin-row' : ''}>
                  <td>
                    <div className="user-name">
                      {user.displayName}
                      {user.isAdmin && <span className="admin-badge">Admin</span>}
                    </div>
                  </td>
                  <td className="user-email">{user.email}</td>
                  <td className="date-cell">{formatDate(user.createdAt)}</td>
                  <td>{getTeamDisplay(user)}</td>
                  <td>{getStatusBadge(user)}</td>
                  <td className="attempts-cell">
                    <span className="attempts-count">{user.passwordAttemptsCount}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
