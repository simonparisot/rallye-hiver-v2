import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { adminAuthAPI } from '../services/adminAPI';
import { AdminUser } from '../types';

interface AdminAuthContextType {
  isAdmin: boolean;
  adminUser: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    verifyAdminStatus();
  }, []);

  // Auto-refresh token before expiration
  useEffect(() => {
    if (!isAdmin || !adminUser) return;

    const accessToken = localStorage.getItem('adminAccessToken');
    if (!accessToken) return;

    try {
      const decoded: any = jwtDecode(accessToken);
      const expiresAt = decoded.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      // Refresh 5 minutes before expiry
      const refreshTime = timeUntilExpiry - (5 * 60 * 1000);

      if (refreshTime > 0) {
        const timer = setTimeout(async () => {
          const refreshToken = localStorage.getItem('adminRefreshToken');
          if (refreshToken) {
            try {
              const response = await adminAuthAPI.refresh(refreshToken);
              localStorage.setItem('adminAccessToken', response.accessToken);
              localStorage.setItem('adminIdToken', response.idToken);
              // Refresh admin status to trigger this effect again with new token
              await verifyAdminStatus();
            } catch (error) {
              console.error('Failed to refresh admin token:', error);
              logout();
            }
          }
        }, refreshTime);

        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.error('Failed to decode admin token:', error);
    }
  }, [isAdmin, adminUser]);

  const verifyAdminStatus = async () => {
    try {
      const token = localStorage.getItem('adminAccessToken');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await adminAuthAPI.verifyAdmin();
      // API returns { user: { ...user data, isAdmin: true } }
      if (response.user && response.user.isAdmin) {
        setIsAdmin(true);
        setAdminUser(response.user);
      } else {
        localStorage.removeItem('adminAccessToken');
        localStorage.removeItem('adminRefreshToken');
        localStorage.removeItem('adminIdToken');
        setIsAdmin(false);
        setAdminUser(null);
      }
    } catch (error) {
      console.error('Admin verification failed:', error);
      localStorage.removeItem('adminAccessToken');
      localStorage.removeItem('adminRefreshToken');
      localStorage.removeItem('adminIdToken');
      setIsAdmin(false);
      setAdminUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await adminAuthAPI.login(email, password);
      localStorage.setItem('adminAccessToken', response.accessToken);
      localStorage.setItem('adminRefreshToken', response.refreshToken);
      localStorage.setItem('adminIdToken', response.idToken);
      setIsAdmin(true);
      setAdminUser(response.user);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('adminAccessToken');
    localStorage.removeItem('adminRefreshToken');
    localStorage.removeItem('adminIdToken');
    setIsAdmin(false);
    setAdminUser(null);
  };

  return (
    <AdminAuthContext.Provider value={{ isAdmin, adminUser, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
};
