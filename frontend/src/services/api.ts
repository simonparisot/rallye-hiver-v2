import axios from 'axios';
import {
  User,
  Team,
  TeamListItem,
  EnigmaData,
  PendingRequest,
  EnigmasListResponse,
  BackendEnigma,
  ParcoursListResponse,
  BackendParcours,
  PasswordAttemptResponse,
  TeamProgressResponse,
  AccessibleParcoursResponse,
  ParcoursAccessResponse
} from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Create axios instance
// Exporte pour que les fonctionnalites hebergees hors de ce fichier (le jeu de
// l'oie de l'edition 2027, dans src/oie/) reutilisent les memes intercepteurs
// d'authentification et de rafraichissement de jeton.
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - Handle 401 and refresh token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string | null) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is not 401 or request already retried, reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(token => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      }).catch(err => {
        return Promise.reject(err);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
      // No refresh token - logout user
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('idToken');
      window.location.href = '/'; // Redirect to login
      return Promise.reject(error);
    }

    try {
      // Call refresh endpoint directly (don't use api instance to avoid circular calls)
      const response = await axios.post(`${API_URL}/auth/refresh`, {
        refreshToken,
      });

      const { accessToken, idToken } = response.data;

      // Update tokens in localStorage
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('idToken', idToken);

      // Update authorization header
      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;

      // Process queued requests
      processQueue(null, accessToken);

      return api(originalRequest);
    } catch (refreshError) {
      // Refresh failed - logout user
      processQueue(refreshError, null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('idToken');
      window.location.href = '/'; // Redirect to login
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// Auth API
export const authAPI = {
  signup: async (email: string, password: string, displayName: string) => {
    const response = await api.post('/auth/signup', { email, password, displayName });
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (email: string, code: string, newPassword: string) => {
    const response = await api.post('/auth/reset-password', { email, code, newPassword });
    return response.data;
  },

  refresh: async (refreshToken: string) => {
    const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
    return response.data;
  },
};

// User API
export const userAPI = {
  getPendingRequests: async (): Promise<{ pendingRequests: PendingRequest[] }> => {
    const response = await api.get('/users/pending-requests');
    return response.data;
  },
};

// Team API
export const teamAPI = {
  createTeam: async (teamName: string) => {
    const response = await api.post('/teams', { teamName });
    return response.data;
  },

  listTeams: async (): Promise<{ teams: TeamListItem[] }> => {
    const response = await api.get('/teams');
    return response.data;
  },

  getTeam: async (teamId: string): Promise<Team> => {
    const response = await api.get(`/teams/${teamId}`);
    return response.data;
  },

  joinTeam: async (teamId: string) => {
    const response = await api.post(`/teams/${teamId}/join`);
    return response.data;
  },

  approveRequest: async (teamId: string, userId: string) => {
    const response = await api.post(`/teams/${teamId}/approve/${userId}`);
    return response.data;
  },

  rejectRequest: async (teamId: string, userId: string) => {
    const response = await api.post(`/teams/${teamId}/reject/${userId}`);
    return response.data;
  },

  removeMember: async (teamId: string, userId: string) => {
    const response = await api.delete(`/teams/${teamId}/members/${userId}`);
    return response.data;
  },

  cancelJoinRequest: async (teamId: string) => {
    const response = await api.delete(`/teams/${teamId}/cancel-join`);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/teams/stats');
    return response.data;
  },
};

// Payment API
export const paymentAPI = {
  createCheckout: async (teamId: string): Promise<{ checkoutUrl: string }> => {
    const response = await api.post('/payments/create-checkout', { teamId });
    return response.data;
  },
};

// Content API
export const contentAPI = {
  checkAccess: async (): Promise<{ hasAccess: boolean; reason?: string }> => {
    const response = await api.get('/content/check-access');
    return response.data;
  },

  getEnigma: async (): Promise<{ enigmaData: EnigmaData }> => {
    const response = await api.get('/content/enigma');
    return response.data;
  },
};

// Enigma API (Game)
export const enigmaAPI = {
  listEnigmas: async (): Promise<EnigmasListResponse> => {
    const response = await api.get('/enigmas');
    return response.data;
  },

  getEnigma: async (enigmaId: string): Promise<{ enigma: BackendEnigma }> => {
    const response = await api.get(`/enigmas/${enigmaId}`);
    return response.data;
  },
};

// Parcours API (Game)
export const parcoursAPI = {
  listParcours: async (): Promise<ParcoursListResponse> => {
    const response = await api.get('/parcours');
    return response.data;
  },

  getParcours: async (parcoursId: string): Promise<{ parcours: BackendParcours }> => {
    const response = await api.get(`/parcours/${parcoursId}`);
    return response.data;
  },

  checkAccess: async (parcoursId: string): Promise<ParcoursAccessResponse> => {
    const response = await api.get(`/parcours/${parcoursId}/access`);
    return response.data;
  },

  markCompleted: async (parcoursId: string): Promise<{ message: string; parcoursId: string; completedAt: string }> => {
    const response = await api.post(`/parcours/${parcoursId}/complete`);
    return response.data;
  },

  unmarkCompleted: async (parcoursId: string): Promise<{ message: string; parcoursId: string }> => {
    const response = await api.delete(`/parcours/${parcoursId}/complete`);
    return response.data;
  },
};

// Progress API (Game)
export const progressAPI = {
  attemptPassword: async (enigmaId: string, password: string): Promise<PasswordAttemptResponse> => {
    const response = await api.post('/progress/attempt', { enigmaId, password });
    return response.data;
  },

  getTeamProgress: async (): Promise<TeamProgressResponse> => {
    const response = await api.get('/progress');
    return response.data;
  },

  getAccessibleParcours: async (): Promise<AccessibleParcoursResponse> => {
    const response = await api.get('/progress/parcours');
    return response.data;
  },
};

// Hints API (Game)
export const hintsAPI = {
  useHint: async (enigmaId: string): Promise<{
    success: boolean;
    hintPdfUrl: string;
    isFirstUse: boolean;
  }> => {
    const response = await api.post(`/hints/${enigmaId}/use`);
    return response.data;
  },
};

// Game Status API (Public - but sends auth token for beta team detection)
export const gameAPI = {
  getStatus: async (): Promise<{ isStarted: boolean; startedAt: string | null }> => {
    const response = await api.get('/game/status');
    return response.data;
  },
};
