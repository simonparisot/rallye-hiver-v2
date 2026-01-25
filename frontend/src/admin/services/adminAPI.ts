import axios from 'axios';
import {
  AdminStats,
  TeamWithProgress,
  AttemptRecord,
  EnigmaWithStats,
  ParcoursWithStats,
  CreateEnigmaRequest,
  CreateParcoursRequest,
  AdminUser,
} from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Create axios instance for admin
const adminApi = axios.create({
  baseURL: `${API_URL}/admin`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminAccessToken');
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

adminApi.interceptors.response.use(
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
        return adminApi(originalRequest);
      }).catch(err => {
        return Promise.reject(err);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('adminRefreshToken');

    if (!refreshToken) {
      // No refresh token - logout admin
      localStorage.removeItem('adminAccessToken');
      localStorage.removeItem('adminRefreshToken');
      localStorage.removeItem('adminIdToken');
      window.location.href = '/admin'; // Redirect to admin login
      return Promise.reject(error);
    }

    try {
      // Call refresh endpoint directly (don't use adminApi instance to avoid circular calls)
      const response = await axios.post(`${API_URL}/admin/auth/refresh`, {
        refreshToken,
      });

      const { accessToken, idToken } = response.data;

      // Update tokens in localStorage
      localStorage.setItem('adminAccessToken', accessToken);
      localStorage.setItem('adminIdToken', idToken);

      // Update authorization header
      adminApi.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;

      // Process queued requests
      processQueue(null, accessToken);

      return adminApi(originalRequest);
    } catch (refreshError) {
      // Refresh failed - logout admin
      processQueue(refreshError, null);
      localStorage.removeItem('adminAccessToken');
      localStorage.removeItem('adminRefreshToken');
      localStorage.removeItem('adminIdToken');
      window.location.href = '/admin'; // Redirect to admin login
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// Admin Auth API
export const adminAuthAPI = {
  login: async (email: string, password: string) => {
    const response = await adminApi.post('/auth/login', { email, password });
    return response.data;
  },

  verifyAdmin: async (): Promise<{ isAdmin: boolean; user?: AdminUser }> => {
    const response = await adminApi.get('/auth/verify');
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await adminApi.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (email: string, code: string, newPassword: string) => {
    const response = await adminApi.post('/auth/reset-password', { email, code, newPassword });
    return response.data;
  },

  refresh: async (refreshToken: string) => {
    const response = await axios.post(`${API_URL}/admin/auth/refresh`, { refreshToken });
    return response.data;
  },
};

// Admin Stats API
export const adminStatsAPI = {
  getOverview: async (): Promise<AdminStats> => {
    const response = await adminApi.get('/stats/overview');
    return response.data;
  },

  getPasswordAttemptsTimeline: async (): Promise<{
    timeline: Array<{
      day: string;
      timestamp: string;
      correctAttempts: number;
      incorrectAttempts: number;
      totalAttempts: number;
      successRate: number;
    }>;
    summary: {
      totalAttempts: number;
      correctAttempts: number;
      incorrectAttempts: number;
      successRate: number;
      periodStart: string;
      periodEnd: string;
      daysIncluded: number;
    };
  }> => {
    const response = await adminApi.get('/stats/password-attempts-timeline');
    return response.data;
  },
};

// Admin Enigmas API
export const adminEnigmasAPI = {
  listAll: async (): Promise<{ enigmas: EnigmaWithStats[]; count: number }> => {
    const response = await adminApi.get('/enigmas');
    return response.data;
  },

  getById: async (enigmaId: string): Promise<{ enigma: EnigmaWithStats }> => {
    const response = await adminApi.get(`/enigmas/${enigmaId}`);
    return response.data;
  },

  create: async (data: CreateEnigmaRequest): Promise<{ enigma: EnigmaWithStats }> => {
    const response = await adminApi.post('/enigmas', data);
    return response.data;
  },

  update: async (enigmaId: string, data: Partial<CreateEnigmaRequest>): Promise<{ enigma: EnigmaWithStats }> => {
    const response = await adminApi.put(`/enigmas/${enigmaId}`, data);
    return response.data;
  },

  delete: async (enigmaId: string): Promise<{ success: boolean }> => {
    const response = await adminApi.delete(`/enigmas/${enigmaId}`);
    return response.data;
  },

  getByDifficulty: async (forceRefresh?: boolean): Promise<{
    enigmas: Array<{
      enigmaId: string;
      enigmaNumber: number;
      title: string;
      difficulty: number | null;
      metrics: {
        totalAttempts: number;
        resolutions: number;
        activeTeams: number;
        totalTeams: number;
        avgResolutionTimeDays: number | null;
        intensityScore: number;
        failureRateScore: number;
        timeScore: number;
      };
      lastCalculated: string;
    }>;
    fromCache: boolean;
    calculatedAt: string;
    cacheTtlHours: number;
  }> => {
    const params = forceRefresh ? { forceRefresh: 'true' } : {};
    const response = await adminApi.get('/enigmas/by-difficulty', { params });
    return response.data;
  },
};

// Admin Parcours API
export const adminParcoursAPI = {
  listAll: async (): Promise<{ parcours: ParcoursWithStats[]; count: number }> => {
    const response = await adminApi.get('/parcours');
    return response.data;
  },

  getById: async (parcoursId: string): Promise<{ parcours: ParcoursWithStats }> => {
    const response = await adminApi.get(`/parcours/${parcoursId}`);
    return response.data;
  },

  create: async (data: CreateParcoursRequest): Promise<{ parcours: ParcoursWithStats }> => {
    const response = await adminApi.post('/parcours', data);
    return response.data;
  },

  update: async (parcoursId: string, data: Partial<CreateParcoursRequest>): Promise<{ parcours: ParcoursWithStats }> => {
    const response = await adminApi.put(`/parcours/${parcoursId}`, data);
    return response.data;
  },

  delete: async (parcoursId: string): Promise<{ success: boolean }> => {
    const response = await adminApi.delete(`/parcours/${parcoursId}`);
    return response.data;
  },
};

// Admin Teams API
export const adminTeamsAPI = {
  listAll: async (): Promise<{ teams: TeamWithProgress[]; count: number }> => {
    const response = await adminApi.get('/teams');
    return response.data;
  },

  getById: async (teamId: string): Promise<{ team: TeamWithProgress }> => {
    const response = await adminApi.get(`/teams/${teamId}`);
    return response.data;
  },

  getProgress: async (teamId: string): Promise<{ progress: any[] }> => {
    const response = await adminApi.get(`/teams/${teamId}/progress`);
    return response.data;
  },

  // Get all teams with detailed progress (enigmas + parcours statuses)
  getAllWithProgress: async (): Promise<{
    teams: Array<{
      teamId: string;
      teamName: string;
      hasPaid: boolean;
      isBetaTeam: boolean;
      memberCount: number;
      lastActivityAt: string | null;
      enigmasProgress: boolean[]; // Array of booleans (enigma solved status in order)
      parcoursProgress: boolean[]; // Array of booleans (parcours completed status in order)
      solvedCount: number;
      completedParcoursCount: number;
    }>;
    metadata: {
      totalTeams: number;
      enigmaIds: string[];
      enigmaTitles: string[];
      enigmaNumbers: number[];
      parcoursIds: string[];
      parcoursTitles: string[];
      parcoursNumbers: number[];
    };
  }> => {
    const response = await adminApi.get('/teams/progress-grid');
    return response.data;
  },
};

// Admin Attempts API
export const adminAttemptsAPI = {
  listAll: async (filters?: {
    teamId?: string;
    enigmaId?: string;
    success?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    attempts: AttemptRecord[];
    stats: {
      totalAttempts: number;
      totalSuccessful: number;
      totalFailed: number;
      activeTeams: number;
      successRate: number;
    };
  }> => {
    const response = await adminApi.get('/attempts', { params: filters });
    return response.data;
  },

  getByTeam: async (teamId: string): Promise<{ attempts: AttemptRecord[]; count: number }> => {
    const response = await adminApi.get(`/attempts/team/${teamId}`);
    return response.data;
  },

  getByEnigma: async (enigmaId: string): Promise<{ attempts: AttemptRecord[]; count: number }> => {
    const response = await adminApi.get(`/attempts/enigma/${enigmaId}`);
    return response.data;
  },
};

// Admin Game Control API
export const adminGameAPI = {
  startGame: async (): Promise<{
    message: string;
    gameStatus: {
      gameId: string;
      isStarted: boolean;
      startedAt: string;
      startedBy: string;
      createdAt: string;
      updatedAt: string;
    };
  }> => {
    const response = await adminApi.post('/game/start');
    return response.data;
  },
};

// Admin Users API
export const adminUsersAPI = {
  listUsersWithoutTeam: async (): Promise<{
    users: Array<{
      userId: string;
      email: string;
      displayName: string;
      hasPendingRequest: boolean;
      pendingTeamName: string | null;
      createdAt: string;
    }>;
    count: number;
  }> => {
    const response = await adminApi.get('/users');
    return response.data;
  },

  listAllUsers: async (): Promise<{
    users: Array<{
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
    }>;
    count: number;
  }> => {
    const response = await adminApi.get('/users/all');
    return response.data;
  },
};

// Admin Upload API
export const adminUploadAPI = {
  generateUploadUrl: async (): Promise<{
    uploadUrl: string;
    fileUrl: string;
    fileKey: string;
    expiresIn: number;
    message: string;
  }> => {
    const response = await adminApi.post('/upload/generate-url', {
      contentType: 'application/pdf',
      fileExtension: 'pdf',
    });
    return response.data;
  },

  uploadPdf: async (uploadUrl: string, file: File): Promise<void> => {
    // Upload directly to S3 using the presigned URL (no auth headers needed)
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': 'application/pdf',
      },
    });
  },
};
