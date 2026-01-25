import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { jwtDecode } from 'jwt-decode';
import { User } from '../types';
import { authAPI } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  // Auto-refresh token before expiration
  useEffect(() => {
    if (!user) return;

    const accessToken = localStorage.getItem('accessToken');
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
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const response = await authAPI.refresh(refreshToken);
              localStorage.setItem('accessToken', response.accessToken);
              localStorage.setItem('idToken', response.idToken);
              // Refresh the user to trigger this effect again with new token
              await refreshUser();
            } catch (error) {
              console.error('Failed to refresh token:', error);
              logout();
            }
          }
        }, refreshTime);

        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.error('Failed to decode token:', error);
    }
  }, [user]);

  const loadUser = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        const userData = await authAPI.getMe();
        setUser(userData);

        // Invalidate game status cache to ensure beta teams get correct status
        // This handles the case where user was already logged in on page load
        queryClient.invalidateQueries({ queryKey: ['gameStatus'] });
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('idToken');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await authAPI.login(email, password);

    // Store tokens
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('idToken', response.idToken);

    // Set user
    setUser(response.user);

    // CRITICAL: Invalidate game status cache after login
    // This forces React Query to refetch game status WITH the new auth token
    // Allows beta teams to get isStarted: true even before official launch
    queryClient.invalidateQueries({ queryKey: ['gameStatus'] });
  };

  const signup = async (email: string, password: string, displayName: string) => {
    await authAPI.signup(email, password, displayName);
    // After signup, automatically log in
    await login(email, password);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('idToken');
    setUser(null);

    // Invalidate game status cache on logout
    // Ensures logged-out users see the real game status (not beta access)
    queryClient.invalidateQueries({ queryKey: ['gameStatus'] });
  };

  const refreshUser = async () => {
    try {
      const userData = await authAPI.getMe();
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
